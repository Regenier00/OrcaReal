-- Operação própria: retira indicadores que falam sobre "ativo"
-- (ROA, ociosidade, manutenção por ativo e produtividade por ativo).
-- Continuam disponíveis custo operacional, custo por unidade, margem,
-- ROI, ponto de equilíbrio e depreciação por unidade.

update public.system_indicators
set is_active = false
where code in (
  'own_roa',
  'own_asset_idle',
  'own_maintenance_per_asset',
  'own_productivity_per_asset'
);

update public.company_indicators
set
  enabled = false,
  dashboard_visible = false
where indicator_id in (
  select id
  from public.system_indicators
  where code in (
    'own_roa',
    'own_asset_idle',
    'own_maintenance_per_asset',
    'own_productivity_per_asset'
  )
);

update public.company_profile_answers
set
  answer = jsonb_set(
    answer,
    '{value}',
    coalesce(
      (
        select jsonb_agg(item)
        from jsonb_array_elements_text(answer->'value') as item
        where item not in (
          'own_roa',
          'own_asset_idle',
          'own_maintenance_per_asset',
          'own_productivity_per_asset'
        )
      ),
      '[]'::jsonb
    )
  ),
  updated_at = now()
where question_code = 'operation_priorities'
  and jsonb_typeof(answer->'value') = 'array';
