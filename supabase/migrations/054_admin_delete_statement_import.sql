-- Exclusão de extrato importado fica restrita ao Administrador da empresa
-- (owner/admin). A limpeza do arquivo no storage não pode abortar a exclusão.

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

  if not public.is_company_admin(p_company_id) then
    raise exception 'Apenas administradores da empresa podem excluir extratos importados';
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
    begin
      delete from storage.objects
      where bucket_id = 'statement-imports'
        and name = v_file_path;
    exception
      when others then
        null;
    end;
  end if;
end;
$$;

revoke all on function public.delete_statement_import(uuid, uuid) from public;
grant execute on function public.delete_statement_import(uuid, uuid) to authenticated;

drop policy if exists "statement_imports_all_member" on public.statement_imports;
drop policy if exists "statement_imports_select_member" on public.statement_imports;
drop policy if exists "statement_imports_insert_member" on public.statement_imports;
drop policy if exists "statement_imports_update_member" on public.statement_imports;
drop policy if exists "statement_imports_delete_admin" on public.statement_imports;

create policy "statement_imports_select_member"
  on public.statement_imports for select to authenticated
  using (public.is_company_member(company_id));

create policy "statement_imports_insert_member"
  on public.statement_imports for insert to authenticated
  with check (public.is_company_member(company_id));

create policy "statement_imports_update_member"
  on public.statement_imports for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "statement_imports_delete_admin"
  on public.statement_imports for delete to authenticated
  using (public.is_company_admin(company_id));

drop policy if exists "actual_transactions_all_member" on public.actual_transactions;
drop policy if exists "actual_transactions_select_member" on public.actual_transactions;
drop policy if exists "actual_transactions_insert_member" on public.actual_transactions;
drop policy if exists "actual_transactions_update_member" on public.actual_transactions;
drop policy if exists "actual_transactions_delete_admin" on public.actual_transactions;

create policy "actual_transactions_select_member"
  on public.actual_transactions for select to authenticated
  using (public.is_company_member(company_id));

create policy "actual_transactions_insert_member"
  on public.actual_transactions for insert to authenticated
  with check (public.is_company_member(company_id));

create policy "actual_transactions_update_member"
  on public.actual_transactions for update to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "actual_transactions_delete_admin"
  on public.actual_transactions for delete to authenticated
  using (public.is_company_admin(company_id));

drop policy if exists "statement_imports_storage_delete_member" on storage.objects;
drop policy if exists "statement_imports_storage_delete_admin" on storage.objects;
create policy "statement_imports_storage_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'statement-imports'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );

notify pgrst, 'reload schema';
