# Design — Encerramento pelo usuário, avaliação e SLA

Data: 2026-06-29
Status: aprovado para planejamento

## Objetivo

Permitir que o **solicitante** encerre o próprio chamado (confirmando a conclusão e
avaliando o atendimento) e introduzir um **prazo de SLA** por prioridade, visível ao
usuário apenas como promessa de atendimento ("será atendido em até X horas"), sem
expor a forma de cálculo.

## Contexto atual (resumo)

- Fluxo de status: `TRIAGE → OPEN → IN_PROGRESS → RESOLVED → CLOSED`.
- Hoje o admin clica "✓ Concluir chamado" e o ticket vai direto para `RESOLVED`.
  O usuário comum não encerra nada.
- Prioridade é calculada pela matriz fixa (`complexidade × peso do depto`) no
  `PriorityService`, somente quando o admin faz a triagem (TRIAGE→OPEN).
- `PATCH /tickets/:id/status` é `@Roles('ADMIN')`.
- A página de detalhe (`TicketDetailPage.tsx`) mostra `PriorityBadge` e a
  complexidade para **todos** os perfis.

## Decisões de negócio (confirmadas)

1. **Fluxo de encerramento:** a TI marca `RESOLVED` ("Resolvido — aguardando
   confirmação"); o **solicitante** confirma e avalia, indo para `CLOSED`
   ("Concluído"). O admin pode forçar `CLOSED` (sem avaliação) se o usuário sumir.
2. **Avaliação:** apenas estrelas **1–5**, **opcional**. Sem campo de comentário.
   Salva no chamado; visível **só para o admin** (não entra na timeline pública nem
   em ranking por técnico). Não há anonimato real possível, pois o chamado tem
   solicitante conhecido — a nota é tratada como satisfação do chamado.
3. **SLA por prioridade** (horas corridas, relógio 24/7):
   | Prioridade | Prazo |
   |------------|-------|
   | Baixa (LOW)     | 24h |
   | Média (MEDIUM)  | 24h |
   | Alta (HIGH)     | 3h  |
   | Urgente (URGENT)| 1h  |
4. **Início da contagem do SLA:** a partir da **triagem** (quando o admin define a
   prioridade e o chamado sai de TRIAGE). Guardado em `slaStartedAt`.
5. **Visão do usuário:** Prioridade e Complexidade ficam **ocultas** para o perfil
   USER. Ele vê apenas o prazo de SLA. Admin continua vendo tudo.

## Arquitetura

### Banco (migration nova)

Campos novos em `Ticket`:

- `rating Int?` — nota 1–5 (validada na aplicação).
- `closedAt DateTime?` — quando o chamado foi concluído (CLOSED).
- `slaStartedAt DateTime?` — instante em que o SLA passou a contar (saída da triagem).

`resolvedAt` já existe e continua marcando o `RESOLVED`.

### SLA (cálculo)

- Novo `sla.matrix.ts`: `Record<Priority, number>` (horas) — fonte única de verdade.
- Novo `SlaService` (espelha `PriorityService`): `dueAt(priority, slaStartedAt)`.
- **Derivado on-the-fly**, não persistido: `slaDueAt = slaStartedAt + horas(priority)`.
  Se a prioridade mudar numa recalibragem, o prazo acompanha (a âncora `slaStartedAt`
  permanece a do primeiro envio para atendimento).
- A API anexa ao ticket os campos derivados:
  - `slaHours: number | null`
  - `slaDueAt: string | null` (ISO; nulo enquanto em TRIAGE / sem prioridade).
- `slaStartedAt` é gravado em `TicketsRepository.applyTriage` no momento do
  `moveToOpen` (TRIAGE→OPEN), e **não** é resetado em recalibragens posteriores.

### Encerramento pelo usuário

- Novo endpoint: `PATCH /tickets/:id/close`
  - **Sem** `@Roles('ADMIN')`; autorização no service: precisa ser o **solicitante**
    ou um **admin**.
  - Body (DTO `CloseTicketDto`): `{ rating?: number (1..5 inteiro) }`.
  - Regra: só permite quando o status atual é `RESOLVED`. Caso contrário, 400.
  - Efeito: status → `CLOSED`, `closedAt = now`, `rating = dto.rating ?? null`,
    registra entrada em `ticket_status_history` (RESOLVED→CLOSED).
- O admin mantém o caminho atual via `PATCH /tickets/:id/status` para forçar `CLOSED`
  (sem avaliação) quando necessário.

### Frontend

- **Shared** (`types.ts`/contratos): `Ticket`/`TicketDetail` ganham `rating: number | null`,
  `closedAt: string | null`, `slaHours: number | null`, `slaDueAt: string | null`.
  Novo input `CloseTicketInput { rating?: number }`.
- **Labels:** `STATUS_LABEL.RESOLVED` = "Resolvido (aguardando confirmação)",
  `STATUS_LABEL.CLOSED` = "Concluído".
- **`useCloseTicket(id)`** em `features/tickets/api.ts` → `PATCH /tickets/:id/close`,
  invalida `ticket`, `tickets`, `unread-count`.
- **`TicketDetailPage`:**
  - USER: oculta `PriorityBadge` e a linha de complexidade. Mostra um bloco de SLA:
    "⏱ Prazo de atendimento: até {X} horas (até {data})" quando `slaDueAt != null`;
    em triagem, "Em análise — prazo definido após a triagem".
  - USER + status `RESOLVED`: bloco **"Confirmar conclusão"** com seletor de
    estrelas 1–5 (opcional) e botão "Concluir chamado" (chama `useCloseTicket`).
  - Admin: renomear o botão "✓ Concluir chamado" → **"Marcar como resolvido"**.
    Exibir a nota (estrelas) quando o chamado estiver `CLOSED` e `rating != null`.
    Exibir aviso **"SLA estourado"** quando `slaDueAt` passou e o chamado não está
    `RESOLVED`/`CLOSED`.
- **Componente `StarRating`** (reutilizável): leitura e edição de 1–5 estrelas,
  responsivo (mobile-first).

## Regras de validação / erros

- `rating` fora de 1..5 ou não inteiro → 400 (class-validator no DTO).
- `close` em chamado que não está `RESOLVED` → 400 ("Só é possível concluir um chamado já resolvido pela TI").
- `close` por quem não é solicitante nem admin → 403 (reusa `ensureCanView`).

## Testes / verificação

- Unit: `sla.matrix` (cada prioridade → horas) e `SlaService.dueAt` (âncora + soma).
- Fluxo manual (smoke): admin resolve → usuário conclui com 4 estrelas → status
  CLOSED, rating salvo, prazo de SLA exibido corretamente, badges ocultos para USER.

## Fora de escopo (YAGNI)

- Horário comercial / dias úteis (SLA é 24/7 corrido).
- Média de satisfação em relatórios (pode vir depois).
- Comentário na avaliação.
- Notificação/auto-close automático por inatividade.

## Documentação a atualizar na implementação

- `docs/memory/architecture/business-rules.md` (encerramento pelo usuário, avaliação, SLA).
- Handoff em `docs/memory/handoffs/`.
