package store

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"ledger/internal/domain"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestOpenMigratesExistingDatabaseWithoutLosingData(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	legacyDB, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	_, err = legacyDB.Exec(`
		CREATE TABLE printers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			purchase_price REAL NOT NULL DEFAULT 0,
			resale_price REAL NOT NULL DEFAULT 0,
			lifespan_hours REAL NOT NULL DEFAULT 0,
			power_watts REAL NOT NULL DEFAULT 0
		);
		INSERT INTO printers (name, purchase_price) VALUES ('Impressora existente', 123.45);
	`)
	if err != nil {
		legacyDB.Close()
		t.Fatal(err)
	}
	if err := legacyDB.Close(); err != nil {
		t.Fatal(err)
	}

	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })

	var name string
	var purchasePrice float64
	if err := s.db.QueryRow(`SELECT name, purchase_price FROM printers WHERE id = 1`).Scan(&name, &purchasePrice); err != nil {
		t.Fatal(err)
	}
	if name != "Impressora existente" || purchasePrice != 123.45 {
		t.Fatalf("migration altered existing data: name=%q purchase_price=%v", name, purchasePrice)
	}

	var version int
	if err := s.db.QueryRow(`SELECT version FROM schema_migrations`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if version != 2 {
		t.Fatalf("migration version = %d, want 2", version)
	}
}

func TestOpenAcceptsAlreadyAppliedMigrations(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	first, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}

	second, err := Open(path)
	if err != nil {
		t.Fatalf("Open failed when all migrations were already applied: %v", err)
	}
	t.Cleanup(func() { second.Close() })
}

func TestOpenReturnsMigrationFailureWithoutChangingData(t *testing.T) {
	path := filepath.Join(t.TempDir(), "broken.db")
	legacyDB, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	_, err = legacyDB.Exec(`
		CREATE TABLE printers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
		INSERT INTO printers (id, name) VALUES (1, 'Original');
	`)
	if err != nil {
		legacyDB.Close()
		t.Fatal(err)
	}
	if err := legacyDB.Close(); err != nil {
		t.Fatal(err)
	}

	migrations := fstest.MapFS{
		"migrations/000001_invalid.up.sql": &fstest.MapFile{Data: []byte("UPDATE printers SET name = 'Alterado'; CREATE TABLE broken (")},
	}
	s, err := open(path, migrations)
	if err == nil {
		t.Fatal("open succeeded with an invalid migration")
	}
	if s != nil {
		s.Close()
		t.Fatal("open returned a store after a migration failure")
	}
	if !strings.Contains(err.Error(), "migrar schema") {
		t.Fatalf("migration error lacks startup context: %v", err)
	}

	checkDB, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { checkDB.Close() })
	var name string
	if err := checkDB.QueryRow(`SELECT name FROM printers WHERE id = 1`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "Original" {
		t.Fatalf("rejected migration changed existing data: name=%q", name)
	}
}

func TestQuoteRoundTrip(t *testing.T) {
	s := newTestStore(t)

	// Cadastros
	printer := domainPrinter()
	if err := s.SavePrinter(&printer); err != nil {
		t.Fatal(err)
	}
	tariff := domainTariff()
	if err := s.SaveTariff(&tariff); err != nil {
		t.Fatal(err)
	}
	filament := domainFilament()
	if err := s.SaveFilament(&filament); err != nil {
		t.Fatal(err)
	}
	cat := domainCategory()
	if err := s.SaveCostCategory(&cat); err != nil {
		t.Fatal(err)
	}

	// Orçamento
	q := domainQuote(printer.ID, tariff.ID, filament.ID, cat.ID)
	if err := s.SaveQuote(&q); err != nil {
		t.Fatal(err)
	}
	if q.ID == 0 {
		t.Fatal("SaveQuote deveria atribuir um ID")
	}
	if q.FinalPrice <= 0 {
		t.Fatalf("FinalPrice deveria ser calculado ao salvar, obtido %.2f", q.FinalPrice)
	}

	got, err := s.GetQuote(q.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != q.Name || len(got.Filaments) != 1 || len(got.FixedCosts) != 1 {
		t.Fatalf("GetQuote divergente: %+v", got)
	}
	if got.Filaments[0].WeightG != 10 || got.Filaments[0].PrintTimeHours != 1 {
		t.Fatalf("uso de filamento divergente: %+v", got.Filaments[0])
	}

	list, err := s.ListQuotes()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != q.ID || list[0].FinalPrice != q.FinalPrice {
		t.Fatalf("ListQuotes divergente: %+v", list)
	}

	// Atualização mantém created_at e substitui usos
	got.Name = "Editado"
	got.Filaments = append(got.Filaments, got.Filaments[0])
	if err := s.SaveQuote(&got); err != nil {
		t.Fatal(err)
	}
	again, _ := s.GetQuote(got.ID)
	if again.Name != "Editado" || len(again.Filaments) != 2 {
		t.Fatalf("edição divergente: %+v", again)
	}
	if again.CreatedAt != got.CreatedAt {
		t.Fatalf("created_at não deveria mudar na edição: %s != %s", again.CreatedAt, got.CreatedAt)
	}

	// Exclusão de entidade em uso é bloqueada
	if err := s.DeletePrinter(printer.ID); err == nil {
		t.Fatal("DeletePrinter deveria falhar com impressora em uso")
	}
	if err := s.DeleteFilament(filament.ID); err == nil {
		t.Fatal("DeleteFilament deveria falhar com filamento em uso")
	}
	if err := s.DeleteCostCategory(cat.ID); err == nil {
		t.Fatal("DeleteCostCategory deveria falhar com categoria em uso")
	}
	if err := s.DeleteTariff(tariff.ID); err == nil {
		t.Fatal("DeleteTariff deveria falhar com bandeira em uso")
	}

	// Excluir o orçamento libera as entidades
	if err := s.DeleteQuote(got.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.DeletePrinter(printer.ID); err != nil {
		t.Fatalf("DeletePrinter deveria funcionar após excluir orçamento: %v", err)
	}
}

func TestSpoolmanConfig(t *testing.T) {
	s := newTestStore(t)
	if err := s.SetSpoolmanURL("http://localhost:8000"); err != nil {
		t.Fatal(err)
	}
	url, err := s.GetSpoolmanURL()
	if err != nil || url != "http://localhost:8000" {
		t.Fatalf("GetSpoolmanURL: %q %v", url, err)
	}
}

func TestUpsertSpoolmanFilaments(t *testing.T) {
	s := newTestStore(t)
	sid := int64(42)
	f1 := domainFilament()
	f1.SpoolmanID = &sid
	if err := s.SaveFilament(&f1); err != nil {
		t.Fatal(err)
	}
	// Mesmo spoolman_id → atualiza, não duplica
	f1b := domainFilament()
	f1b.Name = "Atualizado"
	f1b.SpoolmanID = &sid
	if err := s.SaveFilament(&f1b); err != nil {
		t.Fatal(err)
	}
	list, _ := s.ListFilaments()
	if len(list) != 1 || list[0].Name != "Atualizado" {
		t.Fatalf("upsert por spoolman_id divergente: %+v", list)
	}
}

func domainPrinter() domain.Printer {
	return domain.Printer{Name: "Bambu A1", PurchasePrice: 4500, ResalePrice: 500, LifespanHours: 5000, PowerWatts: 250}
}
func domainTariff() domain.Tariff { return domain.Tariff{Name: "Verde", KwhPrice: 0.8} }
func domainFilament() domain.Filament {
	return domain.Filament{Name: "PLA Preto", Material: "PLA", Color: "#000000", PricePerKg: 99, Source: "manual"}
}
func domainCategory() domain.CostCategory {
	return domain.CostCategory{Name: "Mão de Obra", DefaultValue: 2}
}

func domainQuote(printerID, tariffID, filamentID, categoryID int64) domain.Quote {
	return domain.Quote{
		Name:          "Teste",
		PrinterID:     printerID,
		TariffID:      tariffID,
		MarginPercent: 50,
		Filaments:     []domain.QuoteFilament{{FilamentID: filamentID, PrintTimeHours: 1, WeightG: 10}},
		FixedCosts:    []domain.QuoteFixedCost{{CategoryID: categoryID, Value: 2}},
	}
}
