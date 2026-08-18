-- Pergunta de geração de receita em múltipla escolha, com opções
-- usadas para criar pelo menos 3 indicadores por modelo.
insert into public.onboarding_questions (
  code,
  question,
  help_text,
  answer_type,
  options,
  sort_order,
  maps_to,
  is_active
)
values (
  'revenue_model',
  'Como sua empresa gera receita?',
  'Pode marcar mais de uma. Para cada forma escolhida, criamos indicadores de receita no dashboard.',
  'multiple',
  '[
    {"value":"venda_de_produtos","label":"Venda de produtos"},
    {"value":"prestacao_de_servicos","label":"Prestação de serviços"},
    {"value":"receita_recorrente","label":"Receita recorrente / assinatura"},
    {"value":"contratos","label":"Contratos"},
    {"value":"producao_e_comercializacao","label":"Produção e comercialização"},
    {"value":"ecommerce_e_marketplace","label":"E-commerce e marketplace"},
    {"value":"locacao_e_aluguel","label":"Locação e aluguel"},
    {"value":"comissao_e_intermediacao","label":"Comissão e intermediação"},
    {"value":"licenciamento_e_royalties","label":"Licenciamento e royalties"},
    {"value":"publicidade_e_midia","label":"Publicidade e mídia"},
    {"value":"eventos_e_ingressos","label":"Eventos e ingressos"},
    {"value":"franquias","label":"Franquias"},
    {"value":"revenda_e_distribuicao","label":"Revenda e distribuição"},
    {"value":"mista","label":"Mista"}
  ]'::jsonb,
  60,
  'profile.revenue_model',
  true
)
on conflict (code) do update
set
  question = excluded.question,
  help_text = excluded.help_text,
  answer_type = excluded.answer_type,
  options = excluded.options,
  maps_to = excluded.maps_to,
  is_active = true;
