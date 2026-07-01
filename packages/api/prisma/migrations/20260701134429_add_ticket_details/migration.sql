-- AlterTable
ALTER TABLE "ticket_subcategories" ADD COLUMN     "base_complexity" "Complexity";

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "detail_option_id" TEXT;

-- CreateTable
CREATE TABLE "ticket_detail_options" (
    "id" TEXT NOT NULL,
    "subcategory_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "base_complexity" "Complexity",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_detail_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_detail_options_subcategory_id_idx" ON "ticket_detail_options"("subcategory_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_detail_options_subcategory_id_slug_key" ON "ticket_detail_options"("subcategory_id", "slug");

-- CreateIndex
CREATE INDEX "tickets_detail_option_id_idx" ON "tickets"("detail_option_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_detail_option_id_fkey" FOREIGN KEY ("detail_option_id") REFERENCES "ticket_detail_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_detail_options" ADD CONSTRAINT "ticket_detail_options_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "ticket_subcategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Seed de referência: 3º nível ("detalhe") das subcategorias onde há modo de
-- falha/dispositivo claro. Idempotente (ON CONFLICT). base_complexity fica NULL
-- (preenchido no Item 2). Resolve a subcategoria por categoria+subcategoria.
-- ============================================================================

-- Computador e Equipamentos › Computador ou notebook
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_detail_options" ("id","subcategory_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), s.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_subcategories" s JOIN "ticket_categories" c ON c.id = s.category_id
JOIN (VALUES
  ('mensagem-erro','Mostra mensagem de erro','MessageSquareWarning',1),
  ('trava-fecha','Trava ou fecha sozinho','AppWindow',2),
  ('funcao-nao-funciona','Uma função não funciona','CircleAlert',3),
  ('dados-incorretos','Dados ou informação incorretos','FileWarning',4)
) AS v(slug,name,icon,sort_order) ON TRUE
WHERE c.slug='sistemas-aplicativos' AND s.slug='erro-funcionamento'
ON CONFLICT ("subcategory_id","slug") DO NOTHING;
