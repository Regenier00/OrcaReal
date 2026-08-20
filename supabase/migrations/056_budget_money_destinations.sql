-- Orçamento por destinação do dinheiro.
-- 4 grupos fixos (Receitas, Custos, Despesas, Investimentos) + destinos personalizados.
-- Departamento e centro de custo deixam de ser obrigatórios.
-- Apropriação do realizado passa a aceitar somente o grupo (money_group).

create table if not exists public.budget_destinations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  money_group text not null
    check (money_group in ('revenue', 'cost', 'expense', 'investment')),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_destinations_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists budget_destinations_company_group_name_uidx
  on public.budget_destinations (company_id, money_group, lower(trim(name)));

create index if not exists budget_destinations_company_id_idx
  on public.budget_destinations (company_id);

alter table public.budget_destinations enable row level security;

drop policy if exists "budget_destinations_all_member" on public.budget_destinations;
create policy "budget_destinations_all_member"
  on public.budget_destinations for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create table if not exists public.budget_group_totals (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  money_group text not null
    check (money_group in ('revenue', 'cost', 'expense', 'investment')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, money_group)
);

create index if not exists budget_group_totals_budget_id_idx
  on public.budget_group_totals (budget_id);

create table if not exists public.budget_group_total_values (
  id uuid primary key default gen_random_uuid(),
  budget_group_total_id uuid not null
    references public.budget_group_totals (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_group_total_id, year, month)
);

create index if not exists budget_group_total_values_total_id_idx
  on public.budget_group_total_values (budget_group_total_id);

alter table public.budget_group_totals enable row level security;
alter table public.budget_group_total_values enable row level security;

drop policy if exists "budget_group_totals_all_member" on public.budget_group_totals;
create policy "budget_group_totals_all_member"
  on public.budget_group_totals for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "budget_group_total_values_all_member" on public.budget_group_total_values;
create policy "budget_group_total_values_all_member"
  on public.budget_group_total_values for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

alter table public.budget_items
  alter column department_id drop not null,
  alter column cost_center_id drop not null;

alter table public.budget_items
  add column if not exists money_group text
    check (money_group is null or money_group in ('revenue', 'cost', 'expense', 'investment')),
  add column if not exists destination_id uuid
    references public.budget_destinations (id) on delete set null,
  add column if not exists destination_name text;

alter table public.budget_items
  drop constraint if exists budget_items_structure_required;

alter table public.budget_items
  add constraint budget_items_structure_required check (
    (
      money_group is not null
      and destination_name is not null
      and length(trim(destination_name)) > 0
    )
    or (department_id is not null and cost_center_id is not null)
  );

drop index if exists public.budget_items_unique_structure;

create unique index budget_items_unique_destination
  on public.budget_items (
    budget_id,
    money_group,
    lower(trim(destination_name))
  )
  where money_group is not null and destination_name is not null;

create unique index budget_items_unique_legacy_structure
  on public.budget_items (
    budget_id,
    coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    department_id,
    cost_center_id,
    coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where money_group is null;

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

  if new.department_id is not null
     and not exists (
       select 1 from public.departments d
       where d.id = new.department_id and d.company_id = new.company_id
     )
  then
    raise exception 'Departamento inválido para esta empresa';
  end if;

  if new.cost_center_id is not null
     and not exists (
       select 1 from public.cost_centers cc
       where cc.id = new.cost_center_id and cc.company_id = new.company_id
     )
  then
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

  if new.destination_id is not null
     and not exists (
       select 1 from public.budget_destinations d
       where d.id = new.destination_id
         and d.company_id = new.company_id
         and d.money_group = new.money_group
     )
  then
    raise exception 'Destino inválido para este grupo orçamentário';
  end if;

  if new.money_group is not null then
    new.destination_name := trim(coalesce(new.destination_name, ''));
    if new.destination_name = '' then
      raise exception 'Informe o nome do destino';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.ensure_budget_destination(
  p_company_id uuid,
  p_money_group text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if p_money_group not in ('revenue', 'cost', 'expense', 'investment') then
    raise exception 'Grupo orçamentário inválido';
  end if;

  if v_name = '' then
    raise exception 'Nome do destino é obrigatório';
  end if;

  select id into v_id
  from public.budget_destinations
  where company_id = p_company_id
    and money_group = p_money_group
    and lower(trim(name)) = lower(v_name)
  limit 1;

  if v_id is not null then
    update public.budget_destinations
    set
      name = v_name,
      is_active = true,
      updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  insert into public.budget_destinations (company_id, money_group, name)
  values (p_company_id, p_money_group, v_name)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ensure_budget_destination(uuid, text, text) from public;
grant execute on function public.ensure_budget_destination(uuid, text, text) to authenticated;

create or replace function public.save_company_budget(
  p_company_id uuid,
  p_budget jsonb,
  p_items jsonb,
  p_groups jsonb default '[]'::jsonb
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
  v_group jsonb;
  v_item_id uuid;
  v_group_id uuid;
  v_destination_id uuid;
  v_value jsonb;
  v_amount numeric(14, 2);
  v_sort integer := 0;
  v_start date;
  v_end date;
  v_name text;
  v_money_group text;
  v_destination_name text;
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

  if p_groups is null then
    p_groups := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_groups) <> 'array' then
    raise exception 'Os totais por grupo são inválidos';
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
    delete from public.budget_group_totals where budget_id = v_budget_id;
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

  for v_group in
    select elem from jsonb_array_elements(p_groups) as t(elem)
  loop
    v_money_group := nullif(trim(coalesce(v_group->>'money_group', '')), '');
    if v_money_group is null
       or v_money_group not in ('revenue', 'cost', 'expense', 'investment')
    then
      raise exception 'Grupo orçamentário inválido nos totais';
    end if;

    insert into public.budget_group_totals (budget_id, company_id, money_group)
    values (v_budget_id, p_company_id, v_money_group)
    returning id into v_group_id;

    for v_value in
      select elem from jsonb_array_elements(coalesce(v_group->'values', '[]'::jsonb)) as t(elem)
    loop
      v_amount := round(coalesce(v_value->>'amount', '0')::numeric, 2);
      if v_amount < 0 then
        raise exception 'Valores negativos não são permitidos';
      end if;

      insert into public.budget_group_total_values (
        budget_group_total_id,
        company_id,
        year,
        month,
        amount
      )
      values (
        v_group_id,
        p_company_id,
        (v_value->>'year')::integer,
        (v_value->>'month')::integer,
        v_amount
      );
    end loop;
  end loop;

  for v_item in
    select elem from jsonb_array_elements(p_items) as t(elem)
  loop
    v_money_group := nullif(trim(coalesce(v_item->>'money_group', '')), '');
    v_destination_name := trim(coalesce(v_item->>'destination_name', ''));
    v_destination_id := nullif(v_item->>'destination_id', '')::uuid;

    if v_money_group is not null then
      if v_money_group not in ('revenue', 'cost', 'expense', 'investment') then
        raise exception 'Grupo orçamentário inválido na linha';
      end if;
      if v_destination_name = '' then
        raise exception 'Informe o destino em todas as linhas do orçamento';
      end if;
      v_destination_id := public.ensure_budget_destination(
        p_company_id,
        v_money_group,
        v_destination_name
      );
    elsif coalesce(v_item->>'department_id', '') = ''
       or coalesce(v_item->>'cost_center_id', '') = ''
    then
      raise exception 'Preencha o grupo e o destino, ou departamento e centro de custo, em todas as linhas';
    end if;

    insert into public.budget_items (
      budget_id,
      company_id,
      business_unit_id,
      department_id,
      cost_center_id,
      activity_id,
      category_id,
      money_group,
      destination_id,
      destination_name,
      sort_order
    )
    values (
      v_budget_id,
      p_company_id,
      nullif(v_item->>'business_unit_id', '')::uuid,
      nullif(v_item->>'department_id', '')::uuid,
      nullif(v_item->>'cost_center_id', '')::uuid,
      nullif(v_item->>'activity_id', '')::uuid,
      nullif(v_item->>'category_id', '')::uuid,
      v_money_group,
      v_destination_id,
      nullif(v_destination_name, ''),
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
      'item_count', jsonb_array_length(p_items),
      'group_count', jsonb_array_length(p_groups)
    )
  );

  return v_budget_id;
exception
  when unique_violation then
    raise exception 'Já existe uma linha com a mesma combinação neste orçamento';
end;
$$;

drop function if exists public.save_company_budget(uuid, jsonb, jsonb);

revoke all on function public.save_company_budget(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_company_budget(uuid, jsonb, jsonb, jsonb) to authenticated;

-- Realizado: apropriação por grupo
alter table public.actual_transactions
  add column if not exists money_group text
    check (money_group is null or money_group in ('revenue', 'cost', 'expense', 'investment')),
  add column if not exists suggested_money_group text
    check (
      suggested_money_group is null
      or suggested_money_group in ('revenue', 'cost', 'expense', 'investment')
    );

alter table public.transaction_classification_memory
  add column if not exists money_group text
    check (money_group is null or money_group in ('revenue', 'cost', 'expense', 'investment'));

create or replace function public.remember_transaction_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desc text;
begin
  if new.status is distinct from 'classified' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'classified'
     and old.category_id is not distinct from new.category_id
     and old.department_id is not distinct from new.department_id
     and old.cost_center_id is not distinct from new.cost_center_id
     and old.money_group is not distinct from new.money_group
  then
    return new;
  end if;

  v_desc := public.normalize_transaction_description(new.description);
  if v_desc = '' then
    return new;
  end if;

  insert into public.transaction_classification_memory (
    company_id,
    description_normalized,
    category_id,
    department_id,
    cost_center_id,
    money_group,
    usage_count,
    last_classified_at
  )
  values (
    new.company_id,
    v_desc,
    new.category_id,
    new.department_id,
    new.cost_center_id,
    new.money_group,
    1,
    now()
  )
  on conflict (company_id, description_normalized)
  do update set
    category_id = excluded.category_id,
    department_id = excluded.department_id,
    cost_center_id = excluded.cost_center_id,
    money_group = excluded.money_group,
    usage_count = public.transaction_classification_memory.usage_count + 1,
    last_classified_at = now();

  return new;
end;
$$;

drop trigger if exists actual_transactions_remember_classification on public.actual_transactions;
create trigger actual_transactions_remember_classification
  after insert or update of status, category_id, department_id, cost_center_id, money_group
  on public.actual_transactions
  for each row execute function public.remember_transaction_classification();

create or replace function public.apply_classification_suggestions(
  p_company_id uuid,
  p_transaction_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  update public.actual_transactions t
  set
    suggested_category_id = m.category_id,
    suggested_department_id = m.department_id,
    suggested_cost_center_id = m.cost_center_id,
    suggested_money_group = m.money_group,
    suggestion_source = 'history',
    updated_at = now()
  from public.transaction_classification_memory m
  where t.company_id = p_company_id
    and t.id = any (p_transaction_ids)
    and t.status = 'pending'
    and m.company_id = p_company_id
    and m.description_normalized = public.normalize_transaction_description(t.description);
end;
$$;

drop function if exists public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text);

create or replace function public.classify_actual_transactions(
  p_company_id uuid,
  p_transaction_ids uuid[],
  p_department_id uuid default null,
  p_category_id uuid default null,
  p_cost_center_id uuid default null,
  p_status text default 'classified',
  p_type text default null,
  p_money_group text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
  v_status text := coalesce(nullif(p_status, ''), 'classified');
  v_type text := nullif(p_type, '');
  v_money_group text := nullif(trim(coalesce(p_money_group, '')), '');
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if v_status not in ('pending', 'classified', 'ignored') then
    raise exception 'Status de classificação inválido';
  end if;

  if v_type = 'transfer' then
    v_type := null;
  end if;

  if v_type is not null and v_type not in ('income', 'expense', 'unknown') then
    raise exception 'Tipo de lançamento inválido';
  end if;

  if v_money_group is not null
     and v_money_group not in ('revenue', 'cost', 'expense', 'investment')
  then
    raise exception 'Grupo orçamentário inválido';
  end if;

  if p_transaction_ids is null or array_length(p_transaction_ids, 1) is null then
    return 0;
  end if;

  if p_department_id is not null
     and not exists (
       select 1 from public.departments d
       where d.id = p_department_id and d.company_id = p_company_id
     )
  then
    raise exception 'Departamento inválido para esta empresa';
  end if;

  if p_category_id is not null
     and not exists (
       select 1 from public.categories c
       where c.id = p_category_id and c.company_id = p_company_id
     )
  then
    raise exception 'Categoria inválida para esta empresa';
  end if;

  if p_cost_center_id is not null
     and not exists (
       select 1 from public.cost_centers cc
       where cc.id = p_cost_center_id and cc.company_id = p_company_id
     )
  then
    raise exception 'Centro de custo inválido para esta empresa';
  end if;

  if v_status = 'classified' then
    update public.actual_transactions
    set
      type = coalesce(v_type, type),
      department_id = coalesce(p_department_id, department_id),
      category_id = coalesce(p_category_id, category_id),
      cost_center_id = coalesce(p_cost_center_id, cost_center_id),
      money_group = coalesce(v_money_group, money_group),
      status = case
        when coalesce(v_type, type) in ('expense', 'income')
             and (
               coalesce(v_money_group, money_group) is not null
               or (
                 coalesce(p_department_id, department_id) is not null
                 and coalesce(p_cost_center_id, cost_center_id) is not null
               )
             )
          then 'classified'
        else 'pending'
      end,
      classified_at = case
        when coalesce(v_type, type) in ('expense', 'income')
             and (
               coalesce(v_money_group, money_group) is not null
               or (
                 coalesce(p_department_id, department_id) is not null
                 and coalesce(p_cost_center_id, cost_center_id) is not null
               )
             )
          then now()
        else null
      end,
      classified_by = v_user_id,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_transaction_ids);
  elsif v_status = 'ignored' then
    update public.actual_transactions
    set
      type = coalesce(v_type, type),
      status = 'ignored',
      classified_at = now(),
      classified_by = v_user_id,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_transaction_ids);
  else
    update public.actual_transactions
    set
      type = coalesce(v_type, type),
      department_id = coalesce(p_department_id, department_id),
      category_id = coalesce(p_category_id, category_id),
      cost_center_id = coalesce(p_cost_center_id, cost_center_id),
      money_group = coalesce(v_money_group, money_group),
      status = 'pending',
      classified_at = null,
      classified_by = null,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_transaction_ids);
  end if;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text, text) from public;
grant execute on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text, text) to authenticated;
