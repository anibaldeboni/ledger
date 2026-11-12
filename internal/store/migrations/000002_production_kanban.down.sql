-- Destructive rollback: this removes all production orders, tickets, and stage history.
DROP INDEX idx_quote_fixed_costs_quote;
DROP INDEX idx_quote_filaments_quote;
DROP INDEX idx_quotes_updated_at;
DROP INDEX idx_production_tickets_quote;
DROP INDEX idx_production_tickets_order_column;
DROP INDEX idx_production_orders_archived;
DROP INDEX idx_production_orders_completed;
DROP INDEX idx_production_orders_active_created;
DROP INDEX idx_production_columns_position;
DROP INDEX idx_production_ticket_stage_history_column;
DROP INDEX idx_production_ticket_stage_history_ticket;
DROP INDEX idx_production_ticket_stage_history_open;

DROP TABLE production_ticket_stage_history;
DROP TABLE production_tickets;
DROP TABLE production_columns;
DROP TABLE production_orders;
