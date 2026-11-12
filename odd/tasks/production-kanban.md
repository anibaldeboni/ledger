# Feature: production-kanban
Add production orders with live-linked quote tickets, configurable Kanban stages, archiving, and period reports.
Branch: `feature/production-kanban` · Delivery: `feature-branch-chain` (reforecast ~3,000 total authored changed lines after T1; generated bindings excluded).
Test runner: `make test`; focused checks: `go test ./internal/store`, `go test ./...`, and `cd frontend && npm run test:i18n`.

## Specs

- **S1 — Production orders and quote tickets:** “Os usuários estão solicitando uma nova feature em que eles possam adicionar orçamentos já criados a Pedidos e adiciona-los num quadro Kanban (drag and drop) para organizar suas produções.” Create identifiable Pedidos and add existing Orçamentos as tickets. Each ticket represents one execution. Tickets remain linked to the current Orçamento, so edits remain visible; deleting an Orçamento referenced by any ticket is rejected with a clear reason. A Pedido may be completed manually; when all its tickets enter the designated completion stage, ask the user whether to complete it and record `completed_at` only on confirmation.
- **S2 — Configurable stages:** “As colunas do Kanban devem ser inicialmente: To-do, Em produção, Impresso, Concluído e Cancelado. O Usuário deve poder alterar os nomes e a ordem das colunas, além de poder criar novas colunas. Uma coluna que contenha tickets não pode ser excluída (o usuário deve ser informado do motivo)” Seed the five stages in that order; permit renaming/reordering and adding stages; block deletion when tickets occupy a stage and explain why. The completion role survives renaming/reordering, and the user chose to protect that stage from deletion even when empty.
- **S3 — Board lanes and movement:** “Um pedido é como uma Task e os itens (orçamentos são como sub-tarefas dele). Um pedido deve ocupara uma raia horizontal no quadro.” Render one horizontal lane per Pedido and move its quote tickets between stages by drag and drop. Persist every stage transition so elapsed time can be reported, including cumulative time when a ticket revisits a stage.
- **S4 — Board filtering and sorting:** “Deve ser possível filtrar o quadro por pedidos (multipla seleção). Ordenar os pedidos por data de criação, data de atualização e outros campos disponíveis que vc achar relevantes” Provide a multi-select Pedido filter and sorting by creation/update date plus useful existing fields such as title and ticket count.
- **S5 — Soft deletion:** “Deve ser possível excluir um pedido, mesmo que ele já esteja em andamento. É feito um soft-delete no banco e ele não é mais exibido no kanban” Soft-delete a Pedido without deleting its tickets or stage history; exclude it from the active board. The user clarified that soft-deleted orders enter reports only as a count of canceled orders: “entram no relatório mas apenas como contagem de pedidos cancelados”. Count them in the report period by `deleted_at`; do not include per-order details or cascade-delete their quote/stage history.
- **S6 — Archiving:** “Deve haver um botão para arquivar os Pedidos concluídos, eles não aparecem mais no quadro mas deve ser possível visualiza-los através de outra tela, seus dados podem ser usados para geração de relatórios” Offer an explicit archive action only for completed Pedidos; hide archived Pedidos from the active board and retain them in a separate archive view and reports.
- **S7 — Reports:** “Deve ser possível extrair um relatório para um determinado período de tempo. O usuário deve poder sabe de cada pedido quando tempo cada orçamento ficou em cada etapa do processo (coluna do Kanban). O tempo total para concluir um pedido. Consumo de cada filamento. tempo estimado de impressão vs tempo para concluir o pedido.” Include completed Pedidos whose `completed_at` falls in the selected period and report their full lifecycle. Show per-ticket cumulative duration in each stage, order duration, current linked quote's per-filament estimated grams, and estimated print hours versus order duration. Include soft-deleted Pedidos only in the cancelled-order count, selected by `deleted_at`, not as per-order details. Assumptions: order duration is creation-to-completion; filament usage is explicitly labeled estimated because the current quote stores estimates, not actual usage; export a CSV.
- **S8 — Database and performance:** “As alterações no banco devem utilizar o sistema de migrations da aplicação” and “Investigue o schema do banco de dados afim de acrescentar índices (e outras otimizaçõe) para tornar a recuperação de dados mais rápida. Use a skill `sql-optimization-patterns` e `sqlite-database-expert`” Use additive SQLite migrations, preserve existing data, parameterize user input, and add only indexes justified by board/report/delete query shapes. Verify relevant plans with SQLite query-plan evidence.
- **S9 — Frontend and visual design:** “Evitar ao máximo a criação de componentes novos que poderiam ser aproveitador da `shadcn`.” “Para a iconografia use a lib lucide-react que já está instalada na aplicação” “Utilizar a skill `shadcn` para os componentes” “Utilizar skil `vercel-react-best-practices`” “Use as skills `web-design-guidelines` e `frontend-ui-engineering para projeto de frontend” The user chose “Configurar shadcn” and the Nova preset (CLI option description: “Lucide / Geist”): add the minimum shadcn/Tailwind setup needed, use shadcn components for reusable primitives, adapt semantic tokens to the existing Ledger dark/amber palette, and use lucide-react. Keep all three existing UI locales working.
- **S10 — Domain documentation:** “Use a skill `domain-modeling` e atualizar a documentação pertinente” Update the domain glossary and user-facing README; record the live quote-link choice in an ADR because edits affect existing production tickets and historical estimates.
- **S11 — Clarification policy:** “Em caso de dúvida me pergunte antes de prosseguir” The following user clarifications are binding; ask again only if a new consequential product decision appears.

## Tasks

- [x] T1 — S1,S2,S5,S7,S8,S10: add production persistence, stage history, report queries, quote-delete guard, migrations/indexes, Wails services/bindings, backend tests, glossary, and ADR; route: inline; status: complete; Risk: item 1 (durable order/ticket/history data); commits: `7b1f3cc`, `303b6a4`, `7495786`; RDD: first two `high_risk`/granted/acknowledged; final `medium`/under_budget.
- [x] T2 — S9: configure the minimum shadcn/Tailwind foundation while preserving the current theme and existing frontend behavior; route: inline; status: complete; Risk: item 5 (new frontend build dependencies/tooling); commit: pending; checks: `npm run build`, `npm run test:theme`, `npm run test:i18n`, `git diff --check`; independent verification: pass, no blockers; RDD assessment: pending.
- [ ] T3 — S1,S2,S3,S4,S5,S6,S9: implement the active Kanban, order lanes, ticket drag-and-drop, multi-select filtering/sorting, stage management, deletion/completion/archive actions, and translations; route: inline; status: pending; Risk: none; commit: pending.
- [ ] T4 — S6,S7,S9,S10: implement the archive/report views and CSV export, update README usage, and run the full feature verification; route: inline; status: pending; Risk: none; commit: pending.

## Log

- **L1** (2026-11-12, user): original request verbatim:

```text
# Task
Incluir uma nova de feature de linha de produção
# Business context
Os usuários estão solicitando uma nova feature em que eles possam adicionar orçamentos já criados a Pedidos e adiciona-los num quadro Kanban (drag and drop) para organizar suas produções.
As colunas do Kanban devem ser inicialmente: To-do, Em produção, Impresso, Concluído e Cancelado. O Usuário deve poder alterar os nomes e a ordem das colunas, além de poder criar novas colunas. Uma coluna que contenha tickets não pode ser excluída (o usuário deve ser informado do motivo)
Um pedido é como uma Task e os itens (orçamentos são como sub-tarefas dele). Um pedido deve ocupara uma raia horizontal no quadro.
Deve ser possível filtrar o quadro por pedidos (multipla seleção). Ordenar os pedidos por data de criação, data de atualização e outros campos disponíveis que vc achar relevantes
Deve ser possível excluir um pedido, mesmo que ele já esteja em andamento. É feito um soft-delete no banco e ele não é mais exibido no kanban
Deve haver um botão para arquivar os Pedidos concluídos, eles não aparecem mais no quadro mas deve ser possível visualiza-los através de outra tela, seus dados podem ser usados para geração de relatórios
Deve ser possível extrair um relatório para um determinado período de tempo. O usuário deve poder sabe de cada pedido quando tempo cada orçamento ficou em cada etapa do processo (coluna do Kanban). O tempo total para concluir um pedido. Consumo de cada filamento. tempo estimado de impressão vs tempo para concluir o pedido.
# Tech context
Evitar ao máximo a criação de componentes novos que poderiam ser aproveitador da `shadcn`.
As alterações no banco devem utilizar o sistema de migrations da aplicação
Investigue o schema do banco de dados afim de acrescentar índices (e outras otimizaçõe) para tornar a recuperação de dados mais rápida. Use a skill `sql-optimization-patterns` e `sqlite-database-expert`
Para a iconografia use a lib lucide-react que já está instalada na aplicação
<Must>
Utilizar a skill `shadcn` para os componentes
Utilizar skil `vercel-react-best-practices`
Use as skills `web-design-guidelines` e `frontend-ui-engineering para projeto de frontend
Use a skill `domain-modeling` e atualizar a documentação pertinente
Em caso de dúvida me pergunte antes de prosseguir
</Must>
```
- **L2** (2026-11-12, user): “Pode ser por via manul ou automática quando todos os orçamentos estiverem concluídos. O app deve perguntar ao usuário se ele deseja concluir o pedido”
- **L3** (2026-11-12, user): “Configurar shadcn”
- **L4** (2026-11-12, user): “Vínculo sempre atual”
- **L5** (2026-11-12, user): “Uma execução por ticket”
- **L6** (2026-11-12, user): “Concluídos no período (Recommended)”
- **L7** (2026-11-12, user): “Proteger Concluído (Recommended)”
- **L8** (2026-11-12, user): “Autorizar commit local da migration” — local commits are allowed for the migration prerequisite; no push or publication was authorized.
- **L9** (2026-11-12, user): “feature-branch-chain”
- Initial T1 implementation (2026-11-12): commit `7b1f3cc` added the production persistence/model, report API, migration, indexes, and documentation. `go test ./internal/store`, `go test ./...` (53 tests), Wails binding generation, `cd frontend && npm run build`, and `git diff --check` passed. The task alias `wails3 task build:frontend` was unavailable; the documented binding generator succeeded. npm emitted the existing `minimum-release-age` project-config warning.
- Initial T1 native review: assessment `high_risk`; consent granted; risk, resilience, readability, and reliability captures completed. The refuter rejected `R4-rollback-data-loss`; exact acknowledgement burned authority and the review ended approved. The non-blocking multi-ticket coverage and soft-deleted report findings led to the later L10/L11 clarifications.
- **L10** (2026-11-12, user): “entram no relatório mas apenas como contagem de pedidos cancelados”
- **L11** (2026-11-12, user): “Data da exclusão (Recommended)” The user selected `deleted_at` as the period date for this aggregate count.
- **L12** (2026-11-12, user): “Nova” (shadcn CLI preset; displayed description: “Lucide / Geist”)
- L10/L11 updated S5/S7 and reopened T1; commit `7b1f3cc` remains the prior approved boundary.
- T1 follow-up RED: a new test failed because the report DTO had no canceled-order count. T1 follow-up GREEN: report output now counts soft-deleted orders by `deleted_at` without per-order details; migration `000003` adds the supporting partial index. `go test ./internal/store`, `go test ./...` (55 tests), `npm run build`, and `git diff --check` passed; Wails bindings were regenerated.
- T1 follow-up native review of `303b6a4`: assessment `high_risk`; consent granted; risk/readability/reliability captures completed; review approved and acknowledged with no blockers. Its non-blocking refinements were addressed in `7495786`; that test/comment/doc-only commit assessed `medium`/`under_budget`, so no review was due.
- T1 advisory hardening (2026-11-12): documented that the cancellation count means soft-deleted orders, split the report assertion message, and added exact start/end-boundary coverage. `go test ./...` (55 tests), `npm run build`, and `git diff --check` passed.
- The existing migration foundation is present in local commit `45d92ed`; the SQLite skill files are present in `f59d775`. The feature branch was created from the clean local `master` state at `f59d775`.
- The Engram task mirror returned a stale snapshot after earlier T1 updates; the local task file remained authoritative until the T2 resynchronization.
- T2 (2026-11-12): shadcn info confirmed Vite, Tailwind v4, Radix Nova, Lucide, and Geist. Restored Ledger dark/amber semantic tokens and enabled `.dark`; added a regression probe that fails against `7495786` and passes on this candidate. `npm run build`, `npm run test:theme`, and `git diff --check` passed; independent S9 verification passed with no blockers and `npm run test:i18n` passed for all three locales. npm continues to warn that the existing `minimum-release-age` project config is unknown.
