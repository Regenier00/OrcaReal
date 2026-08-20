-- Prefixo por grupo classifica automaticamente; destino = centro de custo do arquivo.

create or replace function public.erp_entry_destination_name(
  p_cost_center_name text,
  p_cost_center_code text,
  p_account_name text default null,
  p_fallback text default 'Sem centro de custo'
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(public.sanitize_spreadsheet_text(p_cost_center_name, 200), ''),
    nullif(public.sanitize_spreadsheet_text(p_cost_center_code, 80), ''),
    nullif(public.sanitize_spreadsheet_text(p_account_name, 200), ''),
    public.sanitize_spreadsheet_text(p_fallback, 200)
  );
$$;

revoke all on function public.erp_entry_destination_name(text, text, text, text) from public;
grant execute on function public.erp_entry_destination_name(text, text, text, text) to authenticated;

-- Upsert de prefixo: destino placeholder (o real vem do CC no import)
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
  v_kind text := coalesce(nullif(trim(p_match_kind), ''), 'prefix');
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
    raise exception 'Informe o prefixo da conta';
  end if;
  if v_kind not in ('exact', 'prefix') then
    raise exception 'Tipo de correspondência inválido';
  end if;
  if v_group is null or v_group not in ('revenue', 'cost', 'expense', 'investment') then
    raise exception 'Grupo inválido';
  end if;

  -- Destino fixo no cadastro: no import o CC do arquivo prevalece.
  if v_dest_name is null then
    v_dest_name := 'Centro de custo do arquivo';
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
    coalesce(v_name, 'Prefixo ' || v_group),
    v_kind,
    v_group,
    v_dest_id,
    v_dest_name,
    p_department_id,
    p_cost_center_id,
    coalesce(p_priority, case when v_kind = 'prefix' then 40 else 100 end),
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
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;
  if not public.is_company_writer(p_company_id) then
    raise exception 'Sem permissão para classificar nesta empresa';
  end if;

  -- Prefixo (ou código exato) do plano → apropria grupo;
  -- destino = centro de custo do lançamento importado.
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
    v_dest_name := public.erp_entry_destination_name(
      v_row.cost_center_name,
      v_row.cost_center_code,
      v_row.account_name,
      'Sem centro de custo'
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
      cost_center_id = coalesce(v_row.cost_center_id, e.cost_center_id),
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
      suggested_cost_center_id = coalesce(v_row.cost_center_id, e.suggested_cost_center_id),
      suggestion_source = case
        when v_row.match_kind = 'exact' then 'chart'
        else 'prefix'
      end,
      updated_at = now()
    where e.id = v_row.entry_id
      and e.company_id = p_company_id
      and e.status = 'pending';
  end loop;

  -- Regras aprendidas: código exato (só sugere se ainda pendente)
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

  -- Prefixo aprendido em regras
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

  -- Nome da conta / CC / descrição (sugestão)
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
end;
$$;
