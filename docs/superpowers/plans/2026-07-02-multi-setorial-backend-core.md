# Multi-Setorial — Backend Core (Plano 1/4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao backend (schema Prisma + NestJS) a base multi-setorial: 15 `Department`s reais com flags de solicitante/executor/aprovação, roteamento `categoria → setor executor`, RBAC de `OPERATOR` por setor, e o fluxo de aprovação (`PENDING_APPROVAL`) para Presidência — sem tocar em notificação (Plano 2), frontend (Plano 3) ou totem (Plano 4).

**Architecture:** Extensão aditiva do schema atual (Prisma/Postgres) + `TicketsService`/`DepartmentsService` existentes. `TicketCategory.departmentId` (novo) é a fonte de verdade do roteamento; `Ticket.executorDepartmentId` (novo) é o valor denormalizado gravado na criação. RBAC de `OPERATOR` usa `User.departmentId` (já existe) propagado para `AuthUser` via `JwtStrategy` (já faz lookup do usuário a cada request — zero query nova).

**Tech Stack:** NestJS 10, Prisma 6 (Postgres), TypeScript strict, `class-validator`, testes `node:test` (transpile-only, sem tocar em banco real).

## Global Constraints

- KISS: soluções simples — se parece over-engineered, é (CLAUDE.md).
- DRY/SOLID: lógica duplicada vira função/service; uma responsabilidade por módulo.
- TypeScript strict mode em todo o código novo.
- Nomes de arquivo kebab-case; variável/função camelCase; tipo/interface PascalCase; enum PascalCase com valores UPPER_SNAKE_CASE.
- Migrations **nunca** alteradas depois de rodadas — sempre nova migration.
- Migrations **aditivas/não-destrutivas** (nullable ou `@default`) — nenhum dado existente pode quebrar.
- Novo valor de enum Postgres precisa de migration **isolada** (não pode ser usado na mesma transação em que foi criado) — ver `docs/memory/gotchas/postgres-enum-default.md`.
- REST simples — sem GraphQL/gRPC.
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `test:`).
- Nenhuma decisão aprovada anterior (`prazo-complexidade-automatica`, `notificacao-polling`, matriz de prioridade) é contradita — ver `docs/superpowers/specs/2026-07-02-multi-setorial-design.md`.

---

## File Structure

**Schema/migrations:**
- Modify: `packages/api/prisma/schema.prisma`
- Create: `packages/api/prisma/migrations/20260702090000_add_multi_setor_columns/migration.sql`
- Create: `packages/api/prisma/migrations/20260702090100_add_pending_approval_status/migration.sql`
- Create: `packages/api/prisma/migrations/20260702090200_seed_setores_multi_setorial/migration.sql`
- Modify: `packages/api/prisma/seed.ts`

**Shared package:**
- Modify: `packages/shared/src/enums.ts`
- Modify: `packages/shared/src/types.ts`

**Auth (propagação de `departmentId`/`isKiosk`):**
- Modify: `packages/api/src/common/decorators/current-user.decorator.ts`
- Modify: `packages/api/src/modules/auth/strategies/jwt.strategy.ts`
- Modify: `packages/api/src/modules/users/user.mapper.ts`

**Departments:**
- Modify: `packages/api/src/modules/departments/departments.repository.ts`
- Modify: `packages/api/src/modules/departments/departments.service.ts`
- Modify: `packages/api/src/modules/departments/dto/create-department.dto.ts`
- Create: `packages/api/src/modules/departments/departments.service.spec.ts`

**Tickets:**
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.ts`
- Modify: `packages/api/src/modules/tickets/tickets.controller.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.spec.ts`

---

### Task 1: Schema Prisma — Department/User/TicketCategory/Ticket/TicketStatus

**Files:**
- Modify: `packages/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `Department.isRequesterDept/isExecutorDept/requiresApproval/notificationEmail: boolean/boolean/boolean/string|null`; `User.isKiosk: boolean`; `TicketCategory.departmentId: string|null`; `Ticket.executorDepartmentId/originLocation: string|null`; enum `TicketStatus` com `PENDING_APPROVAL`. Consumido por todas as tasks seguintes via Prisma Client gerado.

- [ ] **Step 1: Editar o enum `TicketStatus`**

Em `packages/api/prisma/schema.prisma`, troque:
```prisma
enum TicketStatus {
  TRIAGE
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```
por:
```prisma
enum TicketStatus {
  TRIAGE
  PENDING_APPROVAL
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```

- [ ] **Step 2: Editar o model `User`**

Troque:
```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String   @map("password_hash")
  role         Role     @default(USER)
  mustChangePassword Boolean @default(true) @map("must_change_password")
  departmentId String?  @map("department_id")
  department   Department? @relation(fields: [departmentId], references: [id])
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
```
por:
```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String   @map("password_hash")
  role         Role     @default(USER)
  mustChangePassword Boolean @default(true) @map("must_change_password")
  isKiosk      Boolean  @default(false) @map("is_kiosk")
  departmentId String?  @map("department_id")
  department   Department? @relation(fields: [departmentId], references: [id])
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
```

- [ ] **Step 3: Editar o model `Department`**

Troque:
```prisma
model Department {
  id             String   @id @default(uuid())
  name           String   @unique
  priorityWeight Int      @map("priority_weight")
  createdAt      DateTime @default(now()) @map("created_at")

  users   User[]
  tickets Ticket[]

  @@map("departments")
}
```
por:
```prisma
model Department {
  id                String   @id @default(uuid())
  name              String   @unique
  priorityWeight    Int      @map("priority_weight")
  isRequesterDept   Boolean  @default(true)  @map("is_requester_dept")
  isExecutorDept    Boolean  @default(false) @map("is_executor_dept")
  requiresApproval  Boolean  @default(false) @map("requires_approval")
  notificationEmail String?  @map("notification_email")
  createdAt         DateTime @default(now()) @map("created_at")

  users           User[]
  tickets         Ticket[]                  // solicitante (campo existente, sem mudança)
  executedTickets Ticket[]         @relation("executorDepartment")
  categories      TicketCategory[]

  @@map("departments")
}
```

- [ ] **Step 4: Editar o model `TicketCategory`**

Troque:
```prisma
model TicketCategory {
  id        String   @id @default(uuid())
  slug      String   @unique
  name      String
  icon      String // nome do ícone lucide-react
  sortOrder Int      @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  subcategories TicketSubcategory[]
  tickets       Ticket[]

  @@map("ticket_categories")
}
```
por:
```prisma
model TicketCategory {
  id           String      @id @default(uuid())
  slug         String      @unique
  name         String
  icon         String // nome do ícone lucide-react
  sortOrder    Int         @map("sort_order")
  // Roteamento: setor executor de destino. Nullable pra não quebrar categorias
  // antigas; só pode referenciar Department.isExecutorDept = true (garantido no seed).
  departmentId String?     @map("department_id")
  department   Department? @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  createdAt    DateTime    @default(now()) @map("created_at")

  subcategories TicketSubcategory[]
  tickets       Ticket[]

  @@index([departmentId])
  @@map("ticket_categories")
}
```

- [ ] **Step 5: Editar o model `Ticket`**

Troque:
```prisma
  departmentId String       @map("department_id")
  department   Department   @relation(fields: [departmentId], references: [id])
  requesterId  String       @map("requester_id")
  requester    User         @relation("requester", fields: [requesterId], references: [id])
  assignedTo   String?      @map("assigned_to")
  assignee     User?        @relation("assignee", fields: [assignedTo], references: [id])
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")
  resolvedAt   DateTime?    @map("resolved_at")
  closedAt     DateTime?    @map("closed_at")
  slaStartedAt DateTime?    @map("sla_started_at")
  rating       Int?
```
por:
```prisma
  departmentId String       @map("department_id") // setor do SOLICITANTE (não muda de sentido)
  department   Department   @relation(fields: [departmentId], references: [id])
  // Setor EXECUTOR (destino), resolvido de category.departmentId na criação — denormalizado.
  executorDepartmentId String?     @map("executor_department_id")
  executorDepartment   Department? @relation("executorDepartment", fields: [executorDepartmentId], references: [id], onDelete: Restrict)
  // Capturado só quando requester.isKiosk = true (totem) — texto livre de local/sala.
  originLocation String?      @map("origin_location")
  requesterId  String       @map("requester_id")
  requester    User         @relation("requester", fields: [requesterId], references: [id])
  assignedTo   String?      @map("assigned_to")
  assignee     User?        @relation("assignee", fields: [assignedTo], references: [id])
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")
  resolvedAt   DateTime?    @map("resolved_at")
  closedAt     DateTime?    @map("closed_at")
  slaStartedAt DateTime?    @map("sla_started_at")
  rating       Int?
```

And add the index next to the existing ones:
```prisma
  @@index([status, priority])
  @@index([requesterId])
  @@index([assignedTo])
  @@index([categoryId])
  @@index([subcategoryId])
  @@index([detailOptionId])
  @@index([executorDepartmentId])
  @@map("tickets")
```

- [ ] **Step 6: Validar e gerar o client**

Run:
```bash
cd packages/api
npx prisma validate --schema prisma/schema.prisma
npm run db:generate -w @chamados/api
```
Expected: `The schema at prisma/schema.prisma is valid 🚀` e geração do client sem erro (mesmo sem as migrations aplicadas ainda — `generate` só lê o `.prisma`).

- [ ] **Step 7: Commit**

```bash
git add packages/api/prisma/schema.prisma
git commit -m "feat(api): schema multi-setorial (Department/User/TicketCategory/Ticket/TicketStatus)"
```

---

### Task 2: Migration 1 — colunas aditivas

**Files:**
- Create: `packages/api/prisma/migrations/20260702090000_add_multi_setor_columns/migration.sql`

**Interfaces:**
- Consumes: schema editado na Task 1.
- Produces: colunas físicas no Postgres correspondentes aos campos da Task 1 (exceto o enum, que é a Task 3).

- [ ] **Step 1: Criar a pasta e o arquivo de migration**

Create `packages/api/prisma/migrations/20260702090000_add_multi_setor_columns/migration.sql`:
```sql
-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "is_requester_dept" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_executor_dept" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notification_email" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_kiosk" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ticket_categories" ADD COLUMN     "department_id" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "executor_department_id" TEXT,
ADD COLUMN     "origin_location" TEXT;

-- CreateIndex
CREATE INDEX "ticket_categories_department_id_idx" ON "ticket_categories"("department_id");

-- CreateIndex
CREATE INDEX "tickets_executor_department_id_idx" ON "tickets"("executor_department_id");

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_executor_department_id_fkey" FOREIGN KEY ("executor_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 2: Aplicar no banco de dev**

Run:
```bash
npm run db:deploy -w @chamados/api
```
Expected: `1 migration found... Applied migration 20260702090000_add_multi_setor_columns`. Se o dev DB não estiver rodando, subir antes (`docker` conforme `docs/memory/procedures/setup-local.md`).

- [ ] **Step 3: Commit**

```bash
git add packages/api/prisma/migrations/20260702090000_add_multi_setor_columns
git commit -m "feat(api): migration — colunas multi-setoriais (Department/User/TicketCategory/Ticket)"
```

---

### Task 3: Migration 2 — valor de enum `PENDING_APPROVAL` (isolada)

**Files:**
- Create: `packages/api/prisma/migrations/20260702090100_add_pending_approval_status/migration.sql`

**Interfaces:**
- Consumes: nada (independente).
- Produces: valor `PENDING_APPROVAL` utilizável no enum `TicketStatus` — só pode ser **usado** por código depois desta migration estar commitada (gotcha `postgres-enum-default.md`).

- [ ] **Step 1: Criar a migration isolada**

Create `packages/api/prisma/migrations/20260702090100_add_pending_approval_status/migration.sql`:
```sql
-- AlterEnum
-- (isolada: novos valores de enum precisam ser commitados antes de serem usados)
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_APPROVAL' BEFORE 'OPEN';
```

- [ ] **Step 2: Aplicar**

Run:
```bash
npm run db:deploy -w @chamados/api
```
Expected: `Applied migration 20260702090100_add_pending_approval_status`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/prisma/migrations/20260702090100_add_pending_approval_status
git commit -m "feat(api): migration — valor de enum PENDING_APPROVAL (isolada)"
```

---

### Task 4: Migration 3 — 15 setores reais + categorias/subcategorias de Manutenção e Limpeza

**Files:**
- Create: `packages/api/prisma/migrations/20260702090200_seed_setores_multi_setorial/migration.sql`

**Interfaces:**
- Consumes: colunas da Task 2, enum da Task 3.
- Produces: 14 `Department`s novos + backfill de `TI`; 14 `TicketCategory`s novas (Manutenção/Limpeza) + backfill `department_id` dos 6 blocos de TI; 14 `TicketSubcategory` placeholder.

- [ ] **Step 1: Criar a migration de dados**

Create `packages/api/prisma/migrations/20260702090200_seed_setores_multi_setorial/migration.sql`:
```sql
-- ============================================================================
-- Backfill: TI (setor existente) vira só-executor.
-- Ver docs/superpowers/specs/2026-07-02-multi-setorial-design.md (decisão #6).
-- ============================================================================
UPDATE "departments" SET "is_executor_dept" = true, "is_requester_dept" = false WHERE "name" = 'TI';

-- ============================================================================
-- 14 setores novos, pesos reais (âncoras: Presidência=5, Limpeza=2).
-- ============================================================================
INSERT INTO "departments" ("id","name","priority_weight","is_requester_dept","is_executor_dept","requires_approval") VALUES
  (gen_random_uuid(),'RH',3,true,true,false),
  (gen_random_uuid(),'Tesouraria',4,true,false,false),
  (gen_random_uuid(),'Limpeza',2,false,true,false),
  (gen_random_uuid(),'Manutenção',4,false,true,false),
  (gen_random_uuid(),'Almoxarifado',2,false,true,false),
  (gen_random_uuid(),'Compras',3,false,true,false),
  (gen_random_uuid(),'Comunicações',3,false,true,false),
  (gen_random_uuid(),'Gestão de Contratos',3,false,true,false),
  (gen_random_uuid(),'Secretaria',2,false,true,false),
  (gen_random_uuid(),'Secretaria da Presidência',4,false,true,false),
  (gen_random_uuid(),'Jurídico',4,false,true,false),
  (gen_random_uuid(),'Eventos',2,false,true,false),
  (gen_random_uuid(),'CEO',5,true,true,false),
  (gen_random_uuid(),'Presidência',5,false,true,true)
ON CONFLICT ("name") DO NOTHING;

-- ============================================================================
-- Backfill: os 6 blocos de TI existentes recebem department_id = TI.
-- ============================================================================
UPDATE "ticket_categories" SET "department_id" = (SELECT "id" FROM "departments" WHERE "name" = 'TI')
WHERE "slug" IN ('acesso-senhas','computador-equipamentos','sistemas-aplicativos','internet-rede','solicitacoes','outros');

-- ============================================================================
-- Categorias novas — Manutenção (8), já com department_id resolvido.
-- ============================================================================
INSERT INTO "ticket_categories" ("id","slug","name","icon","sort_order","department_id")
SELECT gen_random_uuid(), v.slug, v.name, v.icon, v.sort_order, d.id
FROM (VALUES
  ('eletrica','Elétrica','Zap',1),
  ('hidraulica','Hidráulica','Droplet',2),
  ('ar-condicionado','Ar-condicionado / Climatização','Snowflake',3),
  ('mobiliario','Mobiliário','Armchair',4),
  ('estrutural-civil','Estrutural/Civil','Hammer',5),
  ('portas-fechaduras','Portas e fechaduras','DoorClosed',6),
  ('areas-externas','Áreas externas/jardinagem','Trees',7),
  ('outros-manutencao','Outros','CircleEllipsis',8)
) AS v(slug,name,icon,sort_order)
JOIN "departments" d ON d.name = 'Manutenção'
ON CONFLICT ("slug") DO NOTHING;

-- ============================================================================
-- Categorias novas — Limpeza (6), já com department_id resolvido.
-- ============================================================================
INSERT INTO "ticket_categories" ("id","slug","name","icon","sort_order","department_id")
SELECT gen_random_uuid(), v.slug, v.name, v.icon, v.sort_order, d.id
FROM (VALUES
  ('limpeza-sala','Limpeza de sala/escritório','Sparkles',1),
  ('limpeza-banheiro','Limpeza de banheiro','ShowerHead',2),
  ('reposicao-materiais','Reposição de materiais de higiene','PackagePlus',3),
  ('limpeza-area-comum','Limpeza de área comum/evento','Building2',4),
  ('descarte-lixo','Descarte de lixo/resíduos','Trash2',5),
  ('outros-limpeza','Outros','CircleEllipsis',6)
) AS v(slug,name,icon,sort_order)
JOIN "departments" d ON d.name = 'Limpeza'
ON CONFLICT ("slug") DO NOTHING;

-- ============================================================================
-- Subcategoria placeholder ("Solicitação geral") para cada uma das 14 categorias
-- novas — curadoria fina fica para sessão futura (mesmo padrão do backlog
-- sessao-2026-07-01-backlog.md). base_complexity = MEDIUM (default já existente).
-- ============================================================================
INSERT INTO "ticket_subcategories" ("id","category_id","slug","name","icon","sort_order","base_complexity")
SELECT gen_random_uuid(), c.id, 'solicitacao-geral', 'Solicitação geral', c.icon, 1, 'MEDIUM'
FROM "ticket_categories" c
WHERE c.slug IN (
  'eletrica','hidraulica','ar-condicionado','mobiliario','estrutural-civil',
  'portas-fechaduras','areas-externas','outros-manutencao',
  'limpeza-sala','limpeza-banheiro','reposicao-materiais','limpeza-area-comum',
  'descarte-lixo','outros-limpeza'
)
ON CONFLICT ("category_id","slug") DO NOTHING;
```

- [ ] **Step 2: Aplicar e verificar**

Run:
```bash
npm run db:deploy -w @chamados/api
```
Expected: `Applied migration 20260702090200_seed_setores_multi_setorial`.

Verify via psql (`docker exec -it <container> psql -U chamados -d chamados`):
```sql
SELECT name, priority_weight, is_requester_dept, is_executor_dept, requires_approval FROM departments ORDER BY name;
```
Expected: 15 linhas (TI + 14 novos), pesos batendo com a tabela do spec.
```sql
SELECT slug, department_id IS NOT NULL AS roteada FROM ticket_categories ORDER BY slug;
```
Expected: 20 linhas (6 TI + 8 Manutenção + 6 Limpeza), todas com `roteada = true`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/prisma/migrations/20260702090200_seed_setores_multi_setorial
git commit -m "feat(api): migration — 15 setores reais + categorias de Manutenção/Limpeza"
```

---

### Task 5: Limpeza do seed de dev (`Financeiro` obsoleto)

**Files:**
- Modify: `packages/api/prisma/seed.ts`
- Modify: `docs/memory/procedures/setup-local.md:14-15`

**Interfaces:**
- Consumes: nada.
- Produces: seed de dev sem o `Department` fixture "Financeiro" (substituído pelos setores reais da Task 4).

- [ ] **Step 1: Remover o upsert de "Financeiro" e trocar as referências para "Tesouraria"**

Em `packages/api/prisma/seed.ts`, troque:
```ts
  const financeiro = await prisma.department.upsert({
    where: { name: 'Financeiro' },
    update: {},
    create: { name: 'Financeiro', priorityWeight: 2 },
  });
```
por:
```ts
  const tesouraria = await prisma.department.findUniqueOrThrow({ where: { name: 'Tesouraria' } });
```
(Tesouraria já existe via a migration de seed — Task 4 — não precisa de upsert aqui.)

Depois, troque as 2 referências a `financeiro` no array `triageSamples` por `tesouraria`:
```ts
      {
        title: 'Resetar senha de e-mail',
        description: 'Esqueci a senha do e-mail corporativo.',
        department: tesouraria,
      },
```

- [ ] **Step 2: Atualizar a doc de setup local**

Em `docs/memory/procedures/setup-local.md`, troque `(TI/RH/Financeiro)` por `(TI/RH + os 13 setores da migration de seed)` nas 2 ocorrências (linhas ~14-15).

- [ ] **Step 3: Rodar o seed local e conferir**

Run:
```bash
npm run db:seed -w @chamados/api
```
Expected: `Seed concluído.` sem erro (o `findUniqueOrThrow` só passa se a Task 4 já rodou antes).

- [ ] **Step 4: Commit**

```bash
git add packages/api/prisma/seed.ts docs/memory/procedures/setup-local.md
git commit -m "chore(api): remove fixture obsoleto 'Financeiro' do seed de dev"
```

---

### Task 6: Pacote `@chamados/shared` — enums e tipos

**Files:**
- Modify: `packages/shared/src/enums.ts`
- Modify: `packages/shared/src/types.ts`

**Interfaces:**
- Produces: `TICKET_STATUSES` com `PENDING_APPROVAL`; `Department` com os 4 campos novos; `Ticket` com `executorDepartmentId`/`originLocation`; `TicketDetail` com `executorDepartment?`; `UserPublic` com `isKiosk`; `CreateDepartmentInput` com os 4 campos novos opcionais.

- [ ] **Step 1: Atualizar `TICKET_STATUSES`**

Em `packages/shared/src/enums.ts`, troque:
```ts
export const TICKET_STATUSES = ['TRIAGE', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
```
por:
```ts
export const TICKET_STATUSES = [
  'TRIAGE',
  'PENDING_APPROVAL',
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const;
```

- [ ] **Step 2: Atualizar `Department` em `types.ts`**

Troque:
```ts
export interface Department {
  id: string;
  name: string;
  priorityWeight: number;
  createdAt: string;
}
```
por:
```ts
export interface Department {
  id: string;
  name: string;
  priorityWeight: number;
  isRequesterDept: boolean;
  isExecutorDept: boolean;
  requiresApproval: boolean;
  notificationEmail: string | null;
  createdAt: string;
}
```

- [ ] **Step 3: Atualizar `Ticket` e `TicketDetail` em `types.ts`**

Em `Ticket`, troque:
```ts
  status: TicketStatus;
  departmentId: string;
  requesterId: string;
```
por:
```ts
  status: TicketStatus;
  departmentId: string; // setor do SOLICITANTE (não muda de sentido)
  executorDepartmentId: string | null; // setor EXECUTOR (destino), resolvido pela categoria
  originLocation: string | null; // capturado só via totem (Plano 4)
  requesterId: string;
```

Em `TicketDetail`, troque:
```ts
export interface TicketDetail extends Ticket {
  requester?: UserPublic;
  assignee?: UserPublic | null;
  department?: Department;
  comments: TicketComment[];
  history: TicketStatusHistory[];
  attachments: TicketAttachment[];
}
```
por:
```ts
export interface TicketDetail extends Ticket {
  requester?: UserPublic;
  assignee?: UserPublic | null;
  department?: Department;
  executorDepartment?: Department | null;
  comments: TicketComment[];
  history: TicketStatusHistory[];
  attachments: TicketAttachment[];
}
```

- [ ] **Step 4: Atualizar `UserPublic` e `CreateDepartmentInput` em `types.ts`**

Em `UserPublic`, troque:
```ts
export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}
```
por:
```ts
export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  isKiosk: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Em `CreateDepartmentInput`, troque:
```ts
export interface CreateDepartmentInput {
  name: string;
  priorityWeight: number;
}
```
por:
```ts
export interface CreateDepartmentInput {
  name: string;
  priorityWeight: number;
  isRequesterDept?: boolean;
  isExecutorDept?: boolean;
  requiresApproval?: boolean;
  notificationEmail?: string;
}
```

- [ ] **Step 5: Rebuild do pacote shared**

Run:
```bash
npm run build -w @chamados/shared
```
Expected: build limpo (`dist/` atualizado).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/enums.ts packages/shared/src/types.ts
git commit -m "feat(shared): tipos multi-setoriais (Department/Ticket/UserPublic/PENDING_APPROVAL)"
```

---

### Task 7: Propagar `departmentId`/`isKiosk` no `AuthUser`

**Files:**
- Modify: `packages/api/src/common/decorators/current-user.decorator.ts`
- Modify: `packages/api/src/modules/auth/strategies/jwt.strategy.ts`
- Modify: `packages/api/src/modules/users/user.mapper.ts`

**Interfaces:**
- Consumes: `UserPublic.isKiosk` (Task 6), `User.departmentId`/`isKiosk` (Task 1).
- Produces: `AuthUser.departmentId: string | null` e `AuthUser.isKiosk: boolean`, disponíveis em TODO endpoint autenticado sem query extra (o `JwtStrategy` já busca o usuário a cada request).

- [ ] **Step 1: Estender `AuthUser`**

Em `packages/api/src/common/decorators/current-user.decorator.ts`, troque:
```ts
export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}
```
por:
```ts
export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  departmentId: string | null;
  isKiosk: boolean;
}
```

- [ ] **Step 2: Popular os campos novos no `JwtStrategy`**

Em `packages/api/src/modules/auth/strategies/jwt.strategy.ts`, troque:
```ts
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
```
por:
```ts
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      departmentId: user.departmentId,
      isKiosk: user.isKiosk,
    };
```

- [ ] **Step 3: Expor `isKiosk` em `UserPublic`**

Em `packages/api/src/modules/users/user.mapper.ts`, troque:
```ts
export function toUserPublic(u: User): UserPublic {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}
```
por:
```ts
export function toUserPublic(u: User): UserPublic {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    isKiosk: u.isKiosk,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 4: Atualizar `jwt.strategy.spec.ts` (quebra por causa do novo shape do `AuthUser`)**

Em `packages/api/src/modules/auth/strategies/jwt.strategy.spec.ts`, o teste `'validate devolve o AuthUser...'` compara por `assert.deepEqual` contra um objeto literal — vai falhar porque `validate()` agora retorna `departmentId`/`isKiosk` também. Troque:
```ts
test('validate devolve o AuthUser com mustChangePassword vindo do banco', async () => {
  const users = {
    findById: async () => ({
      id: 'u1',
      email: 'a@b.com',
      role: 'USER',
      mustChangePassword: true,
    }),
  } as any;
  const strategy = new JwtStrategy(config, users);

  const result = await strategy.validate(payload);
  assert.deepEqual(result, {
    userId: 'u1',
    email: 'a@b.com',
    role: 'USER',
    mustChangePassword: true,
  });
});
```
por:
```ts
test('validate devolve o AuthUser com mustChangePassword/departmentId/isKiosk vindos do banco', async () => {
  const users = {
    findById: async () => ({
      id: 'u1',
      email: 'a@b.com',
      role: 'USER',
      mustChangePassword: true,
      departmentId: 'dep1',
      isKiosk: false,
    }),
  } as any;
  const strategy = new JwtStrategy(config, users);

  const result = await strategy.validate(payload);
  assert.deepEqual(result, {
    userId: 'u1',
    email: 'a@b.com',
    role: 'USER',
    mustChangePassword: true,
    departmentId: 'dep1',
    isKiosk: false,
  });
});
```

- [ ] **Step 5: Build e testes**

Run:
```bash
npm run build -w @chamados/api
npm test -w @chamados/api
```
Expected: ambos passam limpos. `nest build` usa `tsconfig.build.json`, que **exclui `**/*.spec.ts`** — então os fixtures desatualizados (`operator`/`admin`/`requester` em `tickets.service.spec.ts`, sem `departmentId`/`isKiosk`) não quebram o build nem o `npm test` (roda via `ts-node/register/transpile-only`, que não typecheca). Eles só ficam com `departmentId`/`isKiosk` implicitamente `undefined` até serem corrigidos na Task 9 Step 1 — sem isso quebrar nada agora, mas deixando o tipo incompleto até lá.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/common/decorators/current-user.decorator.ts packages/api/src/modules/auth/strategies/jwt.strategy.ts packages/api/src/modules/auth/strategies/jwt.strategy.spec.ts packages/api/src/modules/users/user.mapper.ts
git commit -m "feat(api): propaga departmentId/isKiosk no AuthUser via JwtStrategy"
```

---

### Task 8: Departments — flags novas + guarda de exclusão por categoria

**Files:**
- Modify: `packages/api/src/modules/departments/departments.repository.ts`
- Modify: `packages/api/src/modules/departments/departments.service.ts`
- Modify: `packages/api/src/modules/departments/dto/create-department.dto.ts`
- Create: `packages/api/src/modules/departments/departments.service.spec.ts`

**Interfaces:**
- Consumes: `Department` schema (Task 1), `CreateDepartmentInput` shape (Task 6).
- Produces: `DepartmentsService.create()` grava as 4 flags novas; `DepartmentsService.remove()` também bloqueia se houver `TicketCategory` ou chamados **executados** (`executorDepartmentId`) vinculados — não só chamados como solicitante.

- [ ] **Step 1: Escrever o teste (falha esperada)**

Create `packages/api/src/modules/departments/departments.service.spec.ts`:
```ts
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';

function makeService(over: {
  byName?: Record<string, unknown> | null;
  byId?: Record<string, unknown> | null;
  users?: number;
  tickets?: number;
  categories?: number;
}) {
  const repo = {
    findByName: async () => over.byName ?? null,
    findById: async () => over.byId ?? { id: 'd1', name: 'Manutenção' },
    create: async (data: Record<string, unknown>) => ({ id: 'new', ...data }),
    countUsers: async () => over.users ?? 0,
    countTickets: async () => over.tickets ?? 0,
    countCategories: async () => over.categories ?? 0,
    remove: async (id: string) => ({ id }),
  } as any;
  return new DepartmentsService(repo);
}

test('create: aplica defaults quando as flags não vêm no DTO', async () => {
  const svc = makeService({});
  const r: any = await svc.create({ name: 'Eventos', priorityWeight: 2 } as any);
  assert.equal(r.isRequesterDept, true);
  assert.equal(r.isExecutorDept, false);
  assert.equal(r.requiresApproval, false);
  assert.equal(r.notificationEmail, null);
});

test('create: respeita as flags explícitas do DTO', async () => {
  const svc = makeService({});
  const r: any = await svc.create({
    name: 'Presidência',
    priorityWeight: 5,
    isRequesterDept: false,
    isExecutorDept: true,
    requiresApproval: true,
    notificationEmail: 'presidencia@clube.local',
  } as any);
  assert.equal(r.isExecutorDept, true);
  assert.equal(r.requiresApproval, true);
  assert.equal(r.notificationEmail, 'presidencia@clube.local');
});

test('remove: bloqueia quando o setor tem categoria vinculada (mesmo sem usuário/chamado)', async () => {
  const svc = makeService({ users: 0, tickets: 0, categories: 1 });
  await assert.rejects(() => svc.remove('d1'), (e) => e instanceof ConflictException);
});

test('remove: permite quando não há usuário, chamado nem categoria vinculados', async () => {
  const svc = makeService({ users: 0, tickets: 0, categories: 0 });
  const r = await svc.remove('d1');
  assert.deepEqual(r, { id: 'd1' });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run:
```bash
npm test -w @chamados/api
```
Expected: FAIL (`countCategories is not a function` / propriedades `isRequesterDept` etc. `undefined`).

- [ ] **Step 3: Implementar `departments.repository.ts`**

Troque:
```ts
  countTickets(departmentId: string) {
    return this.prisma.ticket.count({ where: { departmentId } });
  }

  remove(id: string) {
```
por:
```ts
  // Conta tanto chamados abertos PELO setor (solicitante) quanto EXECUTADOS por ele.
  countTickets(departmentId: string) {
    return this.prisma.ticket.count({
      where: { OR: [{ departmentId }, { executorDepartmentId: departmentId }] },
    });
  }

  countCategories(departmentId: string) {
    return this.prisma.ticketCategory.count({ where: { departmentId } });
  }

  remove(id: string) {
```

- [ ] **Step 4: Implementar `departments.service.ts`**

Troque:
```ts
  async create(dto: CreateDepartmentDto) {
    const exists = await this.repo.findByName(dto.name);
    if (exists) throw new ConflictException('Departamento já existe');
    return this.repo.create({ name: dto.name, priorityWeight: dto.priorityWeight });
  }

  async remove(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new NotFoundException('Departamento não encontrado');
    const [users, tickets] = await Promise.all([
      this.repo.countUsers(id),
      this.repo.countTickets(id),
    ]);
    if (users + tickets > 0) {
      throw new ConflictException(
        'Departamento tem usuários ou chamados vinculados e não pode ser excluído',
      );
    }
    await this.repo.remove(id);
    return { id };
  }
```
por:
```ts
  async create(dto: CreateDepartmentDto) {
    const exists = await this.repo.findByName(dto.name);
    if (exists) throw new ConflictException('Departamento já existe');
    return this.repo.create({
      name: dto.name,
      priorityWeight: dto.priorityWeight,
      isRequesterDept: dto.isRequesterDept ?? true,
      isExecutorDept: dto.isExecutorDept ?? false,
      requiresApproval: dto.requiresApproval ?? false,
      notificationEmail: dto.notificationEmail ?? null,
    });
  }

  async remove(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new NotFoundException('Departamento não encontrado');
    const [users, tickets, categories] = await Promise.all([
      this.repo.countUsers(id),
      this.repo.countTickets(id),
      this.repo.countCategories(id),
    ]);
    if (users + tickets + categories > 0) {
      throw new ConflictException(
        'Departamento tem usuários, chamados ou categorias vinculadas e não pode ser excluído',
      );
    }
    await this.repo.remove(id);
    return { id };
  }
```

- [ ] **Step 5: Implementar `create-department.dto.ts`**

Troque todo o conteúdo por:
```ts
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  priorityWeight!: number;

  @IsOptional()
  @IsBoolean()
  isRequesterDept?: boolean;

  @IsOptional()
  @IsBoolean()
  isExecutorDept?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsEmail()
  notificationEmail?: string;
}
```

- [ ] **Step 6: Rodar os testes e confirmar sucesso**

Run:
```bash
npm test -w @chamados/api
```
Expected: PASS em todos os testes de `departments.service.spec.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/modules/departments
git commit -m "feat(api): Department ganha flags de solicitante/executor/aprovação + guarda de exclusão por categoria"
```

---

### Task 9: Roteamento categoria→setor + aprovação na criação do chamado

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.ts` (método `create`)
- Modify: `packages/api/src/modules/tickets/tickets.service.spec.ts`

**Interfaces:**
- Consumes: `TicketCategory.departmentId`, `Department.requiresApproval` (Task 1/4); `CategoriesRepository.findSubcategory()` (já existe, `include: { category: true }` já traz `departmentId` automaticamente — nenhuma mudança necessária no repositório de categorias).
- Produces: `TicketsRepository.createWithHistory()` aceita `executorDepartmentId: string` e `status: TicketStatus`; `TicketsService.create()` resolve o setor executor pela categoria e decide `OPEN` vs `PENDING_APPROVAL`.

- [ ] **Step 1: Escrever os testes (falha esperada)**

Em `packages/api/src/modules/tickets/tickets.service.spec.ts`, primeiro atualize o helper `makeService` para suportar departamentos por id (necessário porque `create()` agora chama `departments.findById` duas vezes — uma para o setor do solicitante, outra para o executor — com ids diferentes). Troque:
```ts
function makeService(over: {
  ticket?: Record<string, unknown>;
  assignee?: Record<string, unknown> | null;
  subcategory?: Record<string, unknown> | null;
  department?: Record<string, unknown> | null;
}) {
  const repo = {
    findById: async () => over.ticket ?? null,
    assign: async (id: string, assignedTo: string) => ({ id, assignedTo }),
    closeWithRating: async (args: unknown) => args,
    createWithHistory: async (input: Record<string, unknown>) => ({ id: 'new', ...input }),
    addComment: async (ticketId: string, authorId: string, body: string) => ({
      id: 'c1',
      ticketId,
      authorId,
      body,
      createdAt: new Date(),
      author: {
        id: authorId,
        name: 'Autor',
        email: 'a@x',
        role: 'ADMIN',
        departmentId: null,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  } as any;
  const users = { findById: async () => over.assignee ?? null } as any;
  const departments = { findById: async () => over.department ?? { id: 'dep1', priorityWeight: 3 } } as any;
  const categories = { findSubcategory: async () => over.subcategory ?? null } as any;
  // Stub do PriorityService: cálculo determinístico p/ asserção (complexidade + peso do setor).
  const priority = {
    compute: (complexity: string, weight: number) => `PRIO(${complexity},${weight})`,
  } as any;
  return new TicketsService(repo, departments, users, priority, {} as any, categories);
}

const operator: AuthUser = { userId: 'op1', email: 'op@x', role: 'OPERATOR', mustChangePassword: false };
const admin: AuthUser = { userId: 'ad1', email: 'ad@x', role: 'ADMIN', mustChangePassword: false };
const requester: AuthUser = { userId: 'req1', email: 'u@x', role: 'USER', mustChangePassword: false };
```
por:
```ts
function makeService(over: {
  ticket?: Record<string, unknown>;
  assignee?: Record<string, unknown> | null;
  subcategory?: Record<string, unknown> | null;
  department?: Record<string, unknown> | null;
  departmentsById?: Record<string, Record<string, unknown>>;
}) {
  const repo = {
    findById: async () => over.ticket ?? null,
    assign: async (id: string, assignedTo: string) => ({ id, assignedTo }),
    closeWithRating: async (args: unknown) => args,
    createWithHistory: async (input: Record<string, unknown>) => ({ id: 'new', ...input }),
    updateStatusWithHistory: async (input: Record<string, unknown>) => ({ id: input.id, ...input }),
    addComment: async (ticketId: string, authorId: string, body: string) => ({
      id: 'c1',
      ticketId,
      authorId,
      body,
      createdAt: new Date(),
      author: {
        id: authorId,
        name: 'Autor',
        email: 'a@x',
        role: 'ADMIN',
        departmentId: null,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  } as any;
  const users = { findById: async () => over.assignee ?? null } as any;
  // Por id (necessário: create() busca o setor do solicitante E o setor executor,
  // que podem ser departamentos diferentes). Sem over.departmentsById, cai no
  // comportamento antigo (mesmo departamento pra qualquer id — regressão dos testes existentes).
  const departments = {
    findById: async (id: string) =>
      over.departmentsById?.[id] ?? over.department ?? { id: 'dep1', priorityWeight: 3, requiresApproval: false },
  } as any;
  const categories = { findSubcategory: async () => over.subcategory ?? null } as any;
  // Stub do PriorityService: cálculo determinístico p/ asserção (complexidade + peso do setor).
  const priority = {
    compute: (complexity: string, weight: number) => `PRIO(${complexity},${weight})`,
  } as any;
  return new TicketsService(repo, departments, users, priority, {} as any, categories);
}

const operator: AuthUser = { userId: 'op1', email: 'op@x', role: 'OPERATOR', mustChangePassword: false, departmentId: null, isKiosk: false };
const admin: AuthUser = { userId: 'ad1', email: 'ad@x', role: 'ADMIN', mustChangePassword: false, departmentId: null, isKiosk: false };
const requester: AuthUser = { userId: 'req1', email: 'u@x', role: 'USER', mustChangePassword: false, departmentId: null, isKiosk: false };
```

Agora adicione, no fim do arquivo, os testes de roteamento/aprovação:
```ts
// ---- create (roteamento categoria→setor executor + aprovação) ----
const subManutencaoEletrica = {
  id: 's-eletrica',
  categoryId: 'c-eletrica',
  name: 'Solicitação geral',
  category: { id: 'c-eletrica', name: 'Elétrica', departmentId: 'dep-manutencao' },
  details: [],
};

const subPresidencia = {
  id: 's-presidencia',
  categoryId: 'c-presidencia',
  name: 'Solicitação geral',
  category: { id: 'c-presidencia', name: 'Assessoria', departmentId: 'dep-presidencia' },
  details: [],
};

const subSemSetor = {
  id: 's-sem-setor',
  categoryId: 'c-sem-setor',
  name: 'Solicitação geral',
  category: { id: 'c-sem-setor', name: 'Sem setor', departmentId: null },
  details: [],
};

test('create: resolve executorDepartmentId pela categoria e nasce OPEN quando o setor não exige aprovação', async () => {
  const svc = makeService({
    subcategory: subManutencaoEletrica,
    departmentsById: {
      dep1: { id: 'dep1', priorityWeight: 3, requiresApproval: false },
      'dep-manutencao': { id: 'dep-manutencao', priorityWeight: 4, requiresApproval: false },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'c-eletrica', subcategoryId: 's-eletrica', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.executorDepartmentId, 'dep-manutencao');
  assert.equal(r.status, 'OPEN');
});

test('create: setor executor com requiresApproval nasce PENDING_APPROVAL (SLA calculado igual)', async () => {
  const svc = makeService({
    subcategory: subPresidencia,
    departmentsById: {
      dep1: { id: 'dep1', priorityWeight: 3, requiresApproval: false },
      'dep-presidencia': { id: 'dep-presidencia', priorityWeight: 5, requiresApproval: true },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'c-presidencia', subcategoryId: 's-presidencia', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.executorDepartmentId, 'dep-presidencia');
  assert.equal(r.status, 'PENDING_APPROVAL');
  assert.equal(r.priority, 'PRIO(MEDIUM,5)'); // prioridade calculada normalmente, aprovação não afeta
});

test('create: categoria sem departmentId (não roteada) rejeita com 400', async () => {
  const svc = makeService({ subcategory: subSemSetor });
  await assert.rejects(
    () => svc.create({ categoryId: 'c-sem-setor', subcategoryId: 's-sem-setor', departmentId: 'dep1' } as any, admin),
    (e) => e instanceof BadRequestException,
  );
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run:
```bash
npm test -w @chamados/api
```
Expected: FAIL — `r.executorDepartmentId` é `undefined`, `r.status` não existe ainda no retorno de `createWithHistory` (stub genérico não seta `status`).

- [ ] **Step 3: Implementar `tickets.repository.ts`**

Troque:
```ts
  createWithHistory(input: {
    title: string;
    description: string | null;
    categoryId: string;
    subcategoryId: string;
    detailOptionId: string | null;
    complexity: Complexity;
    priority: Priority;
    departmentId: string;
    requesterId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Nasce OPEN e já priorizado (complexidade/prioridade automáticas), com o SLA
      // contando a partir da abertura — não depende mais de triagem manual.
      const ticket = await tx.ticket.create({
        data: {
          title: input.title,
          description: input.description,
          category: { connect: { id: input.categoryId } },
          subcategory: { connect: { id: input.subcategoryId } },
          detailOption: input.detailOptionId
            ? { connect: { id: input.detailOptionId } }
            : undefined,
          complexity: input.complexity,
          priority: input.priority,
          status: 'OPEN',
          slaStartedAt: new Date(),
          department: { connect: { id: input.departmentId } },
          requester: { connect: { id: input.requesterId } },
          lastActivityAt: new Date(),
          lastActivityBy: input.requesterId,
        },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: null,
          toStatus: 'OPEN',
          changedBy: input.requesterId,
        },
      });
      return ticket;
    });
  }
```
por:
```ts
  createWithHistory(input: {
    title: string;
    description: string | null;
    categoryId: string;
    subcategoryId: string;
    detailOptionId: string | null;
    complexity: Complexity;
    priority: Priority;
    status: TicketStatus;
    departmentId: string;
    executorDepartmentId: string;
    requesterId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Prioridade/SLA sempre calculados na criação (regra aprovada), independente
      // do chamado nascer OPEN ou PENDING_APPROVAL (aprovação não represa o SLA).
      const ticket = await tx.ticket.create({
        data: {
          title: input.title,
          description: input.description,
          category: { connect: { id: input.categoryId } },
          subcategory: { connect: { id: input.subcategoryId } },
          detailOption: input.detailOptionId
            ? { connect: { id: input.detailOptionId } }
            : undefined,
          complexity: input.complexity,
          priority: input.priority,
          status: input.status,
          slaStartedAt: new Date(),
          department: { connect: { id: input.departmentId } },
          executorDepartment: { connect: { id: input.executorDepartmentId } },
          requester: { connect: { id: input.requesterId } },
          lastActivityAt: new Date(),
          lastActivityBy: input.requesterId,
        },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: null,
          toStatus: input.status,
          changedBy: input.requesterId,
        },
      });
      return ticket;
    });
  }
```

Also add `executorDepartment: true` to the `findDetail()` include (right after `department: true`):
```ts
      include: {
        requester: true,
        assignee: true,
        department: true,
        executorDepartment: true,
        category: true,
```

- [ ] **Step 4: Implementar `tickets.service.ts` — `create()`**

Troque:
```ts
    // O 3º nível ("detalhe") é OPCIONAL — a abertura não pode travar quem não sabe o detalhe.
    // Se informado, precisa pertencer à subcategoria; se ausente, o chamado segue sem detalhe.
    const details = subcategory.details ?? [];
    let detailOptionId: string | null = null;
    let detailName: string | null = null;
    if (dto.detailOptionId) {
      const detail = details.find((d) => d.id === dto.detailOptionId);
      if (!detail) {
        throw new BadRequestException('Detalhe inválido para a subcategoria informada');
      }
      detailOptionId = detail.id;
      detailName = detail.name;
    }

    const title = detailName
      ? `${subcategory.category.name} › ${subcategory.name} › ${detailName}`
      : `${subcategory.category.name} › ${subcategory.name}`;

    // Prioridade/SLA automáticos na abertura: a complexidade-base vem da categorização
    // (detalhe > subcategoria > MÉDIA como padrão) e a prioridade é derivada pela matriz
    // com o peso do setor. O chamado NASCE priorizado — sem depender de triagem manual.
    const detail = detailOptionId ? details.find((d) => d.id === detailOptionId) : null;
    const complexity: Complexity =
      detail?.baseComplexity ?? subcategory.baseComplexity ?? 'MEDIUM';
    const priority = this.priority.compute(complexity, department.priorityWeight);

    const created = await this.repo.createWithHistory({
      title,
      description: dto.description ?? null,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      detailOptionId,
      complexity,
      priority,
      departmentId,
      requesterId,
    });
```
por:
```ts
    // O 3º nível ("detalhe") é OPCIONAL — a abertura não pode travar quem não sabe o detalhe.
    // Se informado, precisa pertencer à subcategoria; se ausente, o chamado segue sem detalhe.
    const details = subcategory.details ?? [];
    let detailOptionId: string | null = null;
    let detailName: string | null = null;
    if (dto.detailOptionId) {
      const detail = details.find((d) => d.id === dto.detailOptionId);
      if (!detail) {
        throw new BadRequestException('Detalhe inválido para a subcategoria informada');
      }
      detailOptionId = detail.id;
      detailName = detail.name;
    }

    const title = detailName
      ? `${subcategory.category.name} › ${subcategory.name} › ${detailName}`
      : `${subcategory.category.name} › ${subcategory.name}`;

    // Roteamento: setor EXECUTOR vem da categoria (não do departamento do solicitante).
    // Categoria sem setor mapeado é erro de dado (não deveria acontecer via UI guiada).
    const executorDepartmentId = subcategory.category.departmentId;
    if (!executorDepartmentId) {
      throw new BadRequestException('Categoria sem setor executor configurado');
    }
    const executorDepartment = await this.departments.findById(executorDepartmentId);
    if (!executorDepartment) throw new NotFoundException('Setor executor não encontrado');

    // Prioridade/SLA automáticos na abertura: a complexidade-base vem da categorização
    // (detalhe > subcategoria > MÉDIA como padrão) e a prioridade é derivada pela matriz
    // com o peso do setor. O chamado NASCE priorizado — sem depender de triagem manual,
    // mesmo quando o setor exige aprovação (aprovação não represa o SLA — decisão aprovada).
    const detail = detailOptionId ? details.find((d) => d.id === detailOptionId) : null;
    const complexity: Complexity =
      detail?.baseComplexity ?? subcategory.baseComplexity ?? 'MEDIUM';
    const priority = this.priority.compute(complexity, department.priorityWeight);
    const status: TicketStatus = executorDepartment.requiresApproval
      ? 'PENDING_APPROVAL'
      : 'OPEN';

    const created = await this.repo.createWithHistory({
      title,
      description: dto.description ?? null,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      detailOptionId,
      complexity,
      priority,
      status,
      departmentId,
      executorDepartmentId,
      requesterId,
    });
```

- [ ] **Step 5: Rodar os testes e confirmar sucesso**

Run:
```bash
npm test -w @chamados/api
```
Expected: PASS em todos os testes de `create` (novos e de regressão — os testes antigos passam porque `over.department` continua funcionando como fallback no stub).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/modules/tickets/tickets.repository.ts packages/api/src/modules/tickets/tickets.service.ts packages/api/src/modules/tickets/tickets.service.spec.ts
git commit -m "feat(api): roteamento categoria->setor executor + aprovação na criação do chamado"
```

---

### Task 10: RBAC de `OPERATOR` por setor + endpoint de aprovação

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.service.ts` (`listWhere`, `stats`, `ensureCanView`, `assign`, `updateStatus`, novo `approve`)
- Modify: `packages/api/src/modules/tickets/tickets.controller.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.spec.ts`

**Interfaces:**
- Consumes: `AuthUser.departmentId` (Task 7), `Ticket.executorDepartmentId` (Task 1/9).
- Produces: `TicketsService.approve(id, user)`; `PATCH /tickets/:id/approve` (`@Roles('ADMIN')`); `listWhere`/`stats`/`ensureCanView`/`assign`/`updateStatus` respeitando o setor do `OPERATOR`.

- [ ] **Step 1: Escrever os testes (falha esperada)**

Adicione ao fim de `tickets.service.spec.ts`:
```ts
// ---- listWhere (RBAC por setor) ----
const operatorManutencao: AuthUser = {
  userId: 'op2', email: 'op2@x', role: 'OPERATOR', mustChangePassword: false,
  departmentId: 'dep-manutencao', isKiosk: false,
};

test('listWhere: OPERATOR sem departmentId vê tudo (regressão)', () => {
  const svc = makeService({});
  const where: any = (svc as any).listWhere({}, operator);
  assert.equal(where.executorDepartmentId, undefined);
});

test('listWhere: OPERATOR com departmentId só vê o próprio setor executor', () => {
  const svc = makeService({});
  const where: any = (svc as any).listWhere({}, operatorManutencao);
  assert.equal(where.executorDepartmentId, 'dep-manutencao');
  assert.deepEqual(where.status, { notIn: ['PENDING_APPROVAL'] });
});

test('listWhere: ADMIN nunca é restrito por setor', () => {
  const svc = makeService({});
  const where: any = (svc as any).listWhere({}, admin);
  assert.equal(where.executorDepartmentId, undefined);
});

test('listWhere: status explícito na query tem prioridade (OPERATOR pode filtrar PENDING_APPROVAL se quiser)', () => {
  const svc = makeService({});
  const where: any = (svc as any).listWhere({ status: 'PENDING_APPROVAL' }, operatorManutencao);
  assert.equal(where.status, 'PENDING_APPROVAL');
});

// ---- ensureCanView / detail (RBAC por setor) ----
test('detail: OPERATOR de outro setor não acessa o chamado (403)', async () => {
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'req1', executorDepartmentId: 'dep-limpeza', comments: [], attachments: [] },
  });
  await assert.rejects(
    () => (svc as any).ensureCanView(
      { requesterId: 'req1', executorDepartmentId: 'dep-limpeza' },
      operatorManutencao,
    ),
    (e: unknown) => e instanceof ForbiddenException,
  );
});

test('detail: OPERATOR do mesmo setor acessa o chamado', () => {
  const svc = makeService({});
  (svc as any).ensureCanView(
    { requesterId: 'req1', executorDepartmentId: 'dep-manutencao' },
    operatorManutencao,
  );
  // não lança — sucesso implícito
});

// ---- assign/updateStatus respeitam o setor do OPERATOR ----
test('assign: OPERATOR de outro setor não pode assumir chamado fora do seu setor', async () => {
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'req1', executorDepartmentId: 'dep-limpeza' },
    assignee: { id: 'op2', role: 'OPERATOR' },
  });
  await assert.rejects(
    () => svc.assign('t1', 'op2', operatorManutencao),
    (e) => e instanceof ForbiddenException,
  );
});

test('updateStatus: rejeita PENDING_APPROVAL como alvo manual', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', executorDepartmentId: null, status: 'OPEN' } });
  await assert.rejects(
    () => svc.updateStatus('t1', 'PENDING_APPROVAL', admin),
    (e) => e instanceof BadRequestException,
  );
});

// ---- approve ----
test('approve: transiciona PENDING_APPROVAL -> OPEN', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'PENDING_APPROVAL' } });
  const r: any = await svc.approve('t1', admin);
  assert.equal(r.status, 'OPEN');
});

test('approve: rejeita chamado que não está PENDING_APPROVAL', async () => {
  const svc = makeService({ ticket: { id: 't1', requesterId: 'req1', status: 'OPEN' } });
  await assert.rejects(() => svc.approve('t1', admin), (e) => e instanceof BadRequestException);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run:
```bash
npm test -w @chamados/api
```
Expected: FAIL — `listWhere` não filtra por `executorDepartmentId`, `ensureCanView` não aceita objeto de ticket (assinatura antiga é `(requesterId, user)`), `svc.approve` não existe.

- [ ] **Step 3: Implementar `listWhere`/`stats`**

Troque:
```ts
  // Filtro de listagem compartilhado por list() e stats(), com visibilidade por papel.
  private listWhere(query: TicketQueryDto, user: AuthUser): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};
    if (query.status) where.status = query.status;
    // "Em aberto": esconde resolvidos/concluídos quando não há status específico.
    else if (query.scope === 'active') where.status = { notIn: ['RESOLVED', 'CLOSED'] };
    if (query.priority) where.priority = query.priority;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.subcategoryId) where.subcategoryId = query.subcategoryId;
    // Visibilidade: USER vê apenas os próprios chamados; staff (ADMIN/OPERATOR) vê todos.
    if (user.role === 'USER') where.requesterId = user.userId;
    return where;
  }
```
por:
```ts
  // Filtro de listagem compartilhado por list() e stats(), com visibilidade por papel.
  private listWhere(query: TicketQueryDto, user: AuthUser): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};
    // OPERATOR com setor definido só vê/atende o próprio setor executor; ADMIN NUNCA é
    // restrito (mesmo com departmentId setado); OPERATOR sem departmentId vê tudo (regressão).
    const isOperatorScoped = user.role === 'OPERATOR' && !!user.departmentId;

    if (query.status) {
      where.status = query.status;
    } else {
      const hidden: TicketStatus[] = [];
      // "Em aberto": esconde resolvidos/concluídos quando não há status específico.
      if (query.scope === 'active') hidden.push('RESOLVED', 'CLOSED');
      // Chamado ainda não aprovado não aparece na fila de atendimento do setor.
      if (isOperatorScoped) hidden.push('PENDING_APPROVAL');
      if (hidden.length) where.status = { notIn: hidden };
    }
    if (query.priority) where.priority = query.priority;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.subcategoryId) where.subcategoryId = query.subcategoryId;

    // Visibilidade: USER vê apenas os próprios chamados; OPERATOR escopado vê só o
    // próprio setor executor; ADMIN e OPERATOR sem setor veem tudo (comportamento atual).
    if (user.role === 'USER') where.requesterId = user.userId;
    else if (isOperatorScoped) where.executorDepartmentId = user.departmentId as string;

    return where;
  }
```

Troque:
```ts
  // KPIs do dashboard calculados no servidor (groupBy status), respeitando o papel.
  async stats(user: AuthUser): Promise<TicketStats> {
    const where: Prisma.TicketWhereInput =
      user.role === 'USER' ? { requesterId: user.userId } : {};
```
por:
```ts
  // KPIs do dashboard calculados no servidor (groupBy status), respeitando o papel.
  async stats(user: AuthUser): Promise<TicketStats> {
    const where: Prisma.TicketWhereInput =
      user.role === 'USER'
        ? { requesterId: user.userId }
        : user.role === 'OPERATOR' && user.departmentId
          ? { executorDepartmentId: user.departmentId }
          : {};
```

- [ ] **Step 4: Implementar `ensureCanView` e atualizar os call sites**

Troque:
```ts
  private ensureCanView(requesterId: string, user: AuthUser): void {
    // Staff (ADMIN/OPERATOR) vê todos os chamados; USER só os próprios.
    if (isStaffRole(user.role)) return;
    if (requesterId !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este chamado');
    }
  }
```
por:
```ts
  private ensureCanView(
    ticket: { requesterId: string; executorDepartmentId: string | null },
    user: AuthUser,
  ): void {
    if (user.role === 'ADMIN') return; // ADMIN nunca é restrito.
    if (user.role === 'OPERATOR') {
      // OPERATOR sem setor definido mantém o comportamento atual (vê tudo).
      if (user.departmentId && ticket.executorDepartmentId !== user.departmentId) {
        throw new ForbiddenException('Você não tem acesso a chamados de outro setor');
      }
      return;
    }
    if (ticket.requesterId !== user.userId) {
      throw new ForbiddenException('Você não tem acesso a este chamado');
    }
  }
```

Atualize os 4 call sites existentes de `this.ensureCanView(ticket.requesterId, user)` (em `detail`, `addAttachments`, `getAttachmentFile`, `addComment`) para `this.ensureCanView(ticket, user)` — passando o objeto `ticket` inteiro (já disponível em todos eles via `this.repo.findById`/`findDetail`).

Remova o import `isStaffRole` se ele ficar sem uso após essa troca (confirme com o Step 6 antes de remover — `assign()` ainda usa `isStaffRole` para validar o `assignee`, então o import **continua necessário**).

- [ ] **Step 5: Adicionar guarda de setor em `assign()` e `updateStatus()`**

Em `assign()`, troque:
```ts
  async assign(id: string, assignedTo: string, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    // OPERATOR só pode assumir o chamado para si; ADMIN atribui a qualquer membro da equipe.
```
por:
```ts
  async assign(id: string, assignedTo: string, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket, user);

    // OPERATOR só pode assumir o chamado para si; ADMIN atribui a qualquer membro da equipe.
```

Em `updateStatus()`, troque:
```ts
  async updateStatus(id: string, status: TicketStatus, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    const resolvedAt =
```
por:
```ts
  async updateStatus(id: string, status: TicketStatus, user: AuthUser) {
    if (status === 'PENDING_APPROVAL') {
      throw new BadRequestException(
        'Não é possível definir "aguardando aprovação" manualmente — use o endpoint de aprovação',
      );
    }
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket, user);

    const resolvedAt =
```

- [ ] **Step 6: Implementar `approve()`**

Adicione, logo após o método `updateStatus()`:
```ts
  // Aprovação (só ADMIN, só a partir de PENDING_APPROVAL) — reaproveita o mesmo
  // updateStatusWithHistory usado por updateStatus(), sem tabela/repositório novos.
  async approve(id: string, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    if (ticket.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Chamado não está aguardando aprovação');
    }
    const updated = await this.repo.updateStatusWithHistory({
      id,
      fromStatus: ticket.status,
      toStatus: 'OPEN',
      changedBy: user.userId,
      resolvedAt: null,
    });
    return this.hideByRole(this.withSla(updated), user);
  }
```

- [ ] **Step 7: Adicionar o endpoint no controller**

Em `packages/api/src/modules/tickets/tickets.controller.ts`, adicione logo após o método `assign`:
```ts
  @Patch(':id/approve')
  @Roles('ADMIN')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.approve(id, user);
  }
```

- [ ] **Step 8: Rodar os testes e confirmar sucesso**

Run:
```bash
npm test -w @chamados/api
```
Expected: PASS em toda a suíte (`tickets.service.spec.ts` + `departments.service.spec.ts`).

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/modules/tickets/tickets.service.ts packages/api/src/modules/tickets/tickets.controller.ts packages/api/src/modules/tickets/tickets.service.spec.ts
git commit -m "feat(api): RBAC de OPERATOR por setor executor + endpoint de aprovação"
```

---

### Task 11: Verificação final

**Files:** nenhum (só validação).

**Interfaces:** Consumes: todas as tasks anteriores.

- [ ] **Step 1: Build completo (ordem de dependência do monorepo)**

Run:
```bash
npm run build -w @chamados/shared
npm run build -w @chamados/api
```
Expected: ambos limpos, sem erro de TypeScript.

- [ ] **Step 2: Suíte de testes completa**

Run:
```bash
npm test -w @chamados/api
```
Expected: todos os testes passando (existentes + os ~20 novos das Tasks 8, 9 e 10).

- [ ] **Step 3: Smoke manual (dev DB já com as 3 migrations aplicadas)**

Run:
```bash
npm run dev
```
Com o admin seed (`admin@chamados.local`/`senha123`):
1. `GET /departments` → confirmar 15 setores, TI com `isExecutorDept=true`/`isRequesterDept=false`, Presidência com `requiresApproval=true`.
2. `GET /categories` → confirmar 20 categorias (6 TI + 8 Manutenção + 6 Limpeza), cada uma com `departmentId` preenchido.
3. `POST /tickets` com uma categoria de Manutenção → chamado nasce `OPEN`, `executorDepartmentId` = id de Manutenção.
4. `POST /tickets` com uma categoria mapeada pra Presidência (crie uma categoria de teste temporária apontando pra Presidência se nenhuma existir ainda) → chamado nasce `PENDING_APPROVAL`.
5. `PATCH /tickets/:id/approve` (como admin) no chamado do passo 4 → vira `OPEN`.
6. Criar um `OPERATOR` com `departmentId` = Manutenção (via `PATCH` de usuário existente ou seed manual) → `GET /tickets` autenticado como ele só retorna chamados com `executorDepartmentId` = Manutenção.

- [ ] **Step 4: Commit final (se sobrar algo solto)**

```bash
git status
```
Expected: working tree limpo — todas as tasks já commitaram individualmente. Se houver sobra, `git add` + commit com mensagem descritiva.
