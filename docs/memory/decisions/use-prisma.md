# Use Prisma (ORM)

Data: 2026-06-25

## Contexto
PostgreSQL já decidido. Precisávamos de acesso a dados type-safe, integrado ao TypeScript, com migrations versionadas (requisito já documentado no CLAUDE.md).

## Decisão
Usar Prisma como ORM e ferramenta de migrations em `@chamados/api`.

## Consequências
- Schema declarativo (`schema.prisma`) como fonte da verdade do modelo
- Migrations versionadas via `prisma migrate` (nunca editar migration já aplicada)
- Tipos gerados automaticamente, alinhados ao TypeScript strict
- `PrismaService` injetável (Nest) — uma única instância de conexão
- Tipos de domínio compartilhados ficam em `@chamados/shared`; tipos gerados pelo Prisma ficam restritos à API
