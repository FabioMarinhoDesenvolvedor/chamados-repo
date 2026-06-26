# Use NestJS (Backend Framework)

Data: 2026-06-25

## Contexto
A arquitetura de backend já documentada é modular (controller/service/repository/dto por feature). Precisávamos de um framework que suportasse essa organização com TypeScript strict de forma idiomática.

## Decisão
Usar NestJS como framework de backend.

## Consequências
- Encaixa diretamente na arquitetura modular já documentada
- DI nativo facilita SOLID (injeção de PriorityService, repositories, etc.)
- Validação via class-validator/DTOs integrada
- Curva de aprendizado de decorators/módulos
- IMPORTANTE: explicar conceitos do Nest pelos próprios termos — NUNCA por analogia a Java/Spring (restrição do projeto), mesmo o Nest sendo decorator/DI.
- Com Prisma, a camada `repository.ts` vira wrapper fino sobre `PrismaService` — não reimplementar o que o Prisma já faz.
