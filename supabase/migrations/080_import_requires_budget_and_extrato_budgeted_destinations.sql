-- 1) Impede importar extrato ou ERP sem orçamento ativo/rascunho.
-- 2) Extrato: apropriação só para destinos/centros já orçados,
--    com opção de incluir destino/centro não orçado no orçamento ativo.

create or replace function public.require_budget_before_import()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.budgets b
    where b.company_id = new.company_id
      and b.status <> 'archived'
  ) then
    raise exception
      'Crie um orçamento antes de importar extrato ou arquivo ERP. Sem orçamento, o realizado não tem destino alinhado e pode ficar perdido.';
  end if;

  return new;
end;
$$;

drop trigger if exists statement_imports_require_budget on public.statement_imports;
create trigger statement_imports_require_budget
  before insert on public.statement_imports
  for each row
  execute function public.require_budget_before_import();

drop trigger if exists erp_imports_require_budget on public.erp_imports;
create trigger erp_imports_require_budget
  before insert on public.erp_imports
  for each row
  execute function public.require_budget_before_import();

revoke all on function public.require_budget_before_import() from public;

-- Destinos que aparecem em orçamentos não arquivados da empresa.
create or replace function public.list_budgeted_destinations(p_company_id uuid)
returns table (
  id uuid,
  company_id uuid,
  money_group text,
  name text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  return query
  select distinct on (d.money_group, lower(trim(d.name)))
    d.id,
    d.company_id,
    d.money_group,
    d.name,
    d.is_active,
    d.created_at,
    d.updated_at
  from public.budget_destinations d
  where d.company_id = p_company_id
    and d.is_active = true
    and exists (
      select 1
      from public.budget_items bi
      join public.budgets b on b.id = bi.budget_id
      where bi.company_id = p_company_id
        and b.status <> 'archived'
        and bi.money_group = d.money_group
        and (
          bi.destination_id = d.id
          or lower(trim(coalesce(bi.destination_name, ''))) = lower(trim(d.name))
        )
    )
  order by d.money_group, lower(trim(d.name)), d.name;
end;
$$;

revoke all on function public.list_budgeted_destinations(uuid) from public;
grant execute on function public.list_budgeted_destinations(uuid) to authenticated;

-- Inclui destino/centro no orçamento ativo mais recente (valores zerados).
create or replace function public.ensure_unbudgeted_destination_for_actual(
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
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_destination_id uuid;
  v_budget_id uuid;
  v_budget_start date;
  v_budget_end date;
  v_item_id uuid;
  v_sort integer;
  v_cursor date;
  v_cc_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if p_money_group not in ('revenue', 'cost', 'expense', 'investment') then
    raise exception 'Grupo orçamentário inválido';
  end if;

  if v_name is null then
    raise exception 'Informe o nome do destino ou centro de custo';
  end if;

  if p_money_group in ('cost', 'expense') then
    select cc.id
      into v_cc_id
    from public.cost_centers cc
    where cc.company_id = p_company_id
      and lower(trim(cc.name)) = lower(v_name)
    limit 1;

    if v_cc_id is null then
      insert into public.cost_centers (company_id, name)
      values (p_company_id, v_name)
      returning id into v_cc_id;
    else
      update public.cost_centers
      set is_active = true, updated_at = now()
      where id = v_cc_id;
      perform public.ensure_cost_center_as_destinations(p_company_id, v_name);
    end if;
  end if;

  v_destination_id := public.ensure_budget_destination(
    p_company_id,
    p_money_group,
    v_name
  );

  select b.id, b.start_date, b.end_date
    into v_budget_id, v_budget_start, v_budget_end
  from public.budgets b
  where b.company_id = p_company_id
    and b.status <> 'archived'
  order by
    case when b.status = 'active' then 0 else 1 end,
    b.fiscal_year desc,
    b.created_at desc
  limit 1;

  if v_budget_id is null then
    raise exception
      'Crie um orçamento antes de apropriar lançamentos do extrato.';
  end if;

  if exists (
    select 1
    from public.budget_items bi
    where bi.budget_id = v_budget_id
      and bi.money_group = p_money_group
      and (
        bi.destination_id = v_destination_id
        or lower(trim(coalesce(bi.destination_name, ''))) = lower(v_name)
      )
  ) then
    return v_destination_id;
  end if;

  select coalesce(max(bi.sort_order), -1) + 1
    into v_sort
  from public.budget_items bi
  where bi.budget_id = v_budget_id;

  insert into public.budget_items (
    budget_id,
    company_id,
    cost_center_id,
    money_group,
    destination_id,
    destination_name,
    sort_order
  )
  values (
    v_budget_id,
    p_company_id,
    v_cc_id,
    p_money_group,
    v_destination_id,
    v_name,
    v_sort
  )
  returning id into v_item_id;

  v_cursor := date_trunc('month', v_budget_start)::date;
  while v_cursor <= v_budget_end loop
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
      extract(year from v_cursor)::integer,
      extract(month from v_cursor)::integer,
      0
    );
    v_cursor := (v_cursor + interval '1 month')::date;
  end loop;

  return v_destination_id;
end;
$$;

revoke all on function public.ensure_unbudgeted_destination_for_actual(uuid, text, text) from public;
grant execute on function public.ensure_unbudgeted_destination_for_actual(uuid, text, text) to authenticated;

create or replace function public.destination_is_on_budget(
  p_company_id uuid,
  p_money_group text,
  p_destination_id uuid,
  p_destination_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.budget_items bi
    join public.budgets b on b.id = bi.budget_id
    where bi.company_id = p_company_id
      and b.status <> 'archived'
      and bi.money_group = p_money_group
      and (
        (p_destination_id is not null and bi.destination_id = p_destination_id)
        or (
          nullif(trim(coalesce(p_destination_name, '')), '') is not null
          and lower(trim(coalesce(bi.destination_name, ''))) =
              lower(trim(p_destination_name))
        )
      )
  );
$$;

revoke all on function public.destination_is_on_budget(uuid, text, uuid, text) from public;

drop function if exists public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text, text, uuid, text);

create or replace function public.classify_actual_transactions(
  p_company_id uuid,
  p_transaction_ids uuid[],
  p_department_id uuid default null,
  p_category_id uuid default null,
  p_cost_center_id uuid default null,
  p_status text default 'classified',
  p_type text default null,
  p_money_group text default null,
  p_destination_id uuid default null,
  p_destination_name text default null,
  p_include_unbudgeted boolean default false
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
  v_destination_name text := nullif(trim(coalesce(p_destination_name, '')), '');
  v_destination_id uuid := p_destination_id;
  v_include_unbudgeted boolean := coalesce(p_include_unbudgeted, false);
  v_cc_name text;
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

  if v_destination_id is not null then
    select d.name, d.money_group
      into v_destination_name, v_money_group
    from public.budget_destinations d
    where d.id = v_destination_id
      and d.company_id = p_company_id;

    if v_destination_name is null then
      raise exception 'Destino inválido para esta empresa';
    end if;
  elsif v_destination_name is not null and v_money_group is not null then
    if v_include_unbudgeted then
      v_destination_id := public.ensure_unbudgeted_destination_for_actual(
        p_company_id,
        v_money_group,
        v_destination_name
      );
      select d.name into v_destination_name
      from public.budget_destinations d
      where d.id = v_destination_id;
    elsif v_money_group in ('cost', 'expense') then
      select d.id, d.name
        into v_destination_id, v_destination_name
      from public.budget_destinations d
      where d.company_id = p_company_id
        and d.money_group = v_money_group
        and lower(trim(d.name)) = lower(trim(v_destination_name))
      limit 1;

      if v_destination_id is null then
        select cc.name
          into v_cc_name
        from public.cost_centers cc
        where cc.company_id = p_company_id
          and cc.is_active = true
          and lower(trim(cc.name)) = lower(trim(v_destination_name))
        limit 1;

        if v_cc_name is null then
          raise exception
            'Para custos e despesas, escolha um centro de custo já orçado ou marque a opção de incluir um centro não orçado.';
        end if;

        v_destination_id := public.ensure_budget_destination(
          p_company_id,
          v_money_group,
          v_cc_name
        );
        v_destination_name := v_cc_name;
      end if;
    else
      select d.id, d.name
        into v_destination_id, v_destination_name
      from public.budget_destinations d
      where d.company_id = p_company_id
        and d.money_group = v_money_group
        and lower(trim(d.name)) = lower(trim(v_destination_name))
      limit 1;

      if v_destination_id is null then
        raise exception
          'Escolha um destino já orçado ou marque a opção de incluir um destino não orçado.';
      end if;
    end if;
  end if;

  if v_status = 'classified'
     and v_money_group is not null
     and (v_destination_id is not null or v_destination_name is not null)
     and not public.destination_is_on_budget(
       p_company_id,
       v_money_group,
       v_destination_id,
       v_destination_name
     )
  then
    if v_include_unbudgeted and v_destination_name is not null then
      v_destination_id := public.ensure_unbudgeted_destination_for_actual(
        p_company_id,
        v_money_group,
        v_destination_name
      );
      select d.name into v_destination_name
      from public.budget_destinations d
      where d.id = v_destination_id;
    else
      raise exception
        'Apropriação do extrato só pode usar destinos e centros de custo já incluídos no orçamento. Marque a opção de incluir se for algo não orçado.';
    end if;
  end if;

  if v_status = 'classified' then
    update public.actual_transactions
    set
      type = coalesce(v_type, type),
      department_id = coalesce(p_department_id, department_id),
      category_id = coalesce(p_category_id, category_id),
      cost_center_id = coalesce(p_cost_center_id, cost_center_id),
      money_group = coalesce(v_money_group, money_group),
      destination_id = coalesce(v_destination_id, destination_id),
      destination_name = coalesce(v_destination_name, destination_name),
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
      status = 'ignored',
      classified_at = null,
      classified_by = v_user_id,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_transaction_ids);
  else
    update public.actual_transactions
    set
      type = coalesce(v_type, type),
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

revoke all on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text, text, uuid, text, boolean) from public;
grant execute on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text, text, uuid, text, boolean) to authenticated;
