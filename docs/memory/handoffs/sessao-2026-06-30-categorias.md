# Handoff — 2026-06-30 (Categorização de chamados por blocos)

## Contexto
- Substituição do título livre por **fluxo guiado de categorias/subcategorias** (blocos visuais).
- Mudança estrutural de banco (2 tabelas novas + colunas em `tickets`) + **paginação real** +
  **KPIs no servidor**. Sem quebrar chamados antigos. Lido CLAUDE.md + `docs/memory/`.
- **Deploy é do usuário.** Só editado/testado localmente.

## Decisões (validadas com o Fabio)
- "Assunto" (title) **derivado** de "Categoria › Subcategoria"; coluna `title` mantida.
- **Paginação real + KPIs no servidor** (pageSize 20).
- **Filtro por categoria** no dashboard e no relatório.
- Categoria **independente** do departamento.

## Banco (migration `add_ticket_categories`, sem perda de dados)
- Tabelas `ticket_categories` (slug único, name, icon, sort_order) e `ticket_subcategories`
  (FK categoria, unique(category_id, slug)). `tickets` ganhou `category_id`/`subcategory_id`
  (nullable, FK ON DELETE SET NULL) + índices; `description` virou nullable.
- **Seed na própria migration** (SQL INSERT idempotente): 6 blocos + 33 subcategorias com ícone
  lucide. Produção recebe via `prisma migrate deploy` (não depende do seed de dev).
- Reverter (não-destrutivo): `prisma migrate` não gera "down"; reverso manual =
  `DROP TABLE ticket_subcategories, ticket_categories;` + `ALTER TABLE tickets DROP COLUMN
  category_id, DROP COLUMN subcategory_id;` (chamados preservados).

## Backend (NestJS)
- Módulo **categories**: `GET /categories` (categorias + subcategorias aninhadas, 1 query).
- `POST /tickets`: aceita `categoryId`/`subcategoryId` + `description?`; valida sub∈categoria;
  deriva o título. DTO atualizado.
- **Listagem paginada** `GET /tickets` (`page`/`pageSize`/`status`/`scope`/`categoryId`/
  `subcategoryId`) → `{ items, total, page, pageSize }`, com `include` de categoria (sem N+1).
- **KPIs** `GET /tickets/stats` (groupBy status, respeita papel). Unread refatorado para
  `NOT EXISTS` raw (não carrega chamados).
- Relatório: filtro `categoryId`/`subcategoryId` + colunas de categoria (include, sem N+1).
- Testes node:test: +2 (create deriva título / rejeita sub de outra categoria). **20/20 pass.**

## Frontend (React, paleta grená, lucide-react)
- `CategoryIcon`: registry explícito nome→componente lucide (tree-shaking; sem 2ª lib).
- `NewTicketPage` = fluxo guiado: grid de blocos → grid de subcategorias (ícones, breadcrumb,
  Voltar) → descrição **opcional** + anexos → "Concluir chamado" (1 toast). Estados loading/erro
  no padrão atual (Spinner / card de erro com "Tentar novamente"). Responsivo (1→2→3 colunas).
- `features/categories/api.ts` (useCategories, cache longo). `useTickets` agora paginado;
  `useTicketStats`; `useAssignTicket` corrigido p/ a lista paginada (setQueriesData em items).
- **Dashboard**: lista paginada (Anterior/Próxima + "X de Y"), filtro por categoria, KPIs do
  `/stats`. Detalhe: **chip categoria** (ícone) + descrição opcional tratada. "Título"→"Assunto".

## Verificação
- `npm run build` (shared→api→web) OK · web `tsc` OK · `npm test -w @chamados/api` 20/20.
- **EXPLAIN ANALYZE** (5k linhas de teste, depois removidas): category_id seletivo → Index Scan
  (~0.1ms); count → Index Only Scan; stats → HashAggregate (~2ms); unread → Hash Anti Join (~3ms).
- Smoke headless (puppeteer): fluxo guiado 6 blocos→5 subs→concluir→**1 toast**→detalhe com chip;
  dashboard com KPIs, paginação e filtro de categoria, sem erros de página.

## Pendências / deploy (usuário)
- Aplicar a migration: `npm run db:generate && npm run db:deploy -w @chamados/api` antes do
  build/restart. Ordem de build: shared→api→web. Sem mudança destrutiva.
- (Opcional/futuro) permitir categorizar chamados antigos; paginação no relatório se crescer muito.
