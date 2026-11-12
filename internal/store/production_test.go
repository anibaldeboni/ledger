package store

import (
	"fmt"
	"strings"
	"testing"

	"ledger/internal/domain"
)

func saveProductionQuote(t *testing.T, s *Store, name string) domain.Quote {
	t.Helper()
	printer := domain.Printer{Name: "Production printer", PurchasePrice: 100, ResalePrice: 50, LifespanHours: 1000, PowerWatts: 100}
	if err := s.SavePrinter(&printer); err != nil {
		t.Fatal(err)
	}
	tariff := domain.Tariff{Name: "Production tariff", KwhPrice: 1}
	if err := s.SaveTariff(&tariff); err != nil {
		t.Fatal(err)
	}
	filament := domain.Filament{Name: "Production PLA", PricePerKg: 1000}
	if err := s.SaveFilament(&filament); err != nil {
		t.Fatal(err)
	}
	quote := domain.Quote{
		Name:          name,
		PrinterID:     printer.ID,
		TariffID:      tariff.ID,
		MarginPercent: 20,
		Filaments:     []domain.QuoteFilament{{FilamentID: filament.ID, PrintTimeHours: 1.5, WeightG: 20}},
	}
	if err := s.SaveQuote(&quote); err != nil {
		t.Fatal(err)
	}
	return quote
}

func columnByKey(t *testing.T, columns []domain.ProductionColumn, key string) domain.ProductionColumn {
	t.Helper()
	for _, column := range columns {
		if column.SystemKey == key {
			return column
		}
	}
	t.Fatalf("production column %q not found: %+v", key, columns)
	return domain.ProductionColumn{}
}

func TestProductionColumnsStartInDefaultOrderAndProtectCompletion(t *testing.T) {
	s := newTestStore(t)
	columns, err := s.ListProductionColumns()
	if err != nil {
		t.Fatal(err)
	}
	want := []struct{ key, name string }{
		{"todo", "To-do"},
		{"in_production", "Em produção"},
		{"printed", "Impresso"},
		{"completed", "Concluído"},
		{"cancelled", "Cancelado"},
	}
	if len(columns) != len(want) {
		t.Fatalf("got %d default columns, want %d: %+v", len(columns), len(want), columns)
	}
	for i, expected := range want {
		if columns[i].SystemKey != expected.key || columns[i].Name != expected.name || columns[i].Position != int64(i) {
			t.Errorf("column %d = %+v, want key=%q name=%q position=%d", i, columns[i], expected.key, expected.name, i)
		}
	}

	completion := columnByKey(t, columns, "completed")
	if err := s.DeleteProductionColumn(completion.ID); err == nil || !strings.Contains(err.Error(), "conclusão") {
		t.Fatalf("deleting the protected completion column should explain why; got %v", err)
	}
	todo := columnByKey(t, columns, "todo")
	todo.Name = "A fazer"
	if err := s.SaveProductionColumn(&todo); err != nil {
		t.Fatal(err)
	}
	columns, err = s.ListProductionColumns()
	if err != nil {
		t.Fatal(err)
	}
	if got := columnByKey(t, columns, "todo"); got.Name != "A fazer" {
		t.Fatalf("renaming changed the system role or failed: %+v", got)
	}
	ids := make([]int64, len(columns))
	for i := range columns {
		ids[len(columns)-1-i] = columns[i].ID
	}
	if err := s.ReorderProductionColumns(ids); err != nil {
		t.Fatal(err)
	}
	columns, err = s.ListProductionColumns()
	if err != nil {
		t.Fatal(err)
	}
	if columns[0].ID != ids[0] {
		t.Fatalf("column order did not persist: first=%d want=%d", columns[0].ID, ids[0])
	}

	custom := domain.ProductionColumn{Name: "Revisão"}
	if err := s.SaveProductionColumn(&custom); err != nil {
		t.Fatal(err)
	}
	if custom.ID == 0 {
		t.Fatal("saving a new column did not assign its ID")
	}
	if err := s.DeleteProductionColumn(custom.ID); err != nil {
		t.Fatalf("deleting an empty custom column: %v", err)
	}
}

func TestProductionUserTextIsStoredLiterally(t *testing.T) {
	s := newTestStore(t)
	title := `Order'); DROP TABLE quotes; --`
	order, err := s.CreateProductionOrder(title)
	if err != nil {
		t.Fatal(err)
	}
	if order.ID == 0 {
		t.Fatal("production order did not receive an ID")
	}
	column := domain.ProductionColumn{Name: `Stage'); DROP TABLE quotes; --`}
	if err := s.SaveProductionColumn(&column); err != nil {
		t.Fatal(err)
	}
	orders, err := s.ListProductionOrders()
	if err != nil {
		t.Fatal(err)
	}
	if len(orders) != 1 || orders[0].Title != title {
		t.Fatalf("order title changed during persistence: %+v", orders)
	}
	columns, err := s.ListProductionColumns()
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, got := range columns {
		if got.ID == column.ID && got.Name == column.Name {
			found = true
		}
	}
	if !found {
		t.Fatalf("custom column name changed during persistence: %+v", columns)
	}
	var quoteTable int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'quotes'`).Scan(&quoteTable); err != nil || quoteTable != 1 {
		t.Fatalf("user text altered the quote table: %d %v", quoteTable, err)
	}
}

func TestProductionTicketsUseLiveQuotesAndPreventDeletingLinkedQuotes(t *testing.T) {
	s := newTestStore(t)
	quote := saveProductionQuote(t, s, "Original quote")
	order, err := s.CreateProductionOrder("Pedido 1")
	if err != nil {
		t.Fatal(err)
	}
	first, err := s.AddProductionTicket(order.ID, quote.ID)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.AddProductionTicket(order.ID, quote.ID)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID == second.ID || first.QuoteID != quote.ID || second.QuoteID != quote.ID {
		t.Fatalf("each added execution should be its own linked ticket: first=%+v second=%+v", first, second)
	}
	if first.QuoteName != "Original quote" || first.EstimatedPrintHours != 1.5 || len(first.Filaments) != 1 || first.Filaments[0].WeightG != 20 {
		t.Fatalf("ticket should expose its linked quote's current estimates: %+v", first)
	}

	quote.Name = "Updated quote"
	quote.Filaments[0].WeightG = 35
	quote.Filaments[0].PrintTimeHours = 2.25
	if err := s.SaveQuote(&quote); err != nil {
		t.Fatal(err)
	}
	orders, err := s.ListProductionOrders()
	if err != nil {
		t.Fatal(err)
	}
	if len(orders) != 1 || len(orders[0].Tickets) != 2 {
		t.Fatalf("unexpected production orders: %+v", orders)
	}
	if orders[0].Tickets[0].QuoteName != "Updated quote" || orders[0].Tickets[0].EstimatedPrintHours != 2.25 || orders[0].Tickets[0].Filaments[0].WeightG != 35 {
		t.Fatalf("linked tickets did not reflect the edited quote: %+v", orders[0].Tickets[0])
	}
	if err := s.DeleteQuote(quote.ID); err == nil || !strings.Contains(err.Error(), "pedido") {
		t.Fatalf("deleting a linked quote should explain the order reference; got %v", err)
	}
	if _, err := s.GetQuote(quote.ID); err != nil {
		t.Fatalf("linked quote was deleted after rejected deletion: %v", err)
	}

	unlinked := saveProductionQuote(t, s, "Unlinked quote")
	if err := s.DeleteQuote(unlinked.ID); err != nil {
		t.Fatalf("unlinked quote deletion behavior changed: %v", err)
	}
}

func TestProductionTicketStageHistoryAndOccupiedColumnDeletion(t *testing.T) {
	s := newTestStore(t)
	quote := saveProductionQuote(t, s, "Stage quote")
	order, err := s.CreateProductionOrder("Stage order")
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := s.AddProductionTicket(order.ID, quote.ID)
	if err != nil {
		t.Fatal(err)
	}
	columns, err := s.ListProductionColumns()
	if err != nil {
		t.Fatal(err)
	}
	production := columnByKey(t, columns, "in_production")
	if err := s.MoveProductionTicket(ticket.ID, production.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteProductionColumn(production.ID); err == nil || !strings.Contains(err.Error(), "tickets") {
		t.Fatalf("deleting an occupied column should explain why; got %v", err)
	}
	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM production_ticket_stage_history WHERE ticket_id = ?`, ticket.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("stage move recorded %d history entries, want 2", count)
	}
	var closed int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM production_ticket_stage_history WHERE ticket_id = ? AND exited_at IS NOT NULL`, ticket.ID).Scan(&closed); err != nil {
		t.Fatal(err)
	}
	if closed != 1 {
		t.Fatalf("stage move closed %d previous entries, want 1", closed)
	}
}

func TestProductionOrderSoftDeleteAndArchiveLifecycle(t *testing.T) {
	s := newTestStore(t)
	quote := saveProductionQuote(t, s, "Lifecycle quote")
	active, err := s.CreateProductionOrder("Active order")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.AddProductionTicket(active.ID, quote.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteProductionOrder(active.ID); err != nil {
		t.Fatal(err)
	}
	orders, err := s.ListProductionOrders()
	if err != nil {
		t.Fatal(err)
	}
	if len(orders) != 0 {
		t.Fatalf("soft-deleted order remained on the active board: %+v", orders)
	}
	var deletedAt string
	if err := s.db.QueryRow(`SELECT deleted_at FROM production_orders WHERE id = ?`, active.ID).Scan(&deletedAt); err != nil || deletedAt == "" {
		t.Fatalf("soft-delete timestamp missing: %q %v", deletedAt, err)
	}

	completed, err := s.CreateProductionOrder("Completed order")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.ArchiveProductionOrder(completed.ID); err == nil || !strings.Contains(err.Error(), "concluído") {
		t.Fatalf("archiving an incomplete order should explain why; got %v", err)
	}
	if err := s.CompleteProductionOrder(completed.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.ArchiveProductionOrder(completed.ID); err != nil {
		t.Fatal(err)
	}
	activeOrders, err := s.ListProductionOrders()
	if err != nil {
		t.Fatal(err)
	}
	archived, err := s.ListArchivedProductionOrders()
	if err != nil {
		t.Fatal(err)
	}
	if len(activeOrders) != 0 || len(archived) != 1 || archived[0].ID != completed.ID {
		t.Fatalf("archive lifecycle mismatch: active=%+v archived=%+v", activeOrders, archived)
	}
}

func TestProductionReportFiltersCompletionDateAndAggregatesMetrics(t *testing.T) {
	s := newTestStore(t)
	quote := saveProductionQuote(t, s, "Report quote")
	order, err := s.CreateProductionOrder("Report order")
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := s.AddProductionTicket(order.ID, quote.ID)
	if err != nil {
		t.Fatal(err)
	}
	columns, err := s.ListProductionColumns()
	if err != nil {
		t.Fatal(err)
	}
	byKey := map[string]domain.ProductionColumn{}
	for _, column := range columns {
		byKey[column.SystemKey] = column
	}
	for _, key := range []string{"in_production", "todo", "completed"} {
		if err := s.MoveProductionTicket(ticket.ID, byKey[key].ID); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.CompleteProductionOrder(order.ID); err != nil {
		t.Fatal(err)
	}

	const created = "2026-01-01T00:00:00Z"
	const completed = "2026-01-01T06:00:00Z"
	if _, err := s.db.Exec(`UPDATE production_orders SET created_at = ?, completed_at = ? WHERE id = ?`, created, completed, order.ID); err != nil {
		t.Fatal(err)
	}
	var events []struct {
		id      int64
		column  int64
		entered string
	}
	rows, err := s.db.Query(`SELECT id, column_id FROM production_ticket_stage_history WHERE ticket_id = ? ORDER BY id`, ticket.ID)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var event struct {
			id     int64
			column int64
		}
		if err := rows.Scan(&event.id, &event.column); err != nil {
			rows.Close()
			t.Fatal(err)
		}
		var entered string
		switch {
		case event.column == byKey["todo"].ID && len(events) == 0:
			entered = "2026-01-01T00:00:00Z"
		case event.column == byKey["in_production"].ID:
			entered = "2026-01-01T01:00:00Z"
		case event.column == byKey["todo"].ID:
			entered = "2026-01-01T04:00:00Z"
		case event.column == byKey["completed"].ID:
			entered = "2026-01-01T05:00:00Z"
		}
		events = append(events, struct {
			id      int64
			column  int64
			entered string
		}{event.id, event.column, entered})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		t.Fatal(err)
	}
	rows.Close()
	if len(events) != 4 {
		t.Fatalf("got %d stage events, want 4: %+v", len(events), events)
	}
	for i, event := range events {
		exited := completed
		if i < len(events)-1 {
			exited = events[i+1].entered
		}
		if _, err := s.db.Exec(`UPDATE production_ticket_stage_history SET entered_at = ?, exited_at = ? WHERE id = ?`, event.entered, exited, event.id); err != nil {
			t.Fatal(err)
		}
	}

	report, err := s.GenerateProductionReport("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if len(report.Orders) != 1 {
		t.Fatalf("report selected %d orders, want 1: %+v", len(report.Orders), report)
	}
	result := report.Orders[0]
	if result.OrderDurationSeconds != 6*60*60 || result.EstimatedPrintHours != 1.5 || len(result.Tickets) != 1 {
		t.Fatalf("incorrect order-level report metrics: %+v", result)
	}
	if len(result.Filaments) != 1 || result.Filaments[0].WeightG != 20 {
		t.Fatalf("incorrect filament estimate aggregation: %+v", result.Filaments)
	}
	stages := map[string]int64{}
	for _, stage := range result.Tickets[0].StageDurations {
		stages[stage.ColumnName] = stage.DurationSeconds
	}
	if stages["To-do"] != 2*60*60 || stages["Em produção"] != 3*60*60 || stages["Concluído"] != 1*60*60 {
		t.Fatalf("incorrect cumulative stage durations: %+v", stages)
	}

	outside, err := s.GenerateProductionReport("2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if len(outside.Orders) != 0 {
		t.Fatalf("order outside the completion period appeared in report: %+v", outside.Orders)
	}
}

func TestProductionReportCountsSoftDeletedOrdersByDeletionDate(t *testing.T) {
	s := newTestStore(t)
	order, err := s.CreateProductionOrder("Canceled order")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteProductionOrder(order.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`
		UPDATE production_orders
		SET created_at = ?, completed_at = ?, deleted_at = ?
		WHERE id = ?`,
		"2025-12-01T00:00:00Z", "2026-01-02T00:00:00Z", "2026-01-02T00:00:00Z", order.ID); err != nil {
		t.Fatal(err)
	}
	startBoundary, err := s.CreateProductionOrder("Canceled at period start")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteProductionOrder(startBoundary.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`UPDATE production_orders SET created_at = ?, deleted_at = ? WHERE id = ?`, "2025-12-01T00:00:00Z", "2026-01-01T00:00:00Z", startBoundary.ID); err != nil {
		t.Fatal(err)
	}

	inside, err := s.GenerateProductionReport("2026-01-01T00:00:00Z", "2026-01-03T00:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if inside.CancelledOrderCount != 2 || len(inside.Orders) != 0 {
		t.Fatalf("soft-deleted order must appear only in the cancellation count: %+v", inside)
	}
	outside, err := s.GenerateProductionReport("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if outside.CancelledOrderCount != 1 {
		t.Fatalf("inclusive start or exclusive end bound is incorrect: %+v", outside)
	}
}

func TestProductionReportAggregatesEstimatesAcrossTickets(t *testing.T) {
	s := newTestStore(t)
	firstQuote := saveProductionQuote(t, s, "First report quote")
	secondQuote := saveProductionQuote(t, s, "Second report quote")
	order, err := s.CreateProductionOrder("Multi-ticket report order")
	if err != nil {
		t.Fatal(err)
	}
	first, err := s.AddProductionTicket(order.ID, firstQuote.ID)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.AddProductionTicket(order.ID, secondQuote.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.CompleteProductionOrder(order.ID); err != nil {
		t.Fatal(err)
	}
	created := "2026-02-01T00:00:00Z"
	completed := "2026-02-01T02:00:00Z"
	if _, err := s.db.Exec(`UPDATE production_orders SET created_at = ?, completed_at = ? WHERE id = ?`, created, completed, order.ID); err != nil {
		t.Fatal(err)
	}
	for _, ticket := range []domain.ProductionTicket{first, second} {
		if _, err := s.db.Exec(`UPDATE production_ticket_stage_history SET entered_at = ?, exited_at = ? WHERE ticket_id = ?`, created, completed, ticket.ID); err != nil {
			t.Fatal(err)
		}
	}

	report, err := s.GenerateProductionReport("2026-02-01T00:00:00Z", "2026-02-02T00:00:00Z")
	if err != nil {
		t.Fatal(err)
	}
	if len(report.Orders) != 1 || len(report.Orders[0].Tickets) != 2 {
		t.Fatalf("report omitted a ticket from the order: %+v", report)
	}
	if report.Orders[0].EstimatedPrintHours != 3 || len(report.Orders[0].Filaments) != 2 {
		t.Fatalf("order totals did not aggregate both tickets: %+v", report.Orders[0])
	}
}

func TestProductionBoardAndReportQueriesUseIndexes(t *testing.T) {
	s := newTestStore(t)
	tx, err := s.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 100; i++ {
		date := fmt.Sprintf("2026-01-%02dT00:00:00Z", (i%28)+1)
		if _, err := tx.Exec(`INSERT INTO production_orders (title, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?)`, fmt.Sprintf("Order %d", i), date, date, date); err != nil {
			tx.Rollback()
			t.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`ANALYZE production_orders`); err != nil {
		t.Fatal(err)
	}
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM production_orders WHERE deleted_at IS NULL AND archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 20`, "idx_production_orders_active_created")
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM production_orders WHERE deleted_at IS NULL AND completed_at >= ? AND completed_at < ? ORDER BY completed_at DESC, id DESC`, "idx_production_orders_completed", "2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z")
	assertProductionPlanUsesIndex(t, s, `SELECT COUNT(*) FROM production_orders WHERE deleted_at >= ? AND deleted_at < ?`, "idx_production_orders_deleted", "2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z")
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM production_tickets WHERE quote_id = ?`, "idx_production_tickets_quote", int64(1))
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM production_tickets WHERE order_id = ? AND column_id = ? ORDER BY id`, "idx_production_tickets_order_column", int64(1), int64(1))
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM production_ticket_stage_history WHERE ticket_id = ? ORDER BY entered_at, id`, "idx_production_ticket_stage_history_ticket", int64(1))
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM production_columns WHERE deleted_at IS NULL ORDER BY position, id`, "idx_production_columns_position")
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM quote_filaments WHERE quote_id = ? ORDER BY id`, "idx_quote_filaments_quote", int64(1))
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM quote_fixed_costs WHERE quote_id = ? ORDER BY id`, "idx_quote_fixed_costs_quote", int64(1))
	assertProductionPlanUsesIndex(t, s, `SELECT id FROM quotes ORDER BY updated_at DESC, id DESC`, "idx_quotes_updated_at")
}

func TestProductionDownMigrationRemovesOnlyProductionData(t *testing.T) {
	s := newTestStore(t)
	quote := saveProductionQuote(t, s, "Unrelated quote")
	order, err := s.CreateProductionOrder("Rollback order")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.AddProductionTicket(order.ID, quote.ID); err != nil {
		t.Fatal(err)
	}
	down, err := migrationFiles.ReadFile("migrations/000002_production_kanban.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(string(down)); err != nil {
		t.Fatalf("production down migration failed: %v", err)
	}
	var productionTableCount int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name LIKE 'production_%'`).Scan(&productionTableCount); err != nil {
		t.Fatal(err)
	}
	if productionTableCount != 0 {
		t.Fatalf("rollback left %d production tables", productionTableCount)
	}
	if _, err := s.GetQuote(quote.ID); err != nil {
		t.Fatalf("rollback removed unrelated quote data: %v", err)
	}
}

func assertProductionPlanUsesIndex(t *testing.T, s *Store, query, index string, args ...any) {
	t.Helper()
	rows, err := s.db.Query(`EXPLAIN QUERY PLAN `+query, args...)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var details string
	for rows.Next() {
		var id, parent, notUsed int
		var detail string
		if err := rows.Scan(&id, &parent, &notUsed, &detail); err != nil {
			t.Fatal(err)
		}
		details += detail + "\n"
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(details, index) {
		t.Fatalf("query plan does not use %s:\n%s", index, details)
	}
}
