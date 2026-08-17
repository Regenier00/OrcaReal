-- Realizado: importação de extratos e modelo único de transação.
-- Reutiliza companies, departments, categories, cost_centers e periods.
-- Arquivos financeiros ficam no bucket privado statement-imports.

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  bank_code text,
  bank_name text,
  agency text,
  account_number text,
  account_digit text,
  account_type text not null default 'checking'
    check (account_type in ('checking', 'savings', 'payment', 'other')),
  currency text not null default 'BRL',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bank_accounts_company_id_idx on public.bank_accounts (company_id);

create table public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts (id) on delete restrict,
  file_name text not null,
  file_path text,
  file_size integer,
  file_type text not null default 'unknown'
    check (file_type in ('ofx', 'csv', 'xlsx', 'pdf', 'unknown')),
  detected_bank text,
  status text not null default 'uploaded'
    check (status in (
      'uploaded',
      'identifying',
      'parsing',
      'normalizing',
      'completed',
      'failed',
      'ocr_required'
    )),
  transaction_count integer not null default 0,
  income_count integer not null default 0,
  expense_count integer not null default 0,
  transfer_count integer not null default 0,
  classified_count integer not null default 0,
  pending_count integer not null default 0,
  ignored_count integer not null default 0,
  error_count integer not null default 0,
  duplicate_count integer not null default 0,
  period_start date,
  period_end date,
  error_message text,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index statement_imports_company_id_idx
  on public.statement_imports (company_id, created_at desc);
create index statement_imports_account_id_idx
  on public.statement_imports (bank_account_id);

create table public.actual_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts (id) on delete restrict,
  import_id uuid references public.statement_imports (id) on delete set null,
  posted_at date not null,
  description text not null check (char_length(description) <= 500),
  amount numeric(14, 2) not null check (amount >= 0),
  type text not null default 'unknown'
    check (type in ('income', 'expense', 'transfer', 'unknown')),
  balance numeric(14, 2),
  category_id uuid references public.categories (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  cost_center_id uuid references public.cost_centers (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'classified', 'ignored')),
  external_id text,
  fingerprint text not null,
  document_number text,
  counterparty text,
  raw jsonb not null default '{}'::jsonb,
  suggested_category_id uuid references public.categories (id) on delete set null,
  suggested_department_id uuid references public.departments (id) on delete set null,
  suggested_cost_center_id uuid references public.cost_centers (id) on delete set null,
  suggestion_source text
    check (suggestion_source is null or suggestion_source in ('history', 'rule')),
  classified_at timestamptz,
  classified_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index actual_transactions_company_posted_idx
  on public.actual_transactions (company_id, posted_at desc);
create index actual_transactions_company_status_idx
  on public.actual_transactions (company_id, status);
create index actual_transactions_import_id_idx
  on public.actual_transactions (import_id);
create unique index actual_transactions_fingerprint_idx
  on public.actual_transactions (company_id, fingerprint);
create unique index actual_transactions_external_id_idx
  on public.actual_transactions (bank_account_id, external_id)
  where external_id is not null;

-- Memória de classificação para sugestões futuras (nunca aplica sozinha).
create table public.transaction_classification_memory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  description_normalized text not null,
  category_id uuid references public.categories (id) on delete cascade,
  department_id uuid references public.departments (id) on delete cascade,
  cost_center_id uuid references public.cost_centers (id) on delete cascade,
  usage_count integer not null default 1,
  last_classified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, description_normalized)
);

create index transaction_classification_memory_company_idx
  on public.transaction_classification_memory (company_id);

-- Totais mensais para o Realizado e, no futuro, Orçado × Realizado.
create or replace view public.actual_monthly_totals
with (security_invoker = true) as
select
  t.company_id,
  t.department_id,
  t.category_id,
  t.cost_center_id,
  t.type,
  extract(year from t.posted_at)::integer as year,
  extract(month from t.posted_at)::integer as month,
  sum(t.amount) as total,
  count(*)::integer as transaction_count
from public.actual_transactions t
where t.status = 'classified'
group by
  t.company_id,
  t.department_id,
  t.category_id,
  t.cost_center_id,
  t.type,
  extract(year from t.posted_at),
  extract(month from t.posted_at);

create or replace function public.normalize_transaction_description(p_description text)
returns text
language sql
immutable
as $$
  select lower(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.actual_transaction_fingerprint(
  p_company_id uuid,
  p_account_id uuid,
  p_posted_at date,
  p_amount numeric,
  p_type text,
  p_description text,
  p_external_id text
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    digest(
      coalesce(p_company_id::text, '') || '|' ||
      coalesce(p_account_id::text, '') || '|' ||
      coalesce(p_posted_at::text, '') || '|' ||
      coalesce(round(p_amount, 2)::text, '') || '|' ||
      coalesce(p_type, '') || '|' ||
      public.normalize_transaction_description(p_description) || '|' ||
      coalesce(p_external_id, ''),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.actual_transactions_before_write()
returns trigger
language plpgsql
as $$
begin
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

create trigger actual_transactions_before_write
  before insert or update on public.actual_transactions
  for each row execute function public.actual_transactions_before_write();

create or replace function public.refresh_statement_import_stats(p_import_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.statement_imports i
  set
    transaction_count = s.total,
    income_count = s.income_count,
    expense_count = s.expense_count,
    transfer_count = s.transfer_count,
    classified_count = s.classified_count,
    pending_count = s.pending_count,
    ignored_count = s.ignored_count,
    period_start = s.period_start,
    period_end = s.period_end,
    updated_at = now()
  from (
    select
      count(*)::integer as total,
      count(*) filter (where type = 'income')::integer as income_count,
      count(*) filter (where type = 'expense')::integer as expense_count,
      count(*) filter (where type = 'transfer')::integer as transfer_count,
      count(*) filter (where status = 'classified')::integer as classified_count,
      count(*) filter (where status = 'pending')::integer as pending_count,
      count(*) filter (where status = 'ignored')::integer as ignored_count,
      min(posted_at) as period_start,
      max(posted_at) as period_end
    from public.actual_transactions
    where import_id = p_import_id
  ) s
  where i.id = p_import_id;
end;
$$;

create or replace function public.actual_transactions_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.import_id is not null then
      perform public.refresh_statement_import_stats(old.import_id);
    end if;
    return old;
  end if;

  if new.import_id is not null then
    perform public.refresh_statement_import_stats(new.import_id);
  end if;

  if tg_op = 'UPDATE'
     and old.import_id is not null
     and old.import_id is distinct from new.import_id
  then
    perform public.refresh_statement_import_stats(old.import_id);
  end if;

  return new;
end;
$$;

create trigger actual_transactions_after_write
  after insert or delete or update of status, type, posted_at, amount, import_id
  on public.actual_transactions
  for each row execute function public.actual_transactions_after_write();

create or replace function public.remember_transaction_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desc text;
begin
  if new.status <> 'classified' then
    return new;
  end if;

  if new.category_id is null and new.department_id is null and new.cost_center_id is null then
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
    usage_count,
    last_classified_at
  )
  values (
    new.company_id,
    v_desc,
    new.category_id,
    new.department_id,
    new.cost_center_id,
    1,
    now()
  )
  on conflict (company_id, description_normalized)
  do update set
    category_id = excluded.category_id,
    department_id = excluded.department_id,
    cost_center_id = excluded.cost_center_id,
    usage_count = public.transaction_classification_memory.usage_count + 1,
    last_classified_at = now();

  return new;
end;
$$;

create trigger actual_transactions_remember_classification
  after insert or update of status, category_id, department_id, cost_center_id
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

create or replace function public.import_actual_transactions(
  p_company_id uuid,
  p_import_id uuid,
  p_transactions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_item jsonb;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_errors integer := 0;
  v_closed integer := 0;
  v_fingerprint text;
  v_posted date;
  v_amount numeric(14, 2);
  v_type text;
  v_description text;
  v_external_id text;
  v_warnings jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  select bank_account_id into v_account_id
  from public.statement_imports
  where id = p_import_id and company_id = p_company_id;

  if v_account_id is null then
    raise exception 'Importação não encontrada';
  end if;

  if p_transactions is null or jsonb_typeof(p_transactions) <> 'array' then
    raise exception 'Transações inválidas';
  end if;

  for v_item in select elem from jsonb_array_elements(p_transactions) as t(elem)
  loop
    begin
      v_posted := (v_item->>'posted_at')::date;
      v_amount := round(coalesce(v_item->>'amount', '0')::numeric, 2);
      v_type := coalesce(nullif(v_item->>'type', ''), 'unknown');
      v_description := left(
        btrim(regexp_replace(coalesce(v_item->>'description', ''), '^[=+\-@|]+', '')),
        500
      );
      v_external_id := nullif(btrim(coalesce(v_item->>'external_id', '')), '');

      if v_posted is null or v_description = '' or v_amount < 0 then
        v_errors := v_errors + 1;
        continue;
      end if;

      if v_type not in ('income', 'expense', 'transfer', 'unknown') then
        v_type := 'unknown';
      end if;

      if exists (
        select 1 from public.periods p
        where p.company_id = p_company_id
          and p.year = extract(year from v_posted)
          and p.month = extract(month from v_posted)
          and p.status = 'closed'
      ) then
        v_closed := v_closed + 1;
        v_errors := v_errors + 1;
        v_warnings := v_warnings || jsonb_build_array(
          jsonb_build_object(
            'message',
            'Período ' || to_char(v_posted, 'MM/YYYY') || ' está fechado',
            'posted_at', v_posted
          )
        );
        continue;
      end if;

      v_fingerprint := public.actual_transaction_fingerprint(
        p_company_id,
        v_account_id,
        v_posted,
        v_amount,
        v_type,
        v_description,
        v_external_id
      );

      insert into public.actual_transactions (
        company_id,
        bank_account_id,
        import_id,
        posted_at,
        description,
        amount,
        type,
        balance,
        status,
        external_id,
        fingerprint,
        document_number,
        counterparty,
        raw
      )
      values (
        p_company_id,
        v_account_id,
        p_import_id,
        v_posted,
        v_description,
        v_amount,
        v_type,
        nullif(v_item->>'balance', '')::numeric,
        'pending',
        v_external_id,
        v_fingerprint,
        nullif(btrim(coalesce(v_item->>'document_number', '')), ''),
        nullif(btrim(coalesce(v_item->>'counterparty', '')), ''),
        coalesce(v_item->'raw', '{}'::jsonb)
      );

      v_inserted := v_inserted + 1;
    exception
      when unique_violation then
        v_duplicates := v_duplicates + 1;
      when others then
        v_errors := v_errors + 1;
    end;
  end loop;

  perform public.apply_classification_suggestions(
    p_company_id,
    array(
      select t.id
      from public.actual_transactions t
      where t.import_id = p_import_id
    )
  );

  perform public.refresh_statement_import_stats(p_import_id);

  update public.statement_imports
  set
    duplicate_count = v_duplicates,
    error_count = v_errors,
    warnings = v_warnings,
    updated_at = now()
  where id = p_import_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'duplicates', v_duplicates,
    'errors', v_errors,
    'closed_period', v_closed
  );
end;
$$;

create or replace function public.classify_actual_transactions(
  p_company_id uuid,
  p_transaction_ids uuid[],
  p_department_id uuid default null,
  p_category_id uuid default null,
  p_cost_center_id uuid default null,
  p_status text default 'classified'
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
      department_id = coalesce(p_department_id, department_id),
      category_id = coalesce(p_category_id, category_id),
      cost_center_id = coalesce(p_cost_center_id, cost_center_id),
      status = case
        when type = 'expense'
             and coalesce(p_department_id, department_id) is not null
             and coalesce(p_category_id, category_id) is not null
             and coalesce(p_cost_center_id, cost_center_id) is not null
          then 'classified'
        when type = 'income'
             and coalesce(p_category_id, category_id) is not null
          then 'classified'
        when type = 'transfer' then 'classified'
        when type = 'unknown' then 'pending'
        else 'pending'
      end,
      classified_at = case
        when type = 'expense'
             and coalesce(p_department_id, department_id) is not null
             and coalesce(p_category_id, category_id) is not null
             and coalesce(p_cost_center_id, cost_center_id) is not null
          then now()
        when type = 'income' and coalesce(p_category_id, category_id) is not null
          then now()
        when type = 'transfer' then now()
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
      status = 'ignored',
      classified_at = now(),
      classified_by = v_user_id,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_transaction_ids);
  else
    update public.actual_transactions
    set
      department_id = p_department_id,
      category_id = p_category_id,
      cost_center_id = p_cost_center_id,
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

revoke all on function public.normalize_transaction_description(text) from public;
grant execute on function public.normalize_transaction_description(text) to authenticated;

revoke all on function public.actual_transaction_fingerprint(uuid, uuid, date, numeric, text, text, text) from public;
grant execute on function public.actual_transaction_fingerprint(uuid, uuid, date, numeric, text, text, text) to authenticated;

revoke all on function public.refresh_statement_import_stats(uuid) from public;
grant execute on function public.refresh_statement_import_stats(uuid) to authenticated;

revoke all on function public.apply_classification_suggestions(uuid, uuid[]) from public;
grant execute on function public.apply_classification_suggestions(uuid, uuid[]) to authenticated;

revoke all on function public.import_actual_transactions(uuid, uuid, jsonb) from public;
grant execute on function public.import_actual_transactions(uuid, uuid, jsonb) to authenticated;

revoke all on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text) from public;
grant execute on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text) to authenticated;

create or replace function public.actual_company_summary(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  select jsonb_build_object(
    'income_total', coalesce(sum(amount) filter (where type = 'income' and status <> 'ignored'), 0),
    'expense_total', coalesce(sum(amount) filter (where type = 'expense' and status <> 'ignored'), 0),
    'pending_count', count(*) filter (where status = 'pending'),
    'classified_count', count(*) filter (where status = 'classified'),
    'ignored_count', count(*) filter (where status = 'ignored'),
    'transaction_count', count(*) filter (where status <> 'ignored')
  )
  into v_summary
  from public.actual_transactions
  where company_id = p_company_id;

  return coalesce(v_summary, '{}'::jsonb);
end;
$$;

revoke all on function public.actual_company_summary(uuid) from public;
grant execute on function public.actual_company_summary(uuid) to authenticated;

alter table public.bank_accounts enable row level security;
alter table public.statement_imports enable row level security;
alter table public.actual_transactions enable row level security;
alter table public.transaction_classification_memory enable row level security;

create policy "bank_accounts_all_member"
  on public.bank_accounts for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "statement_imports_all_member"
  on public.statement_imports for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "actual_transactions_all_member"
  on public.actual_transactions for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "transaction_classification_memory_select_member"
  on public.transaction_classification_memory for select to authenticated
  using (public.is_company_member(company_id));

create policy "transaction_classification_memory_write_member"
  on public.transaction_classification_memory for insert to authenticated
  with check (public.is_company_member(company_id));

create policy "transaction_classification_memory_update_member"
  on public.transaction_classification_memory for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

grant select on public.actual_monthly_totals to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'statement-imports',
  'statement-imports',
  false,
  20971520,
  array[
    'application/x-ofx',
    'application/ofx',
    'application/xml',
    'text/xml',
    'text/csv',
    'text/plain',
    'application/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "statement_imports_storage_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'statement-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

create policy "statement_imports_storage_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'statement-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

create policy "statement_imports_storage_update_member"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'statement-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  )
  with check (
    bucket_id = 'statement-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

create policy "statement_imports_storage_delete_member"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'statement-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );
