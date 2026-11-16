import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Download } from "lucide-react";
import { LedgerService } from "../../bindings/ledger";
import type { ProductionReport } from "../../bindings/ledger/internal/domain/models";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { useActionError, useSubmission } from "../lib/hooks";
import { buildProductionReportCsv, buildProductionReportRange, type ProductionReportCsvLabels } from "../lib/production-report";
import ProductionReportOrderCard from "./ProductionReportOrderCard";

export default function ProductionReports() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [report, setReport] = useState<ProductionReport | null>(null);
  const [actionError, setActionError, clearActionError] = useActionError();
  const { busy, run } = useSubmission();

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearActionError();
    setPeriodError(null);
    setReport(null);
    const range = buildProductionReportRange(startDate, endDate);
    if (!range) {
      setPeriodError(t("production.reports.invalidPeriod"));
      return;
    }

    try {
      const result = await run(() => LedgerService.GenerateProductionReport(range.startAt, range.endAt));
      if (result) setReport(result);
    } catch (error) {
      setActionError(error);
    }
  }

  function exportCsv() {
    if (!report) return;
    const csv = buildProductionReportCsv(report, startDate, endDate, csvLabels(t));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `production-report-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("production.reports.title")}
        description={t("production.reports.description")}
      />

      <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" onSubmit={generate}>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="production-report-start">{t("production.reports.startDate")}</FieldLabel>
            <Input
              id="production-report-start"
              name="production-report-start"
              type="date"
              autoComplete="off"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setReport(null);
                setPeriodError(null);
                clearActionError();
              }}
              className="h-11"
              disabled={busy}
              required
            />
          </Field>
          <Field data-invalid={Boolean(periodError)}>
            <FieldLabel htmlFor="production-report-end">{t("production.reports.endDate")}</FieldLabel>
            <Input
              id="production-report-end"
              name="production-report-end"
              type="date"
              autoComplete="off"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setReport(null);
                setPeriodError(null);
                clearActionError();
              }}
              className="h-11"
              disabled={busy}
              aria-invalid={Boolean(periodError)}
              required
            />
            <FieldDescription>{t("production.reports.endDateInclusive")}</FieldDescription>
            {periodError ? <FieldError>{periodError}</FieldError> : null}
          </Field>
        </FieldGroup>
        <Button type="submit" size="lg" className="min-h-11" disabled={busy || !startDate || !endDate}>
          {busy ? t("production.reports.generating") : t("production.reports.generate")}
        </Button>
      </form>

      {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}
      {report ? (
        <>
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {t("production.reports.selectedPeriod", { start: startDate, end: endDate })}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card size="sm">
              <CardHeader>
                <CardDescription>{t("production.reports.completedOrderCount")}</CardDescription>
                <CardTitle>{report.orders?.length ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>{t("production.reports.cancelledOrderCount")}</CardDescription>
                <CardTitle>{report.cancelledOrderCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("production.reports.cancelledOrderExplanation")}</p>
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={exportCsv}>
              <Download data-icon="inline-start" aria-hidden="true" />
              {t("production.reports.exportCsv")}
            </Button>
          </div>
          {report.orders?.length ? (
            <div className="grid gap-4">
              {report.orders.map((order) => (
                <ProductionReportOrderCard key={order.orderId} order={order} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground" role="status">
              {t("production.reports.noCompletedOrders")}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function csvLabels(t: TFunction): ProductionReportCsvLabels {
  return {
    headers: {
      recordType: t("production.reports.csv.headers.recordType"),
      periodStart: t("production.reports.csv.headers.periodStart"),
      periodEnd: t("production.reports.csv.headers.periodEnd"),
      cancelledOrderCount: t("production.reports.csv.headers.cancelledOrderCount"),
      orderId: t("production.reports.csv.headers.orderId"),
      orderTitle: t("production.reports.csv.headers.orderTitle"),
      orderCreatedAt: t("production.reports.csv.headers.orderCreatedAt"),
      orderCompletedAt: t("production.reports.csv.headers.orderCompletedAt"),
      orderDurationSeconds: t("production.reports.csv.headers.orderDurationSeconds"),
      orderEstimatedPrintHours: t("production.reports.csv.headers.orderEstimatedPrintHours"),
      orderEstimatedFilaments: t("production.reports.csv.headers.orderEstimatedFilaments"),
      ticketId: t("production.reports.csv.headers.ticketId"),
      quoteId: t("production.reports.csv.headers.quoteId"),
      quoteName: t("production.reports.csv.headers.quoteName"),
      ticketEstimatedPrintHours: t("production.reports.csv.headers.ticketEstimatedPrintHours"),
      ticketEstimatedFilaments: t("production.reports.csv.headers.ticketEstimatedFilaments"),
      stageId: t("production.reports.csv.headers.stageId"),
      stageName: t("production.reports.csv.headers.stageName"),
      stageDurationSeconds: t("production.reports.csv.headers.stageDurationSeconds"),
    },
    rows: {
      summary: t("production.reports.csv.rows.summary"),
      order: t("production.reports.csv.rows.order"),
      ticket: t("production.reports.csv.rows.ticket"),
      stage: t("production.reports.csv.rows.stage"),
    },
  };
}
