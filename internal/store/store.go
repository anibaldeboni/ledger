// Package store persiste as entidades do domínio em SQLite (driver modernc, sem cgo).
package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Store encapsula o banco da aplicação.
type Store struct{ db *sql.DB }

// Open cria/abre o banco em path e aplica o schema.
func Open(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("criar diretório do banco: %w", err)
		}
	}
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("abrir banco: %w", err)
	}
	// Uma conexão serializa os acessos e evita SQLITE_BUSY num app desktop.
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrar schema: %w", err)
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

// GetSpoolmanURL devolve a URL configurada do Spoolman ("" se não configurada).
func (s *Store) GetSpoolmanURL() (string, error) {
	var url string
	err := s.db.QueryRow(`SELECT base_url FROM spoolman WHERE id = 1`).Scan(&url)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return url, err
}

// SetSpoolmanURL grava a URL do Spoolman.
func (s *Store) SetSpoolmanURL(url string) error {
	_, err := s.db.Exec(`
		INSERT INTO spoolman (id, base_url) VALUES (1, ?)
		ON CONFLICT(id) DO UPDATE SET base_url = excluded.base_url`, url)
	return err
}

const schema = `
CREATE TABLE IF NOT EXISTS printers (
	id             INTEGER PRIMARY KEY AUTOINCREMENT,
	name           TEXT NOT NULL,
	purchase_price REAL NOT NULL DEFAULT 0,
	resale_price   REAL NOT NULL DEFAULT 0,
	lifespan_hours REAL NOT NULL DEFAULT 0,
	power_watts    REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tariffs (
	id        INTEGER PRIMARY KEY AUTOINCREMENT,
	name      TEXT NOT NULL,
	kwh_price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS filaments (
	id           INTEGER PRIMARY KEY AUTOINCREMENT,
	name         TEXT NOT NULL,
	material     TEXT NOT NULL DEFAULT '',
	color        TEXT NOT NULL DEFAULT '',
	price_per_kg REAL NOT NULL DEFAULT 0,
	source       TEXT NOT NULL DEFAULT 'manual',
	spoolman_id  INTEGER UNIQUE
);

CREATE TABLE IF NOT EXISTS cost_categories (
	id            INTEGER PRIMARY KEY AUTOINCREMENT,
	name          TEXT NOT NULL UNIQUE,
	default_value REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS spoolman (
	id       INTEGER PRIMARY KEY CHECK (id = 1),
	base_url TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quotes (
	id             INTEGER PRIMARY KEY AUTOINCREMENT,
	name           TEXT NOT NULL,
	printer_id     INTEGER NOT NULL REFERENCES printers(id),
	tariff_id      INTEGER NOT NULL REFERENCES tariffs(id),
	margin_percent REAL NOT NULL DEFAULT 0,
	final_price    REAL NOT NULL DEFAULT 0,
	created_at     TEXT NOT NULL,
	updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_filaments (
	id               INTEGER PRIMARY KEY AUTOINCREMENT,
	quote_id         INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
	filament_id      INTEGER NOT NULL REFERENCES filaments(id),
	print_time_hours REAL NOT NULL DEFAULT 0,
	weight_g         REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quote_fixed_costs (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
	category_id INTEGER NOT NULL REFERENCES cost_categories(id),
	value       REAL NOT NULL DEFAULT 0
);
`
