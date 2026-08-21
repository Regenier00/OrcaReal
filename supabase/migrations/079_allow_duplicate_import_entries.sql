-- Permite importar lançamentos duplicados (ERP e extrato).
-- Fingerprint continua sendo calculado no servidor (não confiar no cliente),
-- mas deixa de ser UNIQUE: se o arquivo tiver linhas iguais, todas entram.
-- Segurança preservada: writer-only, sanitização, limites de lote/tamanho,
-- checagem de empresa/import e períodos fechados.

-- ---------------------------------------------------------------------------
-- Índices: fingerprint/external_id passam a ser não-únicos
-- ---------------------------------------------------------------------------

drop index if exists public.erp_entries_fingerprint_idx;
create index if not exists erp_entries_fingerprint_idx
  on public.erp_entries (company_id, fingerprint);

drop index if exists public.actual_transactions_fingerprint_idx;
create index if not exists actual_transactions_fingerprint_idx
  on public.actual_transactions (company_id, fingerprint);

drop index if exists public.actual_transactions_external_id_idx;
create index if not exists actual_transactions_external_id_idx
  on public.actual_transactions (bank_account_id, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- Extrato: fingerprint sempre recalculado no servidor
-- ---------------------------------------------------------------------------

create or replace function public.actual_transactions_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'transfer' then
    new.type := public.actual_type_from_transfer(new.description);
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

  -- Sempre recalcula (ignora fingerprint enviado pelo cliente).
  new.fingerprint := public.actual_transaction_fingerprint(
    new.company_id,
    new.bank_account_id,
    new.posted_at,
    new.amount,
    new.type,
    new.description,
    new.external_id
  );

  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Extrato: importação sem descartar duplicados (+ hardening writer/limites)
-- ---------------------------------------------------------------------------

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
  v_errors integer := 0;
  v_closed integer := 0;
  v_posted date;
  v_amount numeric(14, 2);
  v_type text;
  v_description text;
  v_external_id text;
  v_warnings jsonb := '[]'::jsonb;
  v_payload_bytes integer;
  v_new_id uuid;
  v_ids uuid[] := array[]::uuid[];
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para importar nesta empresa';
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

  if jsonb_array_length(p_transactions) > 10000 then
    raise exception 'Lote excede o limite de 10000 lançamentos.';
  end if;

  v_payload_bytes := pg_column_size(p_transactions);
  if v_payload_bytes > 8 * 1024 * 1024 then
    raise exception 'Lote excede o limite seguro de tamanho (8 MB).';
  end if;

  for v_item in select elem from jsonb_array_elements(p_transactions) as t(elem)
  loop
    begin
      v_posted := (v_item->>'posted_at')::date;
      v_amount := round(coalesce(v_item->>'amount', '0')::numeric, 2);
      v_type := coalesce(nullif(v_item->>'type', ''), 'unknown');
      v_description := public.sanitize_spreadsheet_text(v_item->>'description', 500);
      v_external_id := nullif(
        public.sanitize_spreadsheet_text(v_item->>'external_id', 120),
        ''
      );

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
        -- placeholder; trigger recalcula no servidor
        '',
        nullif(public.sanitize_spreadsheet_text(v_item->>'document_number', 80), ''),
        nullif(public.sanitize_spreadsheet_text(v_item->>'counterparty', 200), ''),
        jsonb_build_object(
          'row', coalesce(v_item->'raw'->>'row', null),
          'source', 'statement'
        )
      )
      returning id into v_new_id;

      v_inserted := v_inserted + 1;
      v_ids := array_append(v_ids, v_new_id);
    exception
      when others then
        v_errors := v_errors + 1;
    end;
  end loop;

  if array_length(v_ids, 1) is not null then
    perform public.apply_classification_suggestions(p_company_id, v_ids);
  end if;

  perform public.refresh_statement_import_stats(p_import_id);

  update public.statement_imports
  set
    duplicate_count = 0,
    error_count = v_errors,
    warnings = case
      when jsonb_array_length(coalesce(warnings, '[]'::jsonb)) = 0 then v_warnings
      else coalesce(warnings, '[]'::jsonb) || v_warnings
    end,
    updated_at = now()
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'duplicates', 0,
    'errors', v_errors,
    'closed_period', v_closed
  );
end;
$$;

revoke all on function public.import_actual_transactions(uuid, uuid, jsonb) from public;
grant execute on function public.import_actual_transactions(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- ERP: importação sem descartar duplicados (mantém hardening existente)
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
  v_errors integer := 0;
  v_closed integer := 0;
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
        -- placeholder; trigger recalcula no servidor
        '',
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
    duplicate_count = 0,
    error_count = coalesce(error_count, 0) + v_errors,
    warnings = case
      when jsonb_array_length(coalesce(warnings, '[]'::jsonb)) = 0 then v_warnings
      else coalesce(warnings, '[]'::jsonb) || v_warnings
    end,
    updated_at = now()
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'duplicates', 0,
    'errors', v_errors,
    'closed_period', v_closed
  );
end;
$$;

revoke all on function public.import_erp_entries(uuid, uuid, jsonb) from public;
grant execute on function public.import_erp_entries(uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
