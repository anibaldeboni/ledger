import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { ProductionOrder } from "../../bindings/ledger/internal/domain/models.ts";
import {
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
const boardText = await readFile(new URL("../../src/pages/ProductionBoard.tsx", import.meta.url), "utf8");
const laneText = await readFile(new URL("../../src/pages/ProductionLane.tsx", import.meta.url), "utf8");
const settingsText = await readFile(new URL("../../src/pages/ProductionSettings.tsx", import.meta.url), "utf8");
const stageManagerText = await readFile(new URL("../../src/pages/ProductionStageManager.tsx", import.meta.url), "utf8");
const stylesText = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");
assert.match(
  workspaceText,
  /<TabsTrigger value="reports">[\s\S]*?<\/TabsTrigger>\s*<TabsTrigger value="settings">\{t\("settings\.title"\)\}<\/TabsTrigger>/,
  "localized settings tab appears immediately after reports",
);
assert.match(
  workspaceText,
  /<TabsContent value="settings">[\s\S]*?<ProductionSettings\s*\/>[\s\S]*?<\/TabsContent>/,
  "settings tab renders its dedicated page",
);
assert.doesNotMatch(boardText, /<ProductionStageManager\b/, "stage manager is removed from the board");
assert.match(settingsText, /<ProductionStageManager\b/, "settings page renders the stage manager");
assert.doesNotMatch(stageManagerText, /<details\b|<summary\b/, "stage settings are not collapsible");
assert.match(stageManagerText, /<section\b[^>]*className="production-stage-manager"/, "stage settings render directly as a section");
assert.match(stylesText, /\.content\s*\{[^}]*overflow-y:\s*auto;/s, "page content remains vertically scrollable");
const tabsListStyles = stylesText.match(/\.production-workspace \[data-slot="tabs-list"\]\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(tabsListStyles, /display:\s*flex;/, "tabs list uses a wrapping layout");
assert.match(tabsListStyles, /flex-wrap:\s*wrap;/, "tabs wrap instead of needing a scrollbar");
assert.match(tabsListStyles, /overflow:\s*visible;/, "tabs list does not create a scroll container");
assert.doesNotMatch(tabsListStyles, /overflow(?:-[xy])?:\s*auto;/, "tabs list has no scrollable overflow");
assert.match(tabsListStyles, /width:\s*fit-content;/, "tabs list width follows its labels");
assert.match(tabsListStyles, /max-width:\s*100%;/, "tabs wrap within narrow viewports");
assert.match(tabsListStyles, /margin-inline:\s*0;/, "tabs list stays left-aligned");
assert.match(tabsListStyles, /justify-content:\s*flex-start;/, "tab triggers start from the left");
assert.doesNotMatch(tabsListStyles, /(^|\n)\s*width:\s*100%;|max-width:\s*980px;|margin-inline:\s*auto;/, "tabs do not stretch or center in the viewport");
const tabsTriggerStyles = stylesText.match(/\.production-workspace \[data-slot="tabs-list"\] \[data-slot="tabs-trigger"\]\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(tabsTriggerStyles, /flex:\s*0 0 auto;/, "each tab sizes to its text instead of stretching");
const contentStyles = stylesText.match(/\.content\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(contentStyles, /min-width:\s*0;/, "the main content can shrink to the available viewport width");
assert.match(contentStyles, /width:\s*100%;/, "the main content fills the available viewport width");
assert.doesNotMatch(contentStyles, /max-width:\s*980px;/, "the main content does not cap the Kanban width");
const centeredPageStyles = stylesText.match(/\.content > :not\(\.production-workspace\)\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(centeredPageStyles, /max-width:\s*980px;/, "non-production pages keep a readable maximum width");
assert.match(centeredPageStyles, /margin-inline:\s*auto;/, "non-production pages are centered");
assert.match(boardText, /className="production-page production-board-page"/, "the Kanban page has a full-width layout variant");
const boardPageStyles = stylesText.match(/\.production-page\.production-board-page\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(boardPageStyles, /max-width:\s*none;/, "the Kanban page is not capped by the regular page width");
assert.match(
  boardText,
  /<details\s+className="production-create"[\s\S]*?<Button asChild>[\s\S]*?<summary\b[^>]*>[\s\S]*?t\("production\.createOrder"\)[\s\S]*?<\/summary>[\s\S]*?<form\b[^>]*className="production-create-form"[\s\S]*?<Input[\s\S]*?\/>[\s\S]*?<\/form>\s*<\/details>/,
  "order creation starts with a button that reveals the floating name input",
);
assert.doesNotMatch(boardText, /<details\s+className="production-create"[^>]*\bopen\b/, "the floating name input starts closed");
assert.doesNotMatch(boardText, /<Card className="production-create-card"/, "the order form is not always visible in a card");
const createPopoverStyles = stylesText.match(/\.production-create\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(createPopoverStyles, /position:\s*relative;/, "the floating order input is anchored to its button");
assert.match(createPopoverStyles, /align-self:\s*flex-start;/, "the create-order button stays left-aligned");
const createPopoverPanelStyles = stylesText.match(/\.production-create-form\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(createPopoverPanelStyles, /position:\s*absolute;/, "the order-name input floats instead of taking page space");
assert.match(createPopoverPanelStyles, /left:\s*0;/, "the floating input aligns with its trigger");
const createPopoverZIndex = Number(createPopoverPanelStyles.match(/z-index:\s*(\d+)/)?.[1] ?? 0);
const stickyBoardHeaderStyles = stylesText.match(/\.production-board-table thead th:first-child\s*\{([^}]*)\}/)?.[1] ?? "";
const stickyBoardHeaderZIndex = Number(stickyBoardHeaderStyles.match(/z-index:\s*(\d+)/)?.[1] ?? 0);
assert.ok(createPopoverZIndex > stickyBoardHeaderZIndex, "the floating input stacks above sticky board headers");
assert.match(boardText, /className="production-search"/, "the order filter is a search field");
assert.match(boardText, /type="search"[\s\S]*?placeholder=\{t\("production\.searchPlaceholder"\)\}/, "the order search uses localized search copy");
assert.doesNotMatch(boardText, /production-order-filter|production-filter-option/, "the multi-select filter is removed");
const searchSortStyles = stylesText.match(/\.production-search,\s*\.production-sort\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(searchSortStyles, /flex:\s*1 1 220px;/, "search and sort controls share the same flex sizing");
assert.match(searchSortStyles, /max-width:\s*320px;/, "search and sort controls share the same maximum width");
const boardControlsStyles = stylesText.match(/\.production-board-controls\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(boardControlsStyles, /align-items:\s*flex-end;/, "search and sort controls align along the same baseline");
const ticketCardText = laneText.slice(laneText.indexOf("function TicketCard("));
assert.match(ticketCardText, /ArrowLeftRight/, "each ticket uses the stage-move icon");
assert.match(ticketCardText, /<Button\b(?=[^>]*\basChild\b)(?=[^>]*\bvariant="ghost")(?=[^>]*\bsize="icon-sm")(?=[^>]*\bclassName="production-ticket-move-trigger")[^>]*>\s*<PopoverPrimitive\.Trigger\b/, "the Radix trigger receives the button styling and ref");
assert.match(ticketCardText, /PopoverPrimitive\.Portal/, "the stage popover escapes the board's scroll clipping");
assert.match(ticketCardText, /PopoverPrimitive\.Title className="sr-only"/, "the stage popover has an accessible title");
assert.match(ticketCardText, /columns\.filter\(\s*\(column\)\s*=>\s*column\.id\s*!==\s*ticket\.columnId,?\s*\)/, "the popover lists only destination stages");
assert.match(ticketCardText, /onMoveTicket\(\s*orderId,\s*ticket\.id,\s*column\.id\s*\)/, "choosing a destination moves the ticket");
assert.match(ticketCardText, /aria-label=\{t\(\s*"production\.moveTicketLabel"/, "the icon-only trigger has an accessible name");
assert.doesNotMatch(ticketCardText, /production-ticket-stage-select|<FieldLabel\b|<select\b/, "the visible move label and select are removed");
const ticketMovePopoverStyles = stylesText.match(/\.production-ticket-move-popover\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(ticketMovePopoverStyles, /z-index:\s*50;/, "the portaled stage popover layers above the Kanban board");
assert.match(ticketMovePopoverStyles, /background:\s*var\(--surface\);/, "the stage popover uses the app surface color");
const ticketMoveHoverStyles = stylesText.match(/\.production-ticket-move-trigger:hover:not\(:disabled\)\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(ticketMoveHoverStyles, /background:\s*var\(--surface-2\);/, "the stage-move button has a visible hover state");
assert.match(ticketMoveHoverStyles, /border-color:\s*var\(--border-strong\);/, "the stage-move button border responds on hover");

console.log("Production board filtering, sorting, and completion prompts passed");
