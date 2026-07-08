# Handoff — 2026-07-08 (deploy em produção + incidente TI + estacionamento de setores)

> **LEIA PRIMEIRO** junto com `docs/projeto/00-estado-atual.md` (âncora do estado atual do sistema).
> Este handoff fecha a sessão que colocou SLA + IDs inteiros + multi-setorial (Planos 3 e 4) em
> produção e resolveu o incidente do TI.

## Contexto
Sessão longa: SLA de dois tempos, IDs inteiros (UUID→Int), Plano 3 (frontend multi-setorial) e
Plano 4 (totem) foram implementados, revisados, mergeados na `main` e **deployados em produção**
(srv-alv01). Handoffs por feature já existem (`sessao-2026-07-07-sla-dois-tempos`,
`-ids-inteiros`, `-multi-setorial-plano3`, `-2026-07-08-totem-plano4`). Este cobre o **deploy e o
pós-deploy**.

## Produção (srv-alv01)
- Bare-metal Debian, **sem Docker, sem nginx**. Postgres **nativo**.
- Serviço systemd **`chamados.service`** (não `chamados-api`): um processo Node que serve
  **API + site** (NestJS `ServeStaticModule` serve `packages/web/dist`) na porta **8080**
  (`PORT=8080` no `.env` de prod). Repo em **`/opt/chamados`**. Usuário `fabio`.
- Deploy feito: `git pull` → `npm ci` → `db:generate` → `prisma migrate reset --force --skip-seed`
  → `db:seed:admin` (admin `ti@juventus.com.br`, senha no 1º acesso) → `npm run build` →
  `systemctl restart chamados.service`. Subiu OK (SITE 200).

## Incidente TI (resolvido) — a lição mais importante
- **Sintoma:** pós-deploy, o fluxo mostrava só Manutenção/Limpeza; **TI sumiu**; só 13 de 15 setores.
- **Causa:** `migrate reset **--skip-seed**` (recomendado para não poluir prod com dados de exemplo)
  pulou o seed — mas **TI e RH e o vínculo das categorias de TI ao setor eram criados pelo SEED**,
  não por migration. Sem seed → sem TI/RH, categorias de TI órfãs → TI some do fluxo.
- **Fix durável:** migration `20260708100000_ti_rh_departamentos` (idempotente) cria TI/RH e liga as
  6 categorias de TI. Commit `d2e4113`. Agora `migrate deploy`/`reset --skip-seed` dá banco completo.
- Gotcha registrado: `gotchas/dado-de-referencia-no-seed-quebra-skip-seed.md`.

## Decisão nova (Fabio, 2026-07-08): TI é o core; Manutenção/Limpeza estacionados
- **TI aparece no fluxo de abertura** (todos os usuários). É o núcleo do sistema.
- **Manutenção e Limpeza ficam "de lado"**: cadastrados (departamento + categorias), mas **ocultos**
  do fluxo E do totem. Mecanismo: `packages/web/src/lib/blocks.ts` →
  `PARKED_DEPARTMENTS = ['Manutenção','Limpeza']`. Commit `3a7e70a`.
  **Para liberar:** remover o nome da lista → `npm run build` → restart. (Totem volta a funcionar
  quando esses setores forem liberados.)
- Os outros 12 setores existem sem categoria curada (backlog).

## O que mudou (commits desta etapa, todos na `main`/origin)
- `d2e4113` fix: TI/RH + vínculo das categorias de TI em migration.
- `3a7e70a` feat(web): estaciona Manutenção/Limpeza (`PARKED_DEPARTMENTS`).
- `04523f0` docs: `docs/projeto/00-estado-atual.md` (âncora).
- (antes, no deploy) `33a0c5e` docs: runbook + comando de deploy à prova de erro.

## Verificação executada
- Builds `shared/api/web` limpos; testes da API **97/97** (antes do deploy).
- Deploy em prod: serviço `active (running)`, "Nest application successfully started", SITE 200.
- Web build limpo após o `PARKED_DEPARTMENTS`.
- **CONFIRMADO em produção pelo Fabio (2026-07-08):** rodou `git pull` → `db:generate` →
  `npx prisma migrate deploy` (migration do TI, não-destrutivo) → `npm run build` →
  `systemctl restart chamados.service`. Resultado: **TI de volta no fluxo**, Manutenção/Limpeza
  ocultos, 15 setores no banco. Fabio: "Tudo certo".

## Pendências / PRÓXIMO passo
1. ~~Fabio rodar o comando no srv-alv01~~ **✅ CONCLUÍDO (2026-07-08): TI de volta, 15 setores, Manut/Limpeza ocultos.**
2. **`APP_URL` vazio** no `.env` de prod → link do e-mail de notificação incompleto; preencher ao
   configurar SMTP + restart.
3. **Revogação por-totem** (limitação): apagar o user do totem não revoga pós-uso; hoje só rotacionando
   `JWT_SECRET`. Follow-up: versão de token por kiosk. Ver `decisions/totem-kiosk-auth.md`.
4. **Liberar Manutenção/Limpeza/totem** quando o Fabio quiser (editar `PARKED_DEPARTMENTS`).
5. **12 setores sem categoria curada** — backlog do multi-setorial.

## Meta (feedback do Fabio, importante)
O Fabio sinalizou que eu estava "me perdendo" na sessão longa. Regra pra próximas sessões: ser mais
deliberado, confirmar ambiguidades antes de agir (ex.: houve um "deixa de lado" vs "A" contraditório
— resolvido perguntando), e manter `docs/projeto/00-estado-atual.md` como fonte única do estado.
