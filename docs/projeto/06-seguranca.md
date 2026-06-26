# 06 — Segurança

## Autenticação (JWT stateless)

- Login (`POST /auth/login`) valida e-mail + senha (bcrypt) e emite um **JWT** assinado com
  `JWT_SECRET`, validade `JWT_EXPIRES_IN` (default `1d`).
- O token carrega o payload de identidade; a estratégia `jwt.strategy.ts` o valida em cada
  request e injeta `AuthUser { userId, email, role }`.
- **Web:** token e usuário ficam em `localStorage` (`chamados.token`, `chamados.user`); o axios
  envia `Authorization: Bearer`. `AuthContext` centraliza login, primeiro acesso, `refreshUser`
  e logout.

## Autorização (perfis)

- `RolesGuard` + `@Roles('ADMIN')` protegem rotas administrativas.
- A regra "USER só vê os próprios chamados" é aplicada **no backend** (service/repository).
- **Admin = acesso total** (decisão recorrente do projeto).

## Senhas

- Hash **bcrypt** (`password_hash`); a senha em claro nunca é armazenada.
- **Primeiro acesso obrigatório:** usuários nascem com `mustChangePassword = true`; até trocarem,
  o front os mantém em `/change-password`.
- **Troca da própria senha** exige a senha atual (`bcrypt.compare`) — erro → 400.
- Quando o admin redefine a senha de alguém via `PATCH /users/:id`, volta a marcar
  `mustChangePassword = true`.

## Cofre de anexos (criptografia em repouso)

**Objetivo:** dados sensíveis (prints/imagens) **não** permanecem no programa. Ficam numa pasta
**fora de todo o projeto**, cifrados, acessíveis só com a senha-mestra do admin.

### Como funciona (`modules/vault/vault.service.ts`)

- Algoritmo **AES-256-GCM**. A chave (32 bytes) é derivada da **senha-mestra** via
  `scryptSync(senha, salt, 32)`.
- A **senha-mestra NUNCA é persistida** — a chave vive **só em memória** até o servidor
  reiniciar. Reiniciou → cofre volta a `LOCKED` e precisa ser desbloqueado de novo.
- No primeiro `unlock`, gera-se um `salt` aleatório e um **verificador** (um sentinela
  `chamados-vault-ok` cifrado), salvos em `vault.meta.json` na pasta do cofre. Nos próximos
  unlocks, a senha é validada decifrando esse sentinela (`timingSafeEqual`) → senha errada
  lança **401**.
- Formato de cada blob cifrado: `[iv(12) | authTag(16) | ciphertext]`.

### Estados (`GET /vault/status`)

| Estado | Significado |
|--------|-------------|
| `UNINITIALIZED` | Cofre nunca configurado — o próximo `unlock` **define** a senha-mestra |
| `LOCKED` | Configurado, mas a chave não está em memória (precisa desbloquear) |
| `UNLOCKED` | Chave em memória; upload/visualização de anexos liberados |

### Impacto operacional

- Upload (`POST .../attachments`) e visualização (`GET .../attachments/:id`) chamam
  `assertUnlocked()` → **423** se bloqueado. A UI mostra o `VaultBanner` pedindo o desbloqueio.
- O binário cifrado fica como `<uuid>.enc` na **pasta do cofre** (`ATTACHMENTS_DIR`, default
  fora do projeto). O banco guarda só metadados.
- As imagens são servidas **decifradas sob demanda** por rota autenticada, com
  `Cache-Control: private, no-store` (não há URL pública nem cache).

> ⚠️ **Irrecuperável se perder a senha-mestra.** Como a chave nunca é salva, esquecê-la torna os
> anexos cifrados **impossíveis** de recuperar. Guarde a senha-mestra com segurança (ex.: cofre
> de senhas), separada do servidor.

## Boas práticas pendentes / recomendações

- Trocar `JWT_SECRET` e as senhas de banco em produção (o `.env` de dev usa valores triviais).
- O **backup** é um SQL gzipado **não criptografado** — armazená-lo em volume seguro/criptografado
  (ver [07](07-operacao-deploy.md)). Pode-se cifrá-lo no mesmo padrão do cofre, se desejado.
- Servir o front/api sob HTTPS em produção (o token trafega no header).
