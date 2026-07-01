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
