# Design — 3º nível de categoria ("Detalhe") — 2026-07-01

> Item 1 do backlog `handoffs/sessao-2026-07-01-backlog.md`. Objetivo-mãe do Fabio:
> **facilitar ao máximo a abertura, pro usuário não precisar escrever.** Mais granularidade
> na categorização → menos texto livre. Prepara o terreno para o Item 2 (SLA/complexidade
> automáticos), mas **não implementa** o Item 2.

## Decisões aprovadas (Fabio, 2026-07-01)
1. **Começar pelo Item 1** (3º nível), Item 2 fica travado para depois.
2. **3º nível opcional por subcategoria** (data-driven): subcategoria tem **0..N** detalhes.
3. **Detalhe obrigatório quando a subcategoria tiver detalhes** — sem "pular".
4. **Complexidade via categorização** (Item 2) — aqui só a *estrutura* é criada.
5. **Coluna `base_complexity` entra já nesta migration** (nullable) em subcategoria E detalhe,
   evitando 2ª migration na mesma tabela. Fica **ociosa/NULL** até o Item 2.
6. **Curadoria ampla**: detalhes só onde agrega (device/failure-mode). O mapa abaixo é a
   proposta para o Fabio revisar/ajustar antes de virar seed.

## Não-objetivos (fora de escopo)
- Não mexe na triagem, no `PriorityService`, no `SlaService` nem no status `TRIAGE` (isso é Item 2).
- Não popula `base_complexity` com valores (a coluna nasce e fica NULL; valores validados no Item 2).
- Não cria UI de administração de detalhes (curadoria é via seed na migration, como as categorias).
- Não categoriza/retroalimenta chamados antigos (seguem com `detail_option_id` NULL).

---

## 1. Modelo de dados
Espelha 1:1 o padrão já aprovado de `ticket_subcategories` (não-destrutivo, seed na migration).

### Nova tabela `ticket_detail_options`
| coluna | tipo | nota |
|---|---|---|
| `id` | TEXT PK (uuid) | `gen_random_uuid()` |
| `subcategory_id` | TEXT NOT NULL → `ticket_subcategories(id)` **ON DELETE RESTRICT** | |
| `slug` | TEXT NOT NULL | único **por** subcategoria |
| `name` | TEXT NOT NULL | ex.: "Não liga" |
| `icon` | TEXT NOT NULL | nome do ícone lucide |
| `sort_order` | INTEGER NOT NULL | |
| `base_complexity` | `"Complexity"` **NULL** | prep Item 2; nasce NULL |
| `created_at` | TIMESTAMP(3) NOT NULL DEFAULT now() | |

Índices: `@@unique([subcategory_id, slug])` e `INDEX(subcategory_id)`.

### Alteração em `tickets`
- `detail_option_id TEXT NULL` → FK `ticket_detail_options(id)` **ON DELETE SET NULL** (mesmo
  padrão não-destrutivo de `category_id`/`subcategory_id`).
- `INDEX(detail_option_id)`.

### Alteração em `ticket_subcategories`
- `base_complexity "Complexity" NULL` — fallback de complexidade para subcategorias **sem** 3º
  nível (usado no Item 2; aqui nasce NULL).

### Prisma (`schema.prisma`)
- Novo model `TicketDetailOption` (mapeado a `ticket_detail_options`), relação
  `TicketSubcategory.details TicketDetailOption[]` e `Ticket.detailOption`.
- `Ticket` ganha `detailOptionId String?` + relação; `TicketSubcategory` e `TicketDetailOption`
  ganham `baseComplexity Complexity?` (mapeado a `base_complexity`).

---

## 2. Regras de negócio
- Subcategoria tem **0..N** detalhes (data-driven).
- **Se a subcategoria tem detalhes → escolher um é obrigatório** para concluir o chamado.
  O backend valida (a) que `detailOption.subcategoryId === subcategoryId` e (b) que, quando a
  subcategoria possui detalhes, `detailOptionId` foi informado → senão `400`.
- **Se não tem detalhes → fluxo idêntico ao atual** (subcategoria direto para a descrição).
- **"Assunto" (title) derivado**: `Categoria › Subcategoria › Detalhe` quando houver detalhe;
  senão `Categoria › Subcategoria` (comportamento atual preservado).
- Chamados antigos e chamados de subcategorias sem detalhe seguem com `detail_option_id` NULL.

Atualiza `docs/memory/architecture/business-rules.md` (seção "Abertura guiada por categorias").

---

## 3. Backend (NestJS)
- **`GET /categories`**: incluir `details` **aninhados** dentro de cada subcategoria, ordenados por
  `sort_order` — 1 query, mesmo `include` que hoje traz subcategorias (sem N+1).
- **`POST /tickets`** (`CreateTicketDto` + `tickets.service`):
  - DTO aceita `detailOptionId?: string`.
  - Validação: carregar a subcategoria com seus detalhes; se tiver detalhes e `detailOptionId`
    ausente → `400`; se presente, validar pertencimento à subcategoria → `400` se não pertencer.
  - Derivação do título passa a concatenar o 3º nível quando houver.
- **Projeção/leitura**: incluir `detailOption` onde já se inclui `subcategory` (detalhe e lista),
  para exibir o 3º nível sem N+1.
- **Testes `node:test`** (`tickets.service.spec.ts`):
  1. create com detalhe válido → título de 3 níveis derivado corretamente;
  2. detalhe de outra subcategoria → `400`;
  3. subcategoria com detalhes, sem `detailOptionId` → `400`;
  4. subcategoria sem detalhes, sem `detailOptionId` → cria normalmente (regressão).

---

## 4. Frontend (React)
- **Tipos `@chamados/shared`**: novo `TicketDetailOption { id, subcategoryId, slug, name, icon,
  sortOrder }`; `TicketSubcategory` ganha `details: TicketDetailOption[]`; `Ticket`/`TicketDetail`
  ganham `detailOptionId: string | null` e `detailOption?: TicketDetailOption | null`;
  `CreateTicketInput` ganha `detailOptionId?: string`.
- **`NewTicketPage`**: entra um **grid intermediário de detalhes** entre subcategoria e o form,
  reaproveitando `BlockCard` + `CategoryIcon` (zero componente novo). Regra de fluxo:
  - `subcategory.details.length > 0` → renderiza o grid de detalhes (obrigatório escolher);
  - senão → pula direto para o form atual (descrição + anexos), como hoje.
  - Breadcrumb passa a ter até 4 nós (Categorias › Categoria › Subcategoria › Detalhe), cada um
    clicável para voltar; botão "Voltar" em cada passo (padrão atual). Chip do topo do form mostra
    o detalhe quando presente.
- **`TicketDetailPage`**: exibe o 3º nível (chip/breadcrumb) quando o chamado tiver `detailOption`.
- **Registrar ícones novos** no registry de `CategoryIcon` (ver §5). Fallback `HelpCircle` já cobre
  qualquer nome ausente — degrada com segurança.

---

## 5. Mapa de curadoria (proposta para revisão do Fabio)
Detalhes só nas subcategorias onde há "modo de falha"/"qual dispositivo" claro. As demais
(Acesso e Senhas, Solicitações, Outros, e as subcategorias de Sistemas/Rede mais técnicas) ficam
em **2 níveis + descrição** — já são atômicas. `base_complexity` nasce **NULL** em tudo (Item 2).

Legenda de ícones: ✅ já no registry · 🆕 adicionar ao `CategoryIcon`.

### Computador e Equipamentos

**Computador ou notebook** (`computador-notebook`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | nao-liga | Não liga | `PowerOff` 🆕 |
| 2 | muito-lento | Muito lento / travando | `Gauge` 🆕 |
| 3 | superaquecendo | Superaquecendo / ventoinha | `Thermometer` 🆕 |
| 4 | tela-azul | Tela azul / reinicia sozinho | `MonitorX` 🆕 |
| 5 | nao-reconhece | Não reconhece dispositivo (USB/pen drive) | `Usb` 🆕 |
| 6 | bateria | Bateria não carrega | `BatteryWarning` 🆕 |

**Monitor** (`monitor`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | nao-liga | Não liga | `PowerOff` 🆕 |
| 2 | sem-imagem | Sem imagem / sinal | `MonitorOff` 🆕 |
| 3 | piscando | Piscando / falhando | `MonitorDot` 🆕 |
| 4 | manchas-linhas | Manchas ou linhas na tela | `MonitorX` 🆕 |
| 5 | cabo-conexao | Cabo ou conexão | `Cable` 🆕 |

**Impressora** (`impressora`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | nao-imprime | Não imprime | `Printer` ✅ |
| 2 | atolando | Atolando papel | `FileX` 🆕 |
| 3 | sem-toner | Sem toner / tinta | `Droplet` 🆕 |
| 4 | erro-driver | Erro ou driver | `TriangleAlert` ✅ |
| 5 | qualidade-ruim | Qualidade ruim de impressão | `ImageOff` 🆕 |
| 6 | nao-reconhecida | Não é reconhecida na rede | `PrinterCheck` 🆕 |

**Periféricos** (`perifericos`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | teclado | Teclado | `Keyboard` ✅ |
| 2 | mouse | Mouse | `Mouse` 🆕 |
| 3 | webcam | Webcam | `Webcam` 🆕 |
| 4 | headset-audio | Headset / áudio | `Headphones` 🆕 |
| 5 | outro-periferico | Outro periférico | `Plug` 🆕 |

**Telefonia** (`telefonia`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | sem-linha | Sem linha / tom | `PhoneOff` 🆕 |
| 2 | ruido | Ruído na chamada | `Volume2` 🆕 |
| 3 | ramal-nao-toca | Ramal não toca | `PhoneMissed` 🆕 |
| 4 | config-ramal | Configuração de ramal | `Settings` ✅ |

**Dispositivo móvel** (`dispositivo-movel`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | nao-liga | Não liga / não carrega | `PowerOff` 🆕 |
| 2 | sem-conexao | Sem conexão (dados/Wi-Fi) | `WifiOff` ✅ |
| 3 | app-corporativo | App corporativo com problema | `AppWindow` ✅ |
| 4 | email-config | E-mail / configuração de conta | `Mail` 🆕 |

### Internet e Rede

**Sem conexão à internet** (`sem-conexao`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | cabo | Cabo desconectado | `Cable` 🆕 |
| 2 | wifi | Wi-Fi | `Wifi` ✅ |
| 3 | ponto-rede | Tomada / ponto de rede | `PlugZap` 🆕 |
| 4 | setor-todo | Setor inteiro sem rede | `Network` ✅ |

**Wi-Fi instável ou lento** (`wifi-instavel`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | cai-direto | Cai direto / desconecta | `WifiOff` ✅ |
| 2 | muito-lento | Muito lento | `Gauge` 🆕 |
| 3 | nao-conecta | Não conecta | `Ban` ✅ |
| 4 | sinal-fraco | Sinal fraco em um local | `SignalLow` 🆕 |

**Acesso à rede interna** (`rede-interna`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | vpn | VPN | `ShieldCheck` ✅ |
| 2 | compartilhamento | Pasta / compartilhamento | `FolderX` 🆕 |
| 3 | servidor-sistema | Servidor / sistema interno | `Server` ✅ |
| 4 | impressora-rede | Impressora de rede | `Printer` ✅ |

### Sistemas e Aplicativos

**Erro de funcionamento** (`erro-funcionamento`)
| ordem | slug | nome | ícone |
|---|---|---|---|
| 1 | mensagem-erro | Mostra mensagem de erro | `MessageSquareWarning` 🆕 |
| 2 | trava-fecha | Trava ou fecha sozinho | `AppWindow` ✅ |
| 3 | funcao-nao-funciona | Uma função não funciona | `CircleAlert` 🆕 |
| 4 | dados-incorretos | Dados / informação incorretos | `FileWarning` 🆕 |

### Ícones novos a registrar no `CategoryIcon`
`PowerOff`, `Gauge`, `Thermometer`, `MonitorX`, `Usb`, `BatteryWarning`, `MonitorOff`,
`MonitorDot`, `Cable`, `FileX`, `Droplet`, `ImageOff`, `PrinterCheck`, `Mouse`, `Webcam`,
`Headphones`, `Plug`, `PhoneOff`, `Volume2`, `PhoneMissed`, `Mail`, `PlugZap`, `SignalLow`,
`FolderX`, `MessageSquareWarning`, `CircleAlert`, `FileWarning`.
(Todos existem em `lucide-react`. Se algum não existir na versão instalada, o fallback
`HelpCircle` cobre — validar no build.)

---

## 6. Migration & deploy
- **1 migration não-destrutiva** `add_ticket_details`:
  1. `CREATE TABLE ticket_detail_options` (+ índices/uniques/FK RESTRICT p/ subcategoria);
  2. `ALTER TABLE tickets ADD COLUMN detail_option_id` (+ índice + FK SET NULL);
  3. `ALTER TABLE ticket_subcategories ADD COLUMN base_complexity` (nullable);
  4. `ALTER TABLE ticket_detail_options` já cria `base_complexity` (nullable) na criação;
  5. **Seed idempotente** (`ON CONFLICT (subcategory_id, slug) DO NOTHING`) dos detalhes do §5.
     ⚠️ Slug de subcategoria é único só por categoria (`unique(category_id, slug)`), **não**
     global → o join do seed deve resolver a subcategoria por **categoria + subcategoria**
     (`ticket_categories.slug` = X **AND** `ticket_subcategories.slug` = Y), nunca só pelo slug
     da subcategoria. `base_complexity` **não** é preenchido (fica NULL).
- **Produção** recebe via `prisma migrate deploy` (não depende do seed de dev).
- **Reverso manual** (não-destrutivo p/ chamados): `DROP TABLE ticket_detail_options;` +
  `ALTER TABLE tickets DROP COLUMN detail_option_id;` +
  `ALTER TABLE ticket_subcategories DROP COLUMN base_complexity;` (chamados preservados).
- **Deploy é do usuário.** Ordem: `db:generate` → `db:deploy` → build `shared → api → web` →
  restart. Nada subido pelo Claude.

---

## 7. Verificação (antes de entregar)
- `npm run build` (shared → api → web) limpo; web `tsc --noEmit` limpo; `vite build` limpo.
- `npm test -w @chamados/api` — todos os testes + os 4 novos passando.
- Smoke local (headless): fluxo Monitor → grid de detalhes → concluir → detalhe com 3 níveis;
  subcategoria sem detalhe (ex.: Redefinição de senha) → pula direto pra descrição (regressão).

## 8. Impacto em memória/docs
- Atualizar `architecture/business-rules.md` (abertura guiada — 3º nível).
- Nova decisão `decisions/terceiro-nivel-categoria.md` (data-driven, obrigatório quando existe).
- Handoff da sessão ao final; atualizar `docs/memory/README.md`.
