import type { ProductionFilamentUsage, ProductionReport } from "../../bindings/ledger/internal/domain/models";

export type ProductionReportCsvColumn =
  | "recordType"
  | "periodStart"
  | "periodEnd"
  | "cancelledOrderCount"
  | "orderId"
  | "orderTitle"
  | "orderCreatedAt"
  | "orderCompletedAt"
  | "orderDurationSeconds"
  | "orderEstimatedPrintHours"
  | "orderEstimatedFilaments"
  | "ticketId"
  | "quoteId"
  | "quoteName"
  | "ticketEstimatedPrintHours"
  | "ticketEstimatedFilaments"
  | "stageId"
  | "stageName"
  | "stageDurationSeconds";

export type ProductionReportCsvLabels = {
  headers: Record<ProductionReportCsvColumn, string>;
  rows: { summary: string; order: string; ticket: string; stage: string };
};

type CsvValue = string | number | undefined;
type CsvRow = Partial<Record<ProductionReportCsvColumn, CsvValue>>;

const csvColumns: ProductionReportCsvColumn[] = [
  "recordType",
  "periodStart",
  "periodEnd",
  "cancelledOrderCount",
  "orderId",
  "orderTitle",
  "orderCreatedAt",
  "orderCompletedAt",
  "orderDurationSeconds",
  "orderEstimatedPrintHours",
  "orderEstimatedFilaments",
  "ticketId",
  "quoteId",
  "quoteName",
  "ticketEstimatedPrintHours",
  "ticketEstimatedFilaments",
  "stageId",
  "stageName",
  "stageDurationSeconds",
];

export function buildProductionReportRange(
  startDate: string,
  endDate: string,
): { startAt: string; endAt: string } | null {
  const start = localDate(startDate);
  const end = localDate(endDate);
  if (!start || !end || end < start) return null;

  // The backend range is end-exclusive; advance one local calendar day so the selected end date is included.
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { startAt: start.toISOString(), endAt: endExclusive.toISOString() };
}

export function buildProductionReportCsv(
  report: ProductionReport,
  startDate: string,
  endDate: string,
  labels: ProductionReportCsvLabels,
): string {
  const rows: CsvRow[] = [
    {
      recordType: labels.rows.summary,
      periodStart: startDate,
      periodEnd: endDate,
      cancelledOrderCount: report.cancelledOrderCount,
    },
  ];

  for (const order of report.orders ?? []) {
    const orderFields: CsvRow = {
      orderId: order.orderId,
      orderTitle: order.title,
      orderCreatedAt: order.createdAt,
      orderCompletedAt: order.completedAt,
      orderDurationSeconds: order.orderDurationSeconds,
      orderEstimatedPrintHours: order.estimatedPrintHours,
      orderEstimatedFilaments: formatFilaments(order.filaments),
    };
    const tickets = order.tickets ?? [];
    if (tickets.length === 0) {
      rows.push({ recordType: labels.rows.order, ...orderFields });
      continue;
    }

    for (const ticket of tickets) {
      const ticketFields: CsvRow = {
        ...orderFields,
        ticketId: ticket.ticketId,
        quoteId: ticket.quoteId,
        quoteName: ticket.quoteName,
        ticketEstimatedPrintHours: ticket.estimatedPrintHours,
        ticketEstimatedFilaments: formatFilaments(ticket.filaments),
      };
      const stages = ticket.stageDurations ?? [];
      if (stages.length === 0) {
        rows.push({ recordType: labels.rows.ticket, ...ticketFields });
        continue;
      }
      for (const stage of stages) {
        rows.push({
          recordType: labels.rows.stage,
          ...ticketFields,
          stageId: stage.columnId,
          stageName: stage.columnName,
          stageDurationSeconds: stage.durationSeconds,
        });
      }
    }
  }

  const header = csvColumns.map((column) => labels.headers[column]);
  const csvRows = [header, ...rows.map((row) => csvColumns.map((column) => row[column] ?? ""))];
  return `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function localDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatFilaments(filaments: ProductionFilamentUsage[] | null): string {
  return (filaments ?? [])
    .map((filament) => `${filament.name}: ${filament.weightG} g (${filament.printTimeHours} h)`)
    .join("; ");
}

function csvCell(value: CsvValue): string {
  const raw = value === undefined ? "" : String(value);
  const text = typeof value === "string" && /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
