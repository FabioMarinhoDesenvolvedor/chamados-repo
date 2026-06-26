# Pacote shared (CJS) x Rollup/Vite

Problema:
O `@chamados/shared` compila para CommonJS (necessário para a API NestJS, que roda em
CJS). Ao consumir o `dist` CJS no frontend, o Rollup/Vite não consegue analisar
estaticamente os exports — falha com "X is not exported by shared/dist/index.js"
(tanto com `export *` / `__exportStar` quanto com re-exports nomeados via getters).

Solução:
O frontend consome o shared a partir do **código-fonte TS** (ESM), via alias:
- `packages/web/vite.config.ts`: alias `@chamados/shared` → `../shared/src/index.ts`
- `packages/web/tsconfig.json`: `paths` `@chamados/shared` → `../shared/src/index.ts`

A API continua usando o `dist` CJS normalmente (resolução por node_modules/workspace).
Resumo: API usa dist; Web usa source.

Não tente "consertar" emitindo ESM no shared — a API CJS quebra ao dar require em ESM.
