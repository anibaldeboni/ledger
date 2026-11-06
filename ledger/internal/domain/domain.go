// Package domain define as entidades e as regras de cálculo de orçamentos
// de impressão 3D (portadas do calc3d).
package domain

// Printer é uma impressora cadastrada.
type Printer struct {
	ID            int64   `json:"id"`
	Name          string  `json:"name"`
	PurchasePrice float64 `json:"purchasePrice"` // R$
	ResalePrice   float64 `json:"resalePrice"`   // R$ ao final da vida útil
	LifespanHours float64 `json:"lifespanHours"` // horas
	PowerWatts    float64 `json:"powerWatts"`    // W
}

// Tariff é uma bandeira tarifária de energia.
type Tariff struct {
	ID       int64   `json:"id"`
	Name     string  `json:"name"`
	KwhPrice float64 `json:"kwhPrice"` // R$/kWh
}

// Filament é um filamento do inventário (manual ou importado do Spoolman).
type Filament struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Material   string  `json:"material"`
	Color      string  `json:"color"` // hex, ex: #ff0000
	PricePerKg float64 `json:"pricePerKg"`
	Source     string  `json:"source"`     // "manual" | "spoolman"
	SpoolmanID *int64  `json:"spoolmanId"` // id do spool no Spoolman, se importado
}

// CostCategory é uma categoria de custo fixo reutilizável.
type CostCategory struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	DefaultValue float64 `json:"defaultValue"` // R$
}

// QuoteFilament é o uso de um filamento no orçamento.
type QuoteFilament struct {
	FilamentID     int64   `json:"filamentId"`
	PrintTimeHours float64 `json:"printTimeHours"`
	WeightG        float64 `json:"weightG"`
}

// QuoteFixedCost é um custo fixo aplicado ao orçamento.
type QuoteFixedCost struct {
	CategoryID int64   `json:"categoryId"`
	Value      float64 `json:"value"`
}

// Quote é um orçamento salvo. Timestamps em RFC3339.
type Quote struct {
	ID            int64            `json:"id"`
	Name          string           `json:"name"`
	PrinterID     int64            `json:"printerId"`
	TariffID      int64            `json:"tariffId"`
	MarginPercent float64          `json:"marginPercent"`
	Filaments     []QuoteFilament  `json:"filaments"`
	FixedCosts    []QuoteFixedCost `json:"fixedCosts"`
	FinalPrice    float64          `json:"finalPrice"`
	CreatedAt     string           `json:"createdAt"`
	UpdatedAt     string           `json:"updatedAt"`
}

// QuoteSummary é a linha da listagem de orçamentos.
type QuoteSummary struct {
	ID            int64   `json:"id"`
	Name          string  `json:"name"`
	FinalPrice    float64 `json:"finalPrice"`
	MarginPercent float64 `json:"marginPercent"`
	UpdatedAt     string  `json:"updatedAt"`
}
