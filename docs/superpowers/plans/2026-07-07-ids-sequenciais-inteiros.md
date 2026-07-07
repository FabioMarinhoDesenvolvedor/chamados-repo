# IDs sequenciais inteiros (UUID → Int) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a PK `String @id @default(uuid())` por `Int @id @default(autoincrement())` em todas as 11 tabelas (e todas as FKs), recriando o banco do zero, com IDs começando em 1.

**Architecture:** Mudança de tipo que se propaga do schema (Prisma) para os tipos compartilhados (`number`), o backend (validação `ParseIntPipe`/`@IsInt`, auth, serviço/repo) e o frontend (`Number(id)` na borda). Sem migração de dados — reset total com um baseline de migration consolidado. O compilador TypeScript é a rede de segurança: com `id: number` no `@chamados/shared`, o build aponta cada ponto que falta converter.

**Tech Stack:** TypeScript strict, NestJS, Prisma/PostgreSQL (`autoincrement`), React/Vite, `@chamados/shared`, testes `node:test`.

## Global Constraints

- TypeScript strict, **sem `any`**. Tipos compartilhados só em `@chamados/shared` — nunca duplicar.
- Ordem de build/verificação sempre `shared → api → web`.
- Tipo **`Int`** (não `BigInt`). IDs começam em **1** (sequência padrão do Postgres — sem `ALTER SEQUENCE`).
- **`prisma generate` (= `npm run db:generate`) NÃO toca o banco** — só lê o schema; pode e deve ser rodado em sessão para regenerar o client e permitir o build da api. Já `prisma migrate`/`db:reset`/`db:deploy` **tocam o banco → papel do Fabio**.
- Reset total: sem migração de dados; um único baseline `migration.sql`. Exceção consciente à regra "nunca alterar migration já rodada" (é reset, não edição de migration aplicada).
- `TicketAttachment.filename` continua `randomUUID()` (nome de arquivo em disco, não PK).
- Sequenciamento: este trabalho é uma frente separada do SLA. O baseline/reset do banco é o **último** passo, executado pelo Fabio depois de o SLA estar fechado. O código (Tasks 1-5) pode andar antes.
- Commits: conventional commits com escopo.

## File Structure

- `packages/api/prisma/schema.prisma` — 11 PKs `Int @id @default(autoincrement())` + todas as FKs `Int`.
- `packages/api/prisma/migrations/` — apagar as antigas; **um** baseline `*_init/migration.sql`.
- `packages/shared/src/types.ts` — todo `id`/FK `string` → `number`. **Fonte dos tipos para api e web.**
- `packages/api/src/modules/auth/*` + `common/decorators/current-user.decorator.ts` — `sub`/`userId`/`departmentId` → `number`.
- `packages/api/src/modules/*/dto/*.ts` — `@IsUUID()` → `@IsInt()` (+ `@Type(() => Number)` onde vem de query/param).
- `packages/api/src/modules/*/*.controller.ts` — `ParseUUIDPipe` → `ParseIntPipe`.
- `packages/api/src/modules/tickets/tickets.service.ts` + `tickets.repository.ts` — remove `randomUUID()` pré-gerado; monta a outbox dentro da tx com o `id` real.
- `packages/api/prisma/seed.ts` + `seed-admin.ts` — devem tipar contra o client Int (criam e usam ids retornados).
- `packages/web/src/features/*/api.ts` + `pages/*` — `id: number`, `Number(id)` na borda, `ReportsPage.shortId` sem `.slice`.
- `docs/memory/decisions/ids-sequenciais-inteiros.md` + `architecture/database.md` + handoff.

---

### Task 1: Schema → Int + baseline de migration consolidado + regenerar client

**Files:**
- Modify: `packages/api/prisma/schema.prisma` (todas as 11 PKs + FKs)
- Delete: conteúdo de `packages/api/prisma/migrations/*` (todas as pastas de migration atuais)
- Create: `packages/api/prisma/migrations/20260707130000_init/migration.sql` + `migrations/migration_lock.toml`

**Interfaces:**
- Produces: schema com PKs `Int @id @default(autoincrement())` e FKs `Int`; client Prisma regenerado (tipos `number`); baseline SQL único.

- [ ] **Step 1: Converter todas as PKs e FKs no `schema.prisma`**

Em cada um dos 11 modelos, trocar a linha da PK:
```prisma
  id  String  @id @default(uuid())
```
por:
```prisma
  id  Int  @id @default(autoincrement())
```
E cada **coluna de FK** de `String`/`String?` para `Int`/`Int?` (mantendo `@map(...)`, `?`, `@relation`, `@unique`, `onDelete` inalterados). Colunas a converter (mapa completo):
- `User`: `id`; `departmentId String? @map("department_id")` → `Int?`.
- `Department`: `id`.
- `Ticket`: `id`; `categoryId Int?`, `subcategoryId Int?`, `detailOptionId Int?`, `departmentId Int`, `executorDepartmentId Int?`, `requesterId Int`, `assignedTo Int?`, `lastActivityBy Int?`. (`lastActivityBy` referencia um user — converter para `Int?`.)
- `TicketCategory`: `id`; `departmentId Int?`.
- `TicketSubcategory`: `id`; `categoryId Int`.
- `TicketDetailOption`: `id`; `subcategoryId Int`.
- `TicketComment`: `id`; `ticketId Int`, `authorId Int`.
- `TicketAttachment`: `id`; `ticketId Int`, `commentId Int?`. (**`filename` continua `String`.**)
- `TicketStatusHistory`: `id`; `ticketId Int`, `fromStatus`/`toStatus` inalterados (enum), `changedBy Int`.
- `TicketReadState`: `id`; `userId Int`, `ticketId Int` (a chave composta `@@unique([userId, ticketId])` continua).
- `NotificationOutbox`: `id`; `ticketId Int`.

> Não alterar valores de enum, `@map`, índices, `@@unique`, `@relation name`, `onDelete`. Só o tipo escalar das PKs/FKs.

- [ ] **Step 2: Apagar as migrations antigas**

Run (de `packages/api`): `rm -rf prisma/migrations/*` (remove todas as pastas antigas e o `migration_lock.toml`; serão recriados).

- [ ] **Step 3: Gerar o baseline SQL sem tocar o banco**

Run (de `packages/api`):
```bash
mkdir -p prisma/migrations/20260707130000_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260707130000_init/migration.sql
printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml
```
Expected: `migration.sql` gerado com `CREATE TABLE ... "id" SERIAL ... PRIMARY KEY` (ou `INTEGER GENERATED ... AS IDENTITY`) para as 11 tabelas e FKs `INTEGER`. `migrate diff` é offline (não conecta no banco).

- [ ] **Step 4: Validar o schema e regenerar o client**

Run (de `packages/api`): `npx prisma validate` e `npm run db:generate -w @chamados/api`
Expected: `The schema at prisma/schema.prisma is valid` e client gerado sem erro. (`db:generate` = `prisma generate`, offline.) O client agora tipa todos os ids como `number`.

- [ ] **Step 5: Conferir o baseline**

Run: `grep -c "CREATE TABLE" packages/api/prisma/migrations/20260707130000_init/migration.sql`
Expected: `11`. Conferir a olho que nenhuma coluna `id` saiu como `TEXT`/`UUID`.

- [ ] **Step 6: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations
git commit -m "feat(api): PKs/FKs inteiras com autoincrement + baseline de migration consolidado"
```

---

### Task 2: Tipos compartilhados → `number`

**Files:**
- Modify: `packages/shared/src/types.ts`

**Interfaces:**
- Produces: todos os `id` e FKs como `number`/`number | null`. Base de tipo para api e web.

- [ ] **Step 1: Converter todo `id`/FK `string` para `number`**

Em `packages/shared/src/types.ts`, trocar `string` por `number` em cada campo de identificador (manter `| null`/`?` onde já existem). Campos (por linha atual):
- `User`: `id` (6), `departmentId | null` (10).
- `Department`: `id` (29).
- `TicketCategory`: `id` (41); `TicketSubcategory`: `id` (49), `categoryId` (50); `TicketDetailOption`: `id` (58), `categoryId`/`subcategoryId` conforme.
- `Ticket`: `id` (73), `categoryId | null` (76), `subcategoryId | null` (77), `detailOptionId | null` (81), `departmentId` (86), `executorDepartmentId | null` (87), `requesterId` (89), e (não listados no grep mas presentes) `assignedTo: number | null`, `lastActivityBy: number | null`.
- `TicketAttachment`: `id` (113), `ticketId` (114), `commentId | null` (115).
- `TicketComment`: `id` (124), `ticketId` (125), `authorId` (126).
- `TicketStatusHistory`: `id` (134), `ticketId` (135), `changedBy: number`.
- Inputs/DTOs: `CreateTicketInput` `categoryId`/`subcategoryId` (166/167), `detailOptionId?` (169), `departmentId` (172), `requesterId?` (174); `UpdateTicketInput.departmentId?` (178); `CreateUserInput.departmentId? | null` (185); `UpdateUserInput.departmentId? | null` (215); filtros `categoryId?`/`subcategoryId?` (230/231, 291/292); report: `actorId` (265), `ticketId` (267), `user.id` (281), `userId?` (288).
- `AssignTicketInput.assignedTo` (buscar no arquivo) → `number`.

> Varra o arquivo inteiro: qualquer campo cujo nome seja `id` ou termine em `Id`/`Id | null` vira `number`. Campos que não são identificadores (`email`, `name`, `title`, `originLocation`, `filename`, `mime`, datas ISO como `createdAt`) **permanecem `string`**.

- [ ] **Step 2: Build do shared**

Run: `npm run build -w @chamados/shared`
Expected: build limpo. Consumidores api/web quebram até as Tasks 3-4 — esperado.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): identificadores como number (IDs inteiros)"
```

---

### Task 3: Backend — auth, validação, serviço/repo (outbox) e seeds → build & testes verdes

**Files:**
- Modify: `packages/api/src/common/decorators/current-user.decorator.ts`, `modules/auth/jwt-payload.interface.ts`, `modules/auth/strategies/jwt.strategy.ts`, `modules/auth/auth.service.ts`
- Modify: `modules/departments/departments.controller.ts`, `modules/tickets/tickets.controller.ts`, `modules/users/users.controller.ts`
- Modify DTOs: `modules/tickets/dto/{create-ticket,assign-ticket,add-attachments,update-ticket,ticket-query}.dto.ts`, `modules/users/dto/{create-user,update-user}.dto.ts`, `modules/reports/dto/report-query.dto.ts`
- Modify: `modules/tickets/tickets.service.ts`, `modules/tickets/tickets.repository.ts`
- Verify: `prisma/seed.ts`, `prisma/seed-admin.ts` tipam contra o client Int
- Modify (conforme necessário): specs cujos fixtures de id sejam usados em asserção de tipo/número

**Interfaces:**
- Consumes: client Prisma Int (Task 1), tipos `number` (Task 2).
- Produces: api que compila e testa verde com ids inteiros; e-mail da outbox montado dentro da tx com o `id` real.

- [ ] **Step 1: Auth — `sub`/`userId`/`departmentId` para `number`**

- `common/decorators/current-user.decorator.ts`: `AuthUser.userId: number`; `AuthUser.departmentId: number | null`.
- `modules/auth/jwt-payload.interface.ts`: `sub: number`.
- `modules/auth/strategies/jwt.strategy.ts`: `validate(payload)` usa `payload.sub` (number) em `users.findById`; `userId: user.id`, `departmentId: user.departmentId` já são number vindos do client.
- `modules/auth/auth.service.ts`: `payload.sub = user.id` (number) — sem cast.

> `sub` como number é aceito no JWT. O `jwt.strategy.spec.ts` usa `sub: 'u1'`/`userId: 'u1'` — atualizar os fixtures para `1` para refletir o tipo real.

- [ ] **Step 2: Controllers — `ParseUUIDPipe` → `ParseIntPipe`**

Em `departments.controller.ts`, `tickets.controller.ts`, `users.controller.ts`: trocar todo `@Param('id', ParseUUIDPipe) id: string` por `@Param('id', ParseIntPipe) id: number` (idem `@Param('attachmentId', ParseUUIDPipe) attachmentId: string` → `ParseIntPipe … : number`), e o import `ParseUUIDPipe` → `ParseIntPipe` (de `@nestjs/common`). Sites: departments L7/L36; tickets L6/L60/67/77/86/96/105/115/125/126; users L7/L54/60.

- [ ] **Step 3: DTOs — `@IsUUID()` → `@IsInt()` (+ coerção em query/param)**

- **Body DTOs** (`create-ticket`, `assign-ticket`, `add-attachments`, `update-ticket`, `create-user`, `update-user`): `@IsUUID()` → `@IsInt()`; campo `: string` → `: number`; remover import `IsUUID`, adicionar `IsInt` (de `class-validator`).
- **Query DTOs** (`ticket-query.dto.ts`, `report-query.dto.ts`): além de `@IsInt()`, adicionar `@Type(() => Number)` (de `class-transformer`) acima de cada id, porque query string chega como texto. `ticket-query.dto.ts` já importa `IsInt` (usa em page/pageSize) e provavelmente `@Type` — reutilizar.

> Remover imports agora não usados (`IsUUID`) e manter os demais. Não mexer em validações não-id (`@IsString`, `@MinLength`, `@IsIn`, `@IsDateString`).

- [ ] **Step 4: Outbox — remover o `randomUUID()` pré-gerado; montar o e-mail dentro da tx**

Em `tickets.service.ts` `create()`:
- Remover `const id = randomUUID()` (linha ~134) e o uso de `id` no `buildTicketEmail`/no `createWithHistory({ id, … })`.
- Em vez de montar o e-mail no serviço, passar a `createWithHistory` os **dados** para montá-lo: `notification?: { toEmail: string; emailInput: Omit<BuildTicketEmailArgs, 'ticketId'> }` (título, `requesterName`, `requesterDepartmentName`, `priority`, `description`, `originLocation`, `createdAt`, `appUrl`).

Em `tickets.repository.ts` `createWithHistory()`:
- Remover `id: input.id` do `tx.ticket.create` (autoincrement gera).
- Após criar o `ticket` (que retorna `ticket.id`), se `input.notification` existir, montar `const email = buildTicketEmail({ ticketId: ticket.id, ...input.notification.emailInput })` e `tx.notificationOutbox.create({ data: { ticketId: ticket.id, toEmail: input.notification.toEmail, subject: email.subject, body: email.body } })`.
- `buildTicketEmail` (em `notifications/notification-email.ts`): trocar o tipo de `ticketId` de `string` para `number` na assinatura; o corpo do link `${appUrl}/tickets/${ticketId}` funciona igual.

> Mantém a atomicidade (ticket + outbox na mesma tx) e remove a dependência do id pré-gerado. Atualizar os testes de `notification-email.spec.ts`/`tickets.service.spec.ts` que passavam `ticketId` string para número, e o teste que verifica o enqueue na tx.

- [ ] **Step 5: Ajustar fixtures de id nos specs (string → number) onde afeta o teste**

Nos specs de tickets/auth/notifications, trocar ids literais string (`'t1'`, `'u1'`, `'dep'`, `'dep1'`, `'op1'`, `'cat'`, `'sub'`, `'exec'`) por números coerentes (`1`, `2`, …) **onde o teste compara/usa o id como número** ou monta a projeção. Manter a lógica dos testes; só o tipo do id muda.

- [ ] **Step 6: Regenerar client, build e testes**

Run (de `packages/api`):
```bash
npm run db:generate -w @chamados/api
npm run build -w @chamados/api
npm test -w @chamados/api
```
Expected: `db:generate` ok (offline); `nest build` **limpo** (o client é Int, o shared é number); testes verdes com número real (reportar `NN/NN`). Se o build acusar um id `string` remanescente, é um site que faltou converter — corrigir.

- [ ] **Step 7: Verificar que os seeds tipam**

Run (de `packages/api`): `npx tsc --noEmit -p tsconfig.json` (inclui `prisma/seed.ts` se estiver no escopo) ou `npx ts-node --transpile-only prisma/seed.ts --help` não se aplica; use `npx tsc --noEmit prisma/seed.ts prisma/seed-admin.ts --moduleResolution node --esModuleInterop --skipLibCheck` para checar tipos. Corrigir qualquer id `string` literal nos seeds (não deve haver — os ids vêm de `create`/`upsert`).
Expected: sem erro de tipo de id nos seeds. **Não** rodar `db:seed`/`db:reset` (banco — Fabio).

- [ ] **Step 8: Commit**

```bash
git add packages/api/src packages/api/prisma/seed.ts packages/api/prisma/seed-admin.ts
git commit -m "feat(api): IDs inteiros em auth, validação, serviço/repo e outbox montada na tx"
```

---

### Task 4: Frontend — `Number(id)` na borda e consumidores

**Files:**
- Modify: `packages/web/src/features/{tickets,users,departments}/api.ts`
- Modify: `packages/web/src/pages/TicketDetailPage.tsx`, `pages/admin/ReportsPage.tsx`, `pages/admin/UsersPage.tsx`, `pages/NewTicketPage.tsx` (e o que o compilador apontar)

**Interfaces:**
- Consumes: tipos `number` (Task 2).
- Produces: web que compila com ids numéricos.

- [ ] **Step 1: Hooks de API — `id: string` → `id: number`**

Em `features/tickets/api.ts` (`useTicket`, `useUpdateTicket`, `useUpdateStatus`, `useAssignTicket`, `useAddComment`, `useCloseTicket`, e o `ticketId: string` na L81), `features/users/api.ts` (`{ id }: { id: number }`, `id: number` no delete), `features/departments/api.ts` (delete `id: number`): trocar as assinaturas `string` → `number`. A interpolação de URL `/tickets/${id}` funciona igual com número. Comparações como `t.id === id` (L137) ficam numéricas.

- [ ] **Step 2: `useParams` — converter na borda**

Em `TicketDetailPage.tsx`: `const { id = '' } = useParams()` devolve string; criar `const ticketId = Number(id)` e usar `ticketId` nos hooks/comparações (ex.: `ticket.assignedTo === user?.id` já numérico). Guardar contra `Number.isNaN(ticketId)` onde antes checava `id === ''`.

- [ ] **Step 3: `ReportsPage.shortId` — sem `.slice` em número**

Em `pages/admin/ReportsPage.tsx:31`, trocar `const shortId = (id: string) => id.slice(0, 8)` por `const shortId = (id: number) => \`#${id}\``. Ajustar os chamadores (o id agora é number).

- [ ] **Step 4: Selects e comparações**

- `NewTicketPage.tsx`: `onSelectRequester(id: string)` recebe o `value` do `<select>` (string) → converter com `Number(id)` antes de comparar `u.id === n`; `d.id === user?.departmentId` fica numérico (o value do option deve ser o id numérico).
- `UsersPage.tsx`: `editingId` tipado como `number | null`; `editingId === u.id` numérico.
- Qualquer `value={id}`/`key={id}` em `<option>`/listas segue funcionando (React aceita number); onde o `onChange` devolve `e.target.value` (string) e ele é um id, envolver com `Number(...)`.

- [ ] **Step 5: Build do web (gate real)**

Run: `npm run build -w @chamados/shared && npm run build -w @chamados/web`
Expected: **limpo** (`tsc --noEmit && vite build`). O web não depende do client Prisma, então este build valida toda a propagação de `number`. Corrigir cada site que o compilador apontar (a rede de segurança do tipo).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): IDs numéricos (Number na borda, shortId sem slice, selects)"
```

---

### Task 5: Memória & documentação

**Files:**
- Create: `docs/memory/decisions/ids-sequenciais-inteiros.md`
- Modify: `docs/memory/architecture/database.md` (PKs Int/sequência; remover menção a UUID)
- Modify: `docs/memory/README.md` (índice: decisão + handoff)
- Modify (se mencionar): `docs/memory/procedures/setup-local.md` (reset/seed com ids)
- Create: `docs/memory/handoffs/sessao-2026-07-07-ids-inteiros.md`

- [ ] **Step 1: Decisão nova**

`decisions/ids-sequenciais-inteiros.md`: problema (ids longos/UUID), decisão (Int autoincrement, começa em 1, todas as tabelas, reset + baseline consolidado, sem BigInt), trade-off de enumeração (controle é RBAC/`ensureCanView`, não obscuridade), link para a spec.

- [ ] **Step 2: Atualizar `architecture/database.md`** (PKs inteiras, sequência começando em 1, FKs Int; ajustar qualquer texto que descreva UUID).

- [ ] **Step 3: Indexar no `README.md`** (decisão nova + handoff). Ajustar `procedures/setup-local.md` se ele descreve ids.

- [ ] **Step 4: Handoff**

`handoffs/sessao-2026-07-07-ids-inteiros.md`: Contexto, Decisões, O que mudou (commits), **Verificação executada com números reais** (build shared/api/web limpos; `NN/NN` testes; smoke = Fabio), Pendências (o reset do banco e o smoke são do Fabio — ver Task 6), e PRÓXIMO passo.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(memory): decisão dos IDs inteiros, database.md e handoff"
```

---

### Task 6: Verificação final

**Files:** nenhum (execução/validação).

- [ ] **Step 1: Build na ordem de dependência**

Run: `npm run db:generate -w @chamados/api && npm run build -w @chamados/shared && npm run build -w @chamados/api && npm run build -w @chamados/web`
Expected: quatro passos limpos.

- [ ] **Step 2: Testes da API**

Run: `npm test -w @chamados/api`
Expected: `NN/NN pass` (anotar o número).

- [ ] **Step 3: Reset do banco + smoke (Fabio — toca o banco)**

Roteiro:
1. `npx prisma migrate reset` (drop + aplica o baseline `20260707130000_init` + roda o seed) — recria o banco com PKs inteiras. (Alternativa: `migrate dev`/`db:deploy` + `db:seed`.)
2. `npm run dev`; abrir um chamado → conferir `id = 1`; `/tickets/1` abre; abrir o segundo → `id = 2`.
3. Conferir o e-mail de notificação (stub/log) com link `/tickets/<n>` correto.
4. Um usuário sem acesso a `/tickets/1` (de outro solicitante/setor) recebe **403/404** (RBAC — não obscuridade do id).
5. Comentar, anexar e mudar status funcionam com ids inteiros. Limpar dados de teste.

> **Reportar falha/pulo explicitamente no handoff — nunca como sucesso.** `migrate reset`/`db:*` e o smoke são do Fabio. Deploy em produção: `db:deploy` do baseline + build `shared→api→web` + restart.

---

## Self-Review

**Spec coverage:**
- §1 modelo de dados (11 PKs + FKs Int, filename UUID mantido) → Task 1. ✔
- §2 migrations (apagar + baseline consolidado; db:* do Fabio) → Task 1 (baseline) + Task 6 (reset). ✔
- §3 backend (shared number; ParseIntPipe; IsInt+@Type; outbox sem id pré-gerado; auth) → Tasks 2, 3. ✔
- §4 frontend (Number na borda, shortId, selects) → Task 4. ✔
- §5 segurança (enumeração; controle RBAC) → registrado na decisão (Task 5) e verificado no smoke (Task 6). ✔
- §6 alternativas descartadas → sem task (contexto). ✔
- §7 verificação → Tasks 3, 4, 6. §8 memória/docs → Task 5. ✔

**Placeholder scan:** transformações mecânicas dadas por regra explícita + lista de sites (file:line) — concretas e acionáveis. Sem TBD/TODO.

**Type consistency:** `AuthUser.userId: number`/`departmentId: number | null` e `JwtPayload.sub: number` idênticos entre Task 3 e os consumidores; `notification: { toEmail, emailInput }` idêntico entre `tickets.service` e `createWithHistory` (Task 3 Step 4); `buildTicketEmail({ ticketId: number, … })` idêntico entre serviço/repo/testes. `id: number` uniforme entre Task 2 (tipos), Task 3 (api) e Task 4 (web).
