# Prazo/complexidade automáticos na abertura (Item 2)

PARCIALMENTE SUPERADA por [[sla-dois-tempos-automatico]] (2026-07-07): o SLA único (24h/3h/1h
por prioridade) vira dois relógios (resposta + conclusão) via matriz `complexidade × peso`, e o
**override de complexidade do admin** (`PATCH /tickets/:id { complexity? }`) foi removido. A
complexidade via categorização (`detalhe.base_complexity` › `subcategoria.base_complexity` ›
MÉDIA) e o restante desta decisão continuam valendo.

Data: 2026-07-01
Supera: [[triagem-complexidade]]

## Contexto
Bug relatado pelo Fabio: ao mudar a ação pelo dashboard, o "Prazo" ficava travado em "Em triagem"
e o chamado não ganhava prazo. Causa raiz: prioridade/SLA só eram definidos no passo de **triagem
manual** (admin define complexidade → matriz → prioridade → `sla_started_at`). Qualquer outro
caminho (mudar status pelo dash) deixava `priority`/`sla_started_at` nulos, e o front mostra
"Em triagem" sempre que `slaHours` é nulo.

## Decisão (aprovada por Fabio em 2026-07-01)
- **Fim da triagem manual como pré-requisito do prazo.** O chamado **nasce `OPEN` já priorizado**.
- **Complexidade automática via categorização**: `detalhe.base_complexity` › `subcategoria.base_complexity`
  › **MÉDIA** (default). O **peso do setor** entra na matriz de prioridade (inalterada).
- **`sla_started_at` gravado na criação** (SLA conta desde a abertura).
- **Complexidade-base curada** por subcategoria (33) + overrides por detalhe (seed em migration
  `20260701170000_curar_complexidade_base`). Ex.: sistema-indisponível=CRÍTICA, redefinição-senha=BAIXA,
  computador "não liga"=ALTA. Refinável depois.
- **Backfill** (migration `20260701160000`): chamados com `priority` nula OU `sla_started_at` nulo OU
  em `TRIAGE` foram migrados para OPEN priorizado (complexidade MÉDIA default no backfill) — não-destrutivo.
- **Override do admin** permanece: `PATCH /tickets/:id { complexity?, departmentId? }` recalcula a
  prioridade. Deixou de ser obrigatório para o prazo existir.

## Consequências
- `TicketsService.create()` calcula complexidade/prioridade e retorna já projetado (SLA), como
  `update()`/`updateStatus()`. `createWithHistory()` grava status OPEN + `sla_started_at` + histórico null→OPEN.
- Enum `TRIAGE` mantido por compatibilidade, mas chamados novos não nascem nele.
- Front sem mudança (o "Prazo" já lê `slaHours`, que agora vem preenchido).
- Curadoria da complexidade-base pode evoluir; enquanto não curada, cai no default MÉDIA.
- Ver também: business-rules.md (seção "Priorização automática na abertura").
