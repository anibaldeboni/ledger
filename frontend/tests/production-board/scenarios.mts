import assert from "node:assert/strict";
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
  filterAndSortProductionOrders(orders, [1, 3], { key: "createdAt", direction: "desc" }, "en").map((item) => item.id),
  [3, 1],
  "multiple selected orders are filtered and ordered by creation date",
);
assert.deepEqual(
  filterAndSortProductionOrders(orders, [], { key: "updatedAt", direction: "desc" }, "en").map((item) => item.id),
  [1, 3, 2],
  "an empty selection keeps every order and sorts by update date",
);
assert.deepEqual(
  filterAndSortProductionOrders(orders, [], { key: "title", direction: "asc" }, "en").map((item) => item.title),
  ["Alpha", "Bravo", "Zulu"],
  "orders can be sorted by title",
);
assert.deepEqual(
  filterAndSortProductionOrders(orders, [], { key: "ticketCount", direction: "desc" }, "en").map((item) => item.id),
  [2, 1, 3],
  "orders can be sorted by ticket count without changing the source list",
);
assert.deepEqual(orders.map((item) => item.id), [1, 2, 3]);
assert.deepEqual(filterAndSortProductionOrders([], [1], { key: "createdAt", direction: "asc" }, "en"), []);
assert.deepEqual(
  filterAndSortProductionOrders(orders, [999], { key: "createdAt", direction: "asc" }, "en"),
  [],
  "a filter containing only unknown order IDs shows no orders",
);
assert.deepEqual(
  filterAndSortProductionOrders(orders, [1, 1, 2], { key: "createdAt", direction: "asc" }, "en").map((item) => item.id),
  [1, 2],
  "duplicate selected IDs do not duplicate an order",
);

const invalidDates = [
  order(2, "Beta", "not-a-date", "also-bad"),
  order(1, "Alpha", "not-a-date", "also-bad"),
];
assert.deepEqual(
  filterAndSortProductionOrders(invalidDates, [], { key: "createdAt", direction: "desc" }, "en").map((item) => item.id),
  [1, 2],
  "invalid dates fall back to a deterministic ID order",
);
const missingTickets = { ...order(4, "No tickets", "", ""), tickets: null };
assert.deepEqual(
  filterAndSortProductionOrders([missingTickets, order(5, "Has tickets", "", "", [1])], [], { key: "ticketCount", direction: "desc" }, "en").map((item) => item.id),
  [5, 4],
  "a missing ticket list counts as zero tickets",
);
const caseInsensitiveTitles = [
  order(1, "beta", "", ""),
  order(2, "Alpha", "", ""),
  order(3, "alpha", "", ""),
];
assert.deepEqual(
  filterAndSortProductionOrders(caseInsensitiveTitles, [], { key: "title", direction: "asc" }, "en").map((item) => item.id),
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

console.log("Production board filtering, sorting, and completion prompts passed");
