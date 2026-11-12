package domain

// ProductionColumn is a user-visible Kanban stage. SystemKey stays stable when
// the user changes the stage name or position; custom columns have an empty key.
type ProductionColumn struct {
	ID        int64  `json:"id"`
	SystemKey string `json:"systemKey"`
	Name      string `json:"name"`
	Position  int64  `json:"position"`
}

// ProductionFilamentUsage is the current quote estimate for one filament.
type ProductionFilamentUsage struct {
	FilamentID     int64   `json:"filamentId"`
	Name           string  `json:"name"`
	PrintTimeHours float64 `json:"printTimeHours"`
	WeightG        float64 `json:"weightG"`
}

// ProductionTicket is one execution of a live-linked quote in an order.
type ProductionTicket struct {
	ID                  int64                     `json:"id"`
	OrderID             int64                     `json:"orderId"`
	QuoteID             int64                     `json:"quoteId"`
	QuoteName           string                    `json:"quoteName"`
	ColumnID            int64                     `json:"columnId"`
	EstimatedPrintHours float64                   `json:"estimatedPrintHours"`
	Filaments           []ProductionFilamentUsage `json:"filaments"`
	CreatedAt           string                    `json:"createdAt"`
	UpdatedAt           string                    `json:"updatedAt"`
}

// ProductionOrder groups quote tickets into one horizontal board lane.
type ProductionOrder struct {
	ID          int64              `json:"id"`
	Title       string             `json:"title"`
	CreatedAt   string             `json:"createdAt"`
	UpdatedAt   string             `json:"updatedAt"`
	CompletedAt string             `json:"completedAt"`
	ArchivedAt  string             `json:"archivedAt"`
	Tickets     []ProductionTicket `json:"tickets"`
}

// ProductionStageDuration is cumulative time spent by a ticket in one stage.
type ProductionStageDuration struct {
	ColumnID        int64  `json:"columnId"`
	ColumnName      string `json:"columnName"`
	Position        int64  `json:"position"`
	DurationSeconds int64  `json:"durationSeconds"`
}

// ProductionTicketReport contains one ticket's lifecycle and live quote estimates.
type ProductionTicketReport struct {
	TicketID            int64                     `json:"ticketId"`
	QuoteID             int64                     `json:"quoteId"`
	QuoteName           string                    `json:"quoteName"`
	EstimatedPrintHours float64                   `json:"estimatedPrintHours"`
	Filaments           []ProductionFilamentUsage `json:"filaments"`
	StageDurations      []ProductionStageDuration `json:"stageDurations"`
}

// ProductionOrderReport contains one completed order and its full lifecycle.
type ProductionOrderReport struct {
	OrderID              int64                     `json:"orderId"`
	Title                string                    `json:"title"`
	CreatedAt            string                    `json:"createdAt"`
	CompletedAt          string                    `json:"completedAt"`
	OrderDurationSeconds int64                     `json:"orderDurationSeconds"`
	EstimatedPrintHours  float64                   `json:"estimatedPrintHours"`
	Filaments            []ProductionFilamentUsage `json:"filaments"`
	Tickets              []ProductionTicketReport  `json:"tickets"`
}

// ProductionReport contains completed orders whose completion time is in range.
type ProductionReport struct {
	StartAt             string                  `json:"startAt"`
	EndAt               string                  `json:"endAt"`
	CancelledOrderCount int64                   `json:"cancelledOrderCount"`
	Orders              []ProductionOrderReport `json:"orders"`
}
