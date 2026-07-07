-- SLA de dois tempos: coluna aditiva para a primeira resposta (assumir OU IN_PROGRESS).
ALTER TABLE "tickets" ADD COLUMN "first_response_at" TIMESTAMP(3);

-- Backfill: para chamados que JÁ passaram da resposta (assumidos/resolvidos), usa o primeiro
-- IN_PROGRESS do histórico; senão resolved_at; senão created_at. Chamados ainda abertos/não
-- assumidos ficam NULL (resposta em aberto — correto). Evita "resposta estourada" eterna em legado.
UPDATE "tickets" t
SET "first_response_at" = COALESCE(
  (SELECT MIN(h."created_at") FROM "ticket_status_history" h
     WHERE h."ticket_id" = t."id" AND h."to_status" = 'IN_PROGRESS'),
  t."resolved_at",
  t."created_at"
)
WHERE t."status" IN ('IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- Fim da aprovação: a Presidência era o único setor com requires_approval=true.
UPDATE "departments" SET "requires_approval" = false WHERE "name" = 'Presidência';

-- Defensivo: aprovação nunca foi deployada em produção, mas garante que nenhum chamado fique
-- preso em PENDING_APPROVAL (enum permanece dormente, como TRIAGE).
UPDATE "tickets" SET "status" = 'OPEN' WHERE "status" = 'PENDING_APPROVAL';
