-- Retira perguntas de cadastro do tipo "você já acompanha / controla?".
-- A plataforma é que deve fazer o usuário acompanhar; os indicadores
-- passam a valer pelo ramo, sem depender de Sim/Não.

update public.onboarding_questions
set is_active = false
where code in (
  'tracks_unit_costs',
  'agro_tracks_cost_hectare',
  'agro_tracks_cost_crop',
  'agro_tracks_productivity_hectare',
  'agro_track_arroba_like',
  'pec_tracks_lot',
  'pec_tracks_animal',
  'pec_wants_arroba',
  'com_stock',
  'ind_stock_rm',
  'ind_stock_fg',
  'auto_stock',
  'pro_hours',
  'ind_costs',
  'con_costs',
  'food_costs',
  'srv_costs',
  'hlt_volume',
  're_costs',
  'eng_costs',
  'beau_costs',
  'mkt_costs',
  'env_costs'
)
or question in (
  'Você acompanha seus custos por unidade?',
  'A empresa acompanha custo por hectare?',
  'Você acompanha o custo individual por cultura?',
  'Você acompanha produtividade por hectare?',
  'Você deseja acompanhar o custo por saca?',
  'Você controla o custo por lote?',
  'Você controla o custo por animal?',
  'Você deseja acompanhar o custo por arroba?',
  'A empresa controla estoque?',
  'A empresa controla estoque de matéria-prima?',
  'A empresa controla estoque de produtos acabados?',
  'A empresa controla estoque de peças?',
  'As horas trabalhadas são controladas?',
  'Quais custos de produção você acompanha?',
  'Quais custos você acompanha por obra?',
  'Quais custos você quer acompanhar?',
  'Quais custos por projeto são acompanhados?',
  'O que a empresa acompanha no atendimento?',
  'Quais custos você acompanha por imóvel?',
  'Quais custos operacionais são acompanhados?',
  'Quais custos você acompanha?'
);

update public.system_indicators
set
  activation_conditions = null,
  unless_conditions = null
where code in (
  'unit_profitability',
  'cost_per_crop',
  'productivity_per_hectare',
  'cost_per_animal',
  'cost_per_lot',
  'inventory_turnover',
  'inventory_coverage',
  'parts_turnover'
);
