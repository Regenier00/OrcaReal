-- Apropriação do realizado por destino + aprendizado por descrição/fornecedor

alter table public.actual_transactions
  add column if not exists destination_id uuid
    references public.budget_destinations (id) on delete set null,
  add column if not exists destination_name text,
  add column if not exists suggested_destination_id uuid
    references public.budget_destinations (id) on delete set null,
  add column if not exists suggested_destination_name text;

alter table public.transaction_classification_memory
  add column if not exists destination_id uuid
    references public.budget_destinations (id) on delete set null,
  add column if not exists destination_name text,
  add column if not exists counterparty_normalized text;

create index if not exists transaction_classification_memory_counterparty_idx
  on public.transaction_classification_memory (company_id, counterparty_normalized)
  where counterparty_normalized is not null and length(trim(counterparty_normalized)) > 0;

-- Padrões explícitos (fornecedor / trecho da descrição) → destino
create table if not exists public.destination_match_patterns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  match_type text not null
    check (match_type in ('counterparty', 'description_contains', 'description_exact')),
  match_value text not null,
  money_group text not null
    check (money_group in ('revenue', 'cost', 'expense', 'investment')),
  destination_id uuid references public.budget_destinations (id) on delete set null,
  destination_name text not null,
  usage_count integer not null default 1,
  last_classified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_match_patterns_value_not_blank
    check (length(trim(match_value)) > 0),
  constraint destination_match_patterns_name_not_blank
    check (length(trim(destination_name)) > 0)
);

create unique index if not exists destination_match_patterns_uidx
  on public.destination_match_patterns (company_id, match_type, lower(trim(match_value)));

create index if not exists destination_match_patterns_company_idx
  on public.destination_match_patterns (company_id);

alter table public.destination_match_patterns enable row level security;

drop policy if exists "destination_match_patterns_all_member" on public.destination_match_patterns;
create policy "destination_match_patterns_all_member"
  on public.destination_match_patterns for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

grant select, insert, update, delete on table public.destination_match_patterns to authenticated;

create or replace function public.normalize_counterparty(value text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.remember_transaction_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desc text;
  v_counterparty text;
  v_destination_id uuid;
  v_destination_name text;
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
     and old.destination_id is not distinct from new.destination_id
     and old.destination_name is not distinct from new.destination_name
     and old.counterparty is not distinct from new.counterparty
  then
    return new;
  end if;

  v_desc := public.normalize_transaction_description(new.description);
  v_counterparty := public.normalize_counterparty(new.counterparty);
  if v_counterparty = '' then
    v_counterparty := null;
  end if;

  v_destination_name := nullif(trim(coalesce(new.destination_name, '')), '');
  v_destination_id := new.destination_id;

  if v_destination_id is null and v_destination_name is not null and new.money_group is not null then
    v_destination_id := public.ensure_budget_destination(
      new.company_id,
      new.money_group,
      v_destination_name
    );
  end if;

  if v_desc <> '' then
    insert into public.transaction_classification_memory (
      company_id,
      description_normalized,
      category_id,
      department_id,
      cost_center_id,
      money_group,
      destination_id,
      destination_name,
      counterparty_normalized,
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
      v_destination_id,
      v_destination_name,
      v_counterparty,
      1,
      now()
    )
    on conflict (company_id, description_normalized)
    do update set
      category_id = excluded.category_id,
      department_id = excluded.department_id,
      cost_center_id = excluded.cost_center_id,
      money_group = excluded.money_group,
      destination_id = excluded.destination_id,
      destination_name = excluded.destination_name,
      counterparty_normalized = coalesce(
        excluded.counterparty_normalized,
        public.transaction_classification_memory.counterparty_normalized
      ),
      usage_count = public.transaction_classification_memory.usage_count + 1,
      last_classified_at = now();
  end if;

  -- Aprende padrão por fornecedor / contraparte
  if v_counterparty is not null
     and new.money_group is not null
     and v_destination_name is not null
  then
    insert into public.destination_match_patterns (
      company_id,
      match_type,
      match_value,
      money_group,
      destination_id,
      destination_name,
      usage_count,
      last_classified_at
    )
    values (
      new.company_id,
      'counterparty',
      v_counterparty,
      new.money_group,
      v_destination_id,
      v_destination_name,
      1,
      now()
    )
    on conflict (company_id, match_type, lower(trim(match_value)))
    do update set
      money_group = excluded.money_group,
      destination_id = excluded.destination_id,
      destination_name = excluded.destination_name,
      usage_count = public.destination_match_patterns.usage_count + 1,
      last_classified_at = now(),
      updated_at = now();
  end if;

  -- Também memoriza a descrição exata como padrão de destino
  if v_desc <> ''
     and new.money_group is not null
     and v_destination_name is not null
  then
    insert into public.destination_match_patterns (
      company_id,
      match_type,
      match_value,
      money_group,
      destination_id,
      destination_name,
      usage_count,
      last_classified_at
    )
    values (
      new.company_id,
      'description_exact',
      v_desc,
      new.money_group,
      v_destination_id,
      v_destination_name,
      1,
      now()
    )
    on conflict (company_id, match_type, lower(trim(match_value)))
    do update set
      money_group = excluded.money_group,
      destination_id = excluded.destination_id,
      destination_name = excluded.destination_name,
      usage_count = public.destination_match_patterns.usage_count + 1,
      last_classified_at = now(),
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists actual_transactions_remember_classification on public.actual_transactions;
create trigger actual_transactions_remember_classification
  after insert or update of status, category_id, department_id, cost_center_id, money_group, destination_id, destination_name, counterparty
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

  -- 1) Histórico por descrição exata (principal referência)
  update public.actual_transactions t
  set
    suggested_category_id = m.category_id,
    suggested_department_id = m.department_id,
    suggested_cost_center_id = m.cost_center_id,
    suggested_money_group = m.money_group,
    suggested_destination_id = m.destination_id,
    suggested_destination_name = m.destination_name,
    suggestion_source = 'history',
    updated_at = now()
  from public.transaction_classification_memory m
  where t.company_id = p_company_id
    and t.id = any (p_transaction_ids)
    and t.status = 'pending'
    and m.company_id = p_company_id
    and m.description_normalized = public.normalize_transaction_description(t.description);

  -- 2) Padrão por fornecedor/contraparte (quando ainda sem sugestão de destino)
  update public.actual_transactions t
  set
    suggested_money_group = coalesce(t.suggested_money_group, p.money_group),
    suggested_destination_id = coalesce(t.suggested_destination_id, p.destination_id),
    suggested_destination_name = coalesce(t.suggested_destination_name, p.destination_name),
    suggestion_source = coalesce(t.suggestion_source, 'history'),
    updated_at = now()
  from public.destination_match_patterns p
  where t.company_id = p_company_id
    and t.id = any (p_transaction_ids)
    and t.status = 'pending'
    and t.suggested_destination_name is null
    and p.company_id = p_company_id
    and p.match_type = 'counterparty'
    and public.normalize_counterparty(t.counterparty) = p.match_value;

  -- 3) Contém trecho aprendido na descrição
  update public.actual_transactions t
  set
    suggested_money_group = coalesce(t.suggested_money_group, p.money_group),
    suggested_destination_id = coalesce(t.suggested_destination_id, p.destination_id),
    suggested_destination_name = coalesce(t.suggested_destination_name, p.destination_name),
    suggestion_source = coalesce(t.suggestion_source, 'rule'),
    updated_at = now()
  from public.destination_match_patterns p
  where t.company_id = p_company_id
    and t.id = any (p_transaction_ids)
    and t.status = 'pending'
    and t.suggested_destination_name is null
    and p.company_id = p_company_id
    and p.match_type = 'description_contains'
    and position(p.match_value in public.normalize_transaction_description(t.description)) > 0;
end;
$$;

drop function if exists public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text, text);

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
  p_destination_name text default null
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

  if v_destination_id is null
     and v_destination_name is not null
     and v_money_group is not null
  then
    v_destination_id := public.ensure_budget_destination(
      p_company_id,
      v_money_group,
      v_destination_name
    );
  elsif v_destination_id is not null then
    select d.name, d.money_group
      into v_destination_name, v_money_group
    from public.budget_destinations d
    where d.id = v_destination_id
      and d.company_id = p_company_id;

    if v_destination_name is null then
      raise exception 'Destino inválido para esta empresa';
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

revoke all on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text, text, uuid, text) from public;
grant execute on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text, text, uuid, text) to authenticated;
