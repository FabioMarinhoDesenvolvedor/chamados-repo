# Estratégia de Enums (union types + valores UPPER_SNAKE_CASE)

Data: 2026-06-25

## Contexto
Convenção do projeto: enums com tipo PascalCase e valores UPPER_SNAKE_CASE. Precisávamos
que os enums fossem idênticos entre Prisma (banco), API e frontend, sem casts.

## Decisão
No `@chamados/shared`, enums são **union types de string** + arrays `as const`
(ex: `ROLES = ['ADMIN','USER'] as const; type Role = (typeof ROLES)[number]`).
Os enums do Prisma são declarados com os MESMOS valores (ADMIN, USER, LOW, ...).

## Consequências
- Prisma (v5+) gera enums como union de string literais → 100% interoperável com o shared, sem cast.
- Validação na API usa `@IsIn(ARRAY)` do class-validator (reaproveita os arrays do shared — DRY).
- Frontend itera os arrays para montar selects e usa maps de label/cor (ver web/src/lib/labels.ts).
- Não usar `enum` nativo do TS no shared (geraria tipo incompatível com a union do Prisma).
