# Use React + Vite (Frontend)

Data: 2026-06-25

## Contexto
App interno de chamados, mobile-first. Não há necessidade de SSR/SEO. Precisávamos de build leve e DX rápida, alinhado a KISS.

## Decisão
Frontend em React + Vite (SPA). React Router para navegação. TanStack Query para estado server-side. shadcn/ui como UI kit base.

## Consequências
- Build e dev server rápidos (Vite)
- Sem peso de SSR/Next que o MVP não exige
- shadcn/ui dá componentes acessíveis e responsivos sob nosso controle
- TanStack Query centraliza cache/sincronização com a API (DRY)
- Roteamento client-side — atenção a guards de rota por role (admin/user)
