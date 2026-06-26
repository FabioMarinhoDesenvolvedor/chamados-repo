# Frontend Architecture

## Stack
- Linguagem: TypeScript (strict)
- Framework: React + Vite (SPA)
- Roteamento: React Router
- Estado server-side: TanStack Query (notificação via polling, refetchInterval 20s)
- UI: componentes Tailwind próprios em `components/ui` (button/card/badge/input/select/textarea) — não usamos shadcn no MVP
- Estilização: Tailwind CSS

## Identidade visual (Grená)
- Tema grená do Clube Atlético Juventus (ver decisions/ui-theme-grena).
- Tokens no Tailwind: `grena` (#6D1F3A), `grena-dark` (#5A1830), `grena-light` (#8A2E4C), `surface` (#F7F7F7);
  `bg-grena-gradient`, `shadow-grena`. Cards = brancos sólidos + borda sutil + sombra leve (sem glass/blur).
- Ícones: `lucide-react` (SVG) na sidebar/header/dashboard (não usar emojis).
- Logo do clube em `public/logo-juventus.png`: favicon, sidebar (expandida/colapsada), header mobile e login.
  Título da aba = "CHAMADOS - CLUBE ATLÉTICO JUVENTUS".

## Anexos de imagem (ver decisions/anexos-imagens)
- `components/AttachmentInput` (picker + preview) e `AttachmentGallery` (miniaturas → abre imagem).
- Hook `useUploadAttachments` (FormData → `POST /tickets/:id/attachments`). Front cria o recurso
  (chamado/comentário) e só então sobe os anexos para o id retornado. Imagens exibidas via `att.url`
  (`/api/uploads/...`, proxy do Vite p/ a API).

## Dashboard
- Admin: KPIs no topo (Em triagem/Abertos/Urgentes/Resolvidos) + gráfico por prioridade (barras CSS, sem lib)
  + fila com ✓ Concluir por linha e marcador de não-lido. User: só os próprios chamados.
- Sidebar retrátil (colapsa p/ ícones, estado em localStorage `sidebar-collapsed`); mobile = drawer.
- Fase 2 (futuro): widgets arrastáveis/persistidos por admin.

## Requisitos
- **Responsivo obrigatório**: mobile-first, funcional em celulares e desktops
- Dashboard com visão de chamados por prioridade (cores)
- Formulário de abertura de chamado simples e direto

## Estrutura de Pastas (candidata)
```
src/
├── components/       # Componentes reutilizáveis
│   └── ui/           # Componentes base (Button, Input, Badge...)
├── features/         # Feature-based (tickets, users, departments)
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       └── services/
├── layouts/          # Shell, Sidebar, MobileNav
├── pages/            # Rotas
├── hooks/            # Hooks globais
├── lib/              # Utilidades, API client
├── styles/           # Globals, theme
└── types/            # Tipos compartilhados (importa de @chamados/shared)
```

## Princípios
- Mobile-first CSS
- Componentização por feature, não por tipo
- Estado server-side com cache (TanStack Query ou similar)
