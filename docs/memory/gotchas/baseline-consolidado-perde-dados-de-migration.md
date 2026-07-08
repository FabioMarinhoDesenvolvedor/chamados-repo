# Gotcha — consolidar migrations num baseline schema-only perde dados de referência

## Sintoma
Após "squashar" o histórico de migrations num único baseline gerado com
`prisma migrate diff --from-empty --to-schema-datamodel ... --script`, o `db:reset` aplica o
schema mas o **seed quebra** (ex.: `findUniqueOrThrow({ name: 'Tesouraria' })` → `P2025 No record
found`). Em produção, o `migrate deploy` recria as tabelas **vazias** — sem setores/categorias.

## Causa
`migrate diff --from-empty --to-schema-datamodel` reproduz **só o schema** (CREATE TABLE/INDEX/FK).
O histórico antigo, porém, também continha **migrations de dados** (INSERT/UPDATE de dados de
referência de produção: setores reais, árvore de categorias→subcategorias→detalhes, curadoria de
`base_complexity`). Essas migrations existiam justamente para prod receber os dados via
`migrate deploy` (o seed de dev NUNCA roda em prod). Consolidar só o schema **descarta** esses dados.
O `seed.ts` de dev assumia que eles já existiam (criados pelas migrations) e por isso quebra.

## Correção (2026-07-07, frente IDs inteiros)
Reconstruir uma migration de **dados** separada, aplicada depois do baseline de schema
(`20260707130100_seed_referencia/`), recuperando o SQL do histórico git das migrations de dados
antigas. Ao portar de UUID para `Int` autoincrement, a transformação é mecânica:
- omitir a coluna `"id"` do `INSERT` (o `SERIAL` gera o valor);
- remover `gen_random_uuid(),` dos `VALUES`/`SELECT`;
- manter os JOINs por `name`/`slug` e os `ON CONFLICT` (idempotência) idênticos.
Assim tanto `migrate deploy` (prod) quanto `migrate reset` (dev) recriam os dados de referência, e o
seed de dev volta a só adicionar admin/user + amostras.

## Regra
Ao consolidar/squashar migrations: o baseline precisa reproduzir o **estado completo** anterior —
schema **e** dados de referência que iam para produção via migration. Nunca só o schema. Confirmar
sempre com um `db:reset` + smoke real antes de considerar a consolidação pronta.
