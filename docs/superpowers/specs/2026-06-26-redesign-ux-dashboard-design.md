# Design — Redesign UX, Triagem e Dashboard Dinâmico (Grená)

Data: 2026-06-26
Status: Aprovado por Fabio em 2026-06-26 (brainstorming com companion visual)

## Objetivo
Evoluir o MVP do "Chamados TI" com foco no usuário e no admin/TI:
- Tirar a definição de complexidade do usuário (passa a ser triagem do admin/TI).
- Dashboard dinâmico (KPIs + gráfico + fila) com sidebar retrátil e responsivo.
- Unificar histórico de status + comentários em uma timeline de acompanhamento, com
  notificação de novidades por badge (polling).
- Controle total de usuários pelo admin (editar nome/e-mail/perfil/depto + redefinir senha).
- Identidade visual grená/branco do Clube Atlético Juventus, com efeitos modernos.

Princípios: KISS, DRY, SOLID. REST simples (sem WebSocket/GraphQL). Mobile-first (375px+).

---

## 1. Triagem (complexidade sai do usuário)

### Regra
- Usuário abre chamado apenas com: **título, descrição, departamento**.
- Chamado nasce com status **`TRIAGE` ("Em triagem")**, `complexity = null`, `priority = null`.
- Admin/TI define a **complexidade** → sistema calcula a **prioridade** via `PriorityService`
  (matriz já aprovada em business-rules.md) e move `TRIAGE → OPEN` automaticamente.
- Se complexidade ou departamento mudarem depois (com status já fora de TRIAGE), recalcular prioridade.

### Impacto de dados
- `ticket.complexity` → **nullable**.
- `ticket.priority` → **nullable**.
- Enum `TicketStatus` ganha **`TRIAGE`** (primeiro do fluxo): TRIAGE → OPEN → IN_PROGRESS → RESOLVED → CLOSED.

### Backend
- `CreateTicketDto`: remover `complexity`. Service cria com status TRIAGE, complexity/priority null,
  e grava no histórico o evento inicial (Criado: Em triagem).
- Novo endpoint admin de triagem/atualização: **`PATCH /tickets/:id`** (admin) com body
  `{ complexity?, departmentId? }`. Recalcula prioridade; se estava em TRIAGE e recebeu complexity,
  muda status para OPEN e grava no histórico de status.

### Frontend
- `NewTicketPage`: remover o `Select` de complexidade e o texto "A prioridade é calculada…".
- `TicketDetailPage` (admin): adicionar controle para definir/alterar complexidade (dispara o PATCH).
- Exibir prioridade/complexidade como "—" / "Em triagem" quando null.

---

## 2. Concluir chamado

- Botão **✓ Concluir** na fila do dashboard e no detalhe → `PATCH /tickets/:id/status` com `RESOLVED`
  (endpoint já existe; grava `resolvedAt`). Sem novo endpoint.

---

## 3. Timeline unificada + notificação

### Timeline ("Acompanhamento")
- Substitui as duas seções atuais ("Histórico de status" + "Comentários") por **uma timeline
  cronológica** que mescla, por `createdAt`:
  - eventos de status (de `ticket.history`)
  - comentários (de `ticket.comments`)
- Mesclagem no frontend (sem endpoint novo). Cada item mostra autor, timestamp e conteúdo
  (mudança de status OU texto do comentário). Caixa de novo comentário permanece.

### Notificação por badge (polling)
- Nova tabela **`ticket_read_state`**: `(id, userId, ticketId, lastSeenAt)`, `@@unique([userId, ticketId])`.
- Ao abrir o detalhe do chamado, **upsert** marca `lastSeenAt = now` (endpoint
  `POST /tickets/:id/seen` ou marca dentro do GET de detalhe — decisão fina no plano).
- "Novidade" = existe comentário OU mudança de status com `createdAt > lastSeenAt` **feito por outro usuário**
  (não conta a própria ação). Sem registro de leitura ⇒ qualquer atividade conta como novidade.
- Endpoints de leitura:
  - `GET /tickets` passa a incluir `hasUnread: boolean` por chamado (respeitando visibilidade por role).
  - `GET /notifications/unread-count` → total de chamados com novidade para o usuário logado.
- Frontend: TanStack Query com `refetchInterval` (~20s) no contador. Badge no menu lateral
  e marcador nas linhas de chamados com novidade.

---

## 4. Controle total de usuários (admin)

- Backend: **`PATCH /users/:id`** (admin) com campos opcionais
  `{ name?, email?, role?, departmentId?, password? }`.
  - `email`: validar duplicidade.
  - `password`: re-hash com bcrypt (ver decisions/password-hashing). "Redefinir senha" = enviar novo password.
  - "Redefinir e-mail" = enviar novo email. Sem fluxo de e-mail/SMTP.
- Frontend (`UsersPage`): cada usuário ganha edição (linha editável ou modal) para os campos acima
  + campo de nova senha. Mantém criação já existente.

---

## 5. Identidade visual: Grená Moderno

- Paleta no Tailwind (`theme.extend.colors`):
  - `grena.DEFAULT = #7A1C27`, `grena.dark = #5A0F1C`, `grena.light = #A23B47`,
    `surface = #FAF7F8` (off-white). Tons auxiliares conforme necessário.
- Substituir todas as ocorrências de `indigo-*` pelos tokens grená.
- Efeitos modernos: gradientes grená (sidebar, botões e card de destaque), cards "glass"
  (fundo translúcido + leve blur), sombras coloridas suaves (`shadow` com tint grená),
  cantos arredondados (rounded-xl/2xl). Manter contraste/acessibilidade (texto legível).
- Atualizar componentes base: `button`, `card`, `badge`, e os badges de prioridade/status.

---

## 6. Dashboard dinâmico (Layout "KPIs no topo") + sidebar retrátil

### Dashboard (admin)
- **KPIs no topo** (cards): Em triagem · Abertos · Urgentes · Resolvidos.
- **Gráfico por prioridade**: barras em **CSS puro** (sem nova dependência — KISS). Recharts fica como
  evolução futura, se necessário.
- **Fila de chamados**: prioridade (badge), data, título (link), e ✓ concluir.
- Visão do **usuário comum**: mantém lista dos próprios chamados (sem KPIs gerenciais).

### Sidebar retrátil
- Desktop: botão recolhe a sidebar para **só ícones**; estado salvo em `localStorage`.
- Mobile: mantém **drawer** (☰) já existente.
- Responsivo 375px+; no celular os blocos do dashboard empilham.

### Fase 2 (fora deste spec)
- Widgets arrastáveis/reordenáveis/ocultáveis com layout persistido por admin no banco.

---

## 7. Migrações de banco (resumo)
1. `ticket.complexity` → nullable.
2. `ticket.priority` → nullable.
3. Enum `TicketStatus` + `TRIAGE`.
4. Nova tabela `ticket_read_state (id, userId, ticketId, lastSeenAt, unique(userId,ticketId))`.

Seed: ajustar para refletir TRIAGE (alguns chamados em triagem, outros já triados).

---

## 8. Mudanças no pacote shared
- `enums.ts`: `TICKET_STATUSES` inclui `TRIAGE`. Tipos de Ticket: `complexity` e `priority` opcionais/null.
- `types.ts`: `CreateTicketInput` sem `complexity`; novo `UpdateTicketInput` (complexity/departmentId);
  `UpdateUserInput`; tipos de notificação (`hasUnread`, contagem). Ajustar conforme plano.
- Labels (web): adicionar `STATUS_LABEL.TRIAGE = "Em triagem"`.

---

## 9. Documentação a atualizar (Regra nº 1)
- `architecture/business-rules.md`: triagem, status TRIAGE, complexidade pelo admin, timeline, notificação.
- `architecture/database.md`: nuláveis, TRIAGE, tabela ticket_read_state.
- `architecture/frontend.md`: tema grená, dashboard, sidebar retrátil, polling.
- Novas decisões: `decisions/ui-theme-grena.md`, `decisions/triagem-complexidade.md`,
  `decisions/notificacao-polling.md`.
- README.md (índice) + novo handoff de sessão.

---

## Não-objetivos (YAGNI agora)
- Drag-and-drop / layout persistido do dashboard (Fase 2).
- Notificação em tempo real (WebSocket).
- E-mail/SMTP (reset por link).
- Refresh token.
