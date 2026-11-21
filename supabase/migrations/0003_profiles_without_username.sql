-- Удаляет отдельный логин: пользователь идентифицируется email через Supabase Auth.
-- Запускать после 0002_profiles.sql. Книги, полки и обложки не затрагиваются.

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id);

  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user()
  from public, anon, authenticated;

drop index if exists public.profiles_username_unique;
alter table public.profiles
  drop constraint if exists profiles_username_check;
alter table public.profiles
  drop column if exists username;
