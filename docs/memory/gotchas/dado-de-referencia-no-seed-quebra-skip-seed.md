# Gotcha — dado de referência de produção no seed quebra `migrate reset --skip-seed`

## Sintoma
Deploy em produção com `prisma migrate reset --force --skip-seed` (ou `migrate deploy` sem rodar o
seed) sobe o banco, mas **faltam entidades de referência**: no incidente de 2026-07-08, os setores
**TI e RH sumiram** e as **categorias de TI ficaram órfãs** (sem `department_id`) → TI desapareceu
do fluxo de abertura. Só apareciam Manutenção/Limpeza.

## Causa
Parte do dado de referência de PRODUÇÃO estava no **`prisma/seed.ts`** (dev), não em migration:
- `seed.ts` criava os setores **TI** e **RH** (`upsert`) e fazia o **backfill** do `department_id`
  das 6 categorias de TI.
- A migration de referência (`20260707130100_seed_referencia`) criava os OUTROS setores e tentava
  ligar as categorias de TI com `UPDATE ... WHERE name='TI'`, mas **TI ainda não existia** naquele
  ponto (era criado só pelo seed) → o `UPDATE` não achava nada e deixava `department_id` NULL.

Usa-se `--skip-seed` em produção **de propósito** (o seed de dev cria usuários/chamados de exemplo
que não devem ir para prod). Só que o seed também carregava dado de referência ESSENCIAL (TI/RH +
wiring), que foi junto no "pulo". Resultado: banco de prod incompleto.

## Correção (2026-07-08)
Migration `20260708100000_ti_rh_departamentos` (idempotente) cria TI/RH e liga as categorias de TI.
Agora todo o dado de referência de produção está em **migration**, e o seed de dev só adiciona
amostras. `migrate reset --skip-seed` passa a produzir o banco completo.

## Regra
**Dado de referência que precisa existir em produção mora em MIGRATION, nunca só no seed de dev.**
O seed de dev (`db:seed`) só pode conter dados de exemplo descartáveis (usuários/chamados fake). Se
uma entidade precisa existir em prod (setor, categoria, config), ela tem que estar numa migration —
senão `--skip-seed` (o modo correto de deploy) a perde. Ver também
`gotchas/baseline-consolidado-perde-dados-de-migration.md` (mesmo tema: schema-only baseline perde
o dado de referência).
