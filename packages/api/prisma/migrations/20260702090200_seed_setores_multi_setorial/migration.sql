-- ============================================================================
-- Backfill: TI (setor existente) vira só-executor.
-- Ver docs/superpowers/specs/2026-07-02-multi-setorial-design.md (decisão #6).
-- ============================================================================
UPDATE "departments" SET "is_executor_dept" = true, "is_requester_dept" = false WHERE "name" = 'TI';

-- ============================================================================
-- 14 setores novos, pesos reais (âncoras: Presidência=5, Limpeza=2).
-- ============================================================================
INSERT INTO "departments" ("id","name","priority_weight","is_requester_dept","is_executor_dept","requires_approval") VALUES
  (gen_random_uuid(),'RH',3,true,true,false),
  (gen_random_uuid(),'Tesouraria',4,true,false,false),
  (gen_random_uuid(),'Limpeza',2,false,true,false),
  (gen_random_uuid(),'Manutenção',4,false,true,false),
  (gen_random_uuid(),'Almoxarifado',2,false,true,false),
  (gen_random_uuid(),'Compras',3,false,true,false),
  (gen_random_uuid(),'Comunicações',3,false,true,false),
  (gen_random_uuid(),'Gestão de Contratos',3,false,true,false),
  (gen_random_uuid(),'Secretaria',2,false,true,false),
  (gen_random_uuid(),'Secretaria da Presidência',4,false,true,false),
  (gen_random_uuid(),'Jurídico',4,false,true,false),
  (gen_random_uuid(),'Eventos',2,false,true,false),
  (gen_random_uuid(),'CEO',5,true,true,false),
  (gen_random_uuid(),'Presidência',5,false,true,true)
ON CONFLICT ("name") DO NOTHING;

-- ============================================================================
-- Backfill: os 6 blocos de TI existentes recebem department_id = TI.
-- ============================================================================
UPDATE "ticket_categories" SET "department_id" = (SELECT "id" FROM "departments" WHERE "name" = 'TI')
WHERE "slug" IN ('acesso-senhas','computador-equipamentos','sistemas-aplicativos','internet-rede','solicitacoes','outros');

-- ============================================================================
-- Categorias novas — Manutenção (8), já com department_id resolvido.
-- ============================================================================
INSERT INTO "ticket_categories" ("id","slug","name","icon","sort_order","department_id")
SELECT gen_random_uuid(), v.slug, v.name, v.icon, v.sort_order, d.id
FROM (VALUES
  ('eletrica','Elétrica','Zap',1),
  ('hidraulica','Hidráulica','Droplet',2),
  ('ar-condicionado','Ar-condicionado / Climatização','Snowflake',3),
  ('mobiliario','Mobiliário','Armchair',4),
  ('estrutural-civil','Estrutural/Civil','Hammer',5),
  ('portas-fechaduras','Portas e fechaduras','DoorClosed',6),
  ('areas-externas','Áreas externas/jardinagem','Trees',7),
  ('outros-manutencao','Outros','CircleEllipsis',8)
) AS v(slug,name,icon,sort_order)
JOIN "departments" d ON d.name = 'Manutenção'
ON CONFLICT ("slug") DO NOTHING;

-- ============================================================================
-- Categorias novas — Limpeza (6), já com department_id resolvido.
-- ============================================================================
INSERT INTO "ticket_categories" ("id","slug","name","icon","sort_order","department_id")
SELECT gen_random_uuid(), v.slug, v.name, v.icon, v.sort_order, d.id
FROM (VALUES
  ('limpeza-sala','Limpeza de sala/escritório','Sparkles',1),
  ('limpeza-banheiro','Limpeza de banheiro','ShowerHead',2),
  ('reposicao-materiais','Reposição de materiais de higiene','PackagePlus',3),
  ('limpeza-area-comum','Limpeza de área comum/evento','Building2',4),
  ('descarte-lixo','Descarte de lixo/resíduos','Trash2',5),
  ('outros-limpeza','Outros','CircleEllipsis',6)
) AS v(slug,name,icon,sort_order)
JOIN "departments" d ON d.name = 'Limpeza'
ON CONFLICT ("slug") DO NOTHING;

-- ============================================================================
-- Subcategoria placeholder ("Solicitação geral") para cada uma das 14 categorias
-- novas — curadoria fina fica para sessão futura (mesmo padrão do backlog
-- sessao-2026-07-01-backlog.md). base_complexity = MEDIUM (default já existente).
-- ============================================================================
INSERT INTO "ticket_subcategories" ("id","category_id","slug","name","icon","sort_order","base_complexity")
SELECT gen_random_uuid(), c.id, 'solicitacao-geral', 'Solicitação geral', c.icon, 1, 'MEDIUM'
FROM "ticket_categories" c
WHERE c.slug IN (
  'eletrica','hidraulica','ar-condicionado','mobiliario','estrutural-civil',
  'portas-fechaduras','areas-externas','outros-manutencao',
  'limpeza-sala','limpeza-banheiro','reposicao-materiais','limpeza-area-comum',
  'descarte-lixo','outros-limpeza'
)
ON CONFLICT ("category_id","slug") DO NOTHING;
