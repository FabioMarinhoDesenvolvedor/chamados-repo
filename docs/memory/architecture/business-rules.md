# Regras de Negócio — Chamados TI

## Perfis de Acesso (3 perfis)
- **user**: abre chamados e acompanha os próprios.
- **operator**: equipe de atendimento. Vê todos os chamados, assume chamados **para si**,
  altera status, comenta e resolve (RESOLVED). NÃO gerencia usuários, NÃO faz triagem
  (definir complexidade), NÃO conclui (CLOSED) e NÃO acessa funcionalidades administrativas.
- **admin**: acesso total — atende, gerencia (usuários/departamentos/relatórios/backup),
  faz triagem e vê todos os chamados.
- **Staff = admin ∪ operator** (equipe de atendimento). `tickets.assigned_to` é sempre um
  membro do staff (admin ou operator). Helper único: `isStaffRole` em `@chamados/shared`.
- Enum `role` = `'ADMIN' | 'USER' | 'OPERATOR'`.

## Visibilidade de Chamados
- **user**: vê apenas os chamados que ele mesmo abriu (`requester_id = user`).
- **staff (admin/operator)**: vê todos os chamados.
- Aplicar a regra no service/repository (filtro por role), nunca confiar só no front.
- Projeção por papel (`hideByRole`): USER não vê prioridade/complexidade/nota; OPERATOR vê
  prioridade/complexidade mas NÃO a nota (avaliação é só do admin); ADMIN vê tudo.

## Triagem (complexidade definida pelo admin/TI)
- O **usuário NÃO escolhe complexidade** ao abrir o chamado (só título, descrição, departamento).
- Chamado nasce no status **`triage` ("Em triagem")**, com `complexity` e `priority` nulos.
- O **admin/TI define a complexidade** → o sistema calcula a prioridade (matriz abaixo) e move
  `triage → open` automaticamente (registrado no histórico). Recalcula se complexidade/depto mudarem.
- Endpoint: `PATCH /tickets/:id` (admin) com `{ complexity?, departmentId? }`.
- Ver decisão: decisions/triagem-complexidade.

## Cálculo de Prioridade (matriz fixa)
Centralizado em `PriorityService` (DRY/SOLID). Nunca calcular no banco.

Faixas de `department.priority_weight`: Baixo = 1–2 · Médio = 3 · Alto = 4–5

| complexity ↓ \ peso → | Baixo (1–2) | Médio (3) | Alto (4–5) |
|------------------------|-------------|-----------|------------|
| low                    | low         | low       | medium     |
| medium                 | low         | medium    | high       |
| high                   | medium      | high      | urgent     |
| critical               | high        | urgent    | urgent     |

Cores: 🟢 low · 🟡 medium · 🔴 high · 🟣 urgent.

STATUS: APROVADA por Fabio em 2026-06-25.
Recalcular prioridade quando complexity ou departamento mudarem.

## Acompanhamento (MVP)
- **Timeline unificada ("Acompanhamento")**: no front, `ticket_status_history` + `ticket_comments`
  são mesclados em UMA linha do tempo cronológica. No backend continuam separados (sem endpoint novo).
- **Notificação por não-lido (polling)**: badge no menu + marcador na lista. Regra e tabela
  `ticket_read_state` em architecture/database.md. Ver decisão: decisions/notificacao-polling.
- **Encerramento em duas etapas**: a TI marca `RESOLVED` ("Resolvido — aguardando
  confirmação"); o **solicitante** confirma e avalia, indo para `CLOSED` ("Concluído")
  via `PATCH /tickets/:id/close` (acessível ao solicitante ou admin; só a partir de
  RESOLVED). O admin pode forçar `CLOSED` pelo seletor de status (sem avaliação).
- **Avaliação**: estrelas 1–5, opcional, salva em `tickets.rating`. Visível só ao admin
  no detalhe do chamado; não entra na timeline pública.

## SLA (prazo de atendimento)
Centralizado em `SlaService` / `sla.matrix.ts` (DRY). Horas corridas (24/7), contadas a
partir da triagem (`tickets.sla_started_at`, gravado na saída de TRIAGE). Derivado
on-the-fly (`slaDueAt = slaStartedAt + horas`), nunca persistido como prazo.

| Prioridade | Prazo |
|------------|-------|
| low / medium | 24h |
| high         | 3h  |
| urgent       | 1h  |

O **usuário NÃO vê prioridade/complexidade** (escondidas no front), apenas a promessa
"Prazo de atendimento: até X horas". O **admin** vê "SLA estourado" quando o prazo passa
sem resolução. STATUS: APROVADA por Fabio em 2026-06-29.
