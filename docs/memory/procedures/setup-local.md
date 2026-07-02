# Setup Local

Pré-requisitos: Node >= 20, Docker (ou PostgreSQL local).

1. `npm install` na raiz (workspaces resolvem tudo)
2. Subir o banco: `docker compose up -d`
   (precisa do Docker Desktop ABERTO/daemon rodando; senão use um PostgreSQL local)
3. Conferir env da API em `packages/api/.env` (já existe um de dev; base em `.env.example`)
4. Gerar Prisma Client: `npm run db:generate`
5. Migrations: `npm run db:migrate`
   (na primeira vez o Prisma pede um nome para a migration, ex: `init`)
   Não-interativo (passa o nome direto):
   `npm run db:migrate -w @chamados/api -- --name init`
6. Seed: `npm run db:seed`
   (cria deptos TI/RH + os 13 setores da migration de seed, admin@chamados.local e user@chamados.local — senha: senha123)
7. Dev: `npm run dev` (sobe shared em watch + api + web)
   - API: http://localhost:3000/api
   - Web: http://localhost:5173 (proxy /api → 3000)

Notas:
- O script `dev` da raiz compila o shared antes de subir api/web (garante os tipos).
- Build de produção: `npm run build` (shared → api → web, nessa ordem).
- Prisma avisa que `package.json#prisma` (config do seed) será removido no Prisma 7;
  migrar para `prisma.config.ts` no futuro (não bloqueia o MVP).
- Validar runtime sem abrir o navegador: `POST /api/auth/login` com admin@chamados.local /
  senha123 → token; depois `GET /api/tickets` com `Authorization: Bearer <token>`.
