# Glossário

Linguagem do domínio do Ledger. Termos em pt-BR, como na interface.

- **Orçamento** — o conjunto de entradas (impressora, bandeira tarifária, usos de filamento, custos fixos e margem) que produz o preço de venda de uma impressão. Tem nome e pode ser salvo, revisitado e editado.
- **Pedido de produção** — conjunto de tickets que organiza o trabalho de fabricação; no quadro, cada pedido ocupa uma raia horizontal.
- **Ticket de produção** — uma execução de um orçamento dentro de um pedido. Registra o avanço daquela execução pelas etapas do processo.
- **Etapa de produção** — uma coluna do quadro que identifica o ponto do processo de fabricação; seu nome e sua posição podem ser ajustados.
- **Pedido concluído** — pedido cujo trabalho foi finalizado pelo usuário; quando todos os tickets chegam à etapa de conclusão, o app pede confirmação.
- **Pedido arquivado** — pedido concluído retirado do quadro ativo e mantido para consulta e relatórios.
- **Impressora** — a máquina que executa a impressão. Tem preço de compra, preço de revenda ao final da vida útil, vida útil estimada em horas e consumo de energia em watts.
- **Bandeira tarifária** — a faixa de preço da energia, com o valor do kWh vigente naquela bandeira.
- **Filamento** — um material de impressão do inventário, com preço por kg, material e cor. Pode ser cadastrado manualmente ou importado do Spoolman.
- **Uso de filamento (plate)** — um filamento empregado num orçamento, com o tempo de impressão e o peso (gramas) consumidos. Em impressões coloridas multi-parte, cada plate é uma cor.
- **Categoria de custo** — um elemento de custo fixo reutilizável entre orçamentos (Mão de Obra, Manutenção, Embalagem…), com valor padrão.
- **Amortização** — o rateio da perda líquida da impressora (preço de compra menos o preço de revenda) ao longo da vida útil, proporcional ao tempo de impressão.
- **Margem de lucro** — a porcentagem aplicada sobre o preço de venda, não sobre o custo: preço final = custo total ÷ (1 − margem/100).
- **Spoolman** — sistema externo de gestão de spools usado como fonte da verdade para preço e inventário de filamentos.
