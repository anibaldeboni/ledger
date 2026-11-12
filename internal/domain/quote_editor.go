package domain

import "fmt"

// QuoteEditor is the Wails form DTO; print times stay in slicer notation here.
type QuoteEditor struct {
	ID            int64                 `json:"id"`
	Name          string                `json:"name"`
	PrinterID     int64                 `json:"printerId"`
	TariffID      int64                 `json:"tariffId"`
	MarginPercent float64               `json:"marginPercent"`
	Filaments     []QuoteEditorFilament `json:"filaments"`
	FixedCosts    []QuoteFixedCost      `json:"fixedCosts"`
	FinalPrice    float64               `json:"finalPrice"`
	CreatedAt     string                `json:"createdAt"`
	UpdatedAt     string                `json:"updatedAt"`
}

// QuoteEditorFilament carries the user-entered duration before domain conversion.
type QuoteEditorFilament struct {
	FilamentID int64   `json:"filamentId"`
	PrintTime  string  `json:"printTime"`
	WeightG    float64 `json:"weightG"`
}

// QuoteFromEditor converts a Wails form DTO into the decimal-hour domain model.
func QuoteFromEditor(editor QuoteEditor) (Quote, error) {
	quote := Quote{
		ID:            editor.ID,
		Name:          editor.Name,
		PrinterID:     editor.PrinterID,
		TariffID:      editor.TariffID,
		MarginPercent: editor.MarginPercent,
		FixedCosts:    editor.FixedCosts,
		FinalPrice:    editor.FinalPrice,
		CreatedAt:     editor.CreatedAt,
		UpdatedAt:     editor.UpdatedAt,
	}
	for i, filament := range editor.Filaments {
		hours, err := ParsePrintDuration(filament.PrintTime)
		if err != nil {
			return Quote{}, fmt.Errorf("filamento %d: %w", i+1, err)
		}
		quote.Filaments = append(quote.Filaments, QuoteFilament{
			FilamentID:     filament.FilamentID,
			PrintTimeHours: hours,
			WeightG:        filament.WeightG,
		})
	}
	return quote, nil
}

// QuoteEditorFromQuote formats persisted decimal hours for the Wails form.
func QuoteEditorFromQuote(quote Quote) QuoteEditor {
	editor := QuoteEditor{
		ID:            quote.ID,
		Name:          quote.Name,
		PrinterID:     quote.PrinterID,
		TariffID:      quote.TariffID,
		MarginPercent: quote.MarginPercent,
		FixedCosts:    quote.FixedCosts,
		FinalPrice:    quote.FinalPrice,
		CreatedAt:     quote.CreatedAt,
		UpdatedAt:     quote.UpdatedAt,
	}
	for _, filament := range quote.Filaments {
		editor.Filaments = append(editor.Filaments, QuoteEditorFilament{
			FilamentID: filament.FilamentID,
			PrintTime:  FormatPrintDuration(filament.PrintTimeHours),
			WeightG:    filament.WeightG,
		})
	}
	return editor
}
