# Handoff — 2026-07-05 (Prompt Template v2 — bootstrap greenfield)

## Contexto
Sessão só de documentação (nenhum código tocado). Pedido do Fabio: transformar todo o
conhecimento de processo acumulado neste projeto (sistema de memória, workflow
spec→plan→implement, verificação, handoffs) em um **prompt template de bootstrap**
reutilizável para qualquer projeto greenfield futuro (site, e-commerce, sistema).

## O que mudou
- `docs/PROMPT-TEMPLATE.md` reescrito por completo (v1 era um esboço de ~60 linhas; v2
  é o template comprehensivo). Fontes combinadas:
  1. Práticas reais deste repo: Regra Zero, estrutura `docs/memory/` (architecture/
     decisions/gotchas/procedures/handoffs com formatos por tipo), documentação em duas
     camadas (`docs/memory` p/ agente vs `docs/projeto` p/ humanos), workflow de 4 fases
     (brainstorm → spec → plan → implement), planos numerados p/ trabalho grande,
     verificação com evidência (build + testes com número real + smoke test real),
     gotchas de migration/seed generalizados como exemplo.
  2. Akita (akitaonrails.com): framework objetivo/método/restrições/validação
     ("Como falar com o Claude Code efetivamente", abr/2026), "Clean Code pra Agentes
     de IA" (arquivos <500 linhas, nomes buscáveis, tipagem explícita, comentários de
     porquê, comandos padronizados) e "Boas práticas de projetos com LLM — O Mínimo"
     (padronização → automação confiável; README orientado a problema).
- Estrutura do template: prompt colável com Seção 0 de briefing ([PLACEHOLDERS]) +
  10 seções de contrato + primeira tarefa que manda o agente entrevistar, propor
  fundação, e só então criar repo + memória + CLAUDE.md/AGENTS.md destilados.
- Filosofia explícita: o prompt de bootstrap é usado UMA vez; depois o CLAUDE.md
  gerado governa; projeto é iterativo por meses.
- **Template aplicado de volta neste projeto** (pedido do Fabio na mesma sessão):
  - `CLAUDE.md` reescrito: ganhou as Quatro Coisas do pedido (objetivo/método/
    restrições/validação), Workflow de Feature em 4 fases com gates, regras de código
    legível por agente (<500 linhas, nomes buscáveis, erro com contexto), seção
    Verificação (evidência: build + testes com número real + smoke real; deploy é do
    Fabio), documentação em duas camadas, ritual de fim de sessão detalhado e regra
    de realimentação (erro por falta de contexto vira gotcha/ajuste no CLAUDE.md).
  - `AGENTS.md` atualizado como resumo operacional do CLAUDE.md (contrato das 4
    coisas, fluxo com spec/plano, proibições novas: sucesso parcial como sucesso,
    deploy/db:reset pelo agente).

## Verificação
N/A — só markdown; nenhum build/teste aplicável.

## Pendências
- Nenhuma nova. Pendências anteriores permanecem (ver handoff 2026-07-02: revisão
  final da branch `feat/multi-setorial`, Planos 2–4, deploy do Plano 1).
- PRÓXIMO (desta linha de trabalho): quando o Fabio iniciar um projeto novo, usar o
  template e refinar o que a prática mostrar (o template é vivo, como tudo aqui).
