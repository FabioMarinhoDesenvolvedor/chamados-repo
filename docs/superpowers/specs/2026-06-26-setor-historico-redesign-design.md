# Setor na sessão + Histórico + Redesign Grená — Design

Data: 2026-06-26

## Objetivo
Três ajustes no app Chamados TI:
1. Travar o setor do chamado ao setor da sessão do usuário comum.
2. Confirmar histórico do usuário (sem mudança de backend).
3. Redesign visual com a nova paleta grená e layout mais coeso.

## 1. Setor travado na sessão
**Regra:** o setor de um chamado aberto por USER é sempre o setor do próprio usuário (fonte de verdade = sessão/banco). ADMIN tem acesso total e pode abrir para qualquer setor.

- **Frontend (`NewTicketPage`):**
  - USER: remover o `<select>` de departamento; exibir o setor da sessão como campo somente-leitura.
  - ADMIN: manter o `<select>` com todos os setores.
  - USER sem `departmentId`: bloquear o formulário com aviso "Seu usuário não tem setor; contate a TI".
- **Backend (`tickets.service.create`):**
  - Se `role === USER`: buscar o usuário pelo `requesterId` e usar `user.departmentId`, **ignorando** qualquer `departmentId` do payload. Se nulo → erro 400/403.
  - Se `role === ADMIN`: aceitar `dto.departmentId`.

## 2. Histórico do usuário
- O que já é gravado (chamado, mudanças de status incl. conclusão, comentários) permanece.
- `GET /tickets` para USER já retorna todos os chamados dele (sem filtro de status default), incluindo `RESOLVED`/`CLOSED`; o dashboard já os exibe.
- **Nenhuma mudança de código.** Item já coberto.

## 3. Redesign (paleta + layout)
Abordagem: refinar o sistema atual (não trocar de framework). Tokens centralizados no `tailwind.config.js`.

- **Paleta nova:**
  - `grena` `#6D1F3A` (109,31,58)
  - `grena-dark` `#5A1830` (90,24,48)
  - `grena-light` derivado `#8A2E4C`
  - `surface` `#F7F7F7` (branco gelo) · branco `#FFFFFF`
  - `shadow-grena` e `bg-grena-gradient` recalculados sobre `rgba(109,31,58,…)` (gradiente `135deg, #6D1F3A → #5A1830`).
- **Ícones:** adicionar `lucide-react` e substituir todos os emojis:
  - Dashboard → `LayoutDashboard`, Novo chamado → `Plus`, Usuários → `Users`,
    Departamentos → `Building2`, Sair → `LogOut`, menu mobile → `Menu`,
    colapsar sidebar → `ChevronLeft/Right`, não-lido → `Bell`, concluir → `Check`.
- **Coesão visual:**
  - Reduzir "glass/blur": cards passam a branco sólido + borda sutil (`border-gray-100`) + sombra leve.
  - Padronizar `components/ui` (button/card/badge/input/select/textarea): raio, espaçamento, foco grená consistentes.
  - Headings em `grena-dark`; cores de prioridade (verde/amarelo/vermelho/roxo) ajustadas.
  - Sidebar mantém gradiente grená refinado, item ativo mais claro, ícones SVG.
- **Mobile-first** (≥375px) preservado.

## Verificação
- Build dos 3 pacotes (`@chamados/shared`, `api`, `web`).
- Manual: USER abre chamado sem ver select (setor travado); API ignora/rejeita `departmentId` forjado por USER; ADMIN abre para qualquer setor; dashboard mostra resolvidos/fechados; revisão visual das telas.

## Fora de escopo
- Novos eventos de histórico; nova página "Meus chamados"; troca de framework de UI; testes automatizados.
