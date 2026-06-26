# Documentação — CHAMADOS · Clube Atlético Juventus

Sistema interno de chamados de TI. Esta pasta reúne a **documentação completa do projeto**
voltada para pessoas (operação, manutenção, onboarding). É diferente de `docs/memory/`,
que guarda decisões/handoffs para continuidade entre sessões de desenvolvimento.

## Índice

| Documento | Conteúdo |
|-----------|----------|
| [01 — Visão geral](01-visao-geral.md) | O que é o sistema, perfis, glossário, stack |
| [02 — Arquitetura](02-arquitetura.md) | Monorepo, camadas, fluxo de dados, módulos |
| [03 — Modelo de dados](03-modelo-de-dados.md) | Tabelas, relações, enums, migrations |
| [04 — Referência da API](04-api-referencia.md) | Todos os endpoints, payloads, permissões |
| [05 — Funcionalidades](05-funcionalidades.md) | Cada recurso explicado de ponta a ponta |
| [06 — Segurança](06-seguranca.md) | Auth/JWT, senhas, cofre de anexos (criptografia) |
| [07 — Operação e deploy](07-operacao-deploy.md) | Setup, backup, restauração, runbook, variáveis |
| [08 — Frontend](08-frontend.md) | Estrutura React, rotas, componentes, design |

## Leitura rápida por perfil

- **Quero entender o todo:** 01 → 02.
- **Vou desenvolver:** 02 → 03 → 04 → 08.
- **Vou operar/manter em produção:** 07 → 06.
- **Preciso de um endpoint específico:** 04.

## Convenções do repositório (resumo)

- TypeScript strict; arquivos em kebab-case; commits convencionais (`feat:`, `fix:`...).
- Mobile-first (viewport mínimo 375px).
- REST simples (sem GraphQL/gRPC no MVP).
- Migrations versionadas — **nunca** alterar uma migration já aplicada.
- Detalhes em `CLAUDE.md` e `docs/memory/`.
