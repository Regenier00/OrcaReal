-- 1) Realizado por orçamento: actual_items passa a aceitar grupo/destino
--    (espelha budget_items). Corrige o select do app que já pedia money_group/
--    destination_* e falhava com "Não foi possível carregar o realizado
--    vinculado a este orçamento."
-- 2) Exclusão de extrato: remove TODOS os lançamentos do import (pending,
--    classified/apropriados e ignored), só para admin da empresa, com RLS
--    explícita e policies seguras.

-- ---------------------------------------------------------------------------
-- actual_items: destinos + estrutura flexível
-- ---------------------------------------------------------------------------

alter table public.actual_items
  alter column department_id drop not null,
  alter column cost_center_id drop not null;

alter table public.actual_items
  add column if not exists money_group text
    check (money_group is null or money_group in ('revenue', 'cost', 'expense', 'investment')),
  add column if not exists destination_id uuid
    references public.budget_destinations (id) on delete set null,
  add column if not exists destination_name text;

alter table public.actual_items
  drop constraint if exists actual_items_structure_required;

alter table public.actual_items
  add constraint actual_items_structure_required check (
    (
      money_group is not null
      and destination_name is not null
      and length(trim(destination_name)) > 0
    )
    or (department_id is not null and cost_center_id is not null)
  );

drop index if exists public.actual_items_unique_structure;

create unique index if not exists actual_items_unique_destination
  on public.actual_items (
    actual_id,
    money_group,
    lower(trim(destination_name))
  )
  where money_group is not null and destination_name is not null;

create unique index if not exists actual_items_unique_legacy_structure
  on public.actual_items (
    actual_id,
    coalesce(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    department_id,
    cost_center_id,
    coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where money_group is null;

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
  v_money_group text;
  v_destination_id uuid;
  v_destination_name text;
  v_department_id uuid;
  v_cost_center_id uuid;
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
    v_money_group := nullif(trim(coalesce(v_item->>'money_group', '')), '');
    v_destination_name := trim(coalesce(v_item->>'destination_name', ''));
    v_destination_id := nullif(v_item->>'destination_id', '')::uuid;
    v_department_id := nullif(v_item->>'department_id', '')::uuid;
    v_cost_center_id := nullif(v_item->>'cost_center_id', '')::uuid;

    if v_money_group is not null then
      if v_money_group not in ('revenue', 'cost', 'expense', 'investment') then
        raise exception 'Grupo orçamentário inválido';
      end if;
      if v_destination_name = '' then
        raise exception 'Informe o destino em todas as linhas do realizado';
      end if;
      v_destination_id := public.ensure_budget_destination(
        p_company_id,
        v_money_group,
        v_destination_name
      );
    elsif v_department_id is null or v_cost_center_id is null then
      raise exception 'Preencha grupo/destino ou departamento e centro de custo em todas as linhas';
    end if;

    insert into public.actual_items (
      actual_id,
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
      v_actual_id,
      p_company_id,
      nullif(v_item->>'business_unit_id', '')::uuid,
      v_department_id,
      v_cost_center_id,
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
    raise exception 'Já existe uma linha com a mesma combinação neste realizado';
end;
$$;

revoke all on function public.save_company_actual(uuid, jsonb, jsonb) from public;
grant execute on function public.save_company_actual(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Exclusão de extrato: todos os lançamentos (inclusive apropriados)
-- ---------------------------------------------------------------------------

create or replace function public.delete_statement_import(
  p_company_id uuid,
  p_import_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_path text;
  v_deleted_tx integer := 0;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_company_id is null or p_import_id is null then
    raise exception 'Importação não informada';
  end if;

  -- Membership + admin: defesa em profundidade (RPC não depende só de RLS)
  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if not public.is_company_admin(p_company_id) then
    raise exception 'Apenas administradores da empresa podem excluir extratos importados';
  end if;

  select file_path
    into v_file_path
  from public.statement_imports
  where id = p_import_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Importação não encontrada';
  end if;

  -- Remove pendentes, apropriados (classified) e ignorados do extrato.
  -- Sem filtro de status: a exclusão do extrato desfaz toda a importação.
  delete from public.actual_transactions
  where company_id = p_company_id
    and import_id = p_import_id;

  get diagnostics v_deleted_tx = row_count;

  delete from public.statement_imports
  where id = p_import_id
    and company_id = p_company_id;

  if not found then
    raise exception 'Importação não encontrada';
  end if;

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
    'delete',
    'statement_import',
    p_import_id,
    jsonb_build_object(
      'deleted_transactions', v_deleted_tx,
      'file_path', v_file_path
    )
  );

  if coalesce(v_file_path, '') <> '' then
    begin
      delete from storage.objects
      where bucket_id = 'statement-imports'
        and name = v_file_path;
    exception
      when others then
        null;
    end;
  end if;
end;
$$;

revoke all on function public.delete_statement_import(uuid, uuid) from public;
grant execute on function public.delete_statement_import(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS / policies: membros leem e gravam; só admin exclui extrato/lançamentos
-- ---------------------------------------------------------------------------

alter table public.statement_imports enable row level security;
alter table public.actual_transactions enable row level security;
alter table public.actuals enable row level security;
alter table public.actual_items enable row level security;
alter table public.actual_item_values enable row level security;

drop policy if exists "statement_imports_all_member" on public.statement_imports;
drop policy if exists "statement_imports_select_member" on public.statement_imports;
drop policy if exists "statement_imports_insert_member" on public.statement_imports;
drop policy if exists "statement_imports_update_member" on public.statement_imports;
drop policy if exists "statement_imports_delete_admin" on public.statement_imports;

create policy "statement_imports_select_member"
  on public.statement_imports for select to authenticated
  using (public.is_company_member(company_id));

create policy "statement_imports_insert_member"
  on public.statement_imports for insert to authenticated
  with check (public.is_company_member(company_id));

create policy "statement_imports_update_member"
  on public.statement_imports for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "statement_imports_delete_admin"
  on public.statement_imports for delete to authenticated
  using (public.is_company_admin(company_id));

drop policy if exists "actual_transactions_all_member" on public.actual_transactions;
drop policy if exists "actual_transactions_select_member" on public.actual_transactions;
drop policy if exists "actual_transactions_insert_member" on public.actual_transactions;
drop policy if exists "actual_transactions_update_member" on public.actual_transactions;
drop policy if exists "actual_transactions_delete_admin" on public.actual_transactions;
drop policy if exists "actual_transactions_delete_member" on public.actual_transactions;

create policy "actual_transactions_select_member"
  on public.actual_transactions for select to authenticated
  using (public.is_company_member(company_id));

create policy "actual_transactions_insert_member"
  on public.actual_transactions for insert to authenticated
  with check (public.is_company_member(company_id));

create policy "actual_transactions_update_member"
  on public.actual_transactions for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Exclusão direta de lançamentos (fallback do app) só para admin.
-- Apropriados (classified) não têm proteção especial: o extrato inteiro pode
-- ser desfeito pelo administrador via RPC ou via esta policy.
create policy "actual_transactions_delete_admin"
  on public.actual_transactions for delete to authenticated
  using (public.is_company_admin(company_id));

drop policy if exists "actuals_all_member" on public.actuals;
create policy "actuals_all_member"
  on public.actuals for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "actual_items_all_member" on public.actual_items;
create policy "actual_items_all_member"
  on public.actual_items for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "actual_item_values_all_member" on public.actual_item_values;
create policy "actual_item_values_all_member"
  on public.actual_item_values for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "statement_imports_storage_delete_member" on storage.objects;
drop policy if exists "statement_imports_storage_delete_admin" on storage.objects;
create policy "statement_imports_storage_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'statement-imports'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );

notify pgrst, 'reload schema';
