-- Departamentos com nome curto e centro de custo correspondente.
-- O wizard de orçamento passa a ter opções de centro de custo por departamento.

create or replace function public.ensure_company_default_departments(
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_id uuid;
  v_dept_id uuid;
  v_cc_id uuid;
begin
  if p_company_id is null then
    raise exception 'Empresa não informada';
  end if;

  if auth.uid() is not null and not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  for r in
    select *
    from (
      values
        ('Administrativo'::text, 'Administração Geral'::text, array['Administração Geral']::text[]),
        ('Financeiro', 'Gestão Financeira', array['Gestão Financeira']),
        ('Contabilidade', 'Contabilidade', '{}'::text[]),
        ('Recursos Humanos', 'Recursos Humanos', array['RH']),
        ('Comercial / Vendas', 'Vendas e Comercial', array['Comercial', 'Vendas', 'Vendas e Comercial']),
        ('Marketing', 'Marketing', '{}'::text[]),
        ('Compras', 'Compras', '{}'::text[]),
        ('Estoque / Almoxarifado', 'Estoque e Almoxarifado', array['Estoque', 'Almoxarifado', 'Estoque e Almoxarifado']),
        ('Operacional / Produção', 'Operações e Produção', array['Operações', 'Operacional', 'Produção', 'Operações e Produção']),
        ('Logística', 'Logística e Distribuição', array['Logística e Distribuição'])
    ) as t(dept_name, cc_name, aliases)
  loop
    v_id := null;

    select d.id
      into v_id
    from public.departments d
    where d.company_id = p_company_id
      and lower(d.name) = lower(r.dept_name)
    limit 1;

    if v_id is not null then
      update public.departments
      set
        description = coalesce(nullif(trim(description), ''), r.cc_name),
        is_active = true,
        updated_at = now()
      where id = v_id;
      continue;
    end if;

    if array_length(r.aliases, 1) is not null then
      select d.id
        into v_id
      from public.departments d
      where d.company_id = p_company_id
        and exists (
          select 1
          from unnest(r.aliases) as alias(name)
          where lower(d.name) = lower(alias.name)
        )
      limit 1;
    end if;

    if v_id is not null then
      update public.departments
      set
        name = r.dept_name,
        description = r.cc_name,
        is_active = true,
        updated_at = now()
      where id = v_id;
      continue;
    end if;

    insert into public.departments (company_id, name, description)
    values (p_company_id, r.dept_name, r.cc_name);
  end loop;

  for r in
    select *
    from (
      values
        ('Administrativo'::text, 'Administração Geral'::text),
        ('Financeiro', 'Gestão Financeira'),
        ('Contabilidade', 'Contabilidade'),
        ('Recursos Humanos', 'Recursos Humanos'),
        ('Comercial / Vendas', 'Vendas e Comercial'),
        ('Marketing', 'Marketing'),
        ('Compras', 'Compras'),
        ('Estoque / Almoxarifado', 'Estoque e Almoxarifado'),
        ('Operacional / Produção', 'Operações e Produção'),
        ('Logística', 'Logística e Distribuição')
    ) as t(dept_name, cc_name)
  loop
    v_dept_id := null;
    v_cc_id := null;

    select d.id
      into v_dept_id
    from public.departments d
    where d.company_id = p_company_id
      and lower(d.name) = lower(r.dept_name)
    limit 1;

    if v_dept_id is null then
      continue;
    end if;

    select cc.id
      into v_cc_id
    from public.cost_centers cc
    where cc.company_id = p_company_id
      and lower(cc.name) = lower(r.cc_name)
    limit 1;

    if v_cc_id is null then
      insert into public.cost_centers (company_id, name)
      values (p_company_id, r.cc_name)
      returning id into v_cc_id;
    else
      update public.cost_centers
      set
        is_active = true,
        updated_at = now()
      where id = v_cc_id;
    end if;

    insert into public.department_cost_centers (department_id, cost_center_id)
    select v_dept_id, v_cc_id
    where not exists (
      select 1
      from public.department_cost_centers link
      where link.department_id = v_dept_id
        and link.cost_center_id = v_cc_id
    );
  end loop;
end;
$$;

do $$
declare
  v_company_id uuid;
begin
  for v_company_id in select id from public.companies loop
    perform public.ensure_company_default_departments(v_company_id);
  end loop;
end;
$$;

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
    onboarding_completed
  )
  values (
    v_company.id,
    v_segment_id,
    case when v_segment_code = 'other' then v_custom_segment else null end,
    v_description,
    false
  );

  insert into public.company_settings (company_id, settings)
  values (v_company.id, '{"locale":"pt-BR","currency":"BRL"}'::jsonb);

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
  where si.is_active = true;

  insert into public.company_reports (company_id, report_id, enabled)
  select v_company.id, sr.id, true
  from public.system_reports sr
  where sr.is_active = true;

  insert into public.company_dashboards (company_id, name, layout, theme, is_default)
  values (
    v_company.id,
    'Dashboard padrão',
    '{"widgets":["summary","budget_vs_actual","top_costs"]}'::jsonb,
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

create or replace function public.setup_company_environment(
  p_company_id uuid,
  p_name text default null,
  p_segment_code text default null,
  p_custom_segment text default null,
  p_departments text[] default '{}',
  p_cost_centers jsonb default '[]'::jsonb,
  p_skip boolean default false
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
  v_segment_code text := nullif(trim(coalesce(p_segment_code, '')), '');
  v_custom_segment text := nullif(trim(coalesce(p_custom_segment, '')), '');
  v_dept text;
  v_cc jsonb;
  v_cc_name text;
  v_cc_code text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_company_id is null then
    raise exception 'Empresa não informada';
  end if;

  if not public.is_company_admin(p_company_id) then
    raise exception 'Você não tem permissão para configurar esta empresa';
  end if;

  select * into v_company
  from public.companies
  where id = p_company_id;

  if v_company.id is null then
    raise exception 'Empresa não encontrada';
  end if;

  if p_skip then
    update public.company_profiles
    set onboarding_completed = true,
        updated_at = now()
    where company_id = p_company_id;

    perform public.ensure_company_default_departments(p_company_id);
    return v_company;
  end if;

  if v_name is not null then
    update public.companies
    set name = v_name,
        updated_at = now()
    where id = p_company_id
    returning * into v_company;
  end if;

  if v_segment_code is not null then
    select s.id into v_segment_id
    from public.segments s
    where s.code = v_segment_code;

    if v_segment_id is null then
      raise exception 'Segmento da empresa é inválido';
    end if;

    update public.company_profiles
    set segment_id = v_segment_id,
        custom_segment = case
          when v_segment_code = 'other' then v_custom_segment
          else null
        end,
        updated_at = now()
    where company_id = p_company_id;
  end if;

  if p_departments is not null then
    foreach v_dept in array p_departments loop
      v_dept := nullif(trim(v_dept), '');
      if v_dept is null then
        continue;
      end if;

      insert into public.departments (company_id, name)
      select p_company_id, v_dept
      where not exists (
        select 1
        from public.departments d
        where d.company_id = p_company_id
          and lower(d.name) = lower(v_dept)
      );
    end loop;
  end if;

  if p_cost_centers is not null and jsonb_typeof(p_cost_centers) = 'array' then
    for v_cc in select value from jsonb_array_elements(p_cost_centers) loop
      v_cc_name := nullif(trim(coalesce(v_cc->>'name', '')), '');
      v_cc_code := nullif(trim(coalesce(v_cc->>'code', '')), '');
      if v_cc_name is null then
        continue;
      end if;

      insert into public.cost_centers (company_id, name, code)
      select p_company_id, v_cc_name, v_cc_code
      where not exists (
        select 1
        from public.cost_centers c
        where c.company_id = p_company_id
          and lower(c.name) = lower(v_cc_name)
      );
    end loop;
  end if;

  update public.company_profiles
  set onboarding_completed = true,
      updated_at = now()
  where company_id = p_company_id;

  perform public.ensure_company_default_departments(p_company_id);

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, new_values)
  values (
    p_company_id,
    v_user_id,
    'update',
    'company_setup',
    p_company_id,
    jsonb_build_object('name', v_company.name, 'skipped', false)
  );

  return v_company;
end;
$$;
