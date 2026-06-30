-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "subcategory_id" TEXT,
ALTER COLUMN "description" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_subcategories" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_slug_key" ON "ticket_categories"("slug");

-- CreateIndex
CREATE INDEX "ticket_subcategories_category_id_idx" ON "ticket_subcategories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_subcategories_category_id_slug_key" ON "ticket_subcategories"("category_id", "slug");

-- CreateIndex
CREATE INDEX "tickets_category_id_idx" ON "tickets"("category_id");

-- CreateIndex
CREATE INDEX "tickets_subcategory_id_idx" ON "tickets"("subcategory_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "ticket_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_subcategories" ADD CONSTRAINT "ticket_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Seed de referência: categorias (blocos) e subcategorias da categorização.
-- Vai NA migration (não no seed de dev) p/ produção receber via `migrate deploy`.
-- Idempotente (ON CONFLICT). Não toca em chamados antigos (category_id fica NULL).
-- ============================================================================
INSERT INTO "ticket_categories" ("id","slug","name","icon","sort_order") VALUES
  (gen_random_uuid(),'acesso-senhas','Acesso e Senhas','KeyRound',1),
  (gen_random_uuid(),'computador-equipamentos','Computador e Equipamentos','Laptop',2),
  (gen_random_uuid(),'sistemas-aplicativos','Sistemas e Aplicativos','AppWindow',3),
  (gen_random_uuid(),'internet-rede','Internet e Rede','Network',4),
  (gen_random_uuid(),'solicitacoes','Solicitações','ClipboardList',5),
  (gen_random_uuid(),'outros','Outros','CircleEllipsis',6)
ON CONFLICT ("slug") DO NOTHING;

-- Acesso e Senhas
INSERT INTO "ticket_subcategories" ("id","category_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), c.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_categories" c JOIN (VALUES
  ('redefinicao-senha','Redefinição de senha','LockKeyhole',1),
  ('desbloqueio-usuario','Desbloqueio de usuário','UserCheck',2),
  ('criacao-acesso','Criação de acesso','UserPlus',3),
  ('alteracao-permissoes','Alteração de permissões','ShieldCheck',4),
  ('problemas-autenticacao','Problemas de autenticação','Fingerprint',5)
) AS v(slug,name,icon,sort_order) ON c.slug='acesso-senhas'
ON CONFLICT ("category_id","slug") DO NOTHING;

-- Computador e Equipamentos
INSERT INTO "ticket_subcategories" ("id","category_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), c.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_subcategories" ("id","category_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), c.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_subcategories" ("id","category_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), c.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_subcategories" ("id","category_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), c.id, v.slug, v.name, v.icon, v.sort_order
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
INSERT INTO "ticket_subcategories" ("id","category_id","slug","name","icon","sort_order")
SELECT gen_random_uuid(), c.id, v.slug, v.name, v.icon, v.sort_order
FROM "ticket_categories" c JOIN (VALUES
  ('duvidas','Dúvidas','HelpCircle',1),
  ('orientacoes','Orientações','BookOpen',2),
  ('incidentes-diversos','Incidentes diversos','TriangleAlert',3),
  ('outros-geral','Outros','MoreHorizontal',4)
) AS v(slug,name,icon,sort_order) ON c.slug='outros'
ON CONFLICT ("category_id","slug") DO NOTHING;
