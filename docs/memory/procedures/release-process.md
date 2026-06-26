# Release / Deploy

1. Garantir que main está estável (testes passando)
2. Bump de versão no package.json
3. Build de produção: `npm run build`
4. Rodar testes: `npm run test`
5. Backup do banco de produção
6. Aplicar migrations pendentes
7. Deploy
8. Smoke test: login + abrir chamado + listar chamados
