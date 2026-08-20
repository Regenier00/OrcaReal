-- Regras de negócio do import de centros de custo ficam só no backend (RPC).
-- Duplicatas no mesmo lote são ignoradas no servidor (primeira ocorrência vale).

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
  v_name_key text;
  v_code_key text;
  v_cc_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_destinations integer := 0;
  v_group text;
  v_payload_bytes integer;
  v_seen_names text[] := array[]::text[];
  v_seen_codes text[] := array[]::text[];
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

    v_name_key := lower(trim(v_name));
    v_code_key := case when v_code is null then null else lower(trim(v_code)) end;

    -- Regra de negócio: duplicata no lote → ignora (mantém a primeira).
    if v_name_key = any (v_seen_names)
       or (v_code_key is not null and v_code_key = any (v_seen_codes))
    then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_seen_names := array_append(v_seen_names, v_name_key);
    if v_code_key is not null then
      v_seen_codes := array_append(v_seen_codes, v_code_key);
    end if;

    v_cc_id := null;

    if v_code is not null then
      select cc.id
        into v_cc_id
      from public.cost_centers cc
      where cc.company_id = p_company_id
        and lower(trim(cc.code)) = lower(v_code)
      order by cc.created_at asc
      limit 1;
    end if;

    if v_cc_id is null then
      select cc.id
        into v_cc_id
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

notify pgrst, 'reload schema';
