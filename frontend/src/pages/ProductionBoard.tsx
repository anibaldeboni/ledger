import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { LedgerService } from "../../bindings/ledger";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Field, FieldContent, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { useActionError, useAsync, useSubmission } from "../lib/hooks";
import {
  filterAndSortProductionOrders,
  reorderProductionColumns,
  shouldPromptToCompleteOrderAfterMove,
  type ProductionOrderSort,
} from "../lib/production-board";
import ProductionLane from "./ProductionLane";
import ProductionStageManager from "./ProductionStageManager";

const sortOptions = [
  { value: "createdAt:desc", key: "createdAt", direction: "desc", label: "production.sort.createdNewest" },
  { value: "createdAt:asc", key: "createdAt", direction: "asc", label: "production.sort.createdOldest" },
  { value: "updatedAt:desc", key: "updatedAt", direction: "desc", label: "production.sort.updatedNewest" },
  { value: "updatedAt:asc", key: "updatedAt", direction: "asc", label: "production.sort.updatedOldest" },
  { value: "title:asc", key: "title", direction: "asc", label: "production.sort.titleAscending" },
  { value: "title:desc", key: "title", direction: "desc", label: "production.sort.titleDescending" },
  { value: "ticketCount:desc", key: "ticketCount", direction: "desc", label: "production.sort.ticketsMost" },
  { value: "ticketCount:asc", key: "ticketCount", direction: "asc", label: "production.sort.ticketsFewest" },
] satisfies Array<ProductionOrderSort & { value: string; label: string }>;

type PendingAction =
  | { kind: "deleteOrder"; orderId: number; orderTitle: string }
  | { kind: "completeOrder"; orderId: number; orderTitle: string; automatic: boolean }
  | { kind: "deleteColumn"; columnId: number; columnName: string };

export default function ProductionBoard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const lists = useAsync(
    () => Promise.all([
      LedgerService.ListProductionColumns(),
      LedgerService.ListProductionOrders(),
      LedgerService.ListQuotes(),
    ] as const),
    [],
  );
  const columns = lists.data?.[0] ?? [];
  const orders = lists.data?.[1] ?? [];
  const quotes = lists.data?.[2] ?? [];
  const [newOrderTitle, setNewOrderTitle] = useState("");
  const [sort, setSort] = useState<ProductionOrderSort>({ key: "updatedAt", direction: "desc" });
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [addingTicketOrderId, setAddingTicketOrderId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError, clearActionError] = useActionError();
  const { busy, run } = useSubmission();
  const visibleOrders = filterAndSortProductionOrders(orders, selectedOrderIds, sort, locale);
  const completionColumn = columns.find((column) => column.systemKey === "completed");

  async function perform(action: () => Promise<unknown>, afterSuccess?: () => void): Promise<boolean> {
    clearActionError();
    try {
      const succeeded = await run(async () => {
        await action();
        afterSuccess?.();
        lists.reload();
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

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newOrderTitle.trim();
    if (!title) return;
    await perform(() => LedgerService.CreateProductionOrder(title), () => setNewOrderTitle(""));
  }

  function moveTicket(orderId: number, ticketId: number, columnId: number): Promise<boolean> {
    const order = orders.find((candidate) => candidate.id === orderId);
    const ticket = order?.tickets?.find((candidate) => candidate.id === ticketId);
    if (!order || !ticket || ticket.columnId === columnId) return Promise.resolve(false);

    const askToComplete = completionColumn
      ? shouldPromptToCompleteOrderAfterMove(order, ticketId, columnId, completionColumn.id)
      : false;
    return perform(
      () => LedgerService.MoveProductionTicket(ticketId, columnId),
      askToComplete
        ? () => setPendingAction({
            kind: "completeOrder",
            orderId: order.id,
            orderTitle: order.title,
            automatic: true,
          })
        : undefined,
    );
  }

  function reorderStage(index: number, offset: -1 | 1) {
    const reordered = reorderProductionColumns(columns, index, offset);
    if (reordered === columns) return;
    void perform(() => LedgerService.ReorderProductionColumns(reordered.map((column) => column.id)));
  }

  function toggleOrderFilter(orderId: number, checked: boolean) {
    setSelectedOrderIds((current) =>
      checked ? [...current, orderId] : current.filter((selectedId) => selectedId !== orderId),
    );
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);

    const operation =
      action.kind === "deleteOrder"
        ? () => LedgerService.DeleteProductionOrder(action.orderId)
        : action.kind === "deleteColumn"
          ? () => LedgerService.DeleteProductionColumn(action.columnId)
          : () => LedgerService.CompleteProductionOrder(action.orderId);
    const afterSuccess = action.kind === "deleteOrder"
      ? () => setSelectedOrderIds((current) => current.filter((id) => id !== action.orderId))
      : undefined;
    await perform(operation, afterSuccess);
  }

  const sortValue = `${sort.key}:${sort.direction}`;
  const loading = lists.loading && !lists.data;

  return (
    <div className="production-page">
      <div className="page-head">
        <div>
          <h1>{t("production.title")}</h1>
          <p className="hint">{t("production.description")}</p>
        </div>
      </div>

      {lists.error ? <p className="error-text" role="alert">{lists.error}</p> : null}
      {actionError ? <p className="error-text" role="alert">{actionError}</p> : null}

      <Card className="production-create-card" size="sm">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>{t("production.createOrder")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="production-create-form" onSubmit={createOrder}>
            <FieldGroup className="production-create-fields">
              <Field>
                <FieldLabel htmlFor="production-order-title">{t("production.orderName")}</FieldLabel>
                <Input
                  id="production-order-title"
                  name="production-order-title"
                  autoComplete="off"
                  value={newOrderTitle}
                  onChange={(event) => setNewOrderTitle(event.target.value)}
                  placeholder={t("production.orderNamePlaceholder")}
                  disabled={busy || loading}
                  required
                />
              </Field>
            </FieldGroup>
            <Button type="submit" disabled={busy || loading || !newOrderTitle.trim()}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              {t("production.createOrder")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="production-board-controls">
        <details className="production-order-filter">
          <summary>
            {t("production.filterOrders")}
            <span className="production-filter-count">
              {selectedOrderIds.length
                ? t("production.selectedOrders", { count: selectedOrderIds.length })
                : t("production.allOrders")}
            </span>
          </summary>
          <div className="production-filter-content">
            {selectedOrderIds.length ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setSelectedOrderIds([])}
              >
                {t("production.clearFilter")}
              </Button>
            ) : null}
            <FieldSet className="production-filter-options">
              <FieldLegend className="sr-only">{t("production.filterOrders")}</FieldLegend>
              {orders.length ? (
                <FieldGroup className="production-filter-option-list">
                  {orders.map((order) => {
                    const id = `production-order-filter-${order.id}`;
                    return (
                      <Field className="production-filter-option" orientation="horizontal" key={order.id}>
                        <Checkbox
                          id={id}
                          name="production-order-filter"
                          value={String(order.id)}
                          checked={selectedOrderIds.includes(order.id)}
                          disabled={busy}
                          onCheckedChange={(checked) => toggleOrderFilter(order.id, checked === true)}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={id}>{order.title}</FieldLabel>
                        </FieldContent>
                      </Field>
                    );
                  })}
                </FieldGroup>
              ) : (
                <p className="hint">{t("production.emptyOrders")}</p>
              )}
            </FieldSet>
          </div>
        </details>

        <FieldGroup className="production-sort">
          <Field>
            <FieldLabel htmlFor="production-order-sort">{t("production.sortOrders")}</FieldLabel>
            <select
              id="production-order-sort"
              name="production-order-sort"
              value={sortValue}
              disabled={busy}
              onChange={(event) => {
                const option = sortOptions.find((candidate) => candidate.value === event.target.value);
                if (option) setSort({ key: option.key, direction: option.direction });
              }}
            >
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </select>
          </Field>
        </FieldGroup>
      </div>

      {lists.data ? (
        <ProductionStageManager
          columns={columns}
          busy={busy}
          onAdd={(name) => perform(() => LedgerService.SaveProductionColumn({ id: 0, systemKey: "", name, position: columns.length }))}
          onSave={(column, name) => perform(() => LedgerService.SaveProductionColumn({ ...column, name }))}
          onMove={reorderStage}
          onDelete={(column) => setPendingAction({ kind: "deleteColumn", columnId: column.id, columnName: column.name })}
        />
      ) : null}

      {loading ? (
        <div className="empty" role="status" aria-busy="true">{t("production.loading")}</div>
      ) : lists.data && columns.length === 0 ? (
        <div className="empty">{t("production.noStages")}</div>
      ) : lists.data && orders.length === 0 ? (
        <div className="empty">{t("production.emptyOrders")}</div>
      ) : lists.data && visibleOrders.length === 0 ? (
        <div className="empty">{t("production.noFilteredOrders")}</div>
      ) : lists.data ? (
        <div className="production-board-scroll" role="region" aria-label={t("production.boardLabel")} tabIndex={0}>
          <table className="production-board-table">
            <thead>
              <tr>
                <th scope="col">{t("production.order")}</th>
                {columns.map((column) => (
                  <th scope="col" key={column.id}>
                    <span>{column.name}</span>
                    {column.systemKey === "completed" ? (
                      <span className="production-stage-role">{t("production.columns.completionRole")}</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <ProductionLane
                  key={order.id}
                  order={order}
                  columns={columns}
                  quotes={quotes}
                  locale={locale}
                  busy={busy}
                  addingTicket={addingTicketOrderId === order.id}
                  onToggleAddTicket={(id) => setAddingTicketOrderId((current) => current === id ? null : id)}
                  onAddTicket={(orderId, quoteId) => perform(() => LedgerService.AddProductionTicket(orderId, quoteId))}
                  onMoveTicket={moveTicket}
                  onDeleteOrder={(selected) => setPendingAction({ kind: "deleteOrder", orderId: selected.id, orderTitle: selected.title })}
                  onCompleteOrder={(selected) => setPendingAction({ kind: "completeOrder", orderId: selected.id, orderTitle: selected.title, automatic: false })}
                  onArchiveOrder={(selected) => void perform(
                    () => LedgerService.ArchiveProductionOrder(selected.id),
                    () => setSelectedOrderIds((current) => current.filter((id) => id !== selected.id)),
                  )}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.kind === "deleteOrder"
                ? t("production.confirmDeleteTitle", { title: pendingAction.orderTitle })
                : pendingAction?.kind === "deleteColumn"
                  ? t("production.columns.confirmDeleteTitle", { name: pendingAction.columnName })
                  : t("production.confirmCompleteTitle", { title: pendingAction?.orderTitle ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "deleteOrder"
                ? t("production.confirmDeleteDescription")
                : pendingAction?.kind === "deleteColumn"
                  ? t("production.columns.confirmDeleteDescription")
                  : pendingAction?.automatic
                    ? t("production.confirmCompleteAutomaticDescription", { title: pendingAction.orderTitle })
                    : t("production.confirmCompleteDescription", { title: pendingAction?.orderTitle ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {pendingAction?.kind === "completeOrder" ? t("production.keepOrderOpen") : t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={pendingAction?.kind === "completeOrder" ? "default" : "destructive"}
              disabled={busy || !pendingAction}
              onClick={() => void confirmPendingAction()}
            >
              {pendingAction?.kind === "deleteOrder"
                ? t("production.deleteOrder")
                : pendingAction?.kind === "deleteColumn"
                  ? t("production.columns.delete")
                  : t("production.confirmComplete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
