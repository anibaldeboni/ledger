CREATE INDEX idx_production_orders_deleted
	ON production_orders(deleted_at) WHERE deleted_at IS NOT NULL;
