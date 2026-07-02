# Design — Service Desk Multi-Setorial — 2026-07-02

> Evolução do sistema (hoje majoritariamente TI) para Dashboard central de solicitações dos
> 15 setores do clube. Cruzado com o schema/código atual antes de qualquer proposta — ver
> decisões aprovadas abaixo, todas confirmadas por Fabio em sessão de brainstorming
> (2026-07-02). Nenhuma decisão aprovada anterior é contradita silenciosamente: onde este
> design toca uma decisão existente (`notificacao-polling`, `prazo-complexidade-automatica`),
> isso é sinalizado explicitamente.

## Decisões aprovadas (Fabio, 2026-07-02)

1. **RBAC por setor**: `Ticket` ganha `executorDepartmentId` (campo novo, separado do
   `departmentId` existente). `departmentId` continua sendo o setor do **solicitante** (não
   muda de significado — a matriz de prioridade aprovada em 25/06 não é afetada).
2. **Escopo de OPERATOR**: reaproveita `User.departmentId` (já existe) como o setor que aquele
   staff executa. `OPERATOR` com `departmentId` setado só vê/atende chamados do próprio setor
   executor. **`ADMIN` nunca é restrito** — sempre vê tudo, com ou sem `departmentId`.
3. **Aprovação**: só `ADMIN` aprova (sem novo conceito de "admin de setor"). Setor com
   `requiresApproval=true` (só Presidência, por ora) represa o chamado em
   `PENDING_APPROVAL` (novo valor de enum) antes de `OPEN`.
4. **SLA em chamados represados**: `sla_started_at` grava na **criação**, sem exceção — mantém
   a regra aprovada em `prazo-complexidade-automatica` mesmo para chamados aguardando
   aprovação (o tempo represado conta contra o prazo).
5. **Notificação híbrida**: mantém o polling aprovado (`notificacao-polling`), adaptado para
   filtrar por `executorDepartmentId`; **soma** e-mail assíncrono disparado só na criação, para
   `Department.notificationEmail` (1 e-mail por setor, nullable). **Isso estende — não
   substitui — a decisão de 26/06.** Uma nova decisão (`decisions/notificacao-hibrida-email.md`)
   deve ser criada na implementação, documentando a extensão.
6. **Setores (tabela final, não reabrir)**:

   | Setor | S/E/A | Executor? | Requester? | Aprovação? |
   |---|---|---|---|---|
   | RH | A | ✓ | ✓ | não |
   | Tesouraria | S | | ✓ | não |
   | Limpeza | E | ✓ | | não |
   | Manutenção | E | ✓ | | não |
   | Almoxarifado | E | ✓ | | não |
   | Compras | E | ✓ | | não |
   | TI | E | ✓ | | não |
   | Comunicações | E | ✓ | | não |
   | Gestão de Contratos | E | ✓ | | não |
   | Secretaria | E | ✓ | | não |
   | Secretaria da Presidência | E | ✓ | | não |
   | Jurídico | E | ✓ | | não |
   | Eventos | E | ✓ | | não |
   | CEO | A | ✓ | ✓ | não |
   | Presidência | E | ✓ | | **sim** |

   **Elétrica não é setor** — é categoria dentro de Manutenção. Almoxarifado→Compras (reposição
   por compra) é fluxo **fora** do sistema de chamados — não modelado.
7. **Roteamento via categoria, não tabela separada**: `TicketCategory` ganha `departmentId`
   (nullable). Só pode apontar para `Department.isExecutorDept = true`. `Ticket.
   executorDepartmentId` é resolvido a partir de `category.departmentId` **no momento da
   criação** (denormalizado — mesmo padrão de `lastActivityAt`).
8. **Tela nova "macro-bloco"**: passo 0 antes da grid de categoria — 3 cards (TI / Manutenção /
   Limpeza), mesmo estilo dos cards de categoria existentes. Filtra a grid de categoria
   seguinte pelo `departmentId` escolhido. Os 6 blocos de TI existentes recebem
   `departmentId = TI`.
9. **Manutenção e Limpeza ganham categorias novas** (nível `TicketCategory`, paralelas às 6 de
   TI — não subcategorias): 8 em Manutenção, 6 em Limpeza (lista completa em §1). Cada uma
   nasce com **1 subcategoria placeholder** ("Solicitação geral", `base_complexity = MEDIA`) —
   curadoria fina de subcategorias reais fica para sessão futura (mesmo padrão incremental do
   backlog `sessao-2026-07-01-backlog.md`, Itens 1/2).
10. **Totem**: expõe só **Manutenção + Limpeza** (TI fica de fora do quiosque público). Um
    único `User` técnico genérico ("Totem") como `requesterId`; `Ticket` ganha `originLocation`
    (texto livre, capturado só quando `requesterId` = usuário totem).

## Não-objetivos (fora de escopo deste design)

- **Curadoria de categorias/subcategorias para os 12 setores sem macro-bloco** (RH, Tesouraria,
  Almoxarifado, Compras, Comunicações, Gestão de Contratos, Secretaria, Secretaria da
  Presidência, Jurídico, Eventos, CEO, Presidência). Este design entrega a **infraestrutura**
  (schema/RBAC/aprovação/notificação/`Department` com todas as flags corretas) para qualquer
  setor, mas só popula árvore de categoria real para TI/Manutenção/Limpeza — os únicos 3 com
  macro-bloco aprovado. Os outros 12 setores existem como `Department`, prontos para receber
  categorias quando curados, mas **sem fluxo guiado funcional ainda** — ficam para sessão
  futura.
- **`priorityWeight` real dos 14 setores novos**: nasce com placeholder `3` (Médio) no seed,
  igual ao padrão de curadoria incremental (mesmo espírito do `base_complexity` do item 9) —
  **Fabio ajusta os pesos reais depois**. Não afeta setores hoje sem fluxo guiado (não geram
  chamados ainda); afeta só TI/Manutenção/Limpeza se algum dia um requester tiver esse
  `departmentId` como setor próprio.
- Sem WebSocket, sem BullMQ/pg-boss — fila de e-mail é uma tabela outbox simples com worker
  leve (ver §3), consistente com "REST simples no MVP" do `CLAUDE.md` e o ambiente bare-metal
  sem Docker em produção.
- Sem nova role no Prisma (`ADMIN`/`USER`/`OPERATOR` continuam os únicos 3 valores).
- Sem redesign visual — totem e telas novas reaproveitam 100% `components/ui` e o tema grená.

---

## 1. Modelo de dados

### `Department` — 4 colunas novas
```prisma
model Department {
  id                String   @id @default(uuid())
  name              String   @unique
  priorityWeight    Int      @map("priority_weight")
  isRequesterDept   Boolean  @default(true)  @map("is_requester_dept")
  isExecutorDept    Boolean  @default(false) @map("is_executor_dept")
  requiresApproval  Boolean  @default(false) @map("requires_approval")
  notificationEmail String?  @map("notification_email")
  createdAt         DateTime @default(now()) @map("created_at")

  users            User[]
  tickets          Ticket[]                          // solicitante (campo existente)
  executedTickets  Ticket[]         @relation("executorDepartment")
  categories       TicketCategory[]

  @@map("departments")
}
```
`isRequesterDept`/`isExecutorDept` são **informativos + governam elegibilidade de roteamento**
(`TicketCategory.departmentId` só pode referenciar `isExecutorDept=true`) — **não** bloqueiam
`User.departmentId` nem quebram dados existentes.

### `TicketCategory` — 1 coluna nova
```prisma
departmentId String?     @map("department_id")
department   Department? @relation(fields: [departmentId], references: [id])
```
Migration não-destrutiva (nullable). Backfill: os 6 blocos de TI existentes recebem
`departmentId = <id do Department TI>`.

### `Ticket` — 2 colunas novas
```prisma
executorDepartmentId String?     @map("executor_department_id")
executorDepartment   Department? @relation("executorDepartment", fields: [executorDepartmentId], references: [id])
originLocation       String?     @map("origin_location")
```
`executorDepartmentId` é preenchido no `create()` a partir de `category.departmentId` (nunca
recalculado depois — se a categoria mudar de setor no futuro, chamados antigos preservam o
setor original, mesmo padrão de outros campos denormalizados). `originLocation` só é
preenchido quando o requester é o usuário técnico do totem.

### `TicketStatus` — 1 valor novo
```prisma
enum TicketStatus {
  TRIAGE
  PENDING_APPROVAL
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```
`TRIAGE` continua reservado para compatibilidade (não reutilizado — decisão explícita, ver
brainstorming). `PENDING_APPROVAL` só é usado na criação, quando `executorDepartment.
requiresApproval = true`.

### Nova tabela `notification_outbox` (fila de e-mail)
| coluna | tipo | nota |
|---|---|---|
| `id` | TEXT PK (uuid) | |
| `ticket_id` | TEXT NOT NULL → `tickets(id)` ON DELETE CASCADE | |
| `to_email` | TEXT NOT NULL | copiado de `department.notification_email` no momento do enqueue |
| `status` | TEXT NOT NULL DEFAULT 'PENDING' | `PENDING \| SENT \| FAILED` |
| `attempts` | INTEGER NOT NULL DEFAULT 0 | |
| `last_error` | TEXT NULL | |
| `created_at` | TIMESTAMP(3) NOT NULL DEFAULT now() | |
| `sent_at` | TIMESTAMP(3) NULL | |

Índice em `status` (worker faz `WHERE status='PENDING' ORDER BY created_at LIMIT N`).

### Seed — 14 `Department`s novos + categorias de Manutenção/Limpeza

**Categorias — Manutenção** (`departmentId` = Manutenção): Elétrica (`eletrica`/`Zap`),
Hidráulica (`hidraulica`/`Droplet`), Ar-condicionado (`ar-condicionado`/`Snowflake`),
Mobiliário (`mobiliario`/`Armchair`), Estrutural/Civil (`estrutural-civil`/`Hammer`), Portas e
fechaduras (`portas-fechaduras`/`DoorClosed`), Áreas externas (`areas-externas`/`Trees`),
Outros (`outros-manutencao`/`CircleEllipsis`).

**Categorias — Limpeza** (`departmentId` = Limpeza): Limpeza de sala/escritório
(`limpeza-sala`/`Sparkles`), Limpeza de banheiro (`limpeza-banheiro`/`ShowerHead`), Reposição
de materiais de higiene (`reposicao-materiais`/`PackagePlus`), Limpeza de área comum/evento
(`limpeza-area-comum`/`Building2`), Descarte de lixo/resíduos (`descarte-lixo`/`Trash2`),
Outros (`outros-limpeza`/`CircleEllipsis`).

Cada uma das 14 ganha 1 `TicketSubcategory` placeholder (`slug = "solicitacao-geral"`,
`baseComplexity = MEDIUM`).

---

## 2. Regras de negócio

### Visibilidade (RBAC)
- `USER`: só os próprios chamados (`requesterId`) — **inalterado**.
- `OPERATOR` com `User.departmentId` setado: só chamados com
  `executorDepartmentId = operator.departmentId`.
- `OPERATOR` sem `departmentId`: comportamento atual preservado (vê tudo) — evita quebrar
  operadores existentes sem migração de dados obrigatória.
- `ADMIN`: sempre vê tudo, com ou sem `departmentId` — nunca restrito.
- Aplicado em `listWhere()` e em `stats()` (KPIs do dashboard), mesmo padrão hoje usado para
  `USER`.

### Aprovação
- Na criação, se `executorDepartment.requiresApproval = true` → status inicial
  `PENDING_APPROVAL` (em vez de `OPEN`); senão, fluxo atual (`OPEN` já priorizado).
- `complexity`/`priority`/`slaStartedAt` são calculados **igual em ambos os casos** — a
  aprovação não afeta a priorização automática aprovada em `prazo-complexidade-automatica`.
- `PATCH /tickets/:id/approve` (só `ADMIN`, só a partir de `PENDING_APPROVAL`) → transição para
  `OPEN`, registra em `TicketStatusHistory` (sem tabela nova).
- Chamado em `PENDING_APPROVAL` não aparece na fila de atendimento do `OPERATOR` do setor (só
  seria visível a ele depois de `OPEN`) — evita atendimento de algo ainda não aprovado.

### Roteamento
- Fluxo guiado ganha passo 0 (macro-bloco). Ao concluir, `categoryId`/`subcategoryId` resolvem
  `executorDepartmentId` via `category.departmentId` — **sem escolha manual de setor**.
- Backend valida: categoria escolhida deve ter `departmentId` preenchido (senão `400` — não
  deveria acontecer via UI, mas protege a API direta).

### Notificação
- Polling (`GET /tickets/unread/count`) passa a considerar `executorDepartmentId` do staff
  (mesma lógica de `hasUnread`, só filtro adicional).
- Na criação de qualquer chamado, se `executorDepartment.notificationEmail` estiver preenchido
  → grava 1 linha em `notification_outbox`. Worker assíncrono (job leve, `@nestjs/schedule`,
  intervalo curto) processa `PENDING`, envia via SMTP (nodemailer — dependência nova), marca
  `SENT`/`FAILED` (`attempts++`, sem retry infinito — 3 tentativas, depois fica `FAILED`
  visível em log).
- Setor sem `notificationEmail`: só o polling vale (comportamento aprovado hoje).

### Totem
- Usuário técnico `Totem` (seed, `role=USER`, sem senha usável em produção — ou senha fixa
  trocada só por ADMIN, a definir na implementação).
- Tela `/totem`: kiosk (sem menu/header padrão), campo "Local/sala de origem" (texto livre,
  obrigatório) → macro-bloco (Manutenção/Limpeza) → categoria → subcategoria placeholder →
  descrição opcional → concluir. `originLocation` grava o texto capturado.

---

## 3. Backend (NestJS)

- **`tickets.service.ts`**
  - `listWhere()`: novo ramo para `OPERATOR` com `departmentId` (ver §2).
  - `stats()`: mesmo filtro de `listWhere()` aplicado ao `groupByStatus`.
  - `create()`: resolve `executorDepartmentId` via categoria; decide status inicial
    (`PENDING_APPROVAL` vs `OPEN`) via `executorDepartment.requiresApproval`; enqueue de
    notificação se aplicável.
  - Novo método `approve(id, user)` → `PATCH /tickets/:id/approve`.
- **`departments.service.ts`/`.controller.ts`**: DTO de create/update ganha os 4 campos novos;
  validação de `notificationEmail` (formato) quando presente.
- **`categories.service.ts`**: `departmentId` no DTO de criação/edição de categoria; validação
  cruzada (`department.isExecutorDept === true`).
- **Novo módulo `notifications`** (ou extensão de `tickets`): `NotificationOutboxRepository` +
  `MailWorker` (cron leve) + `MailerService` (nodemailer, config via env: `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- **Seed** (`prisma/seed.ts` ou script de migration): 14 `Department`s + 14 `TicketCategory`s +
  14 `TicketSubcategory` placeholders + usuário técnico `Totem`.
- **Novas dependências**: `nodemailer` (+ `@types/nodemailer`), `@nestjs/schedule` (se ainda não
  usado no projeto — confirmar antes de instalar, checar se já existe no `package.json`).
- **Testes `node:test`** a cobrir: OPERATOR filtrado por setor; ADMIN não filtrado; criação em
  setor com `requiresApproval` → `PENDING_APPROVAL`; `approve()` só por ADMIN e só a partir de
  `PENDING_APPROVAL`; `executorDepartmentId` resolvido corretamente pela categoria; outbox
  criado quando `notificationEmail` presente, ausente quando não.

---

## 4. Frontend (React)

- **Fluxo guiado (`NewTicketPage`)**: novo grid de macro-bloco (3 `BlockCard`, ícones a definir
  — TI/Manutenção/Limpeza) como primeiro passo; filtra a grid de categoria atual pelo
  `departmentId` do bloco escolhido. Breadcrumb ganha 1 nó a mais.
- **`/totem`** (rota nova, fora do layout autenticado padrão): campo de local + fluxo
  simplificado (só Manutenção/Limpeza), botões grandes, sem menu lateral/header — reaproveita
  `BlockCard`/`CategoryIcon`/`components/ui` existentes. Autenticação: sessão técnica fixa
  (token de serviço ou rota pública restrita por IP da LAN — decidir mecanismo exato na
  implementação, já que o totem não tem login humano).
- **Fila por setor**: `DashboardPage` já filtra via backend; ajuste visual — quando o staff
  tiver `departmentId`, mostrar o nome do setor no cabeçalho ("Fila — Manutenção"); ADMIN
  global mantém view atual.
- **Aprovação**: no detalhe do chamado (`TicketDetailPage`), quando `status=PENDING_APPROVAL` e
  `user.role=ADMIN`, botão "Aprovar" (mesmo padrão visual dos outros botões de ação).
- **Tipos `@chamados/shared`**: `Department` ganha os 4 campos; `Ticket`/`TicketDetail` ganham
  `executorDepartmentId`, `originLocation`; `TicketStatus` ganha `PENDING_APPROVAL`.

---

## 5. Migração & deploy

- Todas as alterações de schema são **aditivas** (colunas nullable ou com `@default`) — nenhuma
  migration destrutiva, mesmo padrão já usado no projeto.
- Ordem sugerida:
  1. `ALTER TABLE departments ADD COLUMN` (4 colunas, com defaults) — não quebra nada.
  2. Backfill: `UPDATE departments SET is_executor_dept=true, is_requester_dept=false WHERE name='TI'`
     (setor TI existente vira só-executor, conforme tabela aprovada).
  3. `INSERT` dos 14 `Department`s novos (`priorityWeight=3` placeholder).
  4. `ALTER TABLE ticket_categories ADD COLUMN department_id` (nullable) + backfill dos 6 blocos
     de TI + `INSERT` das 14 categorias novas + `INSERT` das 14 subcategorias placeholder.
  5. `ALTER TABLE tickets ADD COLUMN executor_department_id, origin_location` (nullable) —
     chamados existentes ficam com `executorDepartmentId = NULL` (aceitável, são todos de TI
     antes da migração; backfill opcional: preencher com o `departmentId` do TI para
     consistência histórica, a confirmar).
  6. `ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_APPROVAL'` (ver gotcha
     `postgres-enum-default.md` antes de aplicar — checar se precisa de tratamento especial).
  7. `CREATE TABLE notification_outbox`.
  8. Seed do usuário técnico `Totem`.
- **Deploy é do usuário** (bare-metal, Debian 12, systemd, sem Docker em produção) — ordem:
  `db:generate` → `db:deploy` → build `shared → api → web` → restart. Instalar `nodemailer`
  antes do build da API.
- Configuração SMTP em produção: variáveis de ambiente novas no `.env` do servidor — a definir
  (provedor de e-mail ainda não escolhido; pode ser SMTP interno do clube ou serviço externo —
  **pergunta em aberto para a fase de implementação, não bloqueia este design**).

---

## 6. Verificação (antes de entregar)

- `npm run build` (shared → api → web) limpo; `tsc --noEmit` limpo.
- `npm test -w @chamados/api` — testes novos do §3 + regressão dos existentes.
- Smoke local: OPERATOR de Manutenção só vê fila de Manutenção; ADMIN vê tudo; chamado de
  Presidência nasce `PENDING_APPROVAL` com SLA já contando; `approve()` muda pra `OPEN`; totem
  abre chamado de Limpeza com `originLocation` preenchido; e-mail de teste (mailhog/smtp local)
  chega ao criar chamado num setor com `notificationEmail`.

## 7. Impacto em memória/docs (a fazer na implementação)

- Atualizar `architecture/business-rules.md` (RBAC por setor, aprovação, roteamento).
- Nova decisão `decisions/rbac-setor-executor.md`.
- Nova decisão `decisions/aprovacao-chamados.md`.
- Nova decisão `decisions/notificacao-hibrida-email.md` (estende `notificacao-polling.md`,
  registrar explicitamente que não a substitui).
- Atualizar `docs/memory/README.md` com as novas entradas.
- Handoff de sessão ao final, registrando os 12 setores sem categoria curada como pendência
  explícita (mesmo padrão do handoff `sessao-2026-07-01-backlog.md`).
