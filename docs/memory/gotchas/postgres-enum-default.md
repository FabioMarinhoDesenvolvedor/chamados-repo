# Postgres: novo valor de enum + uso como DEFAULT na mesma migration falha

Data: 2026-06-26

## Sintoma
`prisma migrate dev` falha com:
`ERROR: unsafe use of new value "TRIAGE" of enum type "TicketStatus"` (código 55P04),
`HINT: New enum values must be committed before they can be used.`

## Causa
No Postgres, um valor adicionado a um enum (`ALTER TYPE ... ADD VALUE`) só pode ser USADO depois
de commitado. O Prisma gera UMA migration (uma transação) que adiciona o valor E o usa como
`DEFAULT` da coluna — isso quebra.

## Solução (duas migrations separadas)
1. Migration isolada só com o ADD VALUE:
   `ALTER TYPE "TicketStatus" ADD VALUE 'TRIAGE' BEFORE 'OPEN';`
2. Migration seguinte com o resto (alterar default, colunas, tabelas).

Se já falhou no meio: `prisma migrate resolve --rolled-back <nome>` para limpar o estado,
ajustar os arquivos SQL e então `prisma migrate deploy`.

## Como rodar prisma fora do script npm (Windows/workspaces)
O binário é hoisteado p/ a raiz: `node_modules/.bin/prisma.cmd`. Passe o schema e a env:
`$env:DATABASE_URL="..."; & "<root>\node_modules\.bin\prisma.cmd" migrate deploy --schema "<api>\prisma\schema.prisma"`.
Ver também [[windows-brace-expansion]].
