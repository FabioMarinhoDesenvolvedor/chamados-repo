# Handoff - 2026-07-07 (IDs inteiros)

## Contexto
Frente própria aberta após o SLA de dois tempos: trocar UUID por IDs inteiros sequenciais em
todas as 11 tabelas do sistema. A spec e o plano já estavam aprovados antes da implementação.

## Decisões
- IDs de domínio agora são `Int @default(autoincrement())`.
- A sequência começa em `1`, não em `0`.
- O histórico UUID de migrations foi substituído por um baseline único
  `20260707130000_init`.
- O reset/migrate real do banco continua sendo papel do Fabio.
- O link do e-mail de notificação agora é montado com o ID real do ticket após o insert, dentro da
  mesma transação do outbox.

## O que mudou
- `packages/api/prisma/schema.prisma`: PKs/FKs de UUID para `Int`.
- `packages/shared/src/types.ts`: IDs/FKs compartilhados de `string` para `number`.
- `packages/api/src/...`: auth, controllers, DTOs, repositories e services propagados para IDs
  inteiros; outbox ajustada para montar o e-mail após o insert.
- `packages/web/src/...`: hooks e páginas ajustados para IDs numéricos e `Number(...)` na borda.
- `packages/api/prisma/migrations/*`: migrations UUID antigas removidas; baseline schema novo em
  `20260707130000_init/`, **+ migration de dados de referência** `20260707130100_seed_referencia/`
  (ver seção "Correção forçada pelo smoke" abaixo).
- `docs/memory/decisions/ids-sequenciais-inteiros.md`: decisão formalizada.
- `docs/memory/architecture/database.md`: documentação atualizada para PK/FK inteiras.

## Verificação executada
- `npm run db:generate -w @chamados/api`: OK.
- `npm run build -w @chamados/shared`: OK.
- `npm run build -w @chamados/api`: OK.
- `npm run build -w @chamados/web`: OK.
- `npm test -w @chamados/api`: **89/89 pass**.
- `npx prisma validate --schema prisma/schema.prisma` em `packages/api`: OK.
- `npx tsc --noEmit prisma/seed.ts prisma/seed-admin.ts --moduleResolution node --esModuleInterop --skipLibCheck` em `packages/api`: OK.
- Baseline offline: `11` ocorrências de `CREATE TABLE` em
  `packages/api/prisma/migrations/20260707130000_init/migration.sql`.
- **SMOKE REAL (banco no ar, executado nesta sessão) — TODOS PASSARAM:**
  - `docker compose up` + `prisma migrate reset` (baseline) + `migrate deploy` (ref) + `db:seed`: OK.
  - Login (JWT `sub` numérico) → `user.id`/`departmentId` inteiros. `first-access` limpa mustChangePassword.
  - USER cria chamado → **`id` inteiro sequencial** (5, depois 6), `status=OPEN`, `responseSlaHours=3`.
  - `GET /tickets/<n>` dono → 200; admin → 200; **não-dono → 403** (enumeração barrada por RBAC);
    `/tickets/99999` → 404.
  - Filtro `?categoryId=7` (coerção de query `@Type`) → 200.
  - Criar usuário com `departmentId` inteiro → 201.
  - **Outbox**: setando `notification_email` no setor executor, o chamado criado gerou a linha
    `notification_outbox` com `ticket_id=7` (o inteiro real pós-insert — o refactor está correto).
    Link `${APP_URL}/tickets/<n>` só aparece quando `APP_URL` está setado (não estava no dev; ok).
  - Dados de smoke limpos ao final (chamados/usuário de teste removidos, `notification_email` revertido).
  - Observação: `first-access` trocou as senhas de `admin`/`user` (senha123 → Smoke@2026) e limpou
    `mustChangePassword`. Um `db:reset` restaura o estado pristino de seed.

## Revisão do Claude (implementação foi do Codex)
A conversão de IDs foi implementada pelo Codex e **revisada pelo Claude** nesta sessão. Veredito:
a conversão está **correta e verde** — refiz os gates (build shared/api/web, 89/89 testes,
`prisma validate`/`generate`), confirmei o baseline (`11` tabelas, todas `id SERIAL` → começa em 1,
sem UUID residual) e o refactor da outbox (o e-mail é montado dentro da tx com `ticket.id` real;
`@Type(() => Number)` presente em todos os ids de query — sem 400 em filtros). Fix aplicado pelo
Claude: indentação solta em `tickets.service.ts` (`else if` do `listWhere`) e restauração do
Unicode do `README.md` (o Codex havia trocado `←`/`—` por ASCII).

### Scope-creep incorporado do Codex (fora do escopo original dos IDs — documentado p/ transparência)
O Codex também fez uma **limpeza de resíduos de "triagem"** que NÃO estava na spec dos IDs. Tudo
inócuo (o TRIAGE já era dormente pós-SLA) e 1-2 são melhorias; mantido, mas listado para você poder
reverter pontualmente se quiser:
- `schema.prisma`: `status @default(TRIAGE)` → `@default(OPEN)` (entra no baseline; create() já
  seta OPEN explicitamente, então é inócuo).
- `tickets.service.ts` `update()`: `moveToOpen` calculado → fixo `false` (remove caminho morto
  TRIAGE→OPEN).
- `DashboardPage.tsx`: `QUICK_STATUSES` TRIAGE→OPEN; KpiCard "Em triagem"→"Legado em triagem";
  fallback de prazo "Em triagem"→"Prazo indisponível" (esta **corrige** um minor que a revisão do
  SLA havia apontado).
- `TicketDetailPage.tsx`: textos de "triagem" no fluxo.
- `types.ts` (e outros): comentários reescritos em ASCII (sem acento) — ruído cosmético, mantido.

## Correção forçada pelo smoke (bug real que só o banco no ar pegou)
O baseline consolidado foi gerado com `prisma migrate diff --from-empty --to-schema-datamodel`,
que é **só schema**. Mas o histórico antigo de migrations carregava também **dados de referência
de produção** (setores Tesouraria/Presidência/Manutenção/Limpeza/etc. e a árvore inteira de
categorias→subcategorias→detalhes com `base_complexity` curada) que chegavam à prod via
`migrate deploy`. Consolidar só o schema **dropou esses dados**, e o `seed.ts` (que os assumia
existentes) quebrou em `findUniqueOrThrow({ name: 'Tesouraria' })`.
- **Conserto:** nova migration de dados `20260707130100_seed_referencia/migration.sql`,
  reconstruída do histórico git das 5 migrations de dados antigas e **portada para IDs inteiros**
  (coluna `id` omitida → SERIAL; JOINs por nome/slug e `ON CONFLICT` idênticos). Commit `92b9fea`.
- `seed.ts` **não** precisou mudar (já compensava a ordem "TI criado depois" com backfills idempotentes).
- Validado: `migrate deploy` da ref + `db:seed` OK; smoke completo passou (ver Verificação).
- Ver gotcha `gotchas/baseline-consolidado-perde-dados-de-migration.md`.

## Pendências
- Merge da branch `feat/multi-setorial` (SLA + IDs inteiros) — sua decisão.
- Deploy: `db:deploy` aplica baseline + `20260707130100_seed_referencia` (prod recebe os setores/
  categorias). Build `shared→api→web` + restart. Papel do Fabio.
- Atualizar `docs/projeto/` quando quiser alinhar a documentação “para pessoas” aos IDs inteiros.
- Opcional: `db:reset` para restaurar o seed pristino (o smoke trocou senhas de admin/user e criou
  dados de teste já limpos).

## Próximo passo explícito
1. Decidir merge da branch (SLA + IDs inteiros, ambos com smoke/gates verdes).
2. Depois, seguir para as frentes pendentes do multi-setorial (Planos 3 e 4).
