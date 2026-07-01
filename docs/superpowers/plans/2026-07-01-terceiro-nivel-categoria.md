# 3º nível de categoria ("Detalhe") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um 3º nível opcional ("Detalhe") à abertura guiada de chamados, para reduzir texto livre e preparar a complexidade automática do Item 2.

**Architecture:** Espelha o padrão já existente de `ticket_subcategories`: nova tabela `ticket_detail_options` (FK subcategoria), coluna nullable `detail_option_id` em `tickets`, seed idempotente na própria migration. O 3º nível é data-driven (0..N por subcategoria) e obrigatório quando existe. Backend valida pertencimento e deriva o título de 3 níveis; frontend insere um grid intermediário reaproveitando `BlockCard`/`CategoryIcon`.

**Tech Stack:** NestJS + Prisma + PostgreSQL (api), React + Vite + TanStack Query + Tailwind + lucide-react (web), TypeScript strict, monorepo npm workspaces, testes `node:test`.

**Spec:** `docs/superpowers/specs/2026-07-01-terceiro-nivel-categoria-design.md`

## Global Constraints

- **Branch primeiro:** o repo está em `main`. Criar branch `feat/terceiro-nivel-categoria` antes do 1º commit. Não commitar em `main`.
- **Deploy é do usuário.** O Claude só edita/testa local. Nada de `migrate deploy` em produção, nada subido.
- **`base_complexity` nasce e permanece NULL** nesta feature (coluna criada só para o Item 2).
- **Sem LLM / sem ferramenta nova.** Complexidade automática é do Item 2, fora deste plano.
- **Migration não-destrutiva:** colunas nullable, FK `ON DELETE SET NULL` em `tickets`; chamados antigos preservados.
- **Slug de subcategoria não é global** (`unique(category_id, slug)`): o seed resolve a subcategoria por **categoria + subcategoria**.
- **TypeScript strict**, arquivos kebab-case, camelCase/PascalCase conforme `CLAUDE.md`.
- **Responsividade mobile-first** (viewport mínimo 375px) em todo componente tocado.
- **Conventional commits** (`feat:`, `test:`, `docs:`).
- **Detalhe obrigatório quando a subcategoria tem detalhes**; proibido quando não tem.

---

### Task 0: Branch

- [ ] **Step 1: Criar e entrar na branch**

```bash
git checkout -b feat/terceiro-nivel-categoria
git status
```
Expected: `On branch feat/terceiro-nivel-categoria`, apenas o spec untracked.

- [ ] **Step 2: Commit do spec**

```bash
git add docs/superpowers/specs/2026-07-01-terceiro-nivel-categoria-design.md
git commit -m "docs: spec do 3º nível de categoria (detalhe)"
```

---

### Task 1: Modelo de dados — Prisma + migration + seed

**Files:**
- Modify: `packages/api/prisma/schema.prisma`
- Create: `packages/api/prisma/migrations/<timestamp>_add_ticket_details/migration.sql` (gerado + seed anexado)

**Interfaces:**
- Produces: tabela `ticket_detail_options(id, subcategory_id, slug, name, icon, sort_order, base_complexity, created_at)`; `tickets.detail_option_id` (nullable); `ticket_subcategories.base_complexity` (nullable). Models Prisma `TicketDetailOption`, `Ticket.detailOption`/`detailOptionId`, `TicketSubcategory.details`/`baseComplexity`, `TicketDetailOption.baseComplexity`.

- [ ] **Step 1: Editar `schema.prisma` — model `Ticket`**

Em `model Ticket`, logo após as linhas de `subcategoryId`/`subcategory` (após a linha `subcategory   TicketSubcategory? @relation(...)`), adicionar:

```prisma
  detailOptionId String?            @map("detail_option_id")
  detailOption   TicketDetailOption? @relation(fields: [detailOptionId], references: [id])
```

E adicionar o índice junto aos demais `@@index` de `Ticket`:

```prisma
  @@index([detailOptionId])
```

- [ ] **Step 2: Editar `schema.prisma` — model `TicketSubcategory`**

Adicionar o campo `baseComplexity` (após `sortOrder`) e a relação `details` (após `tickets Ticket[]`):

```prisma
  baseComplexity Complexity? @map("base_complexity")
```
```prisma
  details TicketDetailOption[]
```

- [ ] **Step 3: Editar `schema.prisma` — novo model `TicketDetailOption`**

Adicionar logo após o `model TicketSubcategory { ... }`:

```prisma
model TicketDetailOption {
  id             String            @id @default(uuid())
  subcategoryId  String            @map("subcategory_id")
  subcategory    TicketSubcategory @relation(fields: [subcategoryId], references: [id])
  slug           String
  name           String
  icon           String
  sortOrder      Int               @map("sort_order")
  baseComplexity Complexity?       @map("base_complexity")
  createdAt      DateTime          @default(now()) @map("created_at")

  tickets Ticket[]

  @@unique([subcategoryId, slug])
  @@index([subcategoryId])
  @@map("ticket_detail_options")
}
```

- [ ] **Step 4: Gerar a migration (sem aplicar) para conferir o DDL**

```bash
npm run db:migrate -w @chamados/api -- --name add_ticket_details --create-only
```
Expected: cria `packages/api/prisma/migrations/<timestamp>_add_ticket_details/migration.sql` com `CREATE TABLE "ticket_detail_options"`, `ALTER TABLE "tickets" ADD COLUMN "detail_option_id"`, `ALTER TABLE "ticket_subcategories" ADD COLUMN "base_complexity"`, índices e FKs. **Não aplica ainda.**

- [ ] **Step 5: Anexar o seed idempotente ao final do `migration.sql`**

Abrir o `migration.sql` recém-criado e **acrescentar ao final** (após o DDL gerado) o bloco abaixo. O join resolve a subcategoria por **categoria + subcategoria** (slug de subcategoria não é global). `base_complexity` fica NULL.

```sql
-- ============================================================================
-- Seed de referência: 3º nível ("detalhe") das subcategorias onde há modo de
-- falha/dispositivo claro. Idempotente (ON CONFLICT). base_complexity fica NULL
-- (preenchido no Item 2). Resolve a subcategoria por categoria+subcategoria.
-- ============================================================================

-- Computador e Equipamentos › Computador ou notebook
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('nao-liga','Não liga','PowerOff',1),
  ('muito-lento','Muito lento ou travando','Gauge',2),
  ('superaquecendo','Superaquecendo ou ventoinha','Thermometer',3),
  ('tela-azul','Tela azul ou reinicia sozinho','MonitorX',4),
  ('nao-reconhece','Não reconhece USB ou pen drive','Usb',5),
  ('bateria','Bateria não carrega','BatteryWarning',6)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='computador-notebook'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Monitor
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('nao-liga','Não liga','PowerOff',1),
  ('sem-imagem','Sem imagem ou sinal','MonitorOff',2),
  ('piscando','Piscando ou falhando','MonitorDot',3),
  ('manchas-linhas','Manchas ou linhas na tela','MonitorX',4),
  ('cabo-conexao','Cabo ou conexão','Cable',5)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='monitor'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Impressora
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('nao-imprime','Não imprime','Printer',1),
  ('atolando','Atolando papel','FileX',2),
  ('sem-toner','Sem toner ou tinta','Droplet',3),
  ('erro-driver','Erro ou driver','TriangleAlert',4),
  ('qualidade-ruim','Qualidade ruim de impressão','ImageOff',5),
  ('nao-reconhecida','Não é reconhecida na rede','PrinterCheck',6)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='impressora'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Periféricos
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('teclado','Teclado','Keyboard',1),
  ('mouse','Mouse','Mouse',2),
  ('webcam','Webcam','Webcam',3),
  ('headset-audio','Headset ou áudio','Headphones',4),
  ('outro-periferico','Outro periférico','Plug',5)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='perifericos'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Telefonia
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('sem-linha','Sem linha ou tom','PhoneOff',1),
  ('ruido','Ruído na chamada','Volume2',2),
  ('ramal-nao-toca','Ramal não toca','PhoneMissed',3),
  ('config-ramal','Configuração de ramal','Settings',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='telefonia'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Dispositivo móvel
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('nao-liga','Não liga ou não carrega','PowerOff',1),
  ('sem-conexao','Sem conexão (dados ou Wi-Fi)','WifiOff',2),
  ('app-corporativo','App corporativo com problema','AppWindow',3),
  ('email-config','E-mail ou configuração de conta','Mail',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='dispositivo-movel'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Internet e Rede › Sem conexão à internet
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('cabo','Cabo desconectado','Cable',1),
  ('wifi','Wi-Fi','Wifi',2),
  ('ponto-rede','Tomada ou ponto de rede','PlugZap',3),
  ('setor-todo','Setor inteiro sem rede','Network',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='internet-rede' AND s.slug='sem-conexao'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Internet e Rede › Wi-Fi instável ou lento
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('cai-direto','Cai direto ou desconecta','WifiOff',1),
  ('muito-lento','Muito lento','Gauge',2),
  ('nao-conecta','Não conecta','Ban',3),
  ('sinal-fraco','Sinal fraco em um local','SignalLow',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='internet-rede' AND s.slug='wifi-instavel'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Internet e Rede › Acesso à rede interna
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('vpn','VPN','ShieldCheck',1),
  ('compartilhamento','Pasta ou compartilhamento','FolderX',2),
  ('servidor-sistema','Servidor ou sistema interno','Server',3),
  ('impressora-rede','Impressora de rede','Printer',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='internet-rede' AND s.slug='rede-interna'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Sistemas e Aplicativos › Erro de funcionamento
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('mensagem-erro','Mostra mensagem de erro','MessageSquareWarning',1),
  ('trava-fecha','Trava ou fecha sozinho','AppWindow',2),
  ('funcao-nao-funciona','Uma função não funciona','CircleAlert',3),
  ('dados-incorretos','Dados ou informação incorretos','FileWarning',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='sistemas-aplicativos' AND s.slug='erro-funcionamento'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;
```

- [ ] **Step 6: Aplicar a migration ao banco de dev + gerar o client**

```bash
npm run db:migrate -w @chamados/api -- --name add_ticket_details
npm run db:generate
```
Expected: "The following migration(s) have been applied", client Prisma regenerado sem erro.

- [ ] **Step 7: Verificar o seed (contagem por subcategoria)**

```bash
docker exec chamados-db psql -U postgres -d chamados -c "SELECT c.slug AS categoria, s.slug AS subcategoria, count(d.*) AS detalhes FROM ticket_subcategories s JOIN ticket_categories c ON c.id=s.category_id LEFT JOIN ticket_detail_options d ON d.subcategory_id=s.id GROUP BY c.slug,s.slug HAVING count(d.*)>0 ORDER BY 1,2;"
```
Expected: 10 subcategorias listadas (computador-notebook=6, monitor=5, impressora=6, perifericos=5, telefonia=4, dispositivo-movel=4, sem-conexao=4, wifi-instavel=4, rede-interna=4, erro-funcionamento=4). Total = 46.

- [ ] **Step 8: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations
git commit -m "feat(db): tabela ticket_detail_options, detail_option_id e seed do 3º nível"
```

---

### Task 2: Tipos compartilhados (`@chamados/shared`)

**Files:**
- Modify: `packages/shared/src/types.ts`

**Interfaces:**
- Produces: `TicketDetailOption`; `TicketSubcategory.details: TicketDetailOption[]`; `Ticket.detailOptionId: string | null` e `Ticket.detailOption?: TicketDetailOption | null`; `CreateTicketInput.detailOptionId?: string`.

- [ ] **Step 1: Adicionar `TicketDetailOption` e `details` em `TicketSubcategory`**

Em `packages/shared/src/types.ts`, na seção `// ---- Categorização (blocos) ----`, adicionar a interface e o campo:

```typescript
export interface TicketDetailOption {
  id: string;
  subcategoryId: string;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
}
```

E em `TicketSubcategory`, adicionar após `sortOrder: number;`:

```typescript
  // 3º nível opcional (data-driven). Vazio = subcategoria sem detalhe.
  details?: TicketDetailOption[];
}
```

> Observação: `details` é opcional no tipo base `TicketSubcategory`, mas **sempre presente** no payload de `GET /categories` (Task 3). Consumidores devem tratar `details ?? []`.

- [ ] **Step 2: Adicionar `detailOptionId`/`detailOption` em `Ticket`**

Em `interface Ticket`, após as linhas de `subcategory?`:

```typescript
  detailOptionId: string | null;
  detailOption?: TicketDetailOption | null;
```

- [ ] **Step 3: Adicionar `detailOptionId` em `CreateTicketInput`**

Em `interface CreateTicketInput`, após `subcategoryId: string;`:

```typescript
  // 3º nível — obrigatório quando a subcategoria escolhida tiver detalhes.
  detailOptionId?: string;
```

- [ ] **Step 4: Build do shared**

```bash
npm run build -w @chamados/shared
```
Expected: build limpo, sem erro de tipo.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): tipos do 3º nível (TicketDetailOption, detailOptionId)"
```

---

### Task 3: Backend — `GET /categories` aninha `details` + `findSubcategory` inclui `details`

**Files:**
- Modify: `packages/api/src/modules/categories/categories.repository.ts`

**Interfaces:**
- Consumes: models Prisma da Task 1.
- Produces: `findAllWithSubcategories()` retorna subcategorias com `details` ordenados; `findSubcategory(id)` retorna a subcategoria com `category` **e** `details`.

- [ ] **Step 1: Incluir `details` em ambas as queries**

Substituir o corpo de `categories.repository.ts` por:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Categorias > subcategorias > detalhes aninhados, já ordenados — uma query, sem N+1.
  findAllWithSubcategories() {
    return this.prisma.ticketCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        subcategories: {
          orderBy: { sortOrder: 'asc' },
          include: { details: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  }

  // Inclui os detalhes para validar obrigatoriedade/pertencimento na criação do chamado.
  findSubcategory(id: string) {
    return this.prisma.ticketSubcategory.findUnique({
      where: { id },
      include: { category: true, details: { orderBy: { sortOrder: 'asc' } } },
    });
  }
}
```

- [ ] **Step 2: Build da api**

```bash
npm run build -w @chamados/api
```
Expected: build limpo.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/modules/categories/categories.repository.ts
git commit -m "feat(api): GET /categories aninha detalhes e findSubcategory os inclui"
```

---

### Task 4: Backend — criação de chamado com detalhe (DTO + service + repository) [TDD]

**Files:**
- Modify: `packages/api/src/modules/tickets/dto/create-ticket.dto.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.ts:61-99` (método `create`)
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts:95-129` (`createWithHistory`)
- Modify: `packages/api/src/modules/tickets/tickets.repository.ts:15-23,55-75` (includes de `detailOption`)
- Test: `packages/api/src/modules/tickets/tickets.service.spec.ts`

**Interfaces:**
- Consumes: `findSubcategory(id)` → `{ id, categoryId, name, category: { name }, details: { id, name }[] }` (Task 3).
- Produces: `create(dto, user)` deriva título de 3 níveis e persiste `detailOptionId`; `createWithHistory(input)` aceita `detailOptionId: string | null`.

- [ ] **Step 1: Escrever os testes que falham**

No `tickets.service.spec.ts`, atualizar a fixture `subRedefinicao` para incluir `details: []` e adicionar uma fixture com detalhes + os 4 novos testes. Na `subRedefinicao` (linha ~83), adicionar `details: []`:

```typescript
const subRedefinicao = {
  id: 's1',
  categoryId: 'c1',
  name: 'Redefinição de senha',
  category: { id: 'c1', name: 'Acesso e Senhas' },
  details: [],
};

// Subcategoria COM 3º nível (ex.: Monitor).
const subMonitor = {
  id: 's2',
  categoryId: 'c2',
  name: 'Monitor',
  category: { id: 'c2', name: 'Computador e Equipamentos' },
  details: [
    { id: 'd1', name: 'Não liga' },
    { id: 'd2', name: 'Sem imagem ou sinal' },
  ],
};
```

Adicionar, após o teste `create: rejeita subcategoria que não pertence...` (linha ~107):

```typescript
test('create: com detalhe válido deriva o título de 3 níveis e grava detailOptionId', async () => {
  const svc = makeService({ subcategory: subMonitor });
  const r: any = await svc.create(
    { categoryId: 'c2', subcategoryId: 's2', detailOptionId: 'd1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.title, 'Computador e Equipamentos › Monitor › Não liga');
  assert.equal(r.detailOptionId, 'd1');
});

test('create: subcategoria com detalhes exige detailOptionId', async () => {
  const svc = makeService({ subcategory: subMonitor });
  await assert.rejects(
    () => svc.create({ categoryId: 'c2', subcategoryId: 's2', departmentId: 'dep1' } as any, admin),
    (e) => e instanceof BadRequestException,
  );
});

test('create: rejeita detalhe que não pertence à subcategoria', async () => {
  const svc = makeService({ subcategory: subMonitor });
  await assert.rejects(
    () => svc.create(
      { categoryId: 'c2', subcategoryId: 's2', detailOptionId: 'OUTRO', departmentId: 'dep1' } as any,
      admin,
    ),
    (e) => e instanceof BadRequestException,
  );
});

test('create: subcategoria sem detalhes ignora detailOptionId ausente (regressão) e rejeita detalhe indevido', async () => {
  const ok = makeService({ subcategory: subRedefinicao });
  const r: any = await ok.create(
    { categoryId: 'c1', subcategoryId: 's1', departmentId: 'dep1' } as any,
    admin,
  );
  assert.equal(r.title, 'Acesso e Senhas › Redefinição de senha');
  assert.equal(r.detailOptionId, null);

  const bad = makeService({ subcategory: subRedefinicao });
  await assert.rejects(
    () => bad.create(
      { categoryId: 'c1', subcategoryId: 's1', detailOptionId: 'd1', departmentId: 'dep1' } as any,
      admin,
    ),
    (e) => e instanceof BadRequestException,
  );
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npm test -w @chamados/api
```
Expected: os 4 novos testes FALHAM (o `create` ainda não conhece `detailOptionId`; `subMonitor` exige título de 3 níveis).

- [ ] **Step 3: Adicionar `detailOptionId` ao DTO**

Em `create-ticket.dto.ts`, após o bloco de `subcategoryId`:

```typescript
  // 3º nível ("detalhe") — obrigatório quando a subcategoria escolhida tiver detalhes.
  @IsOptional()
  @IsUUID()
  detailOptionId?: string;
```

- [ ] **Step 4: Implementar a validação + derivação no `create` do service**

Em `tickets.service.ts`, substituir o trecho da categorização (linhas ~83-98, do comentário "Categorização guiada" até o `return this.repo.createWithHistory({...})`) por:

```typescript
    // Categorização guiada: valida que a subcategoria pertence à categoria e deriva o
    // "Assunto" (título). O 3º nível ("detalhe") é obrigatório quando a subcategoria tiver
    // detalhes, e proibido quando não tiver — mantém o dado consistente.
    const subcategory = await this.categories.findSubcategory(dto.subcategoryId);
    if (!subcategory || subcategory.categoryId !== dto.categoryId) {
      throw new BadRequestException('Subcategoria inválida para a categoria informada');
    }

    const details = subcategory.details ?? [];
    let detailOptionId: string | null = null;
    let detailName: string | null = null;
    if (details.length > 0) {
      if (!dto.detailOptionId) {
        throw new BadRequestException('Selecione um detalhe para esta subcategoria');
      }
      const detail = details.find((d) => d.id === dto.detailOptionId);
      if (!detail) {
        throw new BadRequestException('Detalhe inválido para a subcategoria informada');
      }
      detailOptionId = detail.id;
      detailName = detail.name;
    } else if (dto.detailOptionId) {
      throw new BadRequestException('Esta subcategoria não aceita detalhe');
    }

    const title = detailName
      ? `${subcategory.category.name} › ${subcategory.name} › ${detailName}`
      : `${subcategory.category.name} › ${subcategory.name}`;

    return this.repo.createWithHistory({
      title,
      description: dto.description ?? null,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      detailOptionId,
      departmentId,
      requesterId,
    });
```

- [ ] **Step 5: Aceitar `detailOptionId` no `createWithHistory`**

Em `tickets.repository.ts`, no `createWithHistory`, adicionar `detailOptionId` à assinatura do input e ao `data`:

```typescript
  createWithHistory(input: {
    title: string;
    description: string | null;
    categoryId: string;
    subcategoryId: string;
    detailOptionId: string | null;
    departmentId: string;
    requesterId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          title: input.title,
          description: input.description,
          category: { connect: { id: input.categoryId } },
          subcategory: { connect: { id: input.subcategoryId } },
          detailOption: input.detailOptionId
            ? { connect: { id: input.detailOptionId } }
            : undefined,
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

- [ ] **Step 6: Incluir `detailOption` nos includes de leitura**

Em `tickets.repository.ts`, `findManyPaginated` (o `include`):

```typescript
      include: { category: true, subcategory: true, detailOption: true },
```

E em `findDetail`, no bloco `include`, adicionar `detailOption: true` junto de `subcategory: true`:

```typescript
        category: true,
        subcategory: true,
        detailOption: true,
```

- [ ] **Step 7: Rodar os testes e confirmar que passam**

```bash
npm test -w @chamados/api
```
Expected: todos os testes PASSAM (os 4 novos inclusos).

- [ ] **Step 8: Build da api**

```bash
npm run build -w @chamados/api
```
Expected: build limpo.

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/modules/tickets
git commit -m "feat(api): criação de chamado com 3º nível (validação + título 3 níveis)"
```

---

### Task 5: Frontend — registrar os ícones novos no `CategoryIcon`

**Files:**
- Modify: `packages/web/src/components/CategoryIcon.tsx`

**Interfaces:**
- Produces: registry `ICONS` com os 27 nomes novos usados pelos detalhes.

- [ ] **Step 1: Adicionar os ícones ao import e ao registry**

Em `CategoryIcon.tsx`, adicionar estes nomes **tanto** no `import { ... } from 'lucide-react'` **quanto** no objeto `ICONS` (ordem não importa):

```
PowerOff, Gauge, Thermometer, MonitorX, Usb, BatteryWarning, MonitorOff,
MonitorDot, Cable, FileX, Droplet, ImageOff, PrinterCheck, Mouse, Webcam,
Headphones, Plug, PhoneOff, Volume2, PhoneMissed, Mail, PlugZap, SignalLow,
FolderX, MessageSquareWarning, CircleAlert, FileWarning
```

- [ ] **Step 2: Verificar que todos existem em `lucide-react` (o build quebra se algum nome não existir)**

```bash
npm run build -w @chamados/web
```
Expected: build limpo. Se algum nome não existir na versão instalada, o `tsc` acusa `has no exported member 'X'` → substituir por um ícone equivalente existente e re-registrar (o fallback `HelpCircle` só cobre nomes vindos do banco, não imports quebrados).

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/CategoryIcon.tsx
git commit -m "feat(web): registrar ícones lucide do 3º nível no CategoryIcon"
```

---

### Task 6: Frontend — passo de detalhes na `NewTicketPage`

**Files:**
- Modify: `packages/web/src/pages/NewTicketPage.tsx`

**Interfaces:**
- Consumes: `subcategory.details` (Task 2/3), `CreateTicketInput.detailOptionId` (Task 2), `BlockCard`/`CategoryIcon` existentes.
- Produces: fluxo grid categoria → grid subcategoria → **grid detalhe (quando houver)** → form; breadcrumb de até 4 nós; envia `detailOptionId`.

- [ ] **Step 1: Importar o tipo e adicionar estado do detalhe**

No topo, ajustar o import de `@chamados/shared`:

```typescript
import { CategoryWithSubcategories, TicketDetailOption, TicketSubcategory } from '@chamados/shared';
```

Adicionar o estado (após `const [subcategory, setSubcategory] = ...`):

```typescript
  const [detailOption, setDetailOption] = useState<TicketDetailOption | null>(null);
```

- [ ] **Step 2: Derivar se a subcategoria tem detalhes e ajustar os "voltar"**

Após a definição de `submitting` (~linha 66), adicionar:

```typescript
  const subDetails = subcategory?.details ?? [];
  const needsDetail = subDetails.length > 0;
  // Só mostra o form quando: subcategoria sem detalhe, OU já escolheu um detalhe.
  const showForm = !!subcategory && (!needsDetail || !!detailOption);
```

Atualizar `backToCategories` e o handler de troca de subcategoria para limpar o detalhe:

```typescript
  function backToCategories() {
    setCategory(null);
    setSubcategory(null);
    setDetailOption(null);
  }

  function selectSubcategory(s: TicketSubcategory) {
    setSubcategory(s);
    setDetailOption(null);
  }
```

- [ ] **Step 3: Enviar `detailOptionId` no submit**

No `onSubmit`, no objeto passado a `createTicket.mutateAsync`, adicionar o campo (após `subcategoryId`):

```typescript
        subcategoryId: subcategory.id,
        detailOptionId: detailOption?.id,
```

- [ ] **Step 4: Breadcrumb — adicionar o nó do detalhe**

No `<nav>` do breadcrumb, o nó de `subcategory` deixa de ser texto fixo e vira clicável quando há detalhe; adicionar o nó do detalhe. Substituir o bloco `{subcategory && (...)}` por:

```tsx
        {subcategory && (
          <>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <button
              type="button"
              onClick={() => setDetailOption(null)}
              className={detailOption ? 'text-grena hover:underline' : 'font-medium text-gray-800'}
            >
              {subcategory.name}
            </button>
          </>
        )}
        {detailOption && (
          <>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-800">{detailOption.name}</span>
          </>
        )}
```

- [ ] **Step 5: Trocar o handler do grid de subcategoria e inserir o grid de detalhes**

No passo 2 (grid de subcategorias), trocar `onClick={() => setSubcategory(s)}` por `onClick={() => selectSubcategory(s)}`.

Substituir a condição do passo 3. Onde hoje está `) : (` iniciando o `// Passo 3: detalhes...`, trocar por um novo passo intermediário + o form condicionado a `showForm`. Ou seja, o encadeamento passa a ser:

```tsx
      ) : !subcategory ? (
        /* Passo 2: subcategorias (usar selectSubcategory no onClick) */
        ...
      ) : needsDetail && !detailOption ? (
        // Passo 3: grid de detalhes (3º nível) — obrigatório quando existe
        <div className="space-y-4">
          <Button variant="ghost" className="px-2" onClick={() => setSubcategory(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para as subcategorias
          </Button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subDetails.map((d) => (
              <BlockCard key={d.id} icon={d.icon} label={d.name} onClick={() => setDetailOption(d)} />
            ))}
          </div>
        </div>
      ) : (
        // Passo 4: form (descrição opcional + anexos) — inalterado
        ...
      )
```

- [ ] **Step 6: Mostrar o detalhe no chip do topo do form**

No card do form (passo 4), no bloco do chip que hoje mostra `{category.name}` / `{subcategory.name}`, ajustar o texto do subtítulo para incluir o detalhe quando houver, e o "Voltar" para respeitar o passo do detalhe. No `<Button variant="ghost" ...>` do topo do form, trocar o `onClick`:

```tsx
            <Button
              variant="ghost"
              className="mb-4 px-2"
              onClick={() => (needsDetail ? setDetailOption(null) : setSubcategory(null))}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> {needsDetail ? 'Trocar detalhe' : 'Trocar subcategoria'}
            </Button>
```

E no bloco do chip, trocar o ícone/rótulo para refletir o detalhe quando presente:

```tsx
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-grena/10 text-grena">
              <CategoryIcon name={detailOption?.icon ?? subcategory.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-gray-500">{category.name} › {subcategory.name}</p>
              <p className="text-sm font-semibold text-grena-dark">
                {detailOption ? detailOption.name : subcategory.name}
              </p>
            </div>
```

- [ ] **Step 7: Build do web**

```bash
npm run build -w @chamados/web
```
Expected: `tsc --noEmit` + `vite build` limpos.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/pages/NewTicketPage.tsx
git commit -m "feat(web): passo de detalhe (3º nível) no fluxo guiado de abertura"
```

---

### Task 7: Frontend — exibir o 3º nível no `TicketDetailPage`

**Files:**
- Modify: `packages/web/src/pages/TicketDetailPage.tsx:112-117`

**Interfaces:**
- Consumes: `ticket.detailOption` (Task 2), incluído no payload do detalhe (Task 4 Step 6).

- [ ] **Step 1: Acrescentar o detalhe ao chip de categoria**

No bloco `{ticket.subcategory && (...)}` do cabeçalho, atualizar para mostrar o 3º nível quando presente:

```tsx
          {ticket.subcategory && (
            <span className="inline-flex items-center gap-1 rounded-full bg-grena/5 px-2 py-0.5 text-xs font-medium text-grena">
              <CategoryIcon
                name={ticket.detailOption?.icon ?? ticket.subcategory.icon}
                className="h-3.5 w-3.5"
              />
              {ticket.category?.name} › {ticket.subcategory.name}
              {ticket.detailOption ? ` › ${ticket.detailOption.name}` : ''}
            </span>
          )}
```

- [ ] **Step 2: Build do web**

```bash
npm run build -w @chamados/web
```
Expected: build limpo.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/pages/TicketDetailPage.tsx
git commit -m "feat(web): exibir 3º nível (detalhe) no detalhe do chamado"
```

---

### Task 8: Verificação integrada + docs/memória

**Files:**
- Modify: `docs/memory/architecture/business-rules.md`
- Create: `docs/memory/decisions/terceiro-nivel-categoria.md`
- Create: `docs/memory/handoffs/sessao-2026-07-01-terceiro-nivel.md`
- Modify: `docs/memory/README.md`

- [ ] **Step 1: Build completo + testes**

```bash
npm run build
npm test -w @chamados/api
```
Expected: shared→api→web limpos; todos os testes da api passando.

- [ ] **Step 2: Smoke manual (stack de dev)**

Subir a stack (`docker` do `chamados-db` + `npm run dev`) e conferir, autenticado:
- Abrir chamado em **Monitor** → aparece o grid de detalhes → escolher "Não liga" → concluir → detalhe mostra o chip "Computador e Equipamentos › Monitor › Não liga" e o título idêntico.
- Abrir chamado em **Redefinição de senha** (sem detalhe) → pula direto para a descrição (regressão OK).
- Tentar concluir Monitor sem escolher detalhe é impossível pela UI (grid obrigatório); o backend também rejeita (400) se `detailOptionId` faltar.

- [ ] **Step 3: Atualizar `business-rules.md`**

Na seção "Abertura guiada por categorias (blocos)", acrescentar um item:

```markdown
- **3º nível ("detalhe")**: subcategorias podem ter 0..N detalhes (data-driven, seed na
  migration). Quando a subcategoria tem detalhes, escolher um é **obrigatório**; quando não
  tem, o fluxo vai direto para a descrição. O "Assunto" derivado passa a
  "Categoria › Subcategoria › Detalhe" quando houver detalhe. `tickets.detail_option_id`
  é nullable (chamados antigos/2 níveis = NULL). A coluna `base_complexity` (subcategoria e
  detalhe) existe para o cálculo automático futuro (Item 2) e hoje é NULL.
```

- [ ] **Step 4: Criar a decisão `terceiro-nivel-categoria.md`**

```markdown
# 3º nível de categoria ("detalhe")

Data: 2026-07-01

## Contexto
Objetivo do Fabio: facilitar a abertura, reduzindo texto livre. Após Categoria → Subcategoria,
faltava granularidade para descrever o problema sem digitar.

## Decisão
- Nova tabela `ticket_detail_options` (FK subcategoria), análoga a `ticket_subcategories`.
- Subcategoria tem **0..N** detalhes (data-driven). **Obrigatório quando existe**, proibido quando não.
- `tickets.detail_option_id` nullable (FK SET NULL). "Assunto" derivado ganha o 3º nível.
- Curadoria via seed na migration (idempotente), como as categorias — ~10 subcategorias, 46 detalhes.
- Coluna `base_complexity` (subcategoria + detalhe) criada nullable, **ociosa até o Item 2**
  (complexidade/SLA automáticos). Ver [[triagem-complexidade]] e o backlog de 2026-07-01.

## Consequências
- `GET /categories` passa a aninhar `details`. `POST /tickets` aceita/valida `detailOptionId`.
- Frontend ganha um grid intermediário (reusa `BlockCard`/`CategoryIcon`).
- Não altera triagem/SLA (isso é Item 2).
```

- [ ] **Step 5: Criar o handoff e atualizar o README da memória**

Criar `docs/memory/handoffs/sessao-2026-07-01-terceiro-nivel.md` resumindo o que foi entregue, verificação e pendências de deploy (migration + ordem shared→api→web). Adicionar as duas novas linhas em `docs/memory/README.md` (decisão + handoff).

- [ ] **Step 6: Commit**

```bash
git add docs/memory
git commit -m "docs: memória do 3º nível (business-rules, decisão, handoff, README)"
```

---

## Deploy (pendente — usuário)
Ordem, quando aprovado: `npm run db:generate` → `npm run db:deploy -w @chamados/api` (aplica a
migration + seed em produção via `migrate deploy`) → `npm run build` (shared→api→web) → restart
do serviço. Migration não-destrutiva; chamados antigos preservados (`detail_option_id` NULL).

## Self-Review (checklist do autor do plano)
- **Cobertura do spec:** modelo (T1), tipos (T2), API categorias (T3), criação+validação+título (T4),
  ícones (T5), fluxo de UI (T6), detalhe na página (T7), docs/memória+verificação (T8). ✔
- **Sem placeholders:** todo passo de código traz o código; comandos com output esperado. ✔
- **Consistência de tipos:** `detailOptionId`/`detailOption`/`details`/`TicketDetailOption` usados
  de forma idêntica em shared, DTO, service, repository e front. `createWithHistory` recebe
  `detailOptionId: string | null` (service sempre passa string|null). ✔
- **Seed:** 46 detalhes (a verificação do T1S7 confirma a contagem por subcategoria). ✔
