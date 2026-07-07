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

## Abertura guiada por categorias (blocos)
- O usuário NÃO digita título livre: escolhe **categoria (bloco)** → **subcategoria**, ambas
  com ícone (lucide), e opcionalmente uma **descrição complementar** (texto livre opcional).
- O **"Assunto" (title) é derivado** = "Categoria › Subcategoria". `category_id`/`subcategory_id`
  ficam no chamado. Backend valida que a subcategoria pertence à categoria.
- Categorias são INDEPENDENTES do departamento (departamento segue sendo o setor do solicitante).
- Chamados antigos (sem categoria) continuam válidos (campos nullable) e exibem o título antigo.
- 6 blocos / 33 subcategorias são dado de referência (seed na migration). Filtro por categoria
  disponível no dashboard e no relatório.
- **3º nível ("detalhe")**: subcategorias podem ter 0..N detalhes (data-driven, seed na
  migration). Escolher o detalhe é **OPCIONAL** (a abertura não pode travar quem não sabe): o
  grid tem um card **"Não sei / Outro"** que pula direto pro form; sem detalhe, a complexidade-base
  vem da subcategoria. Detalhes de **diagnóstico técnico** (causa) foram removidos — "Sem conexão"
  e "Rede interna" voltaram a 2 níveis; mantidos só os de **sintoma observável**. O "Assunto"
  derivado passa a
  "Categoria › Subcategoria › Detalhe" quando houver detalhe. `tickets.detail_option_id`
  é nullable (chamados antigos/2 níveis = NULL). A coluna `base_complexity` (subcategoria e
  detalhe) alimenta a **priorização automática na abertura** (ver seção abaixo).

## Priorização automática na abertura (complexidade via categorização)
- O **usuário NÃO escolhe complexidade** (só categoria/subcategoria/detalhe + descrição opcional).
- O chamado **nasce `OPEN` já priorizado**: a complexidade-base vem da **categorização**
  (`detalhe.base_complexity` › `subcategoria.base_complexity` › **MÉDIA** como default), a
  prioridade é derivada pela matriz abaixo com o **peso do setor**, e `sla_started_at` é gravado
  **na criação**. Não há mais passo de triagem manual para o chamado ganhar prazo.
- **Sem status `TRIAGE` para chamados novos** (o valor de enum permanece p/ compatibilidade;
  os chamados antigos foram migrados p/ OPEN priorizado — ver handoff 2026-07-01-prazo-automatico).
- A complexidade-base é **curada por subcategoria/detalhe** (seed em migration) e pode ser
  refinada; enquanto não curada, cai no default MÉDIA.
- **Sem override de complexidade do admin** (removido em 2026-07-07): `PATCH /tickets/:id` não
  aceita mais `complexity`. A complexidade é 100% da categorização. O admin mantém só a correção
  de `departmentId`, que recalcula a prioridade e os dois prazos de SLA automaticamente.
- A **prioridade de 4 níveis** (badge colorido, tabela abaixo) segue existindo para exibição/filtro
  do staff, mas **não governa mais os prazos de SLA** (ver seção SLA) — só a matriz
  `complexidade × peso` governa os prazos, direto.
- Ver decisão: decisions/prazo-complexidade-automatica (supera decisions/triagem-complexidade;
  parcialmente superada por decisions/sla-dois-tempos-automatico no que toca SLA único/override).

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
  `RESOLVED` e `CLOSED` são estágios DISTINTOS (não duplicados) — decisão aprovada.
- **Controle de status unificado**: a mudança de status (incl. resolver) é feita por UM
  único seletor no detalhe (sem botão "marcar como resolvido" separado). As opções manuais
  são `IN_PROGRESS`, `RESOLVED` e, só p/ admin, `CLOSED` (TRIAGE/OPEN são automáticos da
  triagem; o status atual sempre aparece). No dashboard, staff alterna `RESOLVED ↔ IN_PROGRESS`
  direto na lista (atalho "Resolver"/"Reabrir").
- **Comentários encerrados**: ao atingir `RESOLVED` ou `CLOSED`, NINGUÉM comenta (nem admin) —
  validado no backend (`addComment` → 403) e escondido no front. Para retomar, a equipe reabre
  o chamado (volta para `IN_PROGRESS`) antes de comentar.
- **Avaliação**: estrelas 1–5, opcional, salva em `tickets.rating`. Visível só ao admin
  no detalhe do chamado; não entra na timeline pública.

## SLA (dois relógios: resposta + conclusão)
Centralizado em `SlaService` / `sla.matrix.ts` (DRY, fonte única, nunca calculado no banco).
Horas corridas (24/7), contadas a partir da abertura (`tickets.sla_started_at`, gravado na
criação). Prazos são **derivados on-the-fly** (`*_due_at = sla_started_at + horas`), nunca
persistidos. **Substitui o SLA único de 3 valores (24h/3h/1h por prioridade), aprovado em 29/06**
— ver decisions/sla-dois-tempos-automatico.

- **Resposta** (`responseDueAt`) — encerra quando o chamado é **assumido** (`assign()`) OU vai
  para **`IN_PROGRESS`** (o que vier primeiro). Grava `tickets.first_response_at = now()` na
  primeira ocorrência; nunca sobrescrito depois.
- **Conclusão** (`resolutionDueAt`) — encerra quando vai para **`RESOLVED`** (`resolved_at`, já
  existia).
- Os dois prazos são derivados de **duas matrizes fixas `complexidade (4) × faixa-de-peso do
  setor (3)`** (`RESPONSE_HOURS`/`RESOLUTION_HOURS` em `sla.matrix.ts`). Faixas de
  `department.priority_weight`: Baixo = 1–2 · Médio = 3 · Alto = 4–5 (mesmo `weightBand()` da
  matriz de prioridade). Complexidade nula (chamado legado) cai no default MÉDIA no cálculo.

| complexidade ↓ \ peso → | Conclusão: Baixo | Médio | Alto | Resposta: Baixo | Médio | Alto |
|---|---|---|---|---|---|---|
| low      | 48h | 40h | 24h | 8h | 6h | 4h |
| medium   | 24h | 16h | 8h  | 4h | 3h | 2h |
| high     | 8h  | 4h  | 2h  | 2h | 1h | 1h |
| critical | 4h  | 2h  | 1h  | 1h | 1h | 1h |

Resposta ≤ conclusão em todas as células.

- **Visibilidade**: o **usuário** vê as duas promessas ("Resposta em até Xh · Conclusão em até
  Yh") sem cor de estouro (segue sem ver prioridade/complexidade — regra preservada). O **staff**
  (admin/operator) vê os dois relógios com contagem e **"Resposta estourada"/"Conclusão
  estourada"** em vermelho ao passar do prazo; após a resposta ser registrada, o relógio de
  resposta mostra "Respondido" e resta só o de conclusão.
- A **prioridade** (badge de 4 níveis, calculada por `PriorityService`) **não governa mais os
  prazos** — segue existindo só para exibição/filtro do staff.
- STATUS: APROVADA por Fabio em 2026-07-07 (supera o SLA único de 29/06).

## Multi-setorial: roteamento, RBAC de setor executor e aprovação
- **15 setores reais** (TI, RH, Tesouraria, Presidência, CEO, Manutenção, Limpeza, Almoxarifado,
  Compras, Comunicações, Gestão de Contratos, Secretaria, Secretaria da Presidência, Jurídico,
  Eventos), cada um com `priorityWeight` real e 3 flags novas: `isRequesterDept`, `isExecutorDept`,
  `requiresApproval`. Tabela completa em `decisions/rbac-setor-executor.md`.
- **Dois departamentos no chamado**: `departmentId` (setor do **solicitante**, alimenta a matriz
  de prioridade — inalterado) e `executorDepartmentId` (setor **executor**, novo — resolvido
  automaticamente de `TicketCategory.departmentId` na criação, não escolhido pelo usuário).
- **RBAC de `OPERATOR` por setor**: um OPERATOR com `User.departmentId` preenchido só vê/age em
  chamados cujo `executorDepartmentId` bate com o seu (`listWhere`, `stats`, `detail`, `assign`,
  `updateStatus`, comentários, anexos). OPERATOR sem `departmentId` (equipe global) vê tudo.
  **ADMIN nunca é restrito por setor.** Ver [[rbac-setor-executor]].
- **Aprovação removida (2026-07-07)**: `requiresApproval` da Presidência (único setor com `true`)
  virou `false`. Nenhum chamado novo nasce `PENDING_APPROVAL`; o ramo de aprovação em `create()` e
  o endpoint `PATCH /tickets/:id/approve` foram removidos (código morto). O valor de enum
  `PENDING_APPROVAL` **fica dormente** no schema (mesmo precedente do `TRIAGE`) — não removido do
  Postgres, só não é mais produzido. `Department.requiresApproval` permanece na tabela, inerte.
  Ver [[aprovacao-chamados]] (← SUPERADA) e [[sla-dois-tempos-automatico]].
- **Notificação híbrida por e-mail** (`Department.notificationEmail` + outbox, Plano 2), o
  **frontend** do fluxo multi-setorial (macro-bloco, fila por setor, aprovação — Plano 3) e o
  **totem** (`User.isKiosk`, Plano 4) fazem parte do mesmo design mas ainda não foram
  implementados — só o backend core (Plano 1) está pronto.
