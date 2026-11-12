package main

import (
	"math"
	"path/filepath"
	"testing"

	"ledger/internal/domain"
	"ledger/internal/store"
)

func newTestQuoteService(t *testing.T) *LedgerService {
	t.Helper()
	s, err := store.Open(filepath.Join(t.TempDir(), "ledger.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := s.Close(); err != nil {
			t.Errorf("close test store: %v", err)
		}
	})
	return &LedgerService{store: s}
}

func seedQuoteService(t *testing.T, service *LedgerService) (domain.Printer, domain.Tariff, domain.Filament) {
	t.Helper()
	printer := domain.Printer{Name: "Test printer", PurchasePrice: 100, ResalePrice: 100, LifespanHours: 1000, PowerWatts: 1000}
	if err := service.store.SavePrinter(&printer); err != nil {
		t.Fatal(err)
	}
	tariff := domain.Tariff{Name: "Test tariff", KwhPrice: 1}
	if err := service.store.SaveTariff(&tariff); err != nil {
		t.Fatal(err)
	}
	filament := domain.Filament{Name: "Test filament", PricePerKg: 1000, Source: "manual"}
	if err := service.store.SaveFilament(&filament); err != nil {
		t.Fatal(err)
	}
	return printer, tariff, filament
}

func TestQuoteServiceConvertsDurationAtBoundary(t *testing.T) {
	service := newTestQuoteService(t)
	printer, tariff, filament := seedQuoteService(t, service)
	form := domain.QuoteEditor{
		Name:       "Duration test",
		PrinterID:  printer.ID,
		TariffID:   tariff.ID,
		Filaments:  []domain.QuoteEditorFilament{{FilamentID: filament.ID, PrintTime: "1h57m", WeightG: 1}},
		FixedCosts: []domain.QuoteFixedCost{},
	}

	costs, err := service.CalculateQuote(form)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(costs.Energy-1.95) > 1e-12 {
		t.Fatalf("energy cost = %.12f, want 1.95", costs.Energy)
	}

	saved, err := service.SaveQuote(form)
	if err != nil {
		t.Fatal(err)
	}
	if saved.ID == 0 || saved.Filaments[0].PrintTime != "1h57m" {
		t.Fatalf("SaveQuote returned unexpected form: %+v", saved)
	}

	stored, err := service.store.GetQuote(saved.ID)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(stored.Filaments[0].PrintTimeHours-1.95) > 1e-12 {
		t.Fatalf("stored print time = %.12f hours, want 1.95", stored.Filaments[0].PrintTimeHours)
	}

	loaded, err := service.GetQuote(saved.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Filaments[0].PrintTime != "1h57m" {
		t.Fatalf("GetQuote returned print time %q, want 1h57m", loaded.Filaments[0].PrintTime)
	}
}

func TestQuoteServiceRejectsInvalidDurationBeforeSaving(t *testing.T) {
	service := newTestQuoteService(t)
	_, err := service.SaveQuote(domain.QuoteEditor{
		Filaments: []domain.QuoteEditorFilament{{FilamentID: 1, PrintTime: "2m1h", WeightG: 10}},
	})
	if err == nil {
		t.Fatal("SaveQuote accepted an invalid print duration")
	}

	quotes, err := service.store.ListQuotes()
	if err != nil {
		t.Fatal(err)
	}
	if len(quotes) != 0 {
		t.Fatalf("invalid duration persisted %d quote(s)", len(quotes))
	}
}
