# Project Memory — Chamados TI

## Architecture
- architecture/backend.md
- architecture/frontend.md
- architecture/database.md
- architecture/business-rules.md

## Decisions
- decisions/use-postgresql.md
- decisions/use-typescript.md
- decisions/monorepo-structure.md
- decisions/use-nestjs.md
- decisions/use-prisma.md
- decisions/use-react-vite.md
- decisions/auth-jwt.md
- decisions/enum-strategy.md
- decisions/password-hashing.md
- decisions/triagem-complexidade.md  ← SUPERADA por prazo-complexidade-automatica
- decisions/prazo-complexidade-automatica.md
- decisions/notificacao-polling.md
- decisions/ui-theme-grena.md
- decisions/anexos-imagens.md
- decisions/terceiro-nivel-categoria.md
- decisions/rbac-setor-executor.md
- decisions/aprovacao-chamados.md  ← SUPERADA por sla-dois-tempos-automatico
- decisions/notificacao-hibrida-email.md
- decisions/sla-dois-tempos-automatico.md
- decisions/ids-sequenciais-inteiros.md
- decisions/totem-kiosk-auth.md

## Gotchas
- gotchas/responsividade.md
- gotchas/shared-cjs-rollup.md
- gotchas/windows-brace-expansion.md
- gotchas/postgres-enum-default.md
- gotchas/migration-seed-ordem-vs-entidade-existente.md
- gotchas/baseline-consolidado-perde-dados-de-migration.md
- gotchas/dado-de-referencia-no-seed-quebra-skip-seed.md

## Procedures
- procedures/setup-local.md
- procedures/release-process.md

## Handoffs
- handoffs/sessao-2026-06-25.md
- handoffs/sessao-2026-06-26.md
- handoffs/sessao-2026-06-26-bloco6.md
- handoffs/sessao-2026-06-26-bloco7.md
- handoffs/sessao-2026-06-27-vault-backup-reports.md
- handoffs/sessao-2026-06-29.md
- handoffs/sessao-2026-06-30.md
- handoffs/sessao-2026-06-30-correcoes.md
- handoffs/sessao-2026-06-30-categorias.md
- handoffs/sessao-2026-07-01-backlog.md  ← PENDÊNCIAS (Item 2: SLA/complexidade automáticos)
- handoffs/sessao-2026-07-01-terceiro-nivel.md  ← Item 1 entregue (3º nível de categoria/detalhe); deploy pendente
- handoffs/sessao-2026-07-01-prazo-automatico.md  ← Item 2: prazo/complexidade automáticos; deploy pendente. PRÓXIMO: simplificar abertura p/ leigos
- handoffs/sessao-2026-07-02-multi-setorial-plano1.md  ← Plano 1/4 (backend core multi-setorial) completo; deploy pendente. PRÓXIMO: Planos 2-4 (notificação, frontend, totem) + revisão final de branch
- handoffs/sessao-2026-07-05-prompt-template-v2.md  ← docs/PROMPT-TEMPLATE.md reescrito (bootstrap greenfield v2, práticas do repo + Akita); só documentação
- handoffs/sessao-2026-07-06-revisao-plano1.md  ← Revisão final do Plano 1: 2 bugs corrigidos (gate de aprovação + unread por setor), 48/48 testes. PENDENTE: smoke com banco no ar + decisão de merge
- handoffs/sessao-2026-07-06-plano2-notificacao.md  ← Plano 2/4 COMPLETO (notificação por e-mail, outbox+worker+stub, 58/58). PENDENTE: smoke com banco no ar. Import de usuários reais parkeado; Planos 3-4 pendentes
- handoffs/sessao-2026-07-07-sla-dois-tempos.md  ← SLA de dois tempos (resposta+conclusão) COMPLETO, 89/89. PENDENTE: db:generate/migrate + smoke com banco no ar (Fabio); revisão final whole-branch a anexar. PRÓXIMO: smoke, depois IDs sequenciais (frente própria) e Planos 3-4 do multi-setorial
- handoffs/sessao-2026-07-07-ids-inteiros.md  ← IDs inteiros (UUID→Int, começa em 1) em código + baseline offline COMPLETOS, 89/89 (implementados por Codex, revisados por Claude). PENDENTE: reset/migrate + smoke (Fabio). Inclui limpeza de resíduos de triagem (fora do escopo original — ver handoff)
- handoffs/sessao-2026-07-07-multi-setorial-plano3.md  ← Plano 3/4 do multi-setorial COMPLETO (frontend: passo de Setor no fluxo guiado + fila por setor no dashboard, data-driven, sem aprovação). Builds shared/web limpos. PENDENTE: smoke com banco no ar (Fabio) + decisão de merge. PRÓXIMO: Plano 4 (totem)
- handoffs/sessao-2026-07-08-totem-plano4.md  ← Plano 4/4 do multi-setorial COMPLETO (totem/kiosk: User.isKiosk + JWT 365d admin-emitido, originLocation só de kiosk). 97/97 testes, builds limpos. Os 4 planos do design guarda-chuva multi-setorial estão implementados. PENDENTE: smoke com banco no ar (Fabio); 12 setores sem categoria curada. PRÓXIMO: smoke + revisão final whole-branch + merge para main + deploy
- handoffs/sessao-2026-07-08-deploy-ti-estacionamento.md  ← DEPLOY EM PRODUÇÃO (srv-alv01, chamados.service, porta 8080) + incidente TI (--skip-seed pulou TI/RH do seed → fix em migration d2e4113) + decisão: TI é o core no fluxo, Manutenção/Limpeza ESTACIONADOS (PARKED_DEPARTMENTS em web/lib/blocks.ts). Ver docs/projeto/00-estado-atual.md (âncora). CONCLUÍDO em prod (2026-07-08): TI de volta no fluxo, 15 setores, Manut/Limpeza ocultos
- handoffs/sessao-2026-07-08-polimento-ti.md  ← POLIMENTO pós-deploy (4 itens): filtro de categoria só TI (visibleCategories), status até "Concluído" no dashboard (staffStatusOptions, DRY detalhe+dashboard), solicitante avalia após admin encerrar (close() aceita CLOSED + flag derivada `rated`), card "TI" centralizado no passo de Setor. 100/100 testes; SEM migration. PENDENTE: smoke com banco (Fabio) + deploy (só build+restart)
