# SLA automático de dois tempos (resposta + conclusão)

Data: 2026-07-07
Supera: [[aprovacao-chamados]] (inteira). Supera PARTE de [[prazo-complexidade-automatica]]
(o SLA único derivado da prioridade e o override de complexidade do admin — o resto da decisão,
complexidade via categorização com default MÉDIA, continua valendo).
Spec: `docs/superpowers/specs/2026-07-07-sla-automatico-dois-tempos-design.md`

## Contexto
Pedido do Fabio (07/07): SLA "totalmente automático" (nada que o admin decida) e mais granular,
separando **tempo de resposta** ("ver e responder") de **tempo de conclusão** ("resolver"). O
resíduo manual que sobrava do fluxo de triagem (`PATCH /tickets/:id { complexity? }` e o seletor
"Definir complexidade" no detalhe) dava a impressão de que o chamado ainda precisava de curadoria,
e o SLA único (3 valores de hora por prioridade) era grosso demais.

## Problema
- Complexidade tinha um override manual do admin, único ponto não-automático que sobrava do fluxo.
- Um único relógio de SLA (prazo de "atendimento") misturava "alguém viu o chamado" com "o chamado
  foi resolvido" — não dava visibilidade de qual das duas etapas estava atrasada.
- Prazo colapsava em só 3 valores de hora (24h/3h/1h via prioridade de 4 níveis) — pouco granular.
- A Presidência era o único setor com `requiresApproval=true`, criando um estado (`PENDING_APPROVAL`)
  e um endpoint (`/approve`) para um caso que o Fabio decidiu descontinuar nesta sessão.

## Decisão (aprovada por Fabio, 2026-07-07)
1. **Fim do override de complexidade do admin.** `complexity` sai do `PATCH /tickets/:id` (DTO e
   serviço) e o seletor "Definir complexidade" sai da UI de detalhe. Complexidade passa a ser 100%
   da categorização (`detalhe.base_complexity` › `subcategoria.base_complexity` › MÉDIA). O admin
   mantém só a correção de `departmentId` (dado cadastral, recalcula prazos automaticamente).
2. **Dois relógios de SLA, ambos automáticos, ambos contados desde `sla_started_at` (criação):**
   - **Resposta** — encerra quando o chamado é **assumido** (`assign`) OU vai para
     **`IN_PROGRESS`** (o que vier primeiro). Grava `first_response_at` (nunca sobrescrito depois).
   - **Conclusão** — encerra quando vai para **`RESOLVED`** (`resolved_at`, já existia). É o SLA
     único de antes, agora renomeado/reformulado.
3. **Prazo granular via duas matrizes fixas `complexidade (4) × faixa-de-peso (3)`**
   (`RESPONSE_HOURS`/`RESOLUTION_HOURS` em `sla.matrix.ts`), substituindo o colapso
   `prioridade → 3 valores de hora`. Sem curadoria nova, sem hora digitada por ninguém. A
   prioridade de 4 níveis (badge colorido do staff) **continua existindo** para exibição/filtro,
   calculada como sempre (`PriorityService` intacto) — **não governa mais os prazos**.
4. **Remoção da aprovação/Presidência do fluxo.** `Presidência.requiresApproval` vira `false`
   (era o único setor com `true`), então nenhum chamado novo nasce `PENDING_APPROVAL`. O ramo de
   aprovação na criação e o endpoint `PATCH /tickets/:id/approve` saem (código morto).
5. **Visibilidade**: usuário comum vê as duas promessas ("Resposta em até Xh · Conclusão em até
   Yh") sem cor de estouro; staff vê contagem e "Resposta estourada"/"Conclusão estourada" em
   vermelho, e o relógio de resposta some (vira "Respondido") assim que gravado.

## Por que `PENDING_APPROVAL` fica dormente (não removido)
Remover um valor de enum do Postgres é caro/arriscado (exige recriar o tipo). Segue o mesmo
precedente já usado com `TRIAGE` em [[prazo-complexidade-automatica]]: o valor permanece no
schema, nenhum código novo o produz, e o front ganha o rótulo completo ("Aguardando aprovação")
só para o `Record<TicketStatus,…>` não ficar incompleto — sem construir UI de aprovação nova.

## Consequências
- `Ticket` (shared) ganha `firstResponseAt`, `responseSlaHours`/`resolutionSlaHours`,
  `responseDueAt`/`resolutionDueAt`, `responseBreached?`/`resolutionBreached?` (staff only via
  `hideByRole`). `UpdateTicketInput` perde `complexity`.
- `tickets` ganha coluna `first_response_at` (nullable); backfill não-destrutivo para chamados já
  assumidos/resolvidos (ver migration `20260707120000_sla_dois_tempos`).
- `departments`: `UPDATE requires_approval=false WHERE name='Presidência'` (dado, replicado
  idempotente no seed).
- `TicketsService.approve()` removido; `create()` nasce sempre `OPEN`.
- Ver também: business-rules.md (seções SLA, priorização, aprovação), [[rbac-setor-executor]].
