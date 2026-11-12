# Feature: production-kanban
Add production orders with live-linked quote tickets, configurable Kanban stages, archiving, and period reports.
Branch: `feature/production-kanban` · Delivery: `feature-branch-chain` (forecast ~1,200 authored changed lines).
Test runner: `make test`; focused checks: `go test ./internal/store`, `go test ./...`, and `cd frontend && npm run test:i18n`.

## Specs

- **S1 — Production orders and quote tickets:** “Os usuários estão solicitando uma nova feature em que eles possam adicionar orçamentos já criados a Pedidos e adiciona-los num quadro Kanban (drag and drop) para organizar suas produções.” Create identifiable Pedidos and add existing Orçamentos as tickets. Each ticket represents one execution. Tickets remain linked to the current Orçamento, so edits remain visible; deleting an Orçamento referenced by any ticket is rejected with a clear reason. A Pedido may be completed manually; when all its tickets enter the designated completion stage, ask the user whether to complete it and record `completed_at` only on confirmation.
- **S2 — Configurable stages:** “As colunas do Kanban devem ser inicialmente: To-do, Em produção, Impresso, Concluído e Cancelado. O Usuário deve poder alterar os nomes e a ordem das colunas, além de poder criar novas colunas. Uma coluna que contenha tickets não pode ser excluída (o usuário deve ser informado do motivo)” Seed the five stages in that order; permit renaming/reordering and adding stages; block deletion when tickets occupy a stage and explain why. The completion role survives renaming/reordering, and the user chose to protect that stage from deletion even when empty.
- **S3 — Board lanes and movement:** “Um pedido é como uma Task e os itens (orçamentos são como sub-tarefas dele). Um pedido deve ocupara uma raia horizontal no quadro.” Render one horizontal lane per Pedido and move its quote tickets between stages by drag and drop. Persist every stage transition so elapsed time can be reported, including cumulative time when a ticket revisits a stage.
- **S4 — Board filtering and sorting:** “Deve ser possível filtrar o quadro por pedidos (multipla seleção). Ordenar os pedidos por data de criação, data de atualização e outros campos disponíveis que vc achar relevantes” Provide a multi-select Pedido filter and sorting by creation/update date plus useful existing fields such as title and ticket count.
- **S5 — Soft deletion:** “Deve ser possível excluir um pedido, mesmo que ele já esteja em andamento. É feito um soft-delete no banco e ele não é mais exibido no kanban” Soft-delete a Pedido without deleting its tickets or stage history; exclude it from the active board. Do not silently cascade-delete quote or report history.
- **S6 — Archiving:** “Deve haver um botão para arquivar os Pedidos concluídos, eles não aparecem mais no quadro mas deve ser possível visualiza-los através de outra tela, seus dados podem ser usados para geração de relatórios” Offer an explicit archive action only for completed Pedidos; hide archived Pedidos from the active board and retain them in a separate archive view and reports.
- **S7 — Reports:** “Deve ser possível extrair um relatório para um determinado período de tempo. O usuário deve poder sabe de cada pedido quando tempo cada orçamento ficou em cada etapa do processo (coluna do Kanban). O tempo total para concluir um pedido. Consumo de cada filamento. tempo estimado de impressão vs tempo para concluir o pedido.” Include Pedidos whose completion timestamp falls in the selected period and report their full lifecycle. Show per-ticket cumulative duration in each stage, order duration, current linked quote's per-filament estimated grams, and estimated print hours versus order duration. Assumptions: order duration is creation-to-completion; filament usage is explicitly labeled estimated because the current quote stores estimates, not actual usage; export a CSV.
- **S8 — Database and performance:** “As alterações no banco devem utilizar o sistema de migrations da aplicação” and “Investigue o schema do banco de dados afim de acrescentar índices (e outras otimizaçõe) para tornar a recuperação de dados mais rápida. Use a skill `sql-optimization-patterns` e `sqlite-database-expert`” Use additive SQLite migrations, preserve existing data, parameterize user input, and add only indexes justified by board/report/delete query shapes. Verify relevant plans with SQLite query-plan evidence.
- **S9 — Frontend and visual design:** “Evitar ao máximo a criação de componentes novos que poderiam ser aproveitador da `shadcn`.” “Para a iconografia use a lib lucide-react que já está instalada na aplicação” “Utilizar a skill `shadcn` para os componentes” “Utilizar skil `vercel-react-best-practices`” “Use as skills `web-design-guidelines` e `frontend-ui-engineering para projeto de frontend” The user chose “Configurar shadcn”: add the minimum shadcn/Tailwind setup needed, use shadcn components for reusable primitives, retain the existing Ledger dark/amber visual language, and use lucide-react. Keep all three existing UI locales working.
- **S10 — Domain documentation:** “Use a skill `domain-modeling` e atualizar a documentação pertinente” Update the domain glossary and user-facing README; record the live quote-link choice in an ADR because edits affect existing production tickets and historical estimates.
- **S11 — Clarification policy:** “Em caso de dúvida me pergunte antes de prosseguir” The following user clarifications are binding; ask again only if a new consequential product decision appears.

## Tasks

- [ ] T1 — S1,S2,S5,S7,S8,S10: add production persistence, stage history, report queries, quote-delete guard, migrations/indexes, Wails services/bindings, backend tests, glossary, and ADR; route: inline; status: pending; Risk: item 1 (durable order/ticket/history data); commit: pending.
- [ ] T2 — S9: configure the minimum shadcn/Tailwind foundation while preserving the current theme and existing frontend behavior; route: inline; status: pending; Risk: item 5 (new frontend build dependencies/tooling); commit: pending.
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
- T1 implementation evidence (2026-11-12): RED was observed when `go test ./internal/store` could not compile the missing production model/API. After implementation, `go test ./internal/store` and `go test ./...` passed; `git diff --check` passed. The repository's `gentle-ai review mode status` reports RDD on (global). T1 remains pending until its local commit and required review outcome are recorded.
- T1 binding/build evidence (2026-11-12): `wails3 generate bindings -f "-tags production" -clean=true -ts -i` generated the new Wails API bindings (35 methods, 17 models); `cd frontend && npm run build` passed. npm emitted the existing `minimum-release-age` project-config warning.
- T1 delivery note: the current 1,836-line backend slice keeps the new persisted model, transactional lifecycle, stage history, report projection, tests, and domain decisions together; splitting them further would leave schema or report invariants without their exercising service path. The initial `wails3 task build:frontend` alias was unavailable; the documented binding generator and frontend build succeeded instead.
- The existing migration foundation is present in local commit `45d92ed`; the SQLite skill files are present in `f59d775`. The feature branch was created from the clean local `master` state at `f59d775`.
