# Design — Plano 2/4: Notificação híbrida por e-mail

Data: 2026-07-06
Estende: `2026-07-02-multi-setorial-design.md` (§Notificação). Não substitui o polling aprovado
em `decisions/notificacao-polling.md` — **soma** e-mail por setor.

## Problema
Hoje o staff só descobre um chamado novo pelo polling (badge de não-lido) quando abre o sistema.
Setores que não ficam com o sistema aberto o dia todo (Manutenção, Limpeza, etc.) precisam ser
avisados por e-mail quando um chamado cai na fila deles. O e-mail é **por setor** (1 caixa por
setor), não por usuário — a sincronização de usuários reais é uma frente separada e a notificação
continua indo para `Department.notificationEmail` (decisão do Fabio, 2026-07-06).

## Solução
Padrão **outbox transacional** + worker assíncrono:

1. **Tabela `notification_outbox`** (migration aditiva). Colunas: `id`, `ticketId` (FK →
   `tickets`, `onDelete: Cascade`), `toEmail`, `subject`, `body`, `status`
   (enum `NotificationStatus` = `PENDING | SENT | FAILED`), `attempts` (int, default 0),
   `lastError` (text, nullable), `createdAt` (default now), `sentAt` (nullable).
   O enum novo vai em **migration isolada** (gotcha `postgres-enum-default`).

2. **Enqueue atômico** em `TicketsService.create()`: quando `executorDepartment.notificationEmail`
   estiver preenchido, insere 1 linha `PENDING` na outbox **dentro da mesma transação** do
   `createWithHistory` (o repo passa a receber o payload de notificação opcional). Garante: se o
   chamado commita, o e-mail está enfileirado; se dá rollback, nada de e-mail órfão. Setor sem
   `notificationEmail` → nenhuma linha (só o polling vale, como hoje).

3. **`MailerService`** (nodemailer — dependência nova). Lê `SMTP_*` do env. **Sem `SMTP_HOST`
   configurado → transporte stub** (loga o e-mail via `Logger`, não envia) — permite dev/CI e
   smoke completo do fluxo sem servidor SMTP. Com `SMTP_*` presentes → envia de verdade (prod).

4. **`MailWorker`** (`@Cron` a cada 60s — mesmo padrão de `backup.service.ts`, `@nestjs/schedule`
   já instalado). A cada ciclo: seleciona os `PENDING` (com `attempts < 3`), tenta enviar via
   `MailerService`. Sucesso → `SENT` + `sentAt`. Erro → `attempts++`, grava `lastError`, re-tenta
   no próximo ciclo. Ao atingir **3 tentativas** sem sucesso → `FAILED`, só `Logger.error` (sem
   UI de reenvio no MVP). Claim simples para não reprocessar em paralelo (single-process/systemd):
   marca as linhas selecionadas antes de enviar.

5. **Conteúdo do e-mail** (pt-BR). Assunto: `Novo chamado — <Título>`. Corpo: título
   (Categoria › Subcategoria › Detalhe), solicitante, setor do solicitante, prioridade, descrição
   (se houver), local de origem (se veio do totem), data de abertura, e **link**
   `${APP_URL}/tickets/:id`.

6. **Envs novos** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`) —
   documentados em `docs/projeto/07-operacao-deploy.md` e `.env.example`. Ausência de `SMTP_HOST`
   ativa o stub (dev). `APP_URL` sem valor → link omitido (degrada, não quebra).

7. **Módulo novo `notifications`**: `NotificationOutboxRepository`, `MailerService`, `MailWorker`.
   `TicketsModule` importa o repositório para enfileirar na criação.

## Alternativas descartadas
- **Enviar no request de criação (síncrono)**: acopla a resposta da API à latência/erro do SMTP;
  um SMTP fora do ar derrubaria a criação do chamado. Outbox desacopla e dá retry.
- **Fila externa (Redis/BullMQ)**: infra a mais para um único processo; o design é REST simples no
  MVP. Outbox no próprio Postgres + `@Cron` basta.
- **Notificar por usuário do setor**: descartado pelo Fabio (2026-07-06) — 1 e-mail por setor.
- **UI de reenvio de FAILED**: fora do escopo do MVP (só log). Pode virar incremento depois.

## Impacto
- Schema: +1 tabela, +1 enum (migrations aditivas/isolada). Nenhuma alteração destrutiva.
- `TicketsService.create()` / `TicketsRepository.createWithHistory()`: enqueue opcional na tx.
- Deploy: +2 envs obrigatórios em prod (`SMTP_*`, `APP_URL`); sem eles em dev, cai no stub.
- Nova decisão `decisions/notificacao-hibrida-email.md` a criar na implementação (a spec-guarda
  chuva já previa isso).

## Verificação
- Testes `node:test`: outbox criada quando `notificationEmail` presente; ausente quando não;
  worker marca `SENT` no sucesso e `FAILED` após 3 falhas; `MailerService` cai no stub sem
  `SMTP_HOST`.
- Smoke real (banco no ar): setar `notificationEmail` num setor de teste, criar chamado que roteia
  pra ele, ver a linha `PENDING` virar `SENT` no ciclo do worker e o e-mail logado pelo stub;
  criar chamado em setor sem e-mail → nenhuma linha na outbox.
