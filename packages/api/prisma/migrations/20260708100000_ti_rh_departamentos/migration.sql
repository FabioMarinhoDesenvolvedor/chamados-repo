-- TI e RH são setores FUNDACIONAIS. Antes vinham do seed de dev (prisma/seed.ts), o que
-- quebrava o deploy de produção com `migrate reset --skip-seed` (TI/RH não eram criados e as
-- categorias de TI ficavam sem setor → sumiam do fluxo). Movido para migration para que o dado
-- de referência de PRODUÇÃO seja completo e independente do seed. Idempotente (ON CONFLICT / WHERE).
INSERT INTO "departments" ("name","priority_weight","is_requester_dept","is_executor_dept","requires_approval")
VALUES
  ('TI', 5, false, true, false),
  ('RH', 3, true,  true, false)
ON CONFLICT ("name") DO NOTHING;

-- Vincula as 6 categorias de TI ao setor TI. A migration 20260707130100 tentou fazer isso, mas
-- TI ainda não existia naquele ponto (era criado só pelo seed), então o department_id ficou NULL.
UPDATE "ticket_categories"
SET "department_id" = (SELECT "id" FROM "departments" WHERE "name" = 'TI')
WHERE "slug" IN (
  'acesso-senhas',
  'computador-equipamentos',
  'sistemas-aplicativos',
  'internet-rede',
  'solicitacoes',
  'outros'
)
AND "department_id" IS NULL;
