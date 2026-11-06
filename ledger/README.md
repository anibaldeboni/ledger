# Ledger · Orçamentos 3D

App desktop (Wails v3 + React) para calcular e guardar orçamentos de impressão 3D.
Nova versão do `calc3d`, com múltiplos filamentos por orçamento (um por cor/plate),
cadastros persistentes em SQLite e integração com o [Spoolman](https://donkie.github.io/Spoolman/).

## Stack

- Go + [Wails v3](https://v3.wails.io/)
- SQLite via [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite) (sem cgo)
- React + TypeScript + Vite

O banco fica em `$XDG_DATA_HOME/ledger/ledger.db` (criado no primeiro uso).

## Desenvolvimento

```bash
cd frontend && npm install && cd ..
wails3 dev          # hot-reload do frontend, rebuild do Go
```

## Testes

```bash
go test ./...
```

## Build

Linux (Ubuntu 22.04 / GTK 4.6 — usa o caminho legado gtk3):

```bash
sudo apt install libwebkit2gtk-4.1-dev   # uma vez
wails3 task build EXTRA_TAGS=gtk3        # bin em ./bin/ledger
```

Em distros com GTK ≥ 4.10 o build padrão `wails3 build` funciona sem a tag.

## Como o preço é calculado

Regras herdadas do `calc3d`, adaptadas para multi-filamento:

- **Filamento**: Σ (preço/kg ÷ 1000) × gramas de cada filamento
- **Energia**: (potência × tempo total) ÷ 1000 × preço do kWh da bandeira
- **Amortização**: ((compra − revenda) ÷ vida útil) × tempo total
- **Custos fixos**: soma dos itens escolhidos (Mão de Obra, Embalagem, …)
- **Preço final**: custo total ÷ (1 − margem/100) — com margem ≥ 100, igual ao custo total

O tempo total é a soma dos tempos informados por filamento.

## Spoolman

Configure a URL em **Cadastros → Spoolman**, teste a conexão e importe os spools.
A importação faz upsert por spool (spools arquivados são ignorados) e deriva o
preço/kg de `spool.price` (fallback `filament.price`) sobre o peso do spool.
