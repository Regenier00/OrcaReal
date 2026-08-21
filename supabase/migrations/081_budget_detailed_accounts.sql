-- Orçamento detalhado por conta contábil (opcional).
-- Catálogo da empresa (plano de contas) + linhas filhas em budget_items.
-- Regras de negócio (soma = total do destino, import, comparação) ficam no Postgres.
-- Orçamento básico continua válido sem plano de contas / sem detalhamento.

-- ---------------------------------------------------------------------------
-- Catálogo: plano de contas da empresa (número + descrição)
-- ---------------------------------------------------------------------------

create table if not exists public.company_ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  account_code text not null,
  account_name text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_ledger_accounts_code_not_blank
    check (length(trim(account_code)) > 0),
  constraint company_ledger_accounts_code_len
    check (char_length(account_code) <= 80),
  constraint company_ledger_accounts_name_not_blank
    check (length(trim(account_name)) > 0),
  constraint company_ledger_accounts_name_len
    check (char_length(account_name) <= 200)
);

create unique index if not exists company_ledger_accounts_uidx
  on public.company_ledger_accounts (company_id, lower(trim(account_code)));

create index if not exists company_ledger_accounts_company_idx
  on public.company_ledger_accounts (company_id)
  where is_active;

alter table public.company_ledger_accounts enable row level security;

drop policy if exists "company_ledger_accounts_select_member"
  on public.company_ledger_accounts;
drop policy if exists "company_ledger_accounts_insert_writer"
  on public.company_ledger_accounts;
drop policy if exists "company_ledger_accounts_update_writer"
  on public.company_ledger_accounts;
drop policy if exists "company_ledger_accounts_delete_writer"
  on public.company_ledger_accounts;

create policy "company_ledger_accounts_select_member"
  on public.company_ledger_accounts for select to authenticated
  using (public.is_company_member(company_id));

create policy "company_ledger_accounts_insert_writer"
  on public.company_ledger_accounts for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "company_ledger_accounts_update_writer"
  on public.company_ledger_accounts for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "company_ledger_accounts_delete_writer"
  on public.company_ledger_accounts for delete to authenticated
  using (public.is_company_writer(company_id));

create or replace function public.company_ledger_accounts_sanitize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.account_code := public.sanitize_spreadsheet_text(new.account_code, 80);
  new.account_name := public.sanitize_spreadsheet_text(new.account_name, 200);
  if new.account_code = '' then
    raise exception 'Informe o número da conta contábil';
  end if;
  if new.account_name = '' then
    raise exception 'Informe a descrição da conta contábil';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_ledger_accounts_sanitize_trg
  on public.company_ledger_accounts;
create trigger company_ledger_accounts_sanitize_trg
  before insert or update on public.company_ledger_accounts
  for each row execute function public.company_ledger_accounts_sanitize();

revoke all on function public.company_ledger_accounts_sanitize() from public;

-- ---------------------------------------------------------------------------
-- Auditoria de importação do plano de contas
-- ---------------------------------------------------------------------------

create table if not exists public.ledger_account_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  file_name text not null,
  file_path text,
  file_size integer,
  file_type text not null default 'xlsx'
    check (file_type in ('xlsx', 'csv')),
  mime_type text,
  file_hash text,
  detected_layout jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in (
      'pending',
      'validating',
      'parsing',
      'importing',
      'completed',
      'failed'
    )),
  row_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint ledger_account_imports_file_name_len
    check (char_length(file_name) <= 240),
  constraint ledger_account_imports_file_size_max
    check (file_size is null or (file_size > 0 and file_size <= 5242880))
);

create index if not exists ledger_account_imports_company_id_idx
  on public.ledger_account_imports (company_id, created_at desc);

alter table public.ledger_account_imports enable row level security;

drop policy if exists "ledger_account_imports_select_member"
  on public.ledger_account_imports;
drop policy if exists "ledger_account_imports_insert_writer"
  on public.ledger_account_imports;
drop policy if exists "ledger_account_imports_update_writer"
  on public.ledger_account_imports;
drop policy if exists "ledger_account_imports_delete_writer"
  on public.ledger_account_imports;

create policy "ledger_account_imports_select_member"
  on public.ledger_account_imports for select to authenticated
  using (public.is_company_member(company_id));

create policy "ledger_account_imports_insert_writer"
  on public.ledger_account_imports for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "ledger_account_imports_update_writer"
  on public.ledger_account_imports for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "ledger_account_imports_delete_writer"
  on public.ledger_account_imports for delete to authenticated
  using (public.is_company_writer(company_id));

-- ---------------------------------------------------------------------------
-- Detalhamento do orçamento por conta (filho de budget_items)
-- ---------------------------------------------------------------------------

alter table public.budget_items
  add column if not exists is_detailed boolean not null default false;

create table if not exists public.budget_item_accounts (
  id uuid primary key default gen_random_uuid(),
  budget_item_id uuid not null references public.budget_items (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  ledger_account_id uuid references public.company_ledger_accounts (id) on delete set null,
  account_code text not null,
  account_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_item_accounts_code_not_blank
    check (length(trim(account_code)) > 0),
  constraint budget_item_accounts_code_len
    check (char_length(account_code) <= 80),
  constraint budget_item_accounts_name_not_blank
    check (length(trim(account_name)) > 0),
  constraint budget_item_accounts_name_len
    check (char_length(account_name) <= 200)
);

create unique index if not exists budget_item_accounts_uidx
  on public.budget_item_accounts (budget_item_id, lower(trim(account_code)));

create index if not exists budget_item_accounts_item_idx
  on public.budget_item_accounts (budget_item_id);

create index if not exists budget_item_accounts_company_idx
  on public.budget_item_accounts (company_id);

create table if not exists public.budget_item_account_values (
  id uuid primary key default gen_random_uuid(),
  budget_item_account_id uuid not null
    references public.budget_item_accounts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_item_account_id, year, month)
);

create index if not exists budget_item_account_values_account_idx
  on public.budget_item_account_values (budget_item_account_id);

alter table public.budget_item_accounts enable row level security;
alter table public.budget_item_account_values enable row level security;

drop policy if exists "budget_item_accounts_select_member"
  on public.budget_item_accounts;
drop policy if exists "budget_item_accounts_insert_writer"
  on public.budget_item_accounts;
drop policy if exists "budget_item_accounts_update_writer"
  on public.budget_item_accounts;
drop policy if exists "budget_item_accounts_delete_writer"
  on public.budget_item_accounts;

create policy "budget_item_accounts_select_member"
  on public.budget_item_accounts for select to authenticated
  using (public.is_company_member(company_id));

create policy "budget_item_accounts_insert_writer"
  on public.budget_item_accounts for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "budget_item_accounts_update_writer"
  on public.budget_item_accounts for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "budget_item_accounts_delete_writer"
  on public.budget_item_accounts for delete to authenticated
  using (public.is_company_writer(company_id));

drop policy if exists "budget_item_account_values_select_member"
  on public.budget_item_account_values;
drop policy if exists "budget_item_account_values_insert_writer"
  on public.budget_item_account_values;
drop policy if exists "budget_item_account_values_update_writer"
  on public.budget_item_account_values;
drop policy if exists "budget_item_account_values_delete_writer"
  on public.budget_item_account_values;

create policy "budget_item_account_values_select_member"
  on public.budget_item_account_values for select to authenticated
  using (public.is_company_member(company_id));

create policy "budget_item_account_values_insert_writer"
  on public.budget_item_account_values for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "budget_item_account_values_update_writer"
  on public.budget_item_account_values for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "budget_item_account_values_delete_writer"
  on public.budget_item_account_values for delete to authenticated
  using (public.is_company_writer(company_id));

-- Isolamento de empresa / sanitização nas linhas detalhadas
create or replace function public.budget_item_accounts_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_company uuid;
  v_ledger_company uuid;
begin
  select company_id into v_item_company
  from public.budget_items
  where id = new.budget_item_id;

  if v_item_company is null then
    raise exception 'Linha de orçamento não encontrada';
  end if;

  if new.company_id is distinct from v_item_company then
    raise exception 'A conta detalhada deve pertencer à mesma empresa da linha';
  end if;

  if new.ledger_account_id is not null then
    select company_id into v_ledger_company
    from public.company_ledger_accounts
    where id = new.ledger_account_id;
    if v_ledger_company is null or v_ledger_company <> new.company_id then
      raise exception 'Conta contábil inválida para esta empresa';
    end if;
  end if;

  new.account_code := public.sanitize_spreadsheet_text(new.account_code, 80);
  new.account_name := public.sanitize_spreadsheet_text(new.account_name, 200);
  if new.account_code = '' or new.account_name = '' then
    raise exception 'Informe número e descrição da conta contábil';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists budget_item_accounts_enforce_scope_trg
  on public.budget_item_accounts;
create trigger budget_item_accounts_enforce_scope_trg
  before insert or update on public.budget_item_accounts
  for each row execute function public.budget_item_accounts_enforce_scope();

revoke all on function public.budget_item_accounts_enforce_scope() from public;

create or replace function public.budget_item_account_values_enforce_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.budget_item_accounts
  where id = new.budget_item_account_id;

  if v_company is null then
    raise exception 'Conta detalhada não encontrada';
  end if;

  if new.company_id is distinct from v_company then
    raise exception 'Valor da conta deve pertencer à mesma empresa';
  end if;

  new.amount := round(coalesce(new.amount, 0), 2);
  if new.amount < 0 then
    raise exception 'Valores negativos não são permitidos';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists budget_item_account_values_enforce_scope_trg
  on public.budget_item_account_values;
create trigger budget_item_account_values_enforce_scope_trg
  before insert or update on public.budget_item_account_values
  for each row execute function public.budget_item_account_values_enforce_scope();

revoke all on function public.budget_item_account_values_enforce_scope() from public;

-- ---------------------------------------------------------------------------
-- Importação do plano de contas (regras só no backend)
-- ---------------------------------------------------------------------------

create or replace function public.import_company_ledger_accounts(
  p_company_id uuid,
  p_import_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_code text;
  v_name text;
  v_code_key text;
  v_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_payload_bytes integer;
  v_seen_codes text[] := array[]::text[];
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para importar o plano de contas';
  end if;

  if not exists (
    select 1
    from public.ledger_account_imports i
    where i.id = p_import_id
      and i.company_id = p_company_id
  ) then
    raise exception 'Importação não encontrada';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Linhas inválidas';
  end if;

  if jsonb_array_length(p_rows) > 20000 then
    raise exception 'A planilha excede o limite de 20000 contas';
  end if;

  v_payload_bytes := pg_column_size(p_rows);
  if v_payload_bytes > 4 * 1024 * 1024 then
    raise exception 'Lote excede o limite seguro de tamanho (4 MB).';
  end if;

  for v_item in select elem from jsonb_array_elements(p_rows) as t(elem)
  loop
    v_code := nullif(public.sanitize_spreadsheet_text(v_item->>'account_code', 80), '');
    v_name := nullif(public.sanitize_spreadsheet_text(v_item->>'account_name', 200), '');

    if v_code is null or v_name is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_code_key := lower(trim(v_code));

    if v_code_key = any (v_seen_codes) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_seen_codes := array_append(v_seen_codes, v_code_key);

    select a.id
      into v_id
    from public.company_ledger_accounts a
    where a.company_id = p_company_id
      and lower(trim(a.account_code)) = v_code_key
    order by a.created_at asc
    limit 1;

    if v_id is null then
      insert into public.company_ledger_accounts (
        company_id,
        account_code,
        account_name,
        is_active,
        created_by
      )
      values (
        p_company_id,
        v_code,
        v_name,
        true,
        v_user
      );
      v_inserted := v_inserted + 1;
    else
      update public.company_ledger_accounts
      set
        account_code = v_code,
        account_name = v_name,
        is_active = true,
        updated_at = now()
      where id = v_id
        and company_id = p_company_id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  update public.ledger_account_imports
  set
    status = 'completed',
    row_count = v_inserted + v_updated,
    inserted_count = v_inserted,
    updated_count = v_updated,
    skipped_count = v_skipped,
    error_message = null,
    processed_at = now(),
    updated_at = now()
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'total', v_inserted + v_updated
  );
end;
$$;

revoke all on function public.import_company_ledger_accounts(uuid, uuid, jsonb) from public;
grant execute on function public.import_company_ledger_accounts(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- save_company_budget: aceita accounts[] opcional e valida soma = total
-- ---------------------------------------------------------------------------

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
  v_account jsonb;
  v_item_id uuid;
  v_group_id uuid;
  v_account_id uuid;
  v_ledger_id uuid;
  v_destination_id uuid;
  v_value jsonb;
  v_amount numeric(14, 2);
  v_sort integer := 0;
  v_account_sort integer;
  v_start date;
  v_end date;
  v_name text;
  v_money_group text;
  v_destination_name text;
  v_is_detailed boolean;
  v_item_total numeric(14, 2);
  v_accounts_total numeric(14, 2);
  v_account_code text;
  v_account_name text;
  v_accounts jsonb;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para salvar orçamento nesta empresa';
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
    v_accounts := coalesce(v_item->'accounts', '[]'::jsonb);
    if jsonb_typeof(v_accounts) <> 'array' then
      raise exception 'Detalhamento por conta contábil inválido';
    end if;
    v_is_detailed := jsonb_array_length(v_accounts) > 0
      or coalesce((v_item->>'is_detailed')::boolean, false);

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

    if v_is_detailed and jsonb_array_length(v_accounts) = 0 then
      raise exception 'Orçamento detalhado exige ao menos uma conta contábil';
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
      is_detailed,
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
      v_is_detailed,
      v_sort
    )
    returning id into v_item_id;

    v_sort := v_sort + 1;
    v_item_total := 0;

    for v_value in
      select elem from jsonb_array_elements(coalesce(v_item->'values', '[]'::jsonb)) as t(elem)
    loop
      v_amount := round(coalesce(v_value->>'amount', '0')::numeric, 2);
      if v_amount < 0 then
        raise exception 'Valores negativos não são permitidos';
      end if;
      v_item_total := v_item_total + v_amount;

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

    if v_is_detailed then
      v_accounts_total := 0;
      v_account_sort := 0;

      for v_account in
        select elem from jsonb_array_elements(v_accounts) as t(elem)
      loop
        v_account_code := nullif(
          public.sanitize_spreadsheet_text(v_account->>'account_code', 80),
          ''
        );
        v_account_name := nullif(
          public.sanitize_spreadsheet_text(v_account->>'account_name', 200),
          ''
        );
        v_ledger_id := nullif(v_account->>'ledger_account_id', '')::uuid;

        if v_account_code is null or v_account_name is null then
          raise exception 'Cada conta detalhada precisa de número e descrição';
        end if;

        if v_ledger_id is not null then
          if not exists (
            select 1
            from public.company_ledger_accounts la
            where la.id = v_ledger_id
              and la.company_id = p_company_id
              and la.is_active
          ) then
            raise exception 'Conta contábil inválida para esta empresa';
          end if;
        else
          select la.id into v_ledger_id
          from public.company_ledger_accounts la
          where la.company_id = p_company_id
            and lower(trim(la.account_code)) = lower(trim(v_account_code))
            and la.is_active
          limit 1;

          if v_ledger_id is null then
            insert into public.company_ledger_accounts (
              company_id, account_code, account_name, is_active, created_by
            )
            values (
              p_company_id, v_account_code, v_account_name, true, v_user_id
            )
            returning id into v_ledger_id;
          end if;
        end if;

        insert into public.budget_item_accounts (
          budget_item_id,
          company_id,
          ledger_account_id,
          account_code,
          account_name,
          sort_order
        )
        values (
          v_item_id,
          p_company_id,
          v_ledger_id,
          v_account_code,
          v_account_name,
          v_account_sort
        )
        returning id into v_account_id;

        v_account_sort := v_account_sort + 1;

        for v_value in
          select elem
          from jsonb_array_elements(coalesce(v_account->'values', '[]'::jsonb)) as t(elem)
        loop
          v_amount := round(coalesce(v_value->>'amount', '0')::numeric, 2);
          if v_amount < 0 then
            raise exception 'Valores negativos não são permitidos no detalhamento';
          end if;
          v_accounts_total := v_accounts_total + v_amount;

          insert into public.budget_item_account_values (
            budget_item_account_id,
            company_id,
            year,
            month,
            amount
          )
          values (
            v_account_id,
            p_company_id,
            (v_value->>'year')::integer,
            (v_value->>'month')::integer,
            v_amount
          );
        end loop;
      end loop;

      if round(v_accounts_total, 2) <> round(v_item_total, 2) then
        raise exception
          'A soma das contas contábeis (%) deve ser igual ao total orçado do destino (%)',
          round(v_accounts_total, 2),
          round(v_item_total, 2);
      end if;
    end if;
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

revoke all on function public.save_company_budget(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_company_budget(uuid, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Comparação Orçado × Realizado com detalhe por conta quando aplicável
-- ---------------------------------------------------------------------------

create or replace function public.get_budget_vs_actual_by_money_group(
  p_company_id uuid,
  p_budget_id uuid,
  p_money_group text,
  p_month_key text default 'all'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_budget public.budgets%rowtype;
  v_month_key text := lower(trim(coalesce(p_month_key, 'all')));
  v_money_group text := lower(trim(coalesce(p_money_group, '')));
  v_start date;
  v_end date;
  v_months jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_budget_total numeric(14, 2) := 0;
  v_actual_total numeric(14, 2) := 0;
  v_variance numeric(14, 2) := 0;
  v_variance_pct numeric;
  v_has_realized boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if v_money_group not in ('revenue', 'cost', 'expense', 'investment') then
    raise exception 'Grupo financeiro inválido';
  end if;

  if v_month_key = '' then
    v_month_key := 'all';
  end if;

  if v_month_key <> 'all' and v_month_key !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido';
  end if;

  select *
    into v_budget
  from public.budgets b
  where b.id = p_budget_id
    and b.company_id = p_company_id;

  if v_budget.id is null then
    raise exception 'Orçamento não encontrado nesta empresa';
  end if;

  v_start := v_budget.start_date;
  v_end := v_budget.end_date;

  with recursive month_series as (
    select date_trunc('month', v_start::timestamp)::date as month_start
    union all
    select (month_start + interval '1 month')::date
    from month_series
    where month_start < date_trunc('month', v_end::timestamp)::date
  ),
  months as (
    select
      to_char(month_start, 'YYYY-MM') as month_key,
      to_char(month_start, 'Mon') as month_label,
      extract(year from month_start)::int as year,
      extract(month from month_start)::int as month
    from month_series
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', month_key,
        'label', month_label,
        'year', year,
        'month', month
      )
      order by month_key
    ),
    '[]'::jsonb
  )
  into v_months
  from months;

  with recursive month_series as (
    select date_trunc('month', v_start::timestamp)::date as month_start
    union all
    select (month_start + interval '1 month')::date
    from month_series
    where month_start < date_trunc('month', v_end::timestamp)::date
  ),
  months as (
    select
      to_char(month_start, 'YYYY-MM') as month_key,
      extract(year from month_start)::int as year,
      extract(month from month_start)::int as month
    from month_series
  ),
  -- Destinos sem detalhamento: uma linha por destino
  budget_basic as (
    select
      coalesce(
        nullif(trim(bi.destination_name), ''),
        nullif(trim(cc.name), ''),
        'Sem destino'
      ) as label,
      null::text as detail,
      lower(
        coalesce(
          nullif(trim(bi.destination_id::text), ''),
          nullif(trim(bi.destination_name), ''),
          nullif(trim(bi.cost_center_id::text), ''),
          'sem-destino'
        )
      ) as row_key,
      to_char(make_date(biv.year, biv.month, 1), 'YYYY-MM') as month_key,
      round(coalesce(biv.amount, 0), 2) as amount
    from public.budget_items bi
    join public.budget_item_values biv on biv.budget_item_id = bi.id
    left join public.cost_centers cc on cc.id = bi.cost_center_id
    left join public.categories cat on cat.id = bi.category_id
    where bi.budget_id = p_budget_id
      and bi.company_id = p_company_id
      and coalesce(bi.is_detailed, false) = false
      and (
        bi.money_group = v_money_group
        or (
          bi.money_group is null
          and cat.category_type = v_money_group
        )
      )
      and exists (
        select 1 from months m
        where m.year = biv.year and m.month = biv.month
      )
  ),
  -- Destinos detalhados: uma linha por conta contábil
  budget_detailed as (
    select
      bia.account_code || ' — ' || bia.account_name as label,
      coalesce(
        nullif(trim(bi.destination_name), ''),
        nullif(trim(cc.name), ''),
        'Sem destino'
      ) as detail,
      lower(
        coalesce(
          nullif(trim(bi.destination_id::text), ''),
          nullif(trim(bi.destination_name), ''),
          nullif(trim(bi.cost_center_id::text), ''),
          'sem-destino'
        )
      ) || '|' || lower(trim(bia.account_code)) as row_key,
      to_char(make_date(biav.year, biav.month, 1), 'YYYY-MM') as month_key,
      round(coalesce(biav.amount, 0), 2) as amount
    from public.budget_items bi
    join public.budget_item_accounts bia on bia.budget_item_id = bi.id
    join public.budget_item_account_values biav
      on biav.budget_item_account_id = bia.id
    left join public.cost_centers cc on cc.id = bi.cost_center_id
    left join public.categories cat on cat.id = bi.category_id
    where bi.budget_id = p_budget_id
      and bi.company_id = p_company_id
      and bi.is_detailed = true
      and (
        bi.money_group = v_money_group
        or (
          bi.money_group is null
          and cat.category_type = v_money_group
        )
      )
      and exists (
        select 1 from months m
        where m.year = biav.year and m.month = biav.month
      )
  ),
  budget_lines as (
    select * from budget_basic
    union all
    select * from budget_detailed
  ),
  -- Destinos detalhados do orçamento (para mapear realizado por conta)
  detailed_destinations as (
    select distinct
      bi.id as budget_item_id,
      lower(
        coalesce(
          nullif(trim(bi.destination_id::text), ''),
          nullif(trim(bi.destination_name), ''),
          'sem-destino'
        )
      ) as dest_key,
      coalesce(nullif(trim(bi.destination_name), ''), 'Sem destino') as dest_label
    from public.budget_items bi
    where bi.budget_id = p_budget_id
      and bi.company_id = p_company_id
      and bi.is_detailed = true
      and bi.money_group = v_money_group
  ),
  actual_item_lines as (
    select
      case
        when dd.dest_key is not null and nullif(trim(ai.account_code), '') is not null then
          coalesce(nullif(trim(ai.account_code), ''), '') || ' — ' ||
          coalesce(nullif(trim(ai.account_name), ''), 'Conta')
        else
          coalesce(
            nullif(trim(ai.destination_name), ''),
            nullif(trim(cc.name), ''),
            'Sem destino'
          )
      end as label,
      case
        when dd.dest_key is not null and nullif(trim(ai.account_code), '') is not null then
          coalesce(nullif(trim(ai.destination_name), ''), dd.dest_label)
        else null
      end as detail,
      case
        when dd.dest_key is not null and nullif(trim(ai.account_code), '') is not null then
          dd.dest_key || '|' || lower(trim(ai.account_code))
        when dd.dest_key is not null then
          dd.dest_key || '|sem-conta'
        else
          lower(
            coalesce(
              nullif(trim(ai.destination_id::text), ''),
              nullif(trim(ai.destination_name), ''),
              nullif(trim(ai.cost_center_id::text), ''),
              'sem-destino'
            )
          )
      end as row_key,
      to_char(make_date(aiv.year, aiv.month, 1), 'YYYY-MM') as month_key,
      round(coalesce(aiv.amount, 0), 2) as amount
    from public.actuals a
    join public.actual_items ai on ai.actual_id = a.id
    join public.actual_item_values aiv on aiv.actual_item_id = ai.id
    left join public.cost_centers cc on cc.id = ai.cost_center_id
    left join public.categories cat on cat.id = ai.category_id
    left join detailed_destinations dd on dd.dest_key = lower(
      coalesce(
        nullif(trim(ai.destination_id::text), ''),
        nullif(trim(ai.destination_name), ''),
        'sem-destino'
      )
    )
    where a.company_id = p_company_id
      and a.budget_id = p_budget_id
      and (
        ai.money_group = v_money_group
        or (
          ai.money_group is null
          and cat.category_type = v_money_group
        )
      )
      and exists (
        select 1 from months m
        where m.year = aiv.year and m.month = aiv.month
      )
  ),
  classified_tx_lines as (
    select
      case
        when dd.dest_key is not null then
          'Sem conta contábil'
        else
          coalesce(
            nullif(trim(t.destination_name), ''),
            nullif(trim(cc.name), ''),
            'Sem destino'
          )
      end as label,
      case
        when dd.dest_key is not null then dd.dest_label
        else null
      end as detail,
      case
        when dd.dest_key is not null then
          dd.dest_key || '|sem-conta'
        else
          lower(
            coalesce(
              nullif(trim(t.destination_id::text), ''),
              nullif(trim(t.destination_name), ''),
              nullif(trim(t.cost_center_id::text), ''),
              'sem-destino'
            )
          )
      end as row_key,
      to_char(date_trunc('month', t.posted_at::timestamp), 'YYYY-MM') as month_key,
      round(coalesce(t.amount, 0), 2) as amount
    from public.actual_transactions t
    left join public.cost_centers cc on cc.id = t.cost_center_id
    left join detailed_destinations dd on dd.dest_key = lower(
      coalesce(
        nullif(trim(t.destination_id::text), ''),
        nullif(trim(t.destination_name), ''),
        'sem-destino'
      )
    )
    where t.company_id = p_company_id
      and t.status = 'classified'
      and t.money_group = v_money_group
      and t.posted_at >= v_start
      and t.posted_at <= v_end
  ),
  classified_erp_lines as (
    select
      case
        when dd.dest_key is not null and nullif(trim(e.account_code), '') is not null then
          coalesce(nullif(trim(e.account_code), ''), '') || ' — ' ||
          coalesce(nullif(trim(e.account_name), ''), 'Conta')
        when dd.dest_key is not null then
          'Sem conta contábil'
        else
          coalesce(
            nullif(trim(e.destination_name), ''),
            nullif(trim(e.cost_center_name), ''),
            'Sem destino'
          )
      end as label,
      case
        when dd.dest_key is not null then
          coalesce(nullif(trim(e.destination_name), ''), dd.dest_label)
        else null
      end as detail,
      case
        when dd.dest_key is not null and nullif(trim(e.account_code), '') is not null then
          dd.dest_key || '|' || lower(trim(e.account_code))
        when dd.dest_key is not null then
          dd.dest_key || '|sem-conta'
        else
          lower(
            coalesce(
              nullif(trim(e.destination_id::text), ''),
              nullif(trim(e.destination_name), ''),
              nullif(trim(e.cost_center_id::text), ''),
              nullif(trim(e.cost_center_name), ''),
              'sem-destino'
            )
          )
      end as row_key,
      to_char(date_trunc('month', e.posted_at::timestamp), 'YYYY-MM') as month_key,
      round(coalesce(e.amount, 0), 2) as amount
    from public.erp_entries e
    left join detailed_destinations dd on dd.dest_key = lower(
      coalesce(
        nullif(trim(e.destination_id::text), ''),
        nullif(trim(e.destination_name), ''),
        'sem-destino'
      )
    )
    where e.company_id = p_company_id
      and e.status = 'classified'
      and e.money_group = v_money_group
      and e.posted_at >= v_start
      and e.posted_at <= v_end
  ),
  budget_agg as (
    select
      row_key,
      max(label) as label,
      max(detail) as detail,
      month_key,
      round(sum(amount), 2) as amount
    from budget_lines
    where v_month_key = 'all' or month_key = v_month_key
    group by row_key, month_key
  ),
  actual_agg as (
    select
      row_key,
      max(label) as label,
      max(detail) as detail,
      month_key,
      round(sum(amount), 2) as amount
    from (
      select * from actual_item_lines
      union all
      select * from classified_tx_lines
      union all
      select * from classified_erp_lines
    ) u
    where v_month_key = 'all' or month_key = v_month_key
    group by row_key, month_key
  ),
  keys as (
    select distinct row_key from (
      select row_key from budget_agg
      union
      select row_key from actual_agg
    ) k
  ),
  row_totals as (
    select
      k.row_key,
      coalesce(b_label.label, a_label.label, 'Sem destino') as label,
      coalesce(b_label.detail, a_label.detail) as detail,
      round(coalesce(b.total, 0), 2) as budget_amount,
      round(coalesce(a.total, 0), 2) as actual_amount
    from keys k
    left join lateral (
      select max(label) as label, max(detail) as detail
      from budget_agg b where b.row_key = k.row_key
    ) b_label on true
    left join lateral (
      select max(label) as label, max(detail) as detail
      from actual_agg a where a.row_key = k.row_key
    ) a_label on true
    left join lateral (
      select sum(amount) as total from budget_agg b where b.row_key = k.row_key
    ) b on true
    left join lateral (
      select sum(amount) as total from actual_agg a where a.row_key = k.row_key
    ) a on true
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', row_key,
          'label', label,
          'detail', detail,
          'budget', budget_amount,
          'actual', actual_amount,
          'variance', round(actual_amount - budget_amount, 2),
          'variance_pct', case
            when budget_amount = 0 then null
            else round((actual_amount - budget_amount) / budget_amount, 6)
          end
        )
        order by abs(actual_amount - budget_amount) desc, label
      ),
      '[]'::jsonb
    ),
    coalesce(sum(budget_amount), 0),
    coalesce(sum(actual_amount), 0),
    coalesce(bool_or(actual_amount <> 0), false)
  into v_rows, v_budget_total, v_actual_total, v_has_realized
  from row_totals
  where budget_amount <> 0 or actual_amount <> 0;

  v_variance := round(v_actual_total - v_budget_total, 2);
  if v_budget_total = 0 then
    v_variance_pct := null;
  else
    v_variance_pct := round(v_variance / v_budget_total, 6);
  end if;

  return jsonb_build_object(
    'company_id', p_company_id,
    'budget_id', p_budget_id,
    'money_group', v_money_group,
    'month_key', v_month_key,
    'start_date', v_start,
    'end_date', v_end,
    'months', v_months,
    'has_realized', v_has_realized,
    'summary', jsonb_build_object(
      'budget', v_budget_total,
      'actual', v_actual_total,
      'variance', v_variance,
      'variance_pct', v_variance_pct
    ),
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

comment on function public.get_budget_vs_actual_by_money_group(uuid, uuid, text, text) is
  'Agrega Orçado × Realizado por money_group. Destinos detalhados expandem por conta contábil.';

revoke all on function public.get_budget_vs_actual_by_money_group(uuid, uuid, text, text) from public;
grant execute on function public.get_budget_vs_actual_by_money_group(uuid, uuid, text, text) to authenticated;

-- actual_items: conta contábil opcional para espelhar orçamento detalhado
alter table public.actual_items
  add column if not exists account_code text,
  add column if not exists account_name text;

do $$
begin
  alter table public.actual_items
    add constraint actual_items_account_code_len
    check (account_code is null or char_length(account_code) <= 80);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.actual_items
    add constraint actual_items_account_name_len
    check (account_name is null or char_length(account_name) <= 200);
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Endurece RLS de orçamento: leitura membro; escrita writer
-- (mutações oficiais continuam via save_company_budget SECURITY DEFINER)
-- ---------------------------------------------------------------------------

drop policy if exists "budgets_all_member" on public.budgets;
drop policy if exists "budgets_select_member" on public.budgets;
drop policy if exists "budgets_insert_writer" on public.budgets;
drop policy if exists "budgets_update_writer" on public.budgets;
drop policy if exists "budgets_delete_writer" on public.budgets;

create policy "budgets_select_member"
  on public.budgets for select to authenticated
  using (public.is_company_member(company_id));

create policy "budgets_insert_writer"
  on public.budgets for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "budgets_update_writer"
  on public.budgets for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "budgets_delete_writer"
  on public.budgets for delete to authenticated
  using (public.is_company_writer(company_id));

drop policy if exists "budget_items_all_member" on public.budget_items;
drop policy if exists "budget_items_select_member" on public.budget_items;
drop policy if exists "budget_items_insert_writer" on public.budget_items;
drop policy if exists "budget_items_update_writer" on public.budget_items;
drop policy if exists "budget_items_delete_writer" on public.budget_items;

create policy "budget_items_select_member"
  on public.budget_items for select to authenticated
  using (public.is_company_member(company_id));

create policy "budget_items_insert_writer"
  on public.budget_items for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "budget_items_update_writer"
  on public.budget_items for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "budget_items_delete_writer"
  on public.budget_items for delete to authenticated
  using (public.is_company_writer(company_id));

drop policy if exists "budget_item_values_all_member" on public.budget_item_values;
drop policy if exists "budget_item_values_select_member" on public.budget_item_values;
drop policy if exists "budget_item_values_insert_writer" on public.budget_item_values;
drop policy if exists "budget_item_values_update_writer" on public.budget_item_values;
drop policy if exists "budget_item_values_delete_writer" on public.budget_item_values;

create policy "budget_item_values_select_member"
  on public.budget_item_values for select to authenticated
  using (public.is_company_member(company_id));

create policy "budget_item_values_insert_writer"
  on public.budget_item_values for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "budget_item_values_update_writer"
  on public.budget_item_values for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "budget_item_values_delete_writer"
  on public.budget_item_values for delete to authenticated
  using (public.is_company_writer(company_id));

drop policy if exists "budget_group_totals_all_member" on public.budget_group_totals;
drop policy if exists "budget_group_totals_select_member" on public.budget_group_totals;
drop policy if exists "budget_group_totals_insert_writer" on public.budget_group_totals;
drop policy if exists "budget_group_totals_update_writer" on public.budget_group_totals;
drop policy if exists "budget_group_totals_delete_writer" on public.budget_group_totals;

create policy "budget_group_totals_select_member"
  on public.budget_group_totals for select to authenticated
  using (public.is_company_member(company_id));

create policy "budget_group_totals_insert_writer"
  on public.budget_group_totals for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "budget_group_totals_update_writer"
  on public.budget_group_totals for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "budget_group_totals_delete_writer"
  on public.budget_group_totals for delete to authenticated
  using (public.is_company_writer(company_id));

drop policy if exists "budget_group_total_values_all_member" on public.budget_group_total_values;
drop policy if exists "budget_group_total_values_select_member" on public.budget_group_total_values;
drop policy if exists "budget_group_total_values_insert_writer" on public.budget_group_total_values;
drop policy if exists "budget_group_total_values_update_writer" on public.budget_group_total_values;
drop policy if exists "budget_group_total_values_delete_writer" on public.budget_group_total_values;

create policy "budget_group_total_values_select_member"
  on public.budget_group_total_values for select to authenticated
  using (public.is_company_member(company_id));

create policy "budget_group_total_values_insert_writer"
  on public.budget_group_total_values for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "budget_group_total_values_update_writer"
  on public.budget_group_total_values for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "budget_group_total_values_delete_writer"
  on public.budget_group_total_values for delete to authenticated
  using (public.is_company_writer(company_id));

-- ---------------------------------------------------------------------------
-- Realizado (ERP): com orçamento detalhado, exige número e descrição da conta
-- ---------------------------------------------------------------------------

create or replace function public.company_has_detailed_budget(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.budgets b
    join public.budget_items bi on bi.budget_id = b.id
    where b.company_id = p_company_id
      and b.status <> 'archived'
      and bi.is_detailed = true
  );
$$;

revoke all on function public.company_has_detailed_budget(uuid) from public;
grant execute on function public.company_has_detailed_budget(uuid) to authenticated;

create or replace function public.erp_entries_require_account_when_detailed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.company_has_detailed_budget(new.company_id) then
    new.account_code := nullif(
      public.sanitize_spreadsheet_text(new.account_code, 80),
      ''
    );
    new.account_name := nullif(
      public.sanitize_spreadsheet_text(new.account_name, 200),
      ''
    );
    if new.account_code is null or new.account_name is null then
      raise exception
        'Com orçamento detalhado, o arquivo de realizado deve informar número e descrição da conta contábil';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists erp_entries_require_account_when_detailed_trg
  on public.erp_entries;
create trigger erp_entries_require_account_when_detailed_trg
  before insert or update of account_code, account_name, company_id
  on public.erp_entries
  for each row execute function public.erp_entries_require_account_when_detailed();

revoke all on function public.erp_entries_require_account_when_detailed() from public;

notify pgrst, 'reload schema';

