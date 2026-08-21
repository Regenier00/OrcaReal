-- Experiência / onboarding NÃO cria mais centros de custo automaticamente.
-- Centros só entram por escolha do usuário (sugestões) ou importação XLSX.

create or replace function public.apply_company_experience(
  p_company_id uuid,
  p_answers jsonb default '[]'::jsonb,
  p_profile jsonb default '{}'::jsonb,
  p_analysis_units text[] default '{}',
  p_extra_operations jsonb default '[]'::jsonb,
  p_indicator_defs jsonb default '[]'::jsonb,
  p_dashboard jsonb default '{}'::jsonb,
  p_categories jsonb default '[]'::jsonb,
  p_cost_centers jsonb default '[]'::jsonb,
  p_departments text[] default '{}',
  p_complete boolean default true
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company public.companies;
  v_primary_segment uuid;
  v_answer jsonb;
  v_item jsonb;
  v_name text;
  v_type text;
  v_indicator_id uuid;
  v_unit_id uuid;
  v_unit_code text;
  v_segment_id uuid;
  v_op_name text;
  v_first_unit boolean := true;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_admin(p_company_id) then
    raise exception 'Você não tem permissão para configurar esta empresa';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  if v_company.id is null then
    raise exception 'Empresa não encontrada';
  end if;

  select segment_id into v_primary_segment
  from public.company_profiles
  where company_id = p_company_id;

  insert into public.company_operations (company_id, segment_id, name, is_primary)
  select p_company_id, v_primary_segment, 'Operação principal', true
  where not exists (
    select 1 from public.company_operations op
    where op.company_id = p_company_id and op.is_primary
  );

  if jsonb_typeof(p_answers) = 'array' then
    for v_answer in select value from jsonb_array_elements(p_answers) loop
      insert into public.company_profile_answers (company_id, question_code, answer, updated_at)
      values (
        p_company_id,
        coalesce(v_answer->>'question_code', v_answer->>'code'),
        coalesce(v_answer->'answer', jsonb_build_object('value', v_answer->'value')),
        now()
      )
      on conflict (company_id, question_code) do update
      set answer = excluded.answer, updated_at = now();
    end loop;
  end if;

  update public.company_profiles
  set
    company_size = coalesce(nullif(p_profile->>'company_size', ''), company_size),
    employee_count_range = coalesce(nullif(p_profile->>'employee_count_range', ''), employee_count_range),
    state = coalesce(nullif(p_profile->>'state', ''), state),
    city = coalesce(nullif(p_profile->>'city', ''), city),
    operation_model = coalesce(nullif(p_profile->>'operation_model', ''), operation_model),
    revenue_model = coalesce(nullif(p_profile->>'revenue_model', ''), revenue_model),
    primary_activity = coalesce(nullif(p_profile->>'primary_activity', ''), primary_activity),
    profile_summary = coalesce(nullif(p_profile->>'profile_summary', ''), profile_summary),
    profile_facts = coalesce(p_profile->'profile_facts', profile_facts),
    questionnaire_completed = case when p_complete then true else questionnaire_completed end,
    experience_ready = case when p_complete then true else experience_ready end,
    onboarding_completed = case when p_complete then true else onboarding_completed end,
    updated_at = now()
  where company_id = p_company_id;

  if p_departments is not null then
    foreach v_name in array p_departments loop
      v_name := nullif(trim(v_name), '');
      if v_name is null then
        continue;
      end if;
      insert into public.departments (company_id, name)
      select p_company_id, v_name
      where not exists (
        select 1 from public.departments d
        where d.company_id = p_company_id and lower(d.name) = lower(v_name)
      );
    end loop;
  end if;

  -- p_cost_centers é ignorado de propósito: a empresa inicia com 0 centros.
  -- O usuário aplica sugestões ou importa a própria lista na configuração.

  if jsonb_typeof(p_categories) = 'array' then
    for v_item in select value from jsonb_array_elements(p_categories) loop
      v_name := nullif(trim(coalesce(v_item->>'name', '')), '');
      v_type := coalesce(nullif(v_item->>'type', ''), 'cost');
      if v_name is null then
        continue;
      end if;
      insert into public.categories (company_id, name, category_type)
      select p_company_id, v_name, v_type
      where not exists (
        select 1 from public.categories c
        where c.company_id = p_company_id and lower(c.name) = lower(v_name)
      );
    end loop;
  end if;

  delete from public.company_analysis_units where company_id = p_company_id;
  if p_analysis_units is not null then
    foreach v_unit_code in array p_analysis_units loop
      select id into v_unit_id from public.analysis_units where code = v_unit_code;
      if v_unit_id is null then
        v_unit_id := public.upsert_analysis_unit(v_unit_code, v_unit_code, null, '{}');
      end if;
      insert into public.company_analysis_units (company_id, analysis_unit_id, is_primary)
      values (p_company_id, v_unit_id, v_first_unit)
      on conflict (company_id, analysis_unit_id) where operation_id is null do nothing;
      v_first_unit := false;
    end loop;
  end if;

  if jsonb_typeof(p_extra_operations) = 'array' then
    for v_item in select value from jsonb_array_elements(p_extra_operations) loop
      select s.id into v_segment_id
      from public.segments s
      where s.code = coalesce(v_item->>'segmentCode', v_item->>'segment_code');
      v_op_name := coalesce(nullif(v_item->>'name', ''), 'Operação');
      if v_segment_id is null then
        continue;
      end if;
      insert into public.company_operations (company_id, segment_id, name, is_primary)
      select p_company_id, v_segment_id, v_op_name, false
      where not exists (
        select 1 from public.company_operations op
        where op.company_id = p_company_id
          and op.segment_id = v_segment_id
          and op.is_primary = false
      );
    end loop;
  end if;

  if jsonb_typeof(p_indicator_defs) = 'array' then
    update public.company_indicators
    set enabled = false, dashboard_visible = false
    where company_id = p_company_id;

    for v_item in select value from jsonb_array_elements(p_indicator_defs) loop
      v_indicator_id := public.upsert_system_indicator_def(v_item);
      insert into public.company_indicators (
        company_id,
        indicator_id,
        enabled,
        dashboard_visible,
        sort_order
      )
      values (
        p_company_id,
        v_indicator_id,
        true,
        true,
        coalesce((v_item->>'sort_order')::int, (v_item->>'sortOrder')::int, 0)
      )
      on conflict (company_id, indicator_id) do update
      set enabled = true, dashboard_visible = true, sort_order = excluded.sort_order;
    end loop;
  end if;

  if p_dashboard is not null and p_dashboard <> '{}'::jsonb then
    update public.company_dashboards
    set layout = p_dashboard, updated_at = now()
    where company_id = p_company_id and is_default = true;

    if not found then
      insert into public.company_dashboards (company_id, name, layout, is_default)
      values (p_company_id, 'Dashboard personalizado', p_dashboard, true);
    end if;
  end if;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id,
    v_user_id,
    'update',
    'company_experience',
    p_company_id,
    jsonb_build_object('complete', p_complete)
  );

  return v_company;
end;
$$;

comment on function public.apply_company_experience(uuid, jsonb, jsonb, text[], jsonb, jsonb, jsonb, jsonb, jsonb, text[], boolean) is
  'Aplica experiência da empresa. Não cria centros de custo; o usuário define via sugestões ou importação.';
