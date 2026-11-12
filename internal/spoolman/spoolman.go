// Package spoolman consulta a API do Spoolman (https://donkie.github.io/Spoolman/).
package spoolman

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"ledger/internal/domain"
)

// Filament são os campos do filament do spool que usamos.
type Filament struct {
	Name     *string
	Material *string
	ColorHex *string `json:"color_hex"`
	Weight   *float64
	Price    *float64
}

// Spool é um spool retornado por GET /api/v1/spool.
type Spool struct {
	ID              int64
	Archived        bool
	RemainingWeight *float64 `json:"remaining_weight"`
	Price           *float64
	Filament        Filament
}

// Client acessa uma instância do Spoolman.
type Client struct {
	BaseURL string
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

// spoolURL normaliza a base (com/sem barra, com/sem sufixo /api/v1).
func (c *Client) spoolURL() string {
	base := strings.TrimRight(strings.TrimSpace(c.BaseURL), "/")
	base = strings.TrimSuffix(base, "/api/v1")
	return base + "/api/v1/spool"
}

// Spools busca todos os spools da instância.
func (c *Client) Spools() ([]Spool, error) {
	resp, err := httpClient.Get(c.spoolURL())
	if err != nil {
		return nil, fmt.Errorf("conectar ao Spoolman: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Spoolman respondeu %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var spools []Spool
	if err := json.Unmarshal(body, &spools); err != nil {
		return nil, fmt.Errorf("resposta do Spoolman: %w", err)
	}
	return spools, nil
}

// Filaments converts Spoolman spools to domain filaments. Archived spools and
// spools with an explicit remaining_weight of 0 are ignored; unknown weights are kept.
func Filaments(spools []Spool) []domain.Filament {
	var out []domain.Filament
	for _, sp := range spools {
		if sp.Archived || (sp.RemainingWeight != nil && *sp.RemainingWeight == 0) {
			continue
		}
		f := domain.Filament{
			Material:   deref(sp.Filament.Material),
			Color:      withHash(sp.Filament.ColorHex),
			Source:     "spoolman",
			SpoolmanID: &sp.ID,
		}
		if name := deref(sp.Filament.Name); name != "" {
			f.Name = name
		} else {
			f.Name = fmt.Sprintf("Spoolman #%d", sp.ID)
		}
		// Preço/kg: spool.price tem preferência; sem ele usa filament.price.
		// shortcut: sem peso do spool não dá para converter → 0, usuário edita no cadastro
		price := first(sp.Price, sp.Filament.Price)
		if weight := sp.Filament.Weight; price != nil && weight != nil && *weight > 0 {
			f.PricePerKg = *price * 1000 / *weight
		}
		out = append(out, f)
	}
	return out
}

func first(vals ...*float64) *float64 {
	for _, v := range vals {
		if v != nil {
			return v
		}
	}
	return nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// withHash devolve a cor no formato #rrggbb (o Spoolman grava sem #).
func withHash(s *string) string {
	if s == nil || *s == "" {
		return ""
	}
	if strings.HasPrefix(*s, "#") {
		return *s
	}
	return "#" + *s
}
