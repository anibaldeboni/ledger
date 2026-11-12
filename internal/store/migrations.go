package store

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

func applyMigrations(dsn string, files fs.FS) (err error) {
	source, err := iofs.New(files, "migrations")
	if err != nil {
		return fmt.Errorf("carregar arquivos de migration: %w", err)
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		source.Close()
		return fmt.Errorf("abrir banco para migrations: %w", err)
	}
	db.SetMaxOpenConns(1)
	driver, err := sqlite.WithInstance(db, &sqlite.Config{})
	if err != nil {
		source.Close()
		db.Close()
		return fmt.Errorf("conectar driver de migrations: %w", err)
	}
	m, err := migrate.NewWithInstance("iofs", source, "sqlite", driver)
	if err != nil {
		source.Close()
		db.Close()
		return fmt.Errorf("inicializar migrations: %w", err)
	}
	defer func() {
		sourceErr, databaseErr := m.Close()
		if sourceErr != nil {
			err = errors.Join(err, fmt.Errorf("fechar fonte de migrations: %w", sourceErr))
		}
		if databaseErr != nil {
			err = errors.Join(err, fmt.Errorf("fechar banco de migrations: %w", databaseErr))
		}
	}()

	if err = m.Up(); errors.Is(err, migrate.ErrNoChange) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("executar migrations: %w", err)
	}
	return nil
}
