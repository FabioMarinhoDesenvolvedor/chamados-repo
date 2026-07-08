# Multi-setorial Plano 3/4 — Frontend (macro-bloco + fila por setor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao fluxo guiado de abertura um **passo 0 de macro-bloco (setor)** que agrupa/filtra as categorias por setor executor, e mostrar o **nome do setor no header do dashboard** para staff escopado — sem construir UI de aprovação (superada).

**Architecture:** Puramente frontend + 1 campo de tipo no `@chamados/shared`. As categorias já trazem `departmentId` no runtime (a API usa `include`, sem `select`); o `NewTicketPage` já busca a lista de `Department`. Agrupa-se as categorias por `departmentId` para montar os blocos dinamicamente (todo setor executor com ≥1 categoria vira bloco — sem hardcode de setores). Nenhuma mudança de backend, migration ou dado.

**Tech Stack:** React/Vite, `@chamados/shared`, TanStack Query (hooks existentes `useCategories`/`useDepartments`), Tailwind + tema grená, `components/ui` (`BlockCard`/`CategoryIcon`).

## Global Constraints

- TypeScript strict, **sem `any`**. Tipos compartilhados só em `@chamados/shared`.
- Ordem de build/verificação `shared → web` (api não muda).
- **NÃO construir UI de aprovação** (botão "Aprovar"/`PENDING_APPROVAL`): superada por
  `decisions/sla-dois-tempos-automatico` — o Plano 3 não faz aprovação.
- Macro-bloco **automático/data-driven**: os blocos são os `Department`s executores que têm
  categorias; novos setores aparecem sozinhos quando ganharem categorias. Sem lista fixa de setores.
- Mobile-first (viewport mínimo 375px). Reaproveitar `BlockCard`/`CategoryIcon`/`components/ui` —
  sem redesign.
- IDs são inteiros (`number`) — já refletido em `@chamados/shared`.
- Ícone do bloco: `Department` não tem coluna `icon`; usar um mapa nome→ícone no frontend com
  fallback genérico (`Building2`). Não é hardcode de "quais setores", só de apresentação.
- Commits: conventional commits com escopo (`feat(web):`, `feat(shared):`).

## File Structure

- `packages/shared/src/types.ts` — `TicketCategory` ganha `departmentId: number | null` (a API já
  retorna; só falta declarar). Propaga para `CategoryWithSubcategories` (que estende `TicketCategory`).
- `packages/web/src/pages/NewTicketPage.tsx` — passo 0 de macro-bloco + filtro das categorias +
  nó de breadcrumb. Arquivo central desta feature.
- `packages/web/src/lib/department-icon.ts` (novo) — mapa nome-de-setor → ícone lucide (+ fallback).
- `packages/web/src/components/CategoryIcon.tsx` — estender o mapa fixo com os ícones de
  Manutenção/Limpeza (hoje caem no fallback `HelpCircle`) + os do macro-bloco.
- `packages/web/src/pages/DashboardPage.tsx` — nome do setor no header quando o staff é escopado.
- `docs/memory/` — handoff + atualização de business-rules/README.

---

### Task 1: Shared — `TicketCategory.departmentId`

**Files:**
- Modify: `packages/shared/src/types.ts` (interface `TicketCategory`, ~linha 40)

**Interfaces:**
- Produces: `TicketCategory.departmentId: number | null` (herdado por `CategoryWithSubcategories`).

- [ ] **Step 1: Declarar `departmentId` no `TicketCategory`**

Em `packages/shared/src/types.ts`, na interface `TicketCategory`, adicionar após `sortOrder`:

```typescript
  sortOrder: number;
  // Setor EXECUTOR dono do bloco (roteamento). Null = categoria legada sem setor.
  departmentId: number | null;
```

- [ ] **Step 2: Build do shared**

Run: `npm run build -w @chamados/shared`
Expected: build limpo.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): TicketCategory expõe departmentId (setor executor do bloco)"
```

---

### Task 2: Frontend — passo 0 de macro-bloco no `NewTicketPage`

**Files:**
- Create: `packages/web/src/lib/department-icon.ts`
- Modify: `packages/web/src/pages/NewTicketPage.tsx`

**Interfaces:**
- Consumes: `useCategories()` (categorias com `departmentId`), `useDepartments()` (nomes), `TicketCategory.departmentId` (Task 1).
- Produces: fluxo `Setor → Categoria → Subcategoria → Detalhe → Form`.

> **Comportamento:** blocos = os `Department`s que aparecem como `departmentId` em ≥1 categoria
> (distintos, ordenados por nome). Categoria sem `departmentId` (mis-configurada) não entra em bloco
> nenhum — não some silenciosamente o fluxo, mas essas categorias não podem gerar chamado mesmo
> (o backend rejeita `categoria sem setor`), então não aparecem. ADMIN e USER veem todos os blocos
> (chamado cross-setor é o esperado — o roteamento vem da categoria).

- [ ] **Step 1: Criar o mapa de ícone por setor**

Criar `packages/web/src/lib/department-icon.ts`:

```typescript
// Ícone (lucide) por setor para os cards de macro-bloco. Mapa só de apresentação: os blocos em si
// são data-driven (qualquer setor com categoria aparece). Setor sem entrada cai no fallback.
const DEPARTMENT_ICON: Record<string, string> = {
  TI: 'Laptop',
  Manutenção: 'Wrench',
  Limpeza: 'Sparkles',
};

export function departmentIcon(name: string): string {
  return DEPARTMENT_ICON[name] ?? 'Building2';
}
```

- [ ] **Step 2: Escrever o teste manual do agrupamento (helper puro)**

Para manter a lógica de agrupamento testável e fora do JSX, adicionar no topo de `NewTicketPage.tsx`
(ou num helper próximo) uma função pura e usá-la no componente:

```typescript
// Blocos de setor = setores executores que têm ao menos uma categoria. Data-driven.
function buildBlocks(
  categories: CategoryWithSubcategories[],
  departments: Department[],
): { id: number; name: string }[] {
  const withDept = new Set(
    categories.map((c) => c.departmentId).filter((d): d is number => d != null),
  );
  return departments
    .filter((d) => withDept.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ id: d.id, name: d.name }));
}
```

- [ ] **Step 3: Adicionar o estado do bloco e derivar as categorias filtradas**

No componente `NewTicketPage`, adicionar o estado do bloco selecionado e a lista filtrada, perto dos
outros `useState`:

```typescript
const [block, setBlock] = useState<{ id: number; name: string } | null>(null);
const blocks = useMemo(
  () => (categories && departments ? buildBlocks(categories, departments) : []),
  [categories, departments],
);
const blockCategories = useMemo(
  () => (block ? (categories ?? []).filter((c) => c.departmentId === block.id) : []),
  [categories, block],
);
```

Ajustar `backToCategories` (e o reset ao trocar de bloco) para limpar `category`/`subcategory`/
`detailOption`/`detailSkipped` **e** voltar ao passo de bloco quando fizer sentido. Adicionar:

```typescript
const backToBlocks = () => {
  setBlock(null);
  setCategory(null);
  setSubcategory(null);
  setDetailOption(null);
  setDetailSkipped(false);
};
```

- [ ] **Step 4: Inserir o passo 0 (grid de blocos) e filtrar o passo de categorias**

No JSX de passos, **antes** do "Passo 1: blocos principais" (categorias), inserir o passo de setor e
condicionar a exibição das categorias ao bloco escolhido. Substituir o ramo `!category ? (…)` atual
por uma cadeia que começa no bloco:

```tsx
) : !block ? (
  // Passo 0: macro-bloco (setor) — data-driven
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {blocks.map((b) => (
      <BlockCard key={b.id} icon={departmentIcon(b.name)} label={b.name} onClick={() => setBlock(b)} />
    ))}
  </div>
) : !category ? (
  // Passo 1: categorias do setor escolhido
  <div className="space-y-4">
    <Button variant="ghost" className="px-2" onClick={backToBlocks}>
      <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para os setores
    </Button>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {blockCategories.map((c) => (
        <BlockCard key={c.id} icon={c.icon} label={c.name} onClick={() => setCategory(c)} />
      ))}
    </div>
  </div>
) : !subcategory ? (
```

(As demais etapas — subcategoria, detalhe, form — permanecem inalteradas.)

- [ ] **Step 5: Breadcrumb ganha o nó "Setor"**

No `<nav>` do breadcrumb, prepender um nó de setor antes de "Categorias":

```tsx
<button
  type="button"
  onClick={backToBlocks}
  className={block ? 'text-grena hover:underline' : 'font-medium text-gray-800'}
>
  Setor
</button>
{block && (
  <>
    <ChevronRight className="h-4 w-4 text-gray-400" />
    <button
      type="button"
      onClick={() => { setCategory(null); setSubcategory(null); setDetailOption(null); setDetailSkipped(false); }}
      className={category ? 'text-grena hover:underline' : 'font-medium text-gray-800'}
    >
      {block.name}
    </button>
  </>
)}
```

Remover/ajustar o antigo nó raiz "Categorias" para que a raiz agora seja "Setor" (o nó do
`block.name` cumpre o papel do antigo "Categorias"). Garantir que `category && (…)` e os nós
seguintes continuem coerentes.

- [ ] **Step 6: Estender `CategoryIcon` com os ícones que faltam (bloco + categorias novas)**

`packages/web/src/components/CategoryIcon.tsx` é um **mapa fixo** de ícones lucide com fallback
`HelpCircle` (`ICONS[name] ?? HelpCircle`, ~linha 137). Ele foi montado para os ícones de TI, então
os ícones das categorias/subcategorias de **Manutenção/Limpeza** (semeadas no Plano 1) hoje caem no
fallback e renderizam `HelpCircle`. Ao mostrar esses setores no fluxo (Task 2), isso ficaria visível.
Adicionar ao import e ao `ICONS` os que faltam (confirmados ausentes):

```
Armchair, Building2, DoorClosed, Hammer, ShowerHead, Snowflake, Sparkles, Trash2, Trees, Zap
```

Isso cobre tanto os ícones das categorias novas quanto os do macro-bloco (`Laptop`/`Wrench` já
existem; `Sparkles` para Limpeza e `Building2` para o fallback do `departmentIcon` passam a existir).

- [ ] **Step 7: Garantir imports**

Confirmar imports de `useMemo`, `Department`/`CategoryWithSubcategories` (de `@chamados/shared`) e
`departmentIcon` (novo lib) no `NewTicketPage`.

- [ ] **Step 8: Build do web**

Run: `npm run build -w @chamados/shared && npm run build -w @chamados/web`
Expected: limpo (`tsc --noEmit && vite build`).

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/lib/department-icon.ts packages/web/src/pages/NewTicketPage.tsx packages/web/src/components/CategoryIcon.tsx
git commit -m "feat(web): passo 0 de macro-bloco (setor) no fluxo guiado + ícones de Manutenção/Limpeza"
```

---

### Task 3: Frontend — nome do setor no header do dashboard

**Files:**
- Modify: `packages/web/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `user` (com `departmentId`), `useDepartments()`.

> Quando o staff é **escopado** (`OPERATOR` com `departmentId`), o header mostra "Fila — <setor>".
> `ADMIN` (global, sem restrição) mantém o título atual. USER não é afetado.

- [ ] **Step 1: Derivar o rótulo do setor**

Em `DashboardPage.tsx`, obter o nome do setor do staff escopado (via `useDepartments()` já
disponível, ou do `user`), e computar um subtítulo:

```typescript
const departments = useDepartments().data;
const scopedDeptName =
  user?.role === 'OPERATOR' && user.departmentId != null
    ? departments?.find((d) => d.id === user.departmentId)?.name ?? null
    : null;
```

- [ ] **Step 2: Exibir no header**

No cabeçalho do dashboard, quando `scopedDeptName` existir, mostrar "Fila — {scopedDeptName}"
(ou acrescentar como subtítulo), reaproveitando as classes de título existentes. ADMIN sem
`scopedDeptName` mantém o texto atual.

- [ ] **Step 3: Build do web**

Run: `npm run build -w @chamados/web`
Expected: limpo.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/pages/DashboardPage.tsx
git commit -m "feat(web): header do dashboard mostra o setor do staff escopado (fila por setor)"
```

---

### Task 4: Memória & documentação

**Files:**
- Modify: `docs/memory/architecture/business-rules.md` (fluxo guiado ganha passo de setor)
- Modify: `docs/memory/README.md` (indexar handoff)
- Create: `docs/memory/handoffs/sessao-2026-07-07-multi-setorial-plano3.md`

- [ ] **Step 1: Atualizar business-rules** (fluxo de abertura: Setor → Categoria → Subcategoria →
  Detalhe; blocos data-driven; sem aprovação).

- [ ] **Step 2: Handoff** — Contexto (Plano 3/4 do multi-setorial, aprovação já superada pelo SLA),
  O que mudou, Verificação com números reais, Pendências (Plano 4 = totem), PRÓXIMO passo.

- [ ] **Step 3: Indexar no README** e commit.

```bash
git add docs/
git commit -m "docs(memory): Plano 3 (macro-bloco frontend) + handoff"
```

---

### Task 5: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Build `shared → web`**

Run: `npm run build -w @chamados/shared && npm run build -w @chamados/web`
Expected: limpo.

- [ ] **Step 2: Smoke local (banco no ar + `npm run dev`)**

- Abrir "Novo chamado" → **passo 0 mostra os setores** com categorias (TI/Manutenção/Limpeza);
  escolher um filtra as categorias só daquele setor; breadcrumb mostra `Setor › <setor> › …`.
- Concluir a abertura → o chamado roteia para o setor da categoria (comportamento já existente).
- Como **OPERATOR escopado**, o dashboard mostra "Fila — <setor>"; como ADMIN, título global.
- Nenhum botão "Aprovar" em lugar nenhum.
- Mobile 375px: grids de bloco/categoria em coluna única, sem overflow horizontal.

> Smoke real é do Fabio (banco/dev no ar). Reportar falha/pulo explicitamente no handoff.

---

## Self-Review

**Spec coverage (umbrella §4, reconciliada):**
- Macro-bloco passo 0 filtrando categorias por setor → Tasks 1, 2. ✔ (data-driven, sem hardcode de setores)
- Fila por setor no header do dashboard → Task 3. ✔
- Aprovação (botão Aprovar) → **deliberadamente fora** (superada por sla-dois-tempos-automatico). ✔
- Totem (§4) → **fora deste plano** (Plano 4, próxima frente). ✔

**Placeholder scan:** helpers e JSX com código concreto; ícone via mapa + fallback explícito. Sem TBD.

**Type consistency:** `TicketCategory.departmentId: number | null` (Task 1) usado em `buildBlocks`/
`blockCategories` (Task 2) e no filtro; `departmentIcon(name: string): string` idêntico entre o lib
novo e o uso no `BlockCard`. `block: { id: number; name: string }` consistente no estado, breadcrumb
e reset.
