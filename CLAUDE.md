# CLAUDE.md — Chamados TI

## Regra Zero
Antes de qualquer tarefa, SEMPRE:
1. Leia `docs/memory/README.md`
2. Consulte decisões relacionadas em `docs/memory/decisions/`
3. Consulte gotchas relevantes em `docs/memory/gotchas/`
4. Leia o último handoff em `docs/memory/handoffs/`
5. Nunca contradiga decisões existentes sem discutir antes

## Princípios de Código
- **KISS**: soluções simples. Se parece over-engineered, é.
- **DRY**: lógica duplicada vira função/hook/service. Sem copiar e colar.
- **SOLID**: cada módulo/classe/componente tem uma responsabilidade.

## Convenções
- Linguagem: TypeScript (strict mode)
- Package manager: NPM com workspaces
- Monorepo: `packages/api`, `packages/web`, `packages/shared`
- Nomes de arquivo: kebab-case (`ticket-service.ts`)
- Nomes de variável/função: camelCase
- Nomes de tipo/interface: PascalCase
- Enums: PascalCase com valores UPPER_SNAKE_CASE
- Commits: conventional commits (feat:, fix:, chore:, docs:)

## Responsividade
Tudo é mobile-first. Componente sem responsividade = incompleto.
Viewport mínimo: 375px.

## Banco de Dados
- PostgreSQL
- Migrations versionadas (nunca alterar migration já rodada)
- Seeds para dados de desenvolvimento

## Antes de Codar
1. Planejar a abordagem
2. Perguntar se houver dúvida sobre contexto de negócio
3. Verificar se não está duplicando lógica existente
4. Verificar gotchas relevantes

## Ao Final da Sessão
- Atualizar ou criar handoff em `docs/memory/handoffs/`
- Sugerir novas memórias (decisions, gotchas) se aplicável
- Atualizar `docs/memory/README.md` se novos arquivos foram criados

## Restrições
- Nunca usar Java/Spring Boot como referência ou analogia
- Nunca fazer recomendações não solicitadas de ferramentas
- REST simples no MVP — sem GraphQL, sem gRPC
