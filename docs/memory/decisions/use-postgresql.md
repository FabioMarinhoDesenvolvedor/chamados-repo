# Use PostgreSQL

Data: 2026-06-25

## Contexto
Sistema de chamados internos precisa de integridade relacional forte: usuários pertencem a departamentos, chamados têm prioridade calculada, histórico de status com timestamps.

## Decisão
Usar PostgreSQL como banco de dados principal.

## Consequências
- Transações ACID garantidas
- Suporte nativo a JSONB caso precise de campos flexíveis
- Maior consumo de RAM comparado a SQLite
- Necessidade de gerenciar migrations
