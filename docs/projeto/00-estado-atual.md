# 00 — Estado atual do sistema (fonte única)

> Documento-âncora: o que está no ar, o que está guardado pra depois, e o que aconteceu.
> Atualizado em **2026-07-08**. Se algo aqui divergir da realidade, a realidade manda — corrija aqui.

## O que está NO AR (produção, srv-alv01)

Servidor bare-metal Debian, serviço systemd **`chamados.service`** (um processo Node que serve
**API + site** na porta **8080**; sem Docker, sem nginx). Banco PostgreSQL nativo.

Funcionalidades entregues nesta rodada (jul/2026), todas na `main`/produção:

| Feature | O que faz | Docs |
|---|---|---|
| **SLA de dois tempos** | Prazo de **resposta** (assumir/`IN_PROGRESS`) + prazo de **conclusão** (`RESOLVED`), automáticos por matriz complexidade × peso do setor. Aprovação removida. | `decisions/sla-dois-tempos-automatico.md` |
| **IDs inteiros** | Todas as tabelas usam id inteiro sequencial (1, 2, 3…) no lugar de UUID. URLs `/tickets/1`. | `decisions/ids-sequenciais-inteiros.md` |
| **Fluxo multi-setorial** | Abertura guiada com **passo de Setor** antes da categoria; fila do dashboard por setor. | `specs/2026-07-02-multi-setorial-design.md` |
| **Notificação por e-mail** | 1 e-mail por setor na criação (outbox + worker). STUB se `SMTP_HOST` vazio. | `decisions/notificacao-hibrida-email.md` |
| **Totem/kiosk** | Terminal público abre chamados sem login; token de 365d emitido pelo admin. | `decisions/totem-kiosk-auth.md` |

## O que está GUARDADO pra depois ("de lado")

Decisão do Fabio (2026-07-08): **TI é o core** e aparece no fluxo. Os demais setores existem no
sistema, mas ainda **não aparecem** no fluxo de abertura:

- **Manutenção e Limpeza**: cadastrados (departamentos + categorias), porém **ESTACIONADOS** —
  ocultos do fluxo de abertura E do totem. Controlado por uma lista única no código:
  `packages/web/src/lib/blocks.ts` → **`PARKED_DEPARTMENTS = ['Manutenção', 'Limpeza']`**.
  **Para liberar um deles: remova o nome dessa lista, `npm run build`, reinicie o serviço.**
- **Totem**: como só atende Manutenção/Limpeza (que estão estacionados), na prática o totem fica
  guardado junto. O código está pronto; é só liberar os setores acima quando quiser usá-lo.
- **12 dos 15 setores** (Tesouraria, Almoxarifado, Compras, Comunicações, Gestão de Contratos,
  Secretaria, Secretaria da Presidência, Jurídico, Eventos, CEO, Presidência, RH): existem como
  departamento, mas **sem árvore de categoria curada** — não têm fluxo funcional ainda. Backlog.

Resumindo: **hoje o usuário abre chamado só de TI** (o core). Manutenção/Limpeza/totem e os outros
setores estão prontos por baixo, esperando você liberar.

## Incidente 2026-07-08 — "sumiram os chamados de TI" (resolvido)

- **Sintoma:** após o deploy, o fluxo mostrava só Manutenção/Limpeza; TI havia sumido; e faltavam
  2 departamentos (só 13 de 15).
- **Causa:** o deploy usou `prisma migrate reset **--skip-seed**` (recomendação do Claude, para não
  jogar dados de exemplo em produção). Mas TI e RH — e o vínculo das categorias de TI ao setor —
  eram criados pelo **seed**, não por migration. Pulando o seed, TI/RH não foram criados e as
  categorias de TI ficaram órfãs. **Erro de deploy do Claude.**
- **Correção (durável):** TI/RH e o vínculo das categorias de TI foram movidos para uma **migration**
  (`20260708100000_ti_rh_departamentos`, idempotente). Agora `migrate deploy`/`reset --skip-seed`
  produz o banco completo (15 setores + categorias de TI) sem depender do seed de dev.

## Como aplicar as correções em produção

> ✅ **Aplicado em produção em 2026-07-08** (TI de volta no fluxo, 15 setores, Manutenção/Limpeza
> ocultos). Sequência abaixo fica registrada para referência / próximos deploys.

No **srv-alv01**, dentro de `/opt/chamados`:

```bash
git pull origin main
npm run db:generate -w @chamados/api
cd packages/api && npx prisma migrate deploy && cd ../..   # cria TI/RH + liga categorias de TI (não-destrutivo)
npm run build                                              # rebuilda o site (TI no fluxo; Manut/Limpeza ocultos)
sudo systemctl restart chamados.service
```
Depois, **recarregue o navegador**. Esperado: fluxo de abertura mostra **TI**; `SELECT name FROM
departments` traz os **15** setores.

## Limitações conhecidas / pendências

- **Revogação do token do totem:** apagar o usuário do totem **não** funciona depois que ele abriu
  chamados; hoje só rotacionando `JWT_SECRET`. Revogação por-totem de verdade = follow-up. Ver
  `decisions/totem-kiosk-auth.md`.
- **`APP_URL` vazio** em produção: o link do chamado dentro do e-mail de notificação fica incompleto.
  Preencher quando configurar o SMTP (`packages/api/.env` → `APP_URL=...` + restart).
- **12 setores sem categoria curada** (acima) — backlog do multi-setorial.
- **Liberar Manutenção/Limpeza/totem** quando o Fabio quiser (editar `PARKED_DEPARTMENTS`).

## Onde está o histórico detalhado

- Decisões: `docs/memory/decisions/`. Armadilhas: `docs/memory/gotchas/`.
- Handoffs por sessão: `docs/memory/handoffs/` (SLA, IDs, Plano 3, Plano 4).
- Runbook de deploy: `docs/projeto/07-operacao-deploy.md`.
- Specs e planos: `docs/superpowers/specs/` e `docs/superpowers/plans/`.
