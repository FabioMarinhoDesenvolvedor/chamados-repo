# SLA automático de dois tempos (resposta + conclusão) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o SLA 100% automático e granular, separando *tempo de resposta* (assumir/`IN_PROGRESS`) de *tempo de conclusão* (`RESOLVED`), via duas matrizes `complexidade × faixa-de-peso`, e remover os resíduos manuais (override de complexidade do admin e o fluxo de aprovação/Presidência).

**Architecture:** Os dois prazos são **derivados** de `ticket.complexity` + `department.priorityWeight` (peso do setor do solicitante — mesma fonte da prioridade hoje), calculados na projeção do backend. Único dado novo persistido: `tickets.first_response_at`, gravado na primeira ocorrência de `assign()` ou `updateStatus(IN_PROGRESS)`. A aprovação vira código morto; o valor de enum `PENDING_APPROVAL` fica dormente (como `TRIAGE`).

**Tech Stack:** TypeScript strict, NestJS, Prisma/PostgreSQL, React/Vite, `@chamados/shared` (tipos), testes `node:test` (`--require ts-node/register/transpile-only`).

## Global Constraints

- TypeScript strict, **sem `any`**. Tipos compartilhados só em `@chamados/shared` — nunca duplicar entre camadas.
- Ordem de build/verificação sempre `shared → api → web`.
- Fonte única de verdade dos prazos em `sla.matrix.ts` (DRY) — **nunca** calcular hora no banco. Prazos e "due at" são derivados, **nunca** gravados.
- Migration **aditiva**, nunca destrutiva; migration já rodada nunca é alterada. Valor de enum novo exige migration isolada (não há enum novo aqui — `PENDING_APPROVAL` já existe).
- Backfill de migration que toca entidade do seed deve ter réplica **idempotente** no `seed.ts` (gotcha `migration-seed-ordem-vs-entidade-existente`).
- Horas **corridas 24/7, inteiras (≥1h)**. Sem calendário útil, sem minutos.
- Complexidade nula (chamado legado) → default `MEDIUM` no cálculo de prazo; nunca quebra.
- Peso do prazo = `department.priorityWeight` do **setor do solicitante** (`ticket.departmentId`), idêntico à fonte da prioridade atual (`tickets.service.ts:128`).
- `PriorityService`/`priority.matrix.ts` (badge de prioridade) permanecem **intactos** — só servem à exibição/filtro do staff.
- Commits: conventional commits com escopo (`feat(api):`, `feat(web):`, `docs:`).

## File Structure

- `packages/shared/src/types.ts` — `Ticket` ganha os dois relógios; `UpdateTicketInput` perde `complexity`. **Fonte dos tipos para api e web.**
- `packages/api/src/modules/tickets/priority.matrix.ts` — exporta o tipo `WeightBand` (hoje interno) para reuso na matriz de SLA. Sem mudança de lógica.
- `packages/api/src/modules/tickets/sla.matrix.ts` — **reescrito**: duas matrizes + `responseHours`/`resolutionHours`.
- `packages/api/src/modules/tickets/sla.matrix.spec.ts` — **novo**: as 12 células de cada matriz.
- `packages/api/src/modules/tickets/sla.service.ts` — **reescrito**: `responseHours/resolutionHours` + `responseDueAt/resolutionDueAt`.
- `packages/api/src/modules/tickets/sla.service.spec.ts` — **novo**: dueAt + default MEDIUM.
- `packages/api/prisma/schema.prisma` — `Ticket.firstResponseAt`.
- `packages/api/prisma/migrations/20260707120000_sla_dois_tempos/migration.sql` — **novo**: coluna + backfill + Presidência + defensivo.
- `packages/api/prisma/seed.ts` — réplica idempotente `requiresApproval=false` na Presidência.
- `packages/api/src/modules/tickets/tickets.repository.ts` — inclui peso do depto nas leituras projetadas; `firstResponseAt` em `assign`/`updateStatusWithHistory`.
- `packages/api/src/modules/tickets/tickets.service.ts` — `withSla` dois relógios; `hideByRole` esconde breach do USER; captura `first_response_at`; remove override de complexidade e o ramo/endpoint de aprovação.
- `packages/api/src/modules/tickets/tickets.controller.ts` — remove `PATCH :id/approve`.
- `packages/api/src/modules/tickets/dto/update-ticket.dto.ts` — remove `complexity`.
- `packages/api/src/modules/tickets/tickets.service.spec.ts` — atualiza testes de aprovação/override; adiciona testes dos dois relógios.
- `packages/web/src/lib/sla.ts` — helpers dos dois relógios.
- `packages/web/src/lib/labels.ts` — chave `PENDING_APPROVAL` (completa o `Record<TicketStatus,…>`).
- `packages/web/src/pages/TicketDetailPage.tsx` — remove seletor "Definir complexidade"; mostra os dois prazos; sem "Aprovar".
- `packages/web/src/pages/DashboardPage.tsx` — coluna "Prazo" usa os dois relógios.
- `docs/memory/decisions/sla-dois-tempos-automatico.md` + `aprovacao-chamados.md` + `architecture/business-rules.md` + `README.md` + handoff.

---

### Task 1: Tipos compartilhados — dois relógios + fim do override de complexidade

**Files:**
- Modify: `packages/shared/src/types.ts:99-103` (bloco SLA do `Ticket`) e `packages/shared/src/types.ts:170-172` (`UpdateTicketInput`)

**Interfaces:**
- Produces: `Ticket.firstResponseAt: string | null`, `Ticket.responseSlaHours: number | null`, `Ticket.resolutionSlaHours: number | null`, `Ticket.responseDueAt: string | null`, `Ticket.resolutionDueAt: string | null`, `Ticket.responseBreached?: boolean`, `Ticket.resolutionBreached?: boolean`. `UpdateTicketInput` sem `complexity`. (`slaHours`/`slaDueAt` **deixam de existir** — renomeados para `resolution*`.)

- [ ] **Step 1: Substituir o bloco SLA do `Ticket`**

Em `packages/shared/src/types.ts`, trocar as linhas 99-102:

```typescript
  slaStartedAt: string | null;
  // Primeira resposta (assumir OU ir para IN_PROGRESS). Nulo enquanto não respondido.
  firstResponseAt: string | null;
  // Dois relógios de SLA, ambos derivados (nulos enquanto sem complexidade/início):
  responseSlaHours: number | null;
  responseDueAt: string | null;
  resolutionSlaHours: number | null;
  resolutionDueAt: string | null;
  // Estouro só é projetado para staff (undefined para o usuário comum).
  responseBreached?: boolean;
  resolutionBreached?: boolean;
```

- [ ] **Step 2: Remover `complexity` de `UpdateTicketInput`**

Em `packages/shared/src/types.ts:170-172`, deixar:

```typescript
export interface UpdateTicketInput {
  departmentId?: string;
}
```

- [ ] **Step 3: Build do shared**

Run: `npm run build -w @chamados/shared`
Expected: build limpo (sem erros de tipo). Consumidores api/web ainda podem quebrar — serão corrigidos nas tasks seguintes.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): tipos dos dois relógios de SLA e remoção do override de complexidade"
```

---

### Task 2: Matrizes de SLA (`sla.matrix.ts`) + exportar `WeightBand`

**Files:**
- Modify: `packages/api/src/modules/tickets/priority.matrix.ts:5` (exportar o tipo `WeightBand`)
- Rewrite: `packages/api/src/modules/tickets/sla.matrix.ts`
- Create: `packages/api/src/modules/tickets/sla.matrix.spec.ts`

**Interfaces:**
- Consumes: `weightBand(priorityWeight: number): WeightBand` de `priority.matrix.ts`.
- Produces: `responseHours(complexity: Complexity, priorityWeight: number): number`, `resolutionHours(complexity: Complexity, priorityWeight: number): number`. (`slaHours(priority)` **removido**.)

- [ ] **Step 1: Exportar o tipo `WeightBand`**

Em `packages/api/src/modules/tickets/priority.matrix.ts:5`, trocar `type WeightBand` por:

```typescript
export type WeightBand = 'BAIXO' | 'MEDIO' | 'ALTO';
```

- [ ] **Step 2: Escrever o teste das duas matrizes (falhando)**

Criar `packages/api/src/modules/tickets/sla.matrix.spec.ts`:

```typescript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { responseHours, resolutionHours } from './sla.matrix';

// Faixas de peso: Baixo = 1-2, Médio = 3, Alto = 4-5.
// Conclusão (spec 2026-07-07 §2): monótona, resposta <= conclusão em toda célula.
const RESOLUTION: Record<string, [number, number, number]> = {
  LOW: [48, 40, 24],
  MEDIUM: [24, 16, 8],
  HIGH: [8, 4, 2],
  CRITICAL: [4, 2, 1],
};
const RESPONSE: Record<string, [number, number, number]> = {
  LOW: [8, 6, 4],
  MEDIUM: [4, 3, 2],
  HIGH: [2, 1, 1],
  CRITICAL: [1, 1, 1],
};
const WEIGHTS: [number, number, number] = [1, 3, 5]; // representantes de Baixo/Médio/Alto

for (const complexity of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const) {
  WEIGHTS.forEach((w, band) => {
    test(`resolutionHours ${complexity} peso ${w} = ${RESOLUTION[complexity][band]}`, () => {
      assert.equal(resolutionHours(complexity, w), RESOLUTION[complexity][band]);
    });
    test(`responseHours ${complexity} peso ${w} = ${RESPONSE[complexity][band]}`, () => {
      assert.equal(responseHours(complexity, w), RESPONSE[complexity][band]);
    });
  });
}

test('faixa Baixo cobre peso 2 e Alto cobre peso 4', () => {
  assert.equal(resolutionHours('MEDIUM', 2), 24); // Baixo
  assert.equal(resolutionHours('MEDIUM', 4), 8); // Alto
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npm test -w @chamados/api -- --test-name-pattern "Hours"`
(ou `npm test -w @chamados/api`)
Expected: FAIL — `sla.matrix.ts` ainda exporta `slaHours`, não `responseHours`/`resolutionHours`.

- [ ] **Step 4: Reescrever `sla.matrix.ts`**

Substituir todo o conteúdo de `packages/api/src/modules/tickets/sla.matrix.ts`:

```typescript
import { Complexity } from '@chamados/shared';
import { WeightBand, weightBand } from './priority.matrix';

// Dois relógios de SLA, ambos automáticos e granulares (complexidade × faixa-de-peso).
// Aprovado por Fabio em 2026-07-07 (spec sla-automatico-dois-tempos). Horas corridas 24/7,
// inteiras. Monótonas (mais complexo e/ou setor mais pesado => prazo menor). Fonte única de
// verdade (DRY): NUNCA calcular no banco. Trocar números aqui não exige migração de dado.

// Tempo de CONCLUSÃO (resolver).
const RESOLUTION_HOURS: Record<Complexity, Record<WeightBand, number>> = {
  LOW: { BAIXO: 48, MEDIO: 40, ALTO: 24 },
  MEDIUM: { BAIXO: 24, MEDIO: 16, ALTO: 8 },
  HIGH: { BAIXO: 8, MEDIO: 4, ALTO: 2 },
  CRITICAL: { BAIXO: 4, MEDIO: 2, ALTO: 1 },
};

// Tempo de RESPOSTA (ver e responder). Resposta <= conclusão em toda célula.
const RESPONSE_HOURS: Record<Complexity, Record<WeightBand, number>> = {
  LOW: { BAIXO: 8, MEDIO: 6, ALTO: 4 },
  MEDIUM: { BAIXO: 4, MEDIO: 3, ALTO: 2 },
  HIGH: { BAIXO: 2, MEDIO: 1, ALTO: 1 },
  CRITICAL: { BAIXO: 1, MEDIO: 1, ALTO: 1 },
};

export function responseHours(complexity: Complexity, priorityWeight: number): number {
  return RESPONSE_HOURS[complexity][weightBand(priorityWeight)];
}

export function resolutionHours(complexity: Complexity, priorityWeight: number): number {
  return RESOLUTION_HOURS[complexity][weightBand(priorityWeight)];
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npm test -w @chamados/api`
Expected: os testes novos de `sla.matrix.spec.ts` passam. (Outros arquivos podem ainda quebrar a compilação — `sla.service.ts` importa `slaHours`; será corrigido na Task 3, então rode o teste focado se necessário: `node --require ts-node/register/transpile-only --test src/modules/tickets/sla.matrix.spec.ts`.)

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/modules/tickets/priority.matrix.ts packages/api/src/modules/tickets/sla.matrix.ts packages/api/src/modules/tickets/sla.matrix.spec.ts
git commit -m "feat(api): duas matrizes de SLA (resposta e conclusão) por complexidade x peso"
```

---

### Task 3: `SlaService` — dois relógios com default MEDIUM

**Files:**
- Rewrite: `packages/api/src/modules/tickets/sla.service.ts`
- Create: `packages/api/src/modules/tickets/sla.service.spec.ts`

**Interfaces:**
- Consumes: `responseHours`/`resolutionHours` da Task 2.
- Produces (métodos do `SlaService`): `responseHours(c, w): number`, `resolutionHours(c, w): number`, `responseDueAt(c, w, startedAt: Date): Date`, `resolutionDueAt(c, w, startedAt: Date): Date`. Todos aceitam `complexity: Complexity | null` e caem em `MEDIUM` quando nulo.

- [ ] **Step 1: Escrever o teste do serviço (falhando)**

Criar `packages/api/src/modules/tickets/sla.service.spec.ts`:

```typescript
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SlaService } from './sla.service';

const svc = new SlaService();
const start = new Date('2026-07-07T00:00:00.000Z');

test('resolutionDueAt soma as horas da célula ao início', () => {
  // MEDIUM x peso 3 (Médio) = 16h de conclusão.
  const due = svc.resolutionDueAt('MEDIUM', 3, start);
  assert.equal(due.getTime(), start.getTime() + 16 * 3600 * 1000);
});

test('responseDueAt soma as horas de resposta ao início', () => {
  // HIGH x peso 5 (Alto) = 1h de resposta.
  const due = svc.responseDueAt('HIGH', 5, start);
  assert.equal(due.getTime(), start.getTime() + 1 * 3600 * 1000);
});

test('complexidade nula cai em MEDIUM', () => {
  assert.equal(svc.resolutionHours(null, 3), svc.resolutionHours('MEDIUM', 3));
  assert.equal(svc.responseHours(null, 1), svc.responseHours('MEDIUM', 1));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --require ts-node/register/transpile-only --test src/modules/tickets/sla.service.spec.ts` (dentro de `packages/api`)
Expected: FAIL — métodos ainda não existem (`hours`/`dueAt` antigos).

- [ ] **Step 3: Reescrever `sla.service.ts`**

Substituir todo o conteúdo:

```typescript
import { Injectable } from '@nestjs/common';
import { Complexity } from '@chamados/shared';
import { responseHours, resolutionHours } from './sla.matrix';

const MS_PER_HOUR = 60 * 60 * 1000;

@Injectable()
export class SlaService {
  // Complexidade nula (chamado legado sem categorização) cai no default MÉDIA — mesma
  // tolerância da priorização; nunca quebra o cálculo do prazo.
  private resolve(complexity: Complexity | null): Complexity {
    return complexity ?? 'MEDIUM';
  }

  responseHours(complexity: Complexity | null, priorityWeight: number): number {
    return responseHours(this.resolve(complexity), priorityWeight);
  }

  resolutionHours(complexity: Complexity | null, priorityWeight: number): number {
    return resolutionHours(this.resolve(complexity), priorityWeight);
  }

  responseDueAt(complexity: Complexity | null, priorityWeight: number, startedAt: Date): Date {
    return new Date(startedAt.getTime() + this.responseHours(complexity, priorityWeight) * MS_PER_HOUR);
  }

  resolutionDueAt(complexity: Complexity | null, priorityWeight: number, startedAt: Date): Date {
    return new Date(startedAt.getTime() + this.resolutionHours(complexity, priorityWeight) * MS_PER_HOUR);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --require ts-node/register/transpile-only --test src/modules/tickets/sla.service.spec.ts` (dentro de `packages/api`)
Expected: PASS (3 testes). `tickets.service.ts` ainda quebra a compilação (usa `sla.hours`/`sla.dueAt` e `withSla` antigo) — corrigido na Task 6.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/modules/tickets/sla.service.ts packages/api/src/modules/tickets/sla.service.spec.ts
git commit -m "feat(api): SlaService com dois relógios (resposta/conclusão) e default MEDIA"
```

---

### Task 4: Schema + migration + seed — `first_response_at` e Presidência sem aprovação

**Files:**
- Modify: `packages/api/prisma/schema.prisma:116` (adicionar `firstResponseAt` no model `Ticket`)
- Create: `packages/api/prisma/migrations/20260707120000_sla_dois_tempos/migration.sql`
- Modify: `packages/api/prisma/seed.ts` (réplica idempotente)

**Interfaces:**
- Produces: coluna `tickets.first_response_at` (nullable); Presidência com `requires_approval=false`; nenhum ticket `PENDING_APPROVAL` (defensivo).

- [ ] **Step 1: Adicionar a coluna no schema**

Em `packages/api/prisma/schema.prisma`, logo após a linha `slaStartedAt DateTime? @map("sla_started_at")` (linha 115), inserir:

```prisma
  firstResponseAt DateTime? @map("first_response_at")
```

- [ ] **Step 2: Criar a migration SQL manualmente**

Criar `packages/api/prisma/migrations/20260707120000_sla_dois_tempos/migration.sql`:

```sql
-- SLA de dois tempos: coluna aditiva para a primeira resposta (assumir OU IN_PROGRESS).
ALTER TABLE "tickets" ADD COLUMN "first_response_at" TIMESTAMP(3);

-- Backfill: para chamados que JÁ passaram da resposta (assumidos/resolvidos), usa o primeiro
-- IN_PROGRESS do histórico; senão resolved_at; senão created_at. Chamados ainda abertos/não
-- assumidos ficam NULL (resposta em aberto — correto). Evita "resposta estourada" eterna em legado.
UPDATE "tickets" t
SET "first_response_at" = COALESCE(
  (SELECT MIN(h."created_at") FROM "ticket_status_history" h
     WHERE h."ticket_id" = t."id" AND h."to_status" = 'IN_PROGRESS'),
  t."resolved_at",
  t."created_at"
)
WHERE t."status" IN ('IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- Fim da aprovação: a Presidência era o único setor com requires_approval=true.
UPDATE "departments" SET "requires_approval" = false WHERE "name" = 'Presidência';

-- Defensivo: aprovação nunca foi deployada em produção, mas garante que nenhum chamado fique
-- preso em PENDING_APPROVAL (enum permanece dormente, como TRIAGE).
UPDATE "tickets" SET "status" = 'OPEN' WHERE "status" = 'PENDING_APPROVAL';
```

- [ ] **Step 3: Réplica idempotente no seed**

Em `packages/api/prisma/seed.ts`, após o bloco que garante os departamentos (logo depois da linha `const tesouraria = await prisma.department.findUniqueOrThrow(...)`, ~linha 20), inserir:

```typescript
  // Presidência não exige mais aprovação (spec sla-dois-tempos-automatico, 2026-07-07).
  // Idempotente: reflete no dev o que a migration faz em prod, mesmo re-seedando sem re-migrar.
  await prisma.department.updateMany({
    where: { name: 'Presidência' },
    data: { requiresApproval: false },
  });
```

- [ ] **Step 4: Verificar que o schema compila (client gerado)**

Run (Fabio, com banco/infra disponível): `npm run db:generate -w @chamados/api`
Expected: Prisma Client regenerado sem erro; `firstResponseAt` disponível no tipo `Ticket`.
> **Nota:** `db:generate`/`db:migrate`/`db:deploy` são papel do Fabio (ambiente). Se o client não regenerar nesta sessão, as tasks 5-6 assumem o campo existente — a compilação final valida no smoke.

- [ ] **Step 5: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations/20260707120000_sla_dois_tempos packages/api/prisma/seed.ts
git commit -m "feat(api): coluna first_response_at + migration/seed (backfill e fim da aprovação)"
```

---

### Task 5: Repository — peso do depto nas leituras projetadas e captura de `first_response_at`

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts`

**Interfaces:**
- Consumes: campo `firstResponseAt` do schema (Task 4).
- Produces: leituras projetadas (`createWithHistory`, `updateStatusWithHistory`, `applyTriage`, `assign`, `findManyPaginated`) passam a trazer `department: { priorityWeight }`. `assign(id, assignedTo, setFirstResponse: boolean)` e `updateStatusWithHistory({ …, firstResponseAt?: Date })` gravam a primeira resposta.

> **Racional:** a projeção dos dois relógios precisa de `complexity` **e** `priorityWeight` (a `priority` sozinha colapsa os dois). `findDetail` já inclui `department: true`. As demais leituras projetadas hoje retornam o ticket cru — passam a incluir só o peso (`select`), sem N+1.

- [ ] **Step 1: Incluir o peso do depto nas leituras projetadas**

Em `tickets.repository.ts`:

- `findManyPaginated` (linha ~21): adicionar `department` ao include existente:
```typescript
      include: { category: true, subcategory: true, detailOption: true, department: { select: { priorityWeight: true } } },
```
- `createWithHistory` — na chamada `tx.ticket.create({ data: {...} })` (linha ~124), adicionar após `data`:
```typescript
        include: { department: { select: { priorityWeight: true } } },
```
- `applyTriage` — na `tx.ticket.update` (linha ~236), adicionar após `data`:
```typescript
        include: { department: { select: { priorityWeight: true } } },
```

- [ ] **Step 2: `updateStatusWithHistory` grava `first_response_at` e inclui o peso**

Substituir a assinatura e o corpo de `updateStatusWithHistory` (linhas ~169-196):

```typescript
  updateStatusWithHistory(input: {
    id: string;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    changedBy: string;
    resolvedAt: Date | null;
    firstResponseAt?: Date; // gravado só quando informado (1º IN_PROGRESS)
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: input.id },
        data: {
          status: input.toStatus,
          resolvedAt: input.resolvedAt,
          firstResponseAt: input.firstResponseAt,
          lastActivityAt: new Date(),
          lastActivityBy: input.changedBy,
        },
        include: { department: { select: { priorityWeight: true } } },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: input.id,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          changedBy: input.changedBy,
        },
      });
      return ticket;
    });
  }
```

- [ ] **Step 3: `assign` grava `first_response_at` e inclui o peso**

Substituir `assign` (linhas ~262-264):

```typescript
  assign(id: string, assignedTo: string, setFirstResponse: boolean) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        assignedTo,
        // Grava a 1ª resposta só se ainda não houver (o service decide passando o flag).
        firstResponseAt: setFirstResponse ? new Date() : undefined,
      },
      include: { department: { select: { priorityWeight: true } } },
    });
  }
```

- [ ] **Step 4: Compilação typecheck do repo**

Run: `npx tsc --noEmit -p packages/api/tsconfig.json` (ou `npm run build -w @chamados/api` após a Task 6)
Expected: o repo compila. Chamadores em `tickets.service.ts` (assign/updateStatus) ainda com aridade antiga — corrigidos na Task 6. (Se rodar isolado agora, espere erros só em `tickets.service.ts`.)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/modules/tickets/tickets.repository.ts
git commit -m "feat(api): repo projeta peso do depto e grava first_response_at (assign/IN_PROGRESS)"
```

---

### Task 6: `TicketsService` — dois relógios, captura da 1ª resposta, fim do override e da aprovação

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.service.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.spec.ts`

**Interfaces:**
- Consumes: `SlaService` (Task 3), repo (Task 5), tipos (Task 1).
- Produces: projeção com `firstResponseAt`, `responseSlaHours`, `resolutionSlaHours`, `responseDueAt`, `resolutionDueAt`, `responseBreached`, `resolutionBreached`. `approve()` removido; `create()` nasce sempre `OPEN`.

> **Nota de projeção:** `withSla` recebe o ticket com `complexity`, `slaStartedAt`, `firstResponseAt`, `resolvedAt` e `department?: { priorityWeight }`. `findDetail` traz `department` completo (tem `priorityWeight`); as demais leituras trazem `{ priorityWeight }` (Task 5). Peso ausente (defensivo) → trata como sem prazo.

- [ ] **Step 1: Escrever/ajustar testes (falhando)**

Em `packages/api/src/modules/tickets/tickets.service.spec.ts`:

(a) **Remover/atualizar** o teste `create: setor executor com requiresApproval nasce PENDING_APPROVAL` (linha ~318) — trocar por:

```typescript
test('create: chamado nasce sempre OPEN (aprovação removida)', async () => {
  const svc = makeService({
    subcategory: {
      id: 'sub', categoryId: 'cat', baseComplexity: 'MEDIUM', details: [],
      category: { id: 'cat', name: 'Rede', departmentId: 'exec' },
      name: 'Lentidão',
    },
    department: { id: 'dep', name: 'RH', priorityWeight: 3 },
    departmentsById: {
      dep: { id: 'dep', name: 'RH', priorityWeight: 3 },
      exec: { id: 'exec', name: 'TI', priorityWeight: 5, requiresApproval: true, notificationEmail: null },
    },
  });
  const r: any = await svc.create(
    { categoryId: 'cat', subcategoryId: 'sub', description: null } as any,
    { userId: 'u1', role: 'ADMIN', departmentId: null } as AuthUser,
  );
  assert.equal(r.status, 'OPEN'); // mesmo com requiresApproval=true no setor executor
});
```

(b) **Adicionar** testes dos dois relógios e da captura de resposta (usando o stub `makeService`; garanta que os stubs de `updateStatusWithHistory` e `assign` repassem `firstResponseAt` e um `department: { priorityWeight }`):

```typescript
test('assign grava first_response_at quando ainda nulo', async () => {
  let assignArgs: any;
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, firstResponseAt: null },
    assignee: { id: 'op1', role: 'OPERATOR' },
  });
  (svc as any).repo.assign = async (id: string, to: string, setFirst: boolean) => {
    assignArgs = { id, to, setFirst };
    return { id, assignedTo: to, department: { priorityWeight: 3 } };
  };
  await svc.assign('t1', 'op1', { userId: 'op1', role: 'OPERATOR', departmentId: null } as AuthUser);
  assert.equal(assignArgs.setFirst, true);
});

test('assign NÃO regrava first_response_at se já respondido', async () => {
  let assignArgs: any;
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, firstResponseAt: new Date() },
    assignee: { id: 'op1', role: 'OPERATOR' },
  });
  (svc as any).repo.assign = async (id: string, to: string, setFirst: boolean) => {
    assignArgs = { setFirst };
    return { id, assignedTo: to, department: { priorityWeight: 3 } };
  };
  await svc.assign('t1', 'op1', { userId: 'op1', role: 'OPERATOR', departmentId: null } as AuthUser);
  assert.equal(assignArgs.setFirst, false);
});

test('updateStatus para IN_PROGRESS grava first_response_at quando nulo', async () => {
  let statusArgs: any;
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, status: 'OPEN', firstResponseAt: null },
  });
  (svc as any).repo.updateStatusWithHistory = async (input: any) => {
    statusArgs = input;
    return { id: input.id, status: input.toStatus, complexity: 'MEDIUM', slaStartedAt: new Date(), firstResponseAt: input.firstResponseAt ?? null, resolvedAt: null, department: { priorityWeight: 3 } };
  };
  await svc.updateStatus('t1', 'IN_PROGRESS', { userId: 'a', role: 'ADMIN', departmentId: null } as AuthUser);
  assert.ok(statusArgs.firstResponseAt instanceof Date);
});

test('projeção do staff traz os dois prazos e breach', async () => {
  const past = new Date(Date.now() - 100 * 3600 * 1000); // 100h atrás -> estourado
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, status: 'OPEN', firstResponseAt: null },
  });
  (svc as any).repo.updateStatusWithHistory = async (input: any) => ({
    id: input.id, status: input.toStatus, complexity: 'MEDIUM', slaStartedAt: past,
    firstResponseAt: input.firstResponseAt ?? null, resolvedAt: null, department: { priorityWeight: 3 },
  });
  const r: any = await svc.updateStatus('t1', 'RESOLVED', { userId: 'a', role: 'ADMIN', departmentId: null } as AuthUser);
  assert.equal(typeof r.responseSlaHours, 'number');
  assert.equal(typeof r.resolutionSlaHours, 'number');
  assert.equal(r.resolutionBreached, true); // 100h > qualquer célula
});

test('projeção do USER esconde breach (undefined)', async () => {
  const svc = makeService({
    ticket: { id: 't1', requesterId: 'u1', executorDepartmentId: null, status: 'OPEN', firstResponseAt: null },
  });
  (svc as any).repo.updateStatusWithHistory = async (input: any) => ({
    id: input.id, status: input.toStatus, complexity: 'MEDIUM', slaStartedAt: new Date(),
    firstResponseAt: null, resolvedAt: null, department: { priorityWeight: 3 },
  });
  const r: any = await svc.updateStatus('t1', 'IN_PROGRESS', { userId: 'u1', role: 'USER', departmentId: null } as AuthUser);
  assert.equal(r.responseBreached, undefined);
  assert.equal(r.resolutionBreached, undefined);
  assert.equal(typeof r.resolutionSlaHours, 'number'); // prazo continua visível ao usuário
});
```

> Ajuste o helper `makeService` para que os stubs padrão de `updateStatusWithHistory`/`assign`/`createWithHistory` devolvam `department: { priorityWeight: 3 }`, `complexity`, `slaStartedAt`, `firstResponseAt: null`, `resolvedAt: null` — senão a projeção nova recebe `undefined`. Onde um teste sobrescreve o stub (acima), isso já está contemplado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w @chamados/api`
Expected: FAIL — `withSla` antigo, `approve` ainda existe, `assign`/`updateStatus` sem captura.

- [ ] **Step 3: Reescrever `withSla` (dois relógios) e `hideByRole` (esconde breach do USER)**

Substituir o método `withSla` (linhas ~466-478) e ajustar `hideByRole` (linhas ~486-492):

```typescript
  // Anexa os dois prazos derivados (nulos sem complexidade-base/início/peso) + estouro.
  // Estouro é computado sempre; hideByRole remove do USER.
  private withSla<
    T extends {
      complexity: Complexity | null;
      slaStartedAt: Date | null;
      firstResponseAt: Date | null;
      resolvedAt: Date | null;
      department?: { priorityWeight: number } | null;
    },
  >(t: T) {
    const weight = t.department?.priorityWeight;
    if (t.slaStartedAt == null || weight == null) {
      return {
        ...t,
        responseSlaHours: null, responseDueAt: null,
        resolutionSlaHours: null, resolutionDueAt: null,
        responseBreached: false, resolutionBreached: false,
      };
    }
    const responseDueAt = this.sla.responseDueAt(t.complexity, weight, t.slaStartedAt);
    const resolutionDueAt = this.sla.resolutionDueAt(t.complexity, weight, t.slaStartedAt);
    const now = Date.now();
    const responseBreached =
      t.firstResponseAt == null ? now > responseDueAt.getTime() : t.firstResponseAt > responseDueAt;
    const resolutionBreached =
      t.resolvedAt == null ? now > resolutionDueAt.getTime() : t.resolvedAt > resolutionDueAt;
    return {
      ...t,
      responseSlaHours: this.sla.responseHours(t.complexity, weight),
      responseDueAt,
      resolutionSlaHours: this.sla.resolutionHours(t.complexity, weight),
      resolutionDueAt,
      responseBreached,
      resolutionBreached,
    };
  }
```

Em `hideByRole`, o ramo do USER passa a esconder também o breach (os prazos continuam visíveis):

```typescript
  private hideByRole<
    T extends {
      priority: Priority | null;
      complexity: Complexity | null;
      rating: number | null;
      responseBreached?: boolean;
      resolutionBreached?: boolean;
    },
  >(t: T, user: AuthUser): T {
    if (user.role === 'USER') {
      return { ...t, priority: null, complexity: null, rating: null, responseBreached: undefined, resolutionBreached: undefined };
    }
    if (user.role === 'OPERATOR') return { ...t, rating: null };
    return t;
  }
```

- [ ] **Step 4: `create()` nasce sempre OPEN; remover `approve()`**

Em `create()`, trocar as linhas ~129-131:

```typescript
    // Aprovação removida (spec sla-dois-tempos-automatico): todo chamado nasce OPEN.
    const status: TicketStatus = 'OPEN';
```

Remover o método `approve()` inteiro (linhas ~390-406).

- [ ] **Step 5: `assign()` e `updateStatus()` capturam a 1ª resposta**

Em `assign()`, trocar a última linha (`return this.repo.assign(id, assignedTo);`) por:

```typescript
    // Primeira resposta: assumir marca first_response_at se ainda não houver.
    return this.repo.assign(id, assignedTo, ticket.firstResponseAt == null);
```

Em `updateStatus()`, antes de montar `resolvedAt`, calcular a captura e passá-la ao repo:

```typescript
    const resolvedAt =
      status === 'RESOLVED' ? new Date() : status === 'CLOSED' ? ticket.resolvedAt : null;
    // Primeira resposta: ir para IN_PROGRESS marca first_response_at se ainda não houver.
    const firstResponseAt =
      status === 'IN_PROGRESS' && ticket.firstResponseAt == null ? new Date() : undefined;

    const updated = await this.repo.updateStatusWithHistory({
      id,
      fromStatus: ticket.status,
      toStatus: status,
      changedBy: user.userId,
      resolvedAt,
      firstResponseAt,
    });
```

- [ ] **Step 6: `update()` sem override de complexidade**

Em `update()` (linhas ~181-184), trocar por (usa sempre a complexidade já persistida):

```typescript
    const complexity = ticket.complexity;
    const priority = complexity
      ? this.priority.compute(complexity, department.priorityWeight)
      : null;
    const moveToOpen = ticket.status === 'TRIAGE' && complexity != null;
```

- [ ] **Step 7: Rodar os testes e ver passar**

Run: `npm test -w @chamados/api`
Expected: PASS — número real (reportar no handoff, ex.: `NN/NN pass`). Corrigir stubs de `makeService` se algum teste de projeção receber `undefined`.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/modules/tickets/tickets.service.ts packages/api/src/modules/tickets/tickets.service.spec.ts
git commit -m "feat(api): dois relógios de SLA na projeção, captura de 1ª resposta e fim da aprovação"
```

---

### Task 7: Controller + DTO — remover `PATCH :id/approve` e `complexity`

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.controller.ts:103-107`
- Modify: `packages/api/src/modules/tickets/dto/update-ticket.dto.ts`

**Interfaces:**
- Consumes: `TicketsService` sem `approve()` (Task 6).
- Produces: rota `/approve` inexistente; `UpdateTicketDto` só com `departmentId`.

- [ ] **Step 1: Remover o endpoint de aprovação**

Em `tickets.controller.ts`, apagar o bloco (linhas ~103-107):

```typescript
  @Patch(':id/approve')
  @Roles('ADMIN')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.approve(id, user);
  }
```

- [ ] **Step 2: Remover `complexity` do DTO**

Substituir `update-ticket.dto.ts`:

```typescript
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
```

- [ ] **Step 3: Build completo do backend**

Run: `npm run build -w @chamados/shared && npm run build -w @chamados/api`
Expected: build limpo (sem referência a `approve`, `slaHours`/`slaDueAt` antigos ou `dto.complexity`).

- [ ] **Step 4: Suíte completa da API**

Run: `npm test -w @chamados/api`
Expected: PASS com número real.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/modules/tickets/tickets.controller.ts packages/api/src/modules/tickets/dto/update-ticket.dto.ts
git commit -m "feat(api): remove endpoint de aprovação e override de complexidade do PATCH"
```

---

### Task 8: Frontend — helpers dos dois relógios, páginas e label faltante

**Files:**
- Rewrite: `packages/web/src/lib/sla.ts`
- Modify: `packages/web/src/lib/labels.ts:18-32` (chave `PENDING_APPROVAL`)
- Modify: `packages/web/src/pages/TicketDetailPage.tsx`
- Modify: `packages/web/src/pages/DashboardPage.tsx:226,263`

**Interfaces:**
- Consumes: `Ticket` novo (Task 1).
- Produces: `responseText(ticket)`, `resolutionText(ticket)` e estado "respondido"/breach para a UI.

- [ ] **Step 1: Completar `labels.ts` com `PENDING_APPROVAL`**

Em `STATUS_LABEL` (após `TRIAGE: 'Em triagem',`) e `STATUS_CLASS` (após `TRIAGE: ...,`), adicionar as chaves dormentes para completar o `Record<TicketStatus,…>`:

```typescript
// STATUS_LABEL:
  PENDING_APPROVAL: 'Aguardando aprovação',
// STATUS_CLASS:
  PENDING_APPROVAL: 'bg-grena/10 text-grena ring-grena/30',
```

- [ ] **Step 2: Reescrever `lib/sla.ts` para os dois relógios**

```typescript
import { Ticket, TicketStatus } from '@chamados/shared';

const DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];

// Texto amigável ao usuário (nunca revela prioridade/complexidade).
export function responseText(t: Pick<Ticket, 'responseSlaHours'>): string | null {
  if (t.responseSlaHours == null) return null;
  return `Resposta em até ${t.responseSlaHours}h`;
}

export function resolutionText(t: Pick<Ticket, 'resolutionSlaHours'>): string | null {
  if (t.resolutionSlaHours == null) return null;
  return `Conclusão em até ${t.resolutionSlaHours}h`;
}

// "Respondido" quando a 1ª resposta já foi registrada.
export function isResponded(t: Pick<Ticket, 'firstResponseAt'>): boolean {
  return t.firstResponseAt != null;
}

// Breach vem do backend (só staff o recebe); esconde em chamado encerrado.
export function responseBreached(t: Pick<Ticket, 'responseBreached' | 'status'>): boolean {
  return !!t.responseBreached && !DONE.includes(t.status);
}
export function resolutionBreached(t: Pick<Ticket, 'resolutionBreached' | 'status'>): boolean {
  return !!t.resolutionBreached && !DONE.includes(t.status);
}
```

- [ ] **Step 3: `TicketDetailPage` — remover seletor de complexidade e mostrar os dois prazos**

Em `packages/web/src/pages/TicketDetailPage.tsx`:
- Remover o `import` e uso de `slaText`/`isSlaBreached` (linhas ~62-63) e trocar pela composição nova (`responseText`/`resolutionText`/`isResponded` + breach).
- Remover o bloco do seletor "Definir complexidade..." (linhas ~184-191) e o handler `updateTicket.mutate({ complexity })`.
- Exibir, para o usuário: `Resposta em até Xh · Conclusão em até Yh` (sem cor). Para staff: os dois relógios; após responder, "Respondido"; "Resposta estourada"/"Conclusão estourada" em vermelho quando `responseBreached`/`resolutionBreached`.
- Confirmar que não há botão/rota "Aprovar" (aprovação removida).

> Manter o padrão visual existente (classes Tailwind já usadas na página). Mobile-first (viewport mínimo 375px).

- [ ] **Step 4: `DashboardPage` — coluna "Prazo" com os dois relógios**

Em `packages/web/src/pages/DashboardPage.tsx:226` e `:263`, trocar `t.slaHours` por: enquanto não respondido (`!t.firstResponseAt`), mostrar a resposta (`t.responseSlaHours`); senão a conclusão (`t.resolutionSlaHours`). Ex.:

```tsx
{(() => {
  const h = t.firstResponseAt ? t.resolutionSlaHours : t.responseSlaHours;
  const rot = t.firstResponseAt ? 'Conclusão' : 'Resposta';
  return h != null ? `${rot}: até ${h}h` : '—';
})()}
```

- [ ] **Step 5: Build do web (typecheck inclui o Record completo)**

Run: `npm run build -w @chamados/web`
Expected: build limpo — em especial o `Record<TicketStatus,…>` agora completo com `PENDING_APPROVAL`, e nenhum uso remanescente de `slaHours`/`slaDueAt`/`ticket.complexity` de edição.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/sla.ts packages/web/src/lib/labels.ts packages/web/src/pages/TicketDetailPage.tsx packages/web/src/pages/DashboardPage.tsx
git commit -m "feat(web): exibe os dois relógios de SLA, remove seletor de complexidade e completa labels"
```

---

### Task 9: Memória & documentação

**Files:**
- Create: `docs/memory/decisions/sla-dois-tempos-automatico.md`
- Modify: `docs/memory/decisions/aprovacao-chamados.md` (link `← SUPERADA por`)
- Modify: `docs/memory/README.md` (índice + anotação de superada)
- Modify: `docs/memory/architecture/business-rules.md` (SLA, priorização, aprovação)
- Create: `docs/memory/handoffs/sessao-2026-07-07-sla-dois-tempos.md`
- Modify (se a realidade documentada mudou): `docs/projeto/` (API, funcionalidades)

- [ ] **Step 1: Escrever a decisão nova**

`docs/memory/decisions/sla-dois-tempos-automatico.md`: problema, solução (dois relógios derivados, matrizes fixas, fim do override e da aprovação), o que supera (`aprovacao-chamados` inteira; parte de `prazo-complexidade-automatica` quanto ao SLA único e ao override), e por quê `PENDING_APPROVAL` fica dormente. Linkar a spec.

- [ ] **Step 2: Marcar `aprovacao-chamados` como superada**

No topo de `docs/memory/decisions/aprovacao-chamados.md`, adicionar `← SUPERADA por sla-dois-tempos-automatico` com link. No `README.md`, anotar na linha do índice (padrão da linha 19 do próprio README).

- [ ] **Step 3: Atualizar `business-rules.md`**

Seções de SLA (agora dois tempos, matrizes), priorização (badge inalterado, não governa prazo) e aprovação (removida; enum dormente).

- [ ] **Step 4: Indexar a decisão nova no `README.md`** (bloco Decisions) e o handoff (bloco Handoffs).

- [ ] **Step 5: Escrever o handoff da sessão**

`docs/memory/handoffs/sessao-2026-07-07-sla-dois-tempos.md`: Contexto (queda de luz + retomada; implementação perdida e refeita a partir da spec), Decisões, O que mudou (commits), **Verificação executada com números reais**, Pendências (deploy/smoke — ver Task 10), e PRÓXIMO passo.

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs(memory): decisão do SLA de dois tempos, supera aprovacao-chamados, business-rules e handoff"
```

---

### Task 10: Verificação final (evidência antes de afirmação)

**Files:** nenhum (execução/validação).

- [ ] **Step 1: Build na ordem de dependência**

Run: `npm run build -w @chamados/shared && npm run build -w @chamados/api && npm run build -w @chamados/web`
Expected: três builds limpos.

- [ ] **Step 2: Suíte da API com número real**

Run: `npm test -w @chamados/api`
Expected: `NN/NN pass` (anotar o número no handoff).

- [ ] **Step 3: Smoke real (Fabio — precisa do banco no ar)**

Roteiro (spec §8):
1. `docker compose up -d` → `npm run db:migrate -w @chamados/api` (aplica `20260707120000_sla_dois_tempos`; confere backfill sem erro).
2. `npm run dev`; abrir um chamado → como **usuário**, ver `Resposta em até Xh · Conclusão em até Yh`; como **staff**, ver os dois relógios com contagem.
3. **Assumir** o chamado → `first_response_at` grava; "Resposta" vira "Respondido".
4. Em outro chamado ainda não respondido, mover para **IN_PROGRESS** → também grava `first_response_at`.
5. Forçar prazo vencido (ex.: `slaStartedAt` antigo) → staff vê "Resposta estourada"/"Conclusão estourada" em vermelho; usuário não vê estouro.
6. `PATCH /tickets/:id { complexity: 'HIGH' }` → rejeitado (400/ignorado); nenhum chamado nasce `PENDING_APPROVAL`; rota `/approve` retorna 404.
7. Limpar dados de teste.

> **Reportar falha ou passo pulado explicitamente no handoff — nunca como sucesso.** Smoke e `db:*` são do Fabio (ambiente). Deploy: ordem da spec §7 (coluna → backfill → Presidência → defensivo → `db:deploy` → build `shared→api→web` → restart).

---

## Self-Review

**Spec coverage:**
- Decisão 1 (fim do override) → Tasks 1, 6 (step 6), 7. ✔
- Decisão 2 (dois relógios, captura em assign/IN_PROGRESS) → Tasks 4, 5, 6. ✔
- Decisão 3 (matriz granular, prioridade intacta) → Tasks 2, 3; `priority.matrix.ts` só ganha `export`. ✔
- Decisão 4 (remoção da aprovação, enum dormente) → Tasks 4, 6, 7, 9. ✔
- Decisão 5 (visibilidade: usuário vê prazos sem cor, staff vê breach) → Tasks 6 (hideByRole), 8. ✔
- Modelo de dados (§3: `first_response_at`, backfill, defensivo, sem enum novo) → Task 4. ✔
- Backend (§4) → Tasks 2,3,5,6,7. Frontend (§5) → Task 8 (inclui label `PENDING_APPROVAL`). ✔
- Migração/deploy (§7) e Verificação (§8) → Tasks 4, 10. ✔
- Impacto em memória (§9) → Task 9. ✔
- Não-objetivos (IDs sequenciais, minutos, calendário útil) → não há task; correto. ✔

**Placeholder scan:** sem TBD/TODO; todo step de código traz o código. Task 8 steps 3 descreve a edição da página com referências de linha (a página é grande; a intenção e os pontos exatos estão dados) — aceitável por ser reestruturação de UI existente.

**Type consistency:** `responseSlaHours`/`resolutionSlaHours`/`responseDueAt`/`resolutionDueAt`/`firstResponseAt`/`responseBreached`/`resolutionBreached` idênticos entre Task 1 (tipo), Task 6 (projeção) e Task 8 (consumo). `assign(id, to, setFirstResponse)` e `updateStatusWithHistory({…, firstResponseAt?})` idênticos entre Task 5 (repo) e Task 6 (service). `WeightBand`/`weightBand` idênticos entre Task 2 (export) e `sla.matrix.ts`.
