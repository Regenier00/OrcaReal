-- Orçado × Realizado por grupo financeiro (Receitas, Custos, Despesas, Investimentos).
-- A agregação e as regras de negócio ficam no banco; o front só apresenta o JSON.
-- Acesso: SECURITY DEFINER + is_company_member; tabelas base já têm RLS por empresa.

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
  budget_lines as (
    select
      coalesce(
        nullif(trim(bi.destination_name), ''),
        nullif(trim(cc.name), ''),
        'Sem destino'
      ) as label,
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
  actual_item_lines as (
    select
      coalesce(
        nullif(trim(ai.destination_name), ''),
        nullif(trim(cc.name), ''),
        'Sem destino'
      ) as label,
      lower(
        coalesce(
          nullif(trim(ai.destination_id::text), ''),
          nullif(trim(ai.destination_name), ''),
          nullif(trim(ai.cost_center_id::text), ''),
          'sem-destino'
        )
      ) as row_key,
      to_char(make_date(aiv.year, aiv.month, 1), 'YYYY-MM') as month_key,
      round(coalesce(aiv.amount, 0), 2) as amount
    from public.actuals a
    join public.actual_items ai on ai.actual_id = a.id
    join public.actual_item_values aiv on aiv.actual_item_id = ai.id
    left join public.cost_centers cc on cc.id = ai.cost_center_id
    left join public.categories cat on cat.id = ai.category_id
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
      coalesce(
        nullif(trim(t.destination_name), ''),
        nullif(trim(cc.name), ''),
        'Sem destino'
      ) as label,
      lower(
        coalesce(
          nullif(trim(t.destination_id::text), ''),
          nullif(trim(t.destination_name), ''),
          nullif(trim(t.cost_center_id::text), ''),
          'sem-destino'
        )
      ) as row_key,
      to_char(date_trunc('month', t.posted_at::timestamp), 'YYYY-MM') as month_key,
      round(coalesce(t.amount, 0), 2) as amount
    from public.actual_transactions t
    left join public.cost_centers cc on cc.id = t.cost_center_id
    where t.company_id = p_company_id
      and t.status = 'classified'
      and t.money_group = v_money_group
      and t.posted_at >= v_start
      and t.posted_at <= v_end
  ),
  classified_erp_lines as (
    select
      coalesce(
        nullif(trim(e.destination_name), ''),
        nullif(trim(e.cost_center_name), ''),
        'Sem destino'
      ) as label,
      lower(
        coalesce(
          nullif(trim(e.destination_id::text), ''),
          nullif(trim(e.destination_name), ''),
          nullif(trim(e.cost_center_id::text), ''),
          nullif(trim(e.cost_center_name), ''),
          'sem-destino'
        )
      ) as row_key,
      to_char(date_trunc('month', e.posted_at::timestamp), 'YYYY-MM') as month_key,
      round(coalesce(e.amount, 0), 2) as amount
    from public.erp_entries e
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
      round(coalesce(b.total, 0), 2) as budget_amount,
      round(coalesce(a.total, 0), 2) as actual_amount
    from keys k
    left join lateral (
      select max(label) as label from budget_agg b where b.row_key = k.row_key
    ) b_label on true
    left join lateral (
      select max(label) as label from actual_agg a where a.row_key = k.row_key
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
  'Agrega Orçado × Realizado por money_group e destino. Exige membro da empresa.';

revoke all on function public.get_budget_vs_actual_by_money_group(uuid, uuid, text, text) from public;
grant execute on function public.get_budget_vs_actual_by_money_group(uuid, uuid, text, text) to authenticated;

-- Garante RLS nas tabelas usadas pela comparação (idempotente).
alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;
alter table public.budget_item_values enable row level security;
alter table public.actuals enable row level security;
alter table public.actual_items enable row level security;
alter table public.actual_item_values enable row level security;
alter table public.actual_transactions enable row level security;
alter table public.erp_entries enable row level security;
