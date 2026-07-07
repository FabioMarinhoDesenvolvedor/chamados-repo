# Aprovação de chamados (setores sensíveis)

← SUPERADA por [[sla-dois-tempos-automatico]] (2026-07-07): `requiresApproval` da Presidência
vira `false`, nenhum chamado novo nasce `PENDING_APPROVAL`, e o endpoint `/approve` foi removido.
O valor de enum `PENDING_APPROVAL` fica dormente (não removido do Postgres). Mantida aqui como
histórico da decisão original.

Data: 2026-07-02
Estende: [[prazo-complexidade-automatica]] (SLA continua começando na criação, sem exceção).

## Contexto
Alguns setores (ex. Presidência) precisam que um chamado direcionado a eles passe por aprovação
antes de entrar na fila de atendimento — não é um chamado que qualquer setor deve poder abrir livremente.

## Decisão (aprovada por Fabio em 2026-07-02)
- Novo valor de enum `TicketStatus`: **`PENDING_APPROVAL`** (inserido antes de `OPEN`).
- `Department.requiresApproval` (boolean, novo) marca quais setores exigem aprovação. Só
  **Presidência** tem `true` na tabela real de 15 setores.
- Na criação (`TicketsService.create()`): se o `executorDepartment.requiresApproval` é `true`, o
  chamado nasce `PENDING_APPROVAL`; senão nasce `OPEN` (comportamento atual, sem mudança).
- **`sla_started_at` é gravado na criação de qualquer forma**, inclusive para `PENDING_APPROVAL` —
  não existe exceção à regra de `prazo-complexidade-automatica`. O prazo corre mesmo esperando aprovação.
- **Qualquer ADMIN aprova** (não é escopado por setor — decisão explícita, mais simples que "só
  admin daquele setor"). Novo endpoint `PATCH /tickets/:id/approve`, `@Roles('ADMIN')`, só a partir
  de `PENDING_APPROVAL` → `OPEN`.
- `PENDING_APPROVAL` **não pode ser setado manualmente** via `PATCH /tickets/:id` (update de
  status) — só a criação ou o endpoint `approve` produzem/saem desse estado.
- Um `OPERATOR` escopado por setor **não vê** chamados `PENDING_APPROVAL` do próprio setor na
  listagem (ainda não estão "na fila" dele) — a menos que filtre explicitamente pelo status.

## Consequências
- `TicketsService.listWhere()`/`stats()` ganharam lógica pra esconder `PENDING_APPROVAL` de
  OPERATOR escopado.
- Ver também: [[rbac-setor-executor]], business-rules.md (seção "Aprovação de chamados").
