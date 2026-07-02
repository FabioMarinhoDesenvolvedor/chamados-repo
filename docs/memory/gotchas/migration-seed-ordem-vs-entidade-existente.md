# Migration de dados que assume "setor já existe" quebra em banco novo

Data: 2026-07-02

## Sintoma
Depois de `prisma migrate reset` (banco do zero), setores/campos que deveriam vir com flags
específicas nasciam com os defaults errados — mesmo a migration de seed tendo o `UPDATE`/valor
certo escrito nela.

## Causa
Duas pegadinhas do mesmo tipo, achadas no smoke test da Task 11 (Plano 1 multi-setorial):

1. **`UPDATE ... WHERE name = 'X'` pressupõe que a linha já existe.** TI e RH são setores
   **fundacionais**, criados pelo `seed.ts` (não por migration) — e `prisma migrate deploy` roda
   **todas as migrations antes do seed**. Em banco de produção/dev antigo, TI/RH já existem
   (criados em sessão anterior), então o `UPDATE` funciona. Em banco **novo** (reset/instalação
   limpa), TI/RH ainda não existem no momento em que a migration roda — o `UPDATE` vira no-op
   silencioso, e quando o seed cria a linha depois, ela nasce com os defaults do schema (não com
   o valor pretendido pela migration).
2. **Mesma causa, para subquery**: `... = (SELECT id FROM departments WHERE name = 'X')` dentro da
   migration também retorna `NULL` se `X` ainda não existe nesse ponto — grava `NULL` em vez de
   falhar ruidosamente.

## Regra
Para qualquer entidade que a migration trata como "já existe" (por nome, não por ela mesma ter
criado a linha antes na mesma migration): **não usar só a migration**. Replicar o mesmo
UPDATE/backfill no `seed.ts`, de forma idempotente (`updateMany` com filtro no valor ainda-não-setado,
ex. `WHERE departmentId IS NULL`), rodando **depois** do `upsert` que cria a entidade. A migration
cobre o caso "ambiente antigo, entidade já existe"; o seed cobre o caso "banco novo, entidade
criada pelo próprio seed depois da migration".

## Como detectar
`prisma migrate reset` (drop + recria + todas migrations + seed) e conferir os campos via API —
testes unitários mockados **não pegam isso** (não rodam migration real). Só aparece com banco real
do zero.
