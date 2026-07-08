-- Reconstruído a partir das migrations de dados antigas (perdidas no baseline schema-only).
-- Portado para IDs inteiros: coluna id omitida (SERIAL autoincrementa); resto idêntico.

-- ==== Categorias e subcategorias de TI (de 20260630220304) ====
-- Seed de referência: categorias (blocos) e subcategorias da categorização.
-- Vai NA migration (não no seed de dev) p/ produção receber via `migrate deploy`.
-- Idempotente (ON CONFLICT). Não toca em chamados antigos (category_id fica NULL).
-- ============================================================================
INSERT INTO "ticket_categories" ("slug","name","icon","sort_order") VALUES
  ('acesso-senhas','Acesso e Senhas','KeyRound',1),
  ('computador-equipamentos','Computador e Equipamentos','Laptop',2),
  ('sistemas-aplicativos','Sistemas e Aplicativos','AppWindow',3),
  ('internet-rede','Internet e Rede','Network',4),
  ('solicitacoes','Solicitações','ClipboardList',5),
  ('outros','Outros','CircleEllipsis',6)
ON CONFLICT ("slug") DO NOTHING;

-- Acesso e Senhas
INSERT INTO "ticket_subcategories" ("category_id","slug","name","icon","sort_order")
SELECT c.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_categories" c JOIN (VALUES
  ('redefinicao-senha','Redefinição de senha','LockKeyhole',1),
  ('desbloqueio-usuario','Desbloqueio de usuário','UserCheck',2),
  ('criacao-acesso','Criação de acesso','UserPlus',3),
  ('alteracao-permissoes','Alteração de permissões','ShieldCheck',4),
  ('problemas-autenticacao','Problemas de autenticação','Fingerprint',5)
) AS v(slug,name,icon,sort_order) ON c.slug='acesso-senhas'
ON CONFLICT ("category_id","slug") DO NOTHING;

-- Computador e Equipamentos
INSERT INTO "ticket_subcategories" ("category_id","slug","name","icon","sort_order")
SELECT c.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_categories" c JOIN (VALUES
  ('computador-notebook','Computador ou notebook','Laptop',1),
  ('monitor','Monitor','Monitor',2),
  ('impressora','Impressora','Printer',3),
  ('perifericos','Periféricos (teclado, mouse, webcam, headset)','Keyboard',4),
  ('telefonia','Telefonia','Phone',5),
  ('dispositivo-movel','Dispositivo móvel','Smartphone',6)
) AS v(slug,name,icon,sort_order) ON c.slug='computador-equipamentos'
ON CONFLICT ("category_id","slug") DO NOTHING;

-- Sistemas e Aplicativos
INSERT INTO "ticket_subcategories" ("category_id","slug","name","icon","sort_order")
SELECT c.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_categories" c JOIN (VALUES
  ('sistema-indisponivel','Sistema indisponível','ServerCrash',1),
  ('erro-funcionamento','Erro de funcionamento','Bug',2),
  ('lentidao','Lentidão','Hourglass',3),
  ('falha-integracao','Falha de integração','Unplug',4),
  ('configuracao','Configuração','Settings',5),
  ('suporte-funcional','Suporte funcional','LifeBuoy',6)
) AS v(slug,name,icon,sort_order) ON c.slug='sistemas-aplicativos'
ON CONFLICT ("category_id","slug") DO NOTHING;

-- Internet e Rede
INSERT INTO "ticket_subcategories" ("category_id","slug","name","icon","sort_order")
SELECT c.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_categories" c JOIN (VALUES
  ('sem-conexao','Sem conexão à internet','WifiOff',1),
  ('wifi-instavel','Wi-Fi instável ou lento','Wifi',2),
  ('rede-interna','Problema de acesso à rede interna (VPN, compartilhamentos, servidores)','Server',3),
  ('config-rede','Configuração de rede (cabo, ponto, switch, IP)','Router',4),
  ('bloqueio-site','Bloqueio de site/serviço necessário ao trabalho','Ban',5),
  ('outros-rede','Outros problemas de rede','Network',6)
) AS v(slug,name,icon,sort_order) ON c.slug='internet-rede'
ON CONFLICT ("category_id","slug") DO NOTHING;

-- Solicitações
INSERT INTO "ticket_subcategories" ("category_id","slug","name","icon","sort_order")
SELECT c.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_categories" c JOIN (VALUES
  ('instalacao-software','Instalação de software','Download',1),
  ('config-equipamento','Configuração de equipamento','Wrench',2),
  ('solicitacao-equipamento','Solicitação de equipamento','PackagePlus',3),
  ('criacao-usuario','Criação de usuário','UserPlus',4),
  ('alteracao-cadastral','Alteração cadastral','FilePen',5),
  ('outras-solicitacoes','Outras solicitações','ClipboardPlus',6)
) AS v(slug,name,icon,sort_order) ON c.slug='solicitacoes'
ON CONFLICT ("category_id","slug") DO NOTHING;

-- Outros
INSERT INTO "ticket_subcategories" ("category_id","slug","name","icon","sort_order")
SELECT c.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_categories" c JOIN (VALUES
  ('duvidas','Dúvidas','HelpCircle',1),
  ('orientacoes','Orientações','BookOpen',2),
  ('incidentes-diversos','Incidentes diversos','TriangleAlert',3),
  ('outros-geral','Outros','MoreHorizontal',4)
) AS v(slug,name,icon,sort_order) ON c.slug='outros'
ON CONFLICT ("category_id","slug") DO NOTHING;

-- ==== Detalhes 3º nível (de 20260701134429) ====
-- Seed de referência: 3º nível ("detalhe") das subcategorias onde há modo de
-- falha/dispositivo claro. Idempotente (ON CONFLICT). base_complexity fica NULL
-- (preenchido no Item 2). Resolve a subcategoria por categoria+subcategoria.
-- ============================================================================

-- Computador e Equipamentos › Computador ou notebook
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('nao-liga','Não liga','PowerOff',1),
  ('muito-lento','Muito lento ou travando','Gauge',2),
  ('superaquecendo','Superaquecendo ou ventoinha','Thermometer',3),
  ('tela-azul','Tela azul ou reinicia sozinho','MonitorX',4),
  ('nao-reconhece','Não reconhece USB ou pen drive','Usb',5),
  ('bateria','Bateria não carrega','BatteryWarning',6)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='computador-notebook'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Monitor
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('nao-liga','Não liga','PowerOff',1),
  ('sem-imagem','Sem imagem ou sinal','MonitorOff',2),
  ('piscando','Piscando ou falhando','MonitorDot',3),
  ('manchas-linhas','Manchas ou linhas na tela','MonitorX',4),
  ('cabo-conexao','Cabo ou conexão','Cable',5)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='monitor'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Impressora
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('nao-imprime','Não imprime','Printer',1),
  ('atolando','Atolando papel','FileX',2),
  ('sem-toner','Sem toner ou tinta','Droplet',3),
  ('erro-driver','Erro ou driver','TriangleAlert',4),
  ('qualidade-ruim','Qualidade ruim de impressão','ImageOff',5),
  ('nao-reconhecida','Não é reconhecida na rede','PrinterCheck',6)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='impressora'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Periféricos
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('teclado','Teclado','Keyboard',1),
  ('mouse','Mouse','Mouse',2),
  ('webcam','Webcam','Webcam',3),
  ('headset-audio','Headset ou áudio','Headphones',4),
  ('outro-periferico','Outro periférico','Plug',5)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='perifericos'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Telefonia
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('sem-linha','Sem linha ou tom','PhoneOff',1),
  ('ruido','Ruído na chamada','Volume2',2),
  ('ramal-nao-toca','Ramal não toca','PhoneMissed',3),
  ('config-ramal','Configuração de ramal','Settings',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='telefonia'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Computador e Equipamentos › Dispositivo móvel
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('nao-liga','Não liga ou não carrega','PowerOff',1),
  ('sem-conexao','Sem conexão (dados ou Wi-Fi)','WifiOff',2),
  ('app-corporativo','App corporativo com problema','AppWindow',3),
  ('email-config','E-mail ou configuração de conta','Mail',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='computador-equipamentos' AND s.slug='dispositivo-movel'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Internet e Rede › Sem conexão à internet
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('cabo','Cabo desconectado','Cable',1),
  ('wifi','Wi-Fi','Wifi',2),
  ('ponto-rede','Tomada ou ponto de rede','PlugZap',3),
  ('setor-todo','Setor inteiro sem rede','Network',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='internet-rede' AND s.slug='sem-conexao'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Internet e Rede › Wi-Fi instável ou lento
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('cai-direto','Cai direto ou desconecta','WifiOff',1),
  ('muito-lento','Muito lento','Gauge',2),
  ('nao-conecta','Não conecta','Ban',3),
  ('sinal-fraco','Sinal fraco em um local','SignalLow',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='internet-rede' AND s.slug='wifi-instavel'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Internet e Rede › Acesso à rede interna
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('vpn','VPN','ShieldCheck',1),
  ('compartilhamento','Pasta ou compartilhamento','FolderX',2),
  ('servidor-sistema','Servidor ou sistema interno','Server',3),
  ('impressora-rede','Impressora de rede','Printer',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='internet-rede' AND s.slug='rede-interna'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- Sistemas e Aplicativos › Erro de funcionamento
INSERT INTO "ticket_detail_options" ("subcategory_id","slug","name","icon","sort_order")
SELECT s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('mensagem-erro','Mostra mensagem de erro','MessageSquareWarning',1),
  ('trava-fecha','Trava ou fecha sozinho','AppWindow',2),
  ('funcao-nao-funciona','Uma função não funciona','CircleAlert',3),
  ('dados-incorretos','Dados ou informação incorretos','FileWarning',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='sistemas-aplicativos' AND s.slug='erro-funcionamento'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;

-- ==== Curadoria de base_complexity (de 20260701170000) ====
-- Curadoria da complexidade-base por subcategoria e (onde difere) por detalhe.
-- Passa a alimentar o cálculo automático da prioridade na abertura: a create() usa
-- detalhe.base_complexity > subcategoria.base_complexity > MÉDIA (default). Antes tudo
-- caía no default MÉDIA; agora o prazo fica mais justo por tipo de chamado.
-- Idempotente (sobrescreve pelo slug). Não altera chamados já existentes.
-- Obs.: os slugs de subcategoria são distintos entre si no seed atual, então o join por
-- slug é inequívoco; as subcategorias também são amarradas por categoria.

-- Complexidade-base por SUBCATEGORIA (todas as 33).
UPDATE "ticket_subcategories" s
SET "base_complexity" = v.bc::"Complexity"
FROM (VALUES
  ('acesso-senhas','redefinicao-senha','LOW'),
  ('acesso-senhas','desbloqueio-usuario','LOW'),
  ('acesso-senhas','criacao-acesso','LOW'),
  ('acesso-senhas','alteracao-permissoes','MEDIUM'),
  ('acesso-senhas','problemas-autenticacao','MEDIUM'),
  ('computador-equipamentos','computador-notebook','MEDIUM'),
  ('computador-equipamentos','monitor','MEDIUM'),
  ('computador-equipamentos','impressora','MEDIUM'),
  ('computador-equipamentos','perifericos','LOW'),
  ('computador-equipamentos','telefonia','MEDIUM'),
  ('computador-equipamentos','dispositivo-movel','MEDIUM'),
  ('sistemas-aplicativos','sistema-indisponivel','CRITICAL'),
  ('sistemas-aplicativos','erro-funcionamento','MEDIUM'),
  ('sistemas-aplicativos','lentidao','MEDIUM'),
  ('sistemas-aplicativos','falha-integracao','HIGH'),
  ('sistemas-aplicativos','configuracao','LOW'),
  ('sistemas-aplicativos','suporte-funcional','LOW'),
  ('internet-rede','sem-conexao','HIGH'),
  ('internet-rede','wifi-instavel','MEDIUM'),
  ('internet-rede','rede-interna','HIGH'),
  ('internet-rede','config-rede','MEDIUM'),
  ('internet-rede','bloqueio-site','LOW'),
  ('internet-rede','outros-rede','MEDIUM'),
  ('solicitacoes','instalacao-software','LOW'),
  ('solicitacoes','config-equipamento','LOW'),
  ('solicitacoes','solicitacao-equipamento','LOW'),
  ('solicitacoes','criacao-usuario','LOW'),
  ('solicitacoes','alteracao-cadastral','LOW'),
  ('solicitacoes','outras-solicitacoes','LOW'),
  ('outros','duvidas','LOW'),
  ('outros','orientacoes','LOW'),
  ('outros','incidentes-diversos','MEDIUM'),
  ('outros','outros-geral','MEDIUM')
) AS v(cat_slug, sub_slug, bc)
JOIN "ticket_categories" c ON c.slug = v.cat_slug
WHERE s."category_id" = c."id" AND s."slug" = v.sub_slug;

-- Overrides por DETALHE (só onde a gravidade difere da subcategoria).
UPDATE "ticket_detail_options" d
SET "base_complexity" = v.bc::"Complexity"
FROM (VALUES
  ('computador-notebook','nao-liga','HIGH'),
  ('computador-notebook','tela-azul','HIGH'),
  ('computador-notebook','superaquecendo','HIGH'),
  ('computador-notebook','nao-reconhece','LOW'),
  ('monitor','manchas-linhas','LOW'),
  ('monitor','cabo-conexao','LOW'),
  ('impressora','atolando','LOW'),
  ('impressora','sem-toner','LOW'),
  ('impressora','qualidade-ruim','LOW'),
  ('sem-conexao','setor-todo','CRITICAL'),
  ('rede-interna','compartilhamento','MEDIUM'),
  ('rede-interna','impressora-rede','MEDIUM'),
  ('wifi-instavel','sinal-fraco','LOW')
) AS v(sub_slug, detail_slug, bc)
JOIN "ticket_subcategories" s ON s."slug" = v.sub_slug
WHERE d."subcategory_id" = s."id" AND d."slug" = v.detail_slug;

-- ==== Remoção de detalhes de causa (de 20260701180000) ====
-- Simplificação da abertura (usuário leigo): remove os detalhes que são DIAGNÓSTICO técnico
-- (a causa), que o usuário não tem como identificar. As subcategorias "Sem conexão à internet"
-- e "Acesso à rede interna" voltam a 2 níveis (categoria › subcategoria › descrição opcional).
-- "Wi-Fi instável" foi MANTIDA (seus detalhes são sintomas observáveis) e os demais detalhes
-- (monitor, impressora, computador, periféricos, telefonia, dispositivo, erro de funcionamento)
-- seguem existindo, agora OPCIONAIS.
-- Não-destrutivo p/ chamados: a FK tickets.detail_option_id é ON DELETE SET NULL, então
-- chamados que porventura apontassem para estes detalhes passam a ter detail_option_id NULL.
DELETE FROM "ticket_detail_options" d
USING "ticket_subcategories" s
WHERE d."subcategory_id" = s."id"
  AND s."slug" IN ('sem-conexao', 'rede-interna');

-- ==== Setores multi-setorial + categorias novas (de 20260702090200) ====
-- ============================================================================
-- Backfill: TI (setor existente) vira só-executor.
-- Ver docs/superpowers/specs/2026-07-02-multi-setorial-design.md (decisão #6).
-- ============================================================================
UPDATE "departments" SET "is_executor_dept" = true, "is_requester_dept" = false WHERE "name" = 'TI';

-- ============================================================================
-- Backfill: RH (setor existente, fundacional junto com TI) vira "Ambos"
-- (solicitante E executor). RH não entra no INSERT abaixo porque já existe em
-- todo ambiente (o INSERT ON CONFLICT DO NOTHING nunca aplicaria os flags a um
-- setor pré-existente) — mesmo padrão do backfill de TI acima.
-- ============================================================================
UPDATE "departments" SET "priority_weight" = 3, "is_executor_dept" = true, "is_requester_dept" = true WHERE "name" = 'RH';

-- ============================================================================
-- 13 setores novos, pesos reais (âncoras: Presidência=5, Limpeza=2).
-- ============================================================================
INSERT INTO "departments" ("name","priority_weight","is_requester_dept","is_executor_dept","requires_approval") VALUES
  ('Tesouraria',4,true,false,false),
  ('Limpeza',2,false,true,false),
  ('Manutenção',4,false,true,false),
  ('Almoxarifado',2,false,true,false),
  ('Compras',3,false,true,false),
  ('Comunicações',3,false,true,false),
  ('Gestão de Contratos',3,false,true,false),
  ('Secretaria',2,false,true,false),
  ('Secretaria da Presidência',4,false,true,false),
  ('Jurídico',4,false,true,false),
  ('Eventos',2,false,true,false),
  ('CEO',5,true,true,false),
  ('Presidência',5,false,true,true)
ON CONFLICT ("name") DO NOTHING;

-- ============================================================================
-- Backfill: os 6 blocos de TI existentes recebem department_id = TI.
-- ============================================================================
UPDATE "ticket_categories" SET "department_id" = (SELECT "id" FROM "departments" WHERE "name" = 'TI')
WHERE "slug" IN ('acesso-senhas','computador-equipamentos','sistemas-aplicativos','internet-rede','solicitacoes','outros');

-- ============================================================================
-- Categorias novas — Manutenção (8), já com department_id resolvido.
-- ============================================================================
INSERT INTO "ticket_categories" ("slug","name","icon","sort_order","department_id")
SELECT v.slug, v.name, v.icon, v.sort_order, d.id
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
INSERT INTO "ticket_categories" ("slug","name","icon","sort_order","department_id")
SELECT v.slug, v.name, v.icon, v.sort_order, d.id
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
INSERT INTO "ticket_subcategories" ("category_id","slug","name","icon","sort_order","base_complexity")
SELECT c.id, 'solicitacao-geral', 'Solicitação geral', c.icon, 1, 'MEDIUM'
FROM "ticket_categories" c
WHERE c.slug IN (
  'eletrica','hidraulica','ar-condicionado','mobiliario','estrutural-civil',
  'portas-fechaduras','areas-externas','outros-manutencao',
  'limpeza-sala','limpeza-banheiro','reposicao-materiais','limpeza-area-comum',
  'descarte-lixo','outros-limpeza'
)
ON CONFLICT ("category_id","slug") DO NOTHING;
