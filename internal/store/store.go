// Package store persiste as entidades do domínio em SQLite (driver modernc, sem cgo).
package store

import (
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Store encapsula o banco da aplicação.
type Store struct{ db *sql.DB }

// Open cria/abre o banco em path e aplica o schema.
func Open(path string) (*Store, error) {
	return open(path, migrationFiles)
}

func open(path string, migrations fs.FS) (*Store, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("criar diretório do banco: %w", err)
		}
	}
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)", path)
	if err := applyMigrations(dsn, migrations); err != nil {
		return nil, fmt.Errorf("migrar schema: %w", err)
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("abrir banco: %w", err)
	}
	// Uma conexão serializa os acessos e evita SQLITE_BUSY num app desktop.
	db.SetMaxOpenConns(1)
	return &Store{db: db}, nil
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
