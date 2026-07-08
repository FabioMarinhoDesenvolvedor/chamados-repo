# Handoff — 2026-07-07 (Multi-setorial Plano 3/4 — frontend)

## Contexto
Terceira frente do design guarda-chuva multi-setorial (Plano 1 = backend core, Plano 2 =
notificação por e-mail, **Plano 3 = frontend**, Plano 4 = totem). Branch de trabalho
`feat/multi-setorial-plano3` (a integrar em `feat/multi-setorial`), base `863d0dc`. A
**aprovação** (`requiresApproval`/`PENDING_APPROVAL`) já tinha sido **removida** do produto na
sessão anterior (ver `decisions/sla-dois-tempos-automatico.md`, que supera
`decisions/aprovacao-chamados.md`) — por isso este plano **não inclui UI de aprovação**: nunca
houve motivo pra construí-la, o backend não a produz mais.

## Decisões
- **Macro-bloco de setor é data-driven, sem lista curada**: o passo 0 do fluxo guiado gera um
  bloco pra todo `Department` que tenha ≥1 `TicketCategory` apontando pra ele
  (`TicketCategory.departmentId`), em vez de uma lista fixa dos 15 setores. Justificativa: hoje só
  ~3 setores têm categorias curadas; um setor sem categoria simplesmente não aparece, e o dia que
  ganhar uma, o bloco surge sozinho sem tocar código.
- **Ícone de setor por mapa + fallback**: `department-icon.ts` mapeia nome→ícone lucide só pros
  setores com entrada própria (TI, Manutenção, Limpeza); qualquer outro cai no fallback
  `Building2`. Evita ter que curar ícone pros 12 setores restantes agora.
- **Fila do dashboard some o "setor" apenas pra OPERATOR escopado**: ADMIN nunca é restrito por
  setor (regra já valia no RBAC do Plano 1), então o header do dashboard mantém "Chamados" pra
  ADMIN e vira "Fila — `<setor>`" só quando `user.role === 'OPERATOR' && user.departmentId != null`.

## O que mudou (3 commits, 863d0dc → 385dd08)
- `02ecd01` shared: `TicketCategory` ganha `departmentId: number | null` no tipo (a API já
  retornava o campo; só faltava expor no shared para o front filtrar por setor).
- `bb7a10a` web: passo 0 de macro-bloco (setor) no `NewTicketPage` —
  - `buildBlocks()` monta os blocos a partir de `categories` + `departments` (setores com ≥1
    categoria, ordenados por nome).
  - Escolhido o setor, o passo de categorias filtra por `departmentId` do bloco
    (`blockCategories`).
  - Breadcrumb ganha o nó "Setor" antes de "Categoria"; `backToBlocks()` novo pra navegação.
  - Novo `packages/web/src/lib/department-icon.ts` (mapa nome→ícone + fallback `Building2`).
  - `CategoryIcon.tsx` ganha 10 ícones que faltavam no registry (Armchair, Building2, DoorClosed,
    Hammer, ShowerHead, Snowflake, Sparkles, Trash2, Trees, Zap) — sem eles, categorias de
    Manutenção/Limpeza caíam no fallback genérico `HelpCircle`.
- `385dd08` web: header do `DashboardPage` mostra "Fila — `<setor>`" para OPERATOR escopado
  (busca o nome via `useDepartments()` + `user.departmentId`); ADMIN mantém "Chamados".

## Verificação executada
- Build `@chamados/shared` (`tsc --noEmit`): **limpo**.
- Build `@chamados/web` (`tsc --noEmit && vite build`): **limpo**.
- Cada uma das 3 tarefas foi revisada (spec + qualidade) e aprovada antes do commit seguinte.
- **PENDENTE (reportado como pendente, não como sucesso):** smoke real no navegador com banco no
  ar — abrir chamado como usuário de cada perfil e conferir passo de Setor → Categoria →
  Subcategoria → Detalhe, e o header "Fila — `<setor>`" pra um OPERATOR com `departmentId`. Papel
  do Fabio (ver CLAUDE.md "Verificação").
- Não há testes automatizados novos nesta frente (mudança é só de apresentação/navegação no
  front); nenhuma migration nova, nenhum teste de API quebrado.

## Pendências
- Smoke local (roteiro acima) e decisão de merge de `feat/multi-setorial-plano3` →
  `feat/multi-setorial` (ou direto em `main`, a critério do Fabio).
- **12 dos 15 setores ainda sem categoria curada** — não aparecem como bloco no fluxo guiado
  enquanto não tiverem ao menos 1 `TicketCategory` associada; e não têm ícone próprio em
  `department-icon.ts` (caem no fallback `Building2`). Não é bug, é reflexo direto do dado
  ainda não curado — mencionar ao Fabio se ele esperava ver os 15 setores hoje.
- **Plano 4 (totem)** — `User.isKiosk`, ainda não implementado. Próxima frente do design
  guarda-chuva multi-setorial.

## PRÓXIMO passo explícito
1. Fabio roda o smoke com o banco no ar (fluxo de abertura com os 4 passos + header de fila por
   setor) e decide o merge de `feat/multi-setorial-plano3`.
2. Depois: abrir ENTENDER → ESPECIFICAR → PLANEJAR → IMPLEMENTAR do **Plano 4 (totem)**, última
   frente do design multi-setorial.
