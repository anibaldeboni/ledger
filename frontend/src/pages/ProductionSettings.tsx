import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProductionColumn } from "../../bindings/ledger/internal/domain/models";
import { LedgerService } from "../../bindings/ledger";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { useActionError, useAsync, useSubmission } from "../lib/hooks";
import { reorderProductionColumns } from "../lib/production-board";
import ProductionStageManager from "./ProductionStageManager";

export default function ProductionSettings() {
  const { t } = useTranslation();
  const columns = useAsync(() => LedgerService.ListProductionColumns(), []);
  const stages = columns.data ?? [];
  const [pendingDelete, setPendingDelete] = useState<ProductionColumn | null>(null);
  const [actionError, setActionError, clearActionError] = useActionError();
  const { busy, run } = useSubmission();

  async function perform(action: () => Promise<unknown>): Promise<boolean> {
    clearActionError();
    try {
      const succeeded = await run(async () => {
        await action();
        columns.reload();
        return true;
      });
      return succeeded === true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "Não é possível excluir esta coluna porque ela contém tickets.") {
        setActionError(t("production.columns.occupiedError"));
      } else if (message === "A coluna de conclusão é obrigatória e não pode ser excluída.") {
        setActionError(t("production.columns.completionProtected"));
      } else {
        setActionError(error);
      }
      return false;
    }
  }

  function reorderStage(index: number, offset: -1 | 1) {
    const reordered = reorderProductionColumns(stages, index, offset);
    if (reordered === stages) return;
    void perform(() => LedgerService.ReorderProductionColumns(reordered.map((column) => column.id)));
  }

  async function confirmDelete() {
    const column = pendingDelete;
    if (!column) return;
    setPendingDelete(null);
    await perform(() => LedgerService.DeleteProductionColumn(column.id));
  }

  return (
    <div className="production-page production-settings-page">
      <div className="page-head">
        <h1>{t("settings.title")}</h1>
      </div>

      {columns.error ? <p className="error-text" role="alert">{columns.error}</p> : null}
      {actionError ? <p className="error-text" role="alert">{actionError}</p> : null}
      {columns.loading && !columns.data ? (
        <div className="empty" role="status" aria-busy="true">{t("production.loading")}</div>
      ) : columns.data ? (
        <>
          <ProductionStageManager
            columns={stages}
            busy={busy}
            onAdd={(name) => perform(() => LedgerService.SaveProductionColumn({ id: 0, systemKey: "", name, position: stages.length }))}
            onSave={(column, name) => perform(() => LedgerService.SaveProductionColumn({ ...column, name }))}
            onMove={reorderStage}
            onDelete={setPendingDelete}
          />
          {stages.length === 0 ? <div className="empty">{t("production.noStages")}</div> : null}
        </>
      ) : null}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("production.columns.confirmDeleteTitle", { name: pendingDelete?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("production.columns.confirmDeleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy || !pendingDelete}
              onClick={() => void confirmDelete()}
            >
              {t("production.columns.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
