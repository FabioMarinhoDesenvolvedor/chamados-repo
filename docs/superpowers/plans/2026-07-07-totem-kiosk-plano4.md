# Totem/Kiosk (Multi-setorial Plano 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Totem público: admin gera um token de vida longa no painel; o dispositivo abre `/totem` e registra chamados (com `originLocation` obrigatório) para setores executores (menos TI), sem login visível.

**Architecture:** Sem migration (schema `User.isKiosk`/`Ticket.originLocation` já existe). Backend: endpoint admin-only que faz upsert de um `User` kiosk e assina um JWT `expiresIn: 365d`; `create()` captura `originLocation` só de solicitante kiosk. Frontend: rota `/totem` pública auto-autenticada pelo token do kiosk (mesma chave `chamados.token`), UI kiosk reusando `BlockCard`/`CategoryIcon`, e uma página admin para gerar o token.

**Tech Stack:** NestJS (`@nestjs/jwt`), Prisma, React/Vite, `@chamados/shared`, TanStack Query, Tailwind + tema grená, testes `node:test`.

## Global Constraints

- TypeScript strict, **sem `any`**. Tipos compartilhados só em `@chamados/shared`.
- Ordem de build/verificação `shared → api → web`.
- IDs inteiros (`number`). Sem migration (schema já tem os campos).
- Kiosk é `role=USER` + `isKiosk=true` (sem role nova). Token `expiresIn: '365d'`. Emissão **admin-only**.
- `originLocation`: obrigatório quando `user.isKiosk`; **ignorado** (null) para usuário comum.
- Totem mostra setores executores com categoria **exceto TI**. Blocos data-driven (reusa a lógica do Plano 3).
- Mobile-first (375px), reusar `components/ui`/`BlockCard`/`CategoryIcon`, tema grená. Sem redesign.
- Commits: conventional commits com escopo.

## File Structure

- `packages/shared/src/types.ts` — `CreateKioskTokenInput`, `KioskTokenResponse`; `CreateTicketInput.originLocation?`.
- `packages/api/src/modules/auth/dto/create-kiosk-token.dto.ts` (novo) — DTO do endpoint.
- `packages/api/src/modules/auth/auth.service.ts` — `issueKioskToken()`.
- `packages/api/src/modules/auth/auth.controller.ts` — `POST /auth/kiosk-token` (admin).
- `packages/api/src/modules/users/users.repository.ts` — helper de upsert do user kiosk (se necessário).
- `packages/api/src/modules/tickets/dto/create-ticket.dto.ts` — `originLocation?`.
- `packages/api/src/modules/tickets/tickets.service.ts` / `tickets.repository.ts` — capturar `originLocation`.
- `packages/web/src/lib/blocks.ts` (novo) — extrai `buildBlocks` (hoje em `NewTicketPage`) para reuso.
- `packages/web/src/pages/TotemPage.tsx` (novo) — UI kiosk + provisionamento.
- `packages/web/src/pages/admin/TotemAdminPage.tsx` (novo) — gerar token.
- `packages/web/src/features/auth/api.ts` (ou `features/totem/api.ts` novo) — hook `useCreateKioskToken`.
- `packages/web/src/features/tickets/api.ts` — `originLocation` no input de criação.
- `packages/web/src/App.tsx` — rota `/totem` (pública) + `/admin/totem` (adminOnly) + link no menu admin.
- `docs/memory/` + `docs/projeto/07-operacao-deploy.md`.

---

### Task 1: Shared — tipos do kiosk token + `originLocation` na criação

**Files:**
- Modify: `packages/shared/src/types.ts`

**Interfaces:**
- Produces: `CreateKioskTokenInput { label: string; departmentId: number }`,
  `KioskTokenResponse { token: string; user: UserPublic; expiresInDays: number }`,
  `CreateTicketInput.originLocation?: string`.

- [ ] **Step 1: Adicionar os tipos**

Em `packages/shared/src/types.ts`, adicionar (perto dos tipos de auth/ticket, mantendo o padrão):

```typescript
export interface CreateKioskTokenInput {
  label: string;
  departmentId: number;
}

export interface KioskTokenResponse {
  token: string;
  user: UserPublic;
  expiresInDays: number;
}
```

E em `CreateTicketInput`, adicionar o campo opcional:

```typescript
  originLocation?: string;
```

Exportar os novos tipos no `packages/shared/src/index.ts` se o projeto reexporta explicitamente (conferir o padrão do arquivo).

- [ ] **Step 2: Build do shared**

Run: `npm run build -w @chamados/shared`
Expected: limpo.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "feat(shared): tipos do kiosk token + originLocation na criação de chamado"
```

---

### Task 2: Backend — endpoint de emissão do token do kiosk (admin)

**Files:**
- Create: `packages/api/src/modules/auth/dto/create-kiosk-token.dto.ts`
- Modify: `packages/api/src/modules/auth/auth.service.ts`, `auth.controller.ts`
- Modify (se preciso p/ upsert): `packages/api/src/modules/users/users.repository.ts`
- Test: `packages/api/src/modules/auth/auth.service.spec.ts` (novo ou existente)

**Interfaces:**
- Consumes: `JwtService`, `UsersRepository`, `DepartmentsRepository`.
- Produces: `AuthService.issueKioskToken(dto): Promise<KioskTokenResponse>`; `POST /auth/kiosk-token`.

- [ ] **Step 1: DTO**

Criar `create-kiosk-token.dto.ts`:

```typescript
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateKioskTokenDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;

  @Type(() => Number)
  @IsInt()
  departmentId!: number;
}
```

- [ ] **Step 2: Escrever o teste (falhando)**

Em `auth.service.spec.ts` (node:test), testar `issueKioskToken`: valida departamento existente;
faz upsert do user kiosk (`isKiosk=true`, `role=USER`, e-mail derivado do label); assina token com
`expiresIn: '365d'` (verificar que o `signAsync` foi chamado com essa opção via stub); retorna
`{ token, user, expiresInDays: 365 }`. Stubar `jwt.signAsync`, `users`, `departments`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --require ts-node/register/transpile-only --test src/modules/auth/auth.service.spec.ts` (em `packages/api`)
Expected: FAIL (método não existe).

- [ ] **Step 4: Implementar `issueKioskToken`**

Em `auth.service.ts`:

```typescript
async issueKioskToken(dto: CreateKioskTokenDto): Promise<KioskTokenResponse> {
  const department = await this.departments.findById(dto.departmentId);
  if (!department) throw new NotFoundException('Departamento não encontrado');

  const slug = dto.label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const email = `totem-${slug}@kiosk.local`;

  // Upsert idempotente do User kiosk (nunca faz login por senha — hash aleatório inutilizável).
  const randomHash = await bcrypt.hash(randomUUID(), 10);
  const user = await this.users.upsertKiosk({
    email,
    name: dto.label.trim(),
    departmentId: dto.departmentId,
    passwordHash: randomHash,
  });

  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
  const token = await this.jwt.signAsync(payload, { expiresIn: '365d' });
  return { token, user: toUserPublic(user), expiresInDays: 365 };
}
```

Adicionar em `UsersRepository` um `upsertKiosk({ email, name, departmentId, passwordHash })` que faz
`prisma.user.upsert` por `email`, com `create` setando `role: 'USER'`, `isKiosk: true`,
`mustChangePassword: false`, e `update` apenas `{ name, departmentId }` (não regravar hash em user
existente). Injetar `DepartmentsRepository`/`randomUUID`/`bcrypt` no `AuthService` conforme o padrão.

- [ ] **Step 5: Controller**

Em `auth.controller.ts`:

```typescript
@Post('kiosk-token')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
@Roles('ADMIN')
issueKioskToken(@Body() dto: CreateKioskTokenDto) {
  return this.auth.issueKioskToken(dto);
}
```

(Conferir os imports de guards/decorators já usados no projeto — mesmo conjunto do
`tickets.controller.ts`.)

- [ ] **Step 6: Rodar teste (verde) + build**

Run: `npm run db:generate -w @chamados/api && npm run build -w @chamados/api && npm test -w @chamados/api`
Expected: teste do kiosk verde; build limpo; suíte com número real.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/modules/auth packages/api/src/modules/users/users.repository.ts
git commit -m "feat(api): POST /auth/kiosk-token (admin) emite JWT de vida longa p/ user kiosk"
```

---

### Task 3: Backend — captura de `originLocation` no `create()`

**Files:**
- Modify: `packages/api/src/modules/tickets/dto/create-ticket.dto.ts`
- Modify: `packages/api/src/modules/tickets/tickets.service.ts`, `tickets.repository.ts`
- Test: `packages/api/src/modules/tickets/tickets.service.spec.ts`

**Interfaces:**
- Consumes: `AuthUser.isKiosk` (já existe no `AuthUser`).
- Produces: ticket com `originLocation` gravado só p/ solicitante kiosk.

- [ ] **Step 1: DTO ganha `originLocation`**

Em `create-ticket.dto.ts`, adicionar:

```typescript
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originLocation?: string;
```

- [ ] **Step 2: Teste (falhando)**

Em `tickets.service.spec.ts`: (a) `create()` como kiosk (`user.isKiosk=true`) **sem** `originLocation`
→ `BadRequestException`; (b) kiosk **com** `originLocation` → passa o valor a `createWithHistory`;
(c) usuário comum enviando `originLocation` → o valor passado ao repo é `null` (ignorado). Ajustar o
stub `makeService`/`AuthUser` para carregar `isKiosk`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -w @chamados/api`
Expected: FAIL nos casos novos.

- [ ] **Step 4: Implementar**

Em `tickets.service.ts` `create()`, antes de montar o insert:

```typescript
// originLocation: só de solicitante kiosk (totem). Usuário comum não define origem.
let originLocation: string | null = null;
if (user.isKiosk) {
  const loc = dto.originLocation?.trim();
  if (!loc) throw new BadRequestException('Informe o local/sala de origem');
  originLocation = loc;
}
```

Passar `originLocation` para `createWithHistory` (novo campo no input) e, no e-mail, trocar o
`originLocation: null` fixo por essa variável. Em `tickets.repository.ts` `createWithHistory`,
aceitar `originLocation: string | null` no input e gravar `originLocation` no `tx.ticket.create`.

- [ ] **Step 5: Rodar (verde) + build**

Run: `npm run build -w @chamados/api && npm test -w @chamados/api`
Expected: verde, número real.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/modules/tickets
git commit -m "feat(api): create() captura originLocation só de solicitante kiosk (totem)"
```

---

### Task 4: Frontend — página do totem (`/totem`) + provisionamento

**Files:**
- Create: `packages/web/src/lib/blocks.ts`
- Modify: `packages/web/src/pages/NewTicketPage.tsx` (usar `buildBlocks` do lib novo — DRY)
- Create: `packages/web/src/pages/TotemPage.tsx`
- Modify: `packages/web/src/App.tsx` (rota pública `/totem`)
- Modify: `packages/web/src/features/tickets/api.ts` (`originLocation` no input de criação)

**Interfaces:**
- Consumes: `useCategories`/`useDepartments` (token do kiosk na chave padrão), `setToken` (`lib/api`).
- Produces: rota `/totem` funcional.

- [ ] **Step 1: Extrair `buildBlocks` para `lib/blocks.ts` (DRY)**

Mover a função pura `buildBlocks(categories, departments)` do `NewTicketPage.tsx` para
`packages/web/src/lib/blocks.ts` e exportá-la; importar de volta no `NewTicketPage`. Assinatura
idêntica. Adicionar um parâmetro opcional de filtro para o totem:

```typescript
export function buildBlocks(
  categories: CategoryWithSubcategories[],
  departments: Department[],
  exclude?: (d: Department) => boolean,
): { id: number; name: string }[] {
  const withDept = new Set(
    categories.map((c) => c.departmentId).filter((d): d is number => d != null),
  );
  return departments
    .filter((d) => withDept.has(d.id) && !(exclude?.(d) ?? false))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ id: d.id, name: d.name }));
}
```

`NewTicketPage` chama `buildBlocks(categories, departments)` (sem exclude).

- [ ] **Step 2: `originLocation` no hook de criação**

Em `features/tickets/api.ts`, garantir que o input de criação (usado pelo `useCreateTicket`/POST)
aceite `originLocation` (via `CreateTicketInput` do shared, já com o campo — Task 1). Sem lógica
extra: o totem passa `originLocation` no payload.

- [ ] **Step 3: `TotemPage`**

Criar `packages/web/src/pages/TotemPage.tsx`:
- **Provisionamento (concreto):** no mount, ler `?token=` da URL; se presente, `setToken(token)` e
  **recarregar sem a query** com `window.location.replace(window.location.origin + '/totem')`. O
  `auth-context` já busca `/users/me` no mount quando há token (`auth/auth-context.tsx`), então após
  o reload o `useAuth()` carrega o **user kiosk**. Se, com `loading=false`, `getToken()` for nulo ou
  `useAuth().user` for nulo (token inválido/revogado) → renderizar "Totem não configurado — contate a
  TI" e parar. **Não** criar endpoint novo — `/users/me` já existe e o `auth-context` já o usa.
- **Fluxo** (estado local, sem header/menu, tela cheia, botões grandes, tema grená, mobile-first):
  1. `local` (input texto) — obrigatório, botão "Continuar" desabilitado se vazio.
  2. Setor: `buildBlocks(categories, departments, (d) => d.name === 'TI')` → `BlockCard`s.
  3. Categoria (filtrada pelo setor) → Subcategoria → Detalhe opcional (igual ao `NewTicketPage`,
     reusando `BlockCard`/`CategoryIcon`).
  4. Descrição opcional (textarea) → "Concluir".
  5. Enviar `POST /tickets` com `{ categoryId, subcategoryId, detailOptionId?, description?,
     originLocation: local, departmentId: user.departmentId }`, onde `user = useAuth().user` (o user
     kiosk carregado via `/users/me`). O `departmentId` do DTO é satisfeito pelo do próprio user
     kiosk (o serviço deriva/sobrescreve para USER de qualquer forma, como no `NewTicketPage`).
  6. Confirmação "Chamado registrado, obrigado" + reset automático (timer ~8s) ou toque → volta ao
     passo 1 limpando tudo.

- [ ] **Step 4: Rota pública em `App.tsx`**

Adicionar, **fora** do wrapper `<Private>`:

```tsx
<Route path="/totem" element={<TotemPage />} />
```

- [ ] **Step 5: Build do web**

Run: `npm run build -w @chamados/shared && npm run build -w @chamados/web`
Expected: limpo.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/blocks.ts packages/web/src/pages/NewTicketPage.tsx packages/web/src/pages/TotemPage.tsx packages/web/src/App.tsx packages/web/src/features/tickets/api.ts
git commit -m "feat(web): rota /totem (kiosk) com fluxo de abertura e provisionamento por token"
```

---

### Task 5: Frontend — painel admin para gerar o token do totem

**Files:**
- Create: `packages/web/src/features/totem/api.ts` (hook `useCreateKioskToken`)
- Create: `packages/web/src/pages/admin/TotemAdminPage.tsx`
- Modify: `packages/web/src/App.tsx` (rota `/admin/totem`, adminOnly) + link no menu admin (onde os outros links admin ficam)

**Interfaces:**
- Consumes: `CreateKioskTokenInput`/`KioskTokenResponse` (shared), `useDepartments`.
- Produces: UI admin para emitir token.

- [ ] **Step 1: Hook**

`features/totem/api.ts`:

```typescript
import { useMutation } from '@tanstack/react-query';
import { CreateKioskTokenInput, KioskTokenResponse } from '@chamados/shared';
import { api } from '@/lib/api';

export function useCreateKioskToken() {
  return useMutation({
    mutationFn: async (input: CreateKioskTokenInput) =>
      (await api.post<KioskTokenResponse>('/auth/kiosk-token', input)).data,
  });
}
```

- [ ] **Step 2: Página admin**

`pages/admin/TotemAdminPage.tsx`: form com `label` (input) + `departmentId` (dropdown de
`useDepartments()`), botão "Gerar token". Ao ter resposta, mostrar:
- o **token** (campo somente-leitura + "Copiar"),
- a **URL de provisionamento** `${window.location.origin}/totem?token=<token>` (+ "Copiar"),
- instrução ("Abra esta URL uma vez no dispositivo do totem") e aviso de segredo/revogação.
Reusar `components/ui` (Card/Button/Input/Select) e o tema. Mobile-first.

- [ ] **Step 3: Rota + link no menu admin**

Em `App.tsx`, adicionar `<Route path="/admin/totem" element={<Private adminOnly><TotemAdminPage /></Private>} />`.
Adicionar o link "Totem" na navegação admin (mesmo lugar de Usuários/Setores/Relatórios/Backup —
localizar o componente de menu e seguir o padrão).

- [ ] **Step 4: Build do web**

Run: `npm run build -w @chamados/web`
Expected: limpo.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/features/totem packages/web/src/pages/admin/TotemAdminPage.tsx packages/web/src/App.tsx packages/web/src/components
git commit -m "feat(web): painel admin para gerar o token do totem (URL de provisionamento)"
```

---

### Task 6: Memória & documentação

**Files:**
- Create: `docs/memory/decisions/totem-kiosk-auth.md`
- Modify: `docs/memory/architecture/business-rules.md`, `docs/memory/README.md`
- Modify: `docs/projeto/07-operacao-deploy.md` (provisionar um totem)
- Create: `docs/memory/handoffs/sessao-2026-07-07-totem-plano4.md`

- [ ] **Step 1: Decisão** `totem-kiosk-auth.md` (User `isKiosk` + JWT 365d admin-emitido; revogação
  por exclusão do user; referencia `auth-jwt.md`; sem role nova).
- [ ] **Step 2: business-rules** (fluxo do totem, `originLocation` só de kiosk, setores sem TI).
- [ ] **Step 3: ops-deploy** — seção curta "Provisionar um totem" (gerar em `/admin/totem` → abrir a
  URL no dispositivo). **README** indexa decisão + handoff (preservar Unicode).
- [ ] **Step 4: Handoff** `sessao-2026-07-07-totem-plano4.md` (contexto, decisões, commits,
  verificação com número real, pendências: 12 setores sem categoria; smoke do Fabio).
- [ ] **Step 5: Commit** `docs(memory): Plano 4 (totem) — decisão, business-rules, ops e handoff`.

---

### Task 7: Verificação final

- [ ] **Step 1:** `npm run db:generate -w @chamados/api && npm run build -w @chamados/shared && npm run build -w @chamados/api && npm run build -w @chamados/web` — limpos.
- [ ] **Step 2:** `npm test -w @chamados/api` — `NN/NN` (anotar).
- [ ] **Step 3 (smoke, banco no ar — Fabio):** admin em `/admin/totem` gera token → abrir
  `/totem?token=…` → fluxo Local → Setor (sem TI) → Categoria → Subcategoria → Concluir; conferir o
  chamado com `originLocation` preenchido, roteado ao setor da categoria; usuário comum enviando
  `originLocation` → ignorado. Reportar falha/pulo explicitamente.

---

## Self-Review

**Spec coverage:**
- §2.1 emissão admin (JWT 365d, upsert kiosk, revogação por exclusão) → Task 2. ✔
- §2.2 originLocation só de kiosk (400 se vazio; ignorado p/ comum) → Task 3. ✔
- §3.1 rota /totem pública + provisionamento por `?token=` → Task 4. ✔
- §3.2 UI kiosk (Local → Setor sem TI → Categoria → … → confirmação/reset) → Task 4. ✔
- §3.3 painel admin gerar token + URL → Task 5. ✔
- Tipos shared → Task 1. Memória/ops → Task 6. Verificação → Task 7. ✔

**Placeholder scan:** código concreto nos steps; a dependência do `departmentId` do payload está
resolvida (reusa `useAuth().user`, carregado via o `/users/me` já existente — sem endpoint novo).
Sem TBD.

**Type consistency:** `CreateKioskTokenInput`/`KioskTokenResponse` idênticos entre shared (Task 1),
backend (Task 2) e web (Task 5). `originLocation?: string` idêntico entre DTO (Task 3), shared (Task
1) e o payload do totem (Task 4). `buildBlocks(..., exclude?)` idêntico entre `lib/blocks.ts`,
`NewTicketPage` e `TotemPage`.
