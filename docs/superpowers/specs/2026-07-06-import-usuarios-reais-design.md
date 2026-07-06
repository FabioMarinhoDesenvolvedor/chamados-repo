# Design — Import de usuários reais (frente separada)

Data: 2026-07-06
Status: **aprovado, parkeado** — bloqueado até o Fabio montar a lista real de usuários.
Independente do Plano 2 (a notificação continua por setor, não por usuário).

## Problema
O banco tem hoje usuários de seed/fixture. Para operar de verdade, o sistema precisa dos
**usuários reais** do clube — nome, e-mail e setor reais — para login (fluxo de 1º acesso por
e-mail já existente), atribuição de chamados e RBAC por setor. O Fabio vai montar a lista.

## Solução
Script **re-executável e idempotente** `npm run db:import-users`, **separado do `seed.ts` de dev**
(isto é dado real que **roda em produção** — o seed de dev nunca roda em prod).

### Entrada
Arquivo **não versionado** (PII) em caminho gitignored, ex.: `packages/api/data/users.csv`.
Colunas: `nome, email, setor`. `setor` = um dos 15 nomes exatos do banco:
`TI, RH, Tesouraria, Limpeza, Manutenção, Almoxarifado, Compras, Comunicações,
Gestão de Contratos, Secretaria, Secretaria da Presidência, Jurídico, Eventos, CEO, Presidência`.
Os poucos **OPERATORs/ADMINs** são informados à parte (mesma planilha com coluna `papel`, ou
lista separada). Sem `papel` → `USER`.

### Comportamento
- **Upsert por e-mail** (chave natural): e-mail novo → cria; e-mail existente → atualiza
  nome/setor/papel.
- **Setor pelo nome exato** → se não bater um dos 15, **falha alto** reportando a linha e os nomes
  válidos. Nunca cria setor fantasma nem deixa `departmentId` nulo silenciosamente.
- **Usuário novo**: senha temporária (documentada, não commitada) + `mustChangePassword=true` —
  reaproveita o fluxo de 1º acesso (`auth-jwt`, login por e-mail forçando troca).
- **Ausentes intactos**: quem está no banco e não está na lista fica como está (admin de sistema,
  Totem, contas técnicas). Sem desativação (não há campo `ativo` hoje; escolha do Fabio).
- **Sem mudança de schema** — `role`, `departmentId`, `mustChangePassword`, `passwordHash` já
  existem.

## Alternativas descartadas
- **Estender `seed.ts`**: seed de dev não roda em prod; import precisa rodar em prod → script
  próprio.
- **Desativar ausentes**: exigiria campo `ativo` novo; Fabio preferiu upsert-only por segurança.
- **Commitar o CSV**: PII no git — descartado; arquivo fica gitignored e o Fabio o coloca local.

## Impacto
- +1 script `db:import-users` + parser + repositório de upsert. Nenhuma migration.
- Roda em prod (deploy é do Fabio) contra a lista real.

## Verificação
- Testes `node:test` do parser/upsert: linha válida cria; e-mail repetido atualiza; setor inválido
  falha alto; papel default USER.
- Smoke: CSV de exemplo **fictício** pequeno no banco local → usuários criados com setor certo e
  `mustChangePassword=true`; rodar de novo não duplica (idempotente).

## Próximo passo (quando retomar)
Fabio entrega a lista real (CSV) → escrever plano de implementação → implementar → Fabio roda o
import em produção.
