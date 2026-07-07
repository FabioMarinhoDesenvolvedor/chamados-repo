# IDs sequenciais inteiros em todas as tabelas

Data: 2026-07-07

## Contexto
Fabio pediu IDs concisos e legíveis em todo o sistema, trocando UUID por inteiros sequenciais.
Como ainda não há dado real a preservar, a migração de dados foi descartada em favor de reset
total com baseline novo.

## Decisão
- Todas as 11 tabelas passam a usar `Int @id @default(autoincrement())`.
- Todas as FKs acompanham o mesmo tipo (`Int` / `Int?`).
- A sequência começa em `1`, não em `0`, para evitar bugs de `0` falsy no JavaScript.
- O tipo escolhido é `Int`, não `BigInt`.
- O histórico antigo de migrations UUID é substituído por um baseline único
  `20260707130000_init`, gerado a partir do schema atual.
- `TicketAttachment.filename` continua UUID aleatório, porque é nome físico de arquivo em disco,
  não PK do domínio.

## Trade-off
IDs inteiros são enumeráveis (`/tickets/1`, `/tickets/2`, ...). O controle continua sendo RBAC
e `ensureCanView`, não obscuridade do identificador. Isso pode revelar existência, mas não
conteúdo do chamado.

## Consequências
- `@chamados/shared` passa a expor IDs/FKs como `number`.
- API troca `ParseUUIDPipe` por `ParseIntPipe` e DTOs `@IsUUID()` por `@IsInt()`.
- O padrão outbox do e-mail muda: o link do chamado passa a ser montado com o ID real após o
  insert, dentro da mesma transação.
- Frontend converte IDs vindos da URL/select na borda com `Number(...)`.
- O reset/migrate real do banco continua sendo papel do Fabio.

## Referências
- `docs/superpowers/specs/2026-07-07-ids-sequenciais-inteiros-design.md`
- `docs/superpowers/plans/2026-07-07-ids-sequenciais-inteiros.md`
