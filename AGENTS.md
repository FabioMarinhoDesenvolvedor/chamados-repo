# AGENTS.md — Chamados TI

## Agente Principal (Claude)

### Papel
Assistente de desenvolvimento fullstack para o sistema de chamados internos de TI.

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

### Comportamento Esperado
- Planejar antes de codar
- Perguntar quando tiver dúvida sobre regra de negócio
- Respeitar decisões documentadas
- Seguir KISS, DRY, SOLID
- Todo componente UI deve ser responsivo (mobile-first)
- Gerar código TypeScript strict
- Usar convenções definidas no CLAUDE.md

### O que NÃO fazer
- Codar sem ler a memória
- Contradizer decisões sem discussão explícita
- Ignorar gotchas documentados
- Criar código sem responsividade
- Usar analogias com Java/Spring Boot
- Fazer recomendações não solicitadas de ferramentas

### Fluxo de Sessão
```
INÍCIO → Ler memória → Entender tarefa → Planejar → Perguntar (se necessário) → Executar → Atualizar handoff → FIM
```
