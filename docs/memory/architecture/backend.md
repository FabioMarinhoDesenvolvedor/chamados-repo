# Backend Architecture

## Stack
- Runtime: Node.js
- Linguagem: TypeScript (strict)
- Framework: NestJS
- ORM: Prisma
- Banco: PostgreSQL
- Auth: JWT stateless (guard de auth + guard de role)

## Estrutura de Camadas
```
src/
├── modules/          # Feature modules (users, tickets, departments)
│   └── [module]/
│       ├── controller.ts
│       ├── service.ts
│       ├── repository.ts
│       ├── dto/
│       └── entities/
├── common/           # Guards, decorators, pipes, filters
├── config/           # Env, database, auth config
└── shared/           # Utilidades cross-module
```

## Notas de Implementação (NestJS + Prisma)
- `PrismaService` injetável e único (conexão compartilhada)
- `repository.ts` = wrapper fino sobre Prisma (não reimplementar o ORM)
- DTOs validados com class-validator
- `PriorityService` dedicado para o cálculo de prioridade (ver business-rules.md)
- Guards: `JwtAuthGuard` (autenticação) + `RolesGuard` (autorização por role)

## Princípios
- SOLID: cada módulo tem responsabilidade única
- DRY: lógica de prioridade centralizada em um service dedicado
- KISS: sem over-engineering — REST simples, sem GraphQL no MVP
