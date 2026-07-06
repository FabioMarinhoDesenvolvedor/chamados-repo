# 07 — Operação e deploy

## Pré-requisitos

- Node.js ≥ 20
- Docker (PostgreSQL roda em container)

## Setup local

```bash
npm install              # workspaces resolvem tudo
docker compose up -d     # sobe o PostgreSQL (container chamados-db)

# API: ajuste packages/api/.env se necessário (ver variáveis abaixo)
npm run db:generate      # gera o Prisma Client
npm run db:migrate       # aplica migrations (dev: nomeia a 1ª, ex.: init)
npm run db:seed          # popula departamentos + usuários + chamados de exemplo

npm run dev              # sobe shared (watch) + api + web
```

- API: http://localhost:3000/api
- Web: http://localhost:5173

### Usuários de exemplo (seed)

| Perfil | E-mail | Senha |
|--------|--------|-------|
| admin | admin@chamados.local | senha123 |
| user | user@chamados.local | senha123 |

> Usuários do seed têm `mustChangePassword = false`. Usuários novos criados pelo admin nascem
> com troca de senha obrigatória no primeiro acesso.

## Scripts (raiz)

| Script | O que faz |
|--------|-----------|
| `npm run dev` | shared (watch) + api + web (concurrently) |
| `npm run build` | build de shared, api e web |
| `npm run db:generate` | gera o Prisma Client |
| `npm run db:migrate` | migrations do Prisma |
| `npm run db:seed` | dados de desenvolvimento |
| `npm run format` | Prettier |

## Variáveis de ambiente (`packages/api/.env`)

| Variável | Default (dev) | Função |
|----------|---------------|--------|
| `DATABASE_URL` | `postgresql://chamados:chamados@localhost:5432/chamados?schema=public` | conexão Postgres |
| `JWT_SECRET` | `dev-secret-change-me` | assinatura do JWT (**trocar em produção**) |
| `JWT_EXPIRES_IN` | `1d` | validade do token |
| `PORT` | `3000` | porta da API |
| `CORS_ORIGIN` | `http://localhost:5173` | origem liberada para o front |
| `ATTACHMENTS_DIR` | `../../../chamados-anexos` (fora do projeto) | pasta do **cofre** de anexos cifrados |
| `BACKUP_DIR` | `../../../chamados-backups` (fora do projeto) | pasta dos backups |
| `BACKUP_KEEP` | `14` | quantos backups manter |
| `BACKUP_DOCKER_CONTAINER` | `chamados-db` | container onde roda o `pg_dump` |
| `PG_DUMP_PATH` | `pg_dump` | caminho do binário (se não usar Docker) |
| `SMTP_HOST` | *(vazio)* | host SMTP para notificação por e-mail; **sem valor = modo STUB** (só loga, não envia) |
| `SMTP_PORT` | `587` | porta do servidor SMTP |
| `SMTP_USER` | *(vazio)* | usuário de autenticação SMTP |
| `SMTP_PASS` | *(vazio)* | senha de autenticação SMTP |
| `SMTP_FROM` | `chamados@clube.local` | remetente do e-mail de notificação |
| `APP_URL` | *(vazio)* | URL base do sistema, usada no link do chamado (`${APP_URL}/tickets/:id`) dentro do e-mail |

> Para anexos e backups ficarem **fora do servidor** de verdade, aponte `ATTACHMENTS_DIR` e
> `BACKUP_DIR` para um drive de rede / disco externo / pasta sincronizada.

## Backup do banco

Implementado em `modules/backup/backup.service.ts`.

- **O que gera:** um dump SQL completo do banco, comprimido com gzip —
  `chamados-AAAA-MM-DD-HH-mm-ss.sql.gz`. É a "query enorme" que recria o banco do zero.
- **Automático:** cron `@Cron('0 2 * * *')` — todos os dias às **02:00**. **Requer a API ligada**
  no horário.
- **Sob demanda:** tela admin **Backup → "Backup agora"** (`pages/admin/BackupPage.tsx`,
  `POST /backup/run`).
- **Retenção:** mantém os últimos `BACKUP_KEEP` (default 14) e apaga os mais antigos.
- **Postgres em Docker:** como o banco roda no container `chamados-db` (sem `pg_dump` no host), o
  dump é executado via `docker exec -e PGPASSWORD=... chamados-db pg_dump ...`. Controlado por
  `BACKUP_DOCKER_CONTAINER`. Se o Postgres for nativo, deixe essa variável vazia e use
  `PG_DUMP_PATH`.
- O dump usa `--no-owner --no-privileges` (restauração portátil).

### Restaurar um backup

```bash
gunzip -c chamados-AAAA-MM-DD.sql.gz | psql "<DATABASE_URL>"
```

Com Postgres em Docker, é possível canalizar para dentro do container:

```bash
gunzip -c chamados-AAAA-MM-DD.sql.gz | docker exec -i chamados-db psql -U chamados -d chamados
```

> O `.sql.gz` **não é criptografado** — guarde-o em volume seguro (ver [06](06-seguranca.md)).
> Se a máquina costuma ficar desligada de madrugada, o cron interno não dispara; nesse caso use o
> Agendador de Tarefas do Windows chamando `POST /backup/run` (ou um script com `pg_dump`).

## Build de produção (resumo)

```bash
npm run build
# api: node packages/api/dist/main.js  (com .env de produção)
# web: servir packages/web/dist/ por um servidor estático / CDN
```

Checklist de produção: HTTPS; `JWT_SECRET` forte; senha do Postgres forte; `ATTACHMENTS_DIR` e
`BACKUP_DIR` em armazenamento externo/seguro; senha-mestra do cofre guardada à parte; processo da
API supervisionado (PM2/systemd/serviço) para o cron de backup rodar às 02:00.

## Runbook — problemas comuns

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Upload/visualização de anexo retorna **423** | Cofre bloqueado | Admin desbloqueia no `VaultBanner` (`POST /vault/unlock`) |
| Anexos "indisponíveis" após reiniciar API | Cofre voltou a LOCKED | Desbloquear de novo com a senha-mestra |
| `prisma generate` falha com **EPERM** (Windows) | nest watch trava a DLL do engine | Parar todos os processos node, depois `generate` |
| `migrate dev` quer **resetar** o banco | drift / migration alterada | Usar `prisma migrate deploy` (não-destrutivo) |
| Backup falha "pg_dump não encontrado" | Postgres em Docker | Definir `BACKUP_DOCKER_CONTAINER=chamados-db` |
| Backup automático não acontece | API desligada às 02:00 | Manter a API supervisionada ou agendar externamente |
| Primeiro acesso "e-mail não encontrado" | usuário já trocou a senha | Login normal; se esqueceu, admin redefine (volta a exigir troca) |
