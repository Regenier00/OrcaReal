-- Experiência personalizada por ramo: unidades de análise, operações,
-- respostas do perfil, motor de indicadores e dashboard.

-- ---------------------------------------------------------------------------
-- Extensões de catálogos e perfil já existentes
-- ---------------------------------------------------------------------------

alter table public.company_profiles
  add column if not exists employee_count_range text,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists operation_model text,
  add column if not exists revenue_model text,
  add column if not exists primary_activity text,
  add column if not exists profile_facts jsonb not null default '{}'::jsonb,
  add column if not exists questionnaire_completed boolean not null default false,
  add column if not exists experience_ready boolean not null default false;

alter table public.system_indicators
  add column if not exists category text not null default 'financial'
    check (category in ('financial', 'operational', 'strategic')),
  add column if not exists unit text not null default 'R$',
  add column if not exists formula text,
  add column if not exists applicable_segments text[],
  add column if not exists activation_conditions jsonb,
  add column if not exists unless_conditions jsonb,
  add column if not exists required_data jsonb not null default '[]'::jsonb,
  add column if not exists periodicity text not null default 'monthly',
  add column if not exists dashboard_section text not null default 'financial';

update public.system_indicators
set
  category = 'financial',
  formula = coalesce(formula, formula_hint),
  dashboard_section = case
    when code in ('budget_variance', 'budget_variance_pct', 'cost_concentration')
      then 'budget_vs_actual'
    else coalesce(dashboard_section, 'financial')
  end
where category is null or category = 'financial';

alter table public.onboarding_questions
  drop constraint if exists onboarding_questions_answer_type_check;

alter table public.onboarding_questions
  add column if not exists segment_code text,
  add column if not exists show_when jsonb,
  add column if not exists maps_to text,
  add column if not exists is_continuous boolean not null default false,
  add column if not exists is_optional boolean not null default false,
  add column if not exists option_source text not null default 'static';

alter table public.onboarding_questions
  add constraint onboarding_questions_answer_type_check
  check (answer_type in ('single', 'multiple', 'text', 'scale', 'number'));

alter table public.company_indicators
  add column if not exists is_favorite boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists target_value numeric(18, 4),
  add column if not exists dashboard_visible boolean not null default true,
  add column if not exists operation_id uuid;

-- ---------------------------------------------------------------------------
-- Novas tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.analysis_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  applicable_segments text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.company_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  segment_id uuid references public.segments (id) on delete set null,
  name text not null,
  is_primary boolean not null default false,
  profile_facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_operations_one_primary_idx
  on public.company_operations (company_id)
  where is_primary;

create index if not exists company_operations_company_id_idx
  on public.company_operations (company_id);

create table if not exists public.company_analysis_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  operation_id uuid references public.company_operations (id) on delete cascade,
  analysis_unit_id uuid not null references public.analysis_units (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists company_analysis_units_company_unit_idx
  on public.company_analysis_units (company_id, analysis_unit_id)
  where operation_id is null;

create index if not exists company_analysis_units_company_id_idx
  on public.company_analysis_units (company_id);

create table if not exists public.company_profile_answers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  operation_id uuid references public.company_operations (id) on delete cascade,
  question_code text not null,
  answer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, question_code)
);

create index if not exists company_profile_answers_company_id_idx
  on public.company_profile_answers (company_id);

create table if not exists public.indicator_conditions (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid not null references public.system_indicators (id) on delete cascade,
  condition jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists indicator_conditions_indicator_id_idx
  on public.indicator_conditions (indicator_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_indicators_operation_id_fkey'
  ) then
    alter table public.company_indicators
      add constraint company_indicators_operation_id_fkey
      foreign key (operation_id) references public.company_operations (id) on delete cascade;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.analysis_units enable row level security;
alter table public.company_operations enable row level security;
alter table public.company_analysis_units enable row level security;
alter table public.company_profile_answers enable row level security;
alter table public.indicator_conditions enable row level security;

drop policy if exists "analysis_units_select_authenticated" on public.analysis_units;
create policy "analysis_units_select_authenticated"
  on public.analysis_units for select to authenticated
  using (is_active = true);

drop policy if exists "indicator_conditions_select_authenticated" on public.indicator_conditions;
create policy "indicator_conditions_select_authenticated"
  on public.indicator_conditions for select to authenticated
  using (true);

drop policy if exists "company_operations_all_member" on public.company_operations;
create policy "company_operations_all_member"
  on public.company_operations for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "company_analysis_units_all_member" on public.company_analysis_units;
create policy "company_analysis_units_all_member"
  on public.company_analysis_units for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "company_profile_answers_all_member" on public.company_profile_answers;
create policy "company_profile_answers_all_member"
  on public.company_profile_answers for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- Operação principal para empresas já existentes
-- ---------------------------------------------------------------------------

insert into public.company_operations (company_id, segment_id, name, is_primary)
select
  cp.company_id,
  cp.segment_id,
  'Operação principal',
  true
from public.company_profiles cp
where not exists (
  select 1 from public.company_operations op where op.company_id = cp.company_id
);

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

create or replace function public.upsert_analysis_unit(
  p_code text,
  p_name text,
  p_description text default null,
  p_segments text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.analysis_units (code, name, description, applicable_segments)
  values (p_code, p_name, p_description, coalesce(p_segments, '{}'))
  on conflict (code) do update
  set
    name = excluded.name,
    description = excluded.description,
    applicable_segments = excluded.applicable_segments,
    is_active = true
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.upsert_system_indicator_def(p_def jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text := nullif(p_def->>'code', '');
begin
  if v_code is null then
    raise exception 'Indicador sem código';
  end if;

  insert into public.system_indicators (
    code,
    name,
    description,
    formula_hint,
    formula,
    category,
    unit,
    applicable_segments,
    activation_conditions,
    unless_conditions,
    required_data,
    periodicity,
    dashboard_section,
    sort_order,
    is_active
  )
  values (
    v_code,
    coalesce(nullif(p_def->>'name', ''), v_code),
    p_def->>'description',
    coalesce(p_def->>'formula', p_def->>'formula_hint'),
    p_def->>'formula',
    coalesce(nullif(p_def->>'category', ''), 'operational'),
    coalesce(nullif(p_def->>'unit', ''), 'un'),
    case
      when jsonb_typeof(p_def->'segments') = 'array' then (
        select array_agg(value #>> '{}') from jsonb_array_elements(p_def->'segments')
      )
      else null
    end,
    p_def->'activation',
    p_def->'unless',
    coalesce(p_def->'requiredData', '[]'::jsonb),
    coalesce(nullif(p_def->>'periodicity', ''), 'monthly'),
    coalesce(nullif(p_def->>'dashboard_section', ''), nullif(p_def->>'dashboardSection', ''), 'operational'),
    coalesce((p_def->>'sort_order')::int, (p_def->>'sortOrder')::int, 0),
    true
  )
  on conflict (code) do update
  set
    name = excluded.name,
    description = coalesce(excluded.description, public.system_indicators.description),
    formula_hint = coalesce(excluded.formula_hint, public.system_indicators.formula_hint),
    formula = coalesce(excluded.formula, public.system_indicators.formula),
    category = excluded.category,
    unit = excluded.unit,
    applicable_segments = excluded.applicable_segments,
    activation_conditions = excluded.activation_conditions,
    unless_conditions = excluded.unless_conditions,
    dashboard_section = excluded.dashboard_section,
    sort_order = excluded.sort_order,
    is_active = true
  returning id into v_id;

  delete from public.indicator_conditions where indicator_id = v_id;
  if p_def ? 'activation' and p_def->'activation' is not null then
    insert into public.indicator_conditions (indicator_id, condition)
    values (v_id, p_def->'activation');
  end if;

  return v_id;
end;
$$;

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

  if jsonb_typeof(p_cost_centers) = 'array' then
    for v_item in select value from jsonb_array_elements(p_cost_centers) loop
      v_name := nullif(trim(coalesce(v_item->>'name', v_item #>> '{}')), '');
      if v_name is null then
        continue;
      end if;
      insert into public.cost_centers (company_id, name)
      select p_company_id, v_name
      where not exists (
        select 1 from public.cost_centers c
        where c.company_id = p_company_id and lower(c.name) = lower(v_name)
      );
    end loop;
  end if;

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

create or replace function public.add_company_operation(
  p_company_id uuid,
  p_segment_code text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_segment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_company_admin(p_company_id) then
    raise exception 'Você não tem permissão para configurar esta empresa';
  end if;

  select id into v_segment_id from public.segments where code = p_segment_code;
  if v_segment_id is null then
    raise exception 'Ramo inválido';
  end if;

  insert into public.company_operations (company_id, segment_id, name, is_primary)
  values (p_company_id, v_segment_id, coalesce(nullif(trim(p_name), ''), 'Nova operação'), false)
  returning id into v_id;

  return v_id;
end;
$$;

-- Empresas novas: operação principal + só indicadores financeiros no nascimento
create or replace function public.create_user_company(
  p_name text,
  p_trade_name text default null,
  p_document text default null,
  p_description text default null,
  p_segment_code text default null,
  p_custom_segment text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company public.companies;
  v_segment_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_trade_name text := nullif(trim(coalesce(p_trade_name, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_segment_code text := nullif(trim(coalesce(p_segment_code, '')), '');
  v_custom_segment text := nullif(trim(coalesce(p_custom_segment, '')), '');
  v_document text := public.normalize_cnpj(p_document);
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if v_name is null then
    raise exception 'Nome da empresa é obrigatório';
  end if;

  if v_segment_code is null then
    raise exception 'Segmento da empresa é obrigatório';
  end if;

  if v_document is not null and not public.is_valid_cnpj(v_document) then
    raise exception 'CNPJ inválido';
  end if;

  select s.id into v_segment_id
  from public.segments s
  where s.code = v_segment_code;

  if v_segment_id is null then
    raise exception 'Segmento da empresa é inválido';
  end if;

  insert into public.profiles (id, name, email)
  values (
    v_user_id,
    coalesce(
      (select raw_user_meta_data->>'name' from auth.users where id = v_user_id),
      'Usuário'
    ),
    (select email from auth.users where id = v_user_id)
  )
  on conflict (id) do nothing;

  insert into public.companies (name, trade_name, document, description)
  values (v_name, v_trade_name, v_document, v_description)
  returning * into v_company;

  insert into public.company_users (company_id, user_id, role)
  values (v_company.id, v_user_id, 'owner');

  insert into public.company_profiles (
    company_id,
    segment_id,
    custom_segment,
    profile_summary,
    onboarding_completed,
    questionnaire_completed,
    experience_ready
  )
  values (
    v_company.id,
    v_segment_id,
    case when v_segment_code = 'other' then v_custom_segment else null end,
    v_description,
    false,
    false,
    false
  );

  insert into public.company_settings (company_id, settings)
  values (v_company.id, '{"locale":"pt-BR","currency":"BRL"}'::jsonb);

  insert into public.company_operations (company_id, segment_id, name, is_primary)
  values (v_company.id, v_segment_id, 'Operação principal', true);

  perform public.ensure_company_default_departments(v_company.id);

  insert into public.categories (company_id, name, category_type)
  values
    (v_company.id, 'Receitas Operacionais', 'revenue'),
    (v_company.id, 'Custos Diretos', 'cost'),
    (v_company.id, 'Despesas Administrativas', 'expense'),
    (v_company.id, 'Despesas Comerciais', 'expense');

  insert into public.company_features (company_id, feature_id, enabled, recommended)
  select v_company.id, sf.id, true, (sf.code in ('budget_vs_actual', 'cost_analysis'))
  from public.system_features sf
  where sf.is_active = true;

  insert into public.company_indicators (company_id, indicator_id, enabled)
  select v_company.id, si.id, true
  from public.system_indicators si
  where si.is_active = true
    and coalesce(si.category, 'financial') = 'financial';

  insert into public.company_reports (company_id, report_id, enabled)
  select v_company.id, sr.id, true
  from public.system_reports sr
  where sr.is_active = true;

  insert into public.company_dashboards (company_id, name, layout, theme, is_default)
  values (
    v_company.id,
    'Dashboard personalizado',
    '{"sections":[]}'::jsonb,
    '{"accent":"navy"}'::jsonb,
    true
  );

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, new_values)
  values (
    v_company.id,
    v_user_id,
    'create',
    'company',
    v_company.id,
    jsonb_build_object(
      'name', v_company.name,
      'segment_code', v_segment_code
    )
  );

  return v_company;
end;
$$;

revoke all on function public.upsert_analysis_unit(text, text, text, text[]) from public;
revoke all on function public.upsert_system_indicator_def(jsonb) from public;
revoke all on function public.apply_company_experience(uuid, jsonb, jsonb, text[], jsonb, jsonb, jsonb, jsonb, jsonb, text[], boolean) from public;
revoke all on function public.add_company_operation(uuid, text, text) from public;

grant execute on function public.apply_company_experience(uuid, jsonb, jsonb, text[], jsonb, jsonb, jsonb, jsonb, jsonb, text[], boolean) to authenticated;
grant execute on function public.add_company_operation(uuid, text, text) to authenticated;
