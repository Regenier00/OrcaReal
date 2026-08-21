-- Destinos de custos/despesas = centros de custo do usuário.
-- Receitas/investimentos continuam com destinos definidos no orçamento.
-- Centros de custo NÃO são mais espelhados em revenue/investment.

create or replace function public.ensure_cost_center_as_destinations(
  p_company_id uuid,
  p_name text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_count integer := 0;
  v_group text;
begin
  if p_company_id is null or v_name is null then
    return 0;
  end if;

  foreach v_group in array array['cost', 'expense']
  loop
    perform public.ensure_budget_destination(p_company_id, v_group, v_name);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.ensure_cost_center_as_destinations(uuid, text) from public;
grant execute on function public.ensure_cost_center_as_destinations(uuid, text) to authenticated;

create or replace function public.sync_cost_center_budget_destinations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.name is distinct from new.name
     and nullif(trim(old.name), '') is not null
  then
    -- Mantém destinos antigos ativos; o novo nome passa a existir no catálogo.
    null;
  end if;

  if new.is_active is distinct from false
     and nullif(trim(new.name), '') is not null
  then
    perform public.ensure_cost_center_as_destinations(new.company_id, new.name);
  end if;

  return new;
end;
$$;

drop trigger if exists cost_centers_sync_budget_destinations on public.cost_centers;
create trigger cost_centers_sync_budget_destinations
  after insert or update of name, is_active
  on public.cost_centers
  for each row
  execute function public.sync_cost_center_budget_destinations();

-- Import: só cria destinos em custo e despesa
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

    -- Trigger também sincroniza; contamos explicitamente (custo + despesa).
    v_destinations := v_destinations
      + public.ensure_cost_center_as_destinations(p_company_id, v_name);
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

-- Sugestões de CC também viram destinos de custo/despesa
create or replace function public.apply_company_cost_center_suggestions(
  p_company_id uuid,
  p_names text[] default null
)
returns setof public.cost_centers
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_names text[];
  v_name text;
  v_cc_id uuid;
  v_dept_id uuid;
begin
  if p_company_id is null then
    raise exception 'Empresa não informada';
  end if;

  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.is_company_admin(p_company_id) then
    raise exception 'Você não tem permissão para configurar centros de custo';
  end if;

  if p_names is null then
    v_names := array[
      'Administração Geral',
      'Gestão Financeira',
      'Contabilidade',
      'Recursos Humanos',
      'Vendas e Comercial',
      'Marketing',
      'Compras',
      'Estoque e Almoxarifado',
      'Operações e Produção',
      'Logística e Distribuição'
    ];
  else
    v_names := p_names;
  end if;

  foreach v_name in array v_names loop
    v_name := nullif(trim(v_name), '');
    if v_name is null then
      continue;
    end if;

    v_cc_id := null;

    select cc.id
      into v_cc_id
    from public.cost_centers cc
    where cc.company_id = p_company_id
      and lower(cc.name) = lower(v_name)
    limit 1;

    if v_cc_id is null then
      insert into public.cost_centers (company_id, name)
      values (p_company_id, v_name)
      returning id into v_cc_id;
    else
      update public.cost_centers
      set
        is_active = true,
        updated_at = now()
      where id = v_cc_id;
    end if;

    perform public.ensure_cost_center_as_destinations(p_company_id, v_name);

    return query
      select *
      from public.cost_centers
      where id = v_cc_id;
  end loop;

  for r in
    select *
    from (
      values
        ('Administrativo'::text, 'Administração Geral'::text),
        ('Financeiro', 'Gestão Financeira'),
        ('Contabilidade', 'Contabilidade'),
        ('Recursos Humanos', 'Recursos Humanos'),
        ('Comercial / Vendas', 'Vendas e Comercial'),
        ('Marketing', 'Marketing'),
        ('Compras', 'Compras'),
        ('Estoque / Almoxarifado', 'Estoque e Almoxarifado'),
        ('Operacional / Produção', 'Operações e Produção'),
        ('Logística', 'Logística e Distribuição')
    ) as t(dept_name, cc_name)
  loop
    if not exists (
      select 1
      from unnest(v_names) as n(name)
      where lower(trim(n.name)) = lower(r.cc_name)
    ) then
      continue;
    end if;

    select d.id into v_dept_id
    from public.departments d
    where d.company_id = p_company_id
      and lower(d.name) = lower(r.dept_name)
    limit 1;

    if v_dept_id is null then
      continue;
    end if;

    select cc.id into v_cc_id
    from public.cost_centers cc
    where cc.company_id = p_company_id
      and lower(cc.name) = lower(r.cc_name)
    limit 1;

    if v_cc_id is null then
      continue;
    end if;

    insert into public.department_cost_centers (department_id, cost_center_id)
    select v_dept_id, v_cc_id
    where not exists (
      select 1
      from public.department_cost_centers link
      where link.department_id = v_dept_id
        and link.cost_center_id = v_cc_id
    );
  end loop;
end;
$$;

revoke all on function public.apply_company_cost_center_suggestions(uuid, text[]) from public;
grant execute on function public.apply_company_cost_center_suggestions(uuid, text[]) to authenticated;

-- Apropriação: custos/despesas só usam destinos que já existem (centros de custo).
-- Receitas/investimentos podem criar destino alinhado ao orçamento.
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
  v_cc_name text;
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

  if v_destination_id is not null then
    select d.name, d.money_group
      into v_destination_name, v_money_group
    from public.budget_destinations d
    where d.id = v_destination_id
      and d.company_id = p_company_id;

    if v_destination_name is null then
      raise exception 'Destino inválido para esta empresa';
    end if;
  elsif v_destination_name is not null and v_money_group is not null then
    if v_money_group in ('cost', 'expense') then
      select d.id, d.name
        into v_destination_id, v_destination_name
      from public.budget_destinations d
      where d.company_id = p_company_id
        and d.money_group = v_money_group
        and lower(trim(d.name)) = lower(trim(v_destination_name))
      limit 1;

      if v_destination_id is null then
        select cc.name
          into v_cc_name
        from public.cost_centers cc
        where cc.company_id = p_company_id
          and cc.is_active = true
          and lower(trim(cc.name)) = lower(trim(v_destination_name))
        limit 1;

        if v_cc_name is null then
          raise exception
            'Para custos e despesas, o destino precisa ser um centro de custo cadastrado';
        end if;

        v_destination_id := public.ensure_budget_destination(
          p_company_id,
          v_money_group,
          v_cc_name
        );
        v_destination_name := v_cc_name;
      end if;
    else
      v_destination_id := public.ensure_budget_destination(
        p_company_id,
        v_money_group,
        v_destination_name
      );
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

-- Backfill: centros ativos → destinos de custo e despesa
do $$
declare
  r record;
begin
  for r in
    select company_id, name
    from public.cost_centers
    where is_active = true
      and nullif(trim(name), '') is not null
  loop
    perform public.ensure_cost_center_as_destinations(r.company_id, r.name);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
