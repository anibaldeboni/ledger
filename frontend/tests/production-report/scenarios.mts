import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ProductionReport } from "../../bindings/ledger/internal/domain/models.ts";
import {
  buildProductionReportCsv,
  buildProductionReportRange,
  type ProductionReportCsvLabels,
} from "../../src/lib/production-report.ts";

const labels: ProductionReportCsvLabels = {
  headers: {
    recordType: "Record type",
    periodStart: "Period start",
    periodEnd: "Period end",
    cancelledOrderCount: "Cancelled orders",
    orderId: "Order ID",
    orderTitle: "Order title",
    orderCreatedAt: "Created at",
    orderCompletedAt: "Completed at",
    orderDurationSeconds: "Order duration (seconds)",
    orderEstimatedPrintHours: "Order estimated print hours",
    ticketId: "Ticket ID",
    quoteId: "Quote ID",
    quoteName: "Quote name",
    ticketEstimatedPrintHours: "Ticket estimated print hours",
    stageId: "Stage ID",
    stageName: "Stage name",
    stageDurationSeconds: "Stage duration (seconds)",
    orderEstimatedFilaments: "Order estimated filament usage",
    ticketEstimatedFilaments: "Ticket estimated filament usage",
  },
  rows: { summary: "Summary", order: "Order", ticket: "Ticket", stage: "Stage" },
};

const report: ProductionReport = {
  startAt: "2026-04-30T07:00:00Z",
  endAt: "2026-05-02T07:00:00Z",
  cancelledOrderCount: 2,
  orders: [
    {
      orderId: 7,
      title: 'Pedido, "A"',
      createdAt: "2026-04-20T10:00:00Z",
      completedAt: "2026-04-30T12:00:00Z",
      orderDurationSeconds: 90061,
      estimatedPrintHours: 2.25,
      filaments: [{ filamentId: 1, name: 'PLA "White"', printTimeHours: 2.25, weightG: 50.5 }],
      tickets: [
        {
          ticketId: 70,
          quoteId: 700,
          quoteName: 'Bracket, "A"',
          estimatedPrintHours: 2.25,
          filaments: [{ filamentId: 1, name: 'PLA "White"', printTimeHours: 2.25, weightG: 50.5 }],
          stageDurations: [
            { columnId: 1, columnName: "To-do", position: 0, durationSeconds: 3600 },
            { columnId: 4, columnName: "Completed", position: 3, durationSeconds: 7200 },
          ],
        },
      ],
    },
    {
      orderId: 8,
      title: "=1+1",
      createdAt: "2026-04-30T08:00:00Z",
      completedAt: "2026-04-30T08:00:15Z",
      orderDurationSeconds: 15,
      estimatedPrintHours: 0,
      filaments: [],
      tickets: [],
    },
  ],
};

const sameDay = buildProductionReportRange("2026-12-31", "2026-12-31");
assert.ok(sameDay, "a one-day report range is valid");
assert.equal(sameDay.startAt, new Date(2026, 11, 31).toISOString());
assert.equal(sameDay.endAt, new Date(2027, 0, 1).toISOString(), "the selected end date is included through local midnight next day");
assert.equal(buildProductionReportRange("2026-05-02", "2026-05-01"), null, "end date before start date is invalid");
assert.equal(buildProductionReportRange("", "2026-05-01"), null, "missing start date is invalid");
assert.equal(buildProductionReportRange("2026-02-30", "2026-03-01"), null, "impossible calendar dates are invalid");

const csv = buildProductionReportCsv(report, "2026-04-30", "2026-05-01", labels);
assert.ok(csv.startsWith("\uFEFF"), "CSV is UTF-8 BOM-prefixed for spreadsheet compatibility");
const rows = csv.slice(1).split("\r\n");
assert.equal(rows.length, 5, "CSV contains one header, one summary, two stage rows, and an empty-ticket order row");
assert.ok(rows[1].startsWith("Summary,2026-04-30,2026-05-01,2,"), "summary includes inclusive dates and cancelled-order count");
assert.ok(csv.includes('"Pedido, ""A"""'), "CSV escapes quotes and commas in order titles");
assert.ok(csv.includes('"Bracket, ""A"""'), "CSV escapes quotes and commas in quote names");
assert.ok(csv.includes('"PLA ""White"": 50.5 g (2.25 h)"'), "CSV marks per-ticket filament values as estimates");
assert.ok(csv.includes("Order estimated filament usage"), "CSV includes order-level filament estimates");
assert.ok(csv.includes("Ticket estimated filament usage"), "CSV includes per-ticket filament estimates");
assert.ok(csv.includes("Completed"), "CSV includes stage-duration rows");
assert.ok(csv.includes("90061"), "CSV includes order duration in seconds");
assert.ok(csv.includes("2.25"), "CSV includes estimated print hours");
const emptyOrder = report.orders?.[1];
assert.ok(emptyOrder);
for (const formula of ["=1+1", "+1+1", "-1+1", "@SUM(1,1)", " \t=1+1", "\x01=1+1", "\x1b=1+1", "\x7f=1+1", "\x01\x02 \t=1+1"]) {
  const formulaReport = { ...report, orders: [{ ...emptyOrder, title: formula }] };
  const formulaCsv = buildProductionReportCsv(formulaReport, "2026-04-30", "2026-05-01", labels);
  assert.ok(formulaCsv.includes(`'${formula}`), `CSV text cells must neutralize spreadsheet formula prefix ${formula}`);
}
const multilineReport = { ...report, orders: [{ ...emptyOrder, title: 'Name, "quoted"\ncontinued' }] };
const multilineCsv = buildProductionReportCsv(multilineReport, "2026-04-30", "2026-05-01", labels);
assert.ok(multilineCsv.includes('"Name, ""quoted""\ncontinued"'), "CSV preserves line breaks and escapes quotes in one field");

const locales = ["pt-BR", "en", "es"] as const;
const catalogs = Object.fromEntries(locales.map((locale) => [
  locale,
  JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${locale}/translation.json`, import.meta.url), "utf8")),
])) as Record<(typeof locales)[number], Record<string, unknown>>;
const productionScreens = [
  "../../src/App.tsx",
  "../../src/pages/ProductionBoard.tsx",
  "../../src/pages/ProductionLane.tsx",
  "../../src/pages/ProductionStageManager.tsx",
  "../../src/pages/ProductionWorkspace.tsx",
  "../../src/pages/ProductionArchive.tsx",
  "../../src/pages/ProductionReports.tsx",
  "../../src/pages/ProductionReportOrderCard.tsx",
  "../../src/pages/ProductionFilamentEstimates.tsx",
];
function hasTranslation(catalog: unknown, key: string): boolean {
  let value = catalog;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null || !(part in value)) return false;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string";
}
for (const locale of locales) {
  for (const path of productionScreens) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const keys = new Set([...source.matchAll(/"(production(?:\.[\w]+)+|nav\.production)"/g)].map((match) => match[1]));
    for (const key of keys) assert.ok(hasTranslation(catalogs[locale], key), `${locale} is missing ${key}`);
  }
}

console.log("Production report range and CSV probes passed");
