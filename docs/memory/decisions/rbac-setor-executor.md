# RBAC por setor executor (multi-setorial)

Data: 2026-07-02
Estende: sem contradizer o modelo de papéis existente (ADMIN/USER/OPERATOR fixo, `isStaffRole`).

## Contexto
Evolução do sistema de 1 setor (TI) para 15 setores (clube multi-departamental). Chamados agora
têm dois departamentos possíveis: `departmentId` (setor do **solicitante**, já existia, alimenta a
matriz de prioridade) e `executorDepartmentId` (setor **executor**, novo — quem atende o chamado).
Precisava de uma forma de um OPERATOR só ver/agir nos chamados do próprio setor, sem criar papéis novos.

## Decisão (aprovada por Fabio em 2026-07-02)
- **Campo separado, não reaproveitado**: `Ticket.executorDepartmentId` é uma FK nova, distinta de
  `departmentId`. A matriz de prioridade continua usando o peso do setor do **solicitante**
  (`departmentId`) — roteamento/aprovação não alteram esse cálculo.
- **RBAC via `User.departmentId` existente** (já existia, sem uso até então): um `OPERATOR` com
  `departmentId` preenchido só vê/age em chamados cujo `executorDepartmentId` bate com o seu. Um
  `OPERATOR` sem `departmentId` (equipe "global", ex. TI original) vê tudo — regressão preservada.
- **ADMIN nunca é restrito por setor**, em nenhuma circunstância — decisão explícita do Fabio.
- **`AuthUser.departmentId`/`isKiosk` propagados via `JwtStrategy.validate()`**, que já busca o
  usuário no banco a cada request — zero query nova.
- `Department` ganha 4 flags novas: `isRequesterDept`, `isExecutorDept`, `requiresApproval`,
  `notificationEmail` (1 e-mail por setor, nullable — usado pela notificação híbrida, Plano 2).
- Guarda de exclusão de `Department` reforçada: `remove()` agora bloqueia também se há
  `TicketCategory.departmentId` ou `Ticket.executorDepartmentId` apontando pro setor (antes só
  considerava `Ticket.departmentId`/`User.departmentId`).

## Consequências
- `TicketsService.ensureCanView()` mudou de assinatura — passa a receber o ticket inteiro
  (`{requesterId, executorDepartmentId}`), não só o id, para poder checar o setor. Todos os call
  sites (`detail`, `addAttachments`, `getAttachmentFile`, `addComment`, `assign`, `updateStatus`)
  foram auditados e atualizados.
- Roteamento: `TicketCategory.departmentId` é a fonte de verdade de "pra qual setor esse tipo de
  chamado vai" — `TicketsService.create()` resolve `executorDepartmentId` a partir dela.
- **Chamados legados ficam com `executorDepartmentId = NULL`** (coluna aditiva, sem backfill —
  decisão mantida por Fabio na revisão final do Plano 1, 2026-07-06). É seguro **enquanto a TI
  original seguir como equipe global sem `departmentId`** (vê tudo, inclusive NULL). **Risco
  latente:** se um dia um operador de TI ganhar `departmentId` (escopar a TI), os chamados
  legados NULL somem da fila dele — nesse momento é obrigatório rodar um backfill aditivo
  (`UPDATE tickets SET executor_department_id = (SELECT id FROM departments WHERE name='TI')
  WHERE executor_department_id IS NULL`; 0 linhas em banco novo).
- Ver também: [[aprovacao-chamados]], business-rules.md (seção "RBAC de setor executor").
