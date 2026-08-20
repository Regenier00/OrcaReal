-- Plano de contas / estrutura de classificação financeira por empresa.
-- Contas conhecidas (código exato) são apropriadas automaticamente no import.
-- Prefixo e descrição só sugerem; o usuário confirma. Sem IA.

-- ---------------------------------------------------------------------------
-- Tabela: plano de contas da empresa
-- ---------------------------------------------------------------------------

create table if not exists public.company_chart_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  account_code text not null,
  account_name text,
  match_kind text not null default 'exact'
    check (match_kind in ('exact', 'prefix')),
  money_group text not null
    check (money_group in ('revenue', 'cost', 'expense', 'investment')),
  destination_id uuid references public.budget_destinations (id) on delete set null,
  destination_name text not null,
  department_id uuid references public.departments (id) on delete set null,
  cost_center_id uuid references public.cost_centers (id) on delete set null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_chart_accounts_code_not_blank
    check (length(trim(account_code)) > 0),
  constraint company_chart_accounts_code_len
    check (char_length(account_code) <= 80),
  constraint company_chart_accounts_name_len
    check (account_name is null or char_length(account_name) <= 200),
  constraint company_chart_accounts_destination_not_blank
    check (length(trim(destination_name)) > 0)
);

create unique index if not exists company_chart_accounts_uidx
  on public.company_chart_accounts (
    company_id,
    match_kind,
    lower(trim(account_code))
  );

create index if not exists company_chart_accounts_company_idx
  on public.company_chart_accounts (company_id)
  where is_active;

create index if not exists company_chart_accounts_exact_idx
  on public.company_chart_accounts (company_id, lower(trim(account_code)))
  where is_active and match_kind = 'exact';

create index if not exists company_chart_accounts_prefix_idx
  on public.company_chart_accounts (company_id, priority, account_code)
  where is_active and match_kind = 'prefix';

alter table public.company_chart_accounts enable row level security;

drop policy if exists "company_chart_accounts_select_member"
  on public.company_chart_accounts;
drop policy if exists "company_chart_accounts_insert_writer"
  on public.company_chart_accounts;
drop policy if exists "company_chart_accounts_update_writer"
  on public.company_chart_accounts;
drop policy if exists "company_chart_accounts_delete_writer"
  on public.company_chart_accounts;

create policy "company_chart_accounts_select_member"
  on public.company_chart_accounts for select to authenticated
  using (public.is_company_member(company_id));

create policy "company_chart_accounts_insert_writer"
  on public.company_chart_accounts for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "company_chart_accounts_update_writer"
  on public.company_chart_accounts for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "company_chart_accounts_delete_writer"
  on public.company_chart_accounts for delete to authenticated
  using (public.is_company_writer(company_id));

-- Isolamento de FKs
create or replace function public.company_chart_accounts_enforce_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  if new.destination_id is not null then
    select company_id into v_company
    from public.budget_destinations where id = new.destination_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Destino inválido para esta empresa';
    end if;
  end if;
  if new.department_id is not null then
    select company_id into v_company
    from public.departments where id = new.department_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Departamento inválido para esta empresa';
    end if;
  end if;
  if new.cost_center_id is not null then
    select company_id into v_company
    from public.cost_centers where id = new.cost_center_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Centro de custo inválido para esta empresa';
    end if;
  end if;
  new.account_code := public.sanitize_spreadsheet_text(new.account_code, 80);
  new.account_name := nullif(
    public.sanitize_spreadsheet_text(new.account_name, 200),
    ''
  );
  new.destination_name := public.sanitize_spreadsheet_text(new.destination_name, 200);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_chart_accounts_enforce_company_trg
  on public.company_chart_accounts;
create trigger company_chart_accounts_enforce_company_trg
  before insert or update on public.company_chart_accounts
  for each row execute function public.company_chart_accounts_enforce_company();

-- Ampliar suggestion_source
do $$
begin
  alter table public.erp_entries drop constraint if exists erp_entries_suggestion_source_check;
exception when undefined_object then null;
end $$;

alter table public.erp_entries
  add constraint erp_entries_suggestion_source_check
  check (
    suggestion_source is null
    or suggestion_source in ('rule', 'heuristic', 'history', 'chart', 'prefix')
  );

-- Ampliar match_type das regras com account_prefix (aprendizado)
do $$
begin
  alter table public.erp_classification_rules
    drop constraint if exists erp_classification_rules_match_type_check;
exception when undefined_object then null;
end $$;

alter table public.erp_classification_rules
  add constraint erp_classification_rules_match_type_check
  check (match_type in (
    'account_code',
    'account_prefix',
    'account_name',
    'cost_center',
    'department',
    'description_exact',
    'description_contains'
  ));

-- ---------------------------------------------------------------------------
-- Seed de prefixos típicos (opt-in via RPC)
-- ---------------------------------------------------------------------------

create or replace function public.seed_company_chart_defaults(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
  v_row record;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para configurar o plano de contas';
  end if;

  for v_row in
    select * from (
      values
        ('3', 'prefix', 'revenue', 'Receitas operacionais'),
        ('4.1', 'prefix', 'cost', 'Custos operacionais'),
        ('4.2', 'prefix', 'expense', 'Despesas operacionais'),
        ('4', 'prefix', 'expense', 'Despesas operacionais'),
        ('1.2', 'prefix', 'investment', 'Investimentos'),
        ('1.3', 'prefix', 'investment', 'Investimentos')
    ) as t(account_code, match_kind, money_group, destination_name)
  loop
    insert into public.company_chart_accounts (
      company_id,
      account_code,
      account_name,
      match_kind,
      money_group,
      destination_id,
      destination_name,
      priority,
      created_by
    )
    values (
      p_company_id,
      v_row.account_code,
      case v_row.money_group
        when 'revenue' then 'Grupo Receita (prefixo)'
        when 'cost' then 'Grupo Custo (prefixo)'
        when 'expense' then 'Grupo Despesa (prefixo)'
        else 'Grupo Investimento (prefixo)'
      end,
      v_row.match_kind,
      v_row.money_group,
      public.ensure_budget_destination(
        p_company_id,
        v_row.money_group,
        v_row.destination_name
      ),
      v_row.destination_name,
      case
        when length(v_row.account_code) >= 3 then 10
        when length(v_row.account_code) = 1 then 90
        else 40
      end,
      v_user
    )
    on conflict (company_id, match_kind, lower(trim(account_code)))
    do nothing;
  end loop;

  select count(*)::integer into v_count
  from public.company_chart_accounts
  where company_id = p_company_id
    and is_active;

  return v_count;
end;
$$;

revoke all on function public.seed_company_chart_defaults(uuid) from public;
grant execute on function public.seed_company_chart_defaults(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Upsert de conta no plano (usado na classificação confirmada)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_company_chart_account(
  p_company_id uuid,
  p_account_code text,
  p_account_name text,
  p_match_kind text,
  p_money_group text,
  p_destination_id uuid,
  p_destination_name text,
  p_department_id uuid default null,
  p_cost_center_id uuid default null,
  p_priority integer default 100
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_code text := public.sanitize_spreadsheet_text(p_account_code, 80);
  v_name text := nullif(public.sanitize_spreadsheet_text(p_account_name, 200), '');
  v_kind text := coalesce(nullif(trim(p_match_kind), ''), 'exact');
  v_group text := nullif(trim(p_money_group), '');
  v_dest_name text := nullif(
    public.sanitize_spreadsheet_text(p_destination_name, 200),
    ''
  );
  v_dest_id uuid := p_destination_id;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para configurar o plano de contas';
  end if;
  if v_code = '' then
    raise exception 'Informe o código da conta';
  end if;
  if v_kind not in ('exact', 'prefix') then
    raise exception 'Tipo de correspondência inválido';
  end if;
  if v_group is null or v_group not in ('revenue', 'cost', 'expense', 'investment') then
    raise exception 'Grupo inválido';
  end if;
  if v_dest_name is null and v_dest_id is null then
    raise exception 'Informe o destino da classificação';
  end if;

  if v_dest_id is null then
    v_dest_id := public.ensure_budget_destination(p_company_id, v_group, v_dest_name);
  else
    select d.name, d.money_group
      into v_dest_name, v_group
    from public.budget_destinations d
    where d.id = v_dest_id and d.company_id = p_company_id;
    if v_dest_name is null then
      raise exception 'Destino inválido para esta empresa';
    end if;
  end if;

  insert into public.company_chart_accounts (
    company_id,
    account_code,
    account_name,
    match_kind,
    money_group,
    destination_id,
    destination_name,
    department_id,
    cost_center_id,
    priority,
    created_by
  )
  values (
    p_company_id,
    v_code,
    v_name,
    v_kind,
    v_group,
    v_dest_id,
    v_dest_name,
    p_department_id,
    p_cost_center_id,
    coalesce(p_priority, 100),
    v_user
  )
  on conflict (company_id, match_kind, lower(trim(account_code)))
  do update set
    account_name = coalesce(excluded.account_name, public.company_chart_accounts.account_name),
    money_group = excluded.money_group,
    destination_id = excluded.destination_id,
    destination_name = excluded.destination_name,
    department_id = coalesce(excluded.department_id, public.company_chart_accounts.department_id),
    cost_center_id = coalesce(excluded.cost_center_id, public.company_chart_accounts.cost_center_id),
    priority = excluded.priority,
    is_active = true,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_company_chart_account(
  uuid, text, text, text, text, uuid, text, uuid, uuid, integer
) from public;
grant execute on function public.upsert_company_chart_account(
  uuid, text, text, text, text, uuid, text, uuid, uuid, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Classificação no import: CoA exato → apropria; prefixo → sugere
-- ---------------------------------------------------------------------------

create or replace function public.apply_erp_classification_suggestions(
  p_company_id uuid,
  p_entry_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;
  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para classificar nesta empresa';
  end if;

  -- 1) Conta exata no plano → apropriação automática (sem IA, O(log n) via índice)
  update public.erp_entries e
  set
    money_group = c.money_group,
    destination_id = c.destination_id,
    destination_name = c.destination_name,
    department_id = coalesce(c.department_id, e.department_id),
    cost_center_id = coalesce(c.cost_center_id, e.cost_center_id),
    type = case
      when c.money_group = 'revenue' then 'income'
      else 'expense'
    end,
    status = 'classified',
    classified_at = now(),
    classified_by = v_user,
    suggested_money_group = c.money_group,
    suggested_destination_id = c.destination_id,
    suggested_destination_name = c.destination_name,
    suggested_department_id = coalesce(c.department_id, e.suggested_department_id),
    suggested_cost_center_id = coalesce(c.cost_center_id, e.suggested_cost_center_id),
    suggestion_source = 'chart',
    updated_at = now()
  from public.company_chart_accounts c
  where e.company_id = p_company_id
    and e.id = any (p_entry_ids)
    and e.status = 'pending'
    and c.company_id = p_company_id
    and c.is_active
    and c.match_kind = 'exact'
    and e.account_code is not null
    and lower(trim(e.account_code)) = lower(trim(c.account_code));

  -- 2) Prefixo mais longo do plano → só sugere (usuário confirma)
  update public.erp_entries e
  set
    suggested_money_group = m.money_group,
    suggested_destination_id = m.destination_id,
    suggested_destination_name = m.destination_name,
    suggested_department_id = coalesce(m.department_id, e.suggested_department_id),
    suggested_cost_center_id = coalesce(m.cost_center_id, e.suggested_cost_center_id),
    suggestion_source = 'prefix',
    updated_at = now()
  from (
    select distinct on (e2.id)
      e2.id as entry_id,
      c.money_group,
      c.destination_id,
      c.destination_name,
      c.department_id,
      c.cost_center_id
    from public.erp_entries e2
    inner join public.company_chart_accounts c
      on c.company_id = e2.company_id
     and c.is_active
     and c.match_kind = 'prefix'
     and e2.account_code is not null
     and lower(trim(e2.account_code)) like lower(trim(c.account_code)) || '%'
    where e2.company_id = p_company_id
      and e2.id = any (p_entry_ids)
      and e2.status = 'pending'
      and e2.suggested_money_group is null
    order by
      e2.id,
      length(trim(c.account_code)) desc,
      c.priority asc,
      c.created_at asc
  ) m
  where e.id = m.entry_id
    and e.status = 'pending'
    and e.suggested_money_group is null;

  -- 3) Regras aprendidas: código exato
  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(e.suggested_destination_name, r.destination_name),
    suggested_department_id = coalesce(e.suggested_department_id, r.department_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, r.cost_center_id),
    suggestion_source = coalesce(e.suggestion_source, 'rule'),
    updated_at = now()
  from public.erp_classification_rules r
  where e.company_id = p_company_id
    and e.id = any (p_entry_ids)
    and e.status = 'pending'
    and e.suggested_money_group is null
    and r.company_id = p_company_id
    and r.is_active
    and r.match_type = 'account_code'
    and e.account_code is not null
    and lower(trim(e.account_code)) = lower(trim(r.match_value));

  -- 4) Regras: prefixo de conta (aprendido)
  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, m.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, m.destination_id),
    suggested_destination_name = coalesce(e.suggested_destination_name, m.destination_name),
    suggested_department_id = coalesce(e.suggested_department_id, m.department_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, m.cost_center_id),
    suggestion_source = coalesce(e.suggestion_source, 'prefix'),
    updated_at = now()
  from (
    select distinct on (e2.id)
      e2.id as entry_id,
      r.money_group,
      r.destination_id,
      r.destination_name,
      r.department_id,
      r.cost_center_id
    from public.erp_entries e2
    inner join public.erp_classification_rules r
      on r.company_id = e2.company_id
     and r.is_active
     and r.match_type = 'account_prefix'
     and e2.account_code is not null
     and lower(trim(e2.account_code)) like lower(trim(r.match_value)) || '%'
    where e2.company_id = p_company_id
      and e2.id = any (p_entry_ids)
      and e2.status = 'pending'
      and e2.suggested_money_group is null
    order by
      e2.id,
      length(trim(r.match_value)) desc,
      r.priority asc,
      r.usage_count desc
  ) m
  where e.id = m.entry_id
    and e.status = 'pending'
    and e.suggested_money_group is null;

  -- 5) Nome da conta
  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(e.suggested_destination_name, r.destination_name),
    suggested_department_id = coalesce(e.suggested_department_id, r.department_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, r.cost_center_id),
    suggestion_source = coalesce(e.suggestion_source, 'rule'),
    updated_at = now()
  from public.erp_classification_rules r
  where e.company_id = p_company_id
    and e.id = any (p_entry_ids)
    and e.status = 'pending'
    and e.suggested_destination_name is null
    and r.company_id = p_company_id
    and r.is_active
    and r.match_type = 'account_name'
    and e.account_name is not null
    and lower(trim(e.account_name)) = lower(trim(r.match_value));

  -- 6) Centro de custo
  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(e.suggested_destination_name, r.destination_name),
    suggested_department_id = coalesce(e.suggested_department_id, r.department_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, r.cost_center_id),
    suggestion_source = coalesce(e.suggestion_source, 'rule'),
    updated_at = now()
  from public.erp_classification_rules r
  where e.company_id = p_company_id
    and e.id = any (p_entry_ids)
    and e.status = 'pending'
    and e.suggested_destination_name is null
    and r.company_id = p_company_id
    and r.is_active
    and r.match_type = 'cost_center'
    and (
      (e.cost_center_code is not null and lower(trim(e.cost_center_code)) = lower(trim(r.match_value)))
      or (e.cost_center_name is not null and lower(trim(e.cost_center_name)) = lower(trim(r.match_value)))
    );

  -- 7) Descrição exata
  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(e.suggested_destination_name, r.destination_name),
    suggested_department_id = coalesce(e.suggested_department_id, r.department_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, r.cost_center_id),
    suggestion_source = coalesce(e.suggestion_source, 'history'),
    updated_at = now()
  from public.erp_classification_rules r
  where e.company_id = p_company_id
    and e.id = any (p_entry_ids)
    and e.status = 'pending'
    and e.suggested_destination_name is null
    and r.company_id = p_company_id
    and r.is_active
    and r.match_type = 'description_exact'
    and public.normalize_transaction_description(e.description) = lower(trim(r.match_value));

  -- 8) Descrição contém
  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(e.suggested_destination_name, r.destination_name),
    suggested_department_id = coalesce(e.suggested_department_id, r.department_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, r.cost_center_id),
    suggestion_source = coalesce(e.suggestion_source, 'rule'),
    updated_at = now()
  from public.erp_classification_rules r
  where e.company_id = p_company_id
    and e.id = any (p_entry_ids)
    and e.status = 'pending'
    and e.suggested_destination_name is null
    and r.company_id = p_company_id
    and r.is_active
    and r.match_type = 'description_contains'
    and position(lower(trim(r.match_value)) in public.normalize_transaction_description(e.description)) > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- classify_erp_entries: ao confirmar, grava no plano de contas
-- ---------------------------------------------------------------------------

create or replace function public.classify_erp_entries(
  p_company_id uuid,
  p_entry_ids uuid[],
  p_money_group text default null,
  p_destination_id uuid default null,
  p_destination_name text default null,
  p_department_id uuid default null,
  p_cost_center_id uuid default null,
  p_status text default 'classified',
  p_type text default null,
  p_save_rules boolean default true
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
  v_entry record;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para classificar nesta empresa';
  end if;

  if v_status not in ('pending', 'classified', 'ignored') then
    raise exception 'Status de classificação inválido';
  end if;

  if v_type is not null and v_type not in ('income', 'expense', 'unknown') then
    raise exception 'Tipo de lançamento inválido';
  end if;

  if v_money_group is not null
     and v_money_group not in ('revenue', 'cost', 'expense', 'investment')
  then
    raise exception 'Grupo orçamentário inválido';
  end if;

  if p_entry_ids is null or array_length(p_entry_ids, 1) is null then
    return 0;
  end if;

  if array_length(p_entry_ids, 1) > 500 then
    raise exception 'Selecione no máximo 500 lançamentos por vez';
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
    update public.erp_entries
    set
      type = coalesce(v_type, type),
      department_id = coalesce(p_department_id, department_id),
      cost_center_id = coalesce(p_cost_center_id, cost_center_id),
      money_group = coalesce(v_money_group, money_group),
      destination_id = coalesce(v_destination_id, destination_id),
      destination_name = coalesce(v_destination_name, destination_name),
      status = case
        when coalesce(v_money_group, money_group) is not null then 'classified'
        else status
      end,
      classified_at = case
        when coalesce(v_money_group, money_group) is not null then now()
        else classified_at
      end,
      classified_by = case
        when coalesce(v_money_group, money_group) is not null then v_user_id
        else classified_by
      end,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_entry_ids);

    get diagnostics v_updated = row_count;

    if p_save_rules and v_money_group is not null and v_destination_name is not null then
      for v_entry in
        select *
        from public.erp_entries
        where company_id = p_company_id
          and id = any (p_entry_ids)
          and status = 'classified'
      loop
        if v_entry.account_code is not null and length(trim(v_entry.account_code)) > 0 then
          -- Plano de contas: conta conhecida para próximas importações
          perform public.upsert_company_chart_account(
            p_company_id,
            v_entry.account_code,
            v_entry.account_name,
            'exact',
            v_money_group,
            v_destination_id,
            v_destination_name,
            p_department_id,
            p_cost_center_id,
            100
          );

          insert into public.erp_classification_rules (
            company_id, match_type, match_value, money_group,
            destination_id, destination_name, department_id, cost_center_id,
            created_by, usage_count, last_classified_at
          )
          values (
            p_company_id, 'account_code', lower(trim(v_entry.account_code)), v_money_group,
            v_destination_id, v_destination_name, p_department_id, p_cost_center_id,
            v_user_id, 1, now()
          )
          on conflict (company_id, match_type, lower(trim(match_value)))
          do update set
            money_group = excluded.money_group,
            destination_id = excluded.destination_id,
            destination_name = excluded.destination_name,
            department_id = coalesce(excluded.department_id, public.erp_classification_rules.department_id),
            cost_center_id = coalesce(excluded.cost_center_id, public.erp_classification_rules.cost_center_id),
            usage_count = public.erp_classification_rules.usage_count + 1,
            last_classified_at = now(),
            updated_at = now(),
            is_active = true;
        end if;

        if v_entry.cost_center_code is not null and length(trim(v_entry.cost_center_code)) > 0 then
          insert into public.erp_classification_rules (
            company_id, match_type, match_value, money_group,
            destination_id, destination_name, department_id, cost_center_id,
            created_by, usage_count, last_classified_at
          )
          values (
            p_company_id, 'cost_center', lower(trim(v_entry.cost_center_code)), v_money_group,
            v_destination_id, v_destination_name, p_department_id, p_cost_center_id,
            v_user_id, 1, now()
          )
          on conflict (company_id, match_type, lower(trim(match_value)))
          do update set
            money_group = excluded.money_group,
            destination_id = excluded.destination_id,
            destination_name = excluded.destination_name,
            usage_count = public.erp_classification_rules.usage_count + 1,
            last_classified_at = now(),
            updated_at = now(),
            is_active = true;
        elsif v_entry.cost_center_name is not null and length(trim(v_entry.cost_center_name)) > 0 then
          insert into public.erp_classification_rules (
            company_id, match_type, match_value, money_group,
            destination_id, destination_name, department_id, cost_center_id,
            created_by, usage_count, last_classified_at
          )
          values (
            p_company_id, 'cost_center', lower(trim(v_entry.cost_center_name)), v_money_group,
            v_destination_id, v_destination_name, p_department_id, p_cost_center_id,
            v_user_id, 1, now()
          )
          on conflict (company_id, match_type, lower(trim(match_value)))
          do update set
            money_group = excluded.money_group,
            destination_id = excluded.destination_id,
            destination_name = excluded.destination_name,
            usage_count = public.erp_classification_rules.usage_count + 1,
            last_classified_at = now(),
            updated_at = now(),
            is_active = true;
        end if;

        if length(trim(v_entry.description)) > 0 then
          insert into public.erp_classification_rules (
            company_id, match_type, match_value, money_group,
            destination_id, destination_name, department_id, cost_center_id,
            created_by, usage_count, last_classified_at
          )
          values (
            p_company_id,
            'description_exact',
            public.normalize_transaction_description(v_entry.description),
            v_money_group,
            v_destination_id, v_destination_name, p_department_id, p_cost_center_id,
            v_user_id, 1, now()
          )
          on conflict (company_id, match_type, lower(trim(match_value)))
          do update set
            money_group = excluded.money_group,
            destination_id = excluded.destination_id,
            destination_name = excluded.destination_name,
            usage_count = public.erp_classification_rules.usage_count + 1,
            last_classified_at = now(),
            updated_at = now(),
            is_active = true;
        end if;
      end loop;
    end if;
  elsif v_status = 'ignored' then
    update public.erp_entries
    set
      status = 'ignored',
      classified_at = now(),
      classified_by = v_user_id,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_entry_ids);
    get diagnostics v_updated = row_count;
  else
    update public.erp_entries
    set
      status = 'pending',
      money_group = null,
      destination_id = null,
      destination_name = null,
      classified_at = null,
      classified_by = null,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_entry_ids);
    get diagnostics v_updated = row_count;
  end if;

  perform public.refresh_erp_import_stats(imp.id)
  from (
    select distinct e.import_id as id
    from public.erp_entries e
    where e.company_id = p_company_id
      and e.id = any (p_entry_ids)
      and e.import_id is not null
  ) imp;

  return v_updated;
end;
$$;
