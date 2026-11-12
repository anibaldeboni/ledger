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
