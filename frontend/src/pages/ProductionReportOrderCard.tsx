import { useTranslation } from "react-i18next";
import type { ProductionOrderReport } from "../../bindings/ledger/internal/domain/models";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { dt } from "../lib/format";
import ProductionFilamentEstimates from "./ProductionFilamentEstimates";

export default function ProductionReportOrderCard({ order, locale }: { order: ProductionOrderReport; locale: string }) {
  const { t } = useTranslation();
  const tickets = order.tickets ?? [];

  return (
    <Card className="production-report-order">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>{order.title}</CardTitle>
        <CardDescription>{t("production.orderId", { id: order.orderId })}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="production-report-metrics">
          <div>
            <dt>{t("production.reports.createdAt")}</dt>
            <dd>{dt(order.createdAt, locale)}</dd>
          </div>
          <div>
            <dt>{t("production.reports.completedAt")}</dt>
            <dd>{dt(order.completedAt, locale)}</dd>
          </div>
          <div>
            <dt>{t("production.reports.orderDuration")}</dt>
            <dd>{formatDuration(order.orderDurationSeconds, t)}</dd>
          </div>
          <div>
            <dt>{t("production.reports.estimatedPrintHours")}</dt>
            <dd>{order.estimatedPrintHours.toLocaleString(locale, { maximumFractionDigits: 2 })} h</dd>
          </div>
        </dl>
        <ProductionFilamentEstimates
          filaments={order.filaments}
          locale={locale}
          label={t("production.reports.orderFilaments")}
          emptyLabel={t("production.noFilamentEstimate")}
        />
        <div className="production-report-tickets">
          <p className="production-section-label">{t("production.reports.ticketCount", { count: tickets.length })}</p>
          {tickets.length ? tickets.map((ticket) => (
            <section className="production-report-ticket" key={ticket.ticketId}>
              <div className="production-report-ticket-heading">
                <div>
                  <h3>{ticket.quoteName}</h3>
                  <p className="production-order-meta">{t("production.quoteId", { id: ticket.quoteId })}</p>
                </div>
                <p className="production-order-meta">
                  {t("production.reports.ticketEstimatedPrintHours", {
                    hours: ticket.estimatedPrintHours.toLocaleString(locale, { maximumFractionDigits: 2 }),
                  })}
                </p>
              </div>
              <ProductionFilamentEstimates
                filaments={ticket.filaments}
                locale={locale}
                label={t("production.reports.ticketFilaments")}
                emptyLabel={t("production.noFilamentEstimate")}
              />
              {ticket.stageDurations?.length ? (
                <Table className="production-report-stage-table">
                  <TableCaption>{t("production.reports.stageTableCaption", { quote: ticket.quoteName })}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{t("production.reports.stage")}</TableHead>
                      <TableHead scope="col" className="money">{t("production.reports.stageDuration")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...ticket.stageDurations]
                      .sort((a, b) => a.position - b.position)
                      .map((stage) => (
                        <TableRow key={stage.columnId}>
                          <TableCell>{stage.columnName}</TableCell>
                          <TableCell className="money">{formatDuration(stage.durationSeconds, t)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="hint">{t("production.reports.noStageDurations")}</p>
              )}
            </section>
          )) : (
            <p className="hint">{t("production.reports.noTickets")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number, t: ReturnType<typeof useTranslation>["t"]): string {
  let remaining = Math.max(0, Math.floor(seconds));
  const days = Math.floor(remaining / 86400);
  remaining %= 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const secondsLeft = remaining % 60;
  const parts: string[] = [];
  if (days) parts.push(t("production.reports.duration.days", { count: days }));
  if (hours) parts.push(t("production.reports.duration.hours", { count: hours }));
  if (minutes) parts.push(t("production.reports.duration.minutes", { count: minutes }));
  if (secondsLeft || parts.length === 0) parts.push(t("production.reports.duration.seconds", { count: secondsLeft }));
  return parts.join(" ");
}
