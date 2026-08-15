-- Criação transacional de empresa (§16)
-- Inicializa estrutura padrão; se falhar, a transação é revertida.
create or replace function public.create_company_with_defaults(
  p_name text,
  p_trade_name text default null,
  p_document text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company public.companies;
  v_dept_admin uuid;
  v_dept_ops uuid;
  v_cc_geral uuid;
  v_cc_admin uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Nome da empresa é obrigatório';
  end if;

  -- Garante perfil
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

  insert into public.companies (name, trade_name, document)
  values (trim(p_name), nullif(trim(p_trade_name), ''), nullif(trim(p_document), ''))
  returning * into v_company;

  insert into public.company_users (company_id, user_id, role)
  values (v_company.id, v_user_id, 'owner');

  insert into public.company_profiles (company_id)
  values (v_company.id);

  insert into public.company_settings (company_id, settings)
  values (v_company.id, '{"locale":"pt-BR","currency":"BRL"}'::jsonb);

  -- Departamentos padrão
  insert into public.departments (company_id, name, description)
  values (v_company.id, 'Administrativo', 'Áreas administrativas e de suporte')
  returning id into v_dept_admin;

  insert into public.departments (company_id, name, description)
  values (v_company.id, 'Operações', 'Áreas operacionais e de produção')
  returning id into v_dept_ops;

  -- Centros de custo padrão
  insert into public.cost_centers (company_id, name, code)
  values (v_company.id, 'Geral', 'CC-GERAL')
  returning id into v_cc_geral;

  insert into public.cost_centers (company_id, name, code)
  values (v_company.id, 'Administrativo', 'CC-ADM')
  returning id into v_cc_admin;

  insert into public.department_cost_centers (department_id, cost_center_id)
  values
    (v_dept_admin, v_cc_admin),
    (v_dept_admin, v_cc_geral),
    (v_dept_ops, v_cc_geral);

  -- Categorias padrão
  insert into public.categories (company_id, name, category_type)
  values
    (v_company.id, 'Receitas Operacionais', 'revenue'),
    (v_company.id, 'Custos Diretos', 'cost'),
    (v_company.id, 'Despesas Administrativas', 'expense'),
    (v_company.id, 'Despesas Comerciais', 'expense');

  -- Funcionalidades / indicadores / relatórios padrão
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
    jsonb_build_object('name', v_company.name, 'trade_name', v_company.trade_name)
  );

  return v_company;
end;
$$;

revoke all on function public.create_company_with_defaults(text, text, text) from public;
grant execute on function public.create_company_with_defaults(text, text, text) to authenticated;
