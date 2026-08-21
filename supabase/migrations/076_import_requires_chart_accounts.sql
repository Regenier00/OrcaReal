-- Impede importar extrato ou ERP quando a empresa ainda não definiu
-- a classificação das contas contábeis (prefixos → grupo).

create or replace function public.require_chart_accounts_before_import()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.company_chart_accounts c
    where c.company_id = new.company_id
      and c.is_active = true
  ) then
    raise exception
      'Defina a classificação das contas contábeis antes de importar extrato ou arquivo ERP. Cadastre ao menos um prefixo em Empresa → Classificação.';
  end if;

  return new;
end;
$$;

drop trigger if exists statement_imports_require_chart_accounts
  on public.statement_imports;
create trigger statement_imports_require_chart_accounts
  before insert on public.statement_imports
  for each row
  execute function public.require_chart_accounts_before_import();

drop trigger if exists erp_imports_require_chart_accounts
  on public.erp_imports;
create trigger erp_imports_require_chart_accounts
  before insert on public.erp_imports
  for each row
  execute function public.require_chart_accounts_before_import();

revoke all on function public.require_chart_accounts_before_import() from public;
