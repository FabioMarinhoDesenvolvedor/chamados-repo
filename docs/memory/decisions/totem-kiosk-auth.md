# Totem/kiosk: autenticação por token de longa duração (Plano 4)

Data: 2026-07-08
Estende: [[auth-jwt]] (mesmo mecanismo JWT stateless; não cria esquema novo).

## Contexto
Último dos 4 planos do design guarda-chuva multi-setorial: um totem físico (tablet/terminal fixo
num corredor/recepção) precisa abrir chamados sem que ninguém digite login/senha — o dispositivo
fica logado permanentemente. Precisava de um jeito de autenticar um dispositivo (não uma pessoa)
sem inventar um mecanismo de auth paralelo ao JWT existente.

## Decisão (aprovada por Fabio)
- **Sem role nova.** O totem é um `User` comum (`role = 'USER'`) com a flag `isKiosk = true`
  (coluna já existia no schema desde o Plano 1, sem uso até agora).
- **Provisionamento por endpoint admin-only**: `POST /auth/kiosk-token` (`ADMIN`, guardas
  `JwtAuthGuard` + `RolesGuard` + `MustChangePasswordGuard`) recebe `{ label, departmentId }` e:
  - faz **upsert** de um `User` kiosk com e-mail derivado e estável `totem-<slug(label)>@kiosk.local`
    (reemitir o token do mesmo totem atualiza o mesmo usuário, não duplica);
  - grava um hash bcrypt de um `randomUUID()` como senha — **inutilizável**, o kiosk nunca faz
    login por senha;
  - assina um JWT com `expiresIn: '365d'` (dispositivo fixo, sem login manual, ao contrário do
    token curto do usuário humano) e retorna a URL de provisionamento.
- **Revogação (limitação conhecida do MVP):** apagar o `User` do totem **não funciona** depois que
  ele já abriu chamados (o usuário é solicitante deles e `DELETE /users/:id` bloqueia com 409
  quando há referências — `usersService.countBlockingRefs`). Para invalidar um token vazado hoje, é
  preciso **rotacionar `JWT_SECRET`** (invalida TODOS os tokens — todo mundo reautentica — e depois
  re-emitir os tokens dos totens). Revogação por-totem sem rotacionar o segredo é um follow-up
  (versão de token/`jti` por usuário kiosk). Sem lista de revogação, sem endpoint de logout do
  totem hoje.
- **Departamento do kiosk = departamento do solicitante** (`User.departmentId`), igual a qualquer
  usuário — alimenta a matriz de prioridade normalmente. Não é o setor executor.
- **Provisionamento físico por URL, sem app**: `/totem?token=<jwt>` grava o token na mesma chave
  `chamados.token` usada pelo login humano e recarrega a página; depois disso o dispositivo fica
  autenticado indefinidamente (até o token expirar ou o `User` ser apagado). A rota `/totem` fica
  **fora** do `<Private>` (não exige sessão prévia) justamente para poder se auto-autenticar.
- **`originLocation` só é aceito de solicitante kiosk**: `TicketsService.create()` exige (400 se
  vazio) e grava `originLocation` quando `user.isKiosk === true`; para usuário comum o campo é
  **ignorado** (gravado `null`), mesmo se enviado no payload — o totem precisa identificar de qual
  sala/local partiu o chamado, um usuário logado normal não.

## Consequências
- Painel admin `/admin/totem` gera o token e mostra `${origin}/totem?token=…` + botão Copiar — é
  a única superfície de UI para provisionar; não há CRUD de totens (o "totem" é só um `User` com
  `isKiosk=true`, gerenciável como qualquer usuário se necessário).
- Comprometimento de um totem (device roubado) **não tem revogação pontual**: apagar o `User`
  kiosk falha com 409 assim que o totem já abriu algum chamado. Na prática, hoje o único remédio é
  rotacionar `JWT_SECRET` (afeta todos os usuários, não só o totem comprometido).
- Token de 365d é mais longo que o padrão (`JWT_EXPIRES_IN=1d`, ver `07-operacao-deploy.md`) —
  aceito com o escopo do JWT limitado (role USER comum, sem privilégio administrativo) mitigando o
  risco; a revogação por-totem em si é a lacuna descrita acima.
- Sem sync de "quem é o kiosk" em relatórios/dashboards — chamados abertos por totem aparecem como
  qualquer chamado do `requesterId` correspondente, distinguíveis pelo `originLocation` preenchido.
