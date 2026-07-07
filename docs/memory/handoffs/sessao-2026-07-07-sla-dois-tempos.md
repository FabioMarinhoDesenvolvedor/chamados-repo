# Handoff — 2026-07-07 (SLA automático de dois tempos)

## Contexto
Sessão retomada após queda de luz: uma implementação anterior desta mesma feature foi perdida
(máquina desligou no meio) e **refeita do zero a partir da spec aprovada**
(`docs/superpowers/specs/2026-07-07-sla-automatico-dois-tempos-design.md`), seguindo o workflow
completo (ENTENDER → ESPECIFICAR → PLANEJAR → IMPLEMENTAR) via `subagent-driven-development`
(implementer por tarefa, 9 tarefas). Branch `feat/multi-setorial`, base `863d0dc`.

## Decisões (validadas com Fabio em 07/07, ver spec §"Decisões aprovadas")
- **Fim do override de complexidade do admin** — `complexity` sai do `PATCH /tickets/:id` e da UI.
  Complexidade 100% da categorização; admin mantém só correção de `departmentId`.
- **Dois relógios de SLA**, ambos automáticos, contados desde `sla_started_at` (criação):
  **Resposta** (assign OU IN_PROGRESS, o que vier primeiro, grava `first_response_at`) e
  **Conclusão** (RESOLVED, `resolved_at` já existente).
- **Duas matrizes fixas `complexidade (4) × faixa-de-peso (3)`** substituem o SLA único derivado
  da prioridade (24h/3h/1h). Prioridade de 4 níveis continua só para o badge/filtro do staff.
- **Remoção da aprovação/Presidência do fluxo**: `requiresApproval` da Presidência vira `false`;
  nenhum chamado novo nasce `PENDING_APPROVAL`; endpoint `/approve` removido. Enum
  `PENDING_APPROVAL` fica **dormente** (mesmo precedente do `TRIAGE`), não removido do Postgres.
- **Visibilidade**: usuário vê as duas promessas sem cor de estouro; staff vê contagem + estouro
  por relógio, e "Respondido" some o relógio de resposta.
- Registrado em `decisions/sla-dois-tempos-automatico.md` — **supera** `decisions/aprovacao-chamados.md`
  (marcada `← SUPERADA` no topo e no índice) e supera **parte** de
  `decisions/prazo-complexidade-automatica.md` (SLA único + override de complexidade; o resto —
  complexidade via categorização com default MÉDIA — continua valendo, anotado na própria decisão).

## O que mudou (8 commits, 863d0dc → fe33963)
- `f8110fa` shared: tipos dos dois relógios (`firstResponseAt`, `responseSlaHours`,
  `resolutionSlaHours`, `responseDueAt`, `resolutionDueAt`, `responseBreached?`,
  `resolutionBreached?`); `UpdateTicketInput` sem `complexity`.
- `80e3c3d` api: duas matrizes de SLA (`RESPONSE_HOURS`/`RESOLUTION_HOURS`, complexidade ×
  faixa-de-peso) em `sla.matrix.ts`; exporta `WeightBand`.
- `8944620` api: `SlaService` com `responseDueAt`/`resolutionDueAt` e default MÉDIA p/
  complexidade nula.
- `b2a264d` api: coluna `first_response_at` (schema+migration `20260707120000_sla_dois_tempos`);
  backfill (1º IN_PROGRESS › resolved_at › created_at p/ chamados já assumidos/resolvidos);
  `UPDATE departments SET requires_approval=false WHERE name='Presidência'`; defensivo
  `PENDING_APPROVAL→OPEN`; réplica idempotente no seed.
- `282688b` api: repo inclui `department.priorityWeight` nas leituras projetadas; grava
  `first_response_at` em assign/IN_PROGRESS.
- `9b16885` api: projeção dos dois relógios + breach (só staff via `hideByRole`); captura da 1ª
  resposta; `create()` nasce sempre OPEN; `approve()` removido.
- `b6a2c3c` api: remove endpoint `PATCH :id/approve` e `complexity` do `UpdateTicketDto`.
- `fe33963` web: exibe os dois relógios (usuário vê prazos sem cor; staff vê estouro), remove
  seletor "Definir complexidade", completa `labels.ts` com `PENDING_APPROVAL`.

## Verificação executada (números reais)
- `npm test -w @chamados/api`: **89/89 pass** (node:test) — subiu de 44 no início da linha
  multi-setorial (+14 do Plano 2, o restante desta feature), todos com RED→GREEN observado.
- Build `@chamados/shared`: limpo.
- Build `@chamados/web` (`tsc --noEmit && vite build`): limpo.
- **PENDENTE (reportado como pendente, NÃO como sucesso):** `db:generate`/`db:migrate` e portanto o
  `nest build` (tsc) da api e o **smoke real** dependem do banco no ar — papel do Fabio (client
  Prisma gerado está defasado nesta sessão). Ordem de deploy sugerida na spec §7:
  1. `ALTER TABLE tickets ADD COLUMN first_response_at TIMESTAMP(3)` (nullable).
  2. Backfill de `first_response_at` (query da spec §3).
  3. `UPDATE departments SET requires_approval=false WHERE name='Presidência'`.
  4. `UPDATE tickets SET status='OPEN' WHERE status='PENDING_APPROVAL'` (defensivo).
  5. `db:generate` → `db:deploy` → build `shared → api → web` → restart (systemd, srv-alv01).
- **Revisão final whole-branch (SDD, opus, 863d0dc..e563d6c)**: veredito **With fixes** (correções
  menores adiáveis) — **sem Critical/Important**. Risco central confirmado fechado: os 5 caminhos de
  leitura projetada (`create`/`update`/`list`/`updateStatus`/`detail`) carregam `department.priorityWeight`,
  então nenhum projeta prazo nulo por engano; captura de `first_response_at` sem sobrescrita; breach só
  a staff sem bug Date-vs-number; aprovação 100% removida dos caminhos vivos.

## Pendências
- Smoke local com banco no ar (roteiro da spec §8): abrir chamado → ver os dois prazos como
  usuário e como staff; assumir → `first_response_at` grava e "Resposta" vira "Respondido"; mover
  para `IN_PROGRESS` sem resposta prévia também grava; passar do prazo → staff vê estouro;
  `PATCH /tickets/:id { complexity }` não é mais aceito; nenhum chamado nasce `PENDING_APPROVAL`.
  Limpar dados de teste depois.
- `db:generate`/`db:migrate`/`nest build` (api) — bloqueados sem Postgres no ar nesta sessão.
- Deploy em produção — papel do Fabio, seguindo a ordem da spec §7 acima.
- **Follow-ups menores da revisão final (não bloqueiam merge; limpeza futura):**
  1. Guards mortos de `PENDING_APPROVAL` em `updateStatus`/`listWhere` (mensagem aponta rota removida).
  2. `OPEN → RESOLVED` direto deixa o relógio de resposta como "em até Xh" em chamado resolvido
     (cosmético; cor de estouro já suprimida em resolvidos). Opção: tratar `resolvedAt != null`
     como "respondido" no detalhe.
  3. `useUpdateTicket` sem chamador na UI — a spec preserva a correção de setor (`departmentId`)
     pelo admin, mas ainda **não há controle de UI** para ela (só a capacidade da API). Decidir se
     entra num próximo passo de frontend.
  4. `close()` retorna ticket sem projeção de SLA (pré-existente, não é regressão).

## PRÓXIMO passo explícito
1. Rodar o smoke com o banco no ar (roteiro acima) e a revisão final whole-branch.
2. Depois: abrir a frente própria de **IDs sequenciais** (trocar UUIDs por inteiros a partir de 0,
   já pedida pelo Fabio nesta sessão, fora do escopo desta spec) — ENTENDER → ESPECIFICAR →
   PLANEJAR → IMPLEMENTAR.
3. Em paralelo/depois, retomar **Planos 3 e 4 do multi-setorial** (frontend do roteamento/fila por
   setor, totem) — só o design guarda-chuva existe, planos de implementação ainda não escritos.
