package main

import (
	"strings"
	"testing"
	"time"

	"ledger/internal/domain"
)

func TestProductionServiceKeepsLiveQuoteAndArchivesReportableOrder(t *testing.T) {
	service := newTestQuoteService(t)
	printer, tariff, filament := seedQuoteService(t, service)
	quote, err := service.SaveQuote(domain.QuoteEditor{
		Name:          "Live quote",
		PrinterID:     printer.ID,
		TariffID:      tariff.ID,
		MarginPercent: 20,
		Filaments:     []domain.QuoteEditorFilament{{FilamentID: filament.ID, PrintTime: "1h30m", WeightG: 25}},
	})
	if err != nil {
		t.Fatal(err)
	}
	order, err := service.CreateProductionOrder("Pedido ao vivo")
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := service.AddProductionTicket(order.ID, quote.ID)
	if err != nil {
		t.Fatal(err)
	}
	if ticket.EstimatedPrintHours != 1.5 || ticket.Filaments[0].WeightG != 25 {
		t.Fatalf("ticket did not return quote estimates: %+v", ticket)
	}

	quote.Name = "Updated live quote"
	quote.Filaments[0].PrintTime = "2h"
	quote.Filaments[0].WeightG = 40
	if _, err := service.SaveQuote(quote); err != nil {
		t.Fatal(err)
	}
	orders, err := service.ListProductionOrders()
	if err != nil {
		t.Fatal(err)
	}
	if len(orders) != 1 || orders[0].Tickets[0].QuoteName != "Updated live quote" || orders[0].Tickets[0].EstimatedPrintHours != 2 || orders[0].Tickets[0].Filaments[0].WeightG != 40 {
		t.Fatalf("production board did not reflect the edited quote: %+v", orders)
	}
	if err := service.DeleteQuote(quote.ID); err == nil || !strings.Contains(err.Error(), "pedido") {
		t.Fatalf("deleting an order-linked quote should explain why; got %v", err)
	}

	columns, err := service.ListProductionColumns()
	if err != nil {
		t.Fatal(err)
	}
	var completion domain.ProductionColumn
	for _, column := range columns {
		if column.SystemKey == "completed" {
			completion = column
		}
	}
	if completion.ID == 0 {
		t.Fatal("completion stage was not seeded")
	}
	if err := service.MoveProductionTicket(ticket.ID, completion.ID); err != nil {
		t.Fatal(err)
	}
	if err := service.CompleteProductionOrder(order.ID); err != nil {
		t.Fatal(err)
	}
	if err := service.ArchiveProductionOrder(order.ID); err != nil {
		t.Fatal(err)
	}
	archived, err := service.ListArchivedProductionOrders()
	if err != nil {
		t.Fatal(err)
	}
	if len(archived) != 1 || archived[0].ID != order.ID {
		t.Fatalf("archived order not available: %+v", archived)
	}
	cancelled, err := service.CreateProductionOrder("Canceled order")
	if err != nil {
		t.Fatal(err)
	}
	if err := service.DeleteProductionOrder(cancelled.ID); err != nil {
		t.Fatal(err)
	}

	start := time.Now().UTC().Add(-time.Hour).Format(time.RFC3339)
	end := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	report, err := service.GenerateProductionReport(start, end)
	if err != nil {
		t.Fatal(err)
	}
	if len(report.Orders) != 1 || report.CancelledOrderCount != 1 || report.Orders[0].EstimatedPrintHours != 2 || len(report.Orders[0].Filaments) != 1 || report.Orders[0].Filaments[0].WeightG != 40 {
		t.Fatalf("archived order report did not use current quote estimates: %+v", report)
	}
}

func TestProductionServiceRejectsInvalidReportRange(t *testing.T) {
	service := newTestQuoteService(t)
	if _, err := service.GenerateProductionReport("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z"); err == nil {
		t.Fatal("report accepted an end time before its start time")
	}
}
