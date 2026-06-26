# Regras de Negócio — Chamados TI

## Perfis de Acesso (2 perfis)
- **user**: abre chamados e acompanha os próprios.
- **admin**: atende, gerencia e vê todos os chamados. `tickets.assigned_to` é SEMPRE um admin.
- Enum `role` permanece `'admin' | 'user'` (sem 'tecnico' no MVP).

## Visibilidade de Chamados
- **user**: vê apenas os chamados que ele mesmo abriu (`requester_id = user`).
- **admin**: vê todos os chamados.
- Aplicar a regra no service/repository (filtro por role), nunca confiar só no front.

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
- Concluir chamado = mudar status para `resolved` (botão ✓ no dashboard e no detalhe).
