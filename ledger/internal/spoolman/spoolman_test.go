package spoolman

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

const sampleSpools = `[
  {
    "id": 7,
    "archived": false,
    "price": 100.0,
    "filament": {"name": "PLA Preto", "material": "PLA", "color_hex": "000000", "weight": 1000, "price": 90.0}
  },
  {
    "id": 9,
    "archived": false,
    "price": null,
    "filament": {"name": "", "material": "PETG", "color_hex": "FF0000", "weight": 750, "price": 60.0}
  },
  {
    "id": 12,
    "archived": true,
    "price": 50.0,
    "filament": {"name": "Arquivado", "material": "PLA", "weight": 1000}
  }
]`

func newServer(t *testing.T) (*Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/spool" {
			w.Write([]byte(sampleSpools))
			return
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL}, srv
}

func TestSpools(t *testing.T) {
	c, _ := newServer(t)
	spools, err := c.Spools()
	if err != nil {
		t.Fatal(err)
	}
	if len(spools) != 3 {
		t.Fatalf("esperado 3 spools, obtido %d", len(spools))
	}
}

func TestBaseURLNormalizacao(t *testing.T) {
	for _, in := range []string{"http://x:8000/", "http://x:8000", "http://x:8000/api/v1", "http://x:8000/api/v1/"} {
		c := &Client{BaseURL: in}
		if got := c.spoolURL(); got != "http://x:8000/api/v1/spool" {
			t.Errorf("BaseURL %q → %q, esperado http://x:8000/api/v1/spool", in, got)
		}
	}
}

func TestFilaments(t *testing.T) {
	spools := []Spool{
		{ID: 7, Price: ptr(100), Filament: fil("PLA Preto", "PLA", "000000", 1000, ptr(90))},
		{ID: 9, Filament: fil("", "PETG", "FF0000", 750, ptr(60))},
		{ID: 12, Archived: true, Price: ptr(50), Filament: fil("Arquivado", "PLA", "", 1000, nil)},
	}

	fils := Filaments(spools)
	if len(fils) != 2 { // arquivados são ignorados
		t.Fatalf("esperado 2 filamentos, obtido %d", len(fils))
	}

	first := fils[0]
	if first.Name != "PLA Preto" || first.Material != "PLA" || first.Color != "#000000" {
		t.Errorf("filamento 1 divergente: %+v", first)
	}
	if first.PricePerKg != 100 { // spool.price 100 R$ / 1000 g → 100 R$/kg
		t.Errorf("preço/kg do spool.price: esperado 100, obtido %.2f", first.PricePerKg)
	}
	if first.Source != "spoolman" || first.SpoolmanID == nil || *first.SpoolmanID != 7 {
		t.Errorf("origem/id divergentes: %+v", first)
	}

	second := fils[1]
	if second.Name != "Spoolman #9" { // nome vazio → fallback
		t.Errorf("nome fallback divergente: %+v", second)
	}
	if second.PricePerKg != 80 { // spool.price null → filament.price 60 / 750 g → 80 R$/kg
		t.Errorf("preço/kg do filament.price: esperado 80, obtido %.2f", second.PricePerKg)
	}
}

func fil(name, material, color string, weight float64, filPrice *float64) Filament {
	f := Filament{Name: &name, Material: &material, Weight: &weight}
	if color != "" {
		f.ColorHex = &color
	}
	f.Price = filPrice
	return f
}

func ptr(f float64) *float64 { return &f }
