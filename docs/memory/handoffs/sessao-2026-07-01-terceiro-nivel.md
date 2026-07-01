# Handoff — 2026-07-01 (3º nível de categoria — "detalhe")

## Contexto
- Item 1 do backlog de 2026-06-30/07-01: adicionar um nível intermediário entre subcategoria e
  descrição, para reduzir texto livre. Branch `feat/terceiro-nivel-categoria` (8 commits, T1–T7 +
  spec). **Deploy é do usuário.** Só editado/testado localmente (build + testes de API).

## Decisões (validadas com o Fabio — ver [[terceiro-nivel-categoria]])
- Subcategoria tem **0..N** detalhes (data-driven, seed na migration). **Obrigatório quando
  existe**, proibido quando não existe.
- "Assunto" derivado ganha o 3º nível: "Categoria › Subcategoria › Detalhe".
- Coluna `base_complexity` (subcategoria + detalhe) criada nullable — ociosa até o Item 2
  (complexidade/SLA automáticos), não usada nesta sessão.

## Banco (migration `add_ticket_details`, não-destrutiva)
- Tabela `ticket_detail_options` (FK `subcategory_id`, `slug`, `name`, `icon`, `sort_order`,
  `base_complexity` nullable), análoga a `ticket_subcategories`.
- `tickets.detail_option_id` (nullable, FK ON DELETE SET NULL) + índice.
- Seed idempotente na própria migration: **46 detalhes** distribuídos pelas ~10 subcategorias
  que ganharam 3º nível (as demais seguem sem detalhe, vão direto para a descrição).

## Backend (NestJS)
- `GET /categories`: aninha `details` dentro de cada subcategoria (1 query, sem N+1).
- `POST /tickets`: aceita `detailOptionId?`; valida que o detalhe pertence à subcategoria
  informada; exige `detailOptionId` quando a subcategoria tem detalhes cadastrados; deriva o
  título de 3 níveis quando presente.
- Tipos compartilhados (`@chamados/shared`): `TicketDetailOption`, `detailOptionId`/`detailOption`
  usados de forma idêntica em DTO, service, repository e front.
- Testes node:test: +4 sobre a base anterior (título 3 níveis, subcategoria com detalhes exige
  `detailOptionId`, rejeita detalhe de outra subcategoria, subcategoria sem detalhes ignora/rejeita
  detalhe indevido — regressão).

## Frontend (React, lucide-react)
- Ícones do 3º nível registrados no `CategoryIcon` (registry explícito, sem lib nova).
- `NewTicketPage`: novo passo de grid de detalhes entre subcategoria e descrição, só quando a
  subcategoria escolhida tem detalhes; reusa `BlockCard`/breadcrumb/Voltar existentes. Ao voltar
  pela categoria no breadcrumb, o detalhe selecionado é limpo (fix aplicado).
- `TicketDetailPage`: chip de categoria agora mostra os 3 níveis quando há detalhe.

## Verificação (Task 8 — gate integrado)
- `npm run build` (shared → api → web): **limpo**, sem erros (tsc shared, nest build api,
  `tsc --noEmit` + vite build web — 1924 módulos, build em ~4.3s).
- `npm test -w @chamados/api`: **24/24 pass** (0 fail), incluindo os 4 testes novos do 3º nível.
- Smoke manual em browser **não executado nesta sessão** (ver pendência abaixo — restrição do
  ambiente Windows: subir `npm run dev` trava o Prisma em watch/EPERM).

## Pendências / deploy (usuário)

### Deploy (ordem)
1. `npm run db:generate`
2. `npm run db:deploy -w @chamados/api` (aplica a migration `add_ticket_details` +
   seed dos 46 detalhes via `prisma migrate deploy`)
3. `npm run build` (shared → api → web, nessa ordem)
4. Restart do serviço (systemd em srv-alv01)

Migration **não-destrutiva**: chamados antigos preservados (`detail_option_id` fica NULL).
Lembrete: o usuário de banco em produção/dev é **`chamados`** (não `postgres`).

### Smoke manual (rodar depois do deploy, ou localmente com `npm run dev` fora do Windows/CI)
- Abrir chamado em **Monitor** → aparece o grid de detalhes → escolher "Não liga" → concluir →
  o detalhe do chamado mostra o chip "Computador e Equipamentos › Monitor › Não liga" e o
  "Assunto" idêntico.
- Abrir chamado em **Redefinição de senha** (subcategoria sem detalhe) → pula direto para a
  descrição (confirma que a regressão de 2 níveis continua OK).
- Confirmar que tentar concluir "Monitor" sem escolher detalhe é impossível pela UI (grid
  obrigatório) — o backend também rejeita com 400 se `detailOptionId` faltar.

### Próximo item do backlog
- Item 2 (SLA/complexidade automáticos) segue pendente — mexe em decisão aprovada
  (`triagem-complexidade`), discutir com o Fabio antes de codar. O 3º nível já deixou a coluna
  `base_complexity` pronta (nullable) para quando esse item for implementado.
