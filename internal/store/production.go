package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"ledger/internal/domain"
)

var (
	ErrProductionColumnHasTickets      = errors.New("Não é possível excluir esta coluna porque ela contém tickets.")
	ErrProductionCompletionColumn      = errors.New("A coluna de conclusão é obrigatória e não pode ser excluída.")
	ErrProductionOrderNotComplete      = errors.New("Somente pedidos concluídos podem ser arquivados.")
	ErrProductionOrderUnavailable      = errors.New("Este pedido não está disponível para produção.")
	ErrProductionOrderAlreadyCompleted = errors.New("Este pedido já está concluído.")
	ErrProductionQuoteLinked           = errors.New("Não é possível excluir este orçamento porque ele está vinculado a um pedido.")
)

func productionNow() string { return time.Now().UTC().Format(time.RFC3339) }

// ListProductionColumns returns visible stages in board order.
func (s *Store) ListProductionColumns() ([]domain.ProductionColumn, error) {
	rows, err := s.db.Query(`
		SELECT id, COALESCE(system_key, ''), name, position
		FROM production_columns
		WHERE deleted_at IS NULL
		ORDER BY position, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]domain.ProductionColumn, 0)
	for rows.Next() {
		var column domain.ProductionColumn
		if err := rows.Scan(&column.ID, &column.SystemKey, &column.Name, &column.Position); err != nil {
			return nil, err
		}
		columns = append(columns, column)
	}
	return columns, rows.Err()
}

// SaveProductionColumn creates a custom stage or renames an existing one.
func (s *Store) SaveProductionColumn(column *domain.ProductionColumn) error {
	column.Name = strings.TrimSpace(column.Name)
	if column.Name == "" {
		return errors.New("O nome da coluna é obrigatório.")
	}
	if column.ID == 0 {
		var position int64
		if err := s.db.QueryRow(`SELECT COALESCE(MAX(position) + 1, 0) FROM production_columns WHERE deleted_at IS NULL`).Scan(&position); err != nil {
			return err
		}
		result, err := s.db.Exec(`INSERT INTO production_columns (system_key, name, position) VALUES (NULL, ?, ?)`, column.Name, position)
		if err != nil {
			return err
		}
		column.ID, err = result.LastInsertId()
		column.Position = position
		return err
	}

	result, err := s.db.Exec(`UPDATE production_columns SET name = ? WHERE id = ? AND deleted_at IS NULL`, column.Name, column.ID)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ReorderProductionColumns requires every visible column exactly once.
func (s *Store) ReorderProductionColumns(ids []int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	rows, err := tx.Query(`SELECT id FROM production_columns WHERE deleted_at IS NULL`)
	if err != nil {
		return err
	}
	valid := make(map[int64]bool)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		valid[id] = true
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	if len(ids) != len(valid) {
		return errors.New("A ordem deve incluir todas as colunas visíveis uma única vez.")
	}
	seen := make(map[int64]bool, len(ids))
	for position, id := range ids {
		if !valid[id] || seen[id] {
			return errors.New("A ordem contém uma coluna inválida ou repetida.")
		}
		seen[id] = true
		if _, err := tx.Exec(`UPDATE production_columns SET position = ? WHERE id = ? AND deleted_at IS NULL`, position, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// DeleteProductionColumn hides an empty custom stage while retaining its history.
func (s *Store) DeleteProductionColumn(id int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var key sql.NullString
	if err := tx.QueryRow(`SELECT system_key FROM production_columns WHERE id = ? AND deleted_at IS NULL`, id).Scan(&key); err != nil {
		return err
	}
	if key.Valid && key.String == "completed" {
		return ErrProductionCompletionColumn
	}
	var occupied bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM production_tickets WHERE column_id = ?)`, id).Scan(&occupied); err != nil {
		return err
	}
	if occupied {
		return ErrProductionColumnHasTickets
	}
	if _, err := tx.Exec(`UPDATE production_columns SET deleted_at = ? WHERE id = ?`, productionNow(), id); err != nil {
		return err
	}
	return tx.Commit()
}

// CreateProductionOrder creates an identifiable production lane.
func (s *Store) CreateProductionOrder(title string) (domain.ProductionOrder, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return domain.ProductionOrder{}, errors.New("O nome do pedido é obrigatório.")
	}
	now := productionNow()
	result, err := s.db.Exec(`INSERT INTO production_orders (title, created_at, updated_at) VALUES (?, ?, ?)`, title, now, now)
	if err != nil {
		return domain.ProductionOrder{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return domain.ProductionOrder{}, err
	}
	return domain.ProductionOrder{ID: id, Title: title, CreatedAt: now, UpdatedAt: now, Tickets: []domain.ProductionTicket{}}, nil
}

// UpdateProductionOrderTitle renames an unarchived production order.
func (s *Store) UpdateProductionOrderTitle(id int64, title string) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return errors.New("O nome do pedido é obrigatório.")
	}
	result, err := s.db.Exec(`
		UPDATE production_orders SET title = ?, updated_at = ?
		WHERE id = ? AND deleted_at IS NULL AND archived_at IS NULL`, title, productionNow(), id)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ListProductionOrders returns non-deleted, non-archived orders for the board.
func (s *Store) ListProductionOrders() ([]domain.ProductionOrder, error) {
	return s.listProductionOrders(false)
}

// ListArchivedProductionOrders returns archived orders for the archive screen.
func (s *Store) ListArchivedProductionOrders() ([]domain.ProductionOrder, error) {
	return s.listProductionOrders(true)
}

func (s *Store) listProductionOrders(archived bool) ([]domain.ProductionOrder, error) {
	filter := `o.deleted_at IS NULL AND o.archived_at IS NULL`
	orderBy := `o.created_at DESC, o.id DESC`
	if archived {
		filter = `o.deleted_at IS NULL AND o.archived_at IS NOT NULL`
		orderBy = `o.archived_at DESC, o.id DESC`
	}
	query := fmt.Sprintf(`
		SELECT o.id, o.title, o.created_at, o.updated_at, o.completed_at, o.archived_at,
			t.id, t.quote_id, t.column_id, t.created_at, t.updated_at, q.name,
			qf.filament_id, f.name, qf.print_time_hours, qf.weight_g
		FROM production_orders o
		LEFT JOIN production_tickets t ON t.order_id = o.id
		LEFT JOIN quotes q ON q.id = t.quote_id
		LEFT JOIN quote_filaments qf ON qf.quote_id = q.id
		LEFT JOIN filaments f ON f.id = qf.filament_id
		WHERE %s
		ORDER BY %s, t.id, qf.id`, filter, orderBy)
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]domain.ProductionOrder, 0)
	orderPositions := make(map[int64]int)
	ticketPositions := make(map[int64]int)
	filamentPositions := make(map[int64]map[int64]int)
	for rows.Next() {
		var orderID int64
		var order domain.ProductionOrder
		var completedAt, archivedAt sql.NullString
		var ticketID, quoteID, columnID sql.NullInt64
		var ticketCreatedAt, ticketUpdatedAt, quoteName sql.NullString
		var filamentID sql.NullInt64
		var filamentLabel sql.NullString
		var printTime, weight sql.NullFloat64
		if err := rows.Scan(
			&orderID, &order.Title, &order.CreatedAt, &order.UpdatedAt, &completedAt, &archivedAt,
			&ticketID, &quoteID, &columnID, &ticketCreatedAt, &ticketUpdatedAt, &quoteName,
			&filamentID, &filamentLabel, &printTime, &weight,
		); err != nil {
			return nil, err
		}
		order.ID = orderID
		order.CompletedAt = completedAt.String
		order.ArchivedAt = archivedAt.String
		if _, ok := orderPositions[orderID]; !ok {
			order.Tickets = []domain.ProductionTicket{}
			orderPositions[orderID] = len(orders)
			orders = append(orders, order)
		}
		if !ticketID.Valid {
			continue
		}

		orderPosition := orderPositions[orderID]
		if _, ok := ticketPositions[ticketID.Int64]; !ok {
			ticket := domain.ProductionTicket{
				ID:        ticketID.Int64,
				OrderID:   orderID,
				QuoteID:   quoteID.Int64,
				QuoteName: quoteName.String,
				ColumnID:  columnID.Int64,
				CreatedAt: ticketCreatedAt.String,
				UpdatedAt: ticketUpdatedAt.String,
				Filaments: []domain.ProductionFilamentUsage{},
			}
			orders[orderPosition].Tickets = append(orders[orderPosition].Tickets, ticket)
			ticketPositions[ticketID.Int64] = len(orders[orderPosition].Tickets) - 1
			filamentPositions[ticketID.Int64] = make(map[int64]int)
		}
		if !filamentID.Valid {
			continue
		}

		ticket := &orders[orderPosition].Tickets[ticketPositions[ticketID.Int64]]
		ticket.EstimatedPrintHours += printTime.Float64
		if position, ok := filamentPositions[ticketID.Int64][filamentID.Int64]; ok {
			ticket.Filaments[position].PrintTimeHours += printTime.Float64
			ticket.Filaments[position].WeightG += weight.Float64
		} else {
			filamentPositions[ticketID.Int64][filamentID.Int64] = len(ticket.Filaments)
			ticket.Filaments = append(ticket.Filaments, domain.ProductionFilamentUsage{
				FilamentID:     filamentID.Int64,
				Name:           filamentLabel.String,
				PrintTimeHours: printTime.Float64,
				WeightG:        weight.Float64,
			})
		}
	}
	return orders, rows.Err()
}

// AddProductionTicket adds one execution of an existing quote to an order.
func (s *Store) AddProductionTicket(orderID, quoteID int64) (domain.ProductionTicket, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return domain.ProductionTicket{}, err
	}
	defer tx.Rollback()

	var archivedAt, deletedAt, completedAt sql.NullString
	if err := tx.QueryRow(`SELECT archived_at, deleted_at, completed_at FROM production_orders WHERE id = ?`, orderID).Scan(&archivedAt, &deletedAt, &completedAt); err != nil {
		return domain.ProductionTicket{}, err
	}
	if archivedAt.Valid || deletedAt.Valid {
		return domain.ProductionTicket{}, ErrProductionOrderUnavailable
	}
	if completedAt.Valid {
		return domain.ProductionTicket{}, ErrProductionOrderAlreadyCompleted
	}

	var columnID int64
	if err := tx.QueryRow(`
		SELECT id FROM production_columns WHERE deleted_at IS NULL
		ORDER BY CASE WHEN system_key = 'todo' THEN 0 ELSE 1 END, position, id LIMIT 1`).Scan(&columnID); err != nil {
		return domain.ProductionTicket{}, err
	}
	quoteName, filaments, printHours, err := loadProductionQuote(tx, quoteID)
	if err != nil {
		return domain.ProductionTicket{}, err
	}
	now := productionNow()
	result, err := tx.Exec(`
		INSERT INTO production_tickets (order_id, quote_id, column_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`, orderID, quoteID, columnID, now, now)
	if err != nil {
		return domain.ProductionTicket{}, err
	}
	ticketID, err := result.LastInsertId()
	if err != nil {
		return domain.ProductionTicket{}, err
	}
	if _, err := tx.Exec(`INSERT INTO production_ticket_stage_history (ticket_id, column_id, entered_at) VALUES (?, ?, ?)`, ticketID, columnID, now); err != nil {
		return domain.ProductionTicket{}, err
	}
	if _, err := tx.Exec(`UPDATE production_orders SET updated_at = ? WHERE id = ?`, now, orderID); err != nil {
		return domain.ProductionTicket{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.ProductionTicket{}, err
	}
	return domain.ProductionTicket{
		ID:                  ticketID,
		OrderID:             orderID,
		QuoteID:             quoteID,
		QuoteName:           quoteName,
		ColumnID:            columnID,
		EstimatedPrintHours: printHours,
		Filaments:           filaments,
		CreatedAt:           now,
		UpdatedAt:           now,
	}, nil
}

func loadProductionQuote(tx *sql.Tx, quoteID int64) (string, []domain.ProductionFilamentUsage, float64, error) {
	var name string
	if err := tx.QueryRow(`SELECT name FROM quotes WHERE id = ?`, quoteID).Scan(&name); err != nil {
		return "", nil, 0, err
	}
	rows, err := tx.Query(`
		SELECT qf.filament_id, f.name, qf.print_time_hours, qf.weight_g
		FROM quote_filaments qf
	JOIN filaments f ON f.id = qf.filament_id
		WHERE qf.quote_id = ?
		ORDER BY qf.id`, quoteID)
	if err != nil {
		return "", nil, 0, err
	}
	defer rows.Close()
	filaments := make([]domain.ProductionFilamentUsage, 0)
	positions := make(map[int64]int)
	var printHours float64
	for rows.Next() {
		var filamentID int64
		var filamentName string
		var hours, weight float64
		if err := rows.Scan(&filamentID, &filamentName, &hours, &weight); err != nil {
			return "", nil, 0, err
		}
		printHours += hours
		if position, ok := positions[filamentID]; ok {
			filaments[position].PrintTimeHours += hours
			filaments[position].WeightG += weight
		} else {
			positions[filamentID] = len(filaments)
			filaments = append(filaments, domain.ProductionFilamentUsage{
				FilamentID:     filamentID,
				Name:           filamentName,
				PrintTimeHours: hours,
				WeightG:        weight,
			})
		}
	}
	return name, filaments, printHours, rows.Err()
}

// MoveProductionTicket records a stage transition and reopens a completed order
// if the user resumes production before archiving it.
func (s *Store) MoveProductionTicket(ticketID, columnID int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var orderID, currentColumnID int64
	var completedAt, archivedAt, deletedAt sql.NullString
	if err := tx.QueryRow(`
		SELECT t.order_id, t.column_id, o.completed_at, o.archived_at, o.deleted_at
		FROM production_tickets t JOIN production_orders o ON o.id = t.order_id
		WHERE t.id = ?`, ticketID).Scan(&orderID, &currentColumnID, &completedAt, &archivedAt, &deletedAt); err != nil {
		return err
	}
	if archivedAt.Valid || deletedAt.Valid {
		return ErrProductionOrderUnavailable
	}
	var targetExists bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM production_columns WHERE id = ? AND deleted_at IS NULL)`, columnID).Scan(&targetExists); err != nil {
		return err
	}
	if !targetExists {
		return sql.ErrNoRows
	}
	if currentColumnID == columnID {
		return tx.Commit()
	}
	now := productionNow()
	if completedAt.Valid {
		if _, err := tx.Exec(`UPDATE production_orders SET completed_at = NULL WHERE id = ?`, orderID); err != nil {
			return err
		}
		rows, err := tx.Query(`SELECT id, column_id FROM production_tickets WHERE order_id = ? AND id <> ?`, orderID, ticketID)
		if err != nil {
			return err
		}
		var otherTickets [][2]int64
		for rows.Next() {
			var id, currentID int64
			if err := rows.Scan(&id, &currentID); err != nil {
				rows.Close()
				return err
			}
			otherTickets = append(otherTickets, [2]int64{id, currentID})
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return err
		}
		rows.Close()
		for _, other := range otherTickets {
			if _, err := tx.Exec(`INSERT INTO production_ticket_stage_history (ticket_id, column_id, entered_at) VALUES (?, ?, ?)`, other[0], other[1], now); err != nil {
				return err
			}
		}
	} else {
		result, err := tx.Exec(`UPDATE production_ticket_stage_history SET exited_at = ? WHERE ticket_id = ? AND exited_at IS NULL`, now, ticketID)
		if err != nil {
			return err
		}
		if affected, _ := result.RowsAffected(); affected != 1 {
			return fmt.Errorf("ticket %d has no open stage history", ticketID)
		}
	}
	if _, err := tx.Exec(`UPDATE production_tickets SET column_id = ?, updated_at = ? WHERE id = ?`, columnID, now, ticketID); err != nil {
		return err
	}
	if _, err := tx.Exec(`INSERT INTO production_ticket_stage_history (ticket_id, column_id, entered_at) VALUES (?, ?, ?)`, ticketID, columnID, now); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE production_orders SET updated_at = ? WHERE id = ?`, now, orderID); err != nil {
		return err
	}
	return tx.Commit()
}

// DeleteProductionOrder soft-deletes an order without removing report history.
func (s *Store) DeleteProductionOrder(id int64) error {
	now := productionNow()
	result, err := s.db.Exec(`
		UPDATE production_orders SET deleted_at = ?, updated_at = ?
		WHERE id = ? AND deleted_at IS NULL`, now, now, id)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CompleteProductionOrder records completion and stops active stage clocks.
func (s *Store) CompleteProductionOrder(id int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var completedAt, archivedAt, deletedAt sql.NullString
	if err := tx.QueryRow(`SELECT completed_at, archived_at, deleted_at FROM production_orders WHERE id = ?`, id).Scan(&completedAt, &archivedAt, &deletedAt); err != nil {
		return err
	}
	if archivedAt.Valid || deletedAt.Valid {
		return ErrProductionOrderUnavailable
	}
	if completedAt.Valid {
		return tx.Commit()
	}
	now := productionNow()
	if _, err := tx.Exec(`UPDATE production_orders SET completed_at = ?, updated_at = ? WHERE id = ?`, now, now, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`
		UPDATE production_ticket_stage_history SET exited_at = ?
		WHERE exited_at IS NULL AND ticket_id IN (SELECT id FROM production_tickets WHERE order_id = ?)`, now, id); err != nil {
		return err
	}
	return tx.Commit()
}

// ArchiveProductionOrder hides a completed order from the active board.
func (s *Store) ArchiveProductionOrder(id int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var completedAt, archivedAt, deletedAt sql.NullString
	if err := tx.QueryRow(`SELECT completed_at, archived_at, deleted_at FROM production_orders WHERE id = ?`, id).Scan(&completedAt, &archivedAt, &deletedAt); err != nil {
		return err
	}
	if deletedAt.Valid || archivedAt.Valid {
		return ErrProductionOrderUnavailable
	}
	if !completedAt.Valid {
		return ErrProductionOrderNotComplete
	}
	now := productionNow()
	if _, err := tx.Exec(`UPDATE production_orders SET archived_at = ?, updated_at = ? WHERE id = ?`, now, now, id); err != nil {
		return err
	}
	return tx.Commit()
}
