# Handoff — 2026-07-01 (Prazo/complexidade automáticos — Item 2)

## Contexto
- Bug do Fabio: "Prazo" travado em "Em triagem" ao mudar a ação pelo dashboard; chamado não
  ganhava prazo nem no dash nem no detalhe. Debug sistemático → causa raiz (ver decisão
  [[prazo-complexidade-automatica]]).
- Branch: `fix/prazo-triagem-automatico` (stacked sobre `feat/terceiro-nivel-categoria`). Pushed.
- **Deploy é do usuário.** Só editado/testado local (docker `chamados-db` + `npm run dev`).

## Entregue
### Código (commit e2e4b29)
- `TicketsService.create()`: complexidade-base automática (detalhe › subcategoria › MÉDIA) +
  prioridade pela matriz com peso do setor; chamado nasce OPEN com `sla_started_at` na criação;
  retorna já projetado (SLA), como update()/updateStatus().
- `TicketsRepository.createWithHistory()`: grava complexity/priority, status OPEN, `sla_started_at`,
  histórico null→OPEN.
- +3 testes node:test (nasce priorizado; base da subcategoria; precedência do detalhe). **27/27**.

### Migrations (dados, não-destrutivas; aplicadas no dev via psql + `migrate resolve --applied`)
- `20260701160000_backfill_priorizar_triagem`: chamados com priority nula OU sla_started_at nulo OU
  em TRIAGE → priorizados/OPEN (complexidade MÉDIA default). Backfill de 16 no dev; 0 presos depois.
- `20260701170000_curar_complexidade_base`: complexidade-base curada em 33 subcategorias + 13
  overrides de detalhe (ex.: sistema-indisponível=CRÍTICA, "não liga"=ALTA, redefinição-senha=BAIXA).

## Verificação
- `npm test -w @chamados/api` **27/27**; `npm run build -w @chamados/api` limpo.
- Backfill: `SELECT` → 0 sem prioridade, 0 sem sla_started_at, 0 em TRIAGE.
- Smoke ao vivo (admin): chamado novo → OPEN, prazo preenchido; lista → 0 sem prazo, 0 TRIAGE.
  sistema-indisponível (peso 3) → complexity CRITICAL, priority URGENT, slaHours 1. Test tickets limpos.

## Deploy (pendente — usuário)
- Sem mudança de schema (só dados). Ordem: aplicar as 2 migrations em produção via
  `npm run db:deploy -w @chamados/api` (migrate deploy roda os UPDATE de backfill + curadoria) →
  build `shared→api→web` → restart. DB user de dev é `chamados` (não postgres).
- Como a base_complexity nasceu no Item 1 (branch feat/terceiro-nivel-categoria), esta branch
  depende dela — integrar Item 1 antes/junto.

## Pendências / próximo
- **Simplificar a abertura p/ usuários leigos** (pedido do Fabio, 2026-07-01): o 3º nível que pede a
  causa (ex.: "sem conexão" → cabo/Wi-Fi/ponto/setor) é diagnóstico que o usuário simples não sabe.
  Abertura não pode ser complexa. → revisar o 3º nível (tornar opcional / repensar os "detalhes"
  de causa). Fabio deu OK para mudar. **A tratar na sequência.**
- Refinar a curadoria da complexidade-base se algum tipo estiver mal calibrado.
