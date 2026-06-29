# Encerramento pelo usuário, avaliação e SLA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o solicitante encerre e avalie (1–5 estrelas) o próprio chamado após a TI resolvê-lo, e exibir um prazo de SLA por prioridade (calculado a partir da triagem) sem revelar o cálculo ao usuário.

**Architecture:** Backend NestJS + Prisma adiciona 3 campos ao `Ticket` (`rating`, `closedAt`, `slaStartedAt`), um `SlaService`/`sla.matrix.ts` espelhando o padrão do `PriorityService`, e um endpoint `PATCH /tickets/:id/close` aberto ao solicitante/admin. O SLA (`slaDueAt`/`slaHours`) é derivado on-the-fly no service e anexado ao payload. O frontend React esconde prioridade/complexidade do perfil USER, exibe a promessa de SLA e um bloco de confirmação+avaliação.

**Tech Stack:** TypeScript (strict), NestJS 10, Prisma 6 + PostgreSQL, React 18 + Vite + Tailwind + TanStack Query, NPM workspaces (`@chamados/shared`, `@chamados/api`, `@chamados/web`).

## Global Constraints

- TypeScript strict mode; nomes de arquivo kebab-case, variáveis/funções camelCase, tipos PascalCase, enums PascalCase com valores UPPER_SNAKE_CASE.
- KISS / DRY / SOLID. REST simples. Sem GraphQL/gRPC.
- Não há framework de testes no projeto. O ciclo de verificação de cada task é: **typecheck/build** do workspace afetado + **smoke manual via curl/UI**. Não introduzir Jest/Vitest.
- Mobile-first; viewport mínimo 375px. Componente sem responsividade = incompleto.
- Enums idênticos entre Prisma e `@chamados/shared` (sem cast).
- Cálculo de prioridade/SLA centralizado em service (nunca no banco).
- Migrations versionadas; nunca alterar migration já rodada.
- Datas trafegam como string ISO no JSON.
- Commits: conventional commits (feat:, fix:, chore:, docs:). Terminar a mensagem com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- SLA por prioridade (horas corridas, 24/7): LOW 24h · MEDIUM 24h · HIGH 3h · URGENT 1h. Âncora = `slaStartedAt` (saída da triagem). Avaliação = só estrelas 1–5, opcional, visível só ao admin.

**Diretório de trabalho de todos os comandos:** `C:/Users/FabioMarinho/Documents/Projetos/app_chamados/chamados`.

**Pré-condição:** PostgreSQL no ar (`docker compose up -d`) e `npm run dev` disponível. A API roda em `http://localhost:3000/api`, web em `http://localhost:5173`.

---

### Task 1: Contratos compartilhados (shared) — campos e labels

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/enums.ts` (nenhuma mudança de enum; confirmar reuso)

**Interfaces:**
- Produces: `Ticket.rating: number | null`, `Ticket.closedAt: string | null`, `Ticket.slaStartedAt: string | null`, `Ticket.slaHours: number | null`, `Ticket.slaDueAt: string | null`; novo `interface CloseTicketInput { rating?: number }`.

- [ ] **Step 1: Adicionar campos à interface `Ticket`**

Em `packages/shared/src/types.ts`, dentro de `export interface Ticket { ... }`, logo após a linha `resolvedAt: string | null;` adicione:

```ts
  rating: number | null;
  closedAt: string | null;
  slaStartedAt: string | null;
  // Derivados (calculados no backend; nulos enquanto em triagem):
  slaHours: number | null;
  slaDueAt: string | null;
```

- [ ] **Step 2: Adicionar o input de encerramento**

No mesmo arquivo, na seção `// ---- Inputs ----`, logo após `export interface AddCommentInput { ... }` adicione:

```ts
export interface CloseTicketInput {
  // Avaliação opcional do solicitante (1..5 estrelas).
  rating?: number;
}
```

- [ ] **Step 3: Build do shared (typecheck)**

Run: `npm run build -w @chamados/shared`
Expected: build conclui sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add rating/sla/close contracts to ticket types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Migration do banco (rating, closedAt, slaStartedAt)

**Files:**
- Modify: `packages/api/prisma/schema.prisma:71-100` (model `Ticket`)
- Create: `packages/api/prisma/migrations/<timestamp>_ticket_rating_sla/migration.sql` (gerada pelo Prisma)

**Interfaces:**
- Produces: colunas `rating Int?`, `closed_at DateTime?`, `sla_started_at DateTime?` na tabela `tickets`.

- [ ] **Step 1: Adicionar campos ao model `Ticket`**

Em `packages/api/prisma/schema.prisma`, no model `Ticket`, logo após `resolvedAt   DateTime?    @map("resolved_at")` adicione:

```prisma
  closedAt     DateTime?    @map("closed_at")
  slaStartedAt DateTime?    @map("sla_started_at")
  rating       Int?
```

- [ ] **Step 2: Gerar e aplicar a migration**

Run: `npm run db:migrate -w @chamados/api -- --name ticket_rating_sla`
Expected: cria a pasta de migration, aplica no banco e regenera o client. Saída termina com "Your database is now in sync with your schema." (ou equivalente). Sem prompts de data-loss (apenas colunas opcionais novas).

- [ ] **Step 3: Verificar o client gerado**

Run: `npm run db:generate -w @chamados/api`
Expected: "Generated Prisma Client" sem erro.

- [ ] **Step 4: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations
git commit -m "feat(api): add rating, closedAt and slaStartedAt to tickets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Matriz e service de SLA (função pura)

**Files:**
- Create: `packages/api/src/modules/tickets/sla.matrix.ts`
- Create: `packages/api/src/modules/tickets/sla.service.ts`

**Interfaces:**
- Produces: `slaHours(priority: Priority): number`; `class SlaService` com `hours(priority: Priority): number` e `dueAt(priority: Priority, startedAt: Date): Date`.

- [ ] **Step 1: Criar a matriz de SLA**

Crie `packages/api/src/modules/tickets/sla.matrix.ts`:

```ts
import { Priority } from '@chamados/shared';

// Prazo de atendimento por prioridade, em horas corridas (24/7).
// Aprovado em 2026-06-29. Fonte única de verdade (DRY): nunca calcular no banco.
const SLA_HOURS: Record<Priority, number> = {
  LOW: 24,
  MEDIUM: 24,
  HIGH: 3,
  URGENT: 1,
};

export function slaHours(priority: Priority): number {
  return SLA_HOURS[priority];
}
```

- [ ] **Step 2: Criar o `SlaService`**

Crie `packages/api/src/modules/tickets/sla.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Priority } from '@chamados/shared';
import { slaHours } from './sla.matrix';

@Injectable()
export class SlaService {
  hours(priority: Priority): number {
    return slaHours(priority);
  }

  // Prazo final = início (saída da triagem) + horas da prioridade.
  dueAt(priority: Priority, startedAt: Date): Date {
    return new Date(startedAt.getTime() + this.hours(priority) * 60 * 60 * 1000);
  }
}
```

- [ ] **Step 3: Verificar a lógica pura (assertion via ts-node)**

Run:
```bash
npx ts-node -e "const {slaHours}=require('./packages/api/src/modules/tickets/sla.matrix.ts'); const a=require('assert'); a.strictEqual(slaHours('LOW'),24); a.strictEqual(slaHours('MEDIUM'),24); a.strictEqual(slaHours('HIGH'),3); a.strictEqual(slaHours('URGENT'),1); console.log('sla matrix OK');"
```
Expected: imprime `sla matrix OK` sem lançar AssertionError. (Se o `require` de `.ts` falhar no ambiente, rode `npm run build -w @chamados/api` e repita apontando para `packages/api/dist/.../sla.matrix.js`.)

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/modules/tickets/sla.matrix.ts packages/api/src/modules/tickets/sla.service.ts
git commit -m "feat(api): add SLA matrix and SlaService

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Gravar `slaStartedAt` na triagem e expor SLA no payload

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts` (método `applyTriage`)
- Modify: `packages/api/src/modules/tickets/tickets.service.ts` (injetar `SlaService`; anexar derivados em `list` e `detail`)
- Modify: `packages/api/src/modules/tickets/tickets.module.ts` (registrar `SlaService`)

**Interfaces:**
- Consumes: `SlaService.dueAt`, `SlaService.hours` (Task 3); campo `slaStartedAt` (Task 2).
- Produces: tickets retornados por `list`/`detail` incluem `slaHours: number | null` e `slaDueAt: string | null`. Helper privado `withSla<T extends { priority: Priority | null; slaStartedAt: Date | null }>(t: T)`.

- [ ] **Step 1: Setar `slaStartedAt` ao sair da triagem**

Em `packages/api/src/modules/tickets/tickets.repository.ts`, no método `applyTriage`, dentro de `tx.ticket.update({ ... data: { ... } })`, altere o bloco `data` para gravar a âncora apenas quando o chamado está saindo da triagem (não reseta em recalibragens):

```ts
        data: {
          complexity: input.complexity,
          priority: input.priority,
          departmentId: input.departmentId,
          status: input.moveToOpen ? 'OPEN' : undefined,
          slaStartedAt: input.moveToOpen ? new Date() : undefined,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
```

- [ ] **Step 2: Registrar `SlaService` no módulo**

Em `packages/api/src/modules/tickets/tickets.module.ts`, importe e adicione `SlaService` ao array `providers` (ao lado de `PriorityService`). Exemplo do topo do arquivo:

```ts
import { SlaService } from './sla.service';
```
E no decorator `@Module({ providers: [..., PriorityService, SlaService, ...] })` inclua `SlaService`.

- [ ] **Step 3: Injetar `SlaService` e criar o helper `withSla` no service**

Em `packages/api/src/modules/tickets/tickets.service.ts`:

1. Importe o tipo `Priority` e o service:
```ts
import { Priority, TicketStatus } from '@chamados/shared';
import { SlaService } from './sla.service';
```
(substitua o import existente de `TicketStatus` por essa linha conjunta).

2. Adicione `private readonly sla: SlaService,` ao `constructor`.

3. Adicione o helper privado (junto aos outros métodos privados, antes de `ensureCanView`):

```ts
  // Anexa o prazo de SLA derivado (nulo enquanto em triagem / sem prioridade).
  private withSla<T extends { priority: Priority | null; slaStartedAt: Date | null }>(
    t: T,
  ): T & { slaHours: number | null; slaDueAt: Date | null } {
    if (!t.priority || !t.slaStartedAt) {
      return { ...t, slaHours: null, slaDueAt: null };
    }
    return {
      ...t,
      slaHours: this.sla.hours(t.priority),
      slaDueAt: this.sla.dueAt(t.priority, t.slaStartedAt),
    };
  }
```

- [ ] **Step 4: Aplicar `withSla` em `list` e `detail`**

Em `list`, troque o `return tickets.map((t) => ({ ... }))` final por (mantendo `hasUnread`):

```ts
    return tickets.map((t) =>
      this.withSla({
        ...t,
        hasUnread: this.isUnread(t.lastActivityAt, t.lastActivityBy, seen.get(t.id), user.userId),
      }),
    );
```

Em `detail`, envolva o objeto retornado com `withSla`:

```ts
    return this.withSla({
      ...ticket,
      attachments: ticket.attachments.map(toAttachmentDto),
      comments: ticket.comments.map((c) => ({
        ...c,
        attachments: c.attachments.map(toAttachmentDto),
      })),
    });
```

- [ ] **Step 5: Build da API (typecheck)**

Run: `npm run build -w @chamados/api`
Expected: `nest build` conclui sem erros.

- [ ] **Step 6: Smoke do SLA via API**

Com `npm run dev` rodando, gere um token de admin e crie+triague um chamado, conferindo `slaDueAt`:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@chamados.local","password":"senha123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
DEPT=$(curl -s http://localhost:3000/api/departments -H "Authorization: Bearer $TOKEN" | sed -E 's/.*"id":"([^"]+)".*/\1/')
TID=$(curl -s -X POST http://localhost:3000/api/tickets -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"title\":\"smoke sla\",\"description\":\"x\",\"departmentId\":\"$DEPT\"}" | sed -E 's/.*"id":"([^"]+)".*/\1/')
curl -s -X PATCH http://localhost:3000/api/tickets/$TID -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"complexity":"CRITICAL"}' >/dev/null
curl -s http://localhost:3000/api/tickets/$TID -H "Authorization: Bearer $TOKEN"
echo
```
Expected: o JSON do chamado mostra `"slaHours":` e `"slaDueAt":` preenchidos (não nulos) após a triagem. Guarde `$TOKEN` e `$TID` para a Task 5.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/modules/tickets/tickets.repository.ts packages/api/src/modules/tickets/tickets.service.ts packages/api/src/modules/tickets/tickets.module.ts
git commit -m "feat(api): anchor SLA on triage and expose slaDueAt/slaHours

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Endpoint de encerramento pelo usuário (`PATCH /tickets/:id/close`)

**Files:**
- Create: `packages/api/src/modules/tickets/dto/close-ticket.dto.ts`
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts` (novo `closeWithRating`)
- Modify: `packages/api/src/modules/tickets/tickets.service.ts` (novo método `close`)
- Modify: `packages/api/src/modules/tickets/tickets.controller.ts` (nova rota)

**Interfaces:**
- Consumes: `ensureCanView` (existente), `withSla` (Task 4).
- Produces: `TicketsService.close(id: string, rating: number | undefined, user: AuthUser)`; `TicketsRepository.closeWithRating({ id, fromStatus, changedBy, rating })`.

- [ ] **Step 1: Criar o DTO**

Crie `packages/api/src/modules/tickets/dto/close-ticket.dto.ts`:

```ts
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CloseTicketDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
```

- [ ] **Step 2: Adicionar `closeWithRating` no repositório**

Em `packages/api/src/modules/tickets/tickets.repository.ts`, adicione o método (após `updateStatusWithHistory`):

```ts
  closeWithRating(input: {
    id: string;
    fromStatus: TicketStatus;
    changedBy: string;
    rating: number | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: input.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          rating: input.rating,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: input.id,
          fromStatus: input.fromStatus,
          toStatus: 'CLOSED',
          changedBy: input.changedBy,
        },
      });
      return ticket;
    });
  }
```

- [ ] **Step 3: Adicionar o método `close` no service**

Em `packages/api/src/modules/tickets/tickets.service.ts`, adicione (após `updateStatus`):

```ts
  // Encerramento pelo solicitante (ou admin): só a partir de RESOLVED.
  async close(id: string, rating: number | undefined, user: AuthUser) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundException('Chamado não encontrado');
    this.ensureCanView(ticket.requesterId, user);
    if (ticket.status !== 'RESOLVED') {
      throw new BadRequestException(
        'Só é possível concluir um chamado já resolvido pela TI',
      );
    }
    return this.repo.closeWithRating({
      id,
      fromStatus: ticket.status,
      changedBy: user.userId,
      rating: rating ?? null,
    });
  }
```

`BadRequestException` e `NotFoundException` já estão importados no arquivo.

- [ ] **Step 4: Adicionar a rota no controller**

Em `packages/api/src/modules/tickets/tickets.controller.ts`:

1. Importe o DTO no topo:
```ts
import { CloseTicketDto } from './dto/close-ticket.dto';
```
2. Adicione a rota (após o método `updateStatus`). **Sem** `@Roles('ADMIN')` — a autorização é feita no service (`ensureCanView`):
```ts
  @Patch(':id/close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.close(id, dto.rating, user);
  }
```

- [ ] **Step 5: Build da API**

Run: `npm run build -w @chamados/api`
Expected: `nest build` sem erros.

- [ ] **Step 6: Smoke do encerramento via API**

Reaproveitando `$TOKEN` e `$TID` da Task 4 (admin); primeiro marque RESOLVED, depois feche com rating:

```bash
curl -s -X PATCH http://localhost:3000/api/tickets/$TID/status -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"RESOLVED"}' >/dev/null
curl -s -o /dev/null -w "close HTTP %{http_code}\n" -X PATCH http://localhost:3000/api/tickets/$TID/close -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"rating":4}'
curl -s http://localhost:3000/api/tickets/$TID -H "Authorization: Bearer $TOKEN" | sed -E 's/.*("status":"[^"]+").*("rating":[0-9]+).*/\1 \2/'
```
Expected: `close HTTP 200`; o JSON mostra `"status":"CLOSED"` e `"rating":4`.

- [ ] **Step 7: Smoke do erro (estado inválido)**

```bash
curl -s -o /dev/null -w "reclose HTTP %{http_code}\n" -X PATCH http://localhost:3000/api/tickets/$TID/close -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"rating":3}'
```
Expected: `reclose HTTP 400` (já está CLOSED, não RESOLVED).

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/modules/tickets/dto/close-ticket.dto.ts packages/api/src/modules/tickets/tickets.repository.ts packages/api/src/modules/tickets/tickets.service.ts packages/api/src/modules/tickets/tickets.controller.ts
git commit -m "feat(api): add requester close endpoint with optional rating

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — hook `useCloseTicket`, helpers de SLA e componente `StarRating`

**Files:**
- Modify: `packages/web/src/features/tickets/api.ts`
- Modify: `packages/web/src/lib/labels.ts`
- Create: `packages/web/src/lib/sla.ts`
- Create: `packages/web/src/components/StarRating.tsx`

**Interfaces:**
- Consumes: `CloseTicketInput` (Task 1); campos `slaHours`/`slaDueAt` (Task 4).
- Produces: `useCloseTicket(id: string)`; `slaText(slaHours: number | null, slaDueAt: string | null): string | null`; `isSlaBreached(slaDueAt: string | null, status: TicketStatus): boolean`; `<StarRating value={number} onChange?={(n:number)=>void} readOnly?={boolean} />`.

- [ ] **Step 1: Atualizar os labels de status**

Em `packages/web/src/lib/labels.ts`, no objeto `STATUS_LABEL`, troque as duas linhas:

```ts
  RESOLVED: 'Resolvido (aguardando confirmação)',
  CLOSED: 'Concluído',
```

- [ ] **Step 2: Criar helpers de SLA**

Crie `packages/web/src/lib/sla.ts`:

```ts
import { TicketStatus } from '@chamados/shared';

const DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];

// Texto amigável para o usuário (nunca revela a prioridade/cálculo).
export function slaText(slaHours: number | null, slaDueAt: string | null): string | null {
  if (slaHours == null || !slaDueAt) return null;
  const due = new Date(slaDueAt).toLocaleString('pt-BR');
  return `Prazo de atendimento: até ${slaHours} horas (até ${due})`;
}

// SLA estourado: passou do prazo e o chamado ainda não foi resolvido/concluído.
export function isSlaBreached(slaDueAt: string | null, status: TicketStatus): boolean {
  if (!slaDueAt || DONE.includes(status)) return false;
  return new Date(slaDueAt).getTime() < Date.now();
}
```

- [ ] **Step 3: Criar o componente `StarRating`**

Crie `packages/web/src/components/StarRating.tsx`:

```tsx
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}

export function StarRating({ value, onChange, readOnly = false }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
          onClick={() => onChange?.(n)}
          className={readOnly ? 'cursor-default' : 'min-h-[44px] min-w-[44px] cursor-pointer'}
        >
          <Star
            className={`h-6 w-6 ${n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Criar o hook `useCloseTicket`**

Em `packages/web/src/features/tickets/api.ts`:

1. Adicione `CloseTicketInput` ao import de `@chamados/shared`.
2. Adicione o hook ao final do arquivo:

```ts
export function useCloseTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloseTicketInput) =>
      (await api.patch(`/tickets/${id}/close`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}
```

- [ ] **Step 5: Build do web (typecheck)**

Run: `npm run build -w @chamados/web`
Expected: `tsc --noEmit && vite build` conclui sem erros.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/features/tickets/api.ts packages/web/src/lib/labels.ts packages/web/src/lib/sla.ts packages/web/src/components/StarRating.tsx
git commit -m "feat(web): add close hook, SLA helpers and StarRating component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Frontend — página de detalhe (SLA, esconder prioridade, confirmar+avaliar)

**Files:**
- Modify: `packages/web/src/pages/TicketDetailPage.tsx`

**Interfaces:**
- Consumes: `useCloseTicket` (Task 6), `slaText`/`isSlaBreached` (Task 6), `StarRating` (Task 6), campos `slaHours`/`slaDueAt`/`rating` (Tasks 1/4).

- [ ] **Step 1: Imports e estado novos**

No topo de `packages/web/src/pages/TicketDetailPage.tsx`:

1. Adicione aos imports de `@/features/tickets/api`: `useCloseTicket`.
2. Acrescente os imports:
```tsx
import { StarRating } from '@/components/StarRating';
import { slaText, isSlaBreached } from '@/lib/sla';
```
3. Dentro do componente, junto aos outros hooks, adicione:
```tsx
  const closeTicket = useCloseTicket(id);
  const [rating, setRating] = useState(0);
```
4. Após `if (!ticket) ...`, derive:
```tsx
  const sla = slaText(ticket.slaHours, ticket.slaDueAt);
  const breached = isSlaBreached(ticket.slaDueAt, ticket.status);
```

- [ ] **Step 2: Cabeçalho — esconder prioridade/complexidade do USER e mostrar SLA**

Substitua o bloco do cabeçalho (as `<div className="mt-2 flex flex-wrap ...">` com os badges e a complexidade) por:

```tsx
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isAdmin && <PriorityBadge priority={ticket.priority} />}
          <StatusBadge status={ticket.status} />
          {isAdmin && (
            <span className="text-xs text-gray-500">
              Complexidade: {complexityLabel(ticket.complexity)}
            </span>
          )}
        </div>
        {sla ? (
          <p className={`mt-2 text-sm ${breached && isAdmin ? 'font-medium text-red-600' : 'text-grena'}`}>
            ⏱ {sla}
            {breached && isAdmin && ' — SLA estourado'}
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Em análise — prazo definido após a triagem.</p>
        )}
```

- [ ] **Step 3: Botão do admin "Concluir" → "Marcar como resolvido"**

Dentro do card "Ações do administrador", no `<Button>` que chama `updateStatus.mutate({ status: 'RESOLVED' })`, troque o texto `✓ Concluir chamado` por `✓ Marcar como resolvido`.

- [ ] **Step 4: Mostrar a avaliação ao admin quando concluído**

Ainda no card "Ações do administrador", logo após a `<div className="flex items-end">...</div>` do botão, adicione (dentro do mesmo grid ou logo abaixo dele):

```tsx
            {ticket.status === 'CLOSED' && (
              <div className="sm:col-span-2">
                <Label>Avaliação do solicitante</Label>
                {ticket.rating ? (
                  <StarRating value={ticket.rating} readOnly />
                ) : (
                  <p className="text-sm text-gray-500">Sem avaliação.</p>
                )}
              </div>
            )}
```

- [ ] **Step 5: Bloco de confirmação+avaliação para o solicitante**

Logo antes do card "Acompanhamento" (`<Card className="p-6">` que contém `<h3>...Acompanhamento`), insira o bloco para o USER quando o chamado estiver RESOLVED:

```tsx
      {!isAdmin && ticket.status === 'RESOLVED' && (
        <Card className="p-6">
          <h3 className="mb-1 text-sm font-semibold text-grena">Confirmar conclusão</h3>
          <p className="mb-4 text-sm text-gray-600">
            A TI marcou seu chamado como resolvido. Avalie o atendimento (opcional) e conclua.
          </p>
          <div className="mb-4">
            <Label>Sua avaliação</Label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <Button
            disabled={closeTicket.isPending}
            onClick={() => closeTicket.mutate({ rating: rating || undefined })}
          >
            {closeTicket.isPending ? 'Concluindo...' : 'Concluir chamado'}
          </Button>
        </Card>
      )}
```

- [ ] **Step 6: Build do web**

Run: `npm run build -w @chamados/web`
Expected: build sem erros de TypeScript.

- [ ] **Step 7: Smoke visual (UI)**

Com `npm run dev` rodando, no navegador (http://localhost:5173):
1. Entre como **admin** (admin@chamados.local / senha123), abra um chamado, defina complexidade (sai da triagem) e clique "✓ Marcar como resolvido".
2. Entre como **user** (user@chamados.local / senha123) — confira que **não** aparece badge de prioridade nem complexidade, e que aparece a linha "⏱ Prazo de atendimento...".
3. Como o solicitante de um chamado RESOLVED, use o bloco "Confirmar conclusão", escolha estrelas e clique "Concluir chamado". Status passa a "Concluído".
4. Volte como admin no mesmo chamado: a "Avaliação do solicitante" mostra as estrelas.

Expected: todos os passos funcionam; usuário não vê prioridade/complexidade.

> Observação: o seed cria `user` no setor RH e `admin` no setor TI. Para o admin ver o chamado do user, lembre que admin vê todos. Para testar o bloco do solicitante, abra um chamado **como o próprio user** e resolva-o como admin.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/pages/TicketDetailPage.tsx
git commit -m "feat(web): user close+rating flow and SLA on ticket detail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Frontend — dashboard esconde prioridade do USER e mostra prazo

**Files:**
- Modify: `packages/web/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `slaText` (Task 6), campos `slaHours`/`slaDueAt` (Task 4).

- [ ] **Step 1: Importar helper de SLA e renomear o botão**

Em `packages/web/src/pages/DashboardPage.tsx`:
1. Adicione: `import { slaText } from '@/lib/sla';`
2. No componente `ConcludeButton` (admin), troque o texto `Concluir` por `Resolver` (mantém `updateStatus.mutate({ status: 'RESOLVED' })`).

- [ ] **Step 2: Esconder o filtro de prioridade do USER**

Envolva o `<div className="sm:w-48">` que contém o `<Select>` de prioridade (filtro "Todas as prioridades") com `{isAdmin && ( ... )}`.

- [ ] **Step 3: Tabela (desktop) — coluna condicional**

No `<thead>`, troque `<th className="px-4 py-3">Prioridade</th>` por:
```tsx
                  <th className="px-4 py-3">{isAdmin ? 'Prioridade' : 'Prazo'}</th>
```
No `<tbody>`, troque a célula `<td>` que renderiza `<PriorityBadge priority={t.priority} />` por:
```tsx
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <PriorityBadge priority={t.priority} />
                      ) : (
                        <span className="text-xs text-gray-500">
                          {t.slaHours != null ? `até ${t.slaHours}h` : 'Em triagem'}
                        </span>
                      )}
                    </td>
```

- [ ] **Step 4: Cards (mobile) — esconder prioridade do USER**

No bloco `md:hidden`, troque `<PriorityBadge priority={t.priority} />` por:
```tsx
                    {isAdmin ? (
                      <PriorityBadge priority={t.priority} />
                    ) : (
                      <span className="text-xs text-gray-500">
                        {t.slaHours != null ? `Prazo: até ${t.slaHours}h` : 'Em triagem'}
                      </span>
                    )}
```

- [ ] **Step 5: Build do web**

Run: `npm run build -w @chamados/web`
Expected: build sem erros.

- [ ] **Step 6: Smoke visual**

No navegador, como **user**, confira que a lista do dashboard (desktop e mobile/375px) **não** mostra prioridade — mostra "até Xh" / "Em triagem" — e não há filtro de prioridade. Como **admin**, tudo permanece como antes (com botão "Resolver").

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/pages/DashboardPage.tsx
git commit -m "feat(web): hide priority from user and show SLA on dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Documentação (memória do projeto)

**Files:**
- Modify: `docs/memory/architecture/business-rules.md`
- Create: `docs/memory/handoffs/sessao-2026-06-29.md`

**Interfaces:** nenhuma (somente documentação).

- [ ] **Step 1: Atualizar regras de negócio**

Em `docs/memory/architecture/business-rules.md`, substitua a última linha da seção "Acompanhamento (MVP)":

`- Concluir chamado = mudar status para resolved (botão ✓ no dashboard e no detalhe).`

por:

```markdown
- **Encerramento em duas etapas**: a TI marca `RESOLVED` ("Resolvido — aguardando
  confirmação"); o **solicitante** confirma e avalia, indo para `CLOSED` ("Concluído")
  via `PATCH /tickets/:id/close` (acessível ao solicitante ou admin; só a partir de
  RESOLVED). O admin pode forçar `CLOSED` pelo seletor de status (sem avaliação).
- **Avaliação**: estrelas 1–5, opcional, salva em `tickets.rating`. Visível só ao admin
  no detalhe do chamado; não entra na timeline pública.

## SLA (prazo de atendimento)
Centralizado em `SlaService` / `sla.matrix.ts` (DRY). Horas corridas (24/7), contadas a
partir da triagem (`tickets.sla_started_at`, gravado na saída de TRIAGE). Derivado
on-the-fly (`slaDueAt = slaStartedAt + horas`), nunca persistido como prazo.

| Prioridade | Prazo |
|------------|-------|
| low / medium | 24h |
| high         | 3h  |
| urgent       | 1h  |

O **usuário NÃO vê prioridade/complexidade** (escondidas no front), apenas a promessa
"Prazo de atendimento: até X horas". O **admin** vê "SLA estourado" quando o prazo passa
sem resolução. STATUS: APROVADA por Fabio em 2026-06-29.
```

- [ ] **Step 2: Criar handoff da sessão**

Crie `docs/memory/handoffs/sessao-2026-06-29.md`:

```markdown
# Handoff — 2026-06-29

## Entregue
- Encerramento pelo solicitante (RESOLVED → CLOSED) via `PATCH /tickets/:id/close`,
  com avaliação opcional (estrelas 1–5) salva em `tickets.rating`.
- SLA por prioridade (24h/24h/3h/1h) em `SlaService`/`sla.matrix.ts`, ancorado em
  `tickets.sla_started_at` (gravado na saída da triagem); exposto como `slaHours`/`slaDueAt`.
- Front: prioridade/complexidade ocultas para o USER (detalhe + dashboard); bloco de
  confirmação+avaliação no detalhe; aviso "SLA estourado" para admin; componente `StarRating`.

## Migration
- `ticket_rating_sla`: colunas `rating`, `closed_at`, `sla_started_at` em `tickets`.

## Decisões
- Spec: docs/superpowers/specs/2026-06-29-encerramento-usuario-avaliacao-sla-design.md
- SLA conta a partir da triagem; cálculo on-the-fly (não persistido).
- Avaliação só estrelas (sem comentário); visível só ao admin.

## Pendências / próximos passos
- (Opcional) média de satisfação nos relatórios.
- (Opcional) auto-close por inatividade.
```

- [ ] **Step 3: Commit**

```bash
git add docs/memory/architecture/business-rules.md docs/memory/handoffs/sessao-2026-06-29.md
git commit -m "docs: regras de encerramento, avaliação e SLA + handoff

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] `npm run build` (raiz) conclui sem erros nos três workspaces.
- [ ] Fluxo ponta-a-ponta no navegador: user abre chamado → admin triagem (vira OPEN, SLA aparece) → admin "Marcar como resolvido" → user vê "Confirmar conclusão", avalia e conclui (CLOSED) → admin vê a nota. User nunca vê prioridade/complexidade.
- [ ] Chamado em triagem mostra "Em análise — prazo definido após a triagem" para o user.
