# 08 — Frontend

React 18 + Vite 6 (SPA), Tailwind CSS, TanStack Query, react-router, axios, lucide-react.

## Estrutura

```
packages/web/src/
├── main.tsx                React + QueryClientProvider
├── App.tsx                 rotas + ProtectedRoute + AppShell
├── auth/auth-context.tsx   sessão (login, firstAccess, refreshUser, logout)
├── layouts/AppShell.tsx    casca: sidebar/header, nav, engrenagem, VaultBanner
├── pages/                  telas
│   ├── LoginPage.tsx           login + modo "Primeiro acesso"
│   ├── DashboardPage.tsx       lista/KPIs de chamados
│   ├── NewTicketPage.tsx       abrir chamado (+ anexos, + solicitante p/ admin)
│   ├── TicketDetailPage.tsx    detalhe + timeline + comentários + anexos
│   ├── ChangePasswordPage.tsx  troca/definição de senha
│   └── admin/                  UsersPage, DepartmentsPage, ReportsPage, BackupPage
├── features/{dominio}/api.ts   hooks TanStack Query por domínio
├── components/                 UI (ui/*, badges, anexos, VaultBanner...)
└── lib/                        api (axios), cn, labels, queryClient
```

## Rotas (`App.tsx`)

| Rota | Página | Acesso |
|------|--------|--------|
| `/login` | LoginPage | público |
| `/` | DashboardPage | autenticado |
| `/tickets/new` | NewTicketPage | autenticado |
| `/tickets/:id` | TicketDetailPage | autenticado/dono |
| `/change-password` | ChangePasswordPage | autenticado |
| `/admin/users` | UsersPage | ADMIN |
| `/admin/departments` | DepartmentsPage | ADMIN |
| `/admin/reports` | ReportsPage | ADMIN |
| `/admin/backup` | BackupPage | ADMIN |
| `*` | redireciona para `/` | — |

`ProtectedRoute` cuida de: sem sessão → `/login`; `adminOnly` sem ser admin → bloqueia;
`mustChangePassword` → força `/change-password`.

## Navegação (`AppShell.tsx`)

- Sidebar com gradiente grená + logo do clube; recolhível (estado em `localStorage`
  `sidebar-collapsed`); header próprio no mobile.
- Itens: Dashboard, Novo chamado, e (admin) Usuários, Departamentos, Relatórios, Backup.
- Rodapé: atalho **⚙ Configurações** (→ troca de senha) e **Sair**.
- Badge de não-lidos no Dashboard (via `useUnreadCount`).
- `VaultBanner` aparece no topo do conteúdo (admin desbloqueia o cofre; demais veem aviso).
- `print:hidden` em header/aside para relatórios saírem limpos.

## Camada de dados

- **`lib/api.ts`** — instância axios (baseURL `/api`, injeta Bearer) + helper `apiMessage(err,
  fallback)` que extrai mensagens de erro do backend (incl. arrays de validação).
- **`features/*/api.ts`** — hooks TanStack Query (`useQuery`/`useMutation`) com chaves de cache e
  invalidação por domínio (tickets, users, departments, reports, backup, vault).
- Sessão em `localStorage`; `AuthContext` expõe `user`, `login`, `firstAccess`, `refreshUser`,
  `logout`.

## Componentes notáveis

| Componente | Função |
|-----------|--------|
| `AttachmentInput` | anexar imagens: clique + Ctrl+V + arrastar-e-soltar (≤5, 5MB, só imagens) |
| `AttachmentThumb` | busca a imagem **autenticada** (blob) e renderiza thumb clicável |
| `AttachmentGallery` | grade de thumbs de um chamado/comentário |
| `VaultBanner` | desbloqueio do cofre (admin) / aviso (demais) |
| `StatusBadge` / `PriorityBadge` | selos coloridos de status e prioridade |
| `PriorityBarChart` / `KpiCard` | indicadores no dashboard |
| `ui/*` | primitivos (button, input, select, textarea, card, label, badge) |

## Design

- Tema **grená** via tokens Tailwind (`grena`, `grena-dark`, `grena-gradient`, `surface`).
- Mobile-first (mínimo 375px); ícones lucide-react.
- Logo/identidade do **Clube Atlético Juventus**; favicon e título do app configurados em
  `index.html` (`CHAMADOS - CLUBE ATLÉTICO JUVENTUS`).
