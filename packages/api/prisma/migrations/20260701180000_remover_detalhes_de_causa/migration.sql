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
