-- Apaga um usuário cadastrado no OrcaReal.
-- Rode no SQL Editor do Supabase (role postgres).
--
-- O que é removido:
--   - auth.users (login)
--   - public.profiles (cascade a partir do Auth)
--   - public.company_users (vínculos com empresas)
--   - empresas em que ele é o único membro (dados ficariam inacessíveis)
--
-- O que permanece:
--   - empresas compartilhadas com outros usuários
--   - registros de auditoria/orçamento/importação (created_by vira null)
--
-- Depois de aplicar a migration 026:
select public.delete_registered_user('usuario@email.com');
-- ou pelo id:
-- select public.delete_registered_user(p_user_id := '00000000-0000-0000-0000-000000000000');

-- ---------------------------------------------------------------------------
-- Alternativa avulsa (sem a função). Troque o e-mail e execute o bloco.
-- ---------------------------------------------------------------------------
/*
do $$
declare
  v_email text := 'usuario@email.com';
  v_user_id uuid;
  v_company_ids uuid[];
begin
  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email) = lower(btrim(v_email));

  if v_user_id is null then
    select p.id
      into v_user_id
    from public.profiles p
    where lower(coalesce(p.email, '')) = lower(btrim(v_email));
  end if;

  if v_user_id is null then
    raise exception 'Usuário não encontrado: %', v_email;
  end if;

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
  end if;

  delete from auth.users
  where id = v_user_id;

  delete from public.profiles
  where id = v_user_id;
end $$;
*/
