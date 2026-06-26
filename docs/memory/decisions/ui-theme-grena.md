# Tema visual: Grená do Juventus (moderno)

Data: 2026-06-26

## Contexto
Identidade visual pedida: grená e branco do Clube Atlético Juventus, com efeitos modernos.
Substitui o índigo provisório do scaffolding.

## Decisão (revisão de paleta — Bloco 6, 2026-06-26)
- Paleta atual (tokens no `tailwind.config.js`): `grena` #6D1F3A, `grena-dark` #5A1830,
  `grena-light` #8A2E4C, `surface` #F7F7F7 (branco gelo), branco #FFFFFF.
  Extras: `bg-grena-gradient` (135deg #6D1F3A→#5A1830), `shadow-grena` (sombra leve).
- Direção atual: menos "glass". Cards passaram a **branco sólido + borda sutil (`border-gray-100`) +
  sombra grená leve** (antes eram translúcidos com blur, que ficou "feio/fora de padrão").
- Ícones: **lucide-react** (SVG) no lugar de emojis na sidebar/header/dashboard (emojis variavam por SO).
- Componentes base (`components/ui`) e telas usam só os tokens grená (sem `indigo`).

### Paleta anterior (substituída)
- `grena` #7A1C27, `grena-dark` #5A0F1C, `grena-light` #A23B47, `surface` #FAF7F8; cards "glass".

## Consequências
- Trocar de tema no futuro = mexer nos tokens do Tailwind (centralizado, DRY).
- Manter contraste/legibilidade ao usar branco sobre grená (textos em `text-white/85` etc.).
- Layout do dashboard "KPIs no topo" e sidebar retrátil acompanham este tema (ver frontend.md).
