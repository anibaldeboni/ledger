package store

import (
	"database/sql"
	"fmt"
	"time"

	"ledger/internal/domain"
)

// ListQuotes devolve os orçamentos (mais recentes primeiro).
func (s *Store) ListQuotes() ([]domain.QuoteSummary, error) {
	rows, err := s.db.Query(`SELECT id, name, final_price, margin_percent, updated_at FROM quotes ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.QuoteSummary
	for rows.Next() {
		var q domain.QuoteSummary
		if err := rows.Scan(&q.ID, &q.Name, &q.FinalPrice, &q.MarginPercent, &q.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, q)
	}
	return out, rows.Err()
}

// GetQuote carrega um orçamento com seus filamentos e custos fixos.
func (s *Store) GetQuote(id int64) (domain.Quote, error) {
	var q domain.Quote
	err := s.db.QueryRow(`SELECT id, name, printer_id, tariff_id, margin_percent, final_price, created_at, updated_at FROM quotes WHERE id=?`, id).
		Scan(&q.ID, &q.Name, &q.PrinterID, &q.TariffID, &q.MarginPercent, &q.FinalPrice, &q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return q, err
	}

	rows, err := s.db.Query(`SELECT filament_id, print_time_hours, weight_g FROM quote_filaments WHERE quote_id=? ORDER BY id`, id)
	if err != nil {
		return q, err
	}
	for rows.Next() {
		var qf domain.QuoteFilament
		if err := rows.Scan(&qf.FilamentID, &qf.PrintTimeHours, &qf.WeightG); err != nil {
			rows.Close()
			return q, err
		}
		q.Filaments = append(q.Filaments, qf)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return q, err
	}

	rows, err = s.db.Query(`SELECT category_id, value FROM quote_fixed_costs WHERE quote_id=? ORDER BY id`, id)
	if err != nil {
		return q, err
	}
	for rows.Next() {
		var fc domain.QuoteFixedCost
		if err := rows.Scan(&fc.CategoryID, &fc.Value); err != nil {
			rows.Close()
			return q, err
		}
		q.FixedCosts = append(q.FixedCosts, fc)
	}
	rows.Close()
	return q, rows.Err()
}

// SaveQuote insere (ID=0) ou atualiza um orçamento, substituindo seus usos de
// filamento e custos fixos, e recalcula o preço final.
func (s *Store) SaveQuote(q *domain.Quote) error {
	costs, err := s.CalculateQuote(q)
	if err != nil {
		return err
	}
	q.FinalPrice = costs.FinalPrice
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if q.ID == 0 {
		q.CreatedAt = now
		res, err := tx.Exec(`INSERT INTO quotes (name, printer_id, tariff_id, margin_percent, final_price, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
			q.Name, q.PrinterID, q.TariffID, q.MarginPercent, q.FinalPrice, q.CreatedAt, now)
		if err != nil {
			return err
		}
		q.ID, _ = res.LastInsertId()
	} else {
		if _, err := tx.Exec(`UPDATE quotes SET name=?, printer_id=?, tariff_id=?, margin_percent=?, final_price=?, updated_at=? WHERE id=?`,
			q.Name, q.PrinterID, q.TariffID, q.MarginPercent, q.FinalPrice, now, q.ID); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(`DELETE FROM quote_filaments WHERE quote_id=?`, q.ID); err != nil {
		return err
	}
	for _, qf := range q.Filaments {
		if _, err := tx.Exec(`INSERT INTO quote_filaments (quote_id, filament_id, print_time_hours, weight_g) VALUES (?,?,?,?)`,
			q.ID, qf.FilamentID, qf.PrintTimeHours, qf.WeightG); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(`DELETE FROM quote_fixed_costs WHERE quote_id=?`, q.ID); err != nil {
		return err
	}
	for _, fc := range q.FixedCosts {
		if _, err := tx.Exec(`INSERT INTO quote_fixed_costs (quote_id, category_id, value) VALUES (?,?,?)`,
			q.ID, fc.CategoryID, fc.Value); err != nil {
			return err
		}
	}

	q.UpdatedAt = now
	return tx.Commit()
}

func (s *Store) DeleteQuote(id int64) error {
	res, err := s.db.Exec(`DELETE FROM quotes WHERE id=?`, id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CalculateQuote monta o CalcInput de um orçamento a partir dos cadastros e
// aplica as regras de cálculo.
func (s *Store) CalculateQuote(q *domain.Quote) (domain.Costs, error) {
	var p domain.Printer
	if err := s.db.QueryRow(`SELECT id, name, purchase_price, resale_price, lifespan_hours, power_watts FROM printers WHERE id=?`, q.PrinterID).
		Scan(&p.ID, &p.Name, &p.PurchasePrice, &p.ResalePrice, &p.LifespanHours, &p.PowerWatts); err != nil {
		return domain.Costs{}, fmt.Errorf("impressora do orçamento: %w", err)
	}

	var t domain.Tariff
	if err := s.db.QueryRow(`SELECT id, name, kwh_price FROM tariffs WHERE id=?`, q.TariffID).
		Scan(&t.ID, &t.Name, &t.KwhPrice); err != nil {
		return domain.Costs{}, fmt.Errorf("bandeira tarifária do orçamento: %w", err)
	}

	in := domain.CalcInput{
		PrinterPowerW:   p.PowerWatts,
		PrinterPurchase: p.PurchasePrice,
		PrinterResale:   p.ResalePrice,
		LifespanHours:   p.LifespanHours,
		KwhPrice:        t.KwhPrice,
		MarginPercent:   q.MarginPercent,
	}
	for _, qf := range q.Filaments {
		var pricePerKg float64
		if err := s.db.QueryRow(`SELECT price_per_kg FROM filaments WHERE id=?`, qf.FilamentID).Scan(&pricePerKg); err != nil {
			return domain.Costs{}, fmt.Errorf("filamento %d do orçamento: %w", qf.FilamentID, err)
		}
		in.Filaments = append(in.Filaments, domain.FilamentUsage{
			PricePerKg: pricePerKg,
			WeightG:    qf.WeightG,
			TimeHours:  qf.PrintTimeHours,
		})
	}
	for _, fc := range q.FixedCosts {
		var name string
		if err := s.db.QueryRow(`SELECT name FROM cost_categories WHERE id=?`, fc.CategoryID).Scan(&name); err != nil {
			return domain.Costs{}, fmt.Errorf("categoria de custo %d do orçamento: %w", fc.CategoryID, err)
		}
		in.FixedCosts = append(in.FixedCosts, domain.FixedCost{CategoryName: name, Value: fc.Value})
	}

	return domain.Calculate(in), nil
}
