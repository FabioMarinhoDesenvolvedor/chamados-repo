# Design — Totem/Kiosk (Multi-setorial Plano 4) — 2026-07-07

> Fecha o multi-setorial: totem físico para o público abrir chamados de setores executores
> (manutenção, limpeza, etc.) sem login visível. Baseia-se na spec guarda-chuva
> `2026-07-02-multi-setorial-design.md` (§10, §2-Totem, §4), **reconciliada** com o que mudou desde
> então: IDs inteiros, aprovação removida (SLA), e macro-bloco data-driven (Plano 3). Schema do
> totem (`User.isKiosk`, `Ticket.originLocation`) **já existe** desde o Plano 1 — **sem migration**.

## Decisões aprovadas (Fabio, 2026-07-07)

1. **Auth do totem: admin gera o token no painel.** Endpoint admin-only emite um JWT de **vida
   longa** (365d) para um `User` kiosk; o admin cola o token no dispositivo. Sem credenciais no
   aparelho. **Revogação** = apagar o `User` kiosk (o `JwtStrategy.validate` busca o user no banco;
   sem user, o token morre).
2. **Setores no totem: data-driven, menos TI.** Os blocos são os `Department` executores com ≥1
   categoria, **exceto TI** (interno). Setores públicos novos aparecem sozinhos quando curados —
   consistente com o macro-bloco do Plano 3.
3. **`originLocation` obrigatório no totem**, capturado só quando o solicitante é kiosk (usuário
   comum não falsifica). Reaproveita o `create()` existente (kiosk é `role=USER` + `isKiosk=true`).
4. Sem role nova no enum (kiosk é `USER` com `isKiosk=true`). Sem auto-refresh do token no MVP
   (vida longa + re-emissão). Sem redesign visual — reaproveita `BlockCard`/`CategoryIcon`/`ui`.

## Não-objetivos

- Auto-renovação/rotação automática do token (MVP: 365d + re-emitir; revogar apagando o user).
- Multi-idioma, acessibilidade além do padrão, telemetria do totem.
- Provisionamento físico do dispositivo (como o navegador é travado em `/totem`) — fora do software.
- Curadoria de categorias dos setores ainda sem árvore (segue como pendência do multi-setorial).

---

## 1. Modelo de dados

**Nenhuma mudança de schema.** Já existem:
- `User.isKiosk Boolean @default(false)` (Plano 1).
- `Ticket.originLocation String?` (Plano 1).

O(s) `User`(s) kiosk são criados sob demanda pelo endpoint de emissão (decisão 1).

## 2. Backend (NestJS)

### 2.1 Emissão de token — `POST /auth/kiosk-token` (admin-only)
- Guardas: `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')` (+ `MustChangePasswordGuard`, padrão).
- Body `CreateKioskTokenDto`: `{ label: string (2..60), departmentId: number }`.
  - `label` → nome do totem (ex.: "Totem Recepção"). `departmentId` → setor **do solicitante**
    kiosk (governa só o peso de prioridade dos chamados do totem; roteamento vem da categoria).
    Deve referenciar um `Department` existente.
- Ação: **upsert** de um `User` kiosk determinístico pelo e-mail derivado do label
  (`totem-<slug(label)>@kiosk.local`), com `name=label`, `role=USER`, `isKiosk=true`,
  `departmentId`, `mustChangePassword=false`, `passwordHash` aleatório inutilizável (o totem nunca
  faz login por senha). Reusar/atualizar se já existir (idempotente por e-mail).
- Assina um JWT com **`expiresIn: '365d'`** (override do default do módulo — `signAsync(payload, {
  expiresIn })`). Payload igual ao normal (`sub`, `email`, `role`).
- Retorna `{ token: string, user: UserPublic, expiresInDays: 365 }`.
- Novo módulo/serviço mínimo: método `issueKioskToken(dto)` no `AuthService` (reusa `JwtService`,
  `UsersRepository`, `DepartmentsRepository`). Sem tabela nova.

### 2.2 Captura de `originLocation` no `create()`
- `CreateTicketDto` ganha `originLocation?: string` (`@IsOptional @IsString @MaxLength(200)`).
- Em `TicketsService.create()`:
  - Se `user.isKiosk === true`: `originLocation` é **obrigatório** — vazio/ausente → `400`
    ("Informe o local/sala de origem"). Grava o texto.
  - Se `user.isKiosk !== true`: `originLocation` é **ignorado** (grava `null`) — usuário comum não
    define origem.
  - `user.isKiosk` já vem no `AuthUser` (via `JwtStrategy.validate`).
- Persistir `originLocation` no `createWithHistory` (hoje o ticket nasce com `origin_location` NULL;
  passar o valor). O e-mail de notificação pode incluir o local (opcional — `buildTicketEmail` já
  recebe `originLocation`, hoje sempre `null`; passar o valor real quando kiosk).

### 2.3 Testes (`node:test`)
- `issueKioskToken`: cria/atualiza user kiosk idempotente; assina token com expiração longa; só ADMIN.
- `create()`: kiosk sem `originLocation` → 400; kiosk com → grava; usuário comum → `originLocation`
  ignorado (null) mesmo se enviado; roteamento/priorização inalterados.

## 3. Frontend (React)

### 3.1 Rota `/totem` (pública, fora do `<Private>`)
- Adicionar `<Route path="/totem" element={<TotemPage />} />` em `App.tsx`, **fora** do wrapper
  `<Private>` (é auto-autenticada pelo token do kiosk).
- **Provisionamento:** ao carregar `/totem?token=<jwt>`, a página grava o token via `setToken()`
  (mesma chave `chamados.token` que o `api` já usa) e **limpa o `?token=` da URL** (replace). Sem
  token válido → tela "Totem não configurado — contate a TI".
- Como o token do kiosk fica na chave padrão, os hooks existentes (`useCategories`,
  `useDepartments`, criação de chamado) funcionam sem duplicação. O dispositivo é dedicado (só abre
  `/totem`), então não há conflito com sessão de admin.

### 3.2 UI kiosk (`TotemPage`)
- Sem header/menu/sidebar (layout próprio, tela cheia, botões grandes, tema grená). Mobile-first.
- Fluxo:
  1. **Local/sala** — `input` texto **obrigatório** (não avança vazio).
  2. **Setor** — blocos data-driven: `Department`s executores com categorias **exceto TI**
     (reusa a lógica `buildBlocks` do Plano 3, filtrando `name !== 'TI'`).
  3. **Categoria** → **Subcategoria** → (**Detalhe** opcional, se houver) — reaproveita
     `BlockCard`/`CategoryIcon`, igual ao fluxo interno.
  4. **Descrição** opcional (textarea) → **Concluir**.
  5. **Confirmação** ("Chamado registrado, obrigado") → botão/timer volta ao passo 1 (auto-reset,
     ex.: 8s ou toque), limpando tudo. Sem exibir número/dados sensíveis além de um "ok".
- Envia `POST /tickets` com `{ categoryId, subcategoryId, detailOptionId?, description?,
  originLocation, departmentId }` — `departmentId` = o do próprio user kiosk (o serviço o deriva/
  sobrescreve para USER de qualquer forma; enviar o do user para satisfazer o DTO, como o fluxo
  interno já faz).

### 3.3 Painel admin — gerar token do totem
- Página admin `/admin/totem` (`TotemAdminPage`, `adminOnly`) + link no menu admin.
- Form: `label` (texto) + `departmentId` (dropdown de `Department`s) → `POST /auth/kiosk-token`.
- Mostra o **token** e a **URL de provisionamento** `${window.location.origin}/totem?token=<jwt>`
  com botão "Copiar", + instrução: "Abra esta URL uma vez no dispositivo do totem". Aviso de que o
  token dá acesso de abertura de chamados (tratar como segredo) e de que apagar o totem (futuro)
  revoga.
- `@chamados/shared`: tipos `CreateKioskTokenInput` / `KioskTokenResponse`. `CreateTicketInput`
  ganha `originLocation?: string`.

## 4. Segurança

- Token de vida longa num dispositivo público: aceito (spec §10). O que ele permite é só o que o
  totem faz — **abrir chamados** e ver os próprios (do user kiosk). Não acessa dados de outros
  setores/usuários (RBAC de USER). Emissão é **admin-only**. Revogação = apagar o `User` kiosk.
- `originLocation` só é aceito de solicitante kiosk — usuário comum não injeta origem falsa.
- O endpoint de emissão nunca expõe senha; o user kiosk não tem senha utilizável.

## 5. Verificação

- `npm run build` (shared → api → web) limpo; `tsc --noEmit` limpo.
- `npm test -w @chamados/api` — testes da §2.3 + regressão.
- Smoke (banco no ar): admin gera token em `/admin/totem`; abrir `/totem?token=…` num navegador →
  fluxo Local → Setor (sem TI) → Categoria → Subcategoria → Concluir; conferir o chamado criado com
  `originLocation` preenchido, roteado ao setor da categoria, e que **não** aparece TI nos blocos do
  totem; tentar `create` como usuário comum enviando `originLocation` → é ignorado.

## 6. Impacto em memória/docs (na implementação)

- Nova decisão `decisions/totem-kiosk-auth.md` (User `isKiosk` + JWT 365d admin-emitido +
  revogação por exclusão; referencia `auth-jwt.md`).
- Atualizar `architecture/business-rules.md` (fluxo do totem, originLocation, setores sem TI).
- Atualizar `docs/projeto/07-operacao-deploy.md` (como provisionar um totem).
- Handoff de sessão ao final; multi-setorial "infra completa", 12 setores sem categoria seguem
  pendentes.
