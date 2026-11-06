# Feature: orcamentos-app

App desktop (Wails v3) para orçamentos de impressão 3D — nova versão do `calc3d`
com SQLite, múltiplos filamentos por orçamento e integração Spoolman.
Branch: `feature/orcamentos-app` · Estratégia de entrega: branch local com commits
por unidade de trabalho (sem remote configurado; push/PR ficam a cargo do usuário).
Test runner: `go test ./...` (backend) + `npm run build` em `ledger/frontend` (frontend).

## Specs

- **S1 — Impressoras**: "O usuário deve poder adicionar multiplas impressoras. Cada impressora tem um nome, preço de compra, vida útil estimada (horas), consumo de energia (watt) e preço de venda ao final da vida útil."
- **S2 — Bandeiras tarifárias**: "O usuário deve poder cadastrar diferentes bandeiras tarifárias de energia com o valor do kWh daquela bandeira."
- **S3 — Filamentos**: "O usuário deve poder cadastrar filamentos manualmente ou importa-los diretamente do Spoolman (documentação da API https://donkie.github.io/Spoolman/#tag/spool/operation/Find_spool_spool_get)"
- **S4 — Spoolman config**: "O usuário deve poder configurar a conexão com o spoolman"
- **S5 — Custos fixos**: "O usuário deve poder cadastrar elementos de custo fixo como Mão de Obra, Manutenção, Embalagem, etc. O usuário pode criar novas categorias ou utilizar uma já existente no banco de dados. Ao criar uma nova categoria ela deve ser salva no banco para uso futuro."
- **S6 — Regras de cálculo**: "As regras de calculo do preço de uma impressão devem ser aproveitadas de @../calc3d": Filamento = (preço kg /1000)×g; Energia = (W×h/1000)×kWh; Amortização = ((compra−revenda)/vida útil)×h (decisão do usuário: perda líquida, clamp ≥ 0); Custos fixos = soma; Preço final = total/(1−margem/100) se margem<100, senão total; Lucro = final−total. Multi-filamento: custo de filamento e tempo total são somas por filamento.
- **S7 — Fluxo do orçamento**: "O usuário clica no botão para criar um novo orçamento. É apresentada uma tela onde ele seleciona a Impressora, a tarifa de energia e pode adicionar quantos filamentos quiser. para cada filamento deve haver um pequeno formulário onde ele insere o tempo de impressão e o peso (gramas) utilizados daquele filamento. O usuário deve definir a margem de lucro daquele orçamento em porcentagem ex: 50."
- **S8 — Validação**: "O App deve validar que uma impressora foi selecionada, ao menos um filamento e seus dados preenchidos bem como a margem de lucro. Com todas as validações feitas o botão de calcular é liberado."
- **S9 — Resultado**: "O resultado do calculo deve mostrar os mesmo dados exibidos atualmente em @../calc3d": Filamento, Energia, Amortização, Custos Fixos, Custo Total, Lucro, Preço Final.
- **S10 — Salvar orçamento**: "Ao concluir um calculo o usuário deve ter a opção de salvar aquele orçamento definindo um nome pare ele."
- **S11 — Listagem/edição**: "A listagem de orçamentos deve estar presente na página inicial da app. Deve ser possível editar um orçamento e salva-lo."
- **S12 — Stack**: Go + Wails v3 (https://v3.wails.io/) + SQLite (driver modernc.org/sqlite) + React; UI em pt-BR.

## Tasks

- [x] T1 — S12: limpar scaffold (remover demo greet/time), renomear módulo `changeme`→`ledger`. (inline) — commit fe1ef8b..0e1fad0
- [x] T2 — S6: motor de cálculo em `ledger/internal/domain` com testes (RED→GREEN), regras portadas do calc3d. (inline) — commit 0e1fad0
- [x] T3 — S1,S2,S3,S5,S12: store SQLite (schema + CRUD) em `ledger/internal/store`. (inline) — commit 0e1fad0
- [x] T4 — S1–S5,S7,S10,S11: serviços Wails (CRUDs + orçamentos + calcular) e wiring em `main.go`. (inline) — commit d731093
- [x] T5 — S3,S4: cliente Spoolman (config, testar conexão, importar spools). (inline) — commit d731093
- [x] T6 — S7,S8,S9: frontend — formulário de orçamento (multi-filamento, validação, resultado). (inline) — commit (UI)
- [x] T7 — S1–S5: frontend — páginas de cadastros (impressoras, bandeiras, filamentos, spoolman, categorias). (inline) — commit (UI)
- [x] T8 — S10,S11: frontend — home com listagem, salvar/editar orçamento. (inline) — commit (UI)
- [x] T9 — S12: build completo (wails3), suite Go, glossário e README. (inline) — binário `bin/ledger` gerado com `wails3 task build EXTRA_TAGS=gtk3` (linuxbrew `ld` precisa sair do PATH); smoke test OK (janela abre, banco criado com 8 tabelas); `go test -tags gtk3 ./...` 11/11.

## Log

- **L1** (2026-11-06, usuário): pedido original verbatim: "Criar uma nova versão de ../calc3d com interface gráfica desktop usando Wails" + contexto de feedback dos usuários (alterar preço/quantidade de filamento e tempo por orçamento; múltiplos filamentos por orçamento para impressões coloridas multi-partes em que cada Plate é uma cor; integração com Spoolman como fonte da verdade para preço e inventário) + features e fluxo detalhados (S1–S11) + stack.
- Decisão do usuário (2026-11-06): projeto no diretório atual `/home/anibal/ledger` (scaffold Wails v3 já existente em `ledger/`); amortização pela perda líquida (preço de compra − preço de revenda).
- Previsão de entrega: ~2000–2500 linhas autoradas; commits por unidade de trabalho na branch local; RDD global ativo → `gentle-ai review assess` por commit de unidade.
- 2026-11-06: bloqueio de ambiente — Wails v3 (v3.0.0 e v3.1.0) exige GTK ≥ 4.10 incondicionalmente (GtkFileDialog); Ubuntu 22.04 tem 4.6.9. Caminho suportado: build legado `-tags gtk3` + `libwebkit2gtk-4.1-dev` (disponível no apt jammy). Usuário optou por instalar e avisar. Enquanto isso: `go test ./internal/...` passa (11 testes), frontend `npm run build` passa; `go test ./...` na raiz e o binário desktop aguardam a dependência. Comando de build: `wails3 task build EXTRA_TAGS=gtk3`.
- 2026-11-06: backend completo (domínio+cálculo, store, spoolman, serviços, bindings; 11 testes GREEN). RDD assess pós-commits 0e1fad0/d731093: medium / under_budget (revisão pendente na slice).
- 2026-11-06: frontend completo (home/listagem, formulário com validação S8 e resultado S9, cadastros S1–S5, spoolman S4). Design: dark "bancada" (#0B0E16) + âmbar #F5A524, cor viva só nos chips de filamento; Inter tabular-nums.
- 2026-11-06: dependência instalada pelo usuário. Ajustes finais de build: bindings em modo produção geram **interfaces** (não classes) com arrays nullable e campos obrigatórios → frontend usa literais + `import type`; link precisa do `ld` do sistema (linuxbrew fora do PATH). Binário `bin/ledger` OK, smoke test OK, `go test -tags gtk3 ./...` 11/11, schema com 8 tabelas confirmado no banco.
- 2026-11-06: RDD — candidato inteiro (base main, 4.859 linhas) excedeu o orçamento de contexto (`lens_context_budget_exceeded`); dividido. Parte 1 (d731093..HEAD, frontend, consentida): revisores risk+resilience admitidos → refutador abriu correção delimitada; gastei a única correção no item de modo executável do `.desktop` (evidência do assess) mas o achado real congelado era **R4-spoolman-test-unsaved-url (CRITICAL)**: Testar/Importar Spoolman usavam a URL persistida em vez da em edição. Validador rejeitou a correção → transação terminal `escalated`/`native_stop_required`. **Bug corrigido em política ordinária** (commit 98d9421: TestSpoolman/ImportSpoolman agora recebem a URL; frontend passa o valor da tela) + modo do `.desktop` corrigido (4cdfa2e).
- 2026-11-06: RDD parte 2 — nova transação sobre o candidato corrigido (lineage review-67046b85c8accb6b, 24 arquivos/2.466 linhas, consentida pelo usuário): risk sem achados (confirma o CRITICAL corrigido); resilience aprovou com 3 achados advisory não-bloqueantes. **Acknowledgement executado, autoridade queimada — revisão APPROVED, terminal.** Boundary revisada avança para HEAD. Achados advisory (trabalho futuro, não reabrem a revisão): (1) R4-quotes-delete-error-swallowed (WARNING): erro de exclusão de orçamento capturado em estado nunca renderizado — falha silenciosa em Quotes.tsx; (2) R4-settings-save-no-inflight-guard (WARNING): botões Salvar dos cadastros sem guarda busy → duplo clique pode duplicar insert; (3) R4-useasync-stale-response-race (SUGGESTION): useAsync sem token in-flight, resposta antiga pode sobrescrever nova.
