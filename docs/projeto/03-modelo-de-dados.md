# 03 — Modelo de dados

ORM **Prisma 6** sobre **PostgreSQL 16**. Schema em `packages/api/prisma/schema.prisma`.
Nomes de coluna em `snake_case` (via `@map`); nomes de tabela no plural (via `@@map`).

## Enums

| Enum | Valores |
|------|---------|
| `Role` | `ADMIN`, `USER` |
| `Complexity` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `Priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `TicketStatus` | `TRIAGE`, `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |

## Diagrama de relações

```
Department 1───* User
Department 1───* Ticket
User (requester) 1───* Ticket
User (assignee)  1───* Ticket        (assigned_to, opcional, sempre um ADMIN)
Ticket 1───* TicketComment
Ticket 1───* TicketAttachment        (anexos de nível-ticket: comment_id NULL)
TicketComment 1───* TicketAttachment (anexos de um comentário)
Ticket 1───* TicketStatusHistory
Ticket 1───* TicketReadState *───1 User   (unique [user, ticket])
```

## Tabelas

### `users`
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | string | |
| `email` | string unique | login |
| `password_hash` | string | bcrypt |
| `role` | Role | default `USER` |
| `must_change_password` | bool | default `true` — força troca no 1º acesso |
| `department_id` | uuid? | FK departments |
| `created_at` / `updated_at` | datetime | |

### `departments`
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | string unique | |
| `priority_weight` | int | 1–5; usado no cálculo de prioridade |
| `created_at` | datetime | |

### `tickets`
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `title`, `description` | string | |
| `complexity` | Complexity? | nulo até a triagem |
| `priority` | Priority? | nulo até a triagem (calculado) |
| `status` | TicketStatus | default `TRIAGE` |
| `department_id` | uuid | FK |
| `requester_id` | uuid | FK users (quem abriu) |
| `assigned_to` | uuid? | FK users (admin responsável) |
| `created_at` / `updated_at` / `resolved_at` | datetime | |
| `last_activity_at` / `last_activity_by` | datetime / uuid? | base do "não-lido" |

Índices: `[status, priority]`, `[requester_id]`, `[assigned_to]`.

### `ticket_comments`
`id`, `ticket_id` (FK cascade), `author_id` (FK), `body`, `created_at`. Índice em `ticket_id`.

### `ticket_attachments`
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `ticket_id` | uuid | FK cascade |
| `comment_id` | uuid? | FK cascade; **NULL = anexo do ticket**, preenchido = anexo do comentário |
| `filename` | string | nome do arquivo cifrado no cofre (ex.: `<uuid>.enc`) |
| `original_name` | string | nome original mostrado ao usuário |
| `mime` | string | só imagens |
| `size` | int | bytes |
| `created_at` | datetime | |

> O **conteúdo do arquivo não fica no banco nem no servidor** — só os metadados aqui. O binário
> cifrado vive na pasta do cofre, fora do projeto. Ver [06 — Segurança](06-seguranca.md).

### `ticket_status_history`
`id`, `ticket_id` (FK cascade), `from_status` (nullable — nulo = criação), `to_status`,
`changed_by` (FK), `created_at`. Base dos relatórios de "abriu/mudou status".

### `ticket_read_state`
`id`, `user_id` (FK), `ticket_id` (FK cascade), `last_seen_at`. Unique `[user_id, ticket_id]`.
Sustenta o badge de **não-lidos** (polling): há novidade se `last_activity_at > last_seen_at`.

## Migrations

Aplicadas em ordem (em `packages/api/prisma/migrations/`):

| Migration | O que faz |
|-----------|-----------|
| `..._init` | Schema inicial (users, departments, tickets, comments, history, read_state) |
| `..._add_triage_status` | Status `TRIAGE` no enum |
| `..._triage_and_notifications` | Triagem + campos de last_activity / read_state |
| `..._add_ticket_attachments` | Tabela `ticket_attachments` (+ índices e FKs) |
| `..._must_change_password` | Coluna `must_change_password` (default true; usuários existentes → false) |

### Regra de ouro das migrations

- **Nunca** edite uma migration já aplicada. Crie uma nova.
- Em ambiente com dados/drift pré-existente, aplique com **`prisma migrate deploy`**
  (não-destrutivo) — `migrate dev` pode querer **resetar/apagar** o banco.
- Para alterações pontuais, escreva o SQL à mão numa nova pasta de migration e rode `deploy`.

> **Gotcha (Windows):** ao rodar `prisma generate`, pare antes todos os processos node — o nest
> watch trava a DLL do query engine (erro EPERM). Ver `docs/memory/gotchas/`.
