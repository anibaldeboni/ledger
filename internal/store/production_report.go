package store

import (
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"time"

	"ledger/internal/domain"
)

type productionTicketLocation struct {
	orderIndex  int
	ticketIndex int
}

// GenerateProductionReport selects completed orders by completion time and
// reports their full order, ticket, stage, and current quote estimates.
func (s *Store) GenerateProductionReport(startAt, endAt string) (domain.ProductionReport, error) {
	start, err := time.Parse(time.RFC3339, startAt)
	if err != nil {
		return domain.ProductionReport{}, errors.New("invalid production report start time")
	}
	end, err := time.Parse(time.RFC3339, endAt)
	if err != nil || !start.Before(end) {
		return domain.ProductionReport{}, errors.New("invalid production report time range")
	}
	startAt = start.UTC().Format(time.RFC3339)
	endAt = end.UTC().Format(time.RFC3339)

	tx, err := s.db.Begin()
	if err != nil {
		return domain.ProductionReport{}, err
	}
	defer tx.Rollback()
	report := domain.ProductionReport{StartAt: startAt, EndAt: endAt, Orders: []domain.ProductionOrderReport{}}
	if err := tx.QueryRow(`SELECT COUNT(*) FROM production_orders WHERE deleted_at >= ? AND deleted_at < ?`, startAt, endAt).Scan(&report.CancelledOrderCount); err != nil {
		return domain.ProductionReport{}, err
	}
	orderPositions := make(map[int64]int)
	ticketPositions := make(map[int64]productionTicketLocation)
	orderFilamentPositions := make(map[int64]map[int64]int)
	ticketFilamentPositions := make(map[int64]map[int64]int)

	rows, err := tx.Query(`
		SELECT o.id, o.title, o.created_at, o.completed_at,
			t.id, t.quote_id, q.name, qf.filament_id, f.name, qf.print_time_hours, qf.weight_g
		FROM production_orders o
		LEFT JOIN production_tickets t ON t.order_id = o.id
		LEFT JOIN quotes q ON q.id = t.quote_id
		LEFT JOIN quote_filaments qf ON qf.quote_id = q.id
		LEFT JOIN filaments f ON f.id = qf.filament_id
		WHERE o.deleted_at IS NULL AND o.completed_at >= ? AND o.completed_at < ?
		ORDER BY o.completed_at DESC, o.id DESC, t.id, qf.id`, startAt, endAt)
	if err != nil {
		return domain.ProductionReport{}, err
	}
	for rows.Next() {
		var orderID int64
		var title, createdAt, completedAt string
		var ticketID, quoteID, filamentID sql.NullInt64
		var quoteName, filamentName sql.NullString
		var printTime, weight sql.NullFloat64
		if err := rows.Scan(
			&orderID, &title, &createdAt, &completedAt,
			&ticketID, &quoteID, &quoteName, &filamentID, &filamentName, &printTime, &weight,
		); err != nil {
			rows.Close()
			return domain.ProductionReport{}, err
		}
		orderPosition, ok := orderPositions[orderID]
		if !ok {
			created, parseErr := time.Parse(time.RFC3339, createdAt)
			if parseErr != nil {
				rows.Close()
				return domain.ProductionReport{}, fmt.Errorf("order %d has an invalid creation timestamp: %w", orderID, parseErr)
			}
			completed, parseErr := time.Parse(time.RFC3339, completedAt)
			if parseErr != nil || completed.Before(created) {
				rows.Close()
				return domain.ProductionReport{}, fmt.Errorf("order %d has an invalid completion timestamp", orderID)
			}
			order := domain.ProductionOrderReport{
				OrderID:              orderID,
				Title:                title,
				CreatedAt:            createdAt,
				CompletedAt:          completedAt,
				OrderDurationSeconds: int64(completed.Sub(created).Seconds()),
				Filaments:            []domain.ProductionFilamentUsage{},
				Tickets:              []domain.ProductionTicketReport{},
			}
			report.Orders = append(report.Orders, order)
			orderPosition = len(report.Orders) - 1
			orderPositions[orderID] = orderPosition
			orderFilamentPositions[orderID] = make(map[int64]int)
		}
		if !ticketID.Valid {
			continue
		}

		location, ok := ticketPositions[ticketID.Int64]
		if !ok {
			ticket := domain.ProductionTicketReport{
				TicketID:       ticketID.Int64,
				QuoteID:        quoteID.Int64,
				QuoteName:      quoteName.String,
				Filaments:      []domain.ProductionFilamentUsage{},
				StageDurations: []domain.ProductionStageDuration{},
			}
			report.Orders[orderPosition].Tickets = append(report.Orders[orderPosition].Tickets, ticket)
			location = productionTicketLocation{orderIndex: orderPosition, ticketIndex: len(report.Orders[orderPosition].Tickets) - 1}
			ticketPositions[ticketID.Int64] = location
			ticketFilamentPositions[ticketID.Int64] = make(map[int64]int)
		}
		if !filamentID.Valid {
			continue
		}

		hours := printTime.Float64
		grams := weight.Float64
		order := &report.Orders[location.orderIndex]
		ticket := &order.Tickets[location.ticketIndex]
		ticket.EstimatedPrintHours += hours
		order.EstimatedPrintHours += hours
		addProductionFilament(&ticket.Filaments, ticketFilamentPositions[ticketID.Int64], filamentID.Int64, filamentName.String, hours, grams)
		addProductionFilament(&order.Filaments, orderFilamentPositions[orderID], filamentID.Int64, filamentName.String, hours, grams)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return domain.ProductionReport{}, err
	}
	if err := rows.Close(); err != nil {
		return domain.ProductionReport{}, err
	}

	rows, err = tx.Query(`
		SELECT h.ticket_id, h.column_id, c.name, c.position, h.entered_at, h.exited_at, o.completed_at
		FROM production_orders o
		JOIN production_tickets t ON t.order_id = o.id
		JOIN production_ticket_stage_history h ON h.ticket_id = t.id
		JOIN production_columns c ON c.id = h.column_id
		WHERE o.deleted_at IS NULL AND o.completed_at >= ? AND o.completed_at < ?
		ORDER BY o.id, t.id, h.entered_at, h.id`, startAt, endAt)
	if err != nil {
		return domain.ProductionReport{}, err
	}
	stagePositions := make(map[int64]map[int64]int)
	for rows.Next() {
		var ticketID, columnID, position int64
		var name, enteredAt, completedAt string
		var exitedAt sql.NullString
		if err := rows.Scan(&ticketID, &columnID, &name, &position, &enteredAt, &exitedAt, &completedAt); err != nil {
			rows.Close()
			return domain.ProductionReport{}, err
		}
		location, ok := ticketPositions[ticketID]
		if !ok {
			continue
		}
		entered, parseErr := time.Parse(time.RFC3339, enteredAt)
		if parseErr != nil {
			rows.Close()
			return domain.ProductionReport{}, fmt.Errorf("ticket %d has an invalid stage entry timestamp: %w", ticketID, parseErr)
		}
		endedAt := completedAt
		if exitedAt.Valid {
			endedAt = exitedAt.String
		}
		ended, parseErr := time.Parse(time.RFC3339, endedAt)
		if parseErr != nil || ended.Before(entered) {
			rows.Close()
			return domain.ProductionReport{}, fmt.Errorf("ticket %d has an invalid stage interval", ticketID)
		}

		ticket := &report.Orders[location.orderIndex].Tickets[location.ticketIndex]
		if stagePositions[ticketID] == nil {
			stagePositions[ticketID] = make(map[int64]int)
		}
		if stagePosition, ok := stagePositions[ticketID][columnID]; ok {
			ticket.StageDurations[stagePosition].DurationSeconds += int64(ended.Sub(entered).Seconds())
		} else {
			stagePositions[ticketID][columnID] = len(ticket.StageDurations)
			ticket.StageDurations = append(ticket.StageDurations, domain.ProductionStageDuration{
				ColumnID:        columnID,
				ColumnName:      name,
				Position:        position,
				DurationSeconds: int64(ended.Sub(entered).Seconds()),
			})
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return domain.ProductionReport{}, err
	}
	if err := rows.Close(); err != nil {
		return domain.ProductionReport{}, err
	}
	for orderIndex := range report.Orders {
		for ticketIndex := range report.Orders[orderIndex].Tickets {
			sort.Slice(report.Orders[orderIndex].Tickets[ticketIndex].StageDurations, func(i, j int) bool {
				return report.Orders[orderIndex].Tickets[ticketIndex].StageDurations[i].Position < report.Orders[orderIndex].Tickets[ticketIndex].StageDurations[j].Position
			})
		}
	}
	if err := tx.Commit(); err != nil {
		return domain.ProductionReport{}, err
	}
	return report, nil
}

func addProductionFilament(usages *[]domain.ProductionFilamentUsage, positions map[int64]int, id int64, name string, hours, grams float64) {
	if position, ok := positions[id]; ok {
		(*usages)[position].PrintTimeHours += hours
		(*usages)[position].WeightG += grams
		return
	}
	positions[id] = len(*usages)
	*usages = append(*usages, domain.ProductionFilamentUsage{
		FilamentID:     id,
		Name:           name,
		PrintTimeHours: hours,
		WeightG:        grams,
	})
}
