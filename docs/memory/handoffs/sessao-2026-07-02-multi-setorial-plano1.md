# Handoff — 2026-07-02 (Multi-setorial — Plano 1/4: Backend Core)

## Contexto
Evolução do sistema de service desk de IT-only para multi-departamental (15 setores, clube
Juventus). Depois de brainstorming extenso (ver `docs/superpowers/specs/2026-07-02-multi-setorial-design.md`),
o trabalho foi dividido em 4 planos independentes, todos na branch `feat/multi-setorial`:
1. **Backend Core** (schema, RBAC, roteamento, aprovação, seeds) — **completo nesta sessão**.
2. Notificação híbrida (outbox de e-mail) — não iniciado.
3. Frontend (macro-bloco, fila por setor, UI de aprovação) — não iniciado.
4. Totem (`isKiosk`, JWT de vida longa, rota `/totem`) — não iniciado.

Plano 1 executado via `subagent-driven-development` (11 tasks, cada uma com implementer + reviewer
subagent). Ledger completo em `.superpowers/sdd/progress.md`. **Deploy é do usuário** — só
editado/testado localmente (build + testes + smoke manual via `npm run dev` + curl).

## Decisões (validadas com o Fabio — ver [[rbac-setor-executor]] e [[aprovacao-chamados]])
- `Ticket.executorDepartmentId` é campo **separado** de `departmentId` (solicitante) — a matriz
  de prioridade continua usando o peso do setor do solicitante, não do executor.
- RBAC de `OPERATOR` via `User.departmentId` (campo que já existia, sem uso até agora). ADMIN
  nunca é restrito por setor.
- Aprovação via novo status `PENDING_APPROVAL` (só Presidência exige, hoje). SLA continua
  começando na criação, mesmo para chamados pendentes de aprovação.
- 15 setores reais com `priorityWeight` definido pelo Fabio (âncoras: Presidência=5, Limpeza=2).
- 14 categorias novas (8 Manutenção + 6 Limpeza), cada uma com 1 subcategoria placeholder
  ("Solicitação geral") — curadoria fina fica pra sessão futura (mesmo padrão do 3º nível).

## Banco (3 migrations, não-destrutivas + 1 fix)
- `20260702090000_add_multi_setor_columns`: colunas aditivas (flags de Department, `isKiosk`,
  `executorDepartmentId`/`originLocation` em Ticket, `departmentId` em TicketCategory).
- `20260702090100_add_pending_approval_status`: `PENDING_APPROVAL` no enum `TicketStatus`
  (isolada — [[postgres-enum-default]]).
- `20260702090200_seed_setores_multi_setorial`: 15 setores + 14 categorias + 14 subcategorias
  placeholder. **Editada durante a Task 11** (verificação final) — ver Bugs abaixo.
- Todas as 3 aplicadas no dev local pelo usuário (o agente não tem permissão pra `db:deploy`/`db:reset`
  neste ambiente — sempre pedir pro usuário rodar).

## Bugs reais encontrados e corrigidos no smoke test (Task 11)
Ver [[migration-seed-ordem-vs-entidade-existente]] pro gotcha completo. Resumo: RH e TI são
setores **fundacionais** (criados pelo `seed.ts`, não por migration), e migrations rodam **antes**
do seed. A migration de seed tratava RH como "setor novo" (`INSERT ... ON CONFLICT DO NOTHING`),
o que nunca aplica os flags certos a uma linha pré-existente — e em banco **novo**, a subquery que
resolve `department_id` das categorias de TI também falhava (TI ainda não existe nesse ponto).
Corrigido em `8f01974`: migration editada (RH ganhou `UPDATE` explícito, igual TI) + `seed.ts`
ganhou backfill idempotente de segurança pros dois casos. **Isso afeta produção também** (RH lá
provavelmente já existe) — importante ter esse fix no deploy.

## Backend (NestJS) — resumo do que mudou
- `TicketsService.create()`: resolve `executorDepartmentId` da categoria; decide `OPEN` vs
  `PENDING_APPROVAL` conforme `Department.requiresApproval`.
- `TicketsService`: `listWhere`/`stats`/`ensureCanView`/`assign`/`updateStatus` com RBAC de setor;
  novo `approve()` + endpoint `PATCH /tickets/:id/approve` (`@Roles('ADMIN')`).
- `DepartmentsService`: `create()` grava as 4 flags novas; `remove()` também bloqueia por
  categorias vinculadas (gap fechado nesta sessão).
- `AuthUser`/`JwtStrategy`/`UserPublic`: `departmentId`/`isKiosk` propagados (zero query nova).
- `@chamados/shared`: tipos/enum atualizados (`Department`, `Ticket`, `UserPublic`, `TICKET_STATUSES`).

## Verificação (Task 11 — gate integrado)
- `npm run build` (shared → api): limpo.
- `npm test -w @chamados/api`: **44/44 pass** (0 fail).
- Smoke manual completo via `npm run dev` + curl (2 resets de banco local durante a sessão, pra
  validar os fixes): 15 setores corretos, 20 categorias todas com `departmentId`, chamado em
  Manutenção nasce `OPEN`, chamado em categoria de teste apontando pra Presidência nasce
  `PENDING_APPROVAL`, `PATCH /approve` funciona, OPERATOR escopado por setor só vê o próprio setor.
  Dados de teste temporários limpos ao final.

## Pendências

### Deploy (ordem, quando for pra produção)
1. `npm run db:generate`
2. `npm run db:deploy -w @chamados/api` (aplica as 3 migrations — a de seed já vem com o fix do RH)
3. `npm run db:seed` **só se for instalação nova** (produção já tem TI/RH/dados reais — não rodar
   seed de dev em produção; conferir manualmente que RH ficou com `is_executor_dept=true` depois
   do deploy, já que era o bug encontrado nesta sessão)
4. `npm run build` (shared → api → web)
5. Restart do serviço (systemd em srv-alv01)

### Revisão final de branch (adiada a pedido do Fabio)
A revisão final whole-branch do Plano 1 (`subagent-driven-development`, merge-base
`3ac7bccc115ab503f39bff9cb5dcbac464e70aa5` → HEAD `8f01974`) ainda não rodou — fica pra próxima
sessão antes de decidir merge. Tarefa registrada no task tracker (#17).

### Próximos planos
- Plano 2 (notificação híbrida por e-mail), Plano 3 (frontend) e Plano 4 (totem) ainda não têm
  plano de implementação escrito — só o design (spec) está pronto. Instrução do Fabio foi
  "faz todos os planos e executa eles" — seguir escrevendo e executando cada um em sequência
  contra o código já atualizado pelo Plano 1.
- Curadoria de categorias reais pros 12 setores sem macro-bloco (RH, Tesouraria, etc.) segue
  fora de escopo, como já estava no design original.
