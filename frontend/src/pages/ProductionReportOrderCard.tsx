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
    <Card>
      <CardHeader>
        <CardTitle className="break-words" role="heading" aria-level={2}>{order.title}</CardTitle>
        <CardDescription>{t("production.orderId", { id: order.orderId })}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs font-medium text-muted-foreground">{t("production.reports.createdAt")}</dt>
            <dd className="m-0 break-words text-sm tabular-nums">{dt(order.createdAt, locale)}</dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs font-medium text-muted-foreground">{t("production.reports.completedAt")}</dt>
            <dd className="m-0 break-words text-sm tabular-nums">{dt(order.completedAt, locale)}</dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs font-medium text-muted-foreground">{t("production.reports.orderDuration")}</dt>
            <dd className="m-0 break-words text-sm tabular-nums">{formatDuration(order.orderDurationSeconds, t)}</dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs font-medium text-muted-foreground">{t("production.reports.estimatedPrintHours")}</dt>
            <dd className="m-0 break-words text-sm tabular-nums">{order.estimatedPrintHours.toLocaleString(locale, { maximumFractionDigits: 2 })} h</dd>
          </div>
        </dl>
        <ProductionFilamentEstimates
          filaments={order.filaments}
          locale={locale}
          label={t("production.reports.orderFilaments")}
          emptyLabel={t("production.noFilamentEstimate")}
        />
        <div className="mt-5 grid gap-3">
          <h3 className="text-sm font-semibold">{t("production.reports.ticketCount", { count: tickets.length })}</h3>
          {tickets.length ? tickets.map((ticket) => (
            <section className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4" key={ticket.ticketId}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="break-words text-sm font-semibold">{ticket.quoteName}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{t("production.quoteId", { id: ticket.quoteId })}</p>
                </div>
                <p className="m-0 text-xs text-muted-foreground">
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
                <Table className="mt-3">
                  <TableCaption>{t("production.reports.stageTableCaption", { quote: ticket.quoteName })}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{t("production.reports.stage")}</TableHead>
                      <TableHead scope="col" className="text-right">{t("production.reports.stageDuration")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...ticket.stageDurations]
                      .sort((a, b) => a.position - b.position)
                      .map((stage) => (
                        <TableRow key={stage.columnId}>
                          <TableCell>{stage.columnName}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatDuration(stage.durationSeconds, t)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">{t("production.reports.noStageDurations")}</p>
              )}
            </section>
          )) : (
            <p className="text-sm text-muted-foreground">{t("production.reports.noTickets")}</p>
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
