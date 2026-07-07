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
- `packages/api/prisma/migrations/*`: migrations UUID antigas removidas; baseline offline novo em
  `packages/api/prisma/migrations/20260707130000_init/migration.sql`.
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

## Pendências
- `prisma migrate reset` / `db:migrate` real com banco no ar.
- Smoke real do fluxo com banco resetado:
  abrir chamado `id=1`, abrir segundo `id=2`, acessar `/tickets/1`, comentar, anexar, trocar
  status e verificar o link do e-mail `/tickets/<n>`.
- Atualizar `docs/projeto/` quando você quiser alinhar a documentação “para pessoas” à realidade
  dos IDs inteiros e do fluxo mais novo.

## Próximo passo explícito
1. Rodar reset/migrate/smoke com banco no ar (roteiro em Pendências).
2. Depois, seguir para as frentes pendentes do multi-setorial (Planos 3 e 4) ou para o merge.
