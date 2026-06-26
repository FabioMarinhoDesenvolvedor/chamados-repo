# Monorepo Structure

Data: 2026-06-25

## Contexto
Projeto tem frontend e backend separados mas compartilham tipos e regras de negócio. Precisa de deploy independente mas desenvolvimento unificado.

## Decisão
Monorepo com workspaces NPM. Três packages: `@chamados/api`, `@chamados/web`, `@chamados/shared`.

## Consequências
- Tipos compartilhados via `@chamados/shared` sem publicar no NPM
- Um único `npm install` na raiz
- CI/CD precisa considerar builds separados
- Scripts na raiz orquestram dev de ambos
