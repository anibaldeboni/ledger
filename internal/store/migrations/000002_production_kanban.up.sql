CREATE TABLE production_orders (
	id           INTEGER PRIMARY KEY AUTOINCREMENT,
	title        TEXT NOT NULL CHECK (length(trim(title)) > 0),
	created_at   TEXT NOT NULL,
	updated_at   TEXT NOT NULL,
	completed_at TEXT,
	archived_at  TEXT,
	deleted_at   TEXT
);

CREATE TABLE production_columns (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	system_key TEXT UNIQUE CHECK (system_key IS NULL OR system_key IN ('todo', 'in_production', 'printed', 'completed', 'cancelled')),
	name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
	position   INTEGER NOT NULL,
	deleted_at TEXT
);

INSERT INTO production_columns (system_key, name, position) VALUES
	('todo', 'To-do', 0),
	('in_production', 'Em produção', 1),
	('printed', 'Impresso', 2),
	('completed', 'Concluído', 3),
	('cancelled', 'Cancelado', 4);

CREATE TABLE production_tickets (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id   INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE RESTRICT,
	quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
	column_id  INTEGER NOT NULL REFERENCES production_columns(id) ON DELETE RESTRICT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE production_ticket_stage_history (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	ticket_id  INTEGER NOT NULL REFERENCES production_tickets(id) ON DELETE RESTRICT,
	column_id  INTEGER NOT NULL REFERENCES production_columns(id) ON DELETE RESTRICT,
	entered_at TEXT NOT NULL,
	exited_at  TEXT CHECK (exited_at IS NULL OR exited_at >= entered_at)
);

CREATE UNIQUE INDEX idx_production_ticket_stage_history_open
	ON production_ticket_stage_history(ticket_id) WHERE exited_at IS NULL;
CREATE INDEX idx_production_ticket_stage_history_ticket
	ON production_ticket_stage_history(ticket_id, entered_at, id);
CREATE INDEX idx_production_ticket_stage_history_column
	ON production_ticket_stage_history(column_id, ticket_id);

CREATE INDEX idx_production_columns_position
	ON production_columns(position, id) WHERE deleted_at IS NULL;
CREATE INDEX idx_production_orders_active_created
	ON production_orders(created_at DESC, id DESC) WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX idx_production_orders_completed
	ON production_orders(completed_at DESC, id DESC) WHERE deleted_at IS NULL AND completed_at IS NOT NULL;
CREATE INDEX idx_production_orders_archived
	ON production_orders(archived_at DESC, id DESC) WHERE deleted_at IS NULL AND archived_at IS NOT NULL;
CREATE INDEX idx_production_tickets_order_column
	ON production_tickets(order_id, column_id, id);
CREATE INDEX idx_production_tickets_quote
	ON production_tickets(quote_id);

CREATE INDEX idx_quotes_updated_at ON quotes(updated_at DESC, id DESC);
CREATE INDEX idx_quote_filaments_quote ON quote_filaments(quote_id);
CREATE INDEX idx_quote_fixed_costs_quote ON quote_fixed_costs(quote_id);
