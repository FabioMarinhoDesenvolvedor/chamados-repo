# Sessão 2026-06-27 — Documentação retroativa: Vault, Backup e Reports

> **Por que este handoff existe:** os módulos `vault`, `backup` e `reports` (API + Web) já
> estavam no código e nos docs de `docs/projeto/`, mas **nenhum handoff os cobria** (a trilha
> parava no Bloco 7 — anexos + branding). Este documento descreve o estado atual desses três
> módulos a partir da leitura do código, não de uma sessão de implementação nova.

---

## 1. Vault (cofre de anexos cifrados)

**Arquivos:** `modules/vault/{vault.service.ts, vault.controller.ts, vault.module.ts, dto/unlock-vault.dto.ts}`;
front `components/VaultBanner.tsx` + `features/vault/api.ts`.

### Como funciona
- **Cripto:** AES-256-GCM. A chave (32 bytes) é derivada via `scryptSync(senha, salt, 32)`.
  A **senha-mestra NUNCA é persistida** — fica só em memória (`private key: Buffer | null`) até o
  servidor reiniciar. Reiniciou → cofre volta a `LOCKED`.
- **Meta em disco:** `<attachmentsDir>/vault.meta.json` = `{ salt (hex), verifier (hex) }`, onde
  `verifier` é um SENTINEL fixo (`'chamados-vault-ok'`) cifrado. Validação da senha = decifrar o
  verifier e comparar com `timingSafeEqual`.
- **Status (`getStatus`):** `UNINITIALIZED` (sem meta) · `LOCKED` (tem meta, sem chave em memória)
  · `UNLOCKED` (chave carregada).
- **Primeiro `unlock`** cria a meta e DEFINE a senha-mestra. Os seguintes validam contra o verifier.
  `unlock` exige `MinLength(8)`.
- **Formato do blob cifrado:** `[iv(12) | authTag(16) | ciphertext]`. `seal()`/`open()`.
- Bloqueado → `assertUnlocked()` lança **HTTP 423 Locked**.

### Endpoints (`/api/vault`, `JwtAuthGuard` + `RolesGuard`)
- `GET /vault/status` — qualquer autenticado (a UI mostra o aviso).
- `POST /vault/unlock` `{ password }` — **ADMIN**. Primeiro uso define a senha.
- `POST /vault/lock` — **ADMIN**.

### Integração com anexos (mudança importante vs. Bloco 7)
O fluxo de anexos foi **reescrito** desde `decisions/anexos-imagens.md`:
- `attachments.config.ts` agora usa **`memoryStorage`** (o buffer chega à app para ser cifrado);
  não há mais `diskStorage`/`useStaticAssets`.
- `tickets.service.addAttachments()` → `vault.assertUnlocked()` **antes de gravar** (falha cedo
  com 423) → grava `<uuid>.enc` cifrado em `attachmentsDir()`.
- `tickets.service.getAttachmentFile()` decifra ao servir.
- **Anexos não são mais públicos.** `attachmentUrl()` aponta para o endpoint autenticado
  `GET /api/tickets/:id/attachments/:attachmentId`. No front, `AttachmentThumb` busca o blob com
  o token (`responseType: 'blob'`) e exibe via `URL.createObjectURL`.
- Pasta dos anexos: env **`ATTACHMENTS_DIR`** (default `../../../chamados-anexos`, fora do repo).

### Front
- `VaultBanner` (renderizado no `AppShell`): ADMIN define/desbloqueia; USER vê só "anexos
  indisponíveis". `useVaultStatus` faz polling de 60s; `useUnlockVault` invalida o status.

---

## 2. Backup (dump do banco)

**Arquivos:** `modules/backup/{backup.service.ts, backup.controller.ts, backup.module.ts}`;
front `pages/admin/BackupPage.tsx` + `features/backup/api.ts`. Rota web `/admin/backup` (adminOnly).

### Como funciona
- `pg_dump` (SQL puro, `--no-owner --no-privileges`) → `createGzip` → arquivo
  **`chamados-<YYYY-MM-DD-HH-MM-SS>.sql.gz`** em `directory()`.
- **Local:** env **`BACKUP_DIR`** (default `../../../chamados-backups`, fora do repo). Para ficar
  "fora do servidor", apontar para drive de rede/disco externo.
- **Dois modos de execução:**
  - Postgres em container (este projeto, `chamados-db`): env **`BACKUP_DOCKER_CONTAINER`** →
    roda `docker exec -e PGPASSWORD=... <container> pg_dump ...`.
  - Local: env **`PG_DUMP_PATH`** (default `pg_dump`), com `PGPASSWORD` no env do processo.
  - Credenciais/host/porta extraídos de `DATABASE_URL`.
- **Agendado:** `@Cron('0 2 * * *')` (todo dia 02:00) via `@nestjs/schedule`
  (`ScheduleModule.forRoot()` em `app.module.ts`). Exige API ligada no horário.
- **Retenção:** env **`BACKUP_KEEP`** (default 14) — `prune()` apaga os mais antigos.
- **Concorrência:** flag `running` → segundo backup simultâneo retorna **503**. Em falha, remove
  o arquivo `.sql.gz` parcial.

### Endpoints (`/api/backup`, **ADMIN**)
- `GET /backup` → `{ directory, items: [{ filename, size, createdAt }] }`.
- `POST /backup/run` → `{ filename, size }` (manual, "Backup agora").

### Front
- `BackupPage`: botão "Backup agora", aviso do cron das 02:00, exibe o `directory`, lista os
  backups e mostra o comando de restore: `gunzip -c chamados-*.sql.gz | psql "<DATABASE_URL>"`.
- **Não há download nem restore pelo front** — restauração é manual no servidor (por segurança).

---

## 3. Reports (relatório de atividades por usuário)

**Arquivos:** `modules/reports/{reports.service.ts, reports.controller.ts, dto/report-query.dto.ts}`;
front `pages/admin/ReportsPage.tsx` + `features/reports/api.ts`. Rota web `/admin/reports` (adminOnly).

### Como funciona
- `GET /reports/user-activity?userId&from&to` (**ADMIN**). Monta uma **trilha cronológica** unindo:
  - **TICKET_OPENED** — `ticket` por `requesterId` (com anexos de nível do chamado);
  - **STATUS_CHANGED** — `ticketStatusHistory` com `fromStatus != null` (exclui o registro de
    criação TRIAGE, já coberto por "abriu") por `changedBy`;
  - **COMMENTED** — `ticketComment` por `authorId` (com anexos do comentário).
- Itens unidos e ordenados por `at` (ascendente). Anexos vêm com `url` autenticada (`attachmentUrl`).
- **Filtros:** `userId` vazio = todos os usuários (o front mostra o nome do ator). `from`/`to` no
  formato `YYYY-MM-DD` (do `<input type="date">`), aplicados sobre `createdAt`.

### Front
- `ReportsPage`: filtros (usuário/de/até), agrupamento **por mês**, timeline visual, miniaturas via
  `AttachmentThumb`, e **Imprimir / Salvar PDF** (`window.print()` com `print:hidden` na navegação).
- `useUserActivityReport` só dispara após clicar em "Gerar relatório".

### Tipos compartilhados (`@chamados/shared`)
`UserActivityReport`, `ActivityLogItem`, `ReportQuery`, `BackupList`, `BackupRunResult`.

---

## Pendências e lacunas encontradas

1. **`.env.example` desatualizado** — NÃO documenta as novas envs: `ATTACHMENTS_DIR`, `BACKUP_DIR`,
   `BACKUP_KEEP`, `PG_DUMP_PATH`, `BACKUP_DOCKER_CONTAINER`. Recomendo adicionar (com comentários).
2. **`decisions/anexos-imagens.md` está OBSOLETA** — descreve disco em claro + estático público
   (`/api/uploads/`, sem auth). O código atual usa **cifra (vault) + endpoint autenticado + pasta
   externa**. Atualizar essa decisão ou marcá-la como superada pela decisão do cofre.
3. **Sem `decisions/` para vault, backup e reports** — sugiro criar: cofre-anexos (cripto AES-GCM,
   senha só em memória), backup-pgdump (estratégia/retenção/cron) e relatorios-atividade.
4. **Risco operacional do cofre:** perder a senha-mestra = anexos `.enc` **irrecuperáveis**. O
   `vault.meta.json` fica junto dos anexos (não é a senha, mas o salt+verifier). Documentar em
   procedure de operação.
5. **Backup depende de ambiente:** `pg_dump` precisa existir (no container ou no host) e a API
   precisa estar ligada às 02:00 para o cron. Sem alerta se o backup automático falhar (só log).
6. **Sem testes automatizados** para os três módulos.

## Verificação
- Apenas **leitura de código** nesta sessão (documentação retroativa). Nenhuma alteração de código.
- Não rodei build nem stack. Os comportamentos acima foram inferidos do fonte atual.
