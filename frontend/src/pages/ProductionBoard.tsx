import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus } from "lucide-react";
import { LedgerService } from "../../bindings/ledger";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { useActionError, useAsync, useSubmission } from "../lib/hooks";
import {
  filterAndSortProductionOrders,
  shouldPromptToCompleteOrderAfterMove,
  type ProductionOrderSort,
} from "../lib/production-board";
import ProductionLane from "./ProductionLane";

const sortOptions = [
  {
    value: "createdAt:desc",
    key: "createdAt",
    direction: "desc",
    label: "production.sort.createdNewest",
  },
  {
    value: "createdAt:asc",
    key: "createdAt",
    direction: "asc",
    label: "production.sort.createdOldest",
  },
  {
    value: "updatedAt:desc",
    key: "updatedAt",
    direction: "desc",
    label: "production.sort.updatedNewest",
  },
  {
    value: "updatedAt:asc",
    key: "updatedAt",
    direction: "asc",
    label: "production.sort.updatedOldest",
  },
  {
    value: "title:asc",
    key: "title",
    direction: "asc",
    label: "production.sort.titleAscending",
  },
  {
    value: "title:desc",
    key: "title",
    direction: "desc",
    label: "production.sort.titleDescending",
  },
  {
    value: "ticketCount:desc",
    key: "ticketCount",
    direction: "desc",
    label: "production.sort.ticketsMost",
  },
  {
    value: "ticketCount:asc",
    key: "ticketCount",
    direction: "asc",
    label: "production.sort.ticketsFewest",
  },
] satisfies Array<ProductionOrderSort & { value: string; label: string }>;

type PendingAction =
  | { kind: "deleteOrder"; orderId: number; orderTitle: string }
  | {
      kind: "completeOrder";
      orderId: number;
      orderTitle: string;
      automatic: boolean;
    };

export default function ProductionBoard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const lists = useAsync(
    () =>
      Promise.all([
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
  const [sort, setSort] = useState<ProductionOrderSort>({
    key: "updatedAt",
    direction: "desc",
  });
  const [search, setSearch] = useState("");
  const [addingTicketOrderId, setAddingTicketOrderId] = useState<number | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [actionError, setActionError, clearActionError] = useActionError();
  const { busy, run } = useSubmission();
  const visibleOrders = filterAndSortProductionOrders(
    orders,
    search,
    sort,
    locale,
  );
  const completionColumn = columns.find(
    (column) => column.systemKey === "completed",
  );

  async function perform(
    action: () => Promise<unknown>,
    afterSuccess?: () => void,
  ): Promise<boolean> {
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
      setActionError(error);
      return false;
    }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newOrderTitle.trim();
    if (!title) return;
    const form = event.currentTarget;
    await perform(
      () => LedgerService.CreateProductionOrder(title),
      () => {
        setNewOrderTitle("");
        const popover = form.closest<HTMLDetailsElement>("details");
        if (popover) popover.open = false;
      },
    );
  }

  function moveTicket(
    orderId: number,
    ticketId: number,
    columnId: number,
  ): Promise<boolean> {
    const order = orders.find((candidate) => candidate.id === orderId);
    const ticket = order?.tickets?.find(
      (candidate) => candidate.id === ticketId,
    );
    if (!order || !ticket || ticket.columnId === columnId)
      return Promise.resolve(false);

    const askToComplete = completionColumn
      ? shouldPromptToCompleteOrderAfterMove(
          order,
          ticketId,
          columnId,
          completionColumn.id,
        )
      : false;
    return perform(
      () => LedgerService.MoveProductionTicket(ticketId, columnId),
      askToComplete
        ? () =>
            setPendingAction({
              kind: "completeOrder",
              orderId: order.id,
              orderTitle: order.title,
              automatic: true,
            })
        : undefined,
    );
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);

    const operation =
      action.kind === "deleteOrder"
        ? () => LedgerService.DeleteProductionOrder(action.orderId)
        : () => LedgerService.CompleteProductionOrder(action.orderId);
    await perform(operation);
  }

  const sortValue = `${sort.key}:${sort.direction}`;
  const loading = lists.loading && !lists.data;

  return (
    <div className="production-page production-board-page">
      <div className="page-head">
        <div>
          <h1>{t("production.title")}</h1>
          <p className="hint">{t("production.description")}</p>
        </div>
      </div>

      {lists.error ? (
        <p className="error-text" role="alert">
          {lists.error}
        </p>
      ) : null}
      {actionError ? (
        <p className="error-text" role="alert">
          {actionError}
        </p>
      ) : null}

      <details
        className="production-create"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            event.currentTarget
              .querySelector<HTMLInputElement>("input")
              ?.focus();
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }}
      >
        <Button asChild>
          <summary aria-controls="production-create-form">
            <Plus data-icon="inline-start" aria-hidden="true" />
            {t("production.createOrder")}
          </summary>
        </Button>
        <form
          id="production-create-form"
          className="production-create-form"
          onSubmit={createOrder}
        >
          <FieldGroup className="production-create-fields">
            <Field>
              <FieldLabel htmlFor="production-order-title">
                {t("production.orderName")}
              </FieldLabel>
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
          <div className="production-board-controls">
            <Button
              className="btn-primary btn-icon"
              type="submit"
              disabled={busy || loading || !newOrderTitle.trim()}
            >
              <Check data-icon="inline-start" aria-hidden="true" />
            </Button>
          </div>
        </form>
      </details>

      <div className="production-board-controls">
        <FieldGroup className="production-search">
          <Field>
            <FieldLabel htmlFor="production-order-search">
              {t("production.searchLabel")}
            </FieldLabel>
            <Input
              id="production-order-search"
              name="production-order-search"
              type="search"
              className="search-input"
              autoComplete="off"
              placeholder={t("production.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={busy}
            />
          </Field>
        </FieldGroup>

        <FieldGroup className="production-sort">
          <Field>
            <FieldLabel htmlFor="production-order-sort">
              {t("production.sortOrders")}
            </FieldLabel>
            <select
              id="production-order-sort"
              name="production-order-sort"
              value={sortValue}
              disabled={busy}
              onChange={(event) => {
                const option = sortOptions.find(
                  (candidate) => candidate.value === event.target.value,
                );
                if (option)
                  setSort({ key: option.key, direction: option.direction });
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </Field>
        </FieldGroup>
      </div>

      {loading ? (
        <div className="empty" role="status" aria-busy="true">
          {t("production.loading")}
        </div>
      ) : lists.data && columns.length === 0 ? (
        <div className="empty">{t("production.noStages")}</div>
      ) : lists.data && orders.length === 0 ? (
        <div className="empty">{t("production.emptyOrders")}</div>
      ) : lists.data && visibleOrders.length === 0 ? (
        <div className="empty">{t("production.noSearchResults")}</div>
      ) : lists.data ? (
        <div
          className="production-board-scroll"
          role="region"
          aria-label={t("production.boardLabel")}
          tabIndex={0}
        >
          <table className="production-board-table">
            <thead>
              <tr>
                <th scope="col">{t("production.order")}</th>
                {columns.map((column) => (
                  <th scope="col" key={column.id}>
                    <span>{column.name}</span>
                    {column.systemKey === "completed" ? (
                      <span className="production-stage-role">
                        {t("production.columns.completionRole")}
                      </span>
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
                  onToggleAddTicket={(id) =>
                    setAddingTicketOrderId((current) =>
                      current === id ? null : id,
                    )
                  }
                  onAddTicket={(orderId, quoteId) =>
                    perform(() =>
                      LedgerService.AddProductionTicket(orderId, quoteId),
                    )
                  }
                  onMoveTicket={moveTicket}
                  onDeleteOrder={(selected) =>
                    setPendingAction({
                      kind: "deleteOrder",
                      orderId: selected.id,
                      orderTitle: selected.title,
                    })
                  }
                  onCompleteOrder={(selected) =>
                    setPendingAction({
                      kind: "completeOrder",
                      orderId: selected.id,
                      orderTitle: selected.title,
                      automatic: false,
                    })
                  }
                  onArchiveOrder={(selected) =>
                    void perform(() =>
                      LedgerService.ArchiveProductionOrder(selected.id),
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.kind === "deleteOrder"
                ? t("production.confirmDeleteTitle", {
                    title: pendingAction.orderTitle,
                  })
                : t("production.confirmCompleteTitle", {
                    title: pendingAction?.orderTitle ?? "",
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "deleteOrder"
                ? t("production.confirmDeleteDescription")
                : pendingAction?.automatic
                  ? t("production.confirmCompleteAutomaticDescription", {
                      title: pendingAction.orderTitle,
                    })
                  : t("production.confirmCompleteDescription", {
                      title: pendingAction?.orderTitle ?? "",
                    })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {pendingAction?.kind === "completeOrder"
                ? t("production.keepOrderOpen")
                : t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={
                pendingAction?.kind === "completeOrder"
                  ? "default"
                  : "destructive"
              }
              disabled={busy || !pendingAction}
              onClick={() => void confirmPendingAction()}
            >
              {pendingAction?.kind === "deleteOrder"
                ? t("production.deleteOrder")
                : t("production.confirmComplete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
