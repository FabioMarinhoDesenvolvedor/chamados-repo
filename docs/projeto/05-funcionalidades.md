# 05 — Funcionalidades

Cada recurso, explicado de ponta a ponta (o que faz, onde vive, como funciona).

## 1. Abertura e ciclo de vida do chamado

- **Web:** `pages/NewTicketPage.tsx` (formulário) → `features/tickets/api.ts`.
- **API:** `POST /tickets` → `TicketsService.create`.
- Usuário informa título, descrição e departamento. O **admin pode abrir em nome de outro
  usuário** via campo "Solicitante" (`requesterId`) — útil quando o usuário não consegue.
- Chamado nasce em **TRIAGE** (`complexity`/`priority` nulos).

## 2. Triagem e prioridade automática

- **API:** `PATCH /tickets/:id` (admin) define `complexity` (e opcionalmente troca o depto).
- `PriorityService` calcula a prioridade pela **matriz fixa** (complexidade × peso do
  departamento) e move `TRIAGE → OPEN`, registrando no histórico. Recalcula se complexidade ou
  departamento mudarem.

| complexity ↓ \ peso → | Baixo (1–2) | Médio (3) | Alto (4–5) |
|------------------------|-------------|-----------|------------|
| LOW | LOW | LOW | MEDIUM |
| MEDIUM | LOW | MEDIUM | HIGH |
| HIGH | MEDIUM | HIGH | URGENT |
| CRITICAL | HIGH | URGENT | URGENT |

🟢 LOW · 🟡 MEDIUM · 🔴 HIGH · 🟣 URGENT.

## 3. Acompanhamento, status e atribuição

- **Detalhe:** `pages/TicketDetailPage.tsx`. Timeline unificada (histórico de status +
  comentários em ordem cronológica).
- Admin avança status (`PATCH /tickets/:id/status`) e atribui responsável
  (`PATCH /tickets/:id/assign`, sempre um admin).
- **Bloqueio pós-conclusão:** depois de `RESOLVED`/`CLOSED`, o **USER não pode mais comentar**
  (`TicketsService.addComment` lança 403). Admin segue podendo.

## 4. Notificação de não-lidos (polling)

- `ticket_read_state` guarda `last_seen_at` por usuário/chamado.
- Há novidade quando `last_activity_at > last_seen_at`.
- **Web:** `useUnreadCount` faz polling de `GET /tickets/unread/count`; badge no menu (sidebar e
  header mobile).

## 5. Anexos de imagem (prints)

Recurso central para "ver o problema". Suporta **três formas de anexar**, todas no
`components/AttachmentInput.tsx`:

1. **Clique** no seletor de arquivos.
2. **Ctrl+V** — cola um print direto (listener de `paste` no documento).
3. **Arrastar e soltar** sobre a área (drag-and-drop).

Regras: só imagens, até **5 arquivos**, **5MB** cada. Anexos podem ser do **chamado** ou de um
**comentário** específico (`commentId`).

- **Upload:** `POST /tickets/:id/attachments` (multipart). O service cifra cada arquivo e grava
  `<uuid>.enc` no cofre; só metadados vão ao banco.
- **Exibição:** `components/AttachmentThumb.tsx` busca a imagem **autenticada**
  (`GET .../attachments/:id`, responseType blob), pois não há URL pública; mostra placeholder
  enquanto carrega e "indisponível" em erro. `AttachmentGallery.tsx` agrupa os thumbs.
- Exige o **cofre desbloqueado** (senão 423). Ver [06 — Segurança](06-seguranca.md).

## 6. Relatórios de atividade (PDF)

- **Web:** `pages/admin/ReportsPage.tsx` (admin). Escolhe **usuário** e período (**De/Até**, com
  date pickers de calendário) e clica em **Gerar**.
- **API:** `GET /reports/user-activity` agrega, para o usuário no período: chamados **abertos**,
  **mudanças de status** (incl. conclusão) e **comentários**, com os **anexos** relacionados.
- Resultado **agrupado por mês** (evita relatório gigante), mostrando quem, horário, chamado e
  miniaturas dos anexos. Botão imprime via `window.print()` — a navegação tem `print:hidden`,
  gerando um PDF limpo.

> Para corrigir/auditar um log manualmente, o caminho é o banco (`ticket_status_history`,
> `ticket_comments`) — não há tela de edição de log por design (integridade do histórico).

## 7. Usuários e departamentos (admin)

- **Usuários:** `pages/admin/UsersPage.tsx` — criar, editar, **excluir** (botão vermelho com
  confirmação; oculto para o próprio usuário; erros de FK exibidos via `apiMessage`).
- **Departamentos:** `pages/admin/DepartmentsPage.tsx` — criar e **excluir** (bloqueado se houver
  usuários/chamados vinculados).

## 8. Senhas e primeiro acesso

- **Primeiro acesso:** todo usuário criado pelo admin nasce com `mustChangePassword = true`. Na
  tela de login há o modo **"Primeiro acesso"** (`pages/LoginPage.tsx`): o usuário informa o
  **e-mail** e define a senha (`POST /auth/first-access`), entrando já autenticado.
- **Troca voluntária:** atalho de **engrenagem ⚙ "Configurações"** no rodapé da sidebar
  (`AppShell.tsx`) → `pages/ChangePasswordPage.tsx` → `POST /users/me/password`.
- **`ProtectedRoute`** força a ida a `/change-password` enquanto `mustChangePassword` for true.

## 9. Cofre de anexos (criptografia)

Admin desbloqueia o cofre com a **senha-mestra** (`VaultBanner.tsx` → `POST /vault/unlock`).
Sem isso, anexos não podem ser enviados nem vistos. Detalhes em [06 — Segurança](06-seguranca.md).

## 10. Backup do banco

Dump SQL comprimido (`.sql.gz`), automático às 02:00 e sob demanda. Tela admin em
`pages/admin/BackupPage.tsx`. Detalhes em [07 — Operação e deploy](07-operacao-deploy.md).
