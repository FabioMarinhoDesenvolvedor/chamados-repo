# 01 — Visão geral

## O que é

**CHAMADOS — Clube Atlético Juventus** é um sistema interno de chamados (tickets) de TI.
Usuários abrem solicitações descrevendo um problema (podendo anexar prints/imagens), e a
equipe de TI (admin) faz a triagem, define a complexidade, atende e conclui — com histórico
completo de status, comentários e anexos.

## Perfis de acesso

São **três perfis** (enum `Role`):

- **USER** — abre chamados e acompanha **apenas os próprios** (`requester_id = usuário`).
  Pode comentar enquanto o chamado não estiver concluído.
- **OPERATOR** — equipe de atendimento. Vê **todos** os chamados, **assume para si**, altera
  status, comenta e **resolve** (RESOLVED). **Não** abre chamados, **não** faz triagem
  (definir complexidade), **não** conclui (CLOSED), **não** gerencia usuários e **não** acessa
  funcionalidades administrativas (relatórios/departamentos/backup).
- **ADMIN** (TI) — **acesso total**: vê todos os chamados, faz triagem, define complexidade,
  atribui (a qualquer membro do staff), muda status, gerencia usuários e departamentos, gera
  relatórios e opera o backup. Pode abrir em nome de outro usuário.

> **Staff = ADMIN ∪ OPERATOR** (equipe de atendimento). O `assigned_to` de um chamado é sempre
> um membro do staff. Decisão recorrente: **Admin = acesso total.** USER é sempre restrito.

## Fluxo de um chamado (ciclo de vida)

```
TRIAGE ─(admin define complexidade)→ OPEN ─→ IN_PROGRESS ─→ RESOLVED ─→ CLOSED
```

1. **Abertura** — o usuário informa título, descrição e departamento (e pode anexar imagens).
   O admin pode abrir **em nome de outro usuário** (`requesterId`). Nasce em **TRIAGE**, com
   `complexity` e `priority` nulos.
2. **Triagem** — o admin define a complexidade; o sistema calcula a prioridade (matriz fixa) e
   move automaticamente para **OPEN**.
3. **Atendimento** — admin atribui (`assign`) e avança o status. Comentários e anexos formam a
   timeline de acompanhamento.
4. **Conclusão** — status **RESOLVED**/**CLOSED**. A partir daí o **USER não pode mais comentar**.

## Glossário

| Termo | Significado |
|-------|-------------|
| Chamado / Ticket | Solicitação aberta por um usuário |
| Triagem | Etapa em que o admin classifica a complexidade |
| Complexidade | `LOW · MEDIUM · HIGH · CRITICAL` — definida pelo admin |
| Prioridade | `LOW · MEDIUM · HIGH · URGENT` — **calculada** (complexidade × peso do depto) |
| Peso do departamento | `priority_weight` (1–5) usado no cálculo de prioridade |
| Cofre (vault) | Área criptografada, fora do servidor, onde ficam os anexos |
| Senha-mestra | Senha do cofre, só em memória, **nunca persistida** |
| Handoff | Documento de continuidade entre sessões de dev (`docs/memory/handoffs/`) |

## Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Linguagem | TypeScript (strict) |
| Monorepo | NPM workspaces (`shared`, `api`, `web`) |
| Backend | NestJS 10 + Prisma 6 |
| Banco | PostgreSQL 16 (Docker, container `chamados-db`) |
| Auth | JWT stateless (Passport) |
| Frontend | React 18 + Vite 6 (SPA) + Tailwind CSS |
| Estado/dados (web) | TanStack Query; axios |
| Ícones | lucide-react |
| Agendamento | @nestjs/schedule (cron) |
| Criptografia | Node `crypto` (AES-256-GCM, scrypt) |

## Identidade visual

- Nome do app: **CHAMADOS - CLUBE ATLÉTICO JUVENTUS**.
- Tema **grená** (tokens Tailwind), gradientes na sidebar/header.
- Logo do clube em `packages/web/public/logo-juventus.png` (também usada no favicon).
- Mobile-first; `print:hidden` em elementos de navegação para relatórios impressos limpos.
