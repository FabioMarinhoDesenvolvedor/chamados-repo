# Prompt Template — Novo Projeto com Memória

Copie e adapte este prompt ao iniciar qualquer projeto novo com Claude.

---

## Prompt para colar no início da conversa:

```
Antes de iniciar qualquer tarefa:

1. Leia docs/memory/README.md
2. Consulte decisões relacionadas
3. Consulte gotchas relevantes
4. Evite contradizer decisões existentes
5. Ao final da sessão, sugira novas memórias

Estrutura do projeto:

meu-projeto/
├── src/
├── docs/
│   └── memory/
│       ├── README.md
│       ├── decisions/
│       ├── gotchas/
│       ├── procedures/
│       ├── architecture/
│       └── handoffs/
├── CLAUDE.md
└── AGENTS.md

Crie a estrutura de memória inicial com base no seguinte contexto:

**Nome do projeto**: [NOME]
**Descrição**: [O QUE O SISTEMA FAZ]
**Stack desejada**: [LINGUAGENS, FRAMEWORKS, BANCO]
**Requisitos críticos**: [RESPONSIVIDADE, PERFORMANCE, ETC]
**Princípios**: KISS, DRY, SOLID

Não code antes de:
- Planejar estrutura de pastas
- Definir stack completa
- Documentar decisões iniciais
- Perguntar o que tiver dúvida sobre contexto

Sempre faça perguntas sobre regras de negócio antes de assumir.
```

---

## Checklist pós-criação

- [ ] README.md da memória criado com índice
- [ ] Decisões iniciais documentadas
- [ ] Arquitetura documentada (backend, frontend, banco)
- [ ] Gotchas conhecidos registrados
- [ ] Procedures de setup e deploy criados
- [ ] Primeiro handoff criado
- [ ] CLAUDE.md configurado
- [ ] AGENTS.md configurado
