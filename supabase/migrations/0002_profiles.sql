-- Промежуточная схема профиля; 0003_profiles_without_username.sql удаляет логин.
-- Запускать после 0001_init.sql в SQL Editor Supabase.
-- Если username не передан через user_metadata, используется часть email до @.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_check
    check (
      username = btrim(username)
      and char_length(username) between 1 and 32
    )
);

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username));

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_username text;
begin
  new_username := lower(
    btrim(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), '')
      )
    )
  );

  if char_length(new_username) < 1 or char_length(new_username) > 32 then
    raise exception 'Username must contain 1 to 32 characters';
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, new_username);

  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, public;
grant select, update on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();
