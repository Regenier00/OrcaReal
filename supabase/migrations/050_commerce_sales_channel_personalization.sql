-- Personaliza comércio a partir de "Como a empresa vende?":
-- loja física, e-commerce e marketplace passam a definir centros de custo,
-- categorias e indicadores (margem, ticket, CAC, frete, taxas e comparação).

update public.onboarding_questions
set
  question = 'Como a empresa vende?',
  help_text = 'Pode marcar loja física, e-commerce e marketplace. Centros de custo, categorias e indicadores mudam conforme os canais.',
  answer_type = 'multiple',
  options = '[
    {"value":"fisica","label":"Loja física"},
    {"value":"ecommerce","label":"E-commerce"},
    {"value":"marketplace","label":"Marketplace"}
  ]'::jsonb,
  is_active = true
where code = 'com_channel';

insert into public.analysis_units (code, name, description, applicable_segments)
values (
  'sales_channel',
  'Canal de venda',
  'Loja física, e-commerce ou marketplace',
  array['commerce']
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  applicable_segments = excluded.applicable_segments,
  is_active = true;

update public.analysis_units
set applicable_segments = array(
  select distinct unnest(applicable_segments || array['commerce'])
)
where code = 'order'
  and not ('commerce' = any (applicable_segments));

insert into public.system_indicators (
  code, name, description, formula_hint, formula, category, unit,
  applicable_segments, activation_conditions, unless_conditions,
  required_data, periodicity, dashboard_section, sort_order, is_active
)
select
  item->>'code',
  item->>'name',
  item->>'description',
  item->>'formula',
  item->>'formula',
  'operational',
  item->>'unit',
  array['commerce'],
  item->'activation',
  null,
  '[]'::jsonb,
  'monthly',
  item->>'dashboard_section',
  (item->>'sort_order')::int,
  true
from jsonb_array_elements($json$[
  {"code":"store_revenue","name":"Receita da loja física","description":"Faturamento classificado no canal loja física.","formula":"receita da loja física","unit":"R$","dashboard_section":"financial","sort_order":5300,"activation":{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}}},
  {"code":"store_operating_cost","name":"Custo da loja física","description":"Custos e despesas do ponto físico: aluguel, energia, pessoal e manutenção.","formula":"aluguel + energia + pessoal da loja","unit":"R$","dashboard_section":"operational","sort_order":5310,"activation":{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}}},
  {"code":"store_rent_cost","name":"Aluguel da loja","description":"Custo de aluguel do ponto de venda físico.","formula":"aluguel da loja","unit":"R$","dashboard_section":"operational","sort_order":5320,"activation":{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}}},
  {"code":"store_energy_cost","name":"Energia da loja","description":"Energia elétrica e utilidades do ponto físico.","formula":"energia da loja","unit":"R$","dashboard_section":"operational","sort_order":5330,"activation":{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}}},
  {"code":"store_margin","name":"Margem da loja física","description":"Resultado da loja física em relação à receita do canal.","formula":"(receita da loja − custos da loja) / receita da loja","unit":"%","dashboard_section":"profitability","sort_order":5340,"activation":{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}}},
  {"code":"store_avg_ticket","name":"Ticket médio da loja física","description":"Receita da loja física dividida pelas vendas do ponto.","formula":"receita da loja física / vendas físicas","unit":"R$","dashboard_section":"profitability","sort_order":5350,"activation":{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}}},
  {"code":"ecom_revenue","name":"Receita do e-commerce","description":"Faturamento das vendas no e-commerce próprio.","formula":"receita do e-commerce","unit":"R$","dashboard_section":"financial","sort_order":5360,"activation":{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online"]}}},
  {"code":"ecom_margin","name":"Margem do e-commerce","description":"Resultado do e-commerce depois de frete, plataforma e anúncios.","formula":"(receita e-commerce − custos e-commerce) / receita e-commerce","unit":"%","dashboard_section":"profitability","sort_order":5370,"activation":{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online"]}}},
  {"code":"ecom_avg_ticket","name":"Ticket médio do e-commerce","description":"Receita online dividida pelos pedidos do e-commerce.","formula":"receita do e-commerce / pedidos online","unit":"R$","dashboard_section":"profitability","sort_order":5380,"activation":{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online"]}}},
  {"code":"ecom_shipping_cost","name":"Frete e logística online","description":"Custo de frete, embalagem e logística das vendas online.","formula":"frete + logística das vendas online","unit":"R$","dashboard_section":"operational","sort_order":5390,"activation":{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online","marketplace"]}}},
  {"code":"ecom_platform_cost","name":"Custo da plataforma","description":"Mensalidade, gateway e ferramentas da loja virtual.","formula":"custo da plataforma de e-commerce","unit":"R$","dashboard_section":"operational","sort_order":5400,"activation":{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online"]}}},
  {"code":"digital_cac","name":"CAC digital","description":"Custo de aquisição de clientes no digital: anúncios e mídia divididos pelos novos clientes.","formula":"anúncios digitais / novos clientes","unit":"R$","dashboard_section":"profitability","sort_order":5410,"activation":{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online","marketplace"]}}},
  {"code":"ecom_conversion","name":"Conversão do e-commerce","description":"Pedidos concluídos em relação às visitas da loja virtual.","formula":"pedidos / visitas","unit":"%","dashboard_section":"operational","sort_order":5420,"activation":{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online"]}}},
  {"code":"mktp_revenue","name":"Receita de marketplace","description":"Faturamento das vendas em marketplaces.","formula":"receita de marketplace","unit":"R$","dashboard_section":"financial","sort_order":5430,"activation":{"in":{"answer":"com_channel","values":["marketplace"]}}},
  {"code":"mktp_fees","name":"Taxas de marketplace","description":"Comissões e taxas cobradas pelos marketplaces.","formula":"taxas + comissões de marketplace","unit":"R$","dashboard_section":"operational","sort_order":5440,"activation":{"in":{"answer":"com_channel","values":["marketplace"]}}},
  {"code":"mktp_margin_after_fees","name":"Margem após taxas de marketplace","description":"Resultado do marketplace depois das taxas e comissões da plataforma.","formula":"(receita marketplace − custos − taxas) / receita marketplace","unit":"%","dashboard_section":"profitability","sort_order":5450,"activation":{"in":{"answer":"com_channel","values":["marketplace"]}}},
  {"code":"mktp_avg_ticket","name":"Ticket médio de marketplace","description":"Receita de marketplace dividida pelos pedidos do canal.","formula":"receita de marketplace / pedidos de marketplace","unit":"R$","dashboard_section":"profitability","sort_order":5460,"activation":{"in":{"answer":"com_channel","values":["marketplace"]}}},
  {"code":"channel_revenue_compare","name":"Faturamento físico × online","description":"Compara a receita da loja física com a receita dos canais digitais.","formula":"receita física e receita online lado a lado","unit":"R$","dashboard_section":"financial","sort_order":5470,"activation":{"all":[{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}},{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online","marketplace"]}}]}},
  {"code":"channel_revenue_mix","name":"Mix de receita por canal","description":"Participação de cada canal no faturamento total.","formula":"receita do canal / receita total","unit":"%","dashboard_section":"profitability","sort_order":5480,"activation":{"all":[{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}},{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online","marketplace"]}}]}},
  {"code":"channel_margin_compare","name":"Margem por canal","description":"Compara a margem da loja física com a margem dos canais digitais.","formula":"margem física × margem online","unit":"%","dashboard_section":"profitability","sort_order":5490,"activation":{"all":[{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}},{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online","marketplace"]}}]}},
  {"code":"most_profitable_channel","name":"Canal mais rentável","description":"Indica qual canal — loja física, e-commerce ou marketplace — gera o melhor resultado.","formula":"canal com maior lucro","unit":"canal","dashboard_section":"profitability","sort_order":5500,"activation":{"all":[{"in":{"answer":"com_channel","values":["fisica","loja_fisica"]}},{"in":{"answer":"com_channel","values":["ecommerce","e_commerce","online","marketplace"]}}]}},
  {"code":"oxr_per_channel","name":"Orçado × Realizado por canal","description":"Acompanha o desvio orçamentário de cada canal de venda.","formula":"orçado e realizado por canal","unit":"R$","dashboard_section":"budget_vs_actual","sort_order":5510,"activation":{"in":{"answer":"com_channel","values":["fisica","loja_fisica","ecommerce","e_commerce","online","marketplace"]}}}
]$json$::jsonb) as item
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  formula_hint = excluded.formula_hint,
  formula = excluded.formula,
  category = excluded.category,
  unit = excluded.unit,
  applicable_segments = excluded.applicable_segments,
  activation_conditions = excluded.activation_conditions,
  dashboard_section = excluded.dashboard_section,
  sort_order = excluded.sort_order,
  is_active = true;
