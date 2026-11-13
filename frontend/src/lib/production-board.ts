import type { ProductionOrder } from "../../bindings/ledger/internal/domain/models";
import { filterByName } from "./search.ts";

export type ProductionOrderSort = {
  key: "createdAt" | "updatedAt" | "title" | "ticketCount";
  direction: "asc" | "desc";
};

export function reorderProductionColumns<T>(columns: T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (index < 0 || target < 0 || index >= columns.length || target >= columns.length) return columns;

  const reordered = [...columns];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered;
}

export function filterAndSortProductionOrders(
  orders: ProductionOrder[],
  search: string,
  sort: ProductionOrderSort,
  locale: string,
): ProductionOrder[] {
  const filteredOrders = filterByName(orders, search, (order) => order.title);
  const direction = sort.direction === "asc" ? 1 : -1;
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });

  return [...filteredOrders].sort((a, b) => {
    const comparison =
      sort.key === "title"
        ? collator.compare(a.title, b.title)
        : sort.key === "ticketCount"
          ? (a.tickets?.length ?? 0) - (b.tickets?.length ?? 0)
          : Date.parse(a[sort.key]) - Date.parse(b[sort.key]);
    return direction * comparison || a.id - b.id;
  });
}

export function shouldPromptToCompleteOrderAfterMove(
  order: ProductionOrder,
  ticketId: number,
  destinationColumnId: number,
  completionColumnId: number,
): boolean {
  const tickets = order.tickets ?? [];
  return (
    !order.archivedAt &&
    tickets.length > 0 &&
    tickets.some((ticket) => ticket.id === ticketId) &&
    tickets.every((ticket) =>
      (ticket.id === ticketId ? destinationColumnId : ticket.columnId) === completionColumnId,
    )
  );
}
