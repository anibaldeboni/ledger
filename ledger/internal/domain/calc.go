package domain

// FilamentUsage é um filamento usado no cálculo: preço, peso e tempo.
type FilamentUsage struct {
	PricePerKg float64 // R$/kg
	WeightG    float64 // gramas
	TimeHours  float64 // horas
}

// FixedCost é um custo fixo aplicado ao cálculo.
type FixedCost struct {
	CategoryName string
	Value        float64
}

// CalcInput reúne as entradas do cálculo de um orçamento.
type CalcInput struct {
	PrinterPowerW   float64
	PrinterPurchase float64
	PrinterResale   float64
	LifespanHours   float64
	KwhPrice        float64
	Filaments       []FilamentUsage
	FixedCosts      []FixedCost
	MarginPercent   float64
}

// Costs é o detalhamento de custos e preço — mesmos campos exibidos no calc3d.
type Costs struct {
	Filament     float64 `json:"filament"`
	Energy       float64 `json:"energy"`
	Amortization float64 `json:"amortization"`
	FixedCosts   float64 `json:"fixedCosts"`
	TotalCost    float64 `json:"totalCost"`
	Profit       float64 `json:"profit"`
	FinalPrice   float64 `json:"finalPrice"`
}

// Calculate avalia as regras de negócio e retorna o detalhamento de custos e preço.
// Regras portadas do calc3d, adaptadas para múltiplos filamentos e amortização
// pela perda líquida (compra − revenda).
func Calculate(in CalcInput) Costs {
	// Filamento: Σ (Preço kg / 1000) × Gramas; Tempo total: Σ dos tempos
	var filamentCost, totalTime float64
	for _, f := range in.Filaments {
		filamentCost += (f.PricePerKg / 1000.0) * f.WeightG
		totalTime += f.TimeHours
	}

	// Energia: (Watts × Horas) / 1000 × Preço kWh
	energyCost := (in.PrinterPowerW * totalTime) / 1000.0 * in.KwhPrice

	// Amortização: ((Compra − Revenda) / Vida útil) × Horas
	// shortcut: perda líquida negativa ou vida útil 0 → 0, nunca custo negativo
	var amortizationCost float64
	if netLoss := in.PrinterPurchase - in.PrinterResale; netLoss > 0 && in.LifespanHours > 0 {
		amortizationCost = (netLoss / in.LifespanHours) * totalTime
	}

	// Custos Fixos
	var fixedCosts float64
	for _, fc := range in.FixedCosts {
		fixedCosts += fc.Value
	}

	// Custo Total
	totalCost := filamentCost + energyCost + amortizationCost + fixedCosts

	// Preço Final: Total / (1 − Margem/100); margem >= 100 → Total
	marginFactor := 1.0 - (in.MarginPercent / 100.0)
	finalPrice := totalCost
	if marginFactor > 0 {
		finalPrice = totalCost / marginFactor
	}

	return Costs{
		Filament:     filamentCost,
		Energy:       energyCost,
		Amortization: amortizationCost,
		FixedCosts:   fixedCosts,
		TotalCost:    totalCost,
		Profit:       finalPrice - totalCost,
		FinalPrice:   finalPrice,
	}
}
