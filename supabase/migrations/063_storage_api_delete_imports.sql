-- Exclusão de importações (extrato / ERP) não pode mais apagar storage.objects
-- via SQL: o Storage rejeita DELETE direto ("Use the Storage API instead").
-- A RPC limpa só os dados; o arquivo é removido pelo cliente via Storage API,
-- sujeito às policies RLS abaixo (somente admin da empresa no path correto).

-- ---------------------------------------------------------------------------
-- Extrato: delete_statement_import sem tocar em storage.objects
-- ---------------------------------------------------------------------------

create or replace function public.delete_statement_import(
  p_company_id uuid,
  p_import_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_path text;
  v_deleted_tx integer := 0;
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
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Importação não encontrada';
  end if;

  delete from public.actual_transactions
  where company_id = p_company_id
    and import_id = p_import_id;

  get diagnostics v_deleted_tx = row_count;

  delete from public.statement_imports
  where id = p_import_id
    and company_id = p_company_id;

  if not found then
    raise exception 'Importação não encontrada';
  end if;

  insert into public.audit_logs (
    company_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    p_company_id,
    v_user_id,
    'delete',
    'statement_import',
    p_import_id,
    jsonb_build_object(
      'deleted_transactions', v_deleted_tx,
      'file_path', v_file_path
    )
  );
end;
$$;

revoke all on function public.delete_statement_import(uuid, uuid) from public;
grant execute on function public.delete_statement_import(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ERP: delete_erp_import sem tocar em storage.objects
-- ---------------------------------------------------------------------------

create or replace function public.delete_erp_import(
  p_company_id uuid,
  p_import_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_path text;
  v_deleted_entries integer := 0;
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
    raise exception 'Apenas administradores podem excluir importações ERP';
  end if;

  select file_path
    into v_file_path
  from public.erp_imports
  where id = p_import_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Importação ERP não encontrada';
  end if;

  delete from public.erp_entries
  where company_id = p_company_id
    and import_id = p_import_id;

  get diagnostics v_deleted_entries = row_count;

  delete from public.erp_imports
  where id = p_import_id
    and company_id = p_company_id;

  if not found then
    raise exception 'Importação ERP não encontrada';
  end if;

  insert into public.audit_logs (
    company_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    p_company_id,
    v_user_id,
    'delete',
    'erp_import',
    p_import_id,
    jsonb_build_object(
      'deleted_entries', v_deleted_entries,
      'file_path', v_file_path
    )
  );
end;
$$;

revoke all on function public.delete_erp_import(uuid, uuid) from public;
grant execute on function public.delete_erp_import(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage RLS: paths companyId/importId/arquivo; delete só admin
-- ---------------------------------------------------------------------------

drop policy if exists "statement_imports_storage_select_member" on storage.objects;
create policy "statement_imports_storage_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'statement-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "statement_imports_storage_insert_member" on storage.objects;
create policy "statement_imports_storage_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'statement-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "statement_imports_storage_update_member" on storage.objects;
create policy "statement_imports_storage_update_member"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'statement-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  )
  with check (
    bucket_id = 'statement-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "statement_imports_storage_delete_member" on storage.objects;
drop policy if exists "statement_imports_storage_delete_admin" on storage.objects;
create policy "statement_imports_storage_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'statement-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "erp_imports_storage_select_member" on storage.objects;
create policy "erp_imports_storage_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'erp-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_member(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "erp_imports_storage_insert_member" on storage.objects;
drop policy if exists "erp_imports_storage_insert_writer" on storage.objects;
create policy "erp_imports_storage_insert_writer"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'erp-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_writer(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "erp_imports_storage_update_member" on storage.objects;
drop policy if exists "erp_imports_storage_update_writer" on storage.objects;
create policy "erp_imports_storage_update_writer"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'erp-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_writer(((string_to_array(name, '/'))[1])::uuid)
  )
  with check (
    bucket_id = 'erp-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_writer(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists "erp_imports_storage_delete_member" on storage.objects;
drop policy if exists "erp_imports_storage_delete_admin" on storage.objects;
create policy "erp_imports_storage_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'erp-imports'
    and cardinality(string_to_array(name, '/')) >= 3
    and (string_to_array(name, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(name, '/'))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_company_admin(((string_to_array(name, '/'))[1])::uuid)
  );

notify pgrst, 'reload schema';
