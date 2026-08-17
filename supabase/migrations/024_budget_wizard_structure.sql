-- Wizard de orçamento: departamentos padrão nas empresas já existentes
-- e atividade/conta contábil deixam de ser obrigatórios na linha.

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
        ('Administração Geral'::text, 'Administrativo'::text, array['Administrativo']::text[]),
        ('Gestão Financeira', 'Financeiro', array['Financeiro']),
        ('Contabilidade', 'Contabilidade', '{}'::text[]),
        ('Recursos Humanos', 'Recursos Humanos', array['RH']),
        ('Vendas e Comercial', 'Comercial / Vendas', array['Comercial', 'Vendas', 'Comercial / Vendas']),
        ('Marketing', 'Marketing', '{}'::text[]),
        ('Compras', 'Compras', '{}'::text[]),
        ('Estoque e Almoxarifado', 'Estoque / Almoxarifado', array['Estoque', 'Almoxarifado', 'Estoque / Almoxarifado']),
        ('Operações e Produção', 'Operacional / Produção', array['Operações', 'Operacional', 'Produção']),
        ('Logística e Distribuição', 'Logística', array['Logística'])
    ) as t(dept_name, dept_description, aliases)
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
        description = coalesce(nullif(trim(description), ''), r.dept_description),
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
        description = r.dept_description,
        is_active = true,
        updated_at = now()
      where id = v_id;
      continue;
    end if;

    insert into public.departments (company_id, name, description)
    values (p_company_id, r.dept_name, r.dept_description);
  end loop;
end;
$$;

revoke all on function public.ensure_company_default_departments(uuid) from public;
grant execute on function public.ensure_company_default_departments(uuid) to authenticated;

do $$
declare
  v_company_id uuid;
begin
  for v_company_id in select id from public.companies loop
    perform public.ensure_company_default_departments(v_company_id);
  end loop;
end;
$$;

alter table public.budget_items
  alter column activity_id drop not null,
  alter column category_id drop not null;

drop index if exists public.budget_items_unique_structure;

create unique index budget_items_unique_structure
  on public.budget_items (
    budget_id,
    coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    department_id,
    cost_center_id,
    coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

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
    then
      raise exception 'Preencha unidade (quando houver), departamento e centro de custo em todas as linhas';
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
