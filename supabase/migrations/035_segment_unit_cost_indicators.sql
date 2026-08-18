-- Unidade de operação definida pelo ramo + indicadores de custo unitário.

insert into public.analysis_units (code, name, description, applicable_segments)
values
  ('kg', 'Kg produzido', 'Quilograma produzido', array['fishing']),
  ('night', 'Diária', 'Diária realizada', array['hospitality']),
  ('operation', 'Operação', 'Operação financeira', array['financial']),
  ('public_service', 'Serviço realizado', 'Serviço prestado', array['public_admin']),
  ('operation_unit', 'Unidade de operação', 'Unidade de operação', array['other'])
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  applicable_segments = excluded.applicable_segments,
  is_active = true;

update public.analysis_units
set
  name = 'Produto vendido',
  description = 'Produto vendido',
  applicable_segments = array['commerce'],
  is_active = true
where code = 'sold_unit';

update public.analysis_units
set applicable_segments = array['beauty', 'health']
where code = 'attendance';

update public.onboarding_questions
set is_active = false
where code = 'analysis_units';

insert into public.system_indicators (
  code, name, description, formula_hint, formula, category, unit,
  applicable_segments, activation_conditions, unless_conditions,
  required_data, periodicity, dashboard_section, sort_order, is_active
)
values
  ('cost_per_hectare', 'Custo por hectare', 'Custo total realizado dividido pelos hectares do mês.', 'custos / hectares', 'custos / hectares', 'operational', 'R$/hectare', array['agro'], null, null, '[]'::jsonb, 'monthly', 'operational', 300, true),
  ('cost_per_head', 'Custo por cabeça', 'Custo total realizado dividido pelas cabeças do mês.', 'custos / cabeças', 'custos / cabeças', 'operational', 'R$/cabeça', array['livestock'], null, null, '[]'::jsonb, 'monthly', 'operational', 410, true),
  ('cost_per_kg_fish', 'Custo por kg produzido', 'Custo total realizado dividido pelos kg produzidos no mês.', 'custos / kg produzidos', 'custos / kg produzidos', 'operational', 'R$/kg produzido', array['fishing'], null, null, '[]'::jsonb, 'monthly', 'operational', 2300, true),
  ('cost_per_sold_unit', 'Custo por produto vendido', 'Custo total realizado dividido pelos produtos vendidos no mês.', 'custos / produtos vendidos', 'custos / produtos vendidos', 'operational', 'R$/produto vendido', array['commerce'], null, null, '[]'::jsonb, 'monthly', 'operational', 505, true),
  ('cost_per_unit', 'Custo por unidade produzida', 'Custo total realizado dividido pelas unidades produzidas no mês.', 'custo de produção / unidades', 'custo de produção / unidades', 'operational', 'R$/unidade produzida', array['industry'], null, null, '[]'::jsonb, 'monthly', 'operational', 610, true),
  ('cost_per_sqm', 'Custo por m² construído', 'Custo total realizado dividido pelos m² construídos no mês.', 'custos / m²', 'custos / m²', 'operational', 'R$/m² construído', array['construction'], null, null, '[]'::jsonb, 'monthly', 'operational', 710, true),
  ('cost_per_hour', 'Custo por hora trabalhada', 'Custo total realizado dividido pelas horas trabalhadas no mês.', 'custos / horas', 'custos / horas', 'operational', 'R$/hora trabalhada', array['services','professional'], null, null, '[]'::jsonb, 'monthly', 'operational', 1030, true),
  ('cost_per_project_tech', 'Custo por projeto', 'Custo total realizado dividido pelos projetos do mês.', 'custos / projetos', 'custos / projetos', 'operational', 'R$/projeto', array['tech'], null, null, '[]'::jsonb, 'monthly', 'operational', 1110, true),
  ('cost_per_hour_tech', 'Custo por hora', 'Custo total realizado dividido pelas horas trabalhadas no mês.', 'custos / horas', 'custos / horas', 'operational', 'R$/hora', array['tech'], null, null, '[]'::jsonb, 'monthly', 'operational', 1120, true),
  ('cost_per_km', 'Custo por km rodado', 'Custo total realizado dividido pelos km rodados no mês.', 'custos / km', 'custos / km', 'operational', 'R$/km rodado', array['transport_logistics'], null, null, '[]'::jsonb, 'monthly', 'operational', 800, true),
  ('cost_per_meal', 'Custo por refeição', 'Custo total realizado dividido pelas refeições do mês.', 'custos / refeições', 'custos / refeições', 'operational', 'R$/refeição', array['food'], null, null, '[]'::jsonb, 'monthly', 'operational', 920, true),
  ('cost_per_night', 'Custo por diária', 'Custo total realizado dividido pelas diárias do mês.', 'custos / diárias', 'custos / diárias', 'operational', 'R$/diária', array['hospitality'], null, null, '[]'::jsonb, 'monthly', 'operational', 1815, true),
  ('cost_per_health_attendance', 'Custo por atendimento', 'Custo total realizado dividido pelos atendimentos do mês.', 'custos / atendimentos', 'custos / atendimentos', 'operational', 'R$/atendimento', array['health'], null, null, '[]'::jsonb, 'monthly', 'operational', 1205, true),
  ('cost_per_student', 'Custo por aluno', 'Custo total realizado dividido pelos alunos do mês.', 'custos / alunos', 'custos / alunos', 'operational', 'R$/aluno', array['education'], null, null, '[]'::jsonb, 'monthly', 'operational', 1300, true),
  ('cost_per_property', 'Custo por imóvel', 'Custo total realizado dividido pelos imóveis do mês.', 'custos / imóveis', 'custos / imóveis', 'operational', 'R$/imóvel', array['real_estate'], null, null, '[]'::jsonb, 'monthly', 'operational', 1410, true),
  ('cost_per_operation', 'Custo por operação', 'Custo total realizado dividido pelas operações do mês.', 'custos / operações', 'custos / operações', 'operational', 'R$/operação', array['financial'], null, null, '[]'::jsonb, 'monthly', 'operational', 2400, true),
  ('cost_per_service', 'Custo por serviço realizado', 'Custo total realizado dividido pelos serviços do mês.', 'custos / serviços', 'custos / serviços', 'operational', 'R$/serviço realizado', array['automotive'], null, null, '[]'::jsonb, 'monthly', 'operational', 1500, true),
  ('cost_per_kwh', 'Custo por kWh produzido', 'Custo total realizado dividido pelos kWh produzidos no mês.', 'custos / kWh', 'custos / kWh', 'operational', 'R$/kWh produzido', array['energy'], null, null, '[]'::jsonb, 'monthly', 'operational', 1600, true),
  ('cost_per_ton_min', 'Custo por tonelada extraída', 'Custo total realizado dividido pelas toneladas extraídas no mês.', 'custos / toneladas', 'custos / toneladas', 'operational', 'R$/tonelada extraída', array['mining'], null, null, '[]'::jsonb, 'monthly', 'operational', 1700, true),
  ('cost_per_campaign', 'Custo por campanha', 'Custo total realizado dividido pelas campanhas do mês.', 'custos / campanhas', 'custos / campanhas', 'operational', 'R$/campanha', array['media'], null, null, '[]'::jsonb, 'monthly', 'operational', 2070, true),
  ('cost_per_project_media', 'Custo por projeto', 'Custo total realizado dividido pelos projetos do mês.', 'custos / projetos', 'custos / projetos', 'operational', 'R$/projeto', array['media','marketing'], null, null, '[]'::jsonb, 'monthly', 'operational', 2000, true),
  ('cost_per_event', 'Custo por evento', 'Custo total realizado dividido pelos eventos do mês.', 'custos / eventos', 'custos / eventos', 'operational', 'R$/evento', array['entertainment','sports'], null, null, '[]'::jsonb, 'monthly', 'operational', 2100, true),
  ('cost_per_client_play', 'Custo por cliente', 'Custo total realizado dividido pelos clientes do mês.', 'custos / clientes', 'custos / clientes', 'operational', 'R$/cliente', array['entertainment','sports'], null, null, '[]'::jsonb, 'monthly', 'operational', 2110, true),
  ('cost_per_attendance', 'Custo por atendimento', 'Custo total realizado dividido pelos atendimentos do mês.', 'custos / atendimentos', 'custos / atendimentos', 'operational', 'R$/atendimento', array['beauty'], null, null, '[]'::jsonb, 'monthly', 'operational', 1900, true),
  ('cost_per_ton_env', 'Custo por tonelada processada', 'Custo total realizado dividido pelas toneladas processadas no mês.', 'custos / toneladas', 'custos / toneladas', 'operational', 'R$/tonelada processada', array['environment'], null, null, '[]'::jsonb, 'monthly', 'operational', 2200, true),
  ('cost_per_service_pub', 'Custo por serviço realizado', 'Custo total realizado dividido pelos serviços do mês.', 'custos / serviços', 'custos / serviços', 'operational', 'R$/serviço realizado', array['public_admin'], null, null, '[]'::jsonb, 'monthly', 'operational', 2510, true),
  ('cost_per_operation_unit', 'Custo por unidade de operação', 'Custo total realizado dividido pelas unidades de operação do mês.', 'custos / unidades de operação', 'custos / unidades de operação', 'operational', 'R$/unidade de operação', array['other'], null, null, '[]'::jsonb, 'monthly', 'operational', 2600, true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  formula_hint = excluded.formula_hint,
  formula = excluded.formula,
  category = excluded.category,
  unit = excluded.unit,
  applicable_segments = excluded.applicable_segments,
  activation_conditions = null,
  unless_conditions = null,
  dashboard_section = excluded.dashboard_section,
  sort_order = excluded.sort_order,
  is_active = true;
