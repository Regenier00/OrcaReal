-- Criação de conta no Realizado: RPC com isolamento por empresa,
-- grants explícitos e recarga do schema da API.
-- ALTER DEFAULT PRIVILEGES só vale para o papel que o definiu; se 026
-- rodou com outro owner, authenticated fica sem INSERT em bank_accounts.

grant select, insert, update, delete on table public.bank_accounts to authenticated;
grant select, insert, update, delete on table public.statement_imports to authenticated;
grant select, insert, update, delete on table public.actual_transactions to authenticated;
grant select, insert, update, delete on table public.transaction_classification_memory to authenticated;
grant select on table public.actual_monthly_totals to authenticated;

create or replace function public.create_company_bank_account(
  p_company_id uuid,
  p_name text
)
returns public.bank_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_account public.bank_accounts;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_company_id is null then
    raise exception 'Empresa não informada';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  if v_name is null then
    raise exception 'Informe o nome da conta';
  end if;

  select *
    into v_account
  from public.bank_accounts
  where company_id = p_company_id
    and lower(name) = lower(v_name)
  order by created_at
  limit 1;

  if found then
    if v_account.is_active is not true then
      update public.bank_accounts
      set
        is_active = true,
        updated_at = now()
      where id = v_account.id
      returning * into v_account;
    end if;
    return v_account;
  end if;

  insert into public.bank_accounts (
    company_id,
    name,
    bank_name
  )
  values (
    p_company_id,
    v_name,
    v_name
  )
  returning * into v_account;

  return v_account;
end;
$$;

revoke all on function public.create_company_bank_account(uuid, text) from public;
grant execute on function public.create_company_bank_account(uuid, text) to authenticated;

notify pgrst, 'reload schema';
