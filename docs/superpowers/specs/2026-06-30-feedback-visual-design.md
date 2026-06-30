# Design — Feedback visual por ação (toasts + estados de carregamento)

Data: 2026-06-30
Escopo: **somente frontend** (`packages/web`). Sem mudança de API/banco.

## Problema / objetivo
Hoje o usuário não tem resposta visual consistente para suas ações. Em sistema
lento isso é pior: sem feedback, ele **clica repetidamente** no botão (ex.: gerar
relatório) e pode sobrecarregar o servidor. Queremos que **toda ação** tenha um
retorno visual **discreto** (estilo das "Dicas"/`TipsToaster`), e que botões
**travem enquanto a ação está em andamento** para impedir cliques repetidos.

## Não-objetivos (YAGNI)
- Sem biblioteca de toast nova (reutilizar React Query + o estilo do `TipsToaster`).
- Sem mudança de backend, schema ou rotas.
- Sem som, sem badges de notificação novos, sem fila persistente de toasts.
- Auditoria/log de operações e limpeza de banco são **outra fase (B)** — fora desta spec.

## Abordagem escolhida
Conectar um **sistema de toast único ao React Query** (no `MutationCache`), de modo
que cada mutação dispare feedback automaticamente — DRY e sem ação "muda".
Alternativas descartadas: toast manual em cada `onSuccess` (repetitivo, fácil
esquecer); feedback só inline nos botões (não atende o "popup estilo dicas").

## Componentes

### 1. Sistema de Toast
- `components/toast/` — um `ToastProvider` (contexto) + hook `useToast()` + `<Toaster/>`.
- Visual herdado do `TipsToaster`: cartão discreto, canto inferior direito, sombra
  leve, fechável (×), `role="status"`/`aria-live="polite"`.
- 3 variantes: `success` (✓ verde), `error` (✕ vermelho), `info` (ℹ cinza/grená).
- Auto-dismiss em ~3,5s; **empilha** múltiplos toasts; transição de entrada/saída
  como o `TipsToaster` (translate+opacity).
- API: `toast({ kind, message })` e atalhos `toast.success/error/info`.

### 2. Wiring automático no React Query
- No `QueryClient` (onde fica o `<QueryClientProvider>`), configurar o `MutationCache`
  com `onSuccess`/`onError` globais que chamam o toast.
- Mensagem padrão por mutação via `meta` (opcional). Sucesso padrão genérico
  ("Ação concluída") quando `meta.successMessage` não for definido; erro usa a
  mensagem da API (via `apiMessage`) ou `meta.errorMessage`.
- Mensagens por ação (definidas no `meta` de cada hook em `features/*/api.ts`):

  | Hook / ação | Sucesso |
  |---|---|
  | `useAddComment` | "Comentário enviado" |
  | `useUpdateStatus` | "Status atualizado" |
  | `useAssignTicket` | "Responsável definido" |
  | `useCloseTicket` | "Chamado concluído" |
  | `useCreateTicket` | "Chamado aberto" |
  | troca de senha (`/users/me/password`) | "Senha alterada" |
  | gerar relatório | "Relatório gerado" |
  | `useUploadAttachments` | (silencioso — acompanha o comentário) |

  Erro de qualquer mutação → toast `error` com a mensagem da API.

### 3. Botão com estado de carregamento (anti-clique repetido)
- Estender `components/ui/button` com prop `loading?: boolean`.
- Quando `loading` (ou `disabled`): botão **desabilitado** + mini-spinner
  (ícone `Loader2` girando) antes do texto.
- Aplicar `loading={mutation.isPending}` nos botões de ação (comentar, resolver,
  assumir, concluir, criar, trocar senha, **gerar relatório**). Resolve o caso
  central do relatório em sistema lento.

### 4. Abrir chamado (TicketDetailPage)
- Trocar o texto "Carregando..." por um **spinner central** (componente
  `components/ui/spinner` reutilizável: `Loader2` animado + rótulo opcional).
- Ao concluir o carregamento do detalhe (transição de `isLoading` → dados), disparar
  **uma vez** o toast `success` "Chamado aberto" (guardar que já disparou para
  aquele id, evitando repetição em refetch/invalidate).

### 5. Gerar relatório (ReportsPage)
- Botão de gerar usa `loading` (trava + spinner enquanto busca).
- Sucesso → toast "Relatório gerado"; erro → toast com a mensagem da API.
- Como o botão fica desabilitado durante a requisição, o usuário não consegue
  reclicar e sobrecarregar.

## Arquivos previstos
- **Novos:** `components/toast/ToastProvider.tsx`, `components/toast/Toaster.tsx`,
  `components/toast/useToast.ts` (ou um único `components/toast/index.tsx`);
  `components/ui/spinner.tsx`.
- **Editados:** ponto do `QueryClient`/providers (App/main) para envolver com
  `ToastProvider` e configurar o `MutationCache`; `components/ui/button.tsx`
  (prop `loading`); `features/tickets/api.ts`, `features/users/api.ts`,
  `features/reports/api.ts` (adicionar `meta` de mensagem); `TicketDetailPage.tsx`
  (spinner + toast "Chamado aberto"); `ReportsPage` (botão `loading`); e demais
  páginas que disparam ações, para passar `loading={...isPending}`.

## Tratamento de erros
- Toda mutação com erro mostra toast `error` com a mensagem amigável da API
  (reutilizar `apiMessage`). Validações de formulário (ex.: senha fraca) continuam
  inline como hoje; o toast cobre o resultado da chamada à API.

## Testes / verificação
- `tsc --noEmit` do web + `vite build`.
- Verificação manual no app local: abrir chamado (spinner + toast), comentar/mudar
  status (toast + botão travando), e gerar relatório clicando rápido várias vezes
  (botão deve travar na 1ª e impedir as demais).

## Riscos
- Evitar toast duplicado ao abrir chamado em refetch — controlado por id já notificado.
- Não poluir: toasts curtos, um por ação, auto-dismiss; nada de modal/bloqueio.
