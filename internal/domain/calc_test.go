package domain

import (
	"math"
	"testing"
)

func round(v float64) float64 { return math.Round(v*100) / 100 }

// Deve reproduzir o caso de referência do calc3d (revenda zero = regra original).
func TestCalculateCalc3dReference(t *testing.T) {
	c := Calculate(CalcInput{
		PrinterPowerW:   250,
		PrinterPurchase: 4500,
		PrinterResale:   0,
		LifespanHours:   5000,
		KwhPrice:        0.8,
		Filaments:       []FilamentUsage{{PricePerKg: 99, WeightG: 10, TimeHours: 1}},
		MarginPercent:   50,
	})

	if round(c.Filament) != 0.99 {
		t.Errorf("Filamento: esperado 0.99, obtido %.2f", c.Filament)
	}
	if round(c.Energy) != 0.20 {
		t.Errorf("Energia: esperado 0.20, obtido %.2f", c.Energy)
	}
	if round(c.Amortization) != 0.90 {
		t.Errorf("Amortização: esperado 0.90, obtido %.2f", c.Amortization)
	}
	if round(c.TotalCost) != 2.09 {
		t.Errorf("Custo total: esperado 2.09, obtido %.2f", c.TotalCost)
	}
	if round(c.FinalPrice) != 4.18 {
		t.Errorf("Preço final: esperado 4.18, obtido %.2f", c.FinalPrice)
	}
	if round(c.Profit) != 2.09 {
		t.Errorf("Lucro: esperado 2.09, obtido %.2f", c.Profit)
	}
}

// Multi-filamento: custos somados por filamento, tempo total soma dos tempos.
func TestCalculateMultiFilament(t *testing.T) {
	c := Calculate(CalcInput{
		PrinterPowerW:   250,
		PrinterPurchase: 4500,
		PrinterResale:   500,
		LifespanHours:   5000,
		KwhPrice:        0.8,
		Filaments: []FilamentUsage{
			{PricePerKg: 99, WeightG: 10, TimeHours: 1},
			{PricePerKg: 120, WeightG: 25, TimeHours: 0.5},
		},
		FixedCosts: []FixedCost{
			{CategoryName: "Mão de Obra", Value: 2},
			{CategoryName: "Embalagem", Value: 1},
		},
		MarginPercent: 50,
	})

	if round(c.Filament) != 3.99 { // 0.99 + 3.00
		t.Errorf("Filamento: esperado 3.99, obtido %.2f", c.Filament)
	}
	if round(c.Energy) != 0.30 { // 250W * 1.5h / 1000 * 0.8
		t.Errorf("Energia: esperado 0.30, obtido %.2f", c.Energy)
	}
	if round(c.Amortization) != 1.20 { // (4500-500)/5000 * 1.5
		t.Errorf("Amortização: esperado 1.20, obtido %.2f", c.Amortization)
	}
	if round(c.FixedCosts) != 3 {
		t.Errorf("Custos fixos: esperado 3.00, obtido %.2f", c.FixedCosts)
	}
	if round(c.TotalCost) != 8.49 {
		t.Errorf("Custo total: esperado 8.49, obtido %.2f", c.TotalCost)
	}
	if round(c.FinalPrice) != 16.98 {
		t.Errorf("Preço final: esperado 16.98, obtido %.2f", c.FinalPrice)
	}
}

// Margem >= 100 não pode dividir por zero/negativo: preço final = custo total.
func TestCalculateMargem100(t *testing.T) {
	c := Calculate(CalcInput{
		PrinterPowerW: 250, PrinterPurchase: 4500, LifespanHours: 5000, KwhPrice: 0.8,
		Filaments:     []FilamentUsage{{PricePerKg: 99, WeightG: 10, TimeHours: 1}},
		MarginPercent: 100,
	})
	if round(c.FinalPrice) != round(c.TotalCost) {
		t.Errorf("Margem 100: preço final deveria igualar o custo total (%.2f), obtido %.2f", c.TotalCost, c.FinalPrice)
	}
}

// Revenda maior que a compra não gera amortização negativa.
func TestCalculateRevendaMaiorQueCompra(t *testing.T) {
	c := Calculate(CalcInput{
		PrinterPowerW: 250, PrinterPurchase: 1000, PrinterResale: 2000, LifespanHours: 5000, KwhPrice: 0.8,
		Filaments: []FilamentUsage{{PricePerKg: 99, WeightG: 10, TimeHours: 1}},
	})
	if c.Amortization != 0 {
		t.Errorf("Amortização deveria ser 0, obtido %.2f", c.Amortization)
	}
}

// Vida útil zero não pode dividir por zero.
func TestCalculateVidaUtilZero(t *testing.T) {
	c := Calculate(CalcInput{
		PrinterPowerW: 250, PrinterPurchase: 4500, LifespanHours: 0, KwhPrice: 0.8,
		Filaments: []FilamentUsage{{PricePerKg: 99, WeightG: 10, TimeHours: 1}},
	})
	if c.Amortization != 0 {
		t.Errorf("Amortização com vida útil 0 deveria ser 0, obtido %.2f", c.Amortization)
	}
}
