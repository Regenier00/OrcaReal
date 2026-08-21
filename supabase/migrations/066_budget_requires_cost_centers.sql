-- Impede criar orçamento quando a empresa ainda não tem centros de custo.
-- Sem centros de custo, o orçamento fica sem destino estrutural.

create or replace function public.require_cost_centers_before_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.cost_centers c
    where c.company_id = new.company_id
  ) then
    raise exception
      'Defina ao menos um centro de custo antes de criar um orçamento. Sem centros de custo, o orçamento fica sem destino.';
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_require_cost_centers on public.budgets;
create trigger budgets_require_cost_centers
  before insert on public.budgets
  for each row
  execute function public.require_cost_centers_before_budget();

revoke all on function public.require_cost_centers_before_budget() from public;
