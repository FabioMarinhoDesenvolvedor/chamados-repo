# Hashing de Senha (bcryptjs, cost 10)

Data: 2026-06-26

## Contexto
Senhas nunca podem ser gravadas em texto puro. Precisávamos de um algoritmo de hash
forte, com salt por usuário, e que não exigisse build nativo no Windows (ambiente de dev
do Fabio). Relacionado à decisão de autenticação (ver [[auth-jwt]]).

## Decisão
- Hash com **bcrypt** via pacote **`bcryptjs`** (implementação JS pura, sem compilação nativa).
- **Cost factor 10** (`bcrypt.hash(senha, 10)`).
- Coluna no banco: **`password_hash`** (nome explicita que é hash, nunca senha em claro).
- No login: **`bcrypt.compare(senhaDigitada, hash)`** — nunca "descriptografar" (bcrypt é
  de mão única; ela re-hasheia com o salt embutido e compara).
- O hash é aplicado em TODOS os pontos que criam/alteram senha: seed (`prisma/seed.ts`)
  e criação de usuário pela API (users service) — não só no seed.

## Por que bcryptjs e não bcrypt nativo
- `bcrypt` nativo precisa de toolchain C++ (node-gyp) → fricção no Windows.
- `bcryptjs` entrega o mesmo formato/robustez de hash sem build nativo.

## Como verificar no banco
```
docker exec chamados-db psql -U chamados -d chamados \
  -c "SELECT email, substring(password_hash from 1 for 30), length(password_hash) FROM users;"
```
Esperado: cada hash com 60 chars, prefixo `$2a$10$`, e salts diferentes entre usuários
(mesma senha → hashes distintos).

## Consequências
- Senhas seguras em repouso, com salt por usuário (resistente a rainbow tables).
- Custo 10 é o padrão recomendado; aumentar o custo no futuro encarece brute-force
  (cada +1 dobra o tempo) — só rever se necessário.
- Trade-off de performance do bcryptjs (JS) é irrelevante no volume do MVP.
