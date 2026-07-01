# Triagem: complexidade definida pelo admin/TI

> ⚠️ **SUPERADA em 2026-07-01** por [[prazo-complexidade-automatica]]. A complexidade deixou de
> ser definida manualmente na triagem: o chamado passa a **nascer OPEN já priorizado**, com a
> complexidade-base vinda da categorização (detalhe › subcategoria › MÉDIA) e a prioridade
> derivada pela matriz com o peso do setor. O `PATCH /tickets/:id` (complexidade) permanece
> apenas como **override opcional** do admin. Mantido aqui para histórico.

Data: 2026-06-26

## Contexto
O usuário comum não tem como avaliar corretamente a complexidade técnica de um chamado.
Deixar isso com ele gerava prioridade imprecisa logo na abertura.

## Decisão
- Remover o campo "complexidade" da abertura (usuário informa só título, descrição, departamento).
- Chamado nasce em status `TRIAGE` ("Em triagem"), com `complexity` e `priority` NULOS.
- O admin/TI define a complexidade; o `PriorityService` calcula a prioridade (matriz aprovada) e o
  chamado passa de `TRIAGE → OPEN` automaticamente, registrando no histórico de status.
- Endpoint dedicado: `PATCH /tickets/:id` (admin) com `{ complexity?, departmentId? }`.
  Recalcula prioridade quando complexidade ou departamento mudam.

## Consequências
- `complexity` e `priority` viraram nuláveis no banco (ver [[enum-strategy]] e database.md).
- Novo valor de enum `TRIAGE` (primeiro do fluxo). Atenção ao Postgres: adicionar valor de enum e
  usá-lo como default exige migrations separadas (ver handoff 2026-06-26).
- Front exibe "Em triagem"/"A definir" quando prioridade/complexidade são nulas.
