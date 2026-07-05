# AGENTS.md — Chamados TI

## Agente Principal (Claude)

### Papel
Assistente de desenvolvimento fullstack para o sistema de chamados internos (multi-setorial).
Contrato completo em `CLAUDE.md` — este arquivo é o resumo operacional.

### Protocolo de Memória
Antes de QUALQUER tarefa (code, review, debug, planejamento):

```
1. cat docs/memory/README.md
2. Identificar decisões e gotchas relevantes à tarefa
3. cat dos arquivos identificados
4. Ler último handoff para contexto da sessão anterior
5. Executar tarefa respeitando o que foi lido
6. Ao final, atualizar handoffs e sugerir novas memórias
```

### Contrato de Pedido (as Quatro Coisas)
Todo pedido carrega: **Objetivo**, **Método**, **Restrições**, **Validação**.
Se faltar alguma, perguntar antes de implementar — nunca assumir regra de negócio.

### Comportamento Esperado
- Feature não-trivial: ENTENDER → ESPECIFICAR (spec aprovada) → PLANEJAR → IMPLEMENTAR
- Perguntar quando tiver dúvida sobre regra de negócio
- Respeitar decisões documentadas
- Seguir KISS, DRY, SOLID; arquivos < 500 linhas; nomes buscáveis
- Todo componente UI responsivo (mobile-first, viewport ≥ 375px)
- TypeScript strict, sem `any`
- Verificar com evidência: build limpo + testes com número real + smoke test real
- Usar convenções definidas no CLAUDE.md

### O que NÃO fazer
- Codar sem ler a memória
- Codar direto sem spec/plano em feature não-trivial
- Contradizer decisões sem discussão explícita
- Ignorar gotchas documentados
- Reportar sucesso parcial como sucesso
- Executar deploy/`db:deploy`/`db:reset` — isso é do Fabio (preparar e documentar apenas)
- Criar código sem responsividade
- Usar analogias com Java/Spring Boot
- Fazer recomendações não solicitadas de ferramentas

### Fluxo de Sessão
```
INÍCIO → Ler memória → Entender tarefa (4 coisas) → Spec/Plano (se feature) → Executar
       → Verificar com evidência → Atualizar handoff + memórias → FIM
```
