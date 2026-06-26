# 02 — Arquitetura

## Monorepo (NPM workspaces)

```
chamados/
├── packages/
│   ├── shared/   @chamados/shared  — tipos e enums compartilhados (TS)
│   ├── api/      @chamados/api      — backend NestJS + Prisma
│   └── web/      @chamados/web      — frontend React + Vite
├── docs/         documentação (memory/ + projeto/ + superpowers/)
├── docker-compose.yml  PostgreSQL
└── package.json  scripts raiz (dev, build, db:*)
```

`@chamados/shared` é a **fonte única de verdade** de tipos e enums (`Role`, `TicketStatus`,
`Priority`, `Complexity`, DTOs de entrada/saída). API e web importam dele — evita divergência
de contrato entre back e front. Roda em watch durante `npm run dev`.

## Backend — camadas (NestJS)

Cada feature é um **módulo** com responsabilidade única:

```
packages/api/src/
├── main.ts                 bootstrap (prefixo global /api, CORS, ValidationPipe)
├── app.module.ts           registra todos os módulos + ScheduleModule
├── prisma/                 PrismaService (conexão única) + PrismaModule
├── common/
│   ├── decorators/         @CurrentUser, @Roles
│   └── guards/             JwtAuthGuard, RolesGuard
└── modules/
    ├── auth/               login, primeiro acesso, estratégia JWT
    ├── users/              CRUD usuários, troca/definição de senha
    ├── departments/        CRUD departamentos
    ├── tickets/            chamados, comentários, anexos, prioridade
    ├── reports/            relatório de atividade por usuário
    ├── vault/              cofre criptográfico de anexos
    └── backup/             dump agendado do banco
```

**Padrão de cada módulo:** `controller` (rotas + validação) → `service` (regras de negócio) →
`repository` (wrapper fino sobre o Prisma). DTOs validados com `class-validator`.

- `PrismaService` é injetável e único (conexão compartilhada).
- `repository.ts` não reimplementa o ORM — só encapsula as queries.
- Lógica de prioridade isolada em `PriorityService` (DRY/SOLID) — ver
  [05 — Funcionalidades](05-funcionalidades.md) e `business-rules.md`.

### Autenticação e autorização (guards)

- **`JwtAuthGuard`** valida o token Bearer e injeta `AuthUser { userId, email, role }`.
- **`RolesGuard`** + decorator `@Roles('ADMIN')` restringem rotas. Sem `@Roles`, basta estar
  autenticado.
- A **visibilidade de chamados por perfil** é aplicada no service/repository (filtro por role),
  nunca confiando só no front.

## Frontend — estrutura (React + Vite)

```
packages/web/src/
├── main.tsx                bootstrap React + QueryClient
├── App.tsx                 rotas (react-router) + ProtectedRoute
├── auth/                   AuthContext (login, primeiro acesso, refreshUser, logout)
├── layouts/AppShell.tsx    casca (sidebar/header, nav, engrenagem, VaultBanner)
├── pages/                  telas (Login, Dashboard, NewTicket, TicketDetail, admin/*)
├── features/               chamadas de API por domínio (TanStack Query hooks)
│   └── {tickets,users,departments,reports,backup,vault}/api.ts
├── components/             UI reutilizável (ui/*, badges, anexos, VaultBanner...)
└── lib/                    api (axios), cn, labels, queryClient
```

- **Estado de servidor** via TanStack Query (cache, invalidação, polling de não-lidos).
- **Sessão** em `localStorage` (`chamados.user`, `chamados.token`).
- **`ProtectedRoute`** redireciona para `/login` se não autenticado e para `/change-password`
  enquanto `mustChangePassword` for verdadeiro.

## Fluxo de dados (request típico)

```
React page → features/*/api.ts (axios c/ Bearer) → /api/... (Nest controller)
   → guard (JWT + role) → service (regra) → repository → Prisma → PostgreSQL
   ← DTO (tipos de @chamados/shared) ← ... ← TanStack Query (cache) ← UI
```

## Comunicação back ↔ front

- Prefixo global da API: **`/api`** (ex.: `http://localhost:3000/api`).
- CORS liberado para a origem do front (`CORS_ORIGIN`, default `http://localhost:5173`).
- Anexos **não** têm URL pública: são servidos por rota autenticada que decifra sob demanda
  (ver [06 — Segurança](06-seguranca.md)).
