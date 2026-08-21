-- Corrige: invalid reference to FROM-clause entry for table "e"
-- em link_erp_entries_to_company_cost_centers (chamado no fim do import ERP).
-- O UPDATE não pode referenciar o alias alvo (e) dentro do FROM LATERAL;
-- resolve via subquery em erp_entries (e2) e junta pelo id.
-- Também reexpõe import_erp_entries no schema cache do PostgREST (PGRST202).

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
    cost_center_id = coalesce(e.cost_center_id, s.cost_center_id),
    suggested_cost_center_id = coalesce(e.suggested_cost_center_id, s.cost_center_id),
    destination_name = case
      when e.destination_name is not null
        and s.cost_center_name is not null
        and lower(trim(e.destination_name)) = lower(trim(coalesce(
          e.cost_center_name,
          e.cost_center_code,
          e.destination_name
        )))
      then s.cost_center_name
      else e.destination_name
    end,
    suggested_destination_name = case
      when e.suggested_destination_name is not null
        and s.cost_center_name is not null
        and (
          lower(trim(e.suggested_destination_name)) = lower(trim(coalesce(e.cost_center_name, '')))
          or lower(trim(e.suggested_destination_name)) = lower(trim(coalesce(e.cost_center_code, '')))
        )
      then s.cost_center_name
      else e.suggested_destination_name
    end,
    updated_at = now()
  from (
    select
      e2.id as entry_id,
      r.cost_center_id,
      r.cost_center_name,
      r.cost_center_code
    from public.erp_entries e2
    cross join lateral public.resolve_company_cost_center(
      p_company_id,
      e2.cost_center_name,
      e2.cost_center_code
    ) r
    where e2.company_id = p_company_id
      and e2.id = any (p_entry_ids)
      and r.cost_center_id is not null
  ) s
  where e.company_id = p_company_id
    and e.id = s.entry_id
    and (
      e.cost_center_id is null
      or e.suggested_cost_center_id is null
      or (
        e.destination_name is not null
        and lower(trim(e.destination_name)) <> lower(trim(s.cost_center_name))
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

-- Garante que a RPC de importação continue visível no PostgREST após reloads.
do $$
begin
  if to_regprocedure('public.import_erp_entries(uuid, uuid, jsonb)') is not null then
    execute 'revoke all on function public.import_erp_entries(uuid, uuid, jsonb) from public';
    execute 'grant execute on function public.import_erp_entries(uuid, uuid, jsonb) to authenticated';
  end if;
end;
$$;

notify pgrst, 'reload schema';
