-- Código sequencial de centro de custo por empresa: 001, 002, 003...
create or replace function public.assign_cost_center_code()
returns trigger
language plpgsql
as $$
declare
  v_next integer;
begin
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

drop trigger if exists cost_centers_assign_code on public.cost_centers;
create trigger cost_centers_assign_code
  before insert on public.cost_centers
  for each row execute function public.assign_cost_center_code();
