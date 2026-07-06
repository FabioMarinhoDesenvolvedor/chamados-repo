# Notificação híbrida por e-mail (Plano 2)

Data: 2026-07-06
Estende: [[notificacao-polling]] (não substitui — soma e-mail por setor).

## Decisão (aprovada por Fabio, 2026-07-06)
- E-mail é **1 por setor** (`Department.notificationEmail`), nunca por usuário.
- Disparo só na **criação** do chamado, e só quando o setor executor tem `notificationEmail`.
- Padrão **outbox transacional**: a linha `notification_outbox` é inserida na MESMA transação
  do chamado (`createWithHistory`). Worker `@Cron` (1 min) envia via SMTP.
- **Stub em dev**: sem `SMTP_HOST`, o `MailerService` só loga (não envia) — permite smoke sem
  servidor. `SMTP_*` reais enviam em produção.
- **3 tentativas** por linha; depois `FAILED` (só log, sem UI de reenvio no MVP).
- Conteúdo: assunto `Novo chamado — <título>`; corpo com solicitante, setor, prioridade,
  descrição/local (se houver) e link `${APP_URL}/tickets/:id`.

## Consequências
- Envs novos: `SMTP_HOST/PORT/USER/PASS/FROM`, `APP_URL` (ver `07-operacao-deploy.md`).
- Sync de usuários reais é frente SEPARADA — não muda o destinatário (segue por setor).
- Ver spec `docs/superpowers/specs/2026-07-06-notificacao-hibrida-email-plano2-design.md`.
