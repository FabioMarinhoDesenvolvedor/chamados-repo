# Database Architecture

## Engine
PostgreSQL

## Estratégia atual de IDs
- PKs e FKs do domínio usam `Int`.
- PK padrão: `@id @default(autoincrement())`.
- Sequência começa em `1`.
- A exceção é `ticket_attachments.filename`, que continua UUID aleatório porque é nome físico
  de arquivo, não identificador de domínio.

## Entidades core

### users
| Coluna        | Tipo      | Notas              |
|---------------|-----------|--------------------|
| id            | INTEGER   | PK                 |
| name          | TEXT      |                    |
| email         | TEXT      | UNIQUE             |
| password_hash | TEXT      |                    |
| role          | ENUM      | ADMIN/USER/OPERATOR |
| department_id | INTEGER?  | FK -> departments  |
| created_at    | TIMESTAMP |                    |
| updated_at    | TIMESTAMP |                    |

### departments
| Coluna             | Tipo      | Notas                         |
|--------------------|-----------|-------------------------------|
| id                 | INTEGER   | PK                            |
| name               | TEXT      | UNIQUE                        |
| priority_weight    | INTEGER   | Peso do depto no cálculo      |
| is_requester_dept  | BOOLEAN   | origem de solicitantes        |
| is_executor_dept   | BOOLEAN   | destino de execução           |
| requires_approval  | BOOLEAN   | inerte hoje                   |
| notification_email | TEXT?     | notificação de setor          |
| created_at         | TIMESTAMP |                               |

### tickets
| Coluna                | Tipo      | Notas |
|-----------------------|-----------|-------|
| id                    | INTEGER   | PK |
| title                 | TEXT      | derivado da categorização no fluxo novo |
| description           | TEXT?     | descrição complementar opcional |
| category_id           | INTEGER?  | FK -> ticket_categories |
| subcategory_id        | INTEGER?  | FK -> ticket_subcategories |
| detail_option_id      | INTEGER?  | FK -> ticket_detail_options |
| complexity            | ENUM?     | derivada da categorização |
| priority              | ENUM?     | derivada de complexidade x peso |
| status                | ENUM      | TRIAGE/PENDING_APPROVAL dormentes; OPEN/IN_PROGRESS/RESOLVED/CLOSED vivos |
| department_id         | INTEGER   | setor do solicitante |
| executor_department_id| INTEGER?  | setor executor |
| requester_id          | INTEGER   | FK -> users |
| assigned_to           | INTEGER?  | FK -> users |
| last_activity_at      | TIMESTAMP | base do não-lido |
| last_activity_by      | INTEGER?  | autor da última atividade |
| created_at            | TIMESTAMP | |
| updated_at            | TIMESTAMP | |
| resolved_at           | TIMESTAMP?| |
| closed_at             | TIMESTAMP?| |
| sla_started_at        | TIMESTAMP?| |
| first_response_at     | TIMESTAMP?| |
| rating                | INTEGER?  | avaliação opcional do solicitante |

### ticket_categories · ticket_subcategories · ticket_detail_options
Dados de referência da categorização guiada.

| Tabela | PK | FKs |
|--------|----|-----|
| ticket_categories | id INTEGER | department_id INTEGER? |
| ticket_subcategories | id INTEGER | category_id INTEGER |
| ticket_detail_options | id INTEGER | subcategory_id INTEGER |

Observações:
- `slug` continua identificador estável de referência.
- `sort_order` continua controlando a exibição.
- `base_complexity` em subcategoria/detalhe alimenta a priorização automática.

### ticket_status_history
| Coluna      | Tipo      | Notas |
|-------------|-----------|-------|
| id          | INTEGER   | PK |
| ticket_id   | INTEGER   | FK -> tickets |
| from_status | ENUM?     | nullable na abertura |
| to_status   | ENUM      | novo status |
| changed_by  | INTEGER   | FK -> users |
| created_at  | TIMESTAMP | |

### ticket_comments
| Coluna     | Tipo      | Notas |
|------------|-----------|-------|
| id         | INTEGER   | PK |
| ticket_id  | INTEGER   | FK -> tickets |
| author_id  | INTEGER   | FK -> users |
| body       | TEXT      | |
| created_at | TIMESTAMP | |

### ticket_attachments
| Coluna        | Tipo      | Notas |
|---------------|-----------|-------|
| id            | INTEGER   | PK |
| ticket_id     | INTEGER   | FK -> tickets |
| comment_id    | INTEGER?  | FK -> ticket_comments |
| filename      | TEXT      | UUID físico no disco |
| original_name | TEXT      | nome original |
| mime          | TEXT      | só imagens |
| size          | INTEGER   | bytes |
| created_at    | TIMESTAMP | |

### ticket_read_state
| Coluna       | Tipo      | Notas |
|--------------|-----------|-------|
| id           | INTEGER   | PK |
| user_id      | INTEGER   | FK -> users |
| ticket_id    | INTEGER   | FK -> tickets |
| last_seen_at | TIMESTAMP | atualizado ao abrir detalhe |

Regra de não-lido (`hasUnread`):
- `last_activity_by != usuário`
- e (`sem read_state` ou `last_activity_at > last_seen_at`)

### notification_outbox
| Coluna     | Tipo      | Notas |
|------------|-----------|-------|
| id         | INTEGER   | PK |
| ticket_id  | INTEGER   | FK -> tickets |
| to_email   | TEXT      | destino |
| subject    | TEXT      | assunto |
| body       | TEXT      | corpo |
| status     | ENUM      | PENDING/SENT/FAILED |
| attempts   | INTEGER   | tentativas |
| last_error | TEXT?     | último erro |
| created_at | TIMESTAMP | |
| sent_at    | TIMESTAMP?| |

## Regra de prioridade
`priority = f(complexity, department.priority_weight)` via matriz fixa.
- Lógica centralizada no backend (`PriorityService`), nunca no banco.
- Matriz e faixas de peso em `architecture/business-rules.md`.

## Listagem e KPIs
- Paginação real em `GET /tickets` (`page`/`pageSize`, default 20).
- KPIs no servidor em `GET /tickets/stats`.
- Unread em `GET /tickets/unread/count` via anti-join raw.
- Listagem/detalhe/relatório usam `include` de categoria/subcategoria/detalhe.

## Índices previstos
- tickets(status, priority)
- tickets(category_id)
- tickets(subcategory_id)
- tickets(detail_option_id)
- tickets(requester_id)
- tickets(assigned_to)
- tickets(executor_department_id)
- ticket_subcategories(category_id) + UNIQUE(category_id, slug)
- ticket_detail_options(subcategory_id) + UNIQUE(subcategory_id, slug)
- ticket_status_history(ticket_id)
- ticket_comments(ticket_id)
- ticket_read_state(user_id) + UNIQUE(user_id, ticket_id)
- ticket_attachments(ticket_id)
- ticket_attachments(comment_id)
- users(email)

## Migrations
- O histórico UUID foi substituído por um baseline consolidado:
  `packages/api/prisma/migrations/20260707130000_init/migration.sql`
- Reset/migrate real do banco continua sendo papel do Fabio.
