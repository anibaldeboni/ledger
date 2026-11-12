import { useState, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Check, Plus, Trash2 } from "lucide-react";
import type {
  ProductionColumn,
  ProductionOrder,
  ProductionTicket,
  QuoteSummary,
} from "../../bindings/ledger/internal/domain/models";
import { Button } from "../components/ui/button";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
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
  onMoveTicket: (orderId: number, ticketId: number, columnId: number) => Promise<boolean>;
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
  const [dropTargetColumnId, setDropTargetColumnId] = useState<number | null>(null);
  const tickets = order.tickets ?? [];

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

  function dropTicket(event: DragEvent<HTMLTableCellElement>, columnId: number) {
    event.preventDefault();
    setDropTargetColumnId(null);
    const ticketId = Number(event.dataTransfer.getData("text/plain"));
    if (Number.isSafeInteger(ticketId) && tickets.some((ticket) => ticket.id === ticketId)) {
      void onMoveTicket(order.id, ticketId, columnId);
    }
  }

  return (
    <tr>
      <th scope="row" className="production-order-cell">
        <div className="production-order-title-row">
          <h2 className="production-order-title">{order.title}</h2>
          <span className="production-order-id">#{order.id}</span>
        </div>
        <p className="production-order-meta">
          {t("production.createdAt", { date: formatTimestamp(order.createdAt, locale) })}
        </p>
        <p className="production-order-meta">
          {t("production.updatedAt", { date: formatTimestamp(order.updatedAt, locale) })}
        </p>
        <p className="hint">{t("production.ticketCount", { count: tickets.length })}</p>
        {order.completedAt ? (
          <p className="production-order-status" role="status">{t("production.orderCompleted")}</p>
        ) : null}
        <div className="production-order-actions">
          {!order.completedAt ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={toggleTicketForm}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              {t("production.addTicket")}
            </Button>
          ) : null}
          {order.completedAt ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onArchiveOrder(order)}>
              <Archive data-icon="inline-start" aria-hidden="true" />
              {t("production.archiveOrder")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onCompleteOrder(order)}>
              <Check data-icon="inline-start" aria-hidden="true" />
              {t("production.completeOrder")}
            </Button>
          )}
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => onDeleteOrder(order)}>
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            {t("production.deleteOrder")}
          </Button>
        </div>
        {addingTicket && !order.completedAt ? (
          <form className="production-add-ticket" onSubmit={addTicket}>
            <FieldGroup className="production-add-ticket-fields">
              <Field>
                <FieldLabel htmlFor={`production-quote-${order.id}`}>{t("production.quoteToAdd")}</FieldLabel>
                <select
                  id={`production-quote-${order.id}`}
                  name={`production-quote-${order.id}`}
                  value={quoteId}
                  onChange={(event) => setQuoteId(event.target.value)}
                  disabled={busy}
                  required
                >
                  <option value="">{t("production.chooseQuote")}</option>
                  {quotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>{quote.name}</option>
                  ))}
                </select>
              </Field>
            </FieldGroup>
            <p className="hint">{t("production.ticketPerExecution")}</p>
            <div className="actions">
              <Button type="submit" size="sm" disabled={busy || !quoteId}>
                {t("production.addTicket")}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={toggleTicketForm}>
                {t("common.cancel")}
              </Button>
            </div>
            {quotes.length === 0 ? <p className="hint">{t("production.noQuotes")}</p> : null}
          </form>
        ) : null}
      </th>
      {columns.map((column) => {
        const stageTickets = tickets.filter((ticket) => ticket.columnId === column.id);
        return (
          <td
            key={column.id}
            className={`production-stage-cell${dropTargetColumnId === column.id ? " is-drop-target" : ""}`}
            onDragEnter={() => setDropTargetColumnId(column.id)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDragLeave={() => setDropTargetColumnId(null)}
            onDrop={(event) => dropTicket(event, column.id)}
          >
            {stageTickets.length === 0 ? <p className="production-drop-hint">{t("production.dropHere")}</p> : null}
            <div className="production-ticket-stack">
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

  return (
    <Card
      className="production-ticket-card"
      role="group"
      aria-label={t("production.ticketLabel", { quote: ticket.quoteName })}
      draggable={!busy}
      onDragStart={(event) => {
        event.currentTarget.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(ticket.id));
      }}
      onDragEnd={(event) => event.currentTarget.classList.remove("is-dragging")}
    >
      <CardHeader>
        <CardTitle role="heading" aria-level={3} className="production-ticket-title">{ticket.quoteName}</CardTitle>
        <CardDescription>
          {t("production.quoteId", { id: ticket.quoteId })} · {t("production.estimatedPrintHours", {
            hours: ticket.estimatedPrintHours.toLocaleString(locale, { maximumFractionDigits: 2 }),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="production-ticket-content">
        {ticket.filaments?.length ? (
          <ul className="production-filament-estimates" aria-label={t("production.estimatedFilaments")}>
            {ticket.filaments.map((filament, index) => (
              <li key={`${filament.filamentId}:${index}`}>
                <span>{filament.name}</span>
                <span>{filament.weightG.toLocaleString(locale, { maximumFractionDigits: 1 })} g</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{t("production.noFilamentEstimate")}</p>
        )}
        <FieldGroup className="production-ticket-stage-select">
          <Field>
            <FieldLabel htmlFor={`production-ticket-stage-${ticket.id}`}>
              {t("production.moveTicketLabel", { quote: ticket.quoteName })}
            </FieldLabel>
            <select
              id={`production-ticket-stage-${ticket.id}`}
              name={`production-ticket-stage-${ticket.id}`}
              value={ticket.columnId}
              disabled={busy}
              onChange={(event) => void onMoveTicket(orderId, ticket.id, Number(event.target.value))}
            >
              {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
            </select>
          </Field>
        </FieldGroup>
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
