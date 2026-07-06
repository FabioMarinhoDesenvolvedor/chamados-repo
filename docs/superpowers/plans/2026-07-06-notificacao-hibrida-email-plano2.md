# Plano 2/4 — Notificação híbrida por e-mail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao criar um chamado que roteia para um setor com `notificationEmail` preenchido, enfileirar um e-mail (padrão outbox transacional) que um worker assíncrono envia via SMTP.

**Architecture:** `TicketsService.create()` gera o UUID do chamado, monta o e-mail e passa um payload de notificação para `createWithHistory`, que insere a linha `notification_outbox` **na mesma transação** do chamado. Um `MailWorker` (`@Cron` a cada 1 min) lê os `PENDING`, envia via `MailerService` (nodemailer; transporte stub quando SMTP não configurado) e marca `SENT`/`FAILED` (3 tentativas).

**Tech Stack:** NestJS, Prisma/PostgreSQL, `@nestjs/schedule` (já instalado), `@nestjs/config` (ConfigService), `nodemailer` (dependência nova), testes `node:test`.

## Global Constraints

- TypeScript strict, sem `any` (exceto stubs de teste já usados no projeto).
- Arquivos < 500 linhas; funções pequenas; nomes buscáveis (`MailWorker`, `NotificationOutboxRepository`, não `Handler`).
- Migrations aditivas; nunca alterar migration já rodada. **O agente NÃO roda `db:migrate`/`db:deploy`/`db:reset`** — edita `schema.prisma`, escreve o `migration.sql` à mão e roda só `npm run db:generate` (não precisa de banco). Quem aplica a migration é o Fabio.
- Commits: conventional commits com escopo (`feat(api):`, etc.), assinados `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Notificação é **1 e-mail por setor** (`Department.notificationEmail`), nunca por usuário (decisão Fabio 2026-07-06).
- Enum novo (`NotificationStatus`) criado junto com a tabela numa migration só é seguro — o gotcha `postgres-enum-default` vale só para `ALTER TYPE ADD VALUE` em enum existente.
- Rodar comandos de build/test com `-w @chamados/api` a partir da raiz do monorepo.

---

### Task 1: Schema + migration da `notification_outbox` + client

**Files:**
- Modify: `packages/api/prisma/schema.prisma` (novo enum + model + relação inversa no `Ticket`)
- Create: `packages/api/prisma/migrations/20260706120000_add_notification_outbox/migration.sql`

**Interfaces:**
- Produces: model Prisma `NotificationOutbox` (`prisma.notificationOutbox`) com campos `id, ticketId, toEmail, subject, body, status (PENDING|SENT|FAILED), attempts, lastError, createdAt, sentAt`; enum `NotificationStatus`. Consumido pelas Tasks 3, 5 e 6.

- [ ] **Step 1: Adicionar enum e model ao `schema.prisma`**

No fim do bloco de enums (após `enum TicketStatus { ... }`), adicionar:

```prisma
enum NotificationStatus {
  PENDING
  SENT
  FAILED
}
```

No fim do arquivo (após o model `TicketReadState`), adicionar:

```prisma
model NotificationOutbox {
  id        String             @id @default(uuid())
  ticketId  String             @map("ticket_id")
  ticket    Ticket             @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  toEmail   String             @map("to_email")
  subject   String
  body      String
  status    NotificationStatus @default(PENDING)
  attempts  Int                @default(0)
  lastError String?            @map("last_error")
  createdAt DateTime           @default(now()) @map("created_at")
  sentAt    DateTime?          @map("sent_at")

  @@index([status])
  @@map("notification_outbox")
}
```

No model `Ticket`, adicionar a relação inversa junto às outras (ex.: após `attachments TicketAttachment[]`):

```prisma
  notifications NotificationOutbox[]
```

- [ ] **Step 2: Escrever o `migration.sql` à mão**

Criar `packages/api/prisma/migrations/20260706120000_add_notification_outbox/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_outbox_status_idx" ON "notification_outbox"("status");

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerar o Prisma Client (não precisa de banco)**

Run: `npm run db:generate -w @chamados/api`
Expected: `Generated Prisma Client` sem erro (lê só o schema).

- [ ] **Step 4: Verificar que o build da api enxerga o novo model**

Run: `npm run build -w @chamados/api`
Expected: build limpo (o tipo `prisma.notificationOutbox` existe).

- [ ] **Step 5: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations/20260706120000_add_notification_outbox/
git commit -m "feat(api): schema + migration da notification_outbox (enum + tabela)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> **Nota de deploy (para o handoff, não é passo do agente):** o Fabio aplica com `npm run db:deploy -w @chamados/api`. Em dev, `npm run db:migrate -w @chamados/api`.

---

### Task 2: Montador de e-mail (`buildTicketEmail`) — função pura

**Files:**
- Create: `packages/api/src/modules/notifications/notification-email.ts`
- Test: `packages/api/src/modules/notifications/notification-email.spec.ts`

**Interfaces:**
- Produces: `buildTicketEmail(input: TicketEmailInput): { subject: string; body: string }` e a interface `TicketEmailInput` (`ticketId, title, requesterName, requesterDepartmentName, priority: Priority | null, description: string | null, originLocation: string | null, createdAt: Date, appUrl: string | null`). Consumido pela Task 6.

- [ ] **Step 1: Escrever o teste falho**

Criar `packages/api/src/modules/notifications/notification-email.spec.ts`:

```typescript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildTicketEmail } from './notification-email';

const base = {
  ticketId: 'abc-123',
  title: 'Manutenção › Elétrica › Tomada',
  requesterName: 'João',
  requesterDepartmentName: 'Tesouraria',
  priority: 'HIGH' as const,
  description: null,
  originLocation: null,
  createdAt: new Date('2026-07-06T13:00:00.000Z'),
  appUrl: 'https://chamados.local',
};

test('buildTicketEmail: assunto tem o título e corpo tem solicitante/setor/prioridade e link', () => {
  const { subject, body } = buildTicketEmail(base);
  assert.equal(subject, 'Novo chamado — Manutenção › Elétrica › Tomada');
  assert.match(body, /João/);
  assert.match(body, /Tesouraria/);
  assert.match(body, /HIGH/);
  assert.match(body, /https:\/\/chamados\.local\/tickets\/abc-123/);
});

test('buildTicketEmail: sem appUrl não inclui link; sem descrição não inclui a linha', () => {
  const { body } = buildTicketEmail({ ...base, appUrl: null, description: null });
  assert.doesNotMatch(body, /\/tickets\//);
  assert.doesNotMatch(body, /Descrição:/);
});

test('buildTicketEmail: com descrição e local de origem inclui as duas linhas', () => {
  const { body } = buildTicketEmail({ ...base, description: 'não liga', originLocation: 'Sala 2' });
  assert.match(body, /Descrição: não liga/);
  assert.match(body, /Local de origem: Sala 2/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w @chamados/api`
Expected: FAIL — `Cannot find module './notification-email'`.

- [ ] **Step 3: Implementar a função mínima**

Criar `packages/api/src/modules/notifications/notification-email.ts`:

```typescript
import { Priority } from '@chamados/shared';

export interface TicketEmailInput {
  ticketId: string;
  title: string;
  requesterName: string;
  requesterDepartmentName: string;
  priority: Priority | null;
  description: string | null;
  originLocation: string | null;
  createdAt: Date;
  appUrl: string | null;
}

// Monta o e-mail de aviso ao setor executor (pt-BR). Função pura — sem I/O, fácil de testar.
export function buildTicketEmail(t: TicketEmailInput): { subject: string; body: string } {
  const subject = `Novo chamado — ${t.title}`;
  const lines = [
    'Um novo chamado foi aberto para o seu setor.',
    '',
    `Título: ${t.title}`,
    `Solicitante: ${t.requesterName}`,
    `Setor do solicitante: ${t.requesterDepartmentName}`,
    `Prioridade: ${t.priority ?? '—'}`,
  ];
  if (t.description) lines.push(`Descrição: ${t.description}`);
  if (t.originLocation) lines.push(`Local de origem: ${t.originLocation}`);
  lines.push(`Aberto em: ${t.createdAt.toISOString()}`);
  if (t.appUrl) {
    lines.push('', `Abrir o chamado: ${t.appUrl.replace(/\/$/, '')}/tickets/${t.ticketId}`);
  }
  return { subject, body: lines.join('\n') };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w @chamados/api`
Expected: PASS (todos, incluindo os 3 novos).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/modules/notifications/notification-email.ts packages/api/src/modules/notifications/notification-email.spec.ts
git commit -m "feat(api): montador de e-mail de notificação (função pura + testes)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `NotificationOutboxRepository`

**Files:**
- Create: `packages/api/src/modules/notifications/notification-outbox.repository.ts`

**Interfaces:**
- Consumes: `PrismaService` (de `../../prisma/prisma.service`); model `NotificationOutbox` (Task 1).
- Produces: `NotificationOutboxRepository` com `findPending(limit: number): Promise<NotificationOutbox[]>`, `markSent(id: string)`, `markFailed(id: string, attempts: number, error: string): Promise<{ status: NotificationStatus; attempts: number }>`. Consumido pela Task 5.

> Repositório é wrapper fino do Prisma (padrão do projeto: repos não têm teste unitário isolado — são exercitados pelo worker com stub na Task 5 e pelo smoke final na Task 8). Verificação aqui é só compilar.

- [ ] **Step 1: Implementar o repositório**

Criar `packages/api/src/modules/notifications/notification-outbox.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Linhas ainda enviáveis: PENDING com menos de 3 tentativas, mais antigas primeiro.
  findPending(limit: number) {
    return this.prisma.notificationOutbox.findMany({
      where: { status: 'PENDING', attempts: { lt: 3 } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  markSent(id: string) {
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }

  // Erro: incrementa tentativas e grava o motivo; ao chegar a 3, marca FAILED (para de tentar).
  markFailed(id: string, attempts: number, error: string) {
    const nextAttempts = attempts + 1;
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        attempts: nextAttempts,
        lastError: error,
        status: nextAttempts >= 3 ? 'FAILED' : 'PENDING',
      },
    });
  }
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npm run build -w @chamados/api`
Expected: build limpo.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/modules/notifications/notification-outbox.repository.ts
git commit -m "feat(api): NotificationOutboxRepository (findPending/markSent/markFailed)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `MailerService` (nodemailer + stub)

**Files:**
- Modify: `packages/api/package.json` (dependências `nodemailer`, `@types/nodemailer`)
- Create: `packages/api/src/modules/notifications/mailer.service.ts`
- Test: `packages/api/src/modules/notifications/mailer.service.spec.ts`

**Interfaces:**
- Consumes: `ConfigService` (`@nestjs/config`); envs `SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM`.
- Produces: `MailerService` com `isStub(): boolean` e `send(to: string, subject: string, body: string): Promise<void>`. Consumido pela Task 5.

- [ ] **Step 1: Instalar o nodemailer**

Run: `npm install nodemailer -w @chamados/api && npm install -D @types/nodemailer -w @chamados/api`
Expected: instala sem erro; `package.json` da api ganha as duas entradas.

- [ ] **Step 2: Escrever o teste falho**

Criar `packages/api/src/modules/notifications/mailer.service.spec.ts`:

```typescript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MailerService } from './mailer.service';

// ConfigService stub: devolve o mapa dado (ou undefined).
function config(map: Record<string, string | undefined>) {
  return { get: (k: string) => map[k] } as any;
}

test('MailerService: sem SMTP_HOST cai no modo stub e send() não lança', async () => {
  const mailer = new MailerService(config({}));
  assert.equal(mailer.isStub(), true);
  await mailer.send('setor@x', 'Assunto', 'Corpo'); // não lança, só loga
});

test('MailerService: com SMTP_HOST não é stub', () => {
  const mailer = new MailerService(config({ SMTP_HOST: 'smtp.local', SMTP_PORT: '587' }));
  assert.equal(mailer.isStub(), false);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -w @chamados/api`
Expected: FAIL — `Cannot find module './mailer.service'`.

- [ ] **Step 4: Implementar o serviço**

Criar `packages/api/src/modules/notifications/mailer.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Envia e-mails de notificação. Sem SMTP_HOST configurado, opera em modo STUB: só loga
// (dev/CI/smoke, sem servidor SMTP). Com SMTP_* presentes, envia de verdade (produção).
@Injectable()
export class MailerService {
  private readonly logger = new Logger('MailerService');
  private readonly stub: boolean;
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.stub = !host || !host.trim();
    this.transporter = this.stub
      ? null
      : nodemailer.createTransport({
          host: host as string,
          port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
          auth: this.auth(),
        });
  }

  private auth(): { user: string; pass: string } | undefined {
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    return user && pass ? { user, pass } : undefined;
  }

  isStub(): boolean {
    return this.stub;
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (this.stub) {
      this.logger.log(`[STUB] SMTP não configurado — e-mail NÃO enviado. Para: ${to} | ${subject}`);
      return;
    }
    const from = this.config.get<string>('SMTP_FROM') ?? 'chamados@localhost';
    await this.transporter!.sendMail({ from, to, subject, text: body });
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -w @chamados/api`
Expected: PASS (incluindo os 2 novos).

- [ ] **Step 6: Commit**

```bash
git add packages/api/package.json packages/api/package-lock.json packages/api/src/modules/notifications/mailer.service.ts packages/api/src/modules/notifications/mailer.service.spec.ts
git commit -m "feat(api): MailerService (nodemailer, stub sem SMTP_HOST) + testes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Se o `package-lock.json` ficar na raiz do monorepo em vez de na api, faça `git add package-lock.json` na raiz.

---

### Task 5: `MailWorker` (@Cron a cada 1 min)

**Files:**
- Create: `packages/api/src/modules/notifications/mail-worker.service.ts`
- Test: `packages/api/src/modules/notifications/mail-worker.service.spec.ts`

**Interfaces:**
- Consumes: `NotificationOutboxRepository` (Task 3), `MailerService` (Task 4).
- Produces: `MailWorker` com `process(): Promise<void>` (o método anotado com `@Cron`). Consumido pela Task 7 (registro no módulo).

- [ ] **Step 1: Escrever o teste falho**

Criar `packages/api/src/modules/notifications/mail-worker.service.spec.ts`:

```typescript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MailWorker } from './mail-worker.service';

function makeWorker(over: {
  pending?: any[];
  sendImpl?: () => Promise<void>;
}) {
  const calls: { sent: string[]; failed: { id: string; attempts: number }[] } = {
    sent: [],
    failed: [],
  };
  const outbox = {
    findPending: async () => over.pending ?? [],
    markSent: async (id: string) => {
      calls.sent.push(id);
      return { id, status: 'SENT', attempts: 0 };
    },
    markFailed: async (id: string, attempts: number) => {
      calls.failed.push({ id, attempts });
      const next = attempts + 1;
      return { id, status: next >= 3 ? 'FAILED' : 'PENDING', attempts: next };
    },
  } as any;
  const mailer = {
    send: over.sendImpl ?? (async () => undefined),
  } as any;
  return { worker: new MailWorker(outbox, mailer), calls };
}

test('MailWorker: envio ok marca SENT', async () => {
  const { worker, calls } = makeWorker({
    pending: [{ id: 'n1', toEmail: 'a@x', subject: 's', body: 'b', attempts: 0 }],
  });
  await worker.process();
  assert.deepEqual(calls.sent, ['n1']);
  assert.equal(calls.failed.length, 0);
});

test('MailWorker: erro no envio chama markFailed com as tentativas atuais', async () => {
  const { worker, calls } = makeWorker({
    pending: [{ id: 'n1', toEmail: 'a@x', subject: 's', body: 'b', attempts: 2 }],
    sendImpl: async () => {
      throw new Error('smtp caiu');
    },
  });
  await worker.process();
  assert.equal(calls.sent.length, 0);
  assert.deepEqual(calls.failed, [{ id: 'n1', attempts: 2 }]); // markFailed decide o FAILED
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w @chamados/api`
Expected: FAIL — `Cannot find module './mail-worker.service'`.

- [ ] **Step 3: Implementar o worker**

Criar `packages/api/src/modules/notifications/mail-worker.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from './mailer.service';
import { NotificationOutboxRepository } from './notification-outbox.repository';

// Processa a fila de e-mails. Single-process (systemd): a guarda `running` evita ciclos
// concorrentes. 3 tentativas por linha; depois FAILED (só log, sem UI de reenvio no MVP).
@Injectable()
export class MailWorker {
  private readonly logger = new Logger('MailWorker');
  private running = false;

  constructor(
    private readonly outbox: NotificationOutboxRepository,
    private readonly mailer: MailerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.outbox.findPending(20);
      for (const row of pending) {
        try {
          await this.mailer.send(row.toEmail, row.subject, row.body);
          await this.outbox.markSent(row.id);
        } catch (err) {
          const msg = (err as Error).message;
          const updated = await this.outbox.markFailed(row.id, row.attempts, msg);
          if (updated.status === 'FAILED') {
            this.logger.error(
              `Notificação ${row.id} FALHOU após ${updated.attempts} tentativas: ${msg}`,
            );
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w @chamados/api`
Expected: PASS (incluindo os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/modules/notifications/mail-worker.service.ts packages/api/src/modules/notifications/mail-worker.service.spec.ts
git commit -m "feat(api): MailWorker (@Cron 1min, 3 tentativas, FAILED em log)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Enfileirar na criação do chamado (repo + service)

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts` (`createWithHistory`)
- Modify: `packages/api/src/modules/tickets/tickets.service.ts` (`create`, construtor)
- Test: `packages/api/src/modules/tickets/tickets.service.spec.ts` (novos casos + ajuste do `makeService`)

**Interfaces:**
- Consumes: `buildTicketEmail` (Task 2), `ConfigService` (env `APP_URL`).
- Produces: `createWithHistory` passa a aceitar `id: string` e `notification?: { toEmail: string; subject: string; body: string }`, inserindo a linha na outbox na mesma transação; `TicketsService` ganha `ConfigService` no construtor (7º parâmetro).

- [ ] **Step 1: Escrever os testes falhos (service)**

Em `packages/api/src/modules/tickets/tickets.service.spec.ts`, ajustar o `makeService` para aceitar o `ConfigService` (novo 7º arg) e um setor executor com `notificationEmail`. No stub `departments.findById` já existe `departmentsById`; adicionar ao construtor o config stub. Fazer estas mudanças:

No topo do arquivo, dentro de `makeService`, logo antes do `return new TicketsService(...)`:

```typescript
  const config = {
    get: (k: string) => (k === 'APP_URL' ? 'https://chamados.local' : undefined),
  } as any;
```

E trocar a linha de construção para incluir o config no fim:

```typescript
  return new TicketsService(repo, departments, users, priority, {} as any, categories, config);
```

Adicionar os casos novos (no bloco de `create (roteamento...)`):

```typescript
test('create: setor executor com notificationEmail enfileira notificação (payload no repo)', async () => {
  const svc = makeService({
    subcategory: subManutencaoEletrica,
    assignee: { id: 'ad1', name: 'Admin', role: 'ADMIN' }, // vira o requester carregado
    departmentsById: {
      dep1: { id: 'dep1', name: 'Tesouraria', priorityWeight: 3, requiresApproval: false },
      'dep-manutencao': {
        id: 'dep-manutencao',
        name: 'Manutenção',
        priorityWeight: 4,
        requiresApproval: false,
        notificationEmail: 'manutencao@clube.local',
      },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'c-eletrica', subcategoryId: 's-eletrica', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.notification.toEmail, 'manutencao@clube.local');
  assert.match(r.notification.subject, /^Novo chamado — /);
});

test('create: setor executor sem notificationEmail não enfileira notificação', async () => {
  const svc = makeService({
    subcategory: subManutencaoEletrica,
    departmentsById: {
      dep1: { id: 'dep1', name: 'Tesouraria', priorityWeight: 3, requiresApproval: false },
      'dep-manutencao': { id: 'dep-manutencao', name: 'Manutenção', priorityWeight: 4, requiresApproval: false },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'c-eletrica', subcategoryId: 's-eletrica', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.notification, undefined);
});
```

> O stub de `repo.createWithHistory` já ecoa o input (`{ id:'new', ...input }`), então `r.notification` reflete o que o service passou.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w @chamados/api`
Expected: FAIL — o `create` ainda não monta/passa `notification` (e o construtor ainda não aceita config → erro de compilação de tipos no stub é aceitável; se o build falhar, é a mesma falha esperada).

- [ ] **Step 3: Ajustar o construtor e o `create` do service**

Em `packages/api/src/modules/tickets/tickets.service.ts`:

Adicionar os imports:

```typescript
import { ConfigService } from '@nestjs/config';
import { buildTicketEmail } from '../notifications/notification-email';
```

Adicionar `ConfigService` como último parâmetro do construtor:

```typescript
  constructor(
    private readonly repo: TicketsRepository,
    private readonly departments: DepartmentsRepository,
    private readonly users: UsersRepository,
    private readonly priority: PriorityService,
    private readonly sla: SlaService,
    private readonly categories: CategoriesRepository,
    private readonly config: ConfigService,
  ) {}
```

No `create()`, logo antes da chamada a `this.repo.createWithHistory(...)`, gerar o id e montar a notificação. Substituir o bloco:

```typescript
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

por:

```typescript
    // Padrão outbox: o id é gerado aqui para montar o link do e-mail ANTES do insert e
    // enfileirar a notificação na MESMA transação do chamado (createWithHistory).
    const id = randomUUID();
    let notification: { toEmail: string; subject: string; body: string } | undefined;
    if (executorDepartment.notificationEmail) {
      const requesterUser = await this.users.findById(requesterId);
      const email = buildTicketEmail({
        ticketId: id,
        title,
        requesterName: requesterUser?.name ?? requesterId,
        requesterDepartmentName: department.name,
        priority,
        description: dto.description ?? null,
        originLocation: null,
        createdAt: new Date(),
        appUrl: this.config.get<string>('APP_URL') ?? null,
      });
      notification = { toEmail: executorDepartment.notificationEmail, ...email };
    }

    const created = await this.repo.createWithHistory({
      id,
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
      notification,
    });
```

> `department.name` já está disponível (o `department` do solicitante foi buscado no início do `create`). `originLocation` fica `null` neste plano (o totem/Plano 4 preenche depois).

- [ ] **Step 4: Ajustar `createWithHistory` no repositório**

Em `packages/api/src/modules/tickets/tickets.repository.ts`, no método `createWithHistory`:

Adicionar `id` e `notification` ao tipo do input (após `requesterId: string;`):

```typescript
    requesterId: string;
    id: string;
    notification?: { toEmail: string; subject: string; body: string };
```

Passar o `id` explícito no `tx.ticket.create` (adicionar `id: input.id,` como primeira propriedade de `data`):

```typescript
      const ticket = await tx.ticket.create({
        data: {
          id: input.id,
          title: input.title,
```

E, logo após o `tx.ticketStatusHistory.create({...})` e antes de `return ticket;`, inserir a linha da outbox:

```typescript
      // Enqueue da notificação na MESMA transação (outbox): se o chamado commita, o e-mail
      // está garantido na fila; se dá rollback, nada de e-mail órfão.
      if (input.notification) {
        await tx.notificationOutbox.create({
          data: {
            ticketId: ticket.id,
            toEmail: input.notification.toEmail,
            subject: input.notification.subject,
            body: input.notification.body,
          },
        });
      }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -w @chamados/api`
Expected: PASS (todos, incluindo os 2 novos de notificação). Se algum teste antigo de `create` quebrar por falta de `name` no `departmentsById`, adicionar `name` ao stub daquele setor (o `buildTicketEmail` só é chamado quando há `notificationEmail`, então setores sem e-mail não precisam de `name`).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/modules/tickets/tickets.service.ts packages/api/src/modules/tickets/tickets.repository.ts packages/api/src/modules/tickets/tickets.service.spec.ts
git commit -m "feat(api): enfileira notificação por e-mail na criação do chamado (outbox na tx)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Módulo `notifications` + wiring + envs + decisão

**Files:**
- Create: `packages/api/src/modules/notifications/notifications.module.ts`
- Modify: `packages/api/src/app.module.ts` (importar `NotificationsModule`)
- Modify: `packages/api/src/modules/tickets/tickets.module.ts` (importar `ConfigModule` se necessário — ver nota)
- Modify: `packages/api/.env.example` (envs novos)
- Modify: `docs/projeto/07-operacao-deploy.md` (documentar envs)
- Create: `docs/memory/decisions/notificacao-hibrida-email.md`

**Interfaces:**
- Consumes: todos os providers das Tasks 3–5.
- Produces: `NotificationsModule` registrando `MailerService`, `NotificationOutboxRepository`, `MailWorker` (o `@Cron` só dispara quando o provider está num módulo carregado).

- [ ] **Step 1: Criar o módulo**

Criar `packages/api/src/modules/notifications/notifications.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailerService } from './mailer.service';
import { NotificationOutboxRepository } from './notification-outbox.repository';
import { MailWorker } from './mail-worker.service';

@Module({
  imports: [PrismaModule],
  providers: [MailerService, NotificationOutboxRepository, MailWorker],
})
export class NotificationsModule {}
```

> `ConfigModule` é global (`isGlobal: true` no `app.module.ts`), então `ConfigService` é injetável sem import extra. `PrismaModule` precisa ser importado se ele não for global — conferir: se `TicketsRepository` já injeta `PrismaService` via `PrismaModule` importado em `TicketsModule`, siga o mesmo padrão. Se `PrismaModule` for global, remova o import daqui.

- [ ] **Step 2: Registrar no `app.module.ts`**

Em `packages/api/src/app.module.ts`, adicionar o import e incluir no array `imports` (após `TicketsModule`):

```typescript
import { NotificationsModule } from './modules/notifications/notifications.module';
```

```typescript
    TicketsModule,
    NotificationsModule,
    ReportsModule,
```

- [ ] **Step 3: Garantir `ConfigService` no `TicketsModule`**

O `TicketsService` agora injeta `ConfigService`. Como `ConfigModule` é global, nada a fazer. Confirme rodando o build no Step 5; se acusar `ConfigService` não resolvido, adicione `ConfigModule` aos `imports` de `TicketsModule`.

- [ ] **Step 4: Documentar os envs**

Em `packages/api/.env.example`, adicionar ao final:

```
# Notificação por e-mail (Plano 2). Sem SMTP_HOST, o envio fica em modo STUB (só loga).
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=chamados@clube.local
# URL base do sistema para o link no e-mail (ex.: https://chamados.clube.local)
APP_URL=
```

Em `docs/projeto/07-operacao-deploy.md`, na tabela/seção de variáveis de ambiente, acrescentar as linhas descrevendo `SMTP_HOST/PORT/USER/PASS/FROM` (envio de notificação; sem `SMTP_HOST` = stub) e `APP_URL` (link do chamado no e-mail).

- [ ] **Step 5: Criar o arquivo de decisão**

Criar `docs/memory/decisions/notificacao-hibrida-email.md`:

```markdown
# Notificação híbrida por e-mail (Plano 2)

Data: 2026-07-06
Estende: [[notificacao-polling]] (não substitui — soma e-mail por setor).

## Decisão (aprovada por Fabio, 2026-07-06)
- E-mail é **1 por setor** (`Department.notificationEmail`), nunca por usuário.
- Disparo só na **criação** do chamado, e só quando o setor executor tem `notificationEmail`.
- Padrão **outbox transacional**: a linha `notification_outbox` é inserida na MESMA transação
  do chamado (`createWithHistory`). Worker `@Cron` (1 min) envia via SMTP.
- **Stub em dev**: sem `SMTP_HOST`, o `MailerService` só loga (não envia) — permite smoke sem
  servidor. `SMTP_*` reais enviam em produção.
- **3 tentativas** por linha; depois `FAILED` (só log, sem UI de reenvio no MVP).
- Conteúdo: assunto `Novo chamado — <título>`; corpo com solicitante, setor, prioridade,
  descrição/local (se houver) e link `${APP_URL}/tickets/:id`.

## Consequências
- Envs novos: `SMTP_HOST/PORT/USER/PASS/FROM`, `APP_URL` (ver `07-operacao-deploy.md`).
- Sync de usuários reais é frente SEPARADA — não muda o destinatário (segue por setor).
- Ver spec `docs/superpowers/specs/2026-07-06-notificacao-hibrida-email-plano2-design.md`.
```

Atualizar `docs/memory/README.md` para indexar essa decisão (seção Decisions).

- [ ] **Step 6: Build limpo e testes**

Run: `npm run build -w @chamados/shared && npm run build -w @chamados/api && npm test -w @chamados/api`
Expected: builds limpos; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/modules/notifications/notifications.module.ts packages/api/src/app.module.ts packages/api/src/modules/tickets/tickets.module.ts packages/api/.env.example docs/projeto/07-operacao-deploy.md docs/memory/decisions/notificacao-hibrida-email.md docs/memory/README.md
git commit -m "feat(api): registra NotificationsModule + envs SMTP/APP_URL + decisão

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Gate final — build integrado + smoke real (banco no ar)

**Files:** nenhuma mudança de código — verificação de ponta a ponta.

- [ ] **Step 1: Build na ordem de dependência**

Run: `npm run build -w @chamados/shared && npm run build -w @chamados/api`
Expected: ambos limpos.

- [ ] **Step 2: Suite completa com número real**

Run: `npm test -w @chamados/api`
Expected: `pass` = total, `fail` 0. Registrar o número real (ex.: `57/57`).

- [ ] **Step 3: Smoke real (requer banco — passo do Fabio para aplicar a migration)**

> O agente NÃO roda `db:migrate`/`db:deploy`. Peça ao Fabio: `docker compose up -d`, depois
> `npm run db:migrate -w @chamados/api` (aplica a migration da Task 1). Sem `SMTP_HOST` no `.env`,
> o envio fica em modo stub (o log do worker mostra `[STUB] ...`).

Roteiro (via `npm run dev:api` + curl, com um ADMIN autenticado):
1. Setar um e-mail num setor executor de teste: `PATCH /departments/:id` com `notificationEmail: "manutencao@clube.local"` (ou via seed/admin) num setor que tenha categoria roteada.
2. Criar um chamado que roteie para esse setor (`POST /tickets` com categoria daquele setor).
3. Confirmar no banco: 1 linha em `notification_outbox` com `status = PENDING` para aquele `ticket_id`.
4. Esperar o ciclo do worker (até 1 min) e ver no log do api `[STUB] ... manutencao@clube.local`; conferir a linha virar `status = SENT` com `sent_at` preenchido.
5. Criar um chamado em setor executor SEM `notificationEmail` → confirmar que NÃO cria linha na outbox.
6. Limpar os dados de teste temporários.

- [ ] **Step 4: Registrar o resultado no handoff**

Se o smoke rodou: documentar comandos e resultados reais. Se o banco não estava disponível na
sessão: reportar o smoke como PENDÊNCIA explícita (nunca como sucesso) no handoff, junto com o
roteiro acima.

---

## Self-Review (feito na escrita do plano)

- **Cobertura da spec:** tabela/enum outbox (Task 1) ✓; enqueue atômico na tx (Task 6) ✓;
  MailerService stub/real (Task 4) ✓; MailWorker @Cron 60s + 3 tentativas + FAILED em log
  (Task 5) ✓; conteúdo resumo+link (Task 2) ✓; envs SMTP_*/APP_URL (Task 7) ✓; módulo
  notifications (Task 7) ✓; testes (Tasks 2,4,5,6) ✓; decisão notificacao-hibrida-email (Task 7) ✓.
- **Placeholders:** nenhum — todo passo tem código/comando real.
- **Consistência de tipos:** `createWithHistory` ganha `id`/`notification` (Task 6) usados pelo
  service (Task 6); `NotificationOutboxRepository.markFailed` retorna `{status, attempts}` usado
  pelo `MailWorker` (Task 5); `buildTicketEmail` (Task 2) consumido pelo service (Task 6) com a
  mesma assinatura.
- **Aberto conscientemente:** `originLocation` fica `null` até o Plano 4 (totem); UI de reenvio de
  FAILED fora de escopo (só log), conforme spec.
