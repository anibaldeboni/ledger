package store

import (
	"database/sql"
	"fmt"

	"ledger/internal/domain"
)

// --- Impressoras ---------------------------------------------------------------

func (s *Store) ListPrinters() ([]domain.Printer, error) {
	rows, err := s.db.Query(`SELECT id, name, purchase_price, resale_price, lifespan_hours, power_watts FROM printers ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Printer
	for rows.Next() {
		var p domain.Printer
		if err := rows.Scan(&p.ID, &p.Name, &p.PurchasePrice, &p.ResalePrice, &p.LifespanHours, &p.PowerWatts); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// SavePrinter insere (ID=0) ou atualiza uma impressora.
func (s *Store) SavePrinter(p *domain.Printer) error {
	if p.ID == 0 {
		res, err := s.db.Exec(`INSERT INTO printers (name, purchase_price, resale_price, lifespan_hours, power_watts) VALUES (?,?,?,?,?)`,
			p.Name, p.PurchasePrice, p.ResalePrice, p.LifespanHours, p.PowerWatts)
		if err != nil {
			return err
		}
		p.ID, _ = res.LastInsertId()
		return nil
	}
	_, err := s.db.Exec(`UPDATE printers SET name=?, purchase_price=?, resale_price=?, lifespan_hours=?, power_watts=? WHERE id=?`,
		p.Name, p.PurchasePrice, p.ResalePrice, p.LifespanHours, p.PowerWatts, p.ID)
	return err
}

func (s *Store) DeletePrinter(id int64) error {
	return s.deleteInUse("impressora", `SELECT COUNT(*) FROM quotes WHERE printer_id=?`, id,
		`DELETE FROM printers WHERE id=?`)
}

// --- Bandeiras tarifárias ------------------------------------------------------

func (s *Store) ListTariffs() ([]domain.Tariff, error) {
	rows, err := s.db.Query(`SELECT id, name, kwh_price FROM tariffs ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Tariff
	for rows.Next() {
		var t domain.Tariff
		if err := rows.Scan(&t.ID, &t.Name, &t.KwhPrice); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) SaveTariff(t *domain.Tariff) error {
	if t.ID == 0 {
		res, err := s.db.Exec(`INSERT INTO tariffs (name, kwh_price) VALUES (?,?)`, t.Name, t.KwhPrice)
		if err != nil {
			return err
		}
		t.ID, _ = res.LastInsertId()
		return nil
	}
	_, err := s.db.Exec(`UPDATE tariffs SET name=?, kwh_price=? WHERE id=?`, t.Name, t.KwhPrice, t.ID)
	return err
}

func (s *Store) DeleteTariff(id int64) error {
	return s.deleteInUse("bandeira tarifária", `SELECT COUNT(*) FROM quotes WHERE tariff_id=?`, id,
		`DELETE FROM tariffs WHERE id=?`)
}

// --- Filamentos ----------------------------------------------------------------

func (s *Store) ListFilaments() ([]domain.Filament, error) {
	rows, err := s.db.Query(`SELECT id, name, material, color, price_per_kg, source, spoolman_id FROM filaments ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Filament
	for rows.Next() {
		var f domain.Filament
		if err := rows.Scan(&f.ID, &f.Name, &f.Material, &f.Color, &f.PricePerKg, &f.Source, &f.SpoolmanID); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// SaveFilament insere (ID=0) ou atualiza; filamentos do Spoolman fazem upsert
// por spoolman_id.
func (s *Store) SaveFilament(f *domain.Filament) error {
	if f.SpoolmanID != nil {
		_, err := s.db.Exec(`
			INSERT INTO filaments (name, material, color, price_per_kg, source, spoolman_id) VALUES (?,?,?,?,?,?)
			ON CONFLICT(spoolman_id) DO UPDATE SET
				name=excluded.name, material=excluded.material, color=excluded.color,
				price_per_kg=excluded.price_per_kg, source=excluded.source`,
			f.Name, f.Material, f.Color, f.PricePerKg, f.Source, *f.SpoolmanID)
		return err
	}
	if f.ID == 0 {
		res, err := s.db.Exec(`INSERT INTO filaments (name, material, color, price_per_kg, source) VALUES (?,?,?,?,?)`,
			f.Name, f.Material, f.Color, f.PricePerKg, f.Source)
		if err != nil {
			return err
		}
		f.ID, _ = res.LastInsertId()
		return nil
	}
	_, err := s.db.Exec(`UPDATE filaments SET name=?, material=?, color=?, price_per_kg=? WHERE id=?`,
		f.Name, f.Material, f.Color, f.PricePerKg, f.ID)
	return err
}

func (s *Store) DeleteFilament(id int64) error {
	return s.deleteInUse("filamento", `SELECT COUNT(*) FROM quote_filaments WHERE filament_id=?`, id,
		`DELETE FROM filaments WHERE id=?`)
}

// --- Categorias de custo fixo --------------------------------------------------

func (s *Store) ListCostCategories() ([]domain.CostCategory, error) {
	rows, err := s.db.Query(`SELECT id, name, default_value FROM cost_categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.CostCategory
	for rows.Next() {
		var c domain.CostCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.DefaultValue); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) SaveCostCategory(c *domain.CostCategory) error {
	if c.ID == 0 {
		res, err := s.db.Exec(`INSERT INTO cost_categories (name, default_value) VALUES (?,?)`, c.Name, c.DefaultValue)
		if err != nil {
			return err
		}
		c.ID, _ = res.LastInsertId()
		return nil
	}
	_, err := s.db.Exec(`UPDATE cost_categories SET name=?, default_value=? WHERE id=?`, c.Name, c.DefaultValue, c.ID)
	return err
}

func (s *Store) DeleteCostCategory(id int64) error {
	return s.deleteInUse("categoria de custo", `SELECT COUNT(*) FROM quote_fixed_costs WHERE category_id=?`, id,
		`DELETE FROM cost_categories WHERE id=?`)
}

// --- Auxiliares ----------------------------------------------------------------

// deleteInUse bloqueia a exclusão de uma entidade referenciada por orçamentos.
func (s *Store) deleteInUse(label, countQuery string, id int64, deleteQuery string) error {
	var n int
	if err := s.db.QueryRow(countQuery, id).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return fmt.Errorf("%s está em uso em %d orçamento(s) e não pode ser excluída", label, n)
	}
	res, err := s.db.Exec(deleteQuery, id)
	if err != nil {
		return err
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
