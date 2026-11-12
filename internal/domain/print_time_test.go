package domain

import (
	"math"
	"testing"
)

func TestParsePrintDuration(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		wantSeconds float64
		wantErr     bool
	}{
		{name: "days hours minutes", input: "2d6h55m", wantSeconds: 197700},
		{name: "hours and minutes", input: "1h57m", wantSeconds: 7020},
		{name: "minutes only", input: "2m", wantSeconds: 120},
		{name: "seconds only", input: "35s", wantSeconds: 35},
		{name: "spaces and uppercase units", input: " 2D 6H 55M ", wantSeconds: 197700},
		{name: "non-breaking space between units", input: "1h\u00a057m", wantErr: true},
		{name: "empty", input: "", wantErr: true},
		{name: "whitespace only", input: "  ", wantErr: true},
		{name: "repeated unit", input: "1h2h", wantErr: true},
		{name: "units out of order", input: "2m1h", wantErr: true},
		{name: "missing unit", input: "1h2", wantErr: true},
		{name: "fractional component", input: "1.5h", wantErr: true},
		{name: "negative duration", input: "-1h", wantErr: true},
		{name: "unknown unit", input: "1x", wantErr: true},
		{name: "zero duration", input: "0s", wantErr: true},
		{name: "unsafe duration", input: "999999999999999999999d", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParsePrintDuration(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ParsePrintDuration(%q) expected an error", tt.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParsePrintDuration(%q): %v", tt.input, err)
			}
			wantHours := tt.wantSeconds / 3600
			if math.Abs(got-wantHours) > 1e-12 {
				t.Fatalf("ParsePrintDuration(%q) = %.12f hours, want %.12f", tt.input, got, wantHours)
			}
		})
	}
}

func TestFormatPrintDuration(t *testing.T) {
	tests := []struct {
		name  string
		hours float64
		want  string
	}{
		{name: "days hours and minutes", hours: 197700.0 / 3600, want: "2d6h55m"},
		{name: "hours and minutes", hours: 1.95, want: "1h57m"},
		{name: "minutes only", hours: 2.0 / 60, want: "2m"},
		{name: "seconds only", hours: 35.0 / 3600, want: "35s"},
		{name: "legacy decimal hours", hours: 0.33, want: "19m48s"},
		{name: "zero", hours: 0, want: "0s"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := FormatPrintDuration(tt.hours); got != tt.want {
				t.Fatalf("FormatPrintDuration(%v) = %q, want %q", tt.hours, got, tt.want)
			}
		})
	}
}

func TestQuoteFormConvertsPrintTimes(t *testing.T) {
	form := QuoteEditor{
		Name:       "Teste",
		PrinterID:  1,
		TariffID:   2,
		Filaments:  []QuoteEditorFilament{{FilamentID: 3, PrintTime: "1h57m", WeightG: 20}},
		FixedCosts: []QuoteFixedCost{{CategoryID: 4, Value: 5}},
	}

	quote, err := QuoteFromEditor(form)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(quote.Filaments[0].PrintTimeHours-1.95) > 1e-12 {
		t.Fatalf("print time = %.12f hours, want 1.95", quote.Filaments[0].PrintTimeHours)
	}
	if quote.Filaments[0].WeightG != 20 || len(quote.FixedCosts) != 1 || quote.FixedCosts[0].Value != 5 {
		t.Fatalf("other quote values were not preserved: %+v", quote)
	}

	got := QuoteEditorFromQuote(quote)
	if got.Filaments[0].PrintTime != "1h57m" {
		t.Fatalf("formatted print time = %q, want 1h57m", got.Filaments[0].PrintTime)
	}
}

func TestQuoteFromFormRejectsInvalidPrintTime(t *testing.T) {
	_, err := QuoteFromEditor(QuoteEditor{
		Filaments: []QuoteEditorFilament{{FilamentID: 1, PrintTime: "2m1h", WeightG: 10}},
	})
	if err == nil {
		t.Fatal("QuoteFromForm accepted an invalid print duration")
	}
}
