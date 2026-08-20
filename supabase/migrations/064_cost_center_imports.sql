-- Importação segura de centros de custo (somente XLSX).
-- Validação de tipo/tamanho no edge function; persistência via RPC + RLS.

-- ---------------------------------------------------------------------------
-- Código: preserva código informado na importação; senão gera sequencial
-- ---------------------------------------------------------------------------

create or replace function public.assign_cost_center_code()
returns trigger
language plpgsql
as $$
declare
  v_next integer;
  v_code text := nullif(trim(coalesce(new.code, '')), '');
begin
  if v_code is not null then
    new.code := left(v_code, 80);
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.company_id::text));

  select coalesce(max(code::integer), 0) + 1
    into v_next
  from public.cost_centers
  where company_id = new.company_id
    and code ~ '^[0-9]+$';

  new.code := lpad(v_next::text, greatest(3, length(v_next::text)), '0');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS mais restrita em cost_centers: leitura membro; escrita admin
-- ---------------------------------------------------------------------------

drop policy if exists "cost_centers_all_member" on public.cost_centers;

drop policy if exists "cost_centers_select_member" on public.cost_centers;
create policy "cost_centers_select_member"
  on public.cost_centers for select to authenticated
  using (public.is_company_member(company_id));

drop policy if exists "cost_centers_insert_admin" on public.cost_centers;
create policy "cost_centers_insert_admin"
  on public.cost_centers for insert to authenticated
  with check (public.is_company_admin(company_id));

drop policy if exists "cost_centers_update_admin" on public.cost_centers;
create policy "cost_centers_update_admin"
  on public.cost_centers for update to authenticated
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

drop policy if exists "cost_centers_delete_admin" on public.cost_centers;
create policy "cost_centers_delete_admin"
  on public.cost_centers for delete to authenticated
  using (public.is_company_admin(company_id));

-- ---------------------------------------------------------------------------
-- Tabela de auditoria das importações
-- ---------------------------------------------------------------------------

create table if not exists public.cost_center_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  file_name text not null,
  file_path text,
  file_size integer,
  file_type text not null default 'xlsx'
    check (file_type = 'xlsx'),
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
  destinations_ensured integer not null default 0,
  error_message text,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint cost_center_imports_file_name_len
    check (char_length(file_name) <= 240),
  constraint cost_center_imports_file_size_max
    check (file_size is null or (file_size > 0 and file_size <= 5242880))
);

create index if not exists cost_center_imports_company_id_idx
  on public.cost_center_imports (company_id, created_at desc);

alter table public.cost_center_imports enable row level security;

drop policy if exists "cost_center_imports_select_member" on public.cost_center_imports;
create policy "cost_center_imports_select_member"
  on public.cost_center_imports for select to authenticated
  using (public.is_company_member(company_id));

drop policy if exists "cost_center_imports_insert_admin" on public.cost_center_imports;
create policy "cost_center_imports_insert_admin"
  on public.cost_center_imports for insert to authenticated
  with check (public.is_company_admin(company_id));

drop policy if exists "cost_center_imports_update_admin" on public.cost_center_imports;
create policy "cost_center_imports_update_admin"
  on public.cost_center_imports for update to authenticated
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

drop policy if exists "cost_center_imports_delete_admin" on public.cost_center_imports;
create policy "cost_center_imports_delete_admin"
  on public.cost_center_imports for delete to authenticated
  using (public.is_company_admin(company_id));

grant select, insert, update, delete on table public.cost_center_imports to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket (somente XLSX, 5 MB)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cost-center-imports',
  'cost-center-imports',
  false,
  5242880,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
    'application/zip'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cost_center_imports_storage_select_member" on storage.objects;
create policy "cost_center_imports_storage_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'cost-center-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "cost_center_imports_storage_insert_admin" on storage.objects;
create policy "cost_center_imports_storage_insert_admin"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cost-center-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "cost_center_imports_storage_update_admin" on storage.objects;
create policy "cost_center_imports_storage_update_admin"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'cost-center-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  )
  with check (
    bucket_id = 'cost-center-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "cost_center_imports_storage_delete_admin" on storage.objects;
create policy "cost_center_imports_storage_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'cost-center-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Resolver centro de custo cadastrado (para destinos / apropriação do realizado)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_company_cost_center(
  p_company_id uuid,
  p_name text default null,
  p_code text default null
)
returns table (cost_center_id uuid, cost_center_name text, cost_center_code text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text := nullif(public.sanitize_spreadsheet_text(p_name, 200), '');
  v_code text := nullif(public.sanitize_spreadsheet_text(p_code, 80), '');
  v_id uuid;
  v_cc_name text;
  v_cc_code text;
begin
  if p_company_id is null then
    return;
  end if;

  if v_code is not null then
    select cc.id, cc.name, cc.code
      into v_id, v_cc_name, v_cc_code
    from public.cost_centers cc
    where cc.company_id = p_company_id
      and cc.is_active
      and lower(trim(cc.code)) = lower(v_code)
    order by cc.created_at asc
    limit 1;

    if v_id is not null then
      cost_center_id := v_id;
      cost_center_name := v_cc_name;
      cost_center_code := v_cc_code;
      return next;
      return;
    end if;
  end if;

  if v_name is not null then
    select cc.id, cc.name, cc.code
      into v_id, v_cc_name, v_cc_code
    from public.cost_centers cc
    where cc.company_id = p_company_id
      and cc.is_active
      and lower(trim(cc.name)) = lower(v_name)
    order by cc.created_at asc
    limit 1;

    if v_id is not null then
      cost_center_id := v_id;
      cost_center_name := v_cc_name;
      cost_center_code := v_cc_code;
      return next;
      return;
    end if;
  end if;

  return;
end;
$$;

revoke all on function public.resolve_company_cost_center(uuid, text, text) from public;
grant execute on function public.resolve_company_cost_center(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: upsert dos centros + seed de destinos (todos os money_groups)
-- ---------------------------------------------------------------------------

create or replace function public.import_company_cost_centers(
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
  v_name text;
  v_code text;
  v_description text;
  v_cc_id uuid;
  v_existing_name text;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_destinations integer := 0;
  v_group text;
  v_payload_bytes integer;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_admin(p_company_id) then
    raise exception 'Somente administradores podem importar centros de custo';
  end if;

  if not exists (
    select 1
    from public.cost_center_imports i
    where i.id = p_import_id
      and i.company_id = p_company_id
  ) then
    raise exception 'Importação não encontrada';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Linhas inválidas';
  end if;

  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'A planilha excede o limite de 5000 centros de custo';
  end if;

  v_payload_bytes := pg_column_size(p_rows);
  if v_payload_bytes > 2 * 1024 * 1024 then
    raise exception 'Lote excede o limite seguro de tamanho (2 MB).';
  end if;

  for v_item in select elem from jsonb_array_elements(p_rows) as t(elem)
  loop
    v_name := nullif(public.sanitize_spreadsheet_text(v_item->>'name', 200), '');
    v_code := nullif(public.sanitize_spreadsheet_text(v_item->>'code', 80), '');
    v_description := nullif(
      public.sanitize_spreadsheet_text(v_item->>'description', 500),
      ''
    );

    if v_name is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_cc_id := null;
    v_existing_name := null;

    if v_code is not null then
      select cc.id, cc.name
        into v_cc_id, v_existing_name
      from public.cost_centers cc
      where cc.company_id = p_company_id
        and lower(trim(cc.code)) = lower(v_code)
      order by cc.created_at asc
      limit 1;
    end if;

    if v_cc_id is null then
      select cc.id, cc.name
        into v_cc_id, v_existing_name
      from public.cost_centers cc
      where cc.company_id = p_company_id
        and lower(trim(cc.name)) = lower(v_name)
      order by cc.created_at asc
      limit 1;
    end if;

    if v_cc_id is null then
      insert into public.cost_centers (
        company_id,
        name,
        code,
        description,
        is_active
      )
      values (
        p_company_id,
        v_name,
        v_code,
        v_description,
        true
      )
      returning id into v_cc_id;
      v_inserted := v_inserted + 1;
    else
      update public.cost_centers
      set
        name = v_name,
        description = coalesce(v_description, description),
        code = coalesce(v_code, code),
        is_active = true,
        updated_at = now()
      where id = v_cc_id
        and company_id = p_company_id;
      v_updated := v_updated + 1;
    end if;

    foreach v_group in array array['revenue', 'cost', 'expense', 'investment']
    loop
      perform public.ensure_budget_destination(p_company_id, v_group, v_name);
      v_destinations := v_destinations + 1;
    end loop;
  end loop;

  update public.cost_center_imports
  set
    status = 'completed',
    row_count = v_inserted + v_updated,
    inserted_count = v_inserted,
    updated_count = v_updated,
    skipped_count = v_skipped,
    destinations_ensured = v_destinations,
    error_message = null,
    processed_at = now(),
    updated_at = now()
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'destinations_ensured', v_destinations,
    'total', v_inserted + v_updated
  );
end;
$$;

revoke all on function public.import_company_cost_centers(uuid, uuid, jsonb) from public;
grant execute on function public.import_company_cost_centers(uuid, uuid, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- Vincula lançamentos ERP aos centros de custo cadastrados (destinos/apropriação)
-- ---------------------------------------------------------------------------

create or replace function public.link_erp_entries_to_company_cost_centers(
  p_company_id uuid,
  p_entry_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if p_entry_ids is null or array_length(p_entry_ids, 1) is null then
    return 0;
  end if;

  update public.erp_entries e
  set
    cost_center_id = coalesce(e.cost_center_id, r.cost_center_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, r.cost_center_id),
    destination_name = case
      when e.destination_name is not null
        and r.cost_center_name is not null
        and lower(trim(e.destination_name)) = lower(trim(coalesce(e.cost_center_name, e.cost_center_code, e.destination_name)))
      then r.cost_center_name
      else e.destination_name
    end,
    suggested_destination_name = case
      when e.suggested_destination_name is not null
        and r.cost_center_name is not null
        and (
          lower(trim(e.suggested_destination_name)) = lower(trim(coalesce(e.cost_center_name, '')))
          or lower(trim(e.suggested_destination_name)) = lower(trim(coalesce(e.cost_center_code, '')))
        )
      then r.cost_center_name
      else e.suggested_destination_name
    end,
    updated_at = now()
  from lateral public.resolve_company_cost_center(
    p_company_id,
    e.cost_center_name,
    e.cost_center_code
  ) r
  where e.company_id = p_company_id
    and e.id = any (p_entry_ids)
    and r.cost_center_id is not null
    and (
      e.cost_center_id is null
      or e.suggested_cost_center_id is null
      or (
        e.destination_name is not null
        and lower(trim(e.destination_name)) <> lower(trim(r.cost_center_name))
        and (
          lower(trim(e.destination_name)) = lower(trim(coalesce(e.cost_center_name, '')))
          or lower(trim(e.destination_name)) = lower(trim(coalesce(e.cost_center_code, '')))
        )
      )
    );

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.link_erp_entries_to_company_cost_centers(uuid, uuid[]) from public;
grant execute on function public.link_erp_entries_to_company_cost_centers(uuid, uuid[]) to authenticated;

-- Apropriação ERP: destino = centro de custo do arquivo, preferindo cadastro mestre
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
  v_row record;
  v_dest_name text;
  v_dest_id uuid;
  v_resolved record;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;
  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para classificar nesta empresa';
  end if;

  for v_row in
    select distinct on (e2.id)
      e2.id as entry_id,
      e2.cost_center_name,
      e2.cost_center_code,
      e2.account_name,
      c.money_group,
      c.match_kind,
      c.account_code as matched_code,
      c.department_id,
      c.cost_center_id
    from public.erp_entries e2
    inner join public.company_chart_accounts c
      on c.company_id = e2.company_id
     and c.is_active
     and e2.account_code is not null
     and (
       (
         c.match_kind = 'exact'
         and lower(trim(e2.account_code)) = lower(trim(c.account_code))
       )
       or (
         c.match_kind = 'prefix'
         and lower(trim(e2.account_code)) like lower(trim(c.account_code)) || '%'
       )
     )
    where e2.company_id = p_company_id
      and e2.id = any (p_entry_ids)
      and e2.status = 'pending'
    order by
      e2.id,
      case when c.match_kind = 'exact' then 0 else 1 end,
      length(trim(c.account_code)) desc,
      c.priority asc,
      c.created_at asc
  loop
    select *
      into v_resolved
    from public.resolve_company_cost_center(
      p_company_id,
      v_row.cost_center_name,
      v_row.cost_center_code
    )
    limit 1;

    v_dest_name := coalesce(
      nullif(v_resolved.cost_center_name, ''),
      public.erp_entry_destination_name(
        v_row.cost_center_name,
        v_row.cost_center_code,
        v_row.account_name,
        'Sem centro de custo'
      )
    );
    v_dest_id := public.ensure_budget_destination(
      p_company_id,
      v_row.money_group,
      v_dest_name
    );

    update public.erp_entries e
    set
      money_group = v_row.money_group,
      destination_id = v_dest_id,
      destination_name = v_dest_name,
      department_id = coalesce(v_row.department_id, e.department_id),
      cost_center_id = coalesce(
        v_resolved.cost_center_id,
        v_row.cost_center_id,
        e.cost_center_id
      ),
      type = case
        when v_row.money_group = 'revenue' then 'income'
        else 'expense'
      end,
      status = 'classified',
      classified_at = now(),
      classified_by = v_user,
      suggested_money_group = v_row.money_group,
      suggested_destination_id = v_dest_id,
      suggested_destination_name = v_dest_name,
      suggested_department_id = coalesce(v_row.department_id, e.suggested_department_id),
      suggested_cost_center_id = coalesce(
        v_resolved.cost_center_id,
        v_row.cost_center_id,
        e.suggested_cost_center_id
      ),
      suggestion_source = case
        when v_row.match_kind = 'exact' then 'chart'
        else 'prefix'
      end,
      updated_at = now()
    where e.id = v_row.entry_id
      and e.company_id = p_company_id
      and e.status = 'pending';
  end loop;

  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(
      e.suggested_destination_id,
      public.ensure_budget_destination(
        p_company_id,
        r.money_group,
        public.erp_entry_destination_name(
          e.cost_center_name,
          e.cost_center_code,
          e.account_name,
          r.destination_name
        )
      )
    ),
    suggested_destination_name = coalesce(
      e.suggested_destination_name,
      public.erp_entry_destination_name(
        e.cost_center_name,
        e.cost_center_code,
        e.account_name,
        r.destination_name
      )
    ),
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

  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, m.money_group),
    suggested_destination_name = coalesce(
      e.suggested_destination_name,
      public.erp_entry_destination_name(
        e.cost_center_name,
        e.cost_center_code,
        e.account_name,
        m.destination_name
      )
    ),
    suggested_destination_id = coalesce(
      e.suggested_destination_id,
      public.ensure_budget_destination(
        p_company_id,
        m.money_group,
        public.erp_entry_destination_name(
          e.cost_center_name,
          e.cost_center_code,
          e.account_name,
          m.destination_name
        )
      )
    ),
    suggested_department_id = coalesce(e.suggested_department_id, m.department_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, m.cost_center_id),
    suggestion_source = coalesce(e.suggestion_source, 'prefix'),
    updated_at = now()
  from (
    select distinct on (e2.id)
      e2.id as entry_id,
      r.money_group,
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

  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(
      e.suggested_destination_name,
      public.erp_entry_destination_name(
        e.cost_center_name,
        e.cost_center_code,
        e.account_name,
        r.destination_name
      )
    ),
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
    and r.match_type = 'account_name'
    and e.account_name is not null
    and lower(trim(e.account_name)) = lower(trim(r.match_value));

  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(
      e.suggested_destination_name,
      public.erp_entry_destination_name(
        e.cost_center_name,
        e.cost_center_code,
        e.account_name,
        r.destination_name
      )
    ),
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
    and r.match_type = 'cost_center'
    and (
      (e.cost_center_code is not null and lower(trim(e.cost_center_code)) = lower(trim(r.match_value)))
      or (e.cost_center_name is not null and lower(trim(e.cost_center_name)) = lower(trim(r.match_value)))
    );

  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(
      e.suggested_destination_name,
      public.erp_entry_destination_name(
        e.cost_center_name,
        e.cost_center_code,
        e.account_name,
        r.destination_name
      )
    ),
    suggested_department_id = coalesce(e.suggested_department_id, r.department_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, r.cost_center_id),
    suggestion_source = coalesce(e.suggestion_source, 'history'),
    updated_at = now()
  from public.erp_classification_rules r
  where e.company_id = p_company_id
    and e.id = any (p_entry_ids)
    and e.status = 'pending'
    and e.suggested_money_group is null
    and r.company_id = p_company_id
    and r.is_active
    and r.match_type = 'description_exact'
    and public.normalize_transaction_description(e.description) = lower(trim(r.match_value));

  update public.erp_entries e
  set
    suggested_money_group = coalesce(e.suggested_money_group, r.money_group),
    suggested_destination_id = coalesce(e.suggested_destination_id, r.destination_id),
    suggested_destination_name = coalesce(
      e.suggested_destination_name,
      public.erp_entry_destination_name(
        e.cost_center_name,
        e.cost_center_code,
        e.account_name,
        r.destination_name
      )
    ),
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
    and r.match_type = 'description_contains'
    and position(lower(trim(r.match_value)) in public.normalize_transaction_description(e.description)) > 0;

  perform public.link_erp_entries_to_company_cost_centers(p_company_id, p_entry_ids);
end;
$$;

revoke all on function public.apply_erp_classification_suggestions(uuid, uuid[]) from public;
grant execute on function public.apply_erp_classification_suggestions(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
