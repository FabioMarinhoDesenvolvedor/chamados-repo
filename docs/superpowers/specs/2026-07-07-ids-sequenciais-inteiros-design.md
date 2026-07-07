# Design — IDs sequenciais inteiros (todas as tabelas) — 2026-07-07

> Objetivo do Fabio (07/07): tornar os IDs **concisos e legíveis** — inteiros sequenciais no
> lugar de UUIDs, em **todas** as tabelas, **começando em 1**. Frente própria, decidida como
> não-objetivo na spec do SLA (`2026-07-07-sla-automatico-dois-tempos-design.md`, §Não-objetivos).
> Decisões de escopo abaixo foram todas confirmadas com o Fabio nesta sessão (07/07).

## Decisões aprovadas (Fabio, 2026-07-07)

1. **Escopo: todas as 11 tabelas.** `User`, `Department`, `Ticket`, `TicketCategory`,
   `TicketSubcategory`, `TicketDetailOption`, `TicketComment`, `TicketAttachment`,
   `TicketStatusHistory`, `TicketReadState`, `NotificationOutbox` — todas trocam a PK `String`
   UUID por `Int` sequencial, e todas as FKs acompanham.
2. **Sem dado real a preservar → reset total.** O sistema ainda não foi para produção com dados
   que importam. Estratégia: trocar o schema e **recriar o banco do zero** (drop + migrate +
   seed), sem migração de dados/FKs existentes.
3. **Baseline de migration consolidado.** Apagar as migrations atuais (todas criam tabelas UUID)
   e gerar **uma** migration inicial nova já com Int. Exceção consciente à regra "nunca alterar
   migration já rodada" — justificada por ser um reset total sem dado a preservar.
4. **Começar em 1** (não em 0). Convenção do Postgres (`autoincrement`), sem o footgun do
   `0`-falsy no JavaScript (`if (id)`, `id || x`, `!id` quebrariam para o id `0`).
5. **Tipo `Int`** (32 bits, ~2,1 bi), **não `BigInt`** — evita as dores de serialização de
   `BigInt` em JSON/JS. Suficiente com folga para o volume de chamados.

## Não-objetivos (fora de escopo)

- Migração de dados de produção (não há dado real — decisão 2).
- IDs "amigáveis" com prefixo/ano (ex.: `TI-2026-0001`) — o pedido é inteiro simples.
- Ofuscação/hashids para esconder a sequência — ver §5 (o controle é RBAC, não obscuridade).
- Qualquer mudança de regra de negócio de chamados/SLA — só a representação do identificador.

---

## 1. Modelo de dados

Todos os 11 modelos passam de:
```prisma
id String @id @default(uuid())
```
para:
```prisma
id Int @id @default(autoincrement())
```
E **todas as colunas de FK** acompanham o tipo (`String` → `Int`), mantendo `?` (nullable) onde já
é opcional. Exemplos concretos no `Ticket`: `categoryId Int?`, `subcategoryId Int?`,
`detailOptionId Int?`, `departmentId Int`, `executorDepartmentId Int?`, `requesterId Int`,
`assignedTo Int?`. E nas demais: `TicketComment.ticketId/authorId`, `TicketAttachment.ticketId/commentId`,
`TicketStatusHistory.ticketId/changedBy`, `TicketReadState.userId/ticketId`,
`NotificationOutbox.ticketId`, `TicketCategory.departmentId`, `TicketSubcategory.categoryId`,
`TicketDetailOption.subcategoryId`, etc.

**Não muda:** `TicketAttachment.filename` continua um `randomUUID()` — é o nome físico do arquivo
em disco (evita colisão), **não** uma PK exposta. Idem o valor de enums (`TicketStatus`,
`Priority`, `Complexity`, `Role`, `NotificationStatus`) — são strings de domínio, não IDs.

Como não há dado a preservar, o `Int @default(autoincrement())` já nasce em 1 na sequência padrão
do Postgres — nenhum `ALTER SEQUENCE` necessário.

## 2. Migrations & banco (execução dos `db:*` é do Fabio)

1. Remover a pasta `packages/api/prisma/migrations/*` (todas as migrations atuais).
2. Ajustar `schema.prisma` para Int (§1).
3. Gerar a migration inicial única: `prisma migrate dev --name init` (recria a pasta com **um**
   `migration.sql` baseline, já com multi-setorial + SLA + Int).
4. Dev: `db:reset` (drop + migrate + seed) recria o banco limpo. `db:seed`/`seed-admin` recriam os
   dados de desenvolvimento (as entidades ganham ids 1, 2, 3… na ordem de criação).
5. **Sequenciamento:** fazer este baseline **depois** de o SLA estar fechado (smoke ok / decisão de
   merge), para não consolidar um schema que o smoke do SLA ainda possa mudar. Até lá, o trabalho
   de código (tipos/validações/frontend) pode andar; o baseline é o último passo antes do reset.

## 3. Backend (NestJS)

### `@chamados/shared`
- Todo campo `id: string` → `id: number` (em `User`, `Department`, `Ticket`, `TicketCategory`,
  `TicketSubcategory`, `TicketDetailOption`, `TicketComment`, `TicketAttachment`,
  `TicketStatusHistory`, e nos DTOs de entrada/saída).
- Toda FK correspondente → `number` / `number | null`: `categoryId`, `subcategoryId`,
  `detailOptionId`, `departmentId`, `executorDepartmentId`, `requesterId`, `assignedTo`,
  `ticketId`, `commentId`, `authorId`, `changedBy`, `userId`, etc.
- Inputs que carregam ids (`CreateTicketInput`, `UpdateTicketInput`, `AssignTicketInput`,
  filtros de query com `categoryId`/`subcategoryId`, `AddAttachmentsInput.commentId`,
  `CreateUserInput.departmentId`, report queries) → `number`.

### Validação (~38 sites)
- Parâmetros de rota: `@Param('id', ParseUUIDPipe)` → `@Param('id', ParseIntPipe)` (idem
  `attachmentId`). `ParseIntPipe` já rejeita não-numérico com 400.
- DTOs: `@IsUUID()` → `@IsInt()`. Onde o valor vem de **query string** ou **param** (chega como
  string), adicionar `@Type(() => Number)` (class-transformer) para coagir antes do `@IsInt()`.
  Em body JSON os números já chegam tipados.

### Outbox / notificação por e-mail (ponto de atenção)
Hoje `TicketsService.create()` faz `const id = randomUUID()` (linha ~134) para montar o link do
e-mail **antes** do insert e enfileirar a outbox na mesma transação. Com `autoincrement`, o id só
existe **após** o insert. Mudança:
- `create()` deixa de pré-gerar id. Passa a `createWithHistory` os **dados** da notificação
  (destinatário + os campos para montar o e-mail: título, nome/setor do solicitante, prioridade,
  descrição, `appUrl`), em vez do e-mail já pronto.
- Dentro da transação de `createWithHistory`, **após** criar o ticket (que retorna o `id` real),
  montar o e-mail com `buildTicketEmail({ ticketId: ticket.id, … })` e inserir a linha da outbox.
- Mantém a atomicidade (ticket + outbox na mesma tx) e a garantia "sem e-mail órfão". O link passa
  a `${APP_URL}/tickets/<n>`.
- `buildTicketEmail` continua função pura; só muda o tipo de `ticketId` (string → number) na sua
  assinatura e o id passa a ser lido do ticket criado.

### Anexos
`TicketAttachment.filename` segue `randomUUID()` (nome de arquivo em disco). Só a PK `id` do anexo
vira Int; as rotas `/tickets/:id/attachments/:attachmentId` passam a `ParseIntPipe` nos dois params.

## 4. Frontend (React)

- `useParams()` devolve o id como **string** da URL (ex.: `"1"`). Converter na borda com
  `Number(id)` ao tipar/usar contra as APIs e os tipos compartilhados (agora `number`).
- Comparações de id passam a numéricas; chaves do React Query que usam id seguem funcionando
  (chave por `number`).
- URLs continuam legíveis: `/tickets/1`, `/tickets/2`… (a rota casa a string, o backend parseia).
- Ajustar quaisquer lugares que assumam id string (ex.: `id === ''` como "sem id" vira
  `Number.isNaN(n)`/`id == null`).

## 5. Segurança (trade-off registrado)

Inteiros sequenciais são **enumeráveis**: qualquer um pode tentar `/tickets/1`, `/2`, `/3`… na URL.
Hoje o UUID torna isso inviável por obscuridade. **O controle não muda:** o acesso já é garantido
pelo RBAC e por `ensureCanView`/`listWhere` (USER só vê os próprios; OPERATOR escopado só o próprio
setor executor; ADMIN tudo). A enumeração passa a revelar **existência** (um 403 vs 404), nunca
**conteúdo**. Aceito como consequência conhecida; sem hashids/ofuscação (não-objetivo). Verificar no
smoke que um usuário sem acesso recebe 403/404 ao tentar um id alheio.

## 6. Alternativas descartadas

- **Só o número do chamado** (Ticket ganha um `number` sequencial; resto segue UUID): bem menos
  invasivo, mas o Fabio quer todos os IDs inteiros.
- **Começar em 0:** footgun do `0`-falsy no JS espalhado por checks de id; descartado por 1.
- **`BigInt`:** desnecessário para o volume; complica JSON/serialização.
- **IDs com prefixo/ano (`TI-2026-0001`):** o pedido é inteiro simples; fora de escopo.
- **Migração de dados preservando UUIDs→Int:** não há dado real; reset é mais simples e seguro.

## 7. Verificação (antes de entregar)

- Build na ordem `shared → api → web` limpo; `tsc --noEmit` limpo (o `id: number` propaga por
  todas as camadas — o compilador acha os pontos que faltam converter).
- `npm test -w @chamados/api`: ajustar fixtures/stubs que usam ids string (`'t1'`, `'u1'`, `'dep'`…)
  para números; regressão com número real.
- Smoke (Fabio, banco recriado): `db:reset`; abrir chamado → `id = 1`; `/tickets/1` abre; abrir o
  segundo → `id = 2`; conferir o e-mail de notificação com link `/tickets/<n>` correto; usuário sem
  acesso a `/tickets/1` recebe 403/404; anexos e comentários funcionam com ids inteiros.

## 8. Impacto em memória/docs (na implementação)

- Nova decisão `decisions/ids-sequenciais-inteiros.md` (UUID→Int em tudo, começa em 1, reset +
  baseline consolidado, trade-off de enumeração). Linkar esta spec.
- Atualizar `architecture/database.md` (PKs Int, sequência) e o que descrever UUIDs.
- `procedures/setup-local.md` se mencionar reset/seed com ids.
- Handoff de sessão ao final.
