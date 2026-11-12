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
cd frontend && npm run test:hooks && npm run build
```

The hook regression tests use Node's built-in TypeScript stripping and require Node 22.12 or newer; they add no npm dependencies.

## Translation contributions

UI translations live in `frontend/src/i18n/locales/<locale>/translation.json`. To add a language, copy the `pt-BR` catalog, translate its values without changing keys or `{{placeholders}}`, then register the locale and its native name in `frontend/src/i18n.ts`. Run `cd frontend && npm run test:i18n && npm run build` before opening a contribution.

## Build

Linux (Ubuntu 22.04 / GTK 4.6 — usa o caminho legado gtk3):

```bash
sudo apt install libwebkit2gtk-4.1-dev   # uma vez
wails3 task build EXTRA_TAGS=gtk3        # bin em ./bin/ledger
```

Em distros com GTK ≥ 4.10 o build padrão `wails3 build` funciona sem a tag.

Se o `ld` do linuxbrew sombrear o do sistema e o link falhar (undefined references
a `xcb_*`/`gcry_*`), rode o build sem o linuxbrew no PATH:

```bash
env PATH=$(echo $PATH | tr ':' '\n' | grep -v linuxbrew | paste -sd:) wails3 task build EXTRA_TAGS=gtk3
```

## Makefile

From the repository root, run one target at a time:

```bash
make help
make dev
make test
make build
make build EXTRA_TAGS=gtk3  # Ubuntu 22.04 / legacy GTK 3 path
make build-windows
```

`make build-windows` creates `ledger/bin/ledger.exe` for Windows/amd64. The
Windows task uses `CGO_ENABLED=0` by default; the project uses the pure-Go
`modernc.org/sqlite` driver, so no C cross-compiler is needed. The target
Windows machine still needs the WebView2 Runtime to run the app.

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
