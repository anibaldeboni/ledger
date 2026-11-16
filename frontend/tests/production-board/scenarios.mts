import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { ProductionOrder } from "../../bindings/ledger/internal/domain/models.ts";
import {
  getProductionOrderTotal,
  filterAndSortProductionOrders,
  reorderProductionColumns,
  shouldPromptToCompleteOrderAfterMove,
} from "../../src/lib/production-board.ts";

function order(
  id: number,
  title: string,
  createdAt: string,
  updatedAt: string,
  ticketColumns: number[] = [],
  completedAt = "",
): ProductionOrder {
  return {
    id,
    title,
    createdAt,
    updatedAt,
    completedAt,
    archivedAt: "",
    tickets: ticketColumns.map((columnId, index) => ({
      id: id * 100 + index,
      orderId: id,
      quoteId: index + 1,
      quoteName: `Quote ${index + 1}`,
      columnId,
      estimatedPrintHours: 1,
      filaments: [],
      createdAt,
      updatedAt,
    })),
  };
}

const orders = [
  order(1, "Zulu", "2026-01-01T00:00:00Z", "2026-01-10T00:00:00Z", [4]),
  order(2, "Alpha", "2026-01-03T00:00:00Z", "2026-01-05T00:00:00Z", [1, 2]),
  order(3, "Bravo", "2026-01-02T00:00:00Z", "2026-01-08T00:00:00Z"),
];

const currentQuotes = [
  { id: 1, name: "First", finalPrice: 120.5, marginPercent: 0, updatedAt: "" },
  { id: 2, name: "Second", finalPrice: 45.25, marginPercent: 0, updatedAt: "" },
  { id: 3, name: "Third", finalPrice: 15.75, marginPercent: 0, updatedAt: "" },
  { id: 4, name: "Unlinked", finalPrice: 500, marginPercent: 0, updatedAt: "" },
];
const orderTotalColumns = [
  { id: 10, systemKey: "todo", name: "To-do", position: 0 },
  { id: 20, systemKey: "cancelled", name: "Cancelado (renamed)", position: 1 },
  { id: 30, systemKey: "completed", name: "Done", position: 2 },
];
const orderWithQuotes = order(4, "Order total", "", "", [10, 20, 30]);
assert.equal(
  getProductionOrderTotal(orderWithQuotes, currentQuotes, orderTotalColumns),
  136.25,
  "an order total excludes cancelled-stage tickets and counts only linked quotes",
);
const updatedQuotes = currentQuotes.map((quote) =>
  quote.id === 1 ? { ...quote, finalPrice: 130.5 } : quote,
);
assert.equal(
  getProductionOrderTotal(orderWithQuotes, updatedQuotes, orderTotalColumns),
  146.25,
  "an order total reflects updated active quote prices",
);
assert.equal(
  getProductionOrderTotal(
    order(5, "Empty order", "", ""),
    currentQuotes,
    orderTotalColumns,
  ),
  0,
  "an order without linked quotes has a zero total",
);

assert.deepEqual(
  filterAndSortProductionOrders(orders, "", { key: "createdAt", direction: "desc" }, "en").map((item) => item.id),
  [2, 3, 1],
  "an empty name search keeps every order and sorts by creation date",
);
assert.deepEqual(
  filterAndSortProductionOrders(orders, "Al", { key: "updatedAt", direction: "desc" }, "en").map((item) => item.id),
  [1, 3, 2],
  "searches shorter than three characters keep every order",
);
assert.deepEqual(
  filterAndSortProductionOrders(orders, "aLpHa", { key: "updatedAt", direction: "desc" }, "en").map((item) => item.title),
  ["Alpha"],
  "order-name search is case-insensitive",
);
assert.deepEqual(
  filterAndSortProductionOrders(orders, "", { key: "title", direction: "asc" }, "en").map((item) => item.title),
  ["Alpha", "Bravo", "Zulu"],
  "orders can be sorted by title",
);
assert.deepEqual(
  filterAndSortProductionOrders(orders, "", { key: "ticketCount", direction: "desc" }, "en").map((item) => item.id),
  [2, 1, 3],
  "orders can be sorted by ticket count without changing the source list",
);
assert.deepEqual(orders.map((item) => item.id), [1, 2, 3]);
assert.deepEqual(filterAndSortProductionOrders([], "", { key: "createdAt", direction: "asc" }, "en"), []);
assert.deepEqual(
  filterAndSortProductionOrders(orders, "missing", { key: "createdAt", direction: "asc" }, "en"),
  [],
  "a name search with no matches shows no orders",
);
assert.deepEqual(
  filterAndSortProductionOrders(
    [order(4, "Café", "2026-01-04T00:00:00Z", "2026-01-04T00:00:00Z")],
    "cafe",
    { key: "title", direction: "asc" },
    "en",
  ).map((item) => item.title),
  ["Café"],
  "order-name search ignores accents",
);

const invalidDates = [
  order(2, "Beta", "not-a-date", "also-bad"),
  order(1, "Alpha", "not-a-date", "also-bad"),
];
assert.deepEqual(
  filterAndSortProductionOrders(invalidDates, "", { key: "createdAt", direction: "desc" }, "en").map((item) => item.id),
  [1, 2],
  "invalid dates fall back to a deterministic ID order",
);
const missingTickets = { ...order(4, "No tickets", "", ""), tickets: null };
assert.deepEqual(
  filterAndSortProductionOrders([missingTickets, order(5, "Has tickets", "", "", [1])], "", { key: "ticketCount", direction: "desc" }, "en").map((item) => item.id),
  [5, 4],
  "a missing ticket list counts as zero tickets",
);
const caseInsensitiveTitles = [
  order(1, "beta", "", ""),
  order(2, "Alpha", "", ""),
  order(3, "alpha", "", ""),
];
assert.deepEqual(
  filterAndSortProductionOrders(caseInsensitiveTitles, "", { key: "title", direction: "asc" }, "en").map((item) => item.id),
  [2, 3, 1],
  "title sorting follows the active locale without case-sensitive ordering",
);

const columns = [
  { id: 10, systemKey: "todo", name: "To-do", position: 0 },
  { id: 20, systemKey: "", name: "Custom", position: 1 },
  { id: 30, systemKey: "completed", name: "Done", position: 2 },
];
assert.deepEqual(
  reorderProductionColumns(columns, 1, -1).map((column) => column.id),
  [20, 10, 30],
  "a stage can be moved without changing its identity or completion role",
);
assert.deepEqual(reorderProductionColumns(columns, 0, -1).map((column) => column.id), [10, 20, 30]);
assert.equal(reorderProductionColumns(columns, -1, -1), columns);
assert.equal(reorderProductionColumns(columns, columns.length, 1), columns);
assert.deepEqual(reorderProductionColumns([], 0, 1), []);
assert.deepEqual(columns.map((column) => column.id), [10, 20, 30]);

const almostComplete = order(4, "Finishing", "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z", [4, 1]);
assert.equal(
  shouldPromptToCompleteOrderAfterMove(almostComplete, 401, 4, 4),
  true,
  "moving the last ticket into the designated completion stage asks before recording completion",
);
assert.equal(
  shouldPromptToCompleteOrderAfterMove(almostComplete, 401, 2, 4),
  false,
  "an order is not complete while a ticket remains outside the completion stage",
);
assert.equal(
  shouldPromptToCompleteOrderAfterMove(order(5, "Empty", "", ""), 501, 4, 4),
  false,
  "an empty order does not become complete automatically",
);
assert.equal(
  shouldPromptToCompleteOrderAfterMove(
    order(6, "Manually completed", "", "", [4, 1], "2026-01-02T00:00:00Z"),
    601,
    4,
    4,
  ),
  true,
  "moving the last ticket of a manually completed order into the completion stage asks again after reopening it",
);
assert.equal(
  shouldPromptToCompleteOrderAfterMove(
    { ...order(7, "Archived", "", "", [1]), archivedAt: "2026-01-02T00:00:00Z" },
    700,
    4,
    4,
  ),
  false,
  "archived orders never prompt for completion",
);
assert.equal(
  shouldPromptToCompleteOrderAfterMove(order(8, "Foreign ticket", "", "", [1]), 999, 4, 4),
  false,
  "a ticket outside the order never triggers its completion prompt",
);
assert.equal(
  shouldPromptToCompleteOrderAfterMove(order(9, "Still in progress", "", "", [1, 2]), 900, 4, 4),
  false,
  "every other ticket must already be in the completion stage",
);

const workspaceText = await readFile(new URL("../../src/pages/ProductionWorkspace.tsx", import.meta.url), "utf8");
const appText = await readFile(new URL("../../src/App.tsx", import.meta.url), "utf8");
const boardText = await readFile(new URL("../../src/pages/ProductionBoard.tsx", import.meta.url), "utf8");
const laneText = await readFile(new URL("../../src/pages/ProductionLane.tsx", import.meta.url), "utf8");
const settingsText = await readFile(new URL("../../src/pages/ProductionSettings.tsx", import.meta.url), "utf8");
const stageManagerText = await readFile(new URL("../../src/pages/ProductionStageManager.tsx", import.meta.url), "utf8");
assert.match(laneText, /getProductionOrderTotal\(order,\s*quotes,\s*columns\)/, "each production lane derives its total from current quotes and stages");
assert.match(laneText, /t\("production\.orderTotal"\)/, "the order total has a localized visible label");
assert.match(laneText, /brl\(orderTotal,\s*locale\)/, "the order total uses the app's currency formatter");
assert.match(
  laneText,
  /<p className="mt-2 flex items-center gap-1\.5 text-xs text-muted-foreground">\s*<ShieldPlus[\s\S]*?className="shrink-0"[\s\S]*?aria-hidden="true"[\s\S]*?\/>\s*<span\s+className="min-w-0 break-words"[\s\S]*?formatTimestamp\(order\.createdAt, locale\)\}/,
  "the creation date sits beside its icon",
);
assert.match(
  laneText,
  /<p className="mt-2 flex items-center gap-1\.5 text-xs text-muted-foreground">\s*<RotateCcwClock[\s\S]*?className="shrink-0"[\s\S]*?aria-hidden="true"[\s\S]*?\/>\s*<span\s+className="min-w-0 break-words"[\s\S]*?formatTimestamp\(order\.updatedAt, locale\)\}/,
  "the update date sits beside its icon",
);
assert.match(
  workspaceText,
  /<TabsTrigger value="reports">[\s\S]*?<\/TabsTrigger>\s*<TabsTrigger value="settings">\{t\("settings\.title"\)\}<\/TabsTrigger>/,
  "localized settings tab appears immediately after reports",
);
assert.match(
  workspaceText,
  /<TabsContent value="settings"[^>]*>[\s\S]*?<ProductionSettings\s*\/>[\s\S]*?<\/TabsContent>/,
  "settings tab renders its dedicated page",
);
assert.doesNotMatch(boardText, /<ProductionStageManager\b/, "stage manager is removed from the board");
assert.match(settingsText, /<ProductionStageManager\b/, "settings page renders the stage manager");
assert.doesNotMatch(stageManagerText, /<details\b|<summary\b/, "stage settings are not collapsible");
assert.match(stageManagerText, /<Card>/, "stage settings use the shared card surface");
assert.match(appText, /id="main-content" className="[^"]*overflow-y-auto/, "page content remains vertically scrollable");
const tabsListClass = workspaceText.match(/<TabsList[^>]*className="([^"]*)"/)?.[1] ?? "";
assert.match(tabsListClass, /flex-wrap/, "tabs wrap instead of needing a scrollbar");
assert.match(tabsListClass, /overflow-visible/, "tabs list does not create a scroll container");
assert.match(tabsListClass, /w-fit/, "tabs list width follows its labels");
assert.doesNotMatch(tabsListClass, /(?:^|\s)(?:overflow-x-auto|w-full|mx-auto)(?:\s|$)/, "tabs do not stretch or center in the viewport");
const mainClass = appText.match(/<main id="main-content" className="([^"]*)"/)?.[1] ?? "";
assert.match(mainClass, /min-w-0/, "the main content can shrink to the available viewport width");
assert.match(mainClass, /overflow-y-auto/, "page content remains vertically scrollable");
assert.match(
  appText,
  /className=\{view\.page === "production" \? "w-full" : "mx-auto w-full max-w-7xl"\}/,
  "the production workspace uses available width while other pages stay centered",
);
assert.match(
  workspaceText,
  /<TabsContent value="board">\s*<ProductionBoard\s*\/>\s*<\/TabsContent>/,
  "the Kanban is not limited by a readable-width container",
);
assert.match(
  workspaceText,
  /<TabsContent value="archive" className="mx-auto w-full max-w-7xl">\s*<ProductionArchive\s*\/>\s*<\/TabsContent>/,
  "the production archive remains centered in a readable container",
);
assert.match(
  workspaceText,
  /<TabsContent value="reports" className="mx-auto w-full max-w-7xl">\s*<ProductionReports\s*\/>\s*<\/TabsContent>/,
  "production reports remain centered in a readable container",
);
assert.match(
  workspaceText,
  /<TabsContent value="settings" className="mx-auto w-full max-w-7xl">\s*<ProductionSettings\s*\/>\s*<\/TabsContent>/,
  "production settings remain centered in a readable container",
);
assert.match(boardText, /className="space-y-5"/, "the Kanban page uses the shared responsive page layout");
assert.match(boardText, /<PageHeader[\s\S]*?title=\{t\("production\.title"\)\}/, "the Kanban page uses the shared page header");
assert.match(
  boardText,
  /<details\s+className="relative shrink-0"[\s\S]*?<summary[\s\S]*?t\("production\.createOrder"\)[\s\S]*?<\/summary>/,
  "order creation starts with a button that reveals the floating name input",
);
assert.doesNotMatch(boardText, /open=\{true\}/, "the floating name input starts closed");
assert.match(boardText, /id="production-create-form"[\s\S]*?className="absolute left-0 top-full z-10/, "the order-name input floats above the board content");
assert.match(boardText, /sticky left-0 top-0 z-30/, "the floating form stacks above the sticky board header");
assert.match(boardText, /type="search"[\s\S]*?placeholder=\{t\("production\.searchPlaceholder"\)\}/, "the order search uses localized search copy");
assert.match(
  boardText,
  /<div className="flex flex-col gap-4 sm:flex-row">\s*<FieldGroup[^>]*>[\s\S]*?id="production-order-search"[\s\S]*?<FieldGroup[^>]*>[\s\S]*?id="production-order-sort"/,
  "order search and sorting controls are grouped from the left",
);
assert.match(boardText, /className="w-full sm:max-w-xs"[\s\S]*?type="search"/, "the search control has a responsive width");
assert.match(boardText, /className="w-full sm:max-w-xs"[\s\S]*?<NativeSelect/, "the sort control reuses the shared select");
assert.doesNotMatch(boardText, /production-order-filter|production-filter-option/, "the multi-select filter is removed");
assert.match(boardText, /max-w-full overflow-auto overscroll-x-contain/, "the board scrolls within its own responsive region");
assert.match(boardText, /w-max min-w-full table-fixed border-separate border-spacing-0/, "the Kanban table keeps its sticky-column geometry");
const ticketCardText = laneText.slice(laneText.indexOf("function TicketCard("));
assert.match(ticketCardText, /ArrowLeftRight/, "each ticket uses the stage-move icon");
assert.match(ticketCardText, /<Button\b(?=[^>]*\basChild\b)(?=[^>]*\bvariant="ghost")(?=[^>]*\bsize="icon-lg")(?=[^>]*\bclassName="size-11")[^>]*>\s*<PopoverPrimitive\.Trigger\b/, "the Radix trigger receives the shared touch-target styling and ref");
assert.match(ticketCardText, /PopoverPrimitive\.Portal/, "the stage popover escapes the board's scroll clipping");
assert.match(ticketCardText, /PopoverPrimitive\.Title className="sr-only"/, "the stage popover has an accessible title");
assert.match(ticketCardText, /columns\.filter\(\s*\(column\)\s*=>\s*column\.id\s*!==\s*ticket\.columnId,?\s*\)/, "the popover lists only destination stages");
assert.match(ticketCardText, /onMoveTicket\(\s*orderId,\s*ticket\.id,\s*column\.id\s*\)/, "choosing a destination moves the ticket");
assert.match(ticketCardText, /aria-label=\{t\(\s*"production\.moveTicketLabel"/, "the icon-only trigger has an accessible name");
assert.doesNotMatch(ticketCardText, /production-ticket-stage-select|<FieldLabel\b|<select\b/, "the visible move label and select are removed");
assert.match(ticketCardText, /className="z-50 grid max-h-60 min-w-48 max-w-\[min\(20rem,calc\(100vw-2rem\)\)\][^"]*bg-popover/, "the portaled stage popover is responsive and uses semantic colors");
assert.match(ticketCardText, /className="min-h-11 w-full justify-start whitespace-normal"/, "stage actions remain touch-friendly and readable");

console.log("Production board filtering, sorting, and completion prompts passed");
