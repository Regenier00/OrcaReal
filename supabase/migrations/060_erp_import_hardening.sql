-- Hardening do importador ERP: writer role, RLS split, mapeamento de colunas
-- (inspirado no base_import do Odoo), sanitização e limites.

-- ---------------------------------------------------------------------------
-- Writer = owner/admin/member (exclui viewer)
-- ---------------------------------------------------------------------------

create or replace function public.is_company_writer(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = p_company_id
      and cu.user_id = auth.uid()
      and cu.role in ('owner', 'admin', 'member')
  );
$$;

revoke all on function public.is_company_writer(uuid) from public;
grant execute on function public.is_company_writer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Mapeamento salvo de cabeçalhos → campos (padrão Odoo base_import.mapping)
-- ---------------------------------------------------------------------------

create table if not exists public.erp_column_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  header_normalized text not null,
  field_role text not null
    check (field_role in (
      'date',
      'description',
      'amount',
      'debit',
      'credit',
      'account',
      'cost_center',
      'ignore'
    )),
  usage_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_column_mappings_header_not_blank
    check (length(trim(header_normalized)) > 0)
);

create unique index if not exists erp_column_mappings_uidx
  on public.erp_column_mappings (company_id, header_normalized);

create index if not exists erp_column_mappings_company_idx
  on public.erp_column_mappings (company_id);

alter table public.erp_column_mappings enable row level security;

-- ---------------------------------------------------------------------------
-- Limites de comprimento nas colunas de texto
-- ---------------------------------------------------------------------------

do $$
begin
  alter table public.erp_entries
    add constraint erp_entries_account_code_len
      check (account_code is null or char_length(account_code) <= 80);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.erp_entries
    add constraint erp_entries_account_name_len
      check (account_name is null or char_length(account_name) <= 200);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.erp_entries
    add constraint erp_entries_cost_center_code_len
      check (cost_center_code is null or char_length(cost_center_code) <= 80);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.erp_entries
    add constraint erp_entries_cost_center_name_len
      check (cost_center_name is null or char_length(cost_center_name) <= 200);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.erp_entries
    add constraint erp_entries_department_name_len
      check (department_name is null or char_length(department_name) <= 200);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.erp_entries
    add constraint erp_entries_document_number_len
      check (document_number is null or char_length(document_number) <= 80);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.erp_entries
    add constraint erp_entries_external_id_len
      check (external_id is null or char_length(external_id) <= 120);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Sanitização anti-fórmula (planilhas) — igual ao Odoo/extratos, em todos os textos
-- ---------------------------------------------------------------------------

create or replace function public.sanitize_spreadsheet_text(p_value text, p_max integer default 200)
returns text
language sql
immutable
as $$
  select left(
    btrim(
      regexp_replace(
        regexp_replace(coalesce(p_value, ''), E'^[\\uFEFF\\t\\r\\n ]+', ''),
        '^[=+\-@|]+',
        ''
      )
    ),
    greatest(coalesce(p_max, 200), 1)
  );
$$;

revoke all on function public.sanitize_spreadsheet_text(text, integer) from public;
grant execute on function public.sanitize_spreadsheet_text(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Fingerprint: sempre recalcula (ignora valor do cliente)
-- ---------------------------------------------------------------------------

create or replace function public.erp_entries_set_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS split: select member · write writer · delete admin
-- ---------------------------------------------------------------------------

drop policy if exists "erp_imports_all_member" on public.erp_imports;
drop policy if exists "erp_imports_delete_admin" on public.erp_imports;
drop policy if exists "erp_imports_select_member" on public.erp_imports;
drop policy if exists "erp_imports_insert_writer" on public.erp_imports;
drop policy if exists "erp_imports_update_writer" on public.erp_imports;

create policy "erp_imports_select_member"
  on public.erp_imports for select to authenticated
  using (public.is_company_member(company_id));

create policy "erp_imports_insert_writer"
  on public.erp_imports for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "erp_imports_update_writer"
  on public.erp_imports for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "erp_imports_delete_admin"
  on public.erp_imports for delete to authenticated
  using (public.is_company_admin(company_id));

drop policy if exists "erp_entries_all_member" on public.erp_entries;
drop policy if exists "erp_entries_select_member" on public.erp_entries;
drop policy if exists "erp_entries_insert_writer" on public.erp_entries;
drop policy if exists "erp_entries_update_writer" on public.erp_entries;
drop policy if exists "erp_entries_delete_admin" on public.erp_entries;

create policy "erp_entries_select_member"
  on public.erp_entries for select to authenticated
  using (public.is_company_member(company_id));

create policy "erp_entries_insert_writer"
  on public.erp_entries for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "erp_entries_update_writer"
  on public.erp_entries for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "erp_entries_delete_admin"
  on public.erp_entries for delete to authenticated
  using (public.is_company_admin(company_id));

drop policy if exists "erp_classification_rules_all_member"
  on public.erp_classification_rules;
drop policy if exists "erp_classification_rules_select_member"
  on public.erp_classification_rules;
drop policy if exists "erp_classification_rules_insert_writer"
  on public.erp_classification_rules;
drop policy if exists "erp_classification_rules_update_writer"
  on public.erp_classification_rules;
drop policy if exists "erp_classification_rules_delete_writer"
  on public.erp_classification_rules;

create policy "erp_classification_rules_select_member"
  on public.erp_classification_rules for select to authenticated
  using (public.is_company_member(company_id));

create policy "erp_classification_rules_insert_writer"
  on public.erp_classification_rules for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "erp_classification_rules_update_writer"
  on public.erp_classification_rules for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "erp_classification_rules_delete_writer"
  on public.erp_classification_rules for delete to authenticated
  using (public.is_company_writer(company_id));

drop policy if exists "erp_import_errors_all_member" on public.erp_import_errors;
drop policy if exists "erp_import_errors_select_member" on public.erp_import_errors;
drop policy if exists "erp_import_errors_insert_writer" on public.erp_import_errors;
drop policy if exists "erp_import_errors_delete_admin" on public.erp_import_errors;

create policy "erp_import_errors_select_member"
  on public.erp_import_errors for select to authenticated
  using (public.is_company_member(company_id));

create policy "erp_import_errors_insert_writer"
  on public.erp_import_errors for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "erp_import_errors_delete_admin"
  on public.erp_import_errors for delete to authenticated
  using (public.is_company_admin(company_id));

drop policy if exists "erp_column_mappings_select_member" on public.erp_column_mappings;
drop policy if exists "erp_column_mappings_insert_writer" on public.erp_column_mappings;
drop policy if exists "erp_column_mappings_update_writer" on public.erp_column_mappings;
drop policy if exists "erp_column_mappings_delete_writer" on public.erp_column_mappings;

create policy "erp_column_mappings_select_member"
  on public.erp_column_mappings for select to authenticated
  using (public.is_company_member(company_id));

create policy "erp_column_mappings_insert_writer"
  on public.erp_column_mappings for insert to authenticated
  with check (public.is_company_writer(company_id));

create policy "erp_column_mappings_update_writer"
  on public.erp_column_mappings for update to authenticated
  using (public.is_company_writer(company_id))
  with check (public.is_company_writer(company_id));

create policy "erp_column_mappings_delete_writer"
  on public.erp_column_mappings for delete to authenticated
  using (public.is_company_writer(company_id));

grant select, insert, update, delete on table public.erp_column_mappings to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: insert/update só writer; path com UUID da empresa
-- ---------------------------------------------------------------------------

drop policy if exists "erp_imports_storage_select_member" on storage.objects;
drop policy if exists "erp_imports_storage_insert_member" on storage.objects;
drop policy if exists "erp_imports_storage_insert_writer" on storage.objects;
drop policy if exists "erp_imports_storage_update_member" on storage.objects;
drop policy if exists "erp_imports_storage_update_writer" on storage.objects;
drop policy if exists "erp_imports_storage_delete_admin" on storage.objects;

create policy "erp_imports_storage_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'erp-imports'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

create policy "erp_imports_storage_insert_writer"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'erp-imports'
    and public.is_company_writer(((string_to_array(name, '/'))[1])::uuid)
    and cardinality(string_to_array(name, '/')) >= 3
  );

create policy "erp_imports_storage_update_writer"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'erp-imports'
    and public.is_company_writer(((string_to_array(name, '/'))[1])::uuid)
  )
  with check (
    bucket_id = 'erp-imports'
    and public.is_company_writer(((string_to_array(name, '/'))[1])::uuid)
  );

create policy "erp_imports_storage_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'erp-imports'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );

-- MIME mais restrito (sem XML genérico / excel legado desnecessário)
update storage.buckets
set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/csv',
    'application/octet-stream'
  ]
where id = 'erp-imports';

-- ---------------------------------------------------------------------------
-- RPCs: writer nas mutações; lote 2000; sanitização completa
-- ---------------------------------------------------------------------------

create or replace function public.save_erp_column_mappings(
  p_company_id uuid,
  p_mappings jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_header text;
  v_role text;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para salvar mapeamentos nesta empresa';
  end if;
  if p_mappings is null or jsonb_typeof(p_mappings) <> 'array' then
    raise exception 'Mapeamentos inválidos';
  end if;
  if jsonb_array_length(p_mappings) > 80 then
    raise exception 'Muitos mapeamentos de coluna';
  end if;

  for v_item in select elem from jsonb_array_elements(p_mappings) as t(elem)
  loop
    v_header := lower(trim(coalesce(v_item->>'header', '')));
    v_role := coalesce(nullif(v_item->>'role', ''), 'ignore');
    if v_header = '' then
      continue;
    end if;
    if v_role not in (
      'date', 'description', 'amount', 'debit', 'credit',
      'account', 'cost_center', 'ignore'
    ) then
      continue;
    end if;

    insert into public.erp_column_mappings (
      company_id, header_normalized, field_role, created_by, usage_count, last_used_at
    )
    values (
      p_company_id, v_header, v_role, auth.uid(), 1, now()
    )
    on conflict (company_id, header_normalized)
    do update set
      field_role = excluded.field_role,
      usage_count = public.erp_column_mappings.usage_count + 1,
      last_used_at = now(),
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.save_erp_column_mappings(uuid, jsonb) from public;
grant execute on function public.save_erp_column_mappings(uuid, jsonb) to authenticated;

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
  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para classificar nesta empresa';
  end if;

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
  v_payload_bytes integer;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para importar nesta empresa';
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

  if jsonb_array_length(p_entries) > 2000 then
    raise exception 'Lote excede o limite de 2000 lançamentos. Envie em partes.';
  end if;

  v_payload_bytes := pg_column_size(p_entries);
  if v_payload_bytes > 4 * 1024 * 1024 then
    raise exception 'Lote excede o limite seguro de tamanho (4 MB).';
  end if;

  for v_item in select elem from jsonb_array_elements(p_entries) as t(elem)
  loop
    begin
      v_posted := (v_item->>'posted_at')::date;
      v_amount := round(coalesce(v_item->>'amount', '0')::numeric, 2);
      v_side := coalesce(nullif(v_item->>'entry_side', ''), 'unknown');
      v_type := coalesce(nullif(v_item->>'type', ''), 'unknown');
      v_description := public.sanitize_spreadsheet_text(v_item->>'description', 500);
      v_external_id := nullif(
        public.sanitize_spreadsheet_text(v_item->>'external_id', 120),
        ''
      );
      v_account_code := nullif(
        public.sanitize_spreadsheet_text(v_item->>'account_code', 80),
        ''
      );
      v_cost_center_code := nullif(
        public.sanitize_spreadsheet_text(v_item->>'cost_center_code', 80),
        ''
      );

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
        nullif(public.sanitize_spreadsheet_text(v_item->>'account_name', 200), ''),
        v_cost_center_code,
        nullif(public.sanitize_spreadsheet_text(v_item->>'cost_center_name', 200), ''),
        nullif(public.sanitize_spreadsheet_text(v_item->>'department_name', 200), ''),
        nullif(public.sanitize_spreadsheet_text(v_item->>'document_number', 80), ''),
        v_external_id,
        v_fingerprint,
        jsonb_build_object(
          'row', coalesce(v_item->'raw'->>'row', null),
          'source', 'erp'
        ),
        nullif(v_item->>'suggested_money_group', ''),
        nullif(public.sanitize_spreadsheet_text(v_item->>'suggested_destination_name', 200), ''),
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
