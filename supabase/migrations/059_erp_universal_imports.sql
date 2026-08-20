-- Importador universal de dados de ERPs (realizados).
-- Separado do fluxo de extratos bancários (statement_imports / process-statement).
-- Arquitetura: parse → normalização → classificação (regras da empresa) → revisão.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.erp_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  file_name text not null,
  file_path text,
  file_size integer,
  file_type text not null default 'unknown'
    check (file_type in ('xlsx', 'csv', 'ofx', 'pdf', 'unknown')),
  mime_type text,
  file_hash text,
  detected_layout jsonb not null default '{}'::jsonb,
  status text not null default 'uploaded'
    check (status in (
      'uploaded',
      'validating',
      'identifying',
      'parsing',
      'normalizing',
      'classifying',
      'completed',
      'failed'
    )),
  entry_count integer not null default 0,
  classified_count integer not null default 0,
  pending_count integer not null default 0,
  ignored_count integer not null default 0,
  error_count integer not null default 0,
  duplicate_count integer not null default 0,
  revenue_count integer not null default 0,
  cost_count integer not null default 0,
  expense_count integer not null default 0,
  investment_count integer not null default 0,
  period_start date,
  period_end date,
  error_message text,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists erp_imports_company_id_idx
  on public.erp_imports (company_id, created_at desc);
create index if not exists erp_imports_company_hash_idx
  on public.erp_imports (company_id, file_hash)
  where file_hash is not null;

create table if not exists public.erp_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  import_id uuid references public.erp_imports (id) on delete set null,
  posted_at date not null,
  description text not null check (char_length(description) <= 500),
  amount numeric(14, 2) not null check (amount >= 0),
  entry_side text not null default 'unknown'
    check (entry_side in ('debit', 'credit', 'unknown')),
  type text not null default 'unknown'
    check (type in ('income', 'expense', 'unknown')),
  account_code text,
  account_name text,
  cost_center_code text,
  cost_center_name text,
  department_name text,
  document_number text,
  external_id text,
  fingerprint text not null,
  raw jsonb not null default '{}'::jsonb,
  department_id uuid references public.departments (id) on delete set null,
  cost_center_id uuid references public.cost_centers (id) on delete set null,
  money_group text
    check (money_group is null or money_group in ('revenue', 'cost', 'expense', 'investment')),
  destination_id uuid references public.budget_destinations (id) on delete set null,
  destination_name text,
  status text not null default 'pending'
    check (status in ('pending', 'classified', 'ignored')),
  suggested_money_group text
    check (
      suggested_money_group is null
      or suggested_money_group in ('revenue', 'cost', 'expense', 'investment')
    ),
  suggested_destination_id uuid
    references public.budget_destinations (id) on delete set null,
  suggested_destination_name text,
  suggested_department_id uuid references public.departments (id) on delete set null,
  suggested_cost_center_id uuid references public.cost_centers (id) on delete set null,
  suggestion_source text
    check (suggestion_source is null or suggestion_source in ('rule', 'heuristic', 'history')),
  classified_at timestamptz,
  classified_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists erp_entries_company_posted_idx
  on public.erp_entries (company_id, posted_at desc);
create index if not exists erp_entries_company_status_idx
  on public.erp_entries (company_id, status);
create index if not exists erp_entries_import_id_idx
  on public.erp_entries (import_id);
create unique index if not exists erp_entries_fingerprint_idx
  on public.erp_entries (company_id, fingerprint);
create index if not exists erp_entries_account_code_idx
  on public.erp_entries (company_id, account_code)
  where account_code is not null;

-- Regras de classificação da empresa (aprendidas ou configuradas).
-- Separadas do parser: parsers de TOTVS/Sankhya/Omie só alimentam o padrão interno.
create table if not exists public.erp_classification_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  match_type text not null
    check (match_type in (
      'account_code',
      'account_name',
      'cost_center',
      'department',
      'description_exact',
      'description_contains'
    )),
  match_value text not null,
  money_group text not null
    check (money_group in ('revenue', 'cost', 'expense', 'investment')),
  destination_id uuid references public.budget_destinations (id) on delete set null,
  destination_name text not null,
  department_id uuid references public.departments (id) on delete set null,
  cost_center_id uuid references public.cost_centers (id) on delete set null,
  priority integer not null default 100,
  usage_count integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  last_classified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_classification_rules_value_not_blank
    check (length(trim(match_value)) > 0),
  constraint erp_classification_rules_name_not_blank
    check (length(trim(destination_name)) > 0)
);

create unique index if not exists erp_classification_rules_uidx
  on public.erp_classification_rules (
    company_id,
    match_type,
    lower(trim(match_value))
  );

create index if not exists erp_classification_rules_company_idx
  on public.erp_classification_rules (company_id)
  where is_active;

create table if not exists public.erp_import_errors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  import_id uuid not null references public.erp_imports (id) on delete cascade,
  row_number integer,
  field_name text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists erp_import_errors_import_id_idx
  on public.erp_import_errors (import_id);

-- ---------------------------------------------------------------------------
-- Isolamento: company_id coerente entre FKs
-- ---------------------------------------------------------------------------

create or replace function public.erp_entries_enforce_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  if new.import_id is not null then
    select company_id into v_company from public.erp_imports where id = new.import_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Importação ERP inválida para esta empresa';
    end if;
  end if;

  if new.destination_id is not null then
    select company_id into v_company
    from public.budget_destinations where id = new.destination_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Destino inválido para esta empresa';
    end if;
  end if;

  if new.department_id is not null then
    select company_id into v_company from public.departments where id = new.department_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Departamento inválido para esta empresa';
    end if;
  end if;

  if new.cost_center_id is not null then
    select company_id into v_company from public.cost_centers where id = new.cost_center_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Centro de custo inválido para esta empresa';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists erp_entries_enforce_company on public.erp_entries;
create trigger erp_entries_enforce_company
  before insert or update on public.erp_entries
  for each row execute function public.erp_entries_enforce_company();

create or replace function public.erp_classification_rules_enforce_company()
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
    select company_id into v_company from public.departments where id = new.department_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Departamento inválido para esta empresa';
    end if;
  end if;
  if new.cost_center_id is not null then
    select company_id into v_company from public.cost_centers where id = new.cost_center_id;
    if v_company is null or v_company <> new.company_id then
      raise exception 'Centro de custo inválido para esta empresa';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists erp_classification_rules_enforce_company
  on public.erp_classification_rules;
create trigger erp_classification_rules_enforce_company
  before insert or update on public.erp_classification_rules
  for each row execute function public.erp_classification_rules_enforce_company();

-- ---------------------------------------------------------------------------
-- Fingerprint + stats
-- ---------------------------------------------------------------------------

create or replace function public.erp_entry_fingerprint(
  p_company_id uuid,
  p_posted_at date,
  p_amount numeric,
  p_entry_side text,
  p_description text,
  p_account_code text,
  p_cost_center_code text,
  p_external_id text
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    digest(
      p_company_id::text || '|' ||
      coalesce(p_posted_at::text, '') || '|' ||
      coalesce(round(p_amount, 2)::text, '') || '|' ||
      coalesce(p_entry_side, '') || '|' ||
      public.normalize_transaction_description(coalesce(p_description, '')) || '|' ||
      lower(trim(coalesce(p_account_code, ''))) || '|' ||
      lower(trim(coalesce(p_cost_center_code, ''))) || '|' ||
      lower(trim(coalesce(p_external_id, ''))),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.erp_entries_set_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.fingerprint, '') = '' then
    new.fingerprint := public.erp_entry_fingerprint(
      new.company_id,
      new.posted_at,
      new.amount,
      new.entry_side,
      new.description,
      new.account_code,
      new.cost_center_code,
      new.external_id
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists erp_entries_set_fingerprint on public.erp_entries;
create trigger erp_entries_set_fingerprint
  before insert or update on public.erp_entries
  for each row execute function public.erp_entries_set_fingerprint();

create or replace function public.refresh_erp_import_stats(p_import_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.erp_imports where id = p_import_id;
  if v_company is null then
    return;
  end if;
  if not public.is_company_member(v_company) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  update public.erp_imports i
  set
    entry_count = coalesce(s.total, 0),
    classified_count = coalesce(s.classified, 0),
    pending_count = coalesce(s.pending, 0),
    ignored_count = coalesce(s.ignored, 0),
    revenue_count = coalesce(s.revenue, 0),
    cost_count = coalesce(s.cost, 0),
    expense_count = coalesce(s.expense, 0),
    investment_count = coalesce(s.investment, 0),
    period_start = s.period_start,
    period_end = s.period_end,
    updated_at = now()
  from (
    select
      count(*)::integer as total,
      count(*) filter (where status = 'classified')::integer as classified,
      count(*) filter (where status = 'pending')::integer as pending,
      count(*) filter (where status = 'ignored')::integer as ignored,
      count(*) filter (where money_group = 'revenue')::integer as revenue,
      count(*) filter (where money_group = 'cost')::integer as cost,
      count(*) filter (where money_group = 'expense')::integer as expense,
      count(*) filter (where money_group = 'investment')::integer as investment,
      min(posted_at) as period_start,
      max(posted_at) as period_end
    from public.erp_entries
    where import_id = p_import_id
  ) s
  where i.id = p_import_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sugestões de classificação (nunca aplica sozinha)
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
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  -- 1) Conta contábil (código)
  update public.erp_entries e
  set
    suggested_money_group = r.money_group,
    suggested_destination_id = r.destination_id,
    suggested_destination_name = r.destination_name,
    suggested_department_id = coalesce(r.department_id, e.suggested_department_id),
    suggested_cost_center_id = coalesce(r.cost_center_id, e.suggested_cost_center_id),
    suggestion_source = 'rule',
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

  -- 2) Conta contábil (nome)
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

  -- 3) Centro de custo
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

  -- 4) Descrição exata
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

  -- 5) Descrição contém
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
-- Importação em lote (dedupe por fingerprint)
-- ---------------------------------------------------------------------------

create or replace function public.import_erp_entries(
  p_company_id uuid,
  p_import_id uuid,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_errors integer := 0;
  v_closed integer := 0;
  v_fingerprint text;
  v_posted date;
  v_amount numeric(14, 2);
  v_side text;
  v_type text;
  v_description text;
  v_external_id text;
  v_account_code text;
  v_cost_center_code text;
  v_warnings jsonb := '[]'::jsonb;
  v_ids uuid[] := array[]::uuid[];
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if not exists (
    select 1 from public.erp_imports
    where id = p_import_id and company_id = p_company_id
  ) then
    raise exception 'Importação ERP não encontrada';
  end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Lançamentos inválidos';
  end if;

  if jsonb_array_length(p_entries) > 5000 then
    raise exception 'Lote excede o limite de 5000 lançamentos. Envie em partes.';
  end if;

  for v_item in select elem from jsonb_array_elements(p_entries) as t(elem)
  loop
    begin
      v_posted := (v_item->>'posted_at')::date;
      v_amount := round(coalesce(v_item->>'amount', '0')::numeric, 2);
      v_side := coalesce(nullif(v_item->>'entry_side', ''), 'unknown');
      v_type := coalesce(nullif(v_item->>'type', ''), 'unknown');
      v_description := left(
        btrim(regexp_replace(coalesce(v_item->>'description', ''), '^[=+\-@|]+', '')),
        500
      );
      v_external_id := nullif(btrim(coalesce(v_item->>'external_id', '')), '');
      v_account_code := nullif(btrim(coalesce(v_item->>'account_code', '')), '');
      v_cost_center_code := nullif(btrim(coalesce(v_item->>'cost_center_code', '')), '');

      if v_posted is null or v_description = '' or v_amount < 0 then
        v_errors := v_errors + 1;
        continue;
      end if;

      if v_side not in ('debit', 'credit', 'unknown') then
        v_side := 'unknown';
      end if;
      if v_type not in ('income', 'expense', 'unknown') then
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
        if jsonb_array_length(v_warnings) < 20 then
          v_warnings := v_warnings || jsonb_build_array(
            jsonb_build_object(
              'message',
              'Período ' || to_char(v_posted, 'MM/YYYY') || ' está fechado',
              'posted_at', v_posted
            )
          );
        end if;
        continue;
      end if;

      v_fingerprint := public.erp_entry_fingerprint(
        p_company_id,
        v_posted,
        v_amount,
        v_side,
        v_description,
        v_account_code,
        v_cost_center_code,
        v_external_id
      );

      insert into public.erp_entries (
        company_id,
        import_id,
        posted_at,
        description,
        amount,
        entry_side,
        type,
        account_code,
        account_name,
        cost_center_code,
        cost_center_name,
        department_name,
        document_number,
        external_id,
        fingerprint,
        raw,
        suggested_money_group,
        suggested_destination_name,
        suggestion_source,
        status
      )
      values (
        p_company_id,
        p_import_id,
        v_posted,
        v_description,
        v_amount,
        v_side,
        v_type,
        v_account_code,
        nullif(btrim(coalesce(v_item->>'account_name', '')), ''),
        v_cost_center_code,
        nullif(btrim(coalesce(v_item->>'cost_center_name', '')), ''),
        nullif(btrim(coalesce(v_item->>'department_name', '')), ''),
        nullif(btrim(coalesce(v_item->>'document_number', '')), ''),
        v_external_id,
        v_fingerprint,
        coalesce(v_item->'raw', '{}'::jsonb),
        nullif(v_item->>'suggested_money_group', ''),
        nullif(btrim(coalesce(v_item->>'suggested_destination_name', '')), ''),
        nullif(v_item->>'suggestion_source', ''),
        'pending'
      )
      returning id into v_new_id;

      v_inserted := v_inserted + 1;
      v_ids := array_append(v_ids, v_new_id);
    exception
      when unique_violation then
        v_duplicates := v_duplicates + 1;
      when others then
        v_errors := v_errors + 1;
    end;
  end loop;

  if array_length(v_ids, 1) is not null then
    perform public.apply_erp_classification_suggestions(p_company_id, v_ids);
  end if;

  perform public.refresh_erp_import_stats(p_import_id);

  update public.erp_imports
  set
    duplicate_count = coalesce(duplicate_count, 0) + v_duplicates,
    error_count = coalesce(error_count, 0) + v_errors,
    warnings = case
      when jsonb_array_length(warnings) = 0 then v_warnings
      else warnings || v_warnings
    end,
    updated_at = now()
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'duplicates', v_duplicates,
    'errors', v_errors,
    'closed_period', v_closed
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Classificação manual + aprendizado de regras
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

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
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

  update public.erp_imports i
  set updated_at = now()
  where i.company_id = p_company_id
    and i.id in (
      select distinct e.import_id
      from public.erp_entries e
      where e.company_id = p_company_id
        and e.id = any (p_entry_ids)
        and e.import_id is not null
    );

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

create or replace function public.delete_erp_import(
  p_company_id uuid,
  p_import_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_admin(p_company_id) then
    raise exception 'Apenas administradores podem excluir importações ERP';
  end if;

  if not exists (
    select 1 from public.erp_imports
    where id = p_import_id and company_id = p_company_id
  ) then
    raise exception 'Importação ERP não encontrada';
  end if;

  delete from public.erp_entries
  where company_id = p_company_id and import_id = p_import_id;

  delete from storage.objects
  where bucket_id = 'erp-imports'
    and name like (p_company_id::text || '/' || p_import_id::text || '/%');

  delete from public.erp_imports
  where id = p_import_id and company_id = p_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.erp_imports enable row level security;
alter table public.erp_entries enable row level security;
alter table public.erp_classification_rules enable row level security;
alter table public.erp_import_errors enable row level security;

drop policy if exists "erp_imports_all_member" on public.erp_imports;
create policy "erp_imports_all_member"
  on public.erp_imports for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "erp_imports_delete_admin" on public.erp_imports;
create policy "erp_imports_delete_admin"
  on public.erp_imports for delete to authenticated
  using (public.is_company_admin(company_id));

drop policy if exists "erp_entries_all_member" on public.erp_entries;
create policy "erp_entries_all_member"
  on public.erp_entries for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "erp_classification_rules_all_member"
  on public.erp_classification_rules;
create policy "erp_classification_rules_all_member"
  on public.erp_classification_rules for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists "erp_import_errors_all_member" on public.erp_import_errors;
create policy "erp_import_errors_all_member"
  on public.erp_import_errors for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

grant select, insert, update, delete on table public.erp_imports to authenticated;
grant select, insert, update, delete on table public.erp_entries to authenticated;
grant select, insert, update, delete on table public.erp_classification_rules to authenticated;
grant select, insert, update, delete on table public.erp_import_errors to authenticated;

revoke all on function public.erp_entry_fingerprint(uuid, date, numeric, text, text, text, text, text) from public;
grant execute on function public.erp_entry_fingerprint(uuid, date, numeric, text, text, text, text, text) to authenticated;

revoke all on function public.refresh_erp_import_stats(uuid) from public;
grant execute on function public.refresh_erp_import_stats(uuid) to authenticated;

revoke all on function public.apply_erp_classification_suggestions(uuid, uuid[]) from public;
grant execute on function public.apply_erp_classification_suggestions(uuid, uuid[]) to authenticated;

revoke all on function public.import_erp_entries(uuid, uuid, jsonb) from public;
grant execute on function public.import_erp_entries(uuid, uuid, jsonb) to authenticated;

revoke all on function public.classify_erp_entries(uuid, uuid[], text, uuid, text, uuid, uuid, text, text, boolean) from public;
grant execute on function public.classify_erp_entries(uuid, uuid[], text, uuid, text, uuid, uuid, text, text, boolean) to authenticated;

revoke all on function public.delete_erp_import(uuid, uuid) from public;
grant execute on function public.delete_erp_import(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'erp-imports',
  'erp-imports',
  false,
  31457280,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain',
    'application/csv',
    'application/x-ofx',
    'application/ofx',
    'application/xml',
    'text/xml',
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "erp_imports_storage_select_member" on storage.objects;
create policy "erp_imports_storage_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'erp-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "erp_imports_storage_insert_member" on storage.objects;
create policy "erp_imports_storage_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'erp-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "erp_imports_storage_update_member" on storage.objects;
create policy "erp_imports_storage_update_member"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'erp-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  )
  with check (
    bucket_id = 'erp-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "erp_imports_storage_delete_admin" on storage.objects;
create policy "erp_imports_storage_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'erp-imports'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );
