# 04 — Referência da API

- **Base URL:** `/api` (ex.: `http://localhost:3000/api`)
- **Auth:** todas as rotas exigem `Authorization: Bearer <token>`, exceto `POST /auth/login` e
  `POST /auth/first-access`.
- **Permissão:** "ADMIN" = exige perfil admin (`@Roles('ADMIN')`); "Autenticado" = qualquer
  usuário logado. Filtros por dono (USER só vê os seus) são aplicados no service.
- **Validação:** corpo validado por DTO (`class-validator`). IDs de rota são UUID
  (`ParseUUIDPipe`) — formato inválido retorna 400.

## Auth — `/auth`

| Método | Rota | Permissão | Corpo | Retorno |
|--------|------|-----------|-------|---------|
| POST | `/auth/login` | Público | `{ email, password }` | `{ token, user }` |
| POST | `/auth/first-access` | Público | `{ email, newPassword (≥6) }` | `{ token, user }` |

`first-access` só funciona se o usuário existe **e** `mustChangePassword = true`; caso contrário
retorna 401 ("E-mail não encontrado ou primeiro acesso já realizado"). Conclui a definição da
senha e já autentica.

## Usuários — `/users`

| Método | Rota | Permissão | Corpo / Notas |
|--------|------|-----------|---------------|
| GET | `/users/me` | Autenticado | dados públicos do usuário atual (inclui `mustChangePassword`) |
| POST | `/users/me/password` | Autenticado | `{ currentPassword, newPassword }` — troca a própria senha |
| GET | `/users` | ADMIN | lista usuários |
| POST | `/users` | ADMIN | cria usuário (nasce com `mustChangePassword = true`) |
| PATCH | `/users/:id` | ADMIN | atualiza; se admin define senha, marca `mustChangePassword = true` |
| DELETE | `/users/:id` | ADMIN | exclui; bloqueia auto-exclusão e usuários com referências (FK) |

Troca de senha valida a atual (`bcrypt.compare`) → 400 "Senha atual incorreta" se errada.

## Departamentos — `/departments`

| Método | Rota | Permissão | Notas |
|--------|------|-----------|-------|
| GET | `/departments` | Autenticado | lista |
| POST | `/departments` | ADMIN | `{ name, priorityWeight }` |
| DELETE | `/departments/:id` | ADMIN | bloqueia se houver usuários ou chamados vinculados |

## Chamados — `/tickets`

| Método | Rota | Permissão | Corpo / Notas |
|--------|------|-----------|---------------|
| POST | `/tickets` | Autenticado | `{ title, description, departmentId, requesterId? }` — admin pode abrir em nome de outro (`requesterId`) |
| GET | `/tickets` | Autenticado | lista (USER só os seus); aceita filtros via query |
| GET | `/tickets/unread/count` | Autenticado | `{ count }` de não-lidos (badge/polling) |
| GET | `/tickets/:id` | Autenticado/dono | detalhe com comentários, anexos e histórico |
| PATCH | `/tickets/:id` | ADMIN | `{ complexity?, departmentId? }` — triagem; recalcula prioridade e move `TRIAGE → OPEN` |
| PATCH | `/tickets/:id/status` | ADMIN | `{ status }` |
| PATCH | `/tickets/:id/assign` | ADMIN | `{ assignedTo }` |
| POST | `/tickets/:id/comments` | Autenticado/dono | `{ body }` — **bloqueado p/ USER se status RESOLVED/CLOSED** (403) |

### Anexos de chamado

| Método | Rota | Permissão | Notas |
|--------|------|-----------|-------|
| POST | `/tickets/:id/attachments` | Autenticado/dono | multipart `files` (até 5, 5MB cada, só imagens) + `commentId?`. Exige **cofre desbloqueado** (senão 423) |
| GET | `/tickets/:id/attachments/:attachmentId` | Autenticado/dono | streaming da imagem **decifrada** (`Content-Disposition: inline`, `Cache-Control: private, no-store`). Exige cofre desbloqueado |

## Cofre de anexos — `/vault`

| Método | Rota | Permissão | Corpo | Retorno |
|--------|------|-----------|-------|---------|
| GET | `/vault/status` | Autenticado | — | `{ status: UNINITIALIZED \| LOCKED \| UNLOCKED }` |
| POST | `/vault/unlock` | ADMIN | `{ password }` | `{ status }` (1º uso define a senha-mestra) |
| POST | `/vault/lock` | ADMIN | — | `{ status }` |

Senha-mestra incorreta → 401. Ver [06 — Segurança](06-seguranca.md).

## Relatórios — `/reports`

| Método | Rota | Permissão | Query |
|--------|------|-----------|-------|
| GET | `/reports/user-activity` | ADMIN | `userId` (uuid), `from?`, `to?` (datas ISO) |

Retorna a atividade de um usuário (chamados abertos, mudanças de status, comentários) no período,
com os anexos relacionados — base do relatório imprimível em PDF.

## Backup — `/backup`

| Método | Rota | Permissão | Retorno |
|--------|------|-----------|---------|
| GET | `/backup` | ADMIN | `{ directory, items: [{ filename, size, createdAt }] }` |
| POST | `/backup/run` | ADMIN | `{ filename, size }` — gera um dump agora |

Backup automático diário às 02:00 (cron). Ver [07 — Operação e deploy](07-operacao-deploy.md).

## Códigos de status relevantes

| Código | Quando |
|--------|--------|
| 400 | DTO inválido, UUID malformado, "Senha atual incorreta" |
| 401 | Sem token / token inválido / senha-mestra incorreta / first-access indevido |
| 403 | Sem permissão de role; USER comentando em chamado concluído |
| 423 | Cofre bloqueado (upload/visualização de anexo) |
