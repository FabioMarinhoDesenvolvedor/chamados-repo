# Design — SLA automático de dois tempos (resposta + conclusão) — 2026-07-07

> Objetivo do Fabio (07/07): tornar o SLA **totalmente automático** — "nada que o admin
> decida" — e **mais granular**, além de separar **tempo de resposta** ("ver e responder")
> de **tempo de conclusão** ("resolver"). Cruzado com o código atual antes de propor. Não
> contradiz decisões aprovadas silenciosamente: onde toca decisões existentes
> (`prazo-complexidade-automatica`, `aprovacao-chamados`, o SLA único aprovado em 29/06),
> isso está sinalizado explicitamente abaixo.

## Ponto de partida (o que JÁ é automático hoje)

- O chamado **nasce `OPEN` já priorizado** (decisão `prazo-complexidade-automatica`, 01/07):
  complexidade vem da categorização (`detalhe.base_complexity` › `subcategoria.base_complexity`
  › **MÉDIA**), a prioridade sai da matriz `complexidade × peso-do-setor`, e `sla_started_at`
  grava na criação.
- O **prazo único** atual é derivado on-the-fly da prioridade: LOW/MEDIUM=24h, HIGH=3h,
  URGENT=1h (`sla.matrix.ts`, aprovado 29/06).
- **Resíduo manual** que sobrou: `PATCH /tickets/:id { complexity?, departmentId? }` — o admin
  ainda pode sobrescrever a complexidade (seletor "Definir complexidade" no detalhe). Deixou de
  ser obrigatório, mas existe e passa a impressão de "precisa de triagem".

## Decisões aprovadas (Fabio, 2026-07-07)

1. **Fim do override de complexidade do admin.** `complexity` sai do `PATCH /tickets/:id` (DTO
   e serviço) e o seletor "Definir complexidade" sai da UI de detalhe. A complexidade passa a
   ser **100% da categorização**. O admin **mantém** só a correção de setor (`departmentId`) —
   dado cadastral que reajusta os prazos automaticamente pela matriz.
2. **Dois relógios de SLA, ambos automáticos, ambos contados desde `sla_started_at` (criação):**
   - **Resposta** — para quando o chamado é **assumido** (`assign`) **ou** movido para
     **`IN_PROGRESS`** (o primeiro dos dois). Grava `first_response_at`.
   - **Conclusão** — para quando vai para **`RESOLVED`** (`resolved_at`, já existe). É o SLA
     único de hoje, renomeado.
3. **Prazo granular via matriz `complexidade (4) × faixa-de-peso (3)`** — duas tabelas fixas
   (uma por relógio), sem curadoria nova e sem ninguém digitar horas. Substitui o colapso
   `prioridade → 3 valores de hora`. A prioridade de 4 níveis (badge colorido do staff)
   **continua existindo** para exibição, calculada como hoje (`PriorityService` intacto).
4. **Remoção da aprovação/Presidência do fluxo.** A Presidência era o **único** setor com
   `requiresApproval=true`; passa a `false`, então **nenhum chamado nasce `PENDING_APPROVAL`**.
   O ramo de aprovação da criação e o endpoint `PATCH /tickets/:id/approve` saem (código morto).
   O valor de enum `PENDING_APPROVAL` **fica dormente** (não removido do Postgres — mesmo padrão
   já usado com `TRIAGE`; remover valor de enum lá é caro). **Isto SUPERA a decisão
   `aprovacao-chamados`** — registrar `← SUPERADA por sla-automatico-dois-tempos` no índice e
   link na decisão nova, sem apagar. O frontend do Plano 3 **não** construirá a UI de aprovação.
5. **Visibilidade dos prazos:**
   - **Usuário comum**: vê as **duas promessas** — `Resposta em até Xh · Conclusão em até Yh` —
     sem cor de estouro. Continua sem ver complexidade/prioridade (regra atual preservada).
   - **Staff (admin/operator)**: vê os dois relógios com contagem e **"Resposta estourada" /
     "Conclusão estourada"** em vermelho ao passar do prazo. Após assumir/`IN_PROGRESS`, o
     relógio de resposta deixa de contar (mostra "Respondido"), restando o de conclusão.

## Não-objetivos (fora de escopo deste design)

- **IDs sequenciais legíveis** (trocar UUIDs por inteiros a partir de 0) — pedido do Fabio na
  mesma sessão, mas é mudança na raiz do banco (todas as tabelas/FKs/URLs/validações + migração
  de dados). Vira **spec própria** depois desta. Não entra aqui.
- Sub-hora (minutos) nos prazos — o modelo segue em **horas inteiras** (≥ 1h), como hoje. Sem
  scope creep de granularidade em minutos.
- Nenhuma mudança na matriz de **prioridade/badge** nem no `PriorityService`.
- Sem SLA por subcategoria curada (abordagem descartada — ver §6).
- Sem calendário útil / pausa por horário comercial — mantém **horas corridas 24/7** (regra
  aprovada em 29/06).

---

## 1. Regras de negócio (detalhe)

### Complexidade (inalterada na fonte, sem override)
- Complexidade-base: `detalhe.base_complexity` › `subcategoria.base_complexity` › `MEDIUM`.
  Calculada em `create()` e persistida em `tickets.complexity` (como hoje).
- Sem override do admin. Corrigir `departmentId` recalcula prioridade e reflete nos dois prazos
  (ambos derivados).

### Prioridade (badge — inalterada)
- `computePriority(complexity, priorityWeight)` continua em `priority.matrix.ts`. Só serve ao
  badge colorido do staff e ao filtro; **não** governa mais os prazos.

### Os dois relógios
- **`sla_started_at`**: gravado na criação (inalterado). Origem dos dois relógios.
- **Resposta**: `response_due_at = sla_started_at + responseHours(complexity, weight)`.
  - Para (grava `first_response_at = now()`) na **primeira** ocorrência de `assign()` **ou**
    `updateStatus(IN_PROGRESS)`, o que vier antes. Nunca sobrescreve se já preenchido.
  - **Cumprido** se `first_response_at != null && first_response_at <= response_due_at`.
  - **Estourado** (só staff) se `first_response_at == null && now > response_due_at`, **ou**
    `first_response_at != null && first_response_at > response_due_at`.
- **Conclusão**: `resolution_due_at = sla_started_at + resolutionHours(complexity, weight)`.
  - Para quando `resolved_at` é gravado (transição para `RESOLVED`, já existente).
  - **Estourado** (só staff) se `resolved_at == null && now > resolution_due_at`, **ou**
    `resolved_at != null && resolved_at > resolution_due_at`.
- Complexidade nula (chamado legado sem categorização) → cai no default `MEDIUM` no cálculo dos
  prazos (mesma tolerância que a priorização já tem), nunca quebra.

### Aprovação (removida)
- Sem `PENDING_APPROVAL` na criação. `requiresApproval` fica no schema (inerte); a flag da
  Presidência vai a `false`. Endpoint `/approve` e o ramo de criação removidos.

---

## 2. As duas matrizes (fixas, aprovadas por Fabio em 07/07)

Faixas de `department.priority_weight` (reusa `weightBand()` de `priority.matrix.ts`):
**Baixo = 1–2 · Médio = 3 · Alto = 4–5**. Horas corridas (24/7), inteiras.

### Tempo de CONCLUSÃO (resolver)
| complexidade ↓ \ peso → | Baixo (1–2) | Médio (3) | Alto (4–5) |
|---|---|---|---|
| low (baixa)        | 48 | 40 | 24 |
| medium (média)     | 24 | 16 | 8  |
| high (alta)        | 8  | 4  | 2  |
| critical (crítica) | 4  | 2  | 1  |

### Tempo de RESPOSTA (ver e responder)
| complexidade ↓ \ peso → | Baixo (1–2) | Médio (3) | Alto (4–5) |
|---|---|---|---|
| low        | 8 | 6 | 4 |
| medium     | 4 | 3 | 2 |
| high       | 2 | 1 | 1 |
| critical   | 1 | 1 | 1 |

Ambas monótonas (mais complexo e/ou setor mais pesado → prazo menor). Resposta ≤ conclusão em
todas as células. Fonte única de verdade em `sla.matrix.ts` (DRY) — nunca calcular no banco.

---

## 3. Modelo de dados

### `tickets` — 1 coluna nova
```prisma
firstResponseAt DateTime? @map("first_response_at")
```
Nulo até a primeira resposta (assign OU IN_PROGRESS). Único dado persistido novo — os prazos e
os "due at" são **derivados**, nunca gravados.

### `departments` — sem coluna nova
- Migração de **dado**: `UPDATE departments SET requires_approval=false WHERE name='Presidência'`
  (+ replicado idempotente no `seed.ts`, ver gotcha `migration-seed-ordem-vs-entidade-existente`).

### `TicketStatus` — sem mudança de enum
- `PENDING_APPROVAL` permanece no enum, **dormente** (como `TRIAGE`). Nenhum chamado novo nasce
  nele.

### Backfill (migração de dado, não-destrutivo)
- `first_response_at` de chamados **existentes** que já passaram da resposta: preencher com o
  **primeiro** `ticket_status_history.created_at` cujo `to_status = 'IN_PROGRESS'`; se não houver
  (ex.: resolvido direto), usar `resolved_at`; se também nulo, usar `created_at`. Evita que
  chamados antigos apareçam "resposta estourada" para sempre. Chamados ainda abertos/não
  assumidos ficam com `first_response_at = NULL` (correto — resposta em aberto).
- Defensivo: `UPDATE tickets SET status='OPEN' WHERE status='PENDING_APPROVAL'` (não deve haver
  nenhum em produção — aprovação nunca foi deployada; smoke local já limpo).

---

## 4. Backend (NestJS)

- **`sla.matrix.ts`** (reescrito): duas `Record<Complexity, Record<WeightBand, number>>`
  (`RESPONSE_HOURS`, `RESOLUTION_HOURS`) + `responseHours(complexity, weight)` /
  `resolutionHours(complexity, weight)`. Remove `SLA_HOURS: Record<Priority, number>`.
- **`sla.service.ts`**: substitui `hours(priority)` / `dueAt(priority, startedAt)` por
  `responseHours/resolutionHours(complexity, weight)` e `responseDueAt/resolutionDueAt(
  complexity, weight, startedAt)`. Mantém horas corridas.
- **`tickets.service.ts`**:
  - Projeção do ticket (onde hoje injeta `slaHours`/`slaDueAt`) passa a injetar
    `responseSlaHours`, `resolutionSlaHours`, `responseDueAt`, `resolutionDueAt` +
    (staff) `responseBreached`/`resolutionBreached`, usando `ticket.complexity` +
    `department.priorityWeight`. Projeção por papel (`hideByRole`) mantém prazos visíveis a todos,
    mas `*Breached` só a staff.
  - `assign()`: se `first_response_at` nulo → grava `now()` na mesma operação.
  - `updateStatus()`: ao ir para `IN_PROGRESS`, se `first_response_at` nulo → grava `now()`.
  - `update()`: DTO perde `complexity`; mantém `departmentId` (recalcula prioridade/prazos).
  - Remove `approve()` e o ramo `requiresApproval → PENDING_APPROVAL` de `create()`.
- **`tickets.controller.ts`**: remove `PATCH :id/approve`. `update-ticket.dto.ts` perde
  `complexity`.
- **Projeção**: `first_response_at` retorna no detalhe/lista para o front decidir "Respondido".
- **Testes `node:test`**: `responseHours`/`resolutionHours` para as 12 células de cada matriz;
  `first_response_at` gravado no 1º assign; gravado no 1º IN_PROGRESS; **não** sobrescrito na 2ª
  ação; `update()` rejeita `complexity`; prazos derivados corretos com complexidade nula→MÉDIA;
  breach de resposta/conclusão calculado certo; nenhum chamado nasce `PENDING_APPROVAL`.

---

## 5. Frontend (React)

- **`@chamados/shared`**: `Ticket` ganha `firstResponseAt: string | null`,
  `responseSlaHours`, `resolutionSlaHours: number | null`, `responseDueAt`,
  `resolutionDueAt: string | null`, e (staff) `responseBreached`/`resolutionBreached?: boolean`.
  Renomeia `slaHours`→`resolutionSlaHours` e `slaDueAt`→`resolutionDueAt` (ajustar consumidores).
  `UpdateTicketInput` perde `complexity`.
- **`lib/sla.ts`**: helpers para os dois relógios (texto "Resposta em até Xh" / "Conclusão em
  até Yh"; estado respondido; breach por relógio).
- **`TicketDetailPage`**: remove o seletor "Definir complexidade" (admin). Mostra os dois prazos
  conforme §Decisão 5. Sem botão "Aprovar" (aprovação removida).
- **`DashboardPage`**: coluna "Prazo" passa a refletir os dois relógios de forma compacta (ex.:
  resposta enquanto não respondido, senão conclusão); usa `resolutionSlaHours` no lugar de
  `slaHours`.
- **`labels.ts`/`StatusBadge`**: adicionar a chave `PENDING_APPROVAL` faltante em `STATUS_LABEL`/
  `STATUS_CLASS` (hoje o `Record<TicketStatus,…>` está incompleto e quebra o build do web) —
  rótulo "Aguardando aprovação" mesmo dormente, para o tipo ficar completo.

---

## 6. Alternativas descartadas

- **Prazo curado por subcategoria** (coluna `sla_hours` por subcategoria/detalhe): granularidade
  máxima, mas exige curar ~33 subcategorias e ainda combinar com o peso. Descartada — a matriz
  `complexidade × peso` já dá 12 níveis sem curadoria nova.
- **Só dar hora distinta por prioridade** (manter 4 níveis, 4 horas): mudança mínima, mas pouco
  granular. Descartada por não atender o "prazo grosso demais".
- **Remover os dois overrides do admin** (inclusive setor): Fabio optou por **manter a correção
  de setor** (dado cadastral).
- **Remover o valor de enum `PENDING_APPROVAL` do Postgres**: caro/arriscado; segue o precedente
  do `TRIAGE` (dormente).

---

## 7. Migração & deploy (deploy é do Fabio)

Aditivo, sem migration destrutiva. Ordem sugerida:
1. `ALTER TABLE tickets ADD COLUMN first_response_at TIMESTAMP(3)` (nullable).
2. Backfill de `first_response_at` (query da §3).
3. `UPDATE departments SET requires_approval=false WHERE name='Presidência'`.
4. `UPDATE tickets SET status='OPEN' WHERE status='PENDING_APPROVAL'` (defensivo).
5. `db:generate` → `db:deploy` → build `shared → api → web` → restart (systemd, srv-alv01).
- Prazos são derivados: trocar os números das matrizes no futuro **não** exige migração de dado.

---

## 8. Verificação (antes de entregar)

- `npm run build` (shared → api → web) limpo; `tsc --noEmit` limpo (inclui o web, que hoje
  quebraria pelo `PENDING_APPROVAL` faltante em labels).
- `npm test -w @chamados/api` — testes novos da §4 + regressão dos existentes com número real.
- Smoke local (`npm run dev` + banco no ar): abrir chamado → ver os dois prazos como usuário e
  como staff; assumir → `first_response_at` grava e "Resposta" vira "Respondido"; mover para
  `IN_PROGRESS` num chamado ainda não respondido também grava; passar do prazo → staff vê
  estouro; conferir que `PATCH /tickets/:id { complexity }` não é mais aceito; nenhum chamado
  nasce `PENDING_APPROVAL`. Limpar dados de teste.

## 9. Impacto em memória/docs (na implementação)

- Nova decisão `decisions/sla-dois-tempos-automatico.md` (supera parte de
  `prazo-complexidade-automatica` no que toca o SLA único e o override; **supera**
  `aprovacao-chamados`).
- `aprovacao-chamados.md` ganha `← SUPERADA por sla-dois-tempos-automatico` no índice + link.
- Atualizar `architecture/business-rules.md` (seções SLA, priorização, aprovação).
- Handoff de sessão ao final.
