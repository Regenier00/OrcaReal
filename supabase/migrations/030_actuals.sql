-- Realizado vinculado ao orçamento da mesma empresa.
-- A chave analítica é a mesma do orçamento (unidade, departamento, centro de custo).
-- periods continua existindo para fechamento de mês; o realizado guarda o intervalo
-- copiado do orçamento em start_date/end_date.
--
-- Numerada 030 porque 026–029 já cobrem extratos e contas bancárias no remoto.

create table public.actuals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  budget_id uuid not null references public.budgets (id) on delete cascade,
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

create index actuals_company_id_idx on public.actuals (company_id);
create index actuals_budget_id_idx on public.actuals (budget_id);
create unique index actuals_one_active_per_budget
  on public.actuals (budget_id)
  where status <> 'archived';

create table public.actual_items (
  id uuid primary key default gen_random_uuid(),
  actual_id uuid not null references public.actuals (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  business_unit_id uuid references public.business_units (id) on delete restrict,
  department_id uuid not null references public.departments (id) on delete restrict,
  cost_center_id uuid not null references public.cost_centers (id) on delete restrict,
  activity_id uuid references public.activities (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index actual_items_actual_id_idx on public.actual_items (actual_id);
create index actual_items_company_id_idx on public.actual_items (company_id);

create unique index actual_items_unique_structure
  on public.actual_items (
    actual_id,
    coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    department_id,
    cost_center_id,
    coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table public.actual_item_values (
  id uuid primary key default gen_random_uuid(),
  actual_item_id uuid not null references public.actual_items (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actual_item_id, year, month)
);

create index actual_item_values_item_id_idx on public.actual_item_values (actual_item_id);
create index actual_item_values_company_id_idx on public.actual_item_values (company_id);

create or replace function public.validate_actual_scope()
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
    raise exception 'O realizado deve pertencer à mesma empresa do orçamento';
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

  return new;
end;
$$;

create trigger actuals_validate_scope
  before insert or update on public.actuals
  for each row execute function public.validate_actual_scope();

create or replace function public.validate_actual_item_scope()
returns trigger
language plpgsql
as $$
declare
  v_actual_company uuid;
begin
  select company_id into v_actual_company
  from public.actuals
  where id = new.actual_id;

  if v_actual_company is null then
    raise exception 'Realizado não encontrado';
  end if;

  if new.company_id is distinct from v_actual_company then
    raise exception 'A linha do realizado deve pertencer à mesma empresa do realizado';
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

  if new.activity_id is not null
     and not exists (
       select 1 from public.activities a
       where a.id = new.activity_id
     )
  then
    raise exception 'Atividade inválida';
  end if;

  if new.category_id is not null
     and not exists (
       select 1 from public.categories c
       where c.id = new.category_id and c.company_id = new.company_id
     )
  then
    raise exception 'Conta contábil inválida para esta empresa';
  end if;

  return new;
end;
$$;

create trigger actual_items_validate_scope
  before insert or update on public.actual_items
  for each row execute function public.validate_actual_item_scope();

create or replace function public.validate_actual_item_value_scope()
returns trigger
language plpgsql
as $$
declare
  v_item_company uuid;
  v_start date;
  v_end date;
  v_month_date date;
begin
  select i.company_id, a.start_date, a.end_date
    into v_item_company, v_start, v_end
  from public.actual_items i
  join public.actuals a on a.id = i.actual_id
  where i.id = new.actual_item_id;

  if v_item_company is null then
    raise exception 'Linha de realizado não encontrada';
  end if;

  if new.company_id is distinct from v_item_company then
    raise exception 'O valor deve pertencer à mesma empresa da linha';
  end if;

  v_month_date := make_date(new.year, new.month, 1);

  if v_month_date < date_trunc('month', v_start)::date
     or v_month_date > date_trunc('month', v_end)::date
  then
    raise exception 'Mês fora do período do realizado';
  end if;

  return new;
end;
$$;

create trigger actual_item_values_validate_scope
  before insert or update on public.actual_item_values
  for each row execute function public.validate_actual_item_value_scope();

create or replace function public.save_company_actual(
  p_company_id uuid,
  p_actual jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_actual_id uuid;
  v_budget_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_value jsonb;
  v_amount numeric(14, 2);
  v_sort integer := 0;
  v_start date;
  v_end date;
  v_name text;
  v_budget record;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if p_actual is null or jsonb_typeof(p_actual) <> 'object' then
    raise exception 'Dados do realizado inválidos';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'As linhas do realizado são inválidas';
  end if;

  v_budget_id := nullif(p_actual->>'budget_id', '')::uuid;
  if v_budget_id is null then
    raise exception 'Vincule o realizado a um orçamento';
  end if;

  select *
    into v_budget
  from public.budgets
  where id = v_budget_id
    and company_id = p_company_id
    and status <> 'archived';

  if v_budget.id is null then
    raise exception 'Orçamento não encontrado nesta empresa';
  end if;

  v_name := trim(coalesce(p_actual->>'name', ''));
  if v_name = '' then
    raise exception 'Nome do realizado é obrigatório';
  end if;

  v_start := coalesce((p_actual->>'start_date')::date, v_budget.start_date);
  v_end := coalesce((p_actual->>'end_date')::date, v_budget.end_date);

  if v_end < v_start then
    raise exception 'A data final deve ser igual ou posterior à data inicial';
  end if;

  v_actual_id := nullif(p_actual->>'id', '')::uuid;

  if v_actual_id is not null then
    if not exists (
      select 1 from public.actuals a
      where a.id = v_actual_id
        and a.company_id = p_company_id
        and a.budget_id = v_budget_id
    ) then
      raise exception 'Realizado não encontrado';
    end if;

    update public.actuals
    set
      name = v_name,
      fiscal_year = v_budget.fiscal_year,
      period_label = coalesce(nullif(trim(p_actual->>'period_label'), ''), v_budget.period_label),
      period_kind = v_budget.period_kind,
      start_date = v_budget.start_date,
      end_date = v_budget.end_date,
      business_unit_id = v_budget.business_unit_id,
      notes = nullif(trim(p_actual->>'notes'), ''),
      status = coalesce(nullif(p_actual->>'status', ''), 'active'),
      updated_at = now()
    where id = v_actual_id;

    delete from public.actual_items where actual_id = v_actual_id;
  else
    if exists (
      select 1 from public.actuals a
      where a.budget_id = v_budget_id
        and a.company_id = p_company_id
        and a.status <> 'archived'
    ) then
      raise exception 'Já existe um realizado vinculado a este orçamento';
    end if;

    insert into public.actuals (
      company_id,
      budget_id,
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
      v_budget_id,
      v_name,
      v_budget.fiscal_year,
      coalesce(nullif(trim(p_actual->>'period_label'), ''), v_budget.period_label),
      v_budget.period_kind,
      v_budget.start_date,
      v_budget.end_date,
      v_budget.business_unit_id,
      nullif(trim(p_actual->>'notes'), ''),
      coalesce(nullif(p_actual->>'status', ''), 'active'),
      v_user_id
    )
    returning id into v_actual_id;
  end if;

  for v_item in
    select elem from jsonb_array_elements(p_items) as t(elem)
  loop
    if coalesce(v_item->>'department_id', '') = ''
       or coalesce(v_item->>'cost_center_id', '') = ''
    then
      raise exception 'Preencha unidade (quando houver), departamento e centro de custo em todas as linhas';
    end if;

    insert into public.actual_items (
      actual_id,
      company_id,
      business_unit_id,
      department_id,
      cost_center_id,
      activity_id,
      category_id,
      sort_order
    )
    values (
      v_actual_id,
      p_company_id,
      nullif(v_item->>'business_unit_id', '')::uuid,
      (v_item->>'department_id')::uuid,
      (v_item->>'cost_center_id')::uuid,
      nullif(v_item->>'activity_id', '')::uuid,
      nullif(v_item->>'category_id', '')::uuid,
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

      insert into public.actual_item_values (
        actual_item_id,
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
    case when (p_actual->>'id') is null or (p_actual->>'id') = '' then 'create' else 'update' end,
    'actual',
    v_actual_id,
    jsonb_build_object(
      'name', v_name,
      'budget_id', v_budget_id,
      'item_count', jsonb_array_length(p_items)
    )
  );

  return v_actual_id;
exception
  when unique_violation then
    raise exception 'Já existe uma linha com a mesma combinação de estrutura neste realizado';
end;
$$;

revoke all on function public.save_company_actual(uuid, jsonb, jsonb) from public;
grant execute on function public.save_company_actual(uuid, jsonb, jsonb) to authenticated;

grant select, insert, update, delete on public.actuals to authenticated;
grant select, insert, update, delete on public.actual_items to authenticated;
grant select, insert, update, delete on public.actual_item_values to authenticated;

alter table public.actuals enable row level security;
alter table public.actual_items enable row level security;
alter table public.actual_item_values enable row level security;

create policy "actuals_all_member"
  on public.actuals for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "actual_items_all_member"
  on public.actual_items for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "actual_item_values_all_member"
  on public.actual_item_values for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
