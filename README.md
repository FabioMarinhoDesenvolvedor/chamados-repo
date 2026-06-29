<div align="center">

# 🎫 CHAMADOS — Clube Atlético Juventus

**Sistema interno de chamados (tickets) de TI** — abertura, triagem, atendimento e histórico completo, com anexos de imagem criptografados, relatórios e backup automático do banco.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

---

## 📑 Índice

- [Visão geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Stack & versões](#-stack--versões)
- [Arquitetura](#-arquitetura)
- [Ciclo de vida de um chamado](#-ciclo-de-vida-de-um-chamado)
- [Regras de negócio](#-regras-de-negócio)
- [Pré-requisitos](#-pré-requisitos)
- [Setup rápido](#-setup-rápido)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Scripts](#-scripts)
- [Referência da API](#-referência-da-api)
- [Modelo de dados](#-modelo-de-dados)
- [Estrutura de pastas](#-estrutura-de-pastas)
- [Operação & deploy](#-operação--deploy)
- [Documentação interna](#-documentação-interna)

---

## 🎯 Visão geral

Os colaboradores abrem solicitações descrevendo um problema (podendo anexar prints), e a equipe de
TI faz a **triagem**, define a **complexidade**, atende e conclui — com histórico completo de status,
comentários e anexos. São **dois perfis**: `USER` (abre e acompanha os próprios) e `ADMIN` (acesso
total). A prioridade nunca é digitada: é **calculada** por uma matriz fixa (complexidade × peso do
departamento).

| Termo | Significado |
|-------|-------------|
| **Chamado / Ticket** | Solicitação aberta por um usuário |
| **Triagem** | Etapa em que o admin classifica a complexidade |
| **Complexidade** | `LOW · MEDIUM · HIGH · CRITICAL` — definida pelo admin |
| **Prioridade** | `LOW · MEDIUM · HIGH · URGENT` — **calculada**, nunca digitada |
| **Cofre (vault)** | Área cujos anexos ficam cifrados (AES-256-GCM) |
| **Senha-mestra** | Senha do cofre, só em memória, **nunca persistida** |

---

## ✨ Funcionalidades

### Chamados
- 📝 Abertura simples (título, descrição, departamento) — o usuário **não** escolhe prioridade.
- 🔍 **Triagem pelo admin**: define a complexidade → o sistema calcula a prioridade e move
  `TRIAGE → OPEN` automaticamente (registrado no histórico).
- 👀 **Visibilidade por perfil**: `USER` vê só os próprios chamados; `ADMIN` vê todos.
- 🏷️ Atribuição de responsável (`assign`) — sempre um admin.
- 💬 **Acompanhamento unificado**: histórico de status + comentários numa única timeline.
- 🔔 **Notificação por não-lido (polling)**: badge no menu + marcador na lista (atualização a cada 20s).
- ✅ Conclusão com um clique (`RESOLVED`) no dashboard ou no detalhe.

### Anexos de imagem (cofre criptografado)
- 🖼️ Anexar imagens na **abertura** e em **comentários** (PNG/JPG/GIF/WEBP, até 5 MB, 5 por upload).
- 🔐 Arquivos gravados **cifrados** (AES-256-GCM) numa pasta **externa** ao repositório; servidos
  apenas por **endpoint autenticado** (não há URL pública).
- 🔑 A chave deriva de uma **senha-mestra** (scrypt) que **nunca é persistida** — fica só em memória
  até o servidor reiniciar. Sem o cofre desbloqueado, não dá para anexar nem visualizar.

### Administração
- 👥 **Gestão de usuários**: criar, editar (nome/e-mail/perfil/departamento), redefinir senha, remover.
- 🏢 **Departamentos**: cadastro com `priority_weight` (peso no cálculo de prioridade).
- 📊 **Relatórios de atividade**: trilha por usuário e período (aberturas, mudanças de status e
  comentários), agrupada por mês, com **impressão / exportação em PDF**.
- 💾 **Backup do banco**: dump SQL comprimido (`.sql.gz`), manual ou **automático às 02:00** (cron),
  com retenção configurável, gravado **fora do servidor**.

### Acesso & segurança
- 🔒 **Autenticação JWT stateless** (Passport).
- 🚦 **Autorização por perfil** via guards (`JwtAuthGuard` + `RolesGuard`).
- 🔁 **Primeiro acesso**: usuário criado pelo admin entra com `mustChangePassword` e é obrigado a
  trocar a senha antes de usar o sistema.
- #️⃣ Senhas com **bcrypt**.

### Experiência
- 📱 **Mobile-first** (mínimo 375px): sidebar vira drawer, tabelas viram cards.
- 🎨 Tema **grená** do Clube Atlético Juventus, ícones `lucide-react`, sidebar retrátil persistida.

---

## 🧱 Stack & versões

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Linguagem | TypeScript (strict) | `5.7` |
| Runtime | Node.js | `>= 20` |
| Monorepo | NPM workspaces | — |
| **Backend** | NestJS | `10.4` |
| | Prisma ORM | `6.2` |
| | Passport + JWT | `passport-jwt 4` / `@nestjs/jwt 10` |
| | bcryptjs | `2.4` |
| | Multer (upload) | `2.0` |
| | @nestjs/schedule (cron) | `6.1` |
| **Banco** | PostgreSQL | `16` (Docker `postgres:16-alpine`) |
| **Frontend** | React | `18.3` |
| | Vite | `6.0` |
| | React Router | `6.28` |
| | TanStack Query | `5.62` |
| | axios | `1.7` |
| | Tailwind CSS | `3.4` |
| | lucide-react (ícones) | `1.21` |
| **Cripto** | Node `crypto` (AES-256-GCM, scrypt) | nativo |

> Versão do produto: **1.0.0**.

---

## 🏗️ Arquitetura

Monorepo com três workspaces:

```
┌──────────────────────────────────────────────────────────────┐
│                     @chamados/shared                          │
│        (enums + tipos TypeScript — fonte única da verdade)    │
└──────────────────────────────────────────────────────────────┘
            ▲                                   ▲
   import (dist CJS)                    import (source TS via alias)
            │                                   │
┌───────────────────────┐          ┌───────────────────────────┐
│     @chamados/api      │  HTTP/   │      @chamados/web        │
│  NestJS + Prisma       │◀────────▶│  React + Vite (SPA)       │
│  REST /api  · JWT      │  JSON    │  TanStack Query · axios   │
└───────────┬───────────┘          └───────────────────────────┘
            │ Prisma
       ┌────▼─────┐   ┌──────────────┐   ┌──────────────────┐
       │ Postgres │   │ anexos (.enc)│   │ backups (.sql.gz)│
       │   16     │   │  cifrados    │   │  fora do repo    │
       └──────────┘   └──────────────┘   └──────────────────┘
```

> ⚠️ **Gotcha do `shared`**: a API consome o **`dist` CJS**; o front consome o **código-fonte TS**
> via alias do Vite/tsconfig (o Rollup não analisa o CJS estaticamente). Não emitir ESM no shared —
> a API CJS quebra. Detalhes em `docs/memory/gotchas/shared-cjs-rollup.md`.

---

## 🔄 Ciclo de vida de um chamado

```
            admin define              admin                admin            admin
            complexidade              atende                                arquiva
  TRIAGE ───────────────▶ OPEN ───────────────▶ IN_PROGRESS ──▶ RESOLVED ──▶ CLOSED
  (nasce aqui;                                                   (USER não
   priority/complexity                                            comenta mais)
   nulos)
```

1. **Abertura** — usuário informa título, descrição e departamento (admin pode abrir em nome de
   outro via `requesterId`). Nasce em **TRIAGE**, com `complexity` e `priority` nulos.
2. **Triagem** — admin define a complexidade → prioridade calculada → vai para **OPEN**.
3. **Atendimento** — admin atribui e avança o status; comentários e anexos formam a timeline.
4. **Conclusão** — **RESOLVED** / **CLOSED**. A partir daí o **USER não pode mais comentar**.

---

## 📐 Regras de negócio

### Perfis
- **USER** — abre e acompanha **apenas os próprios** chamados (`requester_id = usuário`).
- **ADMIN** (TI) — **acesso total**: vê todos, faz triagem, atribui, gerencia usuários/departamentos,
  gera relatórios e opera cofre/backup. `assigned_to` é sempre um admin.

### Cálculo de prioridade (matriz fixa)
Centralizado em `PriorityService` (nunca no banco). Faixas de `priority_weight`:
**Baixo = 1–2 · Médio = 3 · Alto = 4–5**.

| complexidade ↓ \ peso → | Baixo (1–2) | Médio (3) | Alto (4–5) |
|--------------------------|:-----------:|:---------:|:----------:|
| **LOW**                  | 🟢 low      | 🟢 low    | 🟡 medium  |
| **MEDIUM**               | 🟢 low      | 🟡 medium | 🔴 high    |
| **HIGH**                 | 🟡 medium   | 🔴 high   | 🟣 urgent  |
| **CRITICAL**             | 🔴 high     | 🟣 urgent | 🟣 urgent  |

> 🟢 low · 🟡 medium · 🔴 high · 🟣 urgent. Recalcula quando complexidade ou departamento mudam.

### Notificação por não-lido
`hasUnread` = última atividade **não foi feita pelo próprio usuário** **E** (sem registro de leitura
**OU** atividade mais recente que a última visualização). Exposto em `GET /tickets` (por item) e
`GET /tickets/unread/count` (total, consumido por polling no front).

---

## ✅ Pré-requisitos

- **Node.js >= 20**
- **Docker** (para o PostgreSQL) ou um PostgreSQL 16 local
- Para backup: `pg_dump` disponível (no container do Postgres ou no host)

---

## 🚀 Setup rápido

```bash
# 1. Instalar dependências (workspaces resolvem tudo)
npm install

# 2. Subir o banco (container chamados-db, postgres:16-alpine na 5432)
docker compose up -d

# 3. Configurar o .env da API
cp packages/api/.env.example packages/api/.env   # ajuste se necessário

# 4. Prisma: gerar client + aplicar migrations + popular dados de dev
npm run db:generate
npm run db:migrate        # primeira vez: nomeie a migration (ex.: init)
npm run db:seed           # departamentos + usuários + chamados de exemplo

# 5. Rodar tudo (shared watch + api + web) em modo dev
npm run dev
```

- 🔌 **API:** http://localhost:3000/api
- 🖥️ **Web:** http://localhost:5173

### 👤 Usuários de exemplo (seed)

| Perfil | E-mail                | Senha      |
|--------|-----------------------|------------|
| ADMIN  | `admin@chamados.local`| `senha123` |
| USER   | `user@chamados.local` | `senha123` |

---

## 🔧 Variáveis de ambiente

Arquivo: `packages/api/.env` (base em `.env.example`).

### Essenciais (já no `.env.example`)

| Variável | Default | Descrição |
|----------|---------|-----------|
| `DATABASE_URL` | `postgresql://chamados:chamados@localhost:5432/chamados?schema=public` | Conexão Postgres |
| `JWT_SECRET` | — | Segredo do JWT (**trocar em produção**) |
| `JWT_EXPIRES_IN` | `1d` | Validade do token |
| `PORT` | `3000` | Porta da API |
| `CORS_ORIGIN` | `http://localhost:5173` | Origem(ns) permitida(s), separadas por vírgula |

### Anexos & cofre / backup (opcionais — usam defaults se ausentes)

| Variável | Default | Descrição |
|----------|---------|-----------|
| `ATTACHMENTS_DIR` | `../../../chamados-anexos` | Pasta dos anexos cifrados (`.enc`), fora do repo |
| `BACKUP_DIR` | `../../../chamados-backups` | Pasta dos backups (`.sql.gz`), fora do repo |
| `BACKUP_KEEP` | `14` | Quantidade de backups mantidos (os mais antigos são removidos) |
| `PG_DUMP_PATH` | `pg_dump` | Caminho do `pg_dump` (quando roda direto no host) |
| `BACKUP_DOCKER_CONTAINER` | _(vazio)_ | Se setado, roda `pg_dump` via `docker exec` nesse container (ex.: `chamados-db`) |

> ⚠️ Hoje essas variáveis de anexos/backup **não constam** no `.env.example` — vale adicioná-las.

---

## 📜 Scripts

Na **raiz** (orquestram os workspaces):

| Script | O que faz |
|--------|-----------|
| `npm run dev` | sobe `shared` (watch) + `api` + `web` com cores |
| `npm run build` | build de `shared`, `api` e `web` |
| `npm run db:migrate` | migrations do Prisma (API) |
| `npm run db:seed` | popula dados de desenvolvimento |
| `npm run db:generate` | gera o Prisma Client |
| `npm run format` | Prettier em todo o repo |

Na **API** (`-w @chamados/api`): `db:deploy` (migrations em prod), `db:reset` (reset do banco),
`start:prod` (roda o `dist`).

---

## 🌐 Referência da API

Prefixo global **`/api`**. Salvo `GET /tickets/.../attachments/...` (binário), tudo é JSON.
Autenticação por **Bearer token**; `🔒 ADMIN` indica rota restrita a administradores.

### Auth `/api/auth`
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/auth/login` | Login → `{ token, user }` |
| `POST` | `/auth/first-access` | Troca de senha no primeiro acesso |

### Usuários `/api/users`
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/users/me` | Dados do usuário logado |
| `POST` | `/users/me/password` | Trocar a própria senha |
| `GET` | `/users` 🔒 | Listar usuários |
| `POST` | `/users` 🔒 | Criar usuário |
| `PATCH` | `/users/:id` 🔒 | Editar (nome/e-mail/perfil/depto/senha) |
| `DELETE` | `/users/:id` 🔒 | Remover usuário |

### Departamentos `/api/departments`
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/departments` | Listar departamentos |
| `POST` | `/departments` 🔒 | Criar departamento |
| `DELETE` | `/departments/:id` 🔒 | Remover departamento |

### Chamados `/api/tickets`
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/tickets` | Listar (filtrado por perfil) |
| `GET` | `/tickets/unread/count` | Total de não-lidos (badge) |
| `GET` | `/tickets/:id` | Detalhe + timeline + anexos |
| `POST` | `/tickets` | Abrir chamado |
| `PATCH` | `/tickets/:id` 🔒 | Triagem: complexidade/departamento (recalcula prioridade) |
| `PATCH` | `/tickets/:id/status` 🔒 | Mudar status |
| `PATCH` | `/tickets/:id/assign` 🔒 | Atribuir responsável |
| `POST` | `/tickets/:id/comments` | Comentar |
| `POST` | `/tickets/:id/attachments` | Enviar imagens (multipart `files`; `commentId` opcional) |
| `GET` | `/tickets/:id/attachments/:attachmentId` | Baixar imagem decifrada (autenticado) |

### Cofre `/api/vault`
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/vault/status` | `UNINITIALIZED` / `LOCKED` / `UNLOCKED` |
| `POST` | `/vault/unlock` 🔒 | Definir (1º uso) / desbloquear com senha-mestra |
| `POST` | `/vault/lock` 🔒 | Bloquear o cofre |

### Backup `/api/backup`
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/backup` 🔒 | Listar backups + pasta de destino |
| `POST` | `/backup/run` 🔒 | Gerar backup agora |

### Relatórios `/api/reports`
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/reports/user-activity` 🔒 | Trilha de atividades (`?userId&from&to`, datas `YYYY-MM-DD`) |

---

## 🗃️ Modelo de dados

Enums: `Role` (`ADMIN`/`USER`) · `Complexity` (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`) ·
`Priority` (`LOW`/`MEDIUM`/`HIGH`/`URGENT`) · `TicketStatus` (`TRIAGE`/`OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED`).

| Tabela | Papel |
|--------|-------|
| `users` | Usuários (perfil, departamento, `must_change_password`) |
| `departments` | Departamentos com `priority_weight` (1–5) |
| `tickets` | Chamados (status, complexidade/prioridade nullable, denormalização de última atividade) |
| `ticket_comments` | Comentários da timeline |
| `ticket_attachments` | Metadados dos anexos cifrados (chamado ou comentário; cascade) |
| `ticket_status_history` | Histórico de mudanças de status |
| `ticket_read_state` | Última visualização por usuário/chamado (base do não-lido) |

> Schema completo em `packages/api/prisma/schema.prisma`.
> ⚠️ **Gotcha Postgres**: adicionar valor de enum **e** usá-lo como DEFAULT na mesma migration falha
> (55P04) — separar em duas migrations. Veja `docs/memory/gotchas/postgres-enum-default.md`.

---

## 📁 Estrutura de pastas

```
chamados-repo/
├── packages/
│   ├── shared/              # enums + tipos (fonte única)
│   ├── api/                 # NestJS + Prisma
│   │   ├── prisma/          # schema, migrations, seed
│   │   └── src/
│   │       ├── common/      # guards, decorators
│   │       ├── modules/     # auth, users, departments, tickets,
│   │       │                #   reports, vault, backup
│   │       └── prisma/      # PrismaService
│   └── web/                 # React + Vite
│       └── src/
│           ├── components/  # UI + anexos
│           ├── features/    # api hooks por domínio
│           ├── layouts/     # AppShell (sidebar/header)
│           └── pages/       # rotas (incl. admin/)
├── docs/
│   ├── memory/              # decisões, gotchas, handoffs, arquitetura
│   └── projeto/             # documentação funcional
├── docker-compose.yml       # Postgres 16
└── CLAUDE.md                # instruções do projeto (Regra Zero)
```

---

## 🛠️ Operação & deploy

- **Migrations em produção**: `npm run db:deploy -w @chamados/api` (`prisma migrate deploy`).
- **Build**: `npm run build` gera `dist` de cada pacote; rode a API com `npm run start:prod -w @chamados/api`.
- **Volumes persistentes** (não versionados, fora do repo):
  - `ATTACHMENTS_DIR` — anexos cifrados (`.enc`). **Perder a senha-mestra = anexos irrecuperáveis.**
  - `BACKUP_DIR` — backups `.sql.gz`. Aponte para drive de rede/disco externo para ficar "fora do servidor".
- **Backup automático**: cron às **02:00** (requer a API ligada no horário). Restauração manual:
  ```bash
  gunzip -c chamados-AAAA-MM-DD-HH-MM-SS.sql.gz | psql "<DATABASE_URL>"
  ```
- **Cofre**: após cada reinício da API, um admin precisa **desbloquear** o cofre para anexos
  voltarem a funcionar (a senha-mestra não é persistida).

---

## 📚 Documentação interna

- **`CLAUDE.md`** — convenções, princípios e a **Regra Zero** (ler antes de codar).
- **`docs/memory/`** — decisões (`decisions/`), armadilhas (`gotchas/`), arquitetura
  (`architecture/`), procedimentos (`procedures/`) e handoffs de sessão (`handoffs/`).
- **`docs/projeto/`** — documentação funcional (visão geral, arquitetura, modelo de dados,
  referência de API, funcionalidades, segurança, deploy, frontend).

---

<div align="center">

**Clube Atlético Juventus** · Sistema interno de Chamados de TI · v1.0.0

</div>
