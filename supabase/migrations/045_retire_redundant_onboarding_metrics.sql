-- Remove perguntas de cadastro que pedem métricas calculadas pelo sistema
-- (ticket, volume, produção, área, quantidades operacionais) e classificações
-- redundantes. Perguntas de escolha passam a aceitar mais de uma opção.

update public.onboarding_questions
set is_active = false
where code in (
  'agro_hectares',
  'agro_productivity',
  'agro_estimated_production',
  'agro_avg_price',
  'pec_animals',
  'pec_properties',
  'pec_lots',
  'pec_area',
  'pec_avg_weight',
  'pec_arroba',
  'pec_milk',
  'pec_cost_animal',
  'pec_costs',
  'fish_volume',
  'fish_area',
  'com_type',
  'com_stores',
  'com_products',
  'com_categories',
  'com_ticket',
  'com_volume',
  'com_costs',
  'ind_volume',
  'ind_capacity',
  'ind_inputs',
  'con_works',
  'con_area',
  'con_value',
  'con_deadline',
  'trn_vehicles',
  'trn_km',
  'trn_trips',
  'trn_capacity',
  'trn_tons',
  'trn_costs',
  'food_units',
  'food_products',
  'food_orders',
  'food_ticket',
  'srv_clients',
  'srv_contracts',
  'srv_projects',
  'srv_hours',
  'srv_avg_contract',
  'tech_clients',
  'tech_users',
  'tech_projects',
  'tech_hours',
  'hlt_units',
  'hlt_pros',
  'edu_students',
  'edu_courses',
  'edu_classes',
  'edu_teachers',
  'edu_tuition',
  're_properties',
  're_contracts',
  're_avg_value',
  'auto_vehicles',
  'auto_ticket',
  'eng_capacity',
  'eng_units',
  'eng_production',
  'min_area',
  'min_volume',
  'hot_rooms',
  'hot_capacity',
  'hot_occupancy',
  'hot_rate',
  'beau_pros',
  'beau_attendances',
  'beau_ticket',
  'media_clients',
  'media_projects',
  'mkt_clients',
  'mkt_projects',
  'ent_events',
  'ent_capacity',
  'ent_ticket',
  'spt_clients',
  'spt_ticket',
  'env_projects',
  'env_volume',
  'fin_clients',
  'fin_contracts',
  'pro_clients',
  'pub_units',
  'oth_costs'
)
or question in (
  'Qual é o tipo de comércio?',
  'Qual é a quantidade aproximada de produtos?',
  'Qual é a produtividade média?',
  'Quais categorias de produtos são mais relevantes?',
  'Qual é a quantidade de lotes?',
  'Qual é o ticket médio?',
  'Qual é a área utilizada (hectares)?',
  'Qual é o volume médio de vendas?',
  'Qual é a produção estimada?',
  'Qual é o peso médio dos animais?',
  'Quais custos pesam mais nas vendas?',
  'Qual é a produção de arrobas?',
  'Qual é o custo médio por animal?'
)
or (
  is_active = true
  and answer_type = 'number'
  and code <> 'employee_count'
);

update public.onboarding_questions
set answer_type = 'multiple'
where is_active = true
  and answer_type = 'single'
  and code not in ('company_size', 'state', 'operation_model')
  and (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) > 2
  );

update public.onboarding_questions
set
  options = '[
    {"value":"fisica","label":"Física"},
    {"value":"online","label":"Online"}
  ]'::jsonb,
  question = 'Como a empresa vende?',
  help_text = 'Pode marcar física e online.',
  answer_type = 'multiple'
where code = 'com_channel';
