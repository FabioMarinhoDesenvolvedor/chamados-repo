# Handoff — 2026-07-06 (Plano 2/4 — Notificação híbrida por e-mail)

## Contexto
Continuação da branch `feat/multi-setorial`. Nesta sessão, em sequência:
1. Revisão final do Plano 1 (ver handoff `sessao-2026-07-06-revisao-plano1.md`) — 2 bugs corrigidos.
2. Brainstorm + spec + plano + **implementação completa do Plano 2** (notificação por e-mail),
   via `subagent-driven-development` (implementer + reviewer por tarefa + revisão final + fix).
3. Registrada também a spec do **import de usuários reais** (frente separada, parkeada — ver abaixo).

## Decisões (validadas com Fabio nesta sessão)
- Notificação é **1 e-mail por setor** (`Department.notificationEmail`), nunca por usuário.
- Disparo **só na criação** do chamado; padrão **outbox transacional** (linha inserida na MESMA
  transação do chamado).
- **Stub em dev** (sem `SMTP_HOST` → só loga) / **SMTP real em prod**.
- Worker `@Cron` a cada 1 min; **3 tentativas** e depois `FAILED` (só log, sem UI de reenvio).
- E-mail: assunto `Novo chamado — <título>` + corpo resumo + link `${APP_URL}/tickets/:id`.
- Sync de usuários reais NÃO muda o destinatário (segue por setor). Ver decisão
  `decisions/notificacao-hibrida-email.md` e spec `2026-07-06-notificacao-hibrida-email-plano2-design.md`.

## O que mudou (Plano 2 — 8 commits, dad31f3..796c379)
- `d2f8772` schema + migration `notification_outbox` (enum `NotificationStatus` + tabela, aditiva).
- `f3dbe98` `buildTicketEmail` (função pura, pt-BR, link opcional) + testes.
- `a1339ac` `NotificationOutboxRepository` (findPending<3 tentativas / markSent / markFailed→FAILED aos 3).
- `4985408` `MailerService` (nodemailer — **dep nova**; stub sem SMTP_HOST) + testes.
- `5df8b57` `MailWorker` (`@Cron` 1min, guard `running`, log só quando vira FAILED) + testes.
- `ff8ad65` enqueue na criação: `TicketsService.create()` gera o UUID e passa `notification` p/
  `createWithHistory`, que insere a outbox na mesma tx. `TicketsService` ganhou `ConfigService` (7º param).
- `b764714` `NotificationsModule` no `app.module` + envs (`.env.example`, `07-operacao-deploy.md`) +
  decisão + índice do README.
- `796c379` fix da revisão final: worker loga falha de ciclo (ex.: DB fora no `findPending`) em vez
  de deixar virar rejeição não tratada.

## Verificação executada
- Build `shared → api`: limpo.
- `npm test -w @chamados/api`: **58/58 pass** (era 44 no início da sessão; +14 nesta linha de
  trabalho, todos com RED→GREEN observado pelos implementers). git status limpo.
- Revisão final whole-Plano-2 (opus): invariantes centrais OK (outbox atômico, id pré-gerado
  consistente, FAILED alcançável, isolamento por linha, sem `any`). 1 Important corrigido; Minors
  aceitos p/ MVP (janela estreita de double-send se `markSent` falhar após envio ok;
  claim só via guard `running` — ok em single-process/systemd).
- **Smoke real: PULADO / PENDENTE (reportado, NÃO como sucesso).** Mexe em migration + SQL + `@Cron`
  + SMTP — só quebra no sistema real. Postgres não estava de pé nesta sessão (Docker fechado) e
  `db:*` / subir infra é papel do Fabio.

## Pendências
### Smoke do Plano 2 (com o banco no ar — roteiro na Task 8 do plano)
1. `docker compose up -d` → `npm run db:migrate -w @chamados/api` (aplica a migration da outbox).
2. `npm run dev:api`; setar `notificationEmail` num setor executor de teste; criar chamado que
   roteie pra ele → conferir 1 linha `PENDING` na `notification_outbox`; após ~1 min ver o worker
   logar `[STUB] ...` e a linha virar `SENT` (`sent_at` preenchido). Criar chamado em setor SEM
   e-mail → nenhuma linha. Limpar dados de teste.
### Deploy
- Plano 1 (ordem no handoff 2026-07-02) + a migration da outbox do Plano 2. Envs novos em prod:
  `SMTP_HOST/PORT/USER/PASS/FROM`, `APP_URL` (sem `SMTP_HOST`, cai no stub). Deploy é do Fabio.
### Import de usuários reais (parkeado)
- Spec `2026-07-06-import-usuarios-reais-design.md` aprovada; BLOQUEADO até o Fabio montar a lista
  real (CSV `nome,email,setor`; OPERATORs/ADMINs à parte). Depois: escrever plano → implementar.
### Planos 3 e 4 (frontend, totem)
- Só o design (spec guarda-chuva) existe; planos de implementação ainda não escritos.

## PRÓXIMO passo explícito
Rodar o smoke do Plano 2 com o banco no ar (roteiro acima). Passando, decidir: **merge da branch**
(via `finishing-a-development-branch`) OU seguir para o **Plano 3 (frontend)** OU retomar o
**import de usuários** quando a lista estiver pronta.
