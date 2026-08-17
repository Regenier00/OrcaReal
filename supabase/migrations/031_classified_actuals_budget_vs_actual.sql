-- Apropriação alimenta o Orçado × Realizado por centro de custo.
-- Categoria deixa de ser obrigatória; o tipo (entrada/saída) pode ser corrigido.

drop function if exists public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text);

create or replace function public.classify_actual_transactions(
  p_company_id uuid,
  p_transaction_ids uuid[],
  p_department_id uuid default null,
  p_category_id uuid default null,
  p_cost_center_id uuid default null,
  p_status text default 'classified',
  p_type text default null
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

  if v_type is not null and v_type not in ('income', 'expense', 'transfer', 'unknown') then
    raise exception 'Tipo de lançamento inválido';
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
      type = coalesce(v_type, type),
      department_id = coalesce(p_department_id, department_id),
      category_id = coalesce(p_category_id, category_id),
      cost_center_id = coalesce(p_cost_center_id, cost_center_id),
      status = case
        when coalesce(v_type, type) in ('expense', 'income')
             and coalesce(p_department_id, department_id) is not null
             and coalesce(p_cost_center_id, cost_center_id) is not null
          then 'classified'
        when coalesce(v_type, type) = 'transfer' then 'classified'
        else 'pending'
      end,
      classified_at = case
        when coalesce(v_type, type) in ('expense', 'income')
             and coalesce(p_department_id, department_id) is not null
             and coalesce(p_cost_center_id, cost_center_id) is not null
          then now()
        when coalesce(v_type, type) = 'transfer' then now()
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
      type = coalesce(v_type, type),
      status = 'ignored',
      classified_at = now(),
      classified_by = v_user_id,
      updated_at = now()
    where company_id = p_company_id
      and id = any (p_transaction_ids);
  else
    update public.actual_transactions
    set
      type = coalesce(v_type, type),
      department_id = coalesce(p_department_id, department_id),
      category_id = coalesce(p_category_id, category_id),
      cost_center_id = coalesce(p_cost_center_id, cost_center_id),
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

revoke all on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text) from public;
grant execute on function public.classify_actual_transactions(uuid, uuid[], uuid, uuid, uuid, text, text) to authenticated;
