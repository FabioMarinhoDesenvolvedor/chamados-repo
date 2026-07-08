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

## Deploy de produção — release 2026-07-07 (SLA de dois tempos + IDs inteiros + fluxo multi-setorial)

> **Execução é do Fabio, no srv-alv01** (bare-metal Debian 12, systemd, sem Docker em produção).
> Este runbook é a ordem exata; o código já está na `main` (origin atualizado).

**O que esta release entrega:** SLA de dois tempos (resposta + conclusão), **IDs inteiros
sequenciais** (UUID → Int em todas as tabelas), fluxo guiado com **passo de setor** e fila por setor,
notificação por e-mail (outbox), e o dado de referência (15 setores + árvore de categorias).

### ⚠️ Atenção crítica — migrations consolidadas
Esta release **substituiu todo o histórico de migrations** por um baseline único
(`20260707130000_init`) + uma migration de dados de referência (`20260707130100_seed_referencia`).
Consequência para o `_prisma_migrations` do banco de produção:

- **Caso A — banco de prod nunca migrado (fresco/vazio):** `db:deploy` aplica as 2 migrations
  limpo. Segue o passo a passo normal abaixo.
- **Caso B — banco de prod com o histórico ANTIGO (UUID) já registrado:** `db:deploy` **falha**
  (`migrations recorded in the database but not found locally`). Como **não há dado real a
  preservar** (decisão de design — nada relevante foi deployado), a resolução é um **reset total**:
  `npx prisma migrate reset --force` (dropa tudo, aplica as 2 migrations). **É destrutivo —
  confirme que prod não tem dado a preservar antes.** Faça um backup (`POST /backup/run` ou
  `pg_dump`) antes, por garantia.

Descobrir o caso: `npx prisma migrate status` no servidor (aponta migrations "recorded but not
found locally" = Caso B).

### Passos (no srv-alv01)
```bash
git pull origin main
npm ci                                   # instala deps novas (nodemailer, @nestjs/schedule) já no package.json

# 1) Configurar envs de produção em packages/api/.env:
#    DATABASE_URL (prod), JWT_SECRET forte, APP_URL (ex.: https://chamados.juventus.com.br),
#    SMTP_HOST/PORT/USER/PASS/FROM (sem SMTP_HOST => e-mail em STUB, só loga).

npm run db:generate -w @chamados/api     # gera o Prisma Client (offline)

# 2) Aplicar o schema + dado de referência (escolher conforme o caso acima):
npm run db:deploy -w @chamados/api       # Caso A (banco fresco)
#   OU, Caso B (histórico antigo, sem dado):  npx prisma migrate reset --force
#   (o reset já roda o seed de DEV; em prod prefira db:deploy + seed:admin — ver nota)

npm run db:seed:admin -w @chamados/api   # cria/garante o admin de prod (ADMIN_EMAIL, default ti@juventus.com.br)
                                         # senha definida no PRIMEIRO ACESSO (first-access)

npm run build                            # shared → api → web (nesta ordem)

# 3) Reiniciar o serviço e servir o front:
sudo systemctl restart chamados-api      # (ajustar o nome real do unit)
#    servir packages/web/dist/ pelo nginx/estático; garantir CORS_ORIGIN/APP_URL coerentes
```

> **Dado de referência (setores + categorias):** vem da migration `20260707130100_seed_referencia`
> (aplicada por `db:deploy`/`reset`) — **não** depende do seed de dev. O `db:seed` (dev) cria só
> admin/user de exemplo + chamados fake e **não deve rodar em produção**; em prod use `db:seed:admin`.

### Smoke pós-deploy
- Login do admin → primeiro acesso define a senha.
- Abrir um chamado → **id inteiro sequencial** (1, 2, …); o fluxo mostra o **passo de setor**.
- Se `SMTP_HOST` setado num setor com `notificationEmail`: e-mail chega com link `${APP_URL}/tickets/<n>`.
- Operador de um setor só vê a fila do próprio setor ("Fila — <setor>").

## Provisionar um totem

O totem é um dispositivo fixo (tablet/terminal) que abre chamados sem login manual — ver
`decisions/totem-kiosk-auth.md` na memória do projeto.

1. Um **admin** acessa **Admin → Totem** (`/admin/totem`), informa um rótulo (ex.: "Totem
   Portaria") e o setor/departamento do solicitante, e gera o token.
2. A tela mostra a URL `${origin}/totem?token=<jwt>` (com botão Copiar). Abra essa URL **uma
   única vez** no navegador do próprio dispositivo — ela grava o token e recarrega a página em
   `/totem`, deixando o totem autenticado por até 365 dias.
   > **Atenção:** abrir `/totem?token=…` num navegador que já tem uma sessão logada **sobrescreve o
   > login atual** (a chave `chamados.token` é compartilhada entre login humano e totem). Use um
   > **dispositivo/navegador dedicado** ao totem, nunca o navegador do dia a dia de alguém.
3. **Revogação (limitação conhecida do MVP):** apagar o `User` do totem (e-mail
   `totem-<rótulo>@kiosk.local`) **não funciona** depois que ele já abriu algum chamado — a
   exclusão é bloqueada (409) porque o usuário é solicitante desses chamados. Para invalidar um
   token vazado hoje, é preciso **rotacionar `JWT_SECRET`** (invalida TODOS os tokens do sistema —
   todo mundo reautentica — e depois re-emitir os tokens de cada totem). Revogação por-totem sem
   afetar os demais usuários é um follow-up (versão de token por usuário kiosk).
4. Reemitir o token do mesmo rótulo faz **upsert** do mesmo usuário (não duplica) — isso **não**
   revoga o token anterior (ambos continuam válidos até expirar); use para trocar de setor ou
   renovar antes do vencimento.

## Runbook — problemas comuns

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| `migrate deploy` falha: *migrations recorded in DB not found locally* | Histórico antigo no `_prisma_migrations` após o squash (Caso B) | Sem dado real: `prisma migrate reset --force` (backup antes). Ver "Deploy 2026-07-07". |
| Upload/visualização de anexo retorna **423** | Cofre bloqueado | Admin desbloqueia no `VaultBanner` (`POST /vault/unlock`) |
| Anexos "indisponíveis" após reiniciar API | Cofre voltou a LOCKED | Desbloquear de novo com a senha-mestra |
| `prisma generate` falha com **EPERM** (Windows) | nest watch trava a DLL do engine | Parar todos os processos node, depois `generate` |
| `migrate dev` quer **resetar** o banco | drift / migration alterada | Usar `prisma migrate deploy` (não-destrutivo) |
| Backup falha "pg_dump não encontrado" | Postgres em Docker | Definir `BACKUP_DOCKER_CONTAINER=chamados-db` |
| Backup automático não acontece | API desligada às 02:00 | Manter a API supervisionada ou agendar externamente |
| Primeiro acesso "e-mail não encontrado" | usuário já trocou a senha | Login normal; se esqueceu, admin redefine (volta a exigir troca) |
