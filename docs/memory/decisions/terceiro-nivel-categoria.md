# 3º nível de categoria ("detalhe")

Data: 2026-07-01

## Contexto
Objetivo do Fabio: facilitar a abertura, reduzindo texto livre. Após Categoria → Subcategoria,
faltava granularidade para descrever o problema sem digitar.

## Decisão
- Nova tabela `ticket_detail_options` (FK subcategoria), análoga a `ticket_subcategories`.
- Subcategoria tem **0..N** detalhes (data-driven). **Obrigatório quando existe**, proibido quando não.
- `tickets.detail_option_id` nullable (FK SET NULL). "Assunto" derivado ganha o 3º nível.
- Curadoria via seed na migration (idempotente), como as categorias — ~10 subcategorias, 46 detalhes.
- Coluna `base_complexity` (subcategoria + detalhe) criada nullable, **ociosa até o Item 2**
  (complexidade/SLA automáticos). Ver [[triagem-complexidade]] e o backlog de 2026-07-01.

## Consequências
- `GET /categories` passa a aninhar `details`. `POST /tickets` aceita/valida `detailOptionId`.
- Frontend ganha um grid intermediário (reusa `BlockCard`/`CategoryIcon`).
- Não altera triagem/SLA (isso é Item 2).
