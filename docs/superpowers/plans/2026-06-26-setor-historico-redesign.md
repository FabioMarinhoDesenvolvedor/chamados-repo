# Setor na Sessão + Histórico + Redesign Grená — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Travar o setor do chamado ao setor do usuário (USER), confirmar que o histórico já está coberto, e aplicar o redesign grená (nova paleta + ícones lucide-react + layout coeso).

**Architecture:** Monorepo NPM (api NestJS + Prisma, web React/Vite/Tailwind, shared). Regra de setor reforçada no service de tickets (fonte de verdade = banco). Redesign concentrado nos tokens centralizados do Tailwind + componentes `ui` + AppShell.

**Tech Stack:** TypeScript strict, NestJS, Prisma/PostgreSQL, React 18, TanStack Query, Tailwind, lucide-react.

## Global Constraints

- Mobile-first, viewport mínimo 375px; componente sem responsividade = incompleto.
- TypeScript strict; arquivos kebab-case; tokens de cor centralizados no `tailwind.config.js` (DRY).
- Não há repositório git nem infra de testes automatizados no projeto; verificação = build dos 3 pacotes + teste manual (curl/UI). Não criar framework de testes nesta entrega.
- ADMIN tem acesso total (pode abrir chamado para qualquer setor); a trava de setor vale só para USER.
- Paleta nova exata: `grena` `#6D1F3A`, `grena-dark` `#5A1830`, `grena-light` `#8A2E4C`, `surface` `#F7F7F7`, branco `#FFFFFF`.

---

### Task 1: Backend — travar setor do USER no `create()`

**Files:**
- Modify: `packages/api/src/modules/tickets/tickets.service.ts:27-37`

**Interfaces:**
- Consumes: `this.users.findById(id)` → `User | null` (tem `departmentId: string | null`, `role`); `this.departments.findById(id)`; `AuthUser { userId, role }`.
- Produces: `create(dto, user)` com setor forçado ao do USER.

- [ ] **Step 1: Reescrever `create()` para forçar o setor do USER**

Em `tickets.service.ts`, substituir o método `create` por:

```ts
  async create(dto: CreateTicketDto, user: AuthUser) {
    // Fonte de verdade do setor: USER abre sempre no próprio setor (sessão/banco);
    // ADMIN tem acesso total e pode escolher o setor via dto.
    let departmentId = dto.departmentId;
    if (user.role === 'USER') {
      const requester = await this.users.findById(user.userId);
      if (!requester?.departmentId) {
        throw new BadRequestException('Seu usuário não tem setor; contate a TI');
      }
      departmentId = requester.departmentId;
    }

    const department = await this.departments.findById(departmentId);
    if (!department) throw new NotFoundException('Departamento não encontrado');

    return this.repo.createWithHistory({
      title: dto.title,
      description: dto.description,
      departmentId,
      requesterId: user.userId,
    });
  }
```

`BadRequestException` já está importado (linha 1-6). Nenhum import novo.

- [ ] **Step 2: Build da API**

Run: `npm run build -w @chamados/api`
Expected: build sem erros de tipo.

- [ ] **Step 3: Verificação manual (com a stack no ar)**

Logar como USER (`user@chamados.local` / `senha123`), pegar token, e tentar forjar outro setor:

```bash
curl -s -X POST localhost:3000/api/tickets \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Teste setor","description":"forjando setor","departmentId":"<UUID_DE_OUTRO_SETOR>"}'
```
Expected: chamado criado com `departmentId` = setor do USER (RH), **ignorando** o UUID forjado. Conferir no corpo da resposta.

---

### Task 2: Frontend — `NewTicketPage` trava setor para USER

**Files:**
- Modify: `packages/web/src/pages/NewTicketPage.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ user: UserPublic | null }` (`user.departmentId: string | null`, `user.role`); `useDepartments()` → `Department[]`.
- Produces: formulário que envia `departmentId` = setor do USER (somente-leitura) ou seleção livre para ADMIN.

- [ ] **Step 1: Reescrever `NewTicketPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { useDepartments } from '@/features/departments/api';
import { useCreateTicket } from '@/features/tickets/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function NewTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: departments } = useDepartments();
  const createTicket = useCreateTicket();
  const isAdmin = user?.role === 'ADMIN';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');

  const userDeptName =
    departments?.find((d) => d.id === user?.departmentId)?.name ?? '';
  const userHasNoDept = !isAdmin && !user?.departmentId;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    // USER sempre usa o próprio setor (o backend também força isso).
    const dept = isAdmin ? departmentId : user?.departmentId ?? '';
    try {
      const ticket = await createTicket.mutateAsync({ title, description, departmentId: dept });
      navigate(`/tickets/${ticket.id}`);
    } catch {
      setError('Não foi possível abrir o chamado. Verifique os dados.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-grena-dark">Novo chamado</h2>
        <p className="text-sm text-gray-500">Descreva o problema com clareza</p>
      </div>
      <Card className="p-6">
        {userHasNoDept ? (
          <p className="text-sm text-red-600">
            Seu usuário não tem setor cadastrado. Contate a equipe de TI para abrir chamados.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div>
              <Label htmlFor="department">Setor</Label>
              {isAdmin ? (
                <Select
                  id="department"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {departments?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input id="department" value={userDeptName} readOnly disabled />
              )}
              {!isAdmin && (
                <p className="mt-1 text-xs text-gray-500">
                  O chamado é aberto no seu setor.
                </p>
              )}
            </div>
            <p className="text-xs text-gray-500">
              A complexidade e a prioridade serão definidas pela equipe de TI na triagem.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={createTicket.isPending}>
                {createTicket.isPending ? 'Abrindo...' : 'Abrir chamado'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/')}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build do web**

Run: `npm run build -w @chamados/web`
Expected: build sem erros.

- [ ] **Step 3: Verificação manual**

Logado como USER: a tela mostra "Setor" como campo travado com o nome do setor (RH) e o texto "O chamado é aberto no seu setor"; não há `<select>`. Logado como ADMIN: o `<select>` de setor aparece normalmente.

---

### Task 3: Redesign — nova paleta nos tokens do Tailwind

**Files:**
- Modify: `packages/web/tailwind.config.js`

**Interfaces:**
- Produces: tokens `grena/grena-dark/grena-light`, `surface`, `shadow-grena`, `bg-grena-gradient` na paleta nova (consumidos por todas as telas).

- [ ] **Step 1: Atualizar `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        grena: { DEFAULT: '#6D1F3A', dark: '#5A1830', light: '#8A2E4C' },
        surface: '#F7F7F7',
      },
      boxShadow: {
        grena: '0 8px 20px -6px rgba(109, 31, 58, 0.20)',
      },
      backgroundImage: {
        'grena-gradient': 'linear-gradient(135deg, #6D1F3A, #5A1830)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Build do web**

Run: `npm run build -w @chamados/web`
Expected: build sem erros; cores grená agora `#6D1F3A`/`#5A1830`.

---

### Task 4: Redesign — suavizar `Card` (remover glass)

**Files:**
- Modify: `packages/web/src/components/ui/card.tsx`

**Interfaces:**
- Produces: `Card` branco sólido + borda sutil + sombra leve (mesma assinatura/props).

- [ ] **Step 1: Atualizar `card.tsx`**

```tsx
import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-gray-100 bg-white shadow-grena', className)}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Build do web**

Run: `npm run build -w @chamados/web`
Expected: build sem erros.

---

### Task 5: Redesign — instalar lucide-react e trocar ícones do `AppShell`

**Files:**
- Modify: `packages/web/package.json` (dependência)
- Modify: `packages/web/src/layouts/AppShell.tsx`

**Interfaces:**
- Consumes: ícones de `lucide-react` (componentes React de SVG).
- Produces: `NAV` com `icon` sendo um componente de ícone; sidebar/header usando ícones SVG no lugar dos emojis.

- [ ] **Step 1: Instalar lucide-react**

Run: `npm install lucide-react -w @chamados/web`
Expected: `lucide-react` adicionado às dependências do web.

- [ ] **Step 2: Trocar emojis por ícones em `AppShell.tsx`**

No topo, ajustar imports e o tipo de `icon`:

```tsx
import { ReactNode, useState, ComponentType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Users,
  Building2,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/auth/auth-context';
import { useUnreadCount } from '@/features/tickets/api';
import { Button } from '@/components/ui/button';
import { ROLE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  badge?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, badge: true },
  { to: '/tickets/new', label: 'Novo chamado', icon: Plus },
  { to: '/admin/users', label: 'Usuários', icon: Users, adminOnly: true },
  { to: '/admin/departments', label: 'Departamentos', icon: Building2, adminOnly: true },
];
```

No botão de colapsar (linha ~55-63), trocar o conteúdo do `<button>`:

```tsx
            >
              {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
```

No render de cada item (bloco `<span className="relative text-lg leading-none">`), trocar o emoji pelo componente. Substituir:

```tsx
              <span className="relative text-lg leading-none">
                {i.icon}
                {showBadge && collapsed && (
```
por:
```tsx
              <span className="relative leading-none">
                {(() => {
                  const Icon = i.icon;
                  return <Icon className="h-5 w-5" />;
                })()}
                {showBadge && collapsed && (
```

No botão "Sair" (linha ~99-108), trocar o conteúdo do `<Button>`:

```tsx
            onClick={logout}
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
```

No header mobile (linha ~116), trocar o botão `☰`:

```tsx
        <button aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <Menu className="h-6 w-6" />
        </button>
```

- [ ] **Step 3: Build do web**

Run: `npm run build -w @chamados/web`
Expected: build sem erros; sidebar e header usam ícones SVG.

- [ ] **Step 4: Verificação manual**

UI logada: sidebar com ícones (Dashboard, Novo chamado, Usuários, Departamentos, Sair) em SVG; botão de colapsar com chevron; menu mobile com ícone hambúrguer. Badge de não-lido continua aparecendo.

---

### Task 6: Redesign — trocar emoji "✓ Concluir" no Dashboard por ícone

**Files:**
- Modify: `packages/web/src/pages/DashboardPage.tsx:1-13` (import) e `:31-33` (botão)

**Interfaces:**
- Consumes: `Check` de `lucide-react`.

- [ ] **Step 1: Adicionar import e trocar o rótulo do botão**

No topo do arquivo, adicionar:
```tsx
import { Check } from 'lucide-react';
```

No `ConcludeButton`, trocar:
```tsx
        ✓ Concluir
```
por:
```tsx
        <Check className="mr-1 h-4 w-4" /> Concluir
```

- [ ] **Step 2: Build do web**

Run: `npm run build -w @chamados/web`
Expected: build sem erros.

---

### Task 7: Atualizar memória do projeto

**Files:**
- Modify: `docs/memory/decisions/ui-theme-grena.md`
- Modify: `docs/memory/architecture/frontend.md`
- Create: `docs/memory/handoffs/sessao-2026-06-26-bloco6.md`

- [ ] **Step 1: Atualizar `ui-theme-grena.md`**

Atualizar a seção "Decisão" para a paleta nova: `grena` `#6D1F3A`, `grena-dark` `#5A1830`, `grena-light` `#8A2E4C`, `surface` `#F7F7F7`. Registrar a mudança de direção: menos "glass/blur" (cards brancos sólidos com borda sutil), ícones `lucide-react` no lugar de emojis. Manter a data 2026-06-26 e adicionar nota "revisão de paleta (Bloco 6)".

- [ ] **Step 2: Atualizar `frontend.md`**

Na seção "Identidade visual", trocar os hex antigos pelos novos e a menção a "cards glass" por "cards brancos sólidos + borda sutil + sombra leve"; registrar `lucide-react` como biblioteca de ícones.

- [ ] **Step 3: Criar handoff Bloco 6**

Registrar: trava de setor (USER no service + NewTicketPage), confirmação de que o histórico já estava coberto (sem mudança), e o redesign (paleta nova, Card sólido, ícones lucide-react). Listar verificação (builds OK + testes manuais).

- [ ] **Step 4: Atualizar `docs/memory/README.md`** se o novo handoff precisar de índice.

---

## Verificação Final

- [ ] `npm run build -w @chamados/shared && npm run build -w @chamados/api && npm run build -w @chamados/web` — todos OK.
- [ ] USER abre chamado: setor travado na UI; API ignora `departmentId` forjado.
- [ ] ADMIN abre chamado para qualquer setor.
- [ ] Dashboard mostra resolvidos/fechados (já coberto; só conferir).
- [ ] Revisão visual: paleta `#6D1F3A`, cards sólidos, ícones SVG, mobile ≥375px.
