# Auth via JWT Stateless

Data: 2026-06-25

## Contexto
API REST simples no MVP. Dois perfis (admin/user). Precisávamos de autenticação sem infraestrutura extra de sessão.

## Decisão
Autenticação stateless com JWT assinado. Role (admin/user) embutida no payload. Guard de autenticação + guard de role no NestJS.

## Consequências
- Sem store de sessão — menos infraestrutura
- Role disponível no token para autorização em guards
- Necessário tratar expiração; refresh token fica como item futuro (fora do MVP, reavaliar)
- Token no client: armazenar com cuidado (preferir memória + httpOnly se evoluir para cookie)
- Senhas com hash — nunca em texto puro. Esquema detalhado em decisions/password-hashing.md
  (bcryptjs, cost 10, coluna password_hash, compare no login).
