# Database Architecture

## Engine
PostgreSQL

## Entidades Core (MVP)

### users
| Coluna        | Tipo         | Notas                        |
|---------------|--------------|------------------------------|
| id            | UUID         | PK                           |
| name          | VARCHAR(255) |                              |
| email         | VARCHAR(255) | UNIQUE                       |
| password_hash | VARCHAR(255) |                              |
| role          | ENUM         | 'admin' | 'user'             |
| department_id | UUID         | FK → departments             |
| created_at    | TIMESTAMP    |                              |
| updated_at    | TIMESTAMP    |                              |

### departments
| Coluna       | Tipo         | Notas                         |
|--------------|--------------|-------------------------------|
| id           | UUID         | PK                            |
| name         | VARCHAR(100) | UNIQUE                        |
| priority_weight | INTEGER   | Peso do depto no cálculo      |
| created_at   | TIMESTAMP    |                               |

### tickets
| Coluna         | Tipo         | Notas                                  |
|----------------|--------------|----------------------------------------|
| id             | UUID         | PK                                     |
| title          | VARCHAR(255) |                                        |
| description    | TEXT         |                                        |
| complexity     | ENUM         | NULLABLE — definida na triagem pelo admin. 'low' \| 'medium' \| 'high' \| 'critical' |
| department_id  | UUID         | FK → departments (do solicitante)      |
| priority       | ENUM         | NULLABLE — calculada só após triagem. 'low' \| 'medium' \| 'high' \| 'urgent' |
| status         | ENUM         | 'triage' (default) \| 'open' \| 'in_progress' \| 'resolved' \| 'closed' |
| requester_id   | UUID         | FK → users                             |
| assigned_to    | UUID         | FK → users (nullable; SEMPRE um admin) |
| last_activity_at | TIMESTAMP  | Denormalização p/ notificação (última atividade) |
| last_activity_by | UUID       | nullable — autor da última atividade (status/comentário) |
| created_at     | TIMESTAMP    |                                        |
| updated_at     | TIMESTAMP    |                                        |
| resolved_at    | TIMESTAMP    | nullable                               |

### ticket_status_history
| Coluna       | Tipo      | Notas                                   |
|--------------|-----------|-----------------------------------------|
| id           | UUID      | PK                                      |
| ticket_id    | UUID      | FK → tickets                            |
| from_status  | ENUM      | status anterior (nullable na abertura)  |
| to_status    | ENUM      | novo status                             |
| changed_by   | UUID      | FK → users (quem mudou)                 |
| created_at   | TIMESTAMP |                                         |

### ticket_comments
| Coluna       | Tipo      | Notas                          |
|--------------|-----------|--------------------------------|
| id           | UUID      | PK                             |
| ticket_id    | UUID      | FK → tickets                   |
| author_id    | UUID      | FK → users                     |
| body         | TEXT      |                                |
| created_at   | TIMESTAMP |                                |

### ticket_attachments
Imagens/prints anexados a um chamado (na abertura) ou a um comentário. Arquivo físico fica em disco (`packages/api/uploads/<uuid>.<ext>`), servido estático em `/api/uploads/<arquivo>`; a tabela guarda só metadados.
| Coluna        | Tipo      | Notas                                                |
|---------------|-----------|------------------------------------------------------|
| id            | UUID      | PK                                                   |
| ticket_id     | UUID      | FK → tickets (ON DELETE CASCADE)                     |
| comment_id    | UUID      | FK → ticket_comments (nullable; ON DELETE CASCADE). NULL = anexo de nível do chamado |
| filename      | TEXT      | nome físico aleatório (uuid) no disco                |
| original_name | TEXT      | nome original do upload                              |
| mime          | TEXT      | só imagens (png/jpeg/gif/webp)                       |
| size          | INTEGER   | bytes (máx 5 MB, até 5 por upload)                   |
| created_at    | TIMESTAMP |                                                      |

### ticket_read_state
Marca quando cada usuário viu cada chamado (base da notificação por não-lido).
| Coluna       | Tipo      | Notas                                  |
|--------------|-----------|----------------------------------------|
| id           | UUID      | PK                                     |
| user_id      | UUID      | FK → users                             |
| ticket_id    | UUID      | FK → tickets (ON DELETE CASCADE)       |
| last_seen_at | TIMESTAMP | atualizado ao abrir o detalhe          |
|              |           | UNIQUE(user_id, ticket_id)             |

Regra de não-lido (`hasUnread`): `last_activity_by != usuário` E (`sem read_state` OU `last_activity_at > last_seen_at`). Calculada no service; exposta em `GET /tickets` (por item) e `GET /tickets/unread/count` (total, consumido por polling no front).

## Regra de Prioridade
`priority = f(complexity, department.priority_weight)` via matriz fixa.
- Lógica centralizada no backend (`PriorityService`), nunca no banco
- Matriz completa e faixas de peso em `architecture/business-rules.md`
- Cores: verde (low), amarelo (medium), vermelho (high), roxo (urgent)
- STATUS da matriz: APROVADA (2026-06-25)

## Índices Previstos
- tickets(status, priority) — listagem filtrada
- tickets(requester_id) — meus chamados
- tickets(assigned_to) — chamados atribuídos
- ticket_status_history(ticket_id) — timeline do chamado
- ticket_comments(ticket_id) — thread do chamado
- ticket_read_state(user_id) + UNIQUE(user_id, ticket_id) — notificação
- ticket_attachments(ticket_id) + ticket_attachments(comment_id) — anexos por chamado/comentário
- users(email) — login
