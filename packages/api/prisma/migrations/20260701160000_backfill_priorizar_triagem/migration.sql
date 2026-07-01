-- Backfill (Item 2): garante que TODO chamado tenha prioridade e início de SLA, para
-- deixar de exibir "Em triagem" no Prazo. A partir de agora todo chamado nasce OPEN já
-- priorizado e com sla_started_at; este backfill cobre os que ficaram para trás:
--   * priority/complexity nulos  -> complexidade-base MÉDIA (default) + prioridade pela
--     matriz aprovada com o peso do setor (MÉDIA × peso: Baixo[1-2]→LOW, Médio[3]→MEDIUM,
--     Alto[4-5]→HIGH). Cobre inclusive chamados movidos p/ IN_PROGRESS pelo dashboard sem
--     triagem (o bug do "Em triagem" no Prazo).
--   * sla_started_at nulo        -> passa a contar a partir da abertura (created_at). Cobre
--     chamados que tinham prioridade mas nunca tiveram início de SLA (seed/antigos).
-- Status TRIAGE vira OPEN; os demais status são preservados. Idempotente/não-destrutivo:
-- COALESCE só preenche o que estava nulo (valores existentes são mantidos).
UPDATE "tickets" t
SET
  "complexity" = COALESCE(t."complexity", 'MEDIUM'::"Complexity"),
  "priority" = COALESCE(t."priority", (CASE
    WHEN d."priority_weight" <= 2 THEN 'LOW'
    WHEN d."priority_weight" = 3 THEN 'MEDIUM'
    ELSE 'HIGH'
  END)::"Priority"),
  "status" = CASE WHEN t."status" = 'TRIAGE' THEN 'OPEN'::"TicketStatus" ELSE t."status" END,
  "sla_started_at" = COALESCE(t."sla_started_at", t."created_at")
FROM "departments" d
WHERE t."department_id" = d."id"
  AND (t."priority" IS NULL OR t."sla_started_at" IS NULL OR t."status" = 'TRIAGE');
