-- Exclui um extrato importado com os lançamentos e o arquivo no storage.

create or replace function public.delete_statement_import(
  p_company_id uuid,
  p_import_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_path text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_company_id is null or p_import_id is null then
    raise exception 'Importação não informada';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'Sem acesso a esta empresa';
  end if;

  select file_path
    into v_file_path
  from public.statement_imports
  where id = p_import_id
    and company_id = p_company_id;

  if not found then
    raise exception 'Importação não encontrada';
  end if;

  delete from public.actual_transactions
  where company_id = p_company_id
    and import_id = p_import_id;

  delete from public.statement_imports
  where id = p_import_id
    and company_id = p_company_id;

  if coalesce(v_file_path, '') <> '' then
    delete from storage.objects
    where bucket_id = 'statement-imports'
      and name = v_file_path;
  end if;
end;
$$;

revoke all on function public.delete_statement_import(uuid, uuid) from public;
grant execute on function public.delete_statement_import(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
