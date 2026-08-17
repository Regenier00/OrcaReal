-- Módulo de orçamento.
-- Reutiliza cadastros existentes: departments, cost_centers, activities, categories.
-- categories é a conta contábil da linha (não duplicar plano de contas).
-- business_units não existia e entra como cadastro opcional por empresa.
-- periods (ano/mês aberto/fechado) permanece para o realizado; o orçamento
-- guarda o intervalo em start_date/end_date para aceitar outros exercícios.

create table public.business_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  code text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_units_company_id_idx on public.business_units (company_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  fiscal_year integer not null check (fiscal_year >= 2000 and fiscal_year <= 2100),
  period_label text not null,
  period_kind text not null default 'calendar_year'
    check (period_kind in ('calendar_year', 'custom')),
  start_date date not null,
  end_date date not null,
  business_unit_id uuid references public.business_units (id) on delete set null,
  notes text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index budgets_company_id_idx on public.budgets (company_id);
create index budgets_company_status_idx on public.budgets (company_id, status);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  business_unit_id uuid references public.business_units (id) on delete restrict,
  department_id uuid not null references public.departments (id) on delete restrict,
  cost_center_id uuid not null references public.cost_centers (id) on delete restrict,
  activity_id uuid not null references public.activities (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_items_budget_id_idx on public.budget_items (budget_id);
create index budget_items_company_id_idx on public.budget_items (company_id);

-- NULLs em unique seriam distintos; coalesce evita duplicar a mesma estrutura.
create unique index budget_items_unique_structure
  on public.budget_items (
    budget_id,
    coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    department_id,
    cost_center_id,
    activity_id,
    category_id
  );

create table public.budget_item_values (
  id uuid primary key default gen_random_uuid(),
  budget_item_id uuid not null references public.budget_items (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_item_id, year, month)
);

create index budget_item_values_item_id_idx on public.budget_item_values (budget_item_id);
create index budget_item_values_company_id_idx on public.budget_item_values (company_id);

-- Isolamento: o item só pode apontar para cadastros da mesma empresa do orçamento.
create or replace function public.validate_budget_item_scope()
returns trigger
language plpgsql
as $$
declare
  v_budget_company uuid;
begin
  select company_id into v_budget_company
  from public.budgets
  where id = new.budget_id;

  if v_budget_company is null then
    raise exception 'Orçamento não encontrado';
  end if;

  if new.company_id is distinct from v_budget_company then
    raise exception 'A linha do orçamento deve pertencer à mesma empresa do orçamento';
  end if;

  if new.business_unit_id is not null
     and not exists (
       select 1 from public.business_units bu
       where bu.id = new.business_unit_id
         and bu.company_id = new.company_id
     )
  then
    raise exception 'Unidade de negócio inválida para esta empresa';
  end if;

  if not exists (
    select 1 from public.departments d
    where d.id = new.department_id and d.company_id = new.company_id
  ) then
    raise exception 'Departamento inválido para esta empresa';
  end if;

  if not exists (
    select 1 from public.cost_centers cc
    where cc.id = new.cost_center_id and cc.company_id = new.company_id
  ) then
    raise exception 'Centro de custo inválido para esta empresa';
  end if;

  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.company_id = new.company_id
  ) then
    raise exception 'Conta contábil inválida para esta empresa';
  end if;

  return new;
end;
$$;

create trigger budget_items_validate_scope
  before insert or update on public.budget_items
  for each row execute function public.validate_budget_item_scope();

create or replace function public.validate_budget_item_value_scope()
returns trigger
language plpgsql
as $$
declare
  v_item_company uuid;
  v_start date;
  v_end date;
  v_month_date date;
begin
  select i.company_id, b.start_date, b.end_date
    into v_item_company, v_start, v_end
  from public.budget_items i
  join public.budgets b on b.id = i.budget_id
  where i.id = new.budget_item_id;

  if v_item_company is null then
    raise exception 'Linha de orçamento não encontrada';
  end if;

  if new.company_id is distinct from v_item_company then
    raise exception 'O valor deve pertencer à mesma empresa da linha';
  end if;

  v_month_date := make_date(new.year, new.month, 1);

  if v_month_date < date_trunc('month', v_start)::date
     or v_month_date > date_trunc('month', v_end)::date
  then
    raise exception 'Mês fora do período do orçamento';
  end if;

  return new;
end;
$$;

create trigger budget_item_values_validate_scope
  before insert or update on public.budget_item_values
  for each row execute function public.validate_budget_item_value_scope();

-- Persistência atômica do orçamento + linhas + meses.
create or replace function public.save_company_budget(
  p_company_id uuid,
  p_budget jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_budget_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_value jsonb;
  v_amount numeric(14, 2);
  v_sort integer := 0;
  v_start date;
  v_end date;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if p_budget is null or jsonb_typeof(p_budget) <> 'object' then
    raise exception 'Dados do orçamento inválidos';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'As linhas do orçamento são inválidas';
  end if;

  v_name := trim(coalesce(p_budget->>'name', ''));
  if v_name = '' then
    raise exception 'Nome do orçamento é obrigatório';
  end if;

  v_start := (p_budget->>'start_date')::date;
  v_end := (p_budget->>'end_date')::date;

  if v_start is null or v_end is null then
    raise exception 'Informe a data inicial e a data final';
  end if;

  if v_end < v_start then
    raise exception 'A data final deve ser igual ou posterior à data inicial';
  end if;

  v_budget_id := nullif(p_budget->>'id', '')::uuid;

  if v_budget_id is not null then
    if not exists (
      select 1 from public.budgets b
      where b.id = v_budget_id and b.company_id = p_company_id
    ) then
      raise exception 'Orçamento não encontrado';
    end if;

    update public.budgets
    set
      name = v_name,
      fiscal_year = (p_budget->>'fiscal_year')::integer,
      period_label = coalesce(nullif(trim(p_budget->>'period_label'), ''), v_name),
      period_kind = coalesce(nullif(p_budget->>'period_kind', ''), 'calendar_year'),
      start_date = v_start,
      end_date = v_end,
      business_unit_id = nullif(p_budget->>'business_unit_id', '')::uuid,
      notes = nullif(trim(p_budget->>'notes'), ''),
      status = coalesce(nullif(p_budget->>'status', ''), 'active'),
      updated_at = now()
    where id = v_budget_id;

    delete from public.budget_items where budget_id = v_budget_id;
  else
    insert into public.budgets (
      company_id,
      name,
      fiscal_year,
      period_label,
      period_kind,
      start_date,
      end_date,
      business_unit_id,
      notes,
      status,
      created_by
    )
    values (
      p_company_id,
      v_name,
      (p_budget->>'fiscal_year')::integer,
      coalesce(nullif(trim(p_budget->>'period_label'), ''), v_name),
      coalesce(nullif(p_budget->>'period_kind', ''), 'calendar_year'),
      v_start,
      v_end,
      nullif(p_budget->>'business_unit_id', '')::uuid,
      nullif(trim(p_budget->>'notes'), ''),
      coalesce(nullif(p_budget->>'status', ''), 'active'),
      v_user_id
    )
    returning id into v_budget_id;
  end if;

  for v_item in
    select elem from jsonb_array_elements(p_items) as t(elem)
  loop
    if coalesce(v_item->>'department_id', '') = ''
       or coalesce(v_item->>'cost_center_id', '') = ''
       or coalesce(v_item->>'activity_id', '') = ''
       or coalesce(v_item->>'category_id', '') = ''
    then
      raise exception 'Preencha unidade (quando houver), departamento, centro de custo, atividade e conta contábil em todas as linhas';
    end if;

    insert into public.budget_items (
      budget_id,
      company_id,
      business_unit_id,
      department_id,
      cost_center_id,
      activity_id,
      category_id,
      sort_order
    )
    values (
      v_budget_id,
      p_company_id,
      nullif(v_item->>'business_unit_id', '')::uuid,
      (v_item->>'department_id')::uuid,
      (v_item->>'cost_center_id')::uuid,
      (v_item->>'activity_id')::uuid,
      (v_item->>'category_id')::uuid,
      v_sort
    )
    returning id into v_item_id;

    v_sort := v_sort + 1;

    for v_value in
      select elem from jsonb_array_elements(coalesce(v_item->'values', '[]'::jsonb)) as t(elem)
    loop
      v_amount := round(coalesce(v_value->>'amount', '0')::numeric, 2);
      if v_amount < 0 then
        raise exception 'Valores negativos não são permitidos';
      end if;

      insert into public.budget_item_values (
        budget_item_id,
        company_id,
        year,
        month,
        amount
      )
      values (
        v_item_id,
        p_company_id,
        (v_value->>'year')::integer,
        (v_value->>'month')::integer,
        v_amount
      );
    end loop;
  end loop;

  insert into public.audit_logs (
    company_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    p_company_id,
    v_user_id,
    case when (p_budget->>'id') is null or (p_budget->>'id') = '' then 'create' else 'update' end,
    'budget',
    v_budget_id,
    jsonb_build_object(
      'name', v_name,
      'fiscal_year', p_budget->>'fiscal_year',
      'item_count', jsonb_array_length(p_items)
    )
  );

  return v_budget_id;
exception
  when unique_violation then
    raise exception 'Já existe uma linha com a mesma combinação de estrutura neste orçamento';
end;
$$;

revoke all on function public.save_company_budget(uuid, jsonb, jsonb) from public;
grant execute on function public.save_company_budget(uuid, jsonb, jsonb) to authenticated;

alter table public.business_units enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;
alter table public.budget_item_values enable row level security;

create policy "business_units_all_member"
  on public.business_units for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "budgets_all_member"
  on public.budgets for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "budget_items_all_member"
  on public.budget_items for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "budget_item_values_all_member"
  on public.budget_item_values for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Unidade padrão para empresas novas e já existentes.
insert into public.business_units (company_id, name, code, description)
select c.id, 'Unidade principal', 'UN-PRINCIPAL', 'Unidade padrão da empresa'
from public.companies c
where not exists (
  select 1 from public.business_units bu where bu.company_id = c.id
);

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

  insert into public.business_units (company_id, name, code, description)
  values (v_company.id, 'Unidade principal', 'UN-PRINCIPAL', 'Unidade padrão da empresa');

  insert into public.departments (company_id, name, description)
  values (v_company.id, 'Administrativo', 'Áreas administrativas e de suporte')
  returning id into v_dept_admin;

  insert into public.departments (company_id, name, description)
  values (v_company.id, 'Operações', 'Áreas operacionais e de produção')
  returning id into v_dept_ops;

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
    jsonb_build_object('name', v_company.name, 'trade_name', v_company.trade_name)
  );

  return v_company;
end;
$$;
