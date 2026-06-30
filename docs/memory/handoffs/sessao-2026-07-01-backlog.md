# Backlog / Próxima sessão — 2026-07-01

> Ideias do Fabio (30/06) anotadas para a próxima sessão. **Nada implementado ainda.**
> Objetivo central do Fabio: **facilitar ao máximo a abertura, para o usuário não precisar
> escrever.** Antes de codar qualquer um destes itens: brainstorming → decidir os pontos em
> aberto (abaixo) → plano. O item 2 mexe em DECISÃO APROVADA (ver ⚠️).

---

## Item 1 — Terceiro nível de categoria ("detalhe")
**Pedido:** após Categoria → Subcategoria, ter mais um nível. Ex.: *Computador e Equipamentos
→ Monitor → "Monitor falhando" / "Monitor com defeito"*. Quanto mais granular, menos texto livre.

**Como aplicar (Fabio):** "quero que se aplique a tudo (só vi o defeito no monitor; se os outros
estiverem ok com esse fluxo, beleza)". → ou seja: aplicar de forma ampla, mas **opcional por
subcategoria** (nem toda subcategoria precisa de um 3º nível).

**Modelagem proposta (minha sugestão):**
- Nova tabela `ticket_detail_options` (FK → subcategoria, `slug`, `name`, `icon`, `sort_order`),
  análoga às subcategorias. Subcategoria pode ter **0..N** detalhes.
- `tickets` ganha `detail_option_id` (nullable, FK SET NULL) — mesmo padrão não-destrutivo da
  migration de categorias.
- Fluxo: se a subcategoria escolhida tiver detalhes → mostra o 3º grid (mesmos cards/ícones/
  breadcrumb de 3 níveis, botão Voltar em cada). Se não tiver → vai direto para a descrição
  (como hoje). Reaproveita 100% o `CategoryIcon`/grid já feitos.
- "Assunto" derivado passa a "Categoria › Subcategoria › Detalhe" (quando houver detalhe).

**Exemplos de detalhes (rascunho, a validar):**
- Monitor → não liga · sem imagem · piscando/falhando · manchas/defeito · cabo/conexão.
- Impressora → não imprime · atolando papel · sem toner · erro/driver · qualidade ruim.
- Computador/notebook → não liga · muito lento · superaquecendo · tela azul · bateria.
- Sem conexão → cabo · Wi-Fi · ponto/tomada de rede · sem rede no setor todo.

---

## Item 2 — Prazo (SLA) e complexidade automáticos  ⚠️ MEXE EM DECISÃO APROVADA
**Bug observado:** ao definir o status pelo dashboard, a coluna **"Prazo" fica "Em triagem"** e
não mostra tempo. **Causa:** prioridade/SLA só existem **após a triagem** (admin define a
complexidade → matriz calcula a prioridade → SLA). Um chamado ainda não triado tem `priority`
nula; mudar o status (ex.: IN_PROGRESS) **não** define prioridade, então `slaHours` segue nulo e
a UI mostra "Em triagem" mesmo já em andamento.

**Pedido do Fabio:**
1. Prazo definido **automaticamente** (peso do setor entra no cálculo).
2. **Tirar a complexidade do controle do admin** → automático.
3. "Queria usar alguma inteligência pra definir a complexidade."

**⚠️ Conflito a resolver:** isso altera as decisões aprovadas `triagem-complexidade` e a matriz de
prioridade (`priority = f(complexity, peso_setor)`, aprovada 25/06). O CLAUDE.md proíbe contradizer
decisão aprovada sem discutir → **decidir junto com o Fabio na próxima sessão.**

**Minha recomendação (o que eu penso como melhoria):**
- **A "inteligência" mais barata e robusta é a própria categorização.** Em vez de LLM, anexar uma
  **complexidade-base** a cada subcategoria/detalhe (ex.: "Sistema indisponível" = CRITICAL;
  "Redefinição de senha" = LOW; "Monitor com defeito" = MEDIUM). Na **criação**, calcular
  `priority = matriz(complexidade-base, peso_do_setor)` automaticamente → o chamado **nasce já com
  prioridade e SLA**. Isso **resolve o bug de raiz** (todo chamado tem prazo desde a abertura) e
  atende "peso do setor entra" + "complexidade automática", reusando a matriz que já existe.
- Efeitos: **acaba o passo de triagem manual** (chamado nasce OPEN priorizado, não em TRIAGE);
  remover o seletor de complexidade do detalhe; `slaStartedAt` passa a ser na criação.
- **Override opcional do admin** (não obrigatório): manter um jeito do admin reclassificar a
  complexidade de um chamado específico, se quiser — mas o padrão é automático.
- **IA de verdade (LLM) = fase 2 opcional.** Inferir complexidade a partir da descrição livre com
  um modelo só faria sentido como camada extra (sobrepõe a base quando há texto). Numa rede interna
  (LAN, 4 núcleos), adiciona dependência/custo/latência/nondeterminismo — não recomendo para o MVP;
  a categorização granular (com o 3º nível do item 1) já dá um sinal muito bom de complexidade.

**Sinergia com o Item 1:** o 3º nível ("detalhe") é o lugar natural para carregar a complexidade-
base mais precisa (ex.: "Monitor não liga" pode ser MEDIUM, "Monitor com manchas" LOW). Os dois
itens se reforçam: mais granularidade → complexidade automática mais justa → menos texto e zero
triagem manual.

---

## Pontos em aberto (decidir antes de codar)
1. **3º nível:** confirma "opcional por subcategoria" (data-driven)? Quais subcategorias ganham
   detalhes e quais ficam no 2º nível + descrição?
2. **Origem da complexidade:** categorização (recomendado) · LLM · híbrido?
3. **Triagem:** elimina o status TRIAGE de vez (nasce OPEN priorizado) ou mantém TRIAGE só como
   "recém-criado" mas já com prioridade? Admin pode sobrescrever a complexidade?
4. **Curadoria:** quem mantém o mapa subcategoria/detalhe → complexidade-base (vai no seed da
   migration, como as categorias).
5. **Chamados antigos** sem categoria/complexidade: mantêm comportamento atual (nullable) — ok?

## Impacto previsto (alto nível, para dimensionar)
- Banco: +1 tabela (`ticket_detail_options`) + coluna `detail_option_id`; coluna/seed de
  complexidade-base por subcategoria/detalhe. Migrations não-destrutivas.
- Backend: `create` calcula prioridade/SLA na abertura (nasce OPEN); fim do passo de triagem;
  `GET /categories` devolve o 3º nível aninhado.
- Frontend: 3º grid no fluxo guiado; remover seletor de complexidade do detalhe; dashboard deixa
  de mostrar "Em triagem" para chamados ativos (prazo sempre definido).
- Atualizar decisões em `docs/memory/decisions/` (triagem-complexidade) e `business-rules.md`.
