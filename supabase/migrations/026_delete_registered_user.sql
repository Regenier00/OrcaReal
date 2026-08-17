-- Remove um usuário cadastrado (Auth + perfil + vínculos com empresas).
-- Empresas em que ele é o único membro também são apagadas (ficariam
-- inacessíveis). Empresas compartilhadas permanecem; created_by/actor_id
-- viram null (ON DELETE SET NULL nas FKs existentes).
-- Só postgres/service_role: não é exposto a anon/authenticated.

create or replace function public.delete_registered_user(
  p_email text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_input text := nullif(btrim(coalesce(p_email, '')), '');
  v_user_id uuid;
  v_email text;
  v_name text;
  v_company_ids uuid[];
  v_deleted_companies integer := 0;
begin
  if v_email_input is null and p_user_id is null then
    raise exception 'Informe o e-mail ou o id do usuário';
  end if;

  if v_email_input is not null and p_user_id is not null then
    select u.id, u.email, coalesce(p.name, u.raw_user_meta_data->>'name')
      into v_user_id, v_email, v_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = p_user_id
      and lower(u.email) = lower(v_email_input);
  elsif p_user_id is not null then
    select u.id, u.email, coalesce(p.name, u.raw_user_meta_data->>'name')
      into v_user_id, v_email, v_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.id = p_user_id;
  else
    select u.id, u.email, coalesce(p.name, u.raw_user_meta_data->>'name')
      into v_user_id, v_email, v_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where lower(u.email) = lower(v_email_input);
  end if;

  -- Perfil órfão (existe em profiles, mas não em auth.users)
  if v_user_id is null then
    if v_email_input is not null and p_user_id is not null then
      select p.id, p.email, p.name
        into v_user_id, v_email, v_name
      from public.profiles p
      where p.id = p_user_id
        and lower(coalesce(p.email, '')) = lower(v_email_input);
    elsif p_user_id is not null then
      select p.id, p.email, p.name
        into v_user_id, v_email, v_name
      from public.profiles p
      where p.id = p_user_id;
    else
      select p.id, p.email, p.name
        into v_user_id, v_email, v_name
      from public.profiles p
      where lower(coalesce(p.email, '')) = lower(v_email_input);
    end if;
  end if;

  if v_user_id is null then
    raise exception 'Usuário não encontrado';
  end if;

  -- Empresas em que este usuário é o único membro
  select coalesce(array_agg(c.id), '{}'::uuid[])
    into v_company_ids
  from public.companies c
  where exists (
      select 1
      from public.company_users cu
      where cu.company_id = c.id
        and cu.user_id = v_user_id
    )
    and not exists (
      select 1
      from public.company_users cu
      where cu.company_id = c.id
        and cu.user_id <> v_user_id
    );

  if cardinality(v_company_ids) > 0 then
    delete from public.companies
    where id = any (v_company_ids);
    get diagnostics v_deleted_companies = row_count;
  end if;

  delete from auth.users
  where id = v_user_id;

  -- Garante remoção do perfil se o Auth já não existia (sem cascade)
  delete from public.profiles
  where id = v_user_id;

  return jsonb_build_object(
    'user_id', v_user_id,
    'email', v_email,
    'name', v_name,
    'deleted_companies', v_deleted_companies
  );
end;
$$;

revoke all on function public.delete_registered_user(text, uuid) from public;
revoke all on function public.delete_registered_user(text, uuid) from anon, authenticated;
grant execute on function public.delete_registered_user(text, uuid) to postgres, service_role;
