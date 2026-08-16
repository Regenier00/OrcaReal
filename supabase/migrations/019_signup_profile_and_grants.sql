-- Cadastro: cria o perfil no banco (não depende do cliente ter sessão)
-- e libera a Data API. Projetos Supabase novos não expõem tabelas
-- automaticamente para authenticated/anon.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      'Usuário'
    ),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recupera usuários já criados no Auth sem linha em profiles
insert into public.profiles (id, name, email)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), 'Usuário'),
  u.email
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
