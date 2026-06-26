# Chamados TI

Sistema interno de chamados de TI. Monorepo (NPM workspaces) com:

- `@chamados/shared` — tipos e enums compartilhados (TypeScript)
- `@chamados/api` — backend NestJS + Prisma + PostgreSQL (JWT)
- `@chamados/web` — frontend React + Vite + Tailwind + TanStack Query

> Documentação de decisões, arquitetura e regras de negócio em `docs/memory/`.
> Antes de codar, leia `CLAUDE.md` e `docs/memory/README.md`.

## Pré-requisitos

- Node.js >= 20
- Docker (para o PostgreSQL) ou um PostgreSQL local

## Setup rápido

```bash
# 1. Instalar dependências (workspaces resolvem tudo)
npm install

# 2. Subir o banco
docker compose up -d

# 3. Configurar env da API (já existe um .env de dev; ajuste se necessário)
#    packages/api/.env  (veja packages/api/.env.example)

# 4. Gerar client do Prisma + aplicar migrations + seed
npm run db:generate
npm run db:migrate        # cria as tabelas (primeira vez: nomeie a migration, ex: init)
npm run db:seed           # popula departamentos + usuários + chamados de exemplo

# 5. Rodar tudo (api + web) em modo dev
npm run dev
```

- API: http://localhost:3000/api
- Web: http://localhost:5173

## Usuários de exemplo (seed)

| Perfil | E-mail                  | Senha    |
|--------|-------------------------|----------|
| admin  | admin@chamados.local    | senha123 |
| user   | user@chamados.local     | senha123 |

## Scripts úteis (raiz)

| Script              | O que faz                                   |
|---------------------|---------------------------------------------|
| `npm run dev`       | sobe shared (watch) + api + web             |
| `npm run build`     | build de shared, api e web                  |
| `npm run db:migrate`| migrations do Prisma (API)                  |
| `npm run db:seed`   | popula dados de desenvolvimento             |
| `npm run db:generate`| gera o Prisma Client                       |

## Regras de negócio (resumo)

- 2 perfis: **admin** (atende/gerencia, vê todos) e **user** (abre, vê só os seus).
- Prioridade calculada por matriz fixa (complexidade × peso do departamento) no `PriorityService`.
- Acompanhamento por histórico de status + comentários.
