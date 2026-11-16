import { useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight,
  Archive,
  Check,
  Plus,
  Trash2,
  ShieldPlus,
  RotateCcwClock,
} from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import type {
  ProductionColumn,
  ProductionOrder,
  ProductionTicket,
  QuoteSummary,
} from "../../bindings/ledger/internal/domain/models";
import { brl } from "../lib/format";
import { getProductionOrderTotal } from "../lib/production-board";
import { Button } from "../components/ui/button";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import { NativeSelect } from "../components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

type Props = {
  order: ProductionOrder;
  columns: ProductionColumn[];
  quotes: QuoteSummary[];
  locale: string;
  busy: boolean;
  addingTicket: boolean;
  onToggleAddTicket: (orderId: number) => void;
  onAddTicket: (orderId: number, quoteId: number) => Promise<boolean>;
  onMoveTicket: (
    orderId: number,
    ticketId: number,
    columnId: number,
  ) => Promise<boolean>;
  onDeleteOrder: (order: ProductionOrder) => void;
  onCompleteOrder: (order: ProductionOrder) => void;
  onArchiveOrder: (order: ProductionOrder) => void;
};

export default function ProductionLane({
  order,
  columns,
  quotes,
  locale,
  busy,
  addingTicket,
  onToggleAddTicket,
  onAddTicket,
  onMoveTicket,
  onDeleteOrder,
  onCompleteOrder,
  onArchiveOrder,
}: Props) {
  const { t } = useTranslation();
  const [quoteId, setQuoteId] = useState("");
  const [dropTargetColumnId, setDropTargetColumnId] = useState<number | null>(
    null,
  );
  const tickets = order.tickets ?? [];
  const orderTotal = getProductionOrderTotal(order, quotes, columns);

  async function addTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedQuoteId = Number(quoteId);
    if (selectedQuoteId && (await onAddTicket(order.id, selectedQuoteId))) {
      setQuoteId("");
      onToggleAddTicket(order.id);
    }
  }

  function toggleTicketForm() {
    setQuoteId("");
    onToggleAddTicket(order.id);
  }

  function dropTicket(
    event: DragEvent<HTMLTableCellElement>,
    columnId: number,
  ) {
    event.preventDefault();
    setDropTargetColumnId(null);
    const ticketId = Number(event.dataTransfer.getData("text/plain"));
    if (
      Number.isSafeInteger(ticketId) &&
      tickets.some((ticket) => ticket.id === ticketId)
    ) {
      void onMoveTicket(order.id, ticketId, columnId);
    }
  }

  return (
    <tr>
      <th scope="row" className="sticky left-0 z-10 w-64 min-w-64 border-r border-b border-border bg-card p-3 text-left align-top">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-sm font-semibold leading-5">{order.title}</h2>
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">#{order.id}</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 break-words text-xs text-muted-foreground">
          <span
            title={t("production.createdAt", {
              date: formatTimestamp(order.createdAt, locale),
            })}
            aria-label={t("production.createdAt", {
              date: formatTimestamp(order.createdAt, locale),
            })}
          >
            <ShieldPlus size={16} data-icon="inline-start" aria-hidden="true" />
            {formatTimestamp(order.createdAt, locale)}
          </span>
        </p>
        <p className="mt-2 flex items-center gap-1.5 break-words text-xs text-muted-foreground">
          <span
            title={t("production.updatedAt", {
              date: formatTimestamp(order.updatedAt, locale),
            })}
            aria-label={t("production.updatedAt", {
              date: formatTimestamp(order.updatedAt, locale),
            })}
          >
            <RotateCcwClock
              size={16}
              data-icon="inline-start"
              aria-hidden="true"
            />
            {formatTimestamp(order.updatedAt, locale)}
          </span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("production.ticketCount", { count: tickets.length })}
        </p>
        <dl className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3 text-xs">
          <dt className="text-muted-foreground">{t("production.orderTotal")}</dt>
          <dd className="m-0 whitespace-nowrap text-sm font-semibold tabular-nums">{brl(orderTotal, locale)}</dd>
        </dl>
        {order.completedAt ? (
          <p className="mt-2 text-xs font-medium text-primary" role="status">
            {t("production.orderCompleted")}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!order.completedAt ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={toggleTicketForm}
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              {t("production.addTicket")}
            </Button>
          ) : null}
          {order.completedAt ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={() => onArchiveOrder(order)}
            >
              <Archive data-icon="inline-start" aria-hidden="true" />
              {t("production.archiveOrder")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={() => onCompleteOrder(order)}
            >
              <Check data-icon="inline-start" aria-hidden="true" />
              {t("production.completeOrder")}
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="min-h-11"
            disabled={busy}
            onClick={() => onDeleteOrder(order)}
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            {t("production.deleteOrder")}
          </Button>
        </div>
        {addingTicket && !order.completedAt ? (
          <form className="mt-3 grid gap-3 border-t border-border pt-3" onSubmit={addTicket}>
            <FieldGroup className="w-full">
              <Field>
                <FieldLabel htmlFor={`production-quote-${order.id}`}>
                  {t("production.quoteToAdd")}
                </FieldLabel>
                <NativeSelect
                  id={`production-quote-${order.id}`}
                  name={`production-quote-${order.id}`}
                  value={quoteId}
                  onChange={(event) => setQuoteId(event.target.value)}
                  disabled={busy}
                  required
                >
                  <option value="">{t("production.chooseQuote")}</option>
                  {quotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {quote.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </FieldGroup>
            <p className="text-xs text-muted-foreground">{t("production.ticketPerExecution")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" className="min-h-11" disabled={busy || !quoteId}>
                {t("production.addTicket")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={busy}
                onClick={toggleTicketForm}
              >
                {t("common.cancel")}
              </Button>
            </div>
            {quotes.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("production.noQuotes")}</p>
            ) : null}
          </form>
        ) : null}
      </th>
      {columns.map((column) => {
        const stageTickets = tickets.filter(
          (ticket) => ticket.columnId === column.id,
        );
        return (
          <td
            key={column.id}
            className={`min-h-36 min-w-56 border-r border-b border-border bg-card p-3 align-top transition-colors ${dropTargetColumnId === column.id ? "bg-primary/10 ring-2 ring-inset ring-primary/30" : ""}`}
            onDragEnter={() => setDropTargetColumnId(column.id)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDragLeave={() => setDropTargetColumnId(null)}
            onDrop={(event) => dropTicket(event, column.id)}
          >
            {stageTickets.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
                {t("production.dropHere")}
              </p>
            ) : null}
            <div className="grid gap-2">
              {stageTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  columns={columns}
                  locale={locale}
                  busy={busy}
                  orderId={order.id}
                  onMoveTicket={onMoveTicket}
                />
              ))}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function TicketCard({
  ticket,
  columns,
  locale,
  busy,
  orderId,
  onMoveTicket,
}: {
  ticket: ProductionTicket;
  columns: ProductionColumn[];
  locale: string;
  busy: boolean;
  orderId: number;
  onMoveTicket: Props["onMoveTicket"];
}) {
  const { t } = useTranslation();
  const [movePopoverOpen, setMovePopoverOpen] = useState(false);
  const movableColumns = columns.filter(
    (column) => column.id !== ticket.columnId,
  );

  return (
    <Card
      className="w-full cursor-grab active:cursor-grabbing data-[dragging=true]:opacity-60 data-[dragging=true]:select-none"
      role="group"
      aria-label={t("production.ticketLabel", { quote: ticket.quoteName })}
      draggable={!busy}
      onDragStart={(event) => {
        event.currentTarget.dataset.dragging = "true";
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(ticket.id));
      }}
      onDragEnd={(event) => delete event.currentTarget.dataset.dragging}
    >
      <CardHeader>
        <CardTitle
          role="heading"
          aria-level={3}
          className="break-words"
        >
          {ticket.quoteName}
        </CardTitle>
        <CardDescription>
          {t("production.quoteId", { id: ticket.quoteId })} ·{" "}
          {t("production.estimatedPrintHours", {
            hours: ticket.estimatedPrintHours.toLocaleString(locale, {
              maximumFractionDigits: 2,
            }),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {ticket.filaments?.length ? (
          <ul
            className="grid gap-1 text-xs"
            aria-label={t("production.estimatedFilaments")}
          >
            {ticket.filaments.map((filament, index) => (
              <li key={`${filament.filamentId}:${index}`}>
                <span>{filament.name}</span>
                <span className="min-w-0 break-words">{filament.name}</span>
                <span className="shrink-0 tabular-nums">
                  {filament.weightG.toLocaleString(locale, {
                    maximumFractionDigits: 1,
                  })}{" "}
                  g
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("production.noFilamentEstimate")}</p>
        )}
        <div className="flex justify-end">
          <PopoverPrimitive.Root
            open={movePopoverOpen}
            onOpenChange={setMovePopoverOpen}
          >
            <Button
              asChild
              variant="ghost"
              size="icon-lg"
              className="size-11"
            >
              <PopoverPrimitive.Trigger
                type="button"
                aria-label={t("production.moveTicketLabel", {
                  quote: ticket.quoteName,
                })}
                title={t("production.moveTicketLabel", {
                  quote: ticket.quoteName,
                })}
                disabled={busy || movableColumns.length === 0}
              >
                <ArrowLeftRight aria-hidden="true" />
              </PopoverPrimitive.Trigger>
            </Button>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                className="z-50 grid max-h-60 min-w-48 max-w-[min(20rem,calc(100vw-2rem))] gap-1 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                side="bottom"
                align="end"
                sideOffset={6}
              >
                <PopoverPrimitive.Title className="sr-only">
                  {t("production.moveTicketLabel", { quote: ticket.quoteName })}
                </PopoverPrimitive.Title>
                {movableColumns.map((column) => (
                  <Button
                    key={column.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 w-full justify-start whitespace-normal"
                    disabled={busy}
                    onClick={async () => {
                      if (await onMoveTicket(orderId, ticket.id, column.id))
                        setMovePopoverOpen(false);
                    }}
                  >
                    {column.name}
                  </Button>
                ))}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}
