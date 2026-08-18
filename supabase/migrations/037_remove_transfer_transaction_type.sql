-- Remove o tipo "transferência": TED/DOC/PIX passam a ser entrada ou saída.
-- Lançamentos transferidos sem departamento/centro voltam para não apropriados.

create or replace function public.actual_type_from_transfer(p_description text)
returns text
language sql
immutable
as $$
  select case
    when p_description ~* '(recebid|credit|entrada|deposit|resgate)' then 'income'
    else 'expense'
  end;
$$;

update public.actual_transactions
set
  status = 'pending',
  classified_at = null,
  classified_by = null,
  updated_at = now()
where type = 'transfer'
  and status = 'classified'
  and (department_id is null or cost_center_id is null);

update public.actual_transactions
set
  type = public.actual_type_from_transfer(description),
  fingerprint = public.actual_transaction_fingerprint(
    company_id,
    bank_account_id,
    posted_at,
    amount,
    public.actual_type_from_transfer(description),
    description,
    external_id
  ),
  updated_at = now()
where type = 'transfer'
  and not exists (
    select 1
    from public.actual_transactions other
    where other.company_id = actual_transactions.company_id
      and other.id <> actual_transactions.id
      and other.fingerprint = public.actual_transaction_fingerprint(
        actual_transactions.company_id,
        actual_transactions.bank_account_id,
        actual_transactions.posted_at,
        actual_transactions.amount,
        public.actual_type_from_transfer(actual_transactions.description),
        actual_transactions.description,
        actual_transactions.external_id
      )
  );

update public.actual_transactions
set
  type = public.actual_type_from_transfer(description),
  updated_at = now()
where type = 'transfer';

do $$
declare
  v_import_id uuid;
begin
  for v_import_id in
    select distinct import_id
    from public.actual_transactions
    where import_id is not null
  loop
    perform public.refresh_statement_import_stats(v_import_id);
  end loop;
end;
$$;

create or replace function public.actual_transactions_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'transfer' then
    new.type := public.actual_type_from_transfer(new.description);
    new.fingerprint := public.actual_transaction_fingerprint(
      new.company_id,
      new.bank_account_id,
      new.posted_at,
      new.amount,
      new.type,
      new.description,
      new.external_id
    );
  end if;

  if new.company_id is distinct from (
    select company_id from public.bank_accounts where id = new.bank_account_id
  ) then
    raise exception 'A conta bancária deve pertencer à mesma empresa da transação';
  end if;

  if new.import_id is not null
     and new.company_id is distinct from (
       select company_id from public.statement_imports where id = new.import_id
     )
  then
    raise exception 'A importação deve pertencer à mesma empresa da transação';
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

  if new.category_id is not null
     and not exists (
       select 1 from public.categories c
       where c.id = new.category_id and c.company_id = new.company_id
     )
  then
    raise exception 'Categoria inválida para esta empresa';
  end if;

  if coalesce(new.fingerprint, '') = '' then
    new.fingerprint := public.actual_transaction_fingerprint(
      new.company_id,
      new.bank_account_id,
      new.posted_at,
      new.amount,
      new.type,
      new.description,
      new.external_id
    );
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.classify_actual_transactions(
  p_company_id uuid,
  p_transaction_ids uuid[],
  p_department_id uuid default null,
  p_category_id uuid default null,
  p_cost_center_id uuid default null,
  p_status text default 'classified',
  p_type text default null
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
      status = case
        when coalesce(v_type, type) in ('expense', 'income')
             and coalesce(p_department_id, department_id) is not null
             and coalesce(p_cost_center_id, cost_center_id) is not null
          then 'classified'
        else 'pending'
      end,
      classified_at = case
        when coalesce(v_type, type) in ('expense', 'income')
             and coalesce(p_department_id, department_id) is not null
             and coalesce(p_cost_center_id, cost_center_id) is not null
          then now()
        else null
      end,
      classified_by = v_user_id,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_transaction_ids)
      and status <> 'ignored';
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

revoke all on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text) from public;
grant execute on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text) to authenticated;

alter table public.actual_transactions
  drop constraint if exists actual_transactions_type_check;

alter table public.actual_transactions
  add constraint actual_transactions_type_check
  check (type in ('income', 'expense', 'unknown'));
