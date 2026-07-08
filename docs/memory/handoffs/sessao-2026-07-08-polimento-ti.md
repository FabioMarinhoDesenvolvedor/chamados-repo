# Handoff — 2026-07-08 (polimento pós-deploy: resíduos de TI-core)

> Sessão curta de correções/UX depois que TI virou o core em produção. 4 itens pedidos pelo
> Fabio, todos na `main` local (deploy pendente — é dele). Ver âncora `docs/projeto/00-estado-atual.md`.

## Contexto
Depois de estacionar Manutenção/Limpeza (só TI no ar), sobraram resíduos de UX/regra:
categoria poluída nos filtros, status do dashboard sem "Concluído", avaliação perdida quando o
admin encerra direto, e o card de setor "TI" encostado à esquerda. Confirmei as 2 ambiguidades
(#2 e #3) com o Fabio via pergunta antes de codar (feedback do handoff anterior: confirmar antes de agir).

## O que mudou (4 itens)
1. **Filtro de categoria só com setores no ar** — helper `visibleCategories(categories, departments)`
   em `web/src/lib/blocks.ts` (reusa `PARKED_DEPARTMENTS`), aplicado aos dropdowns de categoria do
   **Relatório** (`admin/ReportsPage.tsx`) e do **Dashboard**. Categorias de Manutenção/Limpeza
   (estacionados) somem do filtro — hoje sobra só TI.
2. **Status até "Concluído" no dashboard** — helper único `staffStatusOptions(isAdmin, current)`
   em `web/src/lib/labels.ts` (DRY), usado no **detalhe E no dashboard**. ADM agora leva o chamado
   até "Concluído" (CLOSED) direto da lista (coluna "Ação"), sem abrir a página. Removido o antigo
   `QUICK_STATUSES` (que ia só até RESOLVED). Página do chamado mantida (comentários).
3. **Solicitante avalia mesmo após o admin encerrar** — se o ADM força `CLOSED` sem passar por
   RESOLVED, o solicitante ainda pode avaliar **uma vez**:
   - Backend `close()`: aceita `CLOSED` sem nota → grava só a avaliação (`repo.setRating`, sem
     mudar status/histórico). Rejeita re-avaliação (já tem nota) e exige nota nesse caso.
   - Projeção `hideByRole` expõe booleano derivado **`rated`** (nunca a nota; a nota segue oculta
     ao USER). Tipo `Ticket.rated?: boolean` em `@chamados/shared`.
   - Front (`TicketDetailPage`): card de avaliação aparece p/ o solicitante em `RESOLVED` (como
     antes) OU `CLOSED && rated === false`. Texto/botão adaptam ("Concluir chamado" vs "Enviar
     avaliação"); avaliar um já-concluído exige estrela (botão desabilitado sem nota).
4. **Card "TI" centralizado** — passo de Setor do `NewTicketPage` deixou de ser grid de 3 colunas
   (um card só encostava à esquerda "como se faltasse algo") e virou `flex flex-wrap justify-center`
   com cards `w-full sm:w-60`. `BlockCard` ganhou prop `className` (via `cn`). Só o passo de Setor
   mudou; categorias/subcategorias (que têm vários itens) seguem em grid.

## Verificação executada
- Build limpo na ordem: `shared` ✓ · `api` (nest build) ✓ · `web` (tsc --noEmit + vite build) ✓.
- Testes da API: **100/100 pass** (antes 97; +3 de close-em-CLOSED e ajuste dos 3 de `hideByRole`
  p/ o novo `rated`). Comando: `npm test -w @chamados/api`.
- **PENDENTE (é do Fabio):** smoke com banco no ar — não há Postgres neste ambiente (regra do
  projeto: `db:deploy`/`db:reset` e smoke real são do Fabio). Fluxos a validar no navegador:
  (a) relatório/dashboard só mostram categorias de TI; (b) ADM marca "Concluído" pela lista do
  dashboard; (c) ADM encerra direto → solicitante vê card de estrelas e avalia 1×, depois some;
  (d) abrir novo chamado → card "TI" centralizado.

## Sem migration / sem mudança de banco
Nada tocou schema/migration. `rated` é derivado em runtime. Deploy = `git pull` → build (shared→
api→web) → restart `chamados.service`. Sem `migrate deploy` desta vez.

## PRÓXIMO passo
Fabio: smoke dos 4 fluxos acima com o banco no ar; se ok, deploy (só build + restart, sem migration).
