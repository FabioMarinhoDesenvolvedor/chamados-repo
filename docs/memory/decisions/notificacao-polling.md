# Notificação de chamados por polling (não-lido)

Data: 2026-06-26

## Contexto
O usuário precisa saber, na tela, quando há novidade no seu chamado (comentário do admin ou
mudança de status). MVP é REST simples — sem WebSocket (ver [[auth-jwt]] e CLAUDE.md).

## Decisão
- **Denormalização** no ticket: `last_activity_at` e `last_activity_by`, atualizados em toda
  criação, mudança de status e comentário (dentro das transações do repository).
- Tabela **`ticket_read_state`** (user_id, ticket_id, last_seen_at, UNIQUE(user_id, ticket_id));
  `last_seen_at` é atualizado quando o usuário abre o detalhe do chamado (`GET /tickets/:id`).
- **hasUnread** = `last_activity_by != usuário` E (`sem read_state` OU `last_activity_at > last_seen_at`).
  Calculado no service; exposto em `GET /tickets` (por item) e `GET /tickets/unread/count` (total).
- Front: TanStack Query com `refetchInterval` de 20s no contador → badge no menu + marcador na lista.

## Consequências
- Notificação aparece em alguns segundos (não é instantânea) — aceitável no MVP.
- Sem infraestrutura de tempo real. Migrar para WebSocket só se o requisito mudar (Fase 2).
- A leitura é eficiente (sem N+1): a lista busca os read_states do usuário em uma query e mescla.
