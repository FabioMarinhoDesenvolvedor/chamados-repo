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
  migration). Quando a subcategoria tem detalhes, escolher um é **obrigatório**; quando não
  tem, o fluxo vai direto para a descrição. O "Assunto" derivado passa a
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
- **Override do admin (opcional)**: `PATCH /tickets/:id` com `{ complexity?, departmentId? }`
  ainda recalcula a prioridade — deixou de ser obrigatório para o prazo existir.
- Ver decisão: decisions/prazo-complexidade-automatica (supera decisions/triagem-complexidade).

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

## SLA (prazo de atendimento)
Centralizado em `SlaService` / `sla.matrix.ts` (DRY). Horas corridas (24/7), contadas a
partir da abertura (`tickets.sla_started_at`, gravado na criação do chamado). Derivado
on-the-fly (`slaDueAt = slaStartedAt + horas`), nunca persistido como prazo.

| Prioridade | Prazo |
|------------|-------|
| low / medium | 24h |
| high         | 3h  |
| urgent       | 1h  |

O **usuário NÃO vê prioridade/complexidade** (escondidas no front), apenas a promessa
"Prazo de atendimento: até X horas". O **admin** vê "SLA estourado" quando o prazo passa
sem resolução. STATUS: APROVADA por Fabio em 2026-06-29.
