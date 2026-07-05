# CLAUDE.md — Chamados TI

## Regra Zero
Antes de qualquer tarefa, SEMPRE:
1. Leia `docs/memory/README.md`
2. Consulte decisões relacionadas em `docs/memory/decisions/`
3. Consulte gotchas relevantes em `docs/memory/gotchas/`
4. Leia o último handoff em `docs/memory/handoffs/`
5. Nunca contradiga decisões existentes sem discutir antes. Decisão superada não é
   apagada: ganha `← SUPERADA por <nova>` no índice e link na decisão nova.

## As Quatro Coisas de Todo Pedido
Toda tarefa carrega quatro coisas — exija as quatro antes de implementar (pergunte se faltar):
1. **Objetivo** — o resultado final em linguagem simples.
2. **Método** — a abordagem preferida (pode propor melhor, com justificativa).
3. **Restrições** — o que NÃO fazer. Default "razoável" que contradiz o projeto é bug.
4. **Validação** — como provar que funcionou (comando, teste, smoke, critério).

Nunca preencher lacuna de regra de negócio com suposição silenciosa — perguntar antes.

## Workflow de Feature — nunca codar direto
Feature não-trivial segue 4 fases, com gate entre elas:
1. **ENTENDER** — brainstorm; perguntas de negócio antes de proposta técnica.
2. **ESPECIFICAR** — spec em `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md`
   (problema, solução, alternativas descartadas, impacto). Aprovação do Fabio antes de seguir.
3. **PLANEJAR** — plano em `docs/superpowers/plans/`, tarefas pequenas com critério de
   verificação próprio. Trabalho grande vira planos numerados (ex.: "Plano 1/4").
4. **IMPLEMENTAR** — só agora. Decisão nova no meio vira arquivo em `decisions/` na hora.

Exceção: correção trivial e inequívoca pula para 4; qualquer ambiguidade volta para 1.

## Princípios de Código
- **KISS**: soluções simples. Se parece over-engineered, é.
- **DRY**: lógica duplicada vira função/hook/service. Sem copiar e colar.
- **SOLID**: cada módulo/classe/componente tem uma responsabilidade.

Código legível por agentes (e por humanos):
- Arquivos < 500 linhas; funções pequenas (idealmente 4–20 linhas).
- Nomes distintivos e buscáveis (`TicketApprovalService`, não `Handler`/`Manager`).
- Tipagem explícita — TypeScript strict, sem `any`.
- Comentário diz o PORQUÊ (workaround, restrição de negócio); nunca repete o código.
- Mensagem de erro com contexto: valor recebido + esperado, nunca `"invalid"` seco.
- Aninhamento raso; injeção de dependência para testabilidade.

## Convenções
- Linguagem: TypeScript (strict mode)
- Package manager: NPM com workspaces
- Monorepo: `packages/api`, `packages/web`, `packages/shared`
- Tipos compartilhados vivem em `@chamados/shared` — nunca duplicados entre camadas
- Nomes de arquivo: kebab-case (`ticket-service.ts`)
- Nomes de variável/função: camelCase
- Nomes de tipo/interface: PascalCase
- Enums: PascalCase com valores UPPER_SNAKE_CASE
- Commits: conventional commits com escopo (`feat(api):`, `fix:`, `chore:`, `docs:`)

## Responsividade
Tudo é mobile-first. Componente sem responsividade = incompleto.
Viewport mínimo: 375px.

## Banco de Dados
- PostgreSQL
- Migrations versionadas (nunca alterar migration já rodada)
- Seeds idempotentes para desenvolvimento; seed de dev NUNCA roda em produção
- Migration de dado que referencia entidade criada pelo seed: replicar backfill
  idempotente no `seed.ts` (ver gotcha `migration-seed-ordem-vs-entidade-existente`)
- Valor novo de enum Postgres exige migration isolada (ver gotcha `postgres-enum-default`)

## Verificação — evidência antes de afirmação
"Funciona" exige prova executada:
1. Build limpo na ordem de dependência (shared → api → web).
2. Testes com número real (`44/44 pass`), nunca "os testes passam".
3. Smoke test real do fluxo afetado (`npm run dev` + curl/navegador) — teste unitário
   mockado não substitui; migrations/integração/config só quebram no sistema real.
4. Dados de teste temporários limpos ao final.
5. Falha ou passo pulado é reportado explicitamente no handoff — nunca como sucesso.

**Deploy em produção é do Fabio** — preparar, testar localmente e documentar a ordem
exata dos passos no handoff; quem executa é ele (idem `db:deploy`/`db:reset` neste ambiente).

## Documentação em duas camadas
- `docs/memory/` — continuidade entre sessões de IA (decisões, gotchas, handoffs).
- `docs/projeto/` — documentação para pessoas (visão geral, arquitetura, dados, API,
  funcionalidades, segurança, operação, frontend). Atualizar quando a realidade mudar.

## Ao Final da Sessão
- Criar handoff em `docs/memory/handoffs/` (`sessao-AAAA-MM-DD[-tema].md`) com:
  Contexto, Decisões (validadas com quem), O que mudou, Verificação executada
  (comandos e resultados reais), Pendências e PRÓXIMO passo explícito.
- Sugerir novas memórias: decisão → `decisions/`; armadilha com dor real → `gotchas/`;
  procedimento → `procedures/`.
- Atualizar `docs/memory/README.md` (indexar novos arquivos, anotações de estado).
- Atualizar `docs/projeto/` se a realidade documentada mudou.
- Erro do agente por falta de contexto vira `gotcha/` ou ajuste neste CLAUDE.md.

## Restrições
- Nunca usar Java/Spring Boot como referência ou analogia
- Nunca fazer recomendações não solicitadas de ferramentas
- REST simples no MVP — sem GraphQL, sem gRPC
- Nunca commitar segredo; variáveis documentadas em `docs/projeto/07-operacao-deploy.md`
- Nunca pular a seção Verificação por pressa
