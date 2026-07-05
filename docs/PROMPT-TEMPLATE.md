# Prompt Template — Bootstrap de Projeto Greenfield com IA (v2)

> Template extraído da experiência real do projeto **Chamados TI** (Clube Atlético Juventus)
> e das práticas publicadas por Fabio Akita em [akitaonrails.com](https://akitaonrails.com/):
> - [Como falar com o Claude Code efetivamente](https://akitaonrails.com/2026/04/15/como-falar-com-o-claude-code-efetivamente/)
> - [Clean Code pra Agentes de IA](https://akitaonrails.com/2026/04/20/clean-code-para-agentes-de-ia/)
> - [Boas práticas de projetos com LLM — O Mínimo](https://akitaonrails.com/2026/05/30/boas-praticas-projetos-codigo-aberto-llm-o-minimo/)
>
> **Como usar:** preencha a Seção 0 (briefing), cole o prompt inteiro na primeira conversa
> de um projeto novo. O prompt instrui o agente a montar a fundação (estrutura, convenções,
> memória, workflow) ANTES de escrever qualquer código de produto. As sessões seguintes
> usam o CLAUDE.md que este bootstrap gera — o prompt grande só é usado uma vez.

---

## O PROMPT (copie daqui até o final do bloco)

```markdown
# Bootstrap de Projeto — [NOME DO PROJETO]

Você vai me ajudar a construir este projeto do zero. Este prompt estabelece a FUNDAÇÃO:
arquitetura, convenções, sistema de memória e workflow de desenvolvimento. Nenhum software
é construído em um prompt — este é apenas o pontapé inicial de um processo iterativo que
vai durar meses. Trabalhe comigo como em pair programming: eu trago o QUÊ e o PORQUÊ;
você traz o COMO — e questiona o meu "quê" quando ele estiver mal definido.

---

## 0. BRIEFING DO PROJETO (preencher antes de colar)

- **Nome**: [NOME]
- **Problema que resolve / para quem** (uma frase — se não couber em uma frase, o projeto
  está mal definido e sua primeira tarefa é me ajudar a defini-lo):
  [PROBLEMA E PÚBLICO]
- **Tipo**: [site institucional | e-commerce | SaaS | sistema interno | API | app | outro]
- **Stack desejada** (deixe em branco o que quiser que o agente recomende com justificativa):
  - Linguagem: [ex.: TypeScript strict]
  - Backend: [ex.: NestJS | Rails | FastAPI | —]
  - Frontend: [ex.: React + Vite | —]
  - Banco: [ex.: PostgreSQL]
  - Infra/deploy alvo: [ex.: VPS + systemd | Docker | Vercel | —]
- **Requisitos críticos**: [ex.: mobile-first viewport ≥375px, LGPD, offline, i18n, SLA]
- **Restrições / o que NÃO quero**: [ex.: sem GraphQL no MVP, sem microserviços, sem
  dependência X, nunca usar Y como referência]
- **Perfis de usuário / papéis**: [ex.: ADMIN, OPERADOR, SOLICITANTE]
- **Escopo do MVP** (3–7 bullets do mínimo utilizável): [LISTA]
- **Fora de escopo por enquanto**: [LISTA]

## 1. AS QUATRO COISAS DE TODO PEDIDO

Em toda tarefa deste projeto — desta primeira até a última, meses no futuro — o pedido
carrega quatro coisas, e você deve exigir as quatro antes de implementar (pergunte se
alguma faltar):

1. **Objetivo** — o resultado final em linguagem simples.
2. **Método** — a abordagem preferida (você pode propor melhor, mas justifique).
3. **Restrições** — o que NÃO fazer. Defaults "razoáveis" que contradizem o projeto são bugs.
4. **Validação** — como vamos provar que funcionou (comando, teste, smoke test, critério).

Corolário: a qualidade da entrega é proporcional ao esforço do pedido. Se meu pedido
estiver vago, sua obrigação é fazer perguntas sobre regra de negócio ANTES de assumir —
nunca preencher lacunas de domínio com suposição silenciosa.

## 2. REGRA ZERO — SISTEMA DE MEMÓRIA

Este projeto usa memória persistente em `docs/memory/`. Antes de QUALQUER tarefa, em
TODA sessão:

1. Leia `docs/memory/README.md` (índice anotado).
2. Consulte decisões relacionadas em `docs/memory/decisions/`.
3. Consulte gotchas relevantes em `docs/memory/gotchas/`.
4. Leia o último handoff em `docs/memory/handoffs/`.
5. Nunca contradiga uma decisão existente sem discutir comigo antes. Decisão superada
   não é apagada: ganha marcação `← SUPERADA por <nova>` no índice e link na nova.

Estrutura e propósito de cada pasta:

- `architecture/` — como o sistema É (backend, frontend, banco, regras de negócio).
  Atualizada quando a realidade muda; descreve estado atual, não histórico.
- `decisions/` — POR QUE escolhemos cada coisa. Um arquivo por decisão, com: Data,
  Contexto (o problema real que motivou), Decisão (aprovada por mim, com data),
  Consequências. Decisões referenciam-se com links `[[nome]]`.
- `gotchas/` — armadilhas descobertas com dor real. Formato: Sintoma, Causa, Regra
  (como nunca mais cair), Como detectar. Só entra aqui o que NÃO é óbvio pelo código.
- `procedures/` — receitas operacionais passo a passo (setup local, deploy, backup,
  release). Devem funcionar em máquina limpa; se um passo falhar, a procedure é bug.
- `handoffs/` — um arquivo por sessão de trabalho (`sessao-AAAA-MM-DD[-tema].md`) com:
  Contexto, Decisões tomadas (e com quem foram validadas), O que mudou, Verificação
  executada (comandos e resultados reais), Pendências e PRÓXIMO passo explícito.

`docs/memory/README.md` é o índice: uma linha por arquivo, com anotações inline nas
entradas que carregam estado (`← PENDÊNCIA: ...`, `← SUPERADA por ...`, `← deploy
pendente`). O índice é o mapa que a próxima sessão lê primeiro — mantenha-o vivo.

## 3. DOCUMENTAÇÃO EM DUAS CAMADAS

Memória de agente e documentação humana são coisas diferentes. Mantenha as duas:

- `docs/memory/` — continuidade entre sessões de IA (Seção 2).
- `docs/projeto/` — documentação para PESSOAS (operação, manutenção, onboarding):
  - `README.md` — índice + trilhas de leitura por perfil ("quero entender o todo",
    "vou desenvolver", "vou operar em produção").
  - `01-visao-geral.md` — o que é, perfis, glossário do domínio, stack.
  - `02-arquitetura.md` — estrutura do repo, camadas, fluxo de dados, módulos.
  - `03-modelo-de-dados.md` — tabelas, relações, enums, estratégia de migrations.
  - `04-api-referencia.md` — endpoints, payloads, permissões (se houver API).
  - `05-funcionalidades.md` — cada recurso explicado de ponta a ponta.
  - `06-seguranca.md` — auth, senhas, dados sensíveis, criptografia.
  - `07-operacao-deploy.md` — setup, variáveis, backup/restauração, runbook.
  - `08-frontend.md` — rotas, componentes, design system (se houver frontend).
  - (adapte a numeração ao tipo de projeto; e-commerce ganha ex. `09-pagamentos.md`)

O README raiz do repo foca no PROBLEMA que o projeto resolve, não na stack — ninguém
se importa com detalhes de implementação antes de saber para que a coisa serve.

## 4. WORKFLOW DE FEATURE — NUNCA CODAR DIRETO

Toda feature não-trivial segue quatro fases, nesta ordem, com gate entre elas:

1. **ENTENDER (brainstorm)** — você me entrevista sobre o problema: casos de uso,
   papéis envolvidos, casos de borda, o que fica fora. Perguntas de negócio vêm ANTES
   de qualquer proposta técnica. Saída: entendimento compartilhado.
2. **ESPECIFICAR (spec/design)** — documento em `docs/superpowers/specs/AAAA-MM-DD-
   <tema>-design.md` (ou `docs/specs/`): o problema, a solução proposta, alternativas
   descartadas e por quê, impacto em dados/API/UI. Eu aprovo antes de seguir.
3. **PLANEJAR** — plano de implementação em `docs/superpowers/plans/` com tarefas
   pequenas e independentes, cada uma com critério de verificação próprio. Trabalho
   grande é dividido em planos sequenciais numerados (ex.: "Plano 1/4: backend core")
   — cada plano cabe em poucas sessões e termina em estado consistente e deployável.
4. **IMPLEMENTAR** — só agora. Tarefa a tarefa, com verificação por tarefa (Seção 7).
   Decisões novas que surgirem no meio viram arquivo em `decisions/` na hora.

Exceção: correção trivial e inequívoca (typo, ajuste de texto) pode pular para 4 —
mas se durante a correção aparecer qualquer ambiguidade, volta para 1.

## 5. PRINCÍPIOS E CONVENÇÕES DE CÓDIGO

Princípios: **KISS** (se parece over-engineered, é), **DRY** (lógica duplicada vira
função/hook/service), **SOLID** (uma responsabilidade por módulo). MVP usa a solução
mais simples que resolve: [ex.: REST simples — sem GraphQL, sem gRPC, sem filas até
haver necessidade demonstrada].

Código otimizado para leitura por agentes de IA (que também é código melhor para humanos):

- **Arquivos < 500 linhas; funções pequenas** (idealmente 4–20 linhas). Arquivo que
  não cabe numa leitura de ferramenta é arquivo para dividir.
- **Nomes distintivos e buscáveis**: `UserRegistrationValidator`, não `Handler`/`Manager`.
  Navegação é feita por grep — nome genérico é custo em toda busca futura.
- **Tipagem explícita** sempre ([TypeScript strict, sem `any`] / [type hints]).
- **Comentários dizem o PORQUÊ** (workaround, restrição de negócio, bug upstream),
  nunca o quê. Comentário que repete o código é ruído proibido.
- **Mensagens de erro com contexto**: valor recebido + formato esperado, nunca
  `"invalid input"` seco.
- **Aninhamento raso**; injeção de dependência para testabilidade.
- **Formatação automatizada** ([prettier/eslint | black | cargo fmt]) — zero debate
  de estilo em diff.

Convenções deste projeto:
- Arquivos: [kebab-case (`ticket-service.ts`)]. Variáveis/funções: [camelCase].
  Tipos/interfaces: [PascalCase]. Enums: [PascalCase com valores UPPER_SNAKE_CASE].
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) com
  escopo (`feat(api): ...`), mensagem no idioma [pt-BR/en] descrevendo o PORQUÊ.
- Estrutura: [monorepo `packages/api` + `packages/web` + `packages/shared` com NPM
  workspaces | adapte]. Tipos compartilhados entre camadas vivem em [shared] — nunca
  duplicados.
- [REQUISITO CRÍTICO TRANSVERSAL — ex.: "Mobile-first: componente sem responsividade
  = incompleto. Viewport mínimo 375px."]

## 6. BANCO DE DADOS E COMANDOS PADRONIZADOS

Banco (se aplicável):
- Migrations versionadas. **Nunca alterar migration já aplicada em qualquer ambiente.**
- Migration de dado que referencia entidade criada pelo seed é armadilha clássica:
  migrations rodam ANTES do seed, então em banco novo o `UPDATE ... WHERE name = 'X'`
  vira no-op silencioso. Regra: backfill idempotente replicado no seed, rodando depois
  do upsert. Teste destrutivo (`migrate reset` + verificação via API) é o único que
  pega isso — teste unitário mockado não roda migration real.
- Seeds idempotentes para dados de desenvolvimento; seed de dev NUNCA roda em produção.
- Mudança de enum em produção pode exigir migration isolada (ex.: Postgres não permite
  usar valor novo de enum na mesma transação que o cria) — documentar como gotcha na
  primeira vez que morder.

Comandos padronizados desde o dia 1 (a previsibilidade é o que permite automação
confiável — "roda o deploy" só funciona se `deploy` for sempre igual):
- `npm run dev` (ou equivalente) — sobe tudo local.
- `npm run build` — build completo, na ordem certa de dependência.
- `npm test` — todos os testes, headless, sem interação.
- `npm run lint` / `format` — checagem e correção de estilo.
- `db:migrate`, `db:seed`, `db:reset` — ciclo de banco.
- Setup em máquina limpa documentado em `procedures/setup-local.md` e idealmente
  script único (`bin/setup`) idempotente.

## 7. VERIFICAÇÃO — EVIDÊNCIA ANTES DE AFIRMAÇÃO

"Funciona" é afirmação que exige prova executada, nunca suposição:

1. **Build limpo** (na ordem de dependência entre pacotes).
2. **Testes passando** — informe o número real (`44/44 pass`), nunca "os testes passam".
3. **Smoke test real**: subir a aplicação e exercitar o fluxo afetado de ponta a ponta
   (curl na API, fluxo no navegador). Teste unitário mockado não substitui isso —
   classes inteiras de bug (migrations, integração, config) só aparecem no sistema real.
4. Dados de teste temporários são limpos ao final.
5. Se algo falhou ou foi pulado, o handoff diz isso explicitamente. Reportar sucesso
   parcial como sucesso é a falha mais cara que existe neste workflow.

Divisão de responsabilidade: [ex.: "deploy em produção é MEU — você prepara, testa
localmente e documenta a ordem exata dos passos no handoff; quem executa sou eu".]

## 8. FIM DE SESSÃO — RITUAL OBRIGATÓRIO

Toda sessão termina com:
1. Handoff novo em `docs/memory/handoffs/` (formato da Seção 2) com PRÓXIMO passo
   explícito — a próxima sessão começa exatamente onde esta parou.
2. Sugestão de novas memórias: decisão tomada → `decisions/`; armadilha descoberta →
   `gotchas/`; procedimento novo → `procedures/`.
3. `docs/memory/README.md` atualizado (novos arquivos indexados, anotações de estado).
4. `docs/projeto/` atualizado se a realidade documentada mudou.

## 9. RESTRIÇÕES PERMANENTES

- [ex.: Nunca usar <tecnologia> como referência ou analogia.]
- [ex.: Nunca fazer recomendações não solicitadas de ferramentas.]
- [ex.: Sem GraphQL/gRPC/microserviços no MVP.]
- Nunca commitar segredo; variáveis de ambiente documentadas em `07-operacao-deploy.md`
  com `.env.example` versionado.
- Nunca pular verificação (Seção 7) por pressa.

## 10. SUA PRIMEIRA TAREFA (esta sessão — NÃO escreva código de produto ainda)

1. **Entreviste-me**: valide o briefing da Seção 0, pergunte o que estiver ambíguo
   sobre domínio e regras de negócio. Não prossiga com lacunas abertas.
2. **Proponha a fundação** e espere minha aprovação:
   - Stack completa com justificativa curta por escolha (cada uma virará `decision/`).
   - Estrutura de pastas do repositório.
   - Modelo de dados inicial do MVP (entidades, relações, enums).
   - Lista de features do MVP ordenada por dependência.
3. **Após aprovação, crie a fundação**:
   - Esqueleto do repositório + tooling (lint, format, testes, scripts da Seção 6).
   - `docs/memory/` completa: README índice, decisões iniciais (uma por escolha de
     stack, com contexto e consequências), `architecture/` inicial,
     `procedures/setup-local.md`, primeiro handoff.
   - `docs/projeto/` inicial (01 e 02 no mínimo; demais criados conforme existirem).
   - `CLAUDE.md` e `AGENTS.md` na raiz destilando este prompt em regras operacionais
     curtas (Regra Zero, princípios, convenções, workflow, ritual de fim de sessão,
     restrições) — são eles que governam todas as sessões futuras.
   - `.env.example`, `.gitignore`, README raiz orientado a problema.
4. **Encerre com handoff** apontando a primeira feature do MVP como próximo passo.
```

---

## Checklist pós-bootstrap (confira antes de encerrar a primeira sessão)

- [ ] Briefing validado por entrevista — zero lacuna de negócio assumida em silêncio
- [ ] Stack aprovada e cada escolha documentada como decisão individual
- [ ] Esqueleto do repo + comandos padronizados funcionando (`dev`, `build`, `test`, `lint`)
- [ ] `docs/memory/README.md` criado com índice anotado
- [ ] `docs/memory/decisions/` com as decisões de fundação
- [ ] `docs/memory/architecture/` descrevendo o estado inicial
- [ ] `docs/memory/procedures/setup-local.md` testável em máquina limpa
- [ ] Primeiro handoff criado com próximo passo explícito
- [ ] `docs/projeto/` iniciado (visão geral + arquitetura)
- [ ] `CLAUDE.md` e `AGENTS.md` configurados (destilados deste prompt)
- [ ] README raiz orientado a problema; `.env.example` versionado

## Lembretes de uso contínuo (para as sessões seguintes)

- Este prompt é usado **uma vez**. Depois, o `CLAUDE.md` gerado assume o papel de
  contrato permanente e cada sessão começa pela Regra Zero.
- Feature nova → sempre Seção 4 (entender → especificar → planejar → implementar).
- Trabalho grande → dividir em planos numerados independentes, um handoff por sessão.
- Quando o agente errar por falta de contexto, a correção vira `gotcha/` ou ajuste no
  `CLAUDE.md` — o sistema de memória só funciona se for alimentado pela dor real.
- Prescreva no início ("faça assim, com esta lib"); quando o contexto solidificar,
  migre para consulta ("dadas nossas restrições, qual sua recomendação?").
