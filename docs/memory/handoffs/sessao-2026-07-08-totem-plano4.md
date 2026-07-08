# Handoff — 2026-07-08 (Multi-setorial Plano 4/4 — totem)

## Contexto
Última frente do design guarda-chuva multi-setorial (Plano 1 = backend core, Plano 2 =
notificação por e-mail, Plano 3 = frontend, **Plano 4 = totem**). Branch de trabalho
`feat/multi-setorial-plano4-totem` (a integrar em `feat/multi-setorial`). Objetivo: um dispositivo
físico fixo (tablet/terminal num corredor) que abre chamados sem login manual por pessoa,
capturando o local/sala de origem.

## Decisões
- **Sem role nova**: o totem é um `User` comum (`role='USER'`) com a flag `isKiosk=true` (coluna
  já existia desde o Plano 1, sem uso até agora). Ver decisão nova
  `decisions/totem-kiosk-auth.md` (estende `decisions/auth-jwt.md`).
- **Provisionamento por JWT de 365d emitido por admin** (`POST /auth/kiosk-token`), upsert do
  `User` kiosk por e-mail derivado estável (`totem-<slug>@kiosk.local`), senha inutilizável
  (hash de `randomUUID()`). Revogação = apagar o `User`.
- **`originLocation` só de solicitante kiosk**: obrigatório (400 se vazio) quando
  `user.isKiosk===true`; ignorado (`null`) para usuário comum, mesmo se enviado.
- **Bloco de setor "TI" excluído no totem**: o totem normalmente é operado pela própria TI, não
  faz sentido abrir chamado contra o próprio setor.
- Ambas as decisões documentadas também em `docs/memory/architecture/business-rules.md` (seção
  nova "Totem/kiosk (Plano 4)").

## O que mudou (5 commits)
- `fb262aa` shared: tipos `CreateKioskTokenInput`/`KioskTokenResponse` + `CreateTicketInput.originLocation?`.
- `72cb1c9` api: `POST /auth/kiosk-token` (admin-only, guardas `JwtAuthGuard`+`RolesGuard`+
  `MustChangePasswordGuard`) → upsert de um `User` kiosk + JWT `expiresIn:'365d'`.
- `c79965c` api: `create()` captura `originLocation` — obrigatório p/ solicitante kiosk (400 se
  vazio), ignorado (null) p/ usuário comum.
- `82ac85e` web: rota `/totem` (pública, fora do `<Private>`), auto-autenticada pelo token do
  kiosk (mesma chave `chamados.token`; `/totem?token=` guarda e recarrega). Fluxo kiosk:
  Local → Setor (blocos data-driven menos TI) → Categoria → Subcategoria → Detalhe(opcional) →
  Descrição(opcional) → Concluir → confirmação + auto-reset (~8s).
- `9e2927d` web: painel admin `/admin/totem` gera o token e mostra a URL
  `${origin}/totem?token=…` + Copiar; link "Totem" no menu admin.

Sem migration nesta frente — `User.isKiosk` e `Ticket.originLocation` já existiam no schema desde
o Plano 1.

## Verificação executada
- `npm test -w @chamados/api`: **97/97 pass**.
- Builds `shared`/`api`/`web`: **limpos**.
- Cada uma das 5 tarefas foi revisada (spec + qualidade) e aprovada antes do commit seguinte.
- **PENDENTE (reportado como pendente, não como sucesso):** smoke real no navegador com banco no
  ar — gerar token em `/admin/totem`, abrir `/totem?token=…`, confirmar auto-login, e criar um
  chamado completo (Local → Setor → Categoria → Subcategoria → Concluir) verificando que
  `originLocation` foi gravado e o setor "TI" não aparece no passo de Setor. Papel do Fabio (ver
  CLAUDE.md "Verificação").

## Pendências
- Smoke local (roteiro acima) e decisão de merge de `feat/multi-setorial-plano4-totem` →
  `feat/multi-setorial` (e desta, eventualmente, para `main`).
- **12 dos 15 setores ainda sem árvore de categoria curada** (só TI/Manutenção/Limpeza têm) —
  pendência conhecida desde o Plano 3, segue como backlog (não é bug desta frente).
- Com os 4 planos completos, falta uma **revisão final whole-branch** de
  `feat/multi-setorial` antes do merge para `main` e deploy em produção.

## PRÓXIMO passo explícito
1. Fabio roda o smoke com o banco no ar (roteiro acima) e decide o merge de
   `feat/multi-setorial-plano4-totem` → `feat/multi-setorial`.
2. Revisão final whole-branch de `feat/multi-setorial` (Planos 1-4 juntos) antes do merge para
   `main`.
3. Merge para `main` + deploy em produção (Fabio executa, conforme CLAUDE.md).
