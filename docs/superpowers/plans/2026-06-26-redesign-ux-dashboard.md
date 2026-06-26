# Redesign UX / Triagem / Dashboard Grená — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar a complexidade do usuário (vira triagem do admin), entregar dashboard dinâmico em grená com sidebar retrátil, timeline de acompanhamento com notificação por polling, e controle total de usuários pelo admin.

**Architecture:** Monorepo NPM workspaces. Backend NestJS + Prisma + PostgreSQL (repository pattern fino sobre PrismaService, regras no service, prioridade no PriorityService). Frontend React + Vite + Tailwind + TanStack Query. Enums = union types no `@chamados/shared` espelhando enums do Prisma. Notificação de "não lido" via denormalização (`lastActivityAt`/`lastActivityBy` no ticket) + tabela `ticket_read_state`, consultada por polling.

**Tech Stack:** TypeScript strict, NestJS 10, Prisma 6, PostgreSQL 16, React 18, Vite 6, Tailwind 3, TanStack Query 5, class-validator, bcryptjs.

## Global Constraints

- TypeScript strict em todos os pacotes. Sem `any`.
- Enums: union types + arrays `as const` no shared, valores UPPER_SNAKE_CASE idênticos ao Prisma. NÃO usar `enum` nativo do TS no shared.
- Validação na API com class-validator usando os arrays do shared (`@IsIn(ARRAY)`).
- Web consome `@chamados/shared` do SOURCE (`../shared/src/index.ts`); API consome do `dist`. Rodar `npm run build -w @chamados/shared` após mudar o shared (gotcha shared-cjs-rollup).
- Mobile-first, viewport mínimo 375px, alvos de toque ≥44px.
- REST simples: sem GraphQL, sem WebSocket. Sem SMTP/e-mail.
- Senhas SEMPRE com bcrypt cost 10 (decisions/password-hashing). Nunca texto puro.
- `tickets.assigned_to` é sempre um ADMIN. Visibilidade: USER vê só os próprios; ADMIN vê todos (aplicar no service).
- Paleta grená: `#7A1C27` (DEFAULT), `#5A0F1C` (dark), `#A23B47` (light), `#FAF7F8` (surface).
- **Sem TDD automatizado / sem git neste plano:** o projeto não tem harness de testes nem repositório git inicializado, e testes automatizados foram deferidos pelo usuário (handoff 2026-06-25). Cada task termina em um checkpoint de verificação: type-check/build do pacote + checagem manual (curl na API ou tela no navegador). Substitui os passos de "commit". (Opcional: rodar `git init` antes, se quiser versionar.)
- Stack de dev já roda com `npm run dev` na raiz; Postgres via `docker compose up -d`. Credenciais seed: admin@chamados.local / user@chamados.local / senha123.
- Regra nº 1 do projeto: ler docs/memory antes e atualizar a memória depois (Task 14).

---

### Task 1: Shared — enums e tipos (TRIAGE, campos nuláveis, novos inputs)

**Files:**
- Modify: `packages/shared/src/enums.ts`
- Modify: `packages/shared/src/types.ts`

**Interfaces:**
- Produces: `TICKET_STATUSES` agora inclui `'TRIAGE'`; `Ticket.complexity: Complexity | null`, `Ticket.priority: Priority | null`, `Ticket.lastActivityAt: string`, `Ticket.lastActivityBy: string | null`, `Ticket.hasUnread?: boolean`. Novos: `UpdateTicketInput`, `UpdateUserInput`, `UnreadCount`. `CreateTicketInput` sem `complexity`.

- [ ] **Step 1: Atualizar `TICKET_STATUSES`**

Em `packages/shared/src/enums.ts`, trocar a linha do enum de status por:

```ts
export const TICKET_STATUSES = ['TRIAGE', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
```

- [ ] **Step 2: Ajustar `Ticket` e inputs em `types.ts`**

Em `packages/shared/src/types.ts`, substituir a interface `Ticket` por:

```ts
export interface Ticket {
  id: string;
  title: string;
  description: string;
  complexity: Complexity | null;
  priority: Priority | null;
  status: TicketStatus;
  departmentId: string;
  requesterId: string;
  assignedTo: string | null;
  lastActivityAt: string;
  lastActivityBy: string | null;
  hasUnread?: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}
```

Trocar `CreateTicketInput` (remover `complexity`):

```ts
export interface CreateTicketInput {
  title: string;
  description: string;
  departmentId: string;
}
```

Adicionar, ao final da seção `// ---- Inputs ----`:

```ts
export interface UpdateTicketInput {
  complexity?: Complexity;
  departmentId?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: Role;
  departmentId?: string | null;
  password?: string;
}

export interface UnreadCount {
  count: number;
}
```

- [ ] **Step 3: Build do shared**

Run: `npm run build -w @chamados/shared`
Expected: compila sem erros (gera `packages/shared/dist`).

- [ ] **Step 4: Verificação**

Run: `npm run build -w @chamados/shared`
Expected: PASS (0 erros). Os consumidores ainda não foram ajustados — erros aparecerão nas tasks seguintes, é esperado.

---

### Task 2: Prisma — schema + migration (nuláveis, TRIAGE, lastActivity, ticket_read_state)

**Files:**
- Modify: `packages/api/prisma/schema.prisma`

**Interfaces:**
- Produces: enum `TicketStatus` com `TRIAGE`; `Ticket.complexity`/`priority` nuláveis; `Ticket.lastActivityAt`/`lastActivityBy`; model `TicketReadState`; default de `Ticket.status` = `TRIAGE`.

- [ ] **Step 1: Atualizar enum e model Ticket**

Em `packages/api/prisma/schema.prisma`, no enum `TicketStatus` adicionar `TRIAGE` como primeiro valor:

```prisma
enum TicketStatus {
  TRIAGE
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```

No model `Ticket`, tornar nuláveis e adicionar denormalização + relação:

```prisma
  complexity   Complexity?
  priority     Priority?
  status       TicketStatus @default(TRIAGE)
```

E, antes de `comments TicketComment[]`, adicionar:

```prisma
  lastActivityAt DateTime @default(now()) @map("last_activity_at")
  lastActivityBy String?  @map("last_activity_by")

  readStates TicketReadState[]
```

- [ ] **Step 2: Adicionar relação em User e o novo model**

No model `User`, adicionar à lista de relações:

```prisma
  readStates TicketReadState[]
```

Ao final do arquivo, adicionar:

```prisma
model TicketReadState {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  user       User     @relation(fields: [userId], references: [id])
  ticketId   String   @map("ticket_id")
  ticket     Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  lastSeenAt DateTime @default(now()) @map("last_seen_at")

  @@unique([userId, ticketId])
  @@index([userId])
  @@map("ticket_read_state")
}
```

- [ ] **Step 3: Criar a migration**

Run: `npm run db:migrate -w @chamados/api -- --name triage_and_notifications`
Expected: cria `prisma/migrations/<timestamp>_triage_and_notifications/` e regenera o Prisma Client. (Postgres precisa estar no ar: `docker compose up -d`.)

- [ ] **Step 4: Verificação**

Run: `docker exec chamados-db psql -U chamados -d chamados -c "\d tickets" `
Expected: colunas `last_activity_at`, `last_activity_by`, e `complexity`/`priority` nuláveis. E `\dt` lista `ticket_read_state`.

---

### Task 3: Backend — fluxo de triagem (criar sem complexidade + PATCH /tickets/:id)

**Files:**
- Modify: `packages/api/src/modules/tickets/dto/create-ticket.dto.ts`
- Create: `packages/api/src/modules/tickets/dto/update-ticket.dto.ts`
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.ts`
- Modify: `packages/api/src/modules/tickets/tickets.controller.ts`

**Interfaces:**
- Consumes: `PriorityService.compute(complexity, weight)`, `DepartmentsRepository.findById`.
- Produces: `TicketsService.update(id, dto, user)`; `TicketsRepository.applyTriage(...)`; ticket criado em `TRIAGE` com `complexity/priority = null`.

- [ ] **Step 1: Remover complexity do CreateTicketDto**

Substituir `packages/api/src/modules/tickets/dto/create-ticket.dto.ts` por:

```ts
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsUUID()
  departmentId!: string;
}
```

- [ ] **Step 2: Criar UpdateTicketDto**

Criar `packages/api/src/modules/tickets/dto/update-ticket.dto.ts`:

```ts
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { COMPLEXITIES, Complexity } from '@chamados/shared';

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(COMPLEXITIES)
  complexity?: Complexity;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
```

- [ ] **Step 3: Ajustar o repository (create em TRIAGE, applyTriage, lastActivity)**

Em `packages/api/src/modules/tickets/tickets.repository.ts`:

Trocar a assinatura/corpo de `createWithHistory` por (complexity/priority null, status TRIAGE, denormalização):

```ts
  createWithHistory(input: {
    title: string;
    description: string;
    departmentId: string;
    requesterId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          title: input.title,
          description: input.description,
          complexity: null,
          priority: null,
          status: 'TRIAGE',
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
          toStatus: 'TRIAGE',
          changedBy: input.requesterId,
        },
      });
      return ticket;
    });
  }
```

No `updateStatusWithHistory`, dentro do `tx.ticket.update`, adicionar denormalização ao `data`:

```ts
        data: {
          status: input.toStatus,
          resolvedAt: input.resolvedAt,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
```

Trocar `addComment` para transação que também atualiza a atividade do ticket:

```ts
  addComment(ticketId: string, authorId: string, body: string) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.ticketComment.create({
        data: { ticketId, authorId, body },
        include: { author: true },
      });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { lastActivityAt: new Date(), lastActivityBy: authorId },
      });
      return comment;
    });
  }
```

Adicionar o método `applyTriage` (após `assign`):

```ts
  applyTriage(input: {
    id: string;
    complexity: Complexity | null;
    priority: Priority | null;
    departmentId: string;
    moveToOpen: boolean;
    changedBy: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: input.id },
        data: {
          complexity: input.complexity,
          priority: input.priority,
          departmentId: input.departmentId,
          status: input.moveToOpen ? 'OPEN' : undefined,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
      });
      if (input.moveToOpen) {
        await tx.ticketStatusHistory.create({
          data: {
            ticketId: input.id,
            fromStatus: 'TRIAGE',
            toStatus: 'OPEN',
            changedBy: input.changedBy,
          },
        });
      }
      return ticket;
    });
  }
```

- [ ] **Step 4: Ajustar o service (create sem complexity + update)**

Em `packages/api/src/modules/tickets/tickets.service.ts`:

Importar o DTO no topo: `import { UpdateTicketDto } from './dto/update-ticket.dto';`

Trocar `create` por:

```ts
  async create(dto: CreateTicketDto, user: AuthUser) {
    const department = await this.departments.findById(dto.departmentId);
    if (!department) throw new NotFoundException('Departamento não encontrado');

    return this.repo.createWithHistory({
      title: dto.title,
      description: dto.description,
      departmentId: dto.departmentId,
      requesterId: user.userId,
    });
  }
```

Adicionar o método `update` (após `create`):

```ts
  async update(id: string, dto: UpdateTicketDto, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');

    const departmentId = dto.departmentId ?? ticket.departmentId;
    const department = await this.departments.findById(departmentId);
    if (!department) throw new NotFoundException('Departamento não encontrado');

    const complexity = dto.complexity ?? ticket.complexity;
    const priority = complexity
      ? this.priority.compute(complexity, department.priorityWeight)
      : null;
    const moveToOpen = ticket.status === 'TRIAGE' && complexity != null;

    return this.repo.applyTriage({
      id,
      complexity,
      priority,
      departmentId,
      moveToOpen,
      changedBy: user.userId,
    });
  }
```

- [ ] **Step 5: Adicionar a rota PATCH /tickets/:id**

Em `packages/api/src/modules/tickets/tickets.controller.ts`, importar `import { UpdateTicketDto } from './dto/update-ticket.dto';` e adicionar (antes de `@Patch(':id/status')`):

```ts
  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.update(id, dto, user);
  }
```

- [ ] **Step 6: Build do API**

Run: `npm run build -w @chamados/api`
Expected: PASS (0 erros).

- [ ] **Step 7: Verificação ponta a ponta**

Com a stack no ar (`npm run dev`), criar chamado como user e triá-lo como admin:

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"user@chamados.local","password":"senha123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
DEPT=$(curl -s localhost:3000/api/departments -H "Authorization: Bearer $TOKEN" | sed -E 's/.*"id":"([^"]+)".*/\1/')
curl -s -X POST localhost:3000/api/tickets -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"title\":\"Teste triagem\",\"description\":\"sem complexidade\",\"departmentId\":\"$DEPT\"}"
```
Expected: ticket retornado com `"status":"TRIAGE"`, `"complexity":null`, `"priority":null`.

---

### Task 4: Backend — notificações (marcar como visto, hasUnread na lista, contador)

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.ts`
- Modify: `packages/api/src/modules/tickets/tickets.controller.ts`

**Interfaces:**
- Consumes: `TicketsRepository.findMany`, `findDetail`.
- Produces: `TicketsRepository.markSeen(userId, ticketId)`, `findReadStates(userId, ticketIds)`; `TicketsService.list` retorna tickets com `hasUnread`; `TicketsService.unreadCount(user)`; rota `GET /tickets/unread/count`; `detail` marca como visto.

- [ ] **Step 1: Métodos de read-state no repository**

Em `packages/api/src/modules/tickets/tickets.repository.ts`, adicionar:

```ts
  markSeen(userId: string, ticketId: string) {
    return this.prisma.ticketReadState.upsert({
      where: { userId_ticketId: { userId, ticketId } },
      update: { lastSeenAt: new Date() },
      create: { userId, ticketId },
    });
  }

  findReadStates(userId: string, ticketIds: string[]) {
    return this.prisma.ticketReadState.findMany({
      where: { userId, ticketId: { in: ticketIds } },
    });
  }
```

- [ ] **Step 2: Computar hasUnread no service.list e marcar visto no detail**

Em `packages/api/src/modules/tickets/tickets.service.ts`:

Tornar `list` assíncrono e enriquecer com `hasUnread`:

```ts
  async list(query: TicketQueryDto, user: AuthUser) {
    const where: Prisma.TicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (user.role === 'USER') where.requesterId = user.userId;

    const tickets = await this.repo.findMany(where);
    const states = await this.repo.findReadStates(
      user.userId,
      tickets.map((t) => t.id),
    );
    const seen = new Map(states.map((s) => [s.ticketId, s.lastSeenAt]));

    return tickets.map((t) => ({
      ...t,
      hasUnread: this.isUnread(t.lastActivityAt, t.lastActivityBy, seen.get(t.id), user.userId),
    }));
  }

  private isUnread(
    lastActivityAt: Date,
    lastActivityBy: string | null,
    lastSeenAt: Date | undefined,
    userId: string,
  ): boolean {
    if (!lastActivityBy || lastActivityBy === userId) return false;
    if (!lastSeenAt) return true;
    return lastActivityAt > lastSeenAt;
  }
```

Em `detail`, marcar como visto antes do return:

```ts
  async detail(id: string, user: AuthUser) {
    const ticket = await this.repo.findDetail(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);
    await this.repo.markSeen(user.userId, id);
    return ticket;
  }
```

Adicionar `unreadCount` (reaproveita `list`, DRY):

```ts
  async unreadCount(user: AuthUser) {
    const tickets = await this.list({} as TicketQueryDto, user);
    return { count: tickets.filter((t) => t.hasUnread).length };
  }
```

- [ ] **Step 3: Rota do contador**

Em `packages/api/src/modules/tickets/tickets.controller.ts`, adicionar ANTES da rota `@Get(':id')` (para não colidir com o ParseUUIDPipe):

```ts
  @Get('unread/count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.tickets.unreadCount(user);
  }
```

- [ ] **Step 4: Build do API**

Run: `npm run build -w @chamados/api`
Expected: PASS (0 erros).

- [ ] **Step 5: Verificação**

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@chamados.local","password":"senha123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s localhost:3000/api/tickets -H "Authorization: Bearer $TOKEN" | grep -o '"hasUnread":[a-z]*' | head
curl -s localhost:3000/api/tickets/unread/count -H "Authorization: Bearer $TOKEN"
```
Expected: lista com `"hasUnread":true|false` por ticket; contador `{"count":N}`. Abrir um ticket via `GET /tickets/:id` e reconsultar o contador deve reduzir (marca como visto).

---

### Task 5: Backend — gestão total de usuários (PATCH /users/:id)

**Files:**
- Create: `packages/api/src/modules/users/dto/update-user.dto.ts`
- Modify: `packages/api/src/modules/users/users.repository.ts`
- Modify: `packages/api/src/modules/users/users.service.ts`
- Modify: `packages/api/src/modules/users/users.controller.ts`

**Interfaces:**
- Produces: `UsersService.update(id, dto)` → `UserPublic`; `UsersRepository.update(id, data)`; rota `PATCH /users/:id` (ADMIN).

- [ ] **Step 1: UpdateUserDto**

Criar `packages/api/src/modules/users/dto/update-user.dto.ts`:

```ts
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ROLES, Role } from '@chamados/shared';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  // Aceita string (UUID) ou null para remover do departamento.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  departmentId?: string | null;
}
```

- [ ] **Step 2: Método update no repository**

Em `packages/api/src/modules/users/users.repository.ts`, adicionar:

```ts
  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }
```

- [ ] **Step 3: Lógica no service**

Em `packages/api/src/modules/users/users.service.ts`, importar o DTO e o tipo do Prisma:

```ts
import { Prisma } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
```

Adicionar o método:

```ts
  async update(id: string, dto: UpdateUserDto) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (dto.email && dto.email !== user.email) {
      const exists = await this.repo.findByEmail(dto.email);
      if (exists) throw new ConflictException('E-mail já cadastrado');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.departmentId !== undefined) {
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }

    const updated = await this.repo.update(id, data);
    return toUserPublic(updated);
  }
```

- [ ] **Step 4: Rota no controller**

Em `packages/api/src/modules/users/users.controller.ts`, importar `Param`, `ParseUUIDPipe`, `Patch` de `@nestjs/common` e `UpdateUserDto`, e adicionar:

```ts
  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
```

- [ ] **Step 5: Build + verificação**

Run: `npm run build -w @chamados/api`
Expected: PASS.

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@chamados.local","password":"senha123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
UID=$(curl -s localhost:3000/api/users -H "Authorization: Bearer $TOKEN" | sed -E 's/.*"email":"user@chamados.local"[^}]*//' | sed -E 's/.*\{"id":"([^"]+)".*/\1/')
# Redefinir nome e senha do user:
curl -s -X PATCH localhost:3000/api/users/$UID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Usuario Editado","password":"novaSenha123"}'
curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"user@chamados.local","password":"novaSenha123"}'
```
Expected: PATCH retorna usuário com `"name":"Usuario Editado"`; login com a nova senha retorna token.

---

### Task 6: Backend — atualizar seed para refletir triagem

**Files:**
- Modify: `packages/api/prisma/seed.ts`

**Interfaces:**
- Consumes: estrutura atual do seed (admin/user/depts).

- [ ] **Step 1: Ler o seed atual**

Run: ler `packages/api/prisma/seed.ts` inteiro para alinhar nomes de variáveis (ex.: ids de departamento, admin/user) antes de editar.

- [ ] **Step 2: Ajustar a criação de chamados**

Substituir o bloco que cria chamados de exemplo para: (a) NÃO usar `computePriority` na criação do que está em triagem; (b) criar pelo menos 1 chamado em `TRIAGE` (complexity/priority null) e 1 já triado (`OPEN` com complexity/priority calculadas), preenchendo `lastActivityAt`/`lastActivityBy`. Modelo (ajuste os nomes de variáveis ao seed real):

```ts
// Chamado em triagem (aberto pelo user, ainda sem complexidade):
await prisma.ticket.create({
  data: {
    title: 'Computador não liga',
    description: 'A máquina da recepção não dá vídeo.',
    complexity: null,
    priority: null,
    status: 'TRIAGE',
    department: { connect: { id: deptTI.id } },
    requester: { connect: { id: user.id } },
    lastActivityBy: user.id,
    history: { create: { fromStatus: null, toStatus: 'TRIAGE', changedBy: user.id } },
  },
});

// Chamado já triado pelo admin (OPEN, com prioridade calculada):
const triadoPriority = computePriority('HIGH', deptTI.priorityWeight);
await prisma.ticket.create({
  data: {
    title: 'Sistema de ponto fora do ar',
    description: 'Ninguém consegue bater o ponto.',
    complexity: 'HIGH',
    priority: triadoPriority,
    status: 'OPEN',
    department: { connect: { id: deptTI.id } },
    requester: { connect: { id: user.id } },
    lastActivityBy: admin.id,
    history: {
      create: [
        { fromStatus: null, toStatus: 'TRIAGE', changedBy: user.id },
        { fromStatus: 'TRIAGE', toStatus: 'OPEN', changedBy: admin.id },
      ],
    },
  },
});
```

- [ ] **Step 3: Resetar e popular**

Run: `npm run db:reset -w @chamados/api`
(Confirma a reaplicação das migrations + seed. Em prompt, aceitar.)
Expected: "Seed concluído." sem erros.

- [ ] **Step 4: Verificação**

Run: `docker exec chamados-db psql -U chamados -d chamados -c "SELECT title, status, complexity, priority FROM tickets;"`
Expected: ao menos um `TRIAGE` com complexity/priority nulos e um `OPEN` com valores.

---

### Task 7: Frontend — tema Grená (Tailwind, componentes base, labels)

**Files:**
- Modify: `packages/web/tailwind.config.js`
- Modify: `packages/web/src/lib/labels.ts`
- Modify: `packages/web/src/components/ui/button.tsx`
- Modify: `packages/web/src/components/ui/card.tsx`
- Modify: `packages/web/src/components/ui/badge.tsx`

**Interfaces:**
- Produces: tokens `grena`/`surface` no Tailwind; `STATUS_LABEL.TRIAGE`/`STATUS_CLASS.TRIAGE`; helpers de label para prioridade/complexidade null; botões/cards em grená com efeitos.

- [ ] **Step 1: Paleta no Tailwind**

Substituir `packages/web/tailwind.config.js` por:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        grena: { DEFAULT: '#7A1C27', dark: '#5A0F1C', light: '#A23B47' },
        surface: '#FAF7F8',
      },
      boxShadow: {
        grena: '0 10px 25px -5px rgba(122, 28, 39, 0.25)',
      },
      backgroundImage: {
        'grena-gradient': 'linear-gradient(135deg, #8C2233, #5A0F1C)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Labels (TRIAGE + fallback de null)**

Em `packages/web/src/lib/labels.ts`:

Adicionar `TRIAGE` aos mapas de status:

```ts
export const STATUS_LABEL: Record<TicketStatus, string> = {
  TRIAGE: 'Em triagem',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

export const STATUS_CLASS: Record<TicketStatus, string> = {
  TRIAGE: 'bg-grena/10 text-grena ring-grena/30',
  OPEN: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  RESOLVED: 'bg-green-100 text-green-800 ring-green-600/20',
  CLOSED: 'bg-gray-100 text-gray-700 ring-gray-500/20',
};
```

Adicionar helpers para valores nuláveis ao final do arquivo:

```ts
export function priorityLabel(p: Priority | null): string {
  return p ? PRIORITY_LABEL[p] : 'Em triagem';
}

export function complexityLabel(c: Complexity | null): string {
  return c ? COMPLEXITY_LABEL[c] : 'A definir';
}
```

- [ ] **Step 3: Componentes base em grená**

Ler `button.tsx`, `card.tsx`, `badge.tsx` e aplicar:
- `button.tsx` (variant primária): trocar `bg-indigo-600`→`bg-grena`, `hover:bg-indigo-700`→`hover:bg-grena-dark`, e adicionar `shadow-grena` na primária; manter `min-h-[44px]`.
- `card.tsx`: trocar borda/sombra por estilo "glass" suave: classes base `rounded-xl border border-white/60 bg-white/80 backdrop-blur shadow-grena/10` (manter a prop `className` concatenando via `cn`).
- `badge.tsx`: nenhuma cor fixa de indigo; manter como wrapper neutro que recebe classes (usado por Priority/StatusBadge).

- [ ] **Step 4: PriorityBadge tolerante a null**

Ler `packages/web/src/components/PriorityBadge.tsx` e ajustar para aceitar `priority: Priority | null`, renderizando o badge "Em triagem" (classe `bg-grena/10 text-grena ring-grena/30`) quando null, usando `priorityLabel`.

- [ ] **Step 5: Build do web**

Run: `npm run build -w @chamados/web`
Expected: pode falhar em telas ainda não migradas (Tasks 8–13). Verificar apenas que `tailwind.config.js`/`labels.ts` não introduzem erro de tipo. Concluir a verificação real no fim da Task 13.

---

### Task 8: Frontend — hooks de API (update ticket, update user, notificações)

**Files:**
- Modify: `packages/web/src/features/tickets/api.ts`
- Modify: `packages/web/src/features/users/api.ts`

**Interfaces:**
- Produces: `useUpdateTicket(id)`, `useUnreadCount()`, `useUpdateUser()`. Consome tipos `UpdateTicketInput`, `UnreadCount`, `UpdateUserInput` do shared (Task 1).

- [ ] **Step 1: Hooks de ticket**

Em `packages/web/src/features/tickets/api.ts`, adicionar import de `UpdateTicketInput, UnreadCount` e os hooks:

```ts
export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTicketInput) =>
      (await api.patch(`/tickets/${id}`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => (await api.get<UnreadCount>('/tickets/unread/count')).data,
    refetchInterval: 20000,
  });
}
```

Em `useUpdateStatus` e `useAddComment`, adicionar `qc.invalidateQueries({ queryKey: ['unread-count'] })` no `onSuccess` (para o badge reagir). Em `useTicket`, adicionar `onSuccess` invalidando `['unread-count']` (abrir o detalhe marca como visto no backend):

```ts
export function useTicket(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const data = (await api.get<TicketDetail>(`/tickets/${id}`)).data;
      qc.invalidateQueries({ queryKey: ['unread-count'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      return data;
    },
    enabled: Boolean(id),
  });
}
```

- [ ] **Step 2: Hook de update de usuário**

Em `packages/web/src/features/users/api.ts`, adicionar:

```ts
import { CreateUserInput, UpdateUserInput, UserPublic } from '@chamados/shared';

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateUserInput }) =>
      (await api.patch<UserPublic>(`/users/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
```

- [ ] **Step 3: Verificação**

Run: `npm run build -w @chamados/web`
Expected: sem erros nestes arquivos (telas pendentes podem acusar — ok até Task 13).

---

### Task 9: Frontend — NewTicketPage (remover complexidade)

**Files:**
- Modify: `packages/web/src/pages/NewTicketPage.tsx`

- [ ] **Step 1: Remover campo e texto de complexidade**

Remover: o import de `Complexity, COMPLEXITIES`, o estado `complexity`, o `<Select>` de complexidade (e seu wrapper `<div>`), o texto "A prioridade é calculada automaticamente…", e o `complexity` do payload de `createTicket.mutateAsync`. O `grid sm:grid-cols-2` que continha complexidade+departamento passa a ter só Departamento (pode virar bloco simples).

Payload final:

```ts
const ticket = await createTicket.mutateAsync({ title, description, departmentId });
```

Adicionar uma nota curta no lugar: `<p className="text-xs text-gray-500">A complexidade e a prioridade serão definidas pela equipe de TI na triagem.</p>`

- [ ] **Step 2: Verificação**

Run: `npm run build -w @chamados/web`
Expected: `NewTicketPage` sem erros. Na UI, a tela de novo chamado não mostra mais complexidade.

---

### Task 10: Frontend — AppShell (grená, sidebar retrátil, badge de notificação)

**Files:**
- Modify: `packages/web/src/layouts/AppShell.tsx`

**Interfaces:**
- Consumes: `useUnreadCount()` (Task 8).

- [ ] **Step 1: Estado de colapso persistido**

Adicionar estado `collapsed` lido/escrito em `localStorage` (chave `sidebar-collapsed`):

```ts
const [collapsed, setCollapsed] = useState(
  () => localStorage.getItem('sidebar-collapsed') === '1',
);
function toggleCollapsed() {
  setCollapsed((c) => {
    localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
    return !c;
  });
}
```

- [ ] **Step 2: Sidebar grená + retrátil + badge**

Reescrever a `sidebar`/`aside` para:
- Fundo `bg-grena-gradient text-white` (gradiente grená); largura `md:w-64`, e quando `collapsed` → `md:w-16` mostrando só ícones (usar um emoji/ícone por item + esconder o label com `hidden` quando collapsed).
- Botão de colapsar no topo (desktop), `aria-label="Recolher menu"`.
- Itens ativos: `bg-white/15`; hover `hover:bg-white/10`.
- Consumir `const { data: unread } = useUnreadCount();` e, no item Dashboard, exibir um badge quando `unread?.count` > 0: `<span className="ml-auto rounded-full bg-white text-grena text-xs px-2">{unread.count}</span>`.

Cada `NavItem` ganha um campo `icon: string` (ex.: Dashboard `▦`, Novo chamado `＋`, Usuários `👤`, Departamentos `🏢`).

- [ ] **Step 3: Verificação**

Run: `npm run dev` (se não estiver rodando) e abrir http://localhost:5173
Expected: sidebar grená; botão recolhe para ícones e o estado persiste ao recarregar; badge aparece quando há chamados com novidade.

---

### Task 11: Frontend — DashboardPage (KPIs, gráfico CSS, fila com concluir)

**Files:**
- Modify: `packages/web/src/pages/DashboardPage.tsx`
- Create: `packages/web/src/components/KpiCard.tsx`
- Create: `packages/web/src/components/PriorityBarChart.tsx`

**Interfaces:**
- Consumes: `useTickets`, `useUpdateStatus`, `useAuth`, `Ticket.hasUnread`, `priorityLabel`.

- [ ] **Step 1: KpiCard**

Criar `packages/web/src/components/KpiCard.tsx`:

```tsx
import { Card } from '@/components/ui/card';

export function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card
      className={
        highlight
          ? 'bg-grena-gradient p-4 text-white shadow-grena'
          : 'p-4'
      }
    >
      <div className={highlight ? 'text-xs opacity-90' : 'text-xs text-gray-500'}>{label}</div>
      <div className={highlight ? 'text-2xl font-bold' : 'text-2xl font-bold text-grena'}>
        {value}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: PriorityBarChart (CSS puro)**

Criar `packages/web/src/components/PriorityBarChart.tsx`:

```tsx
import { Priority } from '@chamados/shared';
import { Card } from '@/components/ui/card';
import { PRIORITY_LABEL } from '@/lib/labels';

const BAR: Record<Priority, string> = {
  LOW: 'bg-green-400',
  MEDIUM: 'bg-yellow-400',
  HIGH: 'bg-red-400',
  URGENT: 'bg-purple-500',
};
const ORDER: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function PriorityBarChart({ counts }: { counts: Record<Priority, number> }) {
  const max = Math.max(1, ...ORDER.map((p) => counts[p]));
  return (
    <Card className="p-4">
      <div className="mb-3 text-xs font-semibold text-gray-500">Chamados por prioridade</div>
      <div className="flex h-32 items-end gap-3">
        {ORDER.map((p) => (
          <div key={p} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-medium text-gray-600">{counts[p]}</span>
            <div
              className={`w-full rounded-t ${BAR[p]}`}
              style={{ height: `${(counts[p] / max) * 100}%`, minHeight: counts[p] ? 6 : 2 }}
            />
            <span className="text-[10px] text-gray-500">{PRIORITY_LABEL[p]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Reescrever a DashboardPage**

Em `packages/web/src/pages/DashboardPage.tsx`:
- Calcular KPIs a partir de `tickets`: `triagem = status==='TRIAGE'`, `abertos = status==='OPEN'||'IN_PROGRESS'`, `urgentes = priority==='URGENT'`, `resolvidos = status==='RESOLVED'||'CLOSED'`.
- Calcular `counts` por prioridade (ignorando null) para o gráfico.
- Renderizar (apenas para ADMIN) a linha de KPIs (`grid grid-cols-2 md:grid-cols-4 gap-3`) usando `KpiCard` (Urgentes com `highlight`) e o `PriorityBarChart`. Para USER, manter só a lista dos próprios chamados (sem KPIs gerenciais).
- Na fila/tabela: usar `PriorityBadge` (tolerante a null), data (`createdAt`), e uma coluna de ação com botão ✓ Concluir que chama `useUpdateStatus(t.id)` → `mutate({ status: 'RESOLVED' })`, visível só para ADMIN e quando `status` não for `RESOLVED`/`CLOSED`. Mostrar um ponto/realce (`•`) na linha quando `t.hasUnread`.
- Trocar o link "Novo chamado" de `bg-indigo-600 hover:bg-indigo-700` para `bg-grena hover:bg-grena-dark`.
- Trocar `text-indigo-700` dos links de título por `text-grena`.

O botão ✓ precisa de `useUpdateStatus` por linha; como hooks não podem ir em loop, extrair uma linha em subcomponente `TicketRow`/`TicketCard` dentro do mesmo arquivo que recebe `ticket` e renderiza o botão usando seu próprio `useUpdateStatus(ticket.id)`.

- [ ] **Step 4: Verificação**

Run: `npm run build -w @chamados/web` e abrir o dashboard como admin.
Expected: KPIs no topo, gráfico de barras, fila com ✓ Concluir funcionando (status muda para Resolvido). Como user, só a lista própria.

---

### Task 12: Frontend — TicketDetailPage (timeline unificada, triagem, concluir)

**Files:**
- Modify: `packages/web/src/pages/TicketDetailPage.tsx`

**Interfaces:**
- Consumes: `useUpdateTicket(id)`, `useUpdateStatus(id)`, `priorityLabel`, `complexityLabel`.

- [ ] **Step 1: Triagem de complexidade (admin)**

No bloco "Ações do administrador", adicionar um `<Select>` de **Complexidade** (opções de `COMPLEXITIES` + `COMPLEXITY_LABEL`), valor atual `ticket.complexity ?? ''`, que ao mudar chama `useUpdateTicket(id).mutate({ complexity: value })`. Texto auxiliar: "Definir a complexidade calcula a prioridade e tira o chamado da triagem."

- [ ] **Step 2: Botão Concluir**

Adicionar botão "✓ Concluir chamado" (admin, escondido se já `RESOLVED`/`CLOSED`) chamando `updateStatus.mutate({ status: 'RESOLVED' })`.

- [ ] **Step 3: Timeline unificada**

Remover as duas seções separadas ("Histórico de status" e "Comentários") e criar UMA seção "Acompanhamento" que mescla os itens:

```tsx
type FeedItem =
  | { kind: 'status'; at: string; from: TicketStatus | null; to: TicketStatus }
  | { kind: 'comment'; at: string; author: string; body: string };

const feed: FeedItem[] = [
  ...ticket.history.map((h) => ({
    kind: 'status' as const,
    at: h.createdAt,
    from: h.fromStatus,
    to: h.toStatus,
  })),
  ...ticket.comments.map((c) => ({
    kind: 'comment' as const,
    at: c.createdAt,
    author: c.author?.name ?? 'Usuário',
    body: c.body,
  })),
].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
```

Renderizar cada item numa linha do tempo (borda à esquerda grená), com timestamp pt-BR; item `status` mostra "X → Y" via `STATUS_LABEL`, item `comment` mostra autor + corpo. Manter a caixa de novo comentário (usa `useAddComment`) ao final.

- [ ] **Step 4: Exibir null com segurança**

Trocar exibições de `COMPLEXITY_LABEL[ticket.complexity]` por `complexityLabel(ticket.complexity)` e a `PriorityBadge` já tolera null (Task 7).

- [ ] **Step 5: Verificação**

Run: abrir um chamado em triagem como admin.
Expected: definir complexidade move para "Aberto" e calcula prioridade; "Acompanhamento" mostra status + comentários numa só linha do tempo em ordem; comentar adiciona item; ✓ Concluir resolve.

---

### Task 13: Frontend — UsersPage (edição total + redefinir senha)

**Files:**
- Modify: `packages/web/src/pages/admin/UsersPage.tsx`

**Interfaces:**
- Consumes: `useUpdateUser()` (Task 8), `useDepartments`.

- [ ] **Step 1: Edição por usuário**

Na tabela de usuários, adicionar coluna "Ações" com botão "Editar" que abre um formulário inline/expansível (estado `editingId`) com campos: nome, e-mail, perfil (Select), departamento (Select), e **nova senha** (opcional, placeholder "Deixe em branco para manter"). Salvar chama:

```ts
updateUser.mutate({
  id: editingId,
  input: {
    name,
    email,
    role,
    departmentId: departmentId || null,
    ...(password ? { password } : {}),
  },
});
```

Mostrar erro de conflito de e-mail (`E-mail já cadastrado`) tratando o catch do mutate.

- [ ] **Step 2: Grená nos botões**

Trocar cores indigo remanescentes por grena (botões primários `bg-grena hover:bg-grena-dark`).

- [ ] **Step 3: Verificação final do frontend**

Run: `npm run build -w @chamados/web`
Expected: PASS (0 erros) em todo o web. Na UI: editar nome/e-mail/perfil/depto e redefinir senha funcionam; login com a nova senha funciona.

- [ ] **Step 4: Verificação de regressão geral**

Run: `npm run build` (raiz: shared → api → web)
Expected: os 3 pacotes compilam. Fluxo manual: user abre chamado (triagem) → admin define complexidade (vira Aberto, prioridade calculada) → admin comenta → user vê badge de não lido → user abre e o badge zera → admin conclui pelo dashboard.

---

### Task 14: Documentação / memória (Regra nº 1)

**Files:**
- Modify: `docs/memory/architecture/business-rules.md`
- Modify: `docs/memory/architecture/database.md`
- Modify: `docs/memory/architecture/frontend.md`
- Create: `docs/memory/decisions/ui-theme-grena.md`
- Create: `docs/memory/decisions/triagem-complexidade.md`
- Create: `docs/memory/decisions/notificacao-polling.md`
- Modify: `docs/memory/README.md`
- Create: `docs/memory/handoffs/sessao-2026-06-26.md` (anexar bloco) ou novo bloco no handoff do dia

- [ ] **Step 1: Atualizar architecture**
  - `business-rules.md`: complexidade definida na triagem pelo admin; status `TRIAGE` inicial; prioridade nula até triagem; timeline unificada; notificação por não-lido.
  - `database.md`: `complexity`/`priority` nuláveis; enum `TRIAGE`; colunas `last_activity_at`/`last_activity_by`; tabela `ticket_read_state`.
  - `frontend.md`: tema grená; dashboard KPIs+gráfico; sidebar retrátil; polling de notificação.

- [ ] **Step 2: Criar decisões**
  - `ui-theme-grena.md`: paleta, efeitos (gradiente/glass/sombra), motivação (identidade Juventus), tokens Tailwind.
  - `triagem-complexidade.md`: por que tirar complexidade do usuário; fluxo TRIAGE→OPEN; recálculo de prioridade.
  - `notificacao-polling.md`: denormalização `lastActivity*` + `ticket_read_state`; regra de hasUnread; polling 20s; por que não WebSocket no MVP. Linkar `[[auth-jwt]]`/`[[enum-strategy]]` quando fizer sentido.

- [ ] **Step 3: Atualizar índice + handoff**
  - Adicionar as 3 decisões ao `README.md`.
  - Registrar no handoff o que foi implementado e o que ficou para a Fase 2 (drag-and-drop/persistência de layout; gráficos com lib; testes automatizados).

- [ ] **Step 4: Verificação**

Run: ler `docs/memory/README.md`
Expected: índice reflete os novos arquivos; decisões coerentes com o código entregue.

---

## Self-Review (cobertura do spec)

- Triagem (complexidade sai do usuário) → Tasks 1,2,3,9,12 ✓
- Concluir chamados (dashboard) → Tasks 10? (não), Task 11 (✓ na fila) + Task 12 (✓ no detalhe) ✓
- Timeline unificada + notificação polling → Tasks 1,2,4,8,10,11,12 ✓
- Controle total de usuários → Tasks 1,5,8,13 ✓
- Tema grená moderno → Tasks 7,9,10,11,12,13 ✓
- Dashboard KPIs no topo + sidebar retrátil → Tasks 10,11 ✓
- Migrações (nuláveis, TRIAGE, read-state) → Task 2 ✓
- Remoção do texto de cálculo de complexidade → Task 9 ✓
- Docs/memória → Task 14 ✓
- Não-objetivos (drag-drop, WebSocket, SMTP, refresh token) → fora do plano ✓
