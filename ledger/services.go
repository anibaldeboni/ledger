package main

import (
	"ledger/internal/domain"
	"ledger/internal/spoolman"
	"ledger/internal/store"
)

// LedgerService expõe para o frontend (via bindings do Wails) todas as
// operações de cadastro e orçamento.
type LedgerService struct {
	store *store.Store
}

// --- Impressoras ---------------------------------------------------------------

func (s *LedgerService) ListPrinters() ([]domain.Printer, error) {
	return s.store.ListPrinters()
}

func (s *LedgerService) SavePrinter(p domain.Printer) (domain.Printer, error) {
	err := s.store.SavePrinter(&p)
	return p, err
}

func (s *LedgerService) DeletePrinter(id int64) error {
	return s.store.DeletePrinter(id)
}

// --- Bandeiras tarifárias ------------------------------------------------------

func (s *LedgerService) ListTariffs() ([]domain.Tariff, error) {
	return s.store.ListTariffs()
}

func (s *LedgerService) SaveTariff(t domain.Tariff) (domain.Tariff, error) {
	err := s.store.SaveTariff(&t)
	return t, err
}

func (s *LedgerService) DeleteTariff(id int64) error {
	return s.store.DeleteTariff(id)
}

// --- Filamentos ----------------------------------------------------------------

func (s *LedgerService) ListFilaments() ([]domain.Filament, error) {
	return s.store.ListFilaments()
}

func (s *LedgerService) SaveFilament(f domain.Filament) (domain.Filament, error) {
	err := s.store.SaveFilament(&f)
	return f, err
}

func (s *LedgerService) DeleteFilament(id int64) error {
	return s.store.DeleteFilament(id)
}

// --- Categorias de custo fixo --------------------------------------------------

func (s *LedgerService) ListCostCategories() ([]domain.CostCategory, error) {
	return s.store.ListCostCategories()
}

func (s *LedgerService) SaveCostCategory(c domain.CostCategory) (domain.CostCategory, error) {
	err := s.store.SaveCostCategory(&c)
	return c, err
}

func (s *LedgerService) DeleteCostCategory(id int64) error {
	return s.store.DeleteCostCategory(id)
}

// --- Spoolman ------------------------------------------------------------------

func (s *LedgerService) GetSpoolmanURL() (string, error) {
	return s.store.GetSpoolmanURL()
}

func (s *LedgerService) SetSpoolmanURL(url string) error {
	return s.store.SetSpoolmanURL(url)
}

// TestSpoolman tenta buscar os spools da instância informada (URL em edição
// na tela, não necessariamente a salva).
func (s *LedgerService) TestSpoolman(url string) error {
	_, err := (&spoolman.Client{BaseURL: url}).Spools()
	return err
}

// ImportSpoolman imports (upserts) non-archived spools whose remaining weight
// is not explicitly zero, and returns the number imported.
func (s *LedgerService) ImportSpoolman(url string) (int, error) {
	spools, err := (&spoolman.Client{BaseURL: url}).Spools()
	if err != nil {
		return 0, err
	}
	filaments := spoolman.Filaments(spools)
	for i := range filaments {
		if err := s.store.SaveFilament(&filaments[i]); err != nil {
			return 0, err
		}
	}
	return len(filaments), nil
}

// --- Orçamentos ----------------------------------------------------------------

func (s *LedgerService) ListQuotes() ([]domain.QuoteSummary, error) {
	return s.store.ListQuotes()
}

func (s *LedgerService) GetQuote(id int64) (domain.QuoteEditor, error) {
	quote, err := s.store.GetQuote(id)
	if err != nil {
		return domain.QuoteEditor{}, err
	}
	return domain.QuoteEditorFromQuote(quote), nil
}

// CalculateQuote calcula o orçamento sem salvá-lo (botão Calcular do formulário).
func (s *LedgerService) CalculateQuote(form domain.QuoteEditor) (domain.Costs, error) {
	quote, err := domain.QuoteFromEditor(form)
	if err != nil {
		return domain.Costs{}, err
	}
	return s.store.CalculateQuote(&quote)
}

func (s *LedgerService) SaveQuote(form domain.QuoteEditor) (domain.QuoteEditor, error) {
	quote, err := domain.QuoteFromEditor(form)
	if err != nil {
		return domain.QuoteEditor{}, err
	}
	if err := s.store.SaveQuote(&quote); err != nil {
		return domain.QuoteEditor{}, err
	}
	return domain.QuoteEditorFromQuote(quote), nil
}

func (s *LedgerService) DeleteQuote(id int64) error {
	return s.store.DeleteQuote(id)
}
