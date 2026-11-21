-- Shelves — начальная схема Supabase.
-- Выполнить один раз в Supabase SQL Editor для нового проекта.
-- После выполнения: Authentication → Providers → Email, Confirm email = off.
--
-- Модель доступа:
--   * auth.users       — учётные записи и пароли (Supabase Auth);
--   * public.shelves   — полки, доступны только владельцу;
--   * public.books     — книги, доступны только владельцу;
--   * storage.objects  — обложки в приватном bucket book-covers.
--
-- Все пользовательские строки защищены RLS: пользователь видит и меняет
-- только строки с user_id = auth.uid(). Service role обходит RLS и
-- используется только для администрирования, не в клиенте.

-- ---------------------------------------------------------------------------
-- 1. Полки
-- ---------------------------------------------------------------------------

create table if not exists public.shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shelves_name_not_blank
    check (char_length(btrim(name)) between 1 and 80),
  constraint shelves_name_trimmed
    check (name = btrim(name))
);

comment on table public.shelves is
  'Полки книг. Каждая полка принадлежит одному пользователю.';

-- Названия полок уникальны в пределах пользователя без учёта регистра.
create unique index if not exists shelves_user_name_unique
  on public.shelves (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- 2. Книги
-- ---------------------------------------------------------------------------

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  shelf_id uuid references public.shelves (id) on delete set null,

  title text not null,
  author text not null,
  status text not null default 'reading',
  rating smallint,
  impression text not null default '',
  started_at date,
  finished_at date,
  added_at timestamptz not null default now(),
  cover_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint books_title_not_blank
    check (char_length(btrim(title)) between 1 and 300),
  constraint books_title_trimmed
    check (title = btrim(title)),
  constraint books_author_not_blank
    check (char_length(btrim(author)) between 1 and 200),
  constraint books_author_trimmed
    check (author = btrim(author)),
  constraint books_status_check
    check (status in ('reading', 'planned', 'read', 'paused')),
  constraint books_rating_check
    check (rating is null or rating between 1 and 5),
  constraint books_dates_check
    check (finished_at is null or started_at is null or finished_at >= started_at),
  constraint books_status_fields_check
    check (
      (status = 'planned' and rating is null and started_at is null and finished_at is null)
      or (status = 'reading' and finished_at is null)
      or (status = 'read')
      or (status = 'paused' and started_at is null and finished_at is null)
    ),
  -- Обложка должна лежать в папке своего пользователя:
  -- book-covers/<user_id>/<book_id>.jpg
  constraint books_cover_path_own
    check (cover_path is null or cover_path like user_id::text || '/%')
);

comment on table public.books is
  'Книги пользователя. shelf_id ссылается на полку того же пользователя.';
comment on column public.books.cover_path is
  'Путь в bucket book-covers: <user_id>/<book_id>.jpg; null — обложки нет.';

create index if not exists books_user_added_idx
  on public.books (user_id, added_at desc);
create index if not exists books_user_shelf_idx
  on public.books (user_id, shelf_id);
create index if not exists books_user_status_idx
  on public.books (user_id, status);

-- ---------------------------------------------------------------------------
-- 3. updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shelves_touch_updated_at on public.shelves;
create trigger shelves_touch_updated_at
before update on public.shelves
for each row execute function public.touch_updated_at();

drop trigger if exists books_touch_updated_at on public.books;
create trigger books_touch_updated_at
before update on public.books
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS: полки
-- ---------------------------------------------------------------------------

alter table public.shelves enable row level security;

drop policy if exists shelves_select_own on public.shelves;
create policy shelves_select_own
on public.shelves for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists shelves_insert_own on public.shelves;
create policy shelves_insert_own
on public.shelves for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists shelves_update_own on public.shelves;
create policy shelves_update_own
on public.shelves for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists shelves_delete_own on public.shelves;
create policy shelves_delete_own
on public.shelves for delete
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. RLS: книги
-- ---------------------------------------------------------------------------

alter table public.books enable row level security;

drop policy if exists books_select_own on public.books;
create policy books_select_own
on public.books for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists books_insert_own on public.books;
create policy books_insert_own
on public.books for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    shelf_id is null
    or exists (
      select 1
      from public.shelves s
      where s.id = shelf_id
        and s.user_id = (select auth.uid())
    )
  )
);

drop policy if exists books_update_own on public.books;
create policy books_update_own
on public.books for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    shelf_id is null
    or exists (
      select 1
      from public.shelves s
      where s.id = shelf_id
        and s.user_id = (select auth.uid())
    )
  )
);

drop policy if exists books_delete_own on public.books;
create policy books_delete_own
on public.books for delete
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Права на таблицы
-- ---------------------------------------------------------------------------

-- RLS — основная защита. Дополнительно не даём anon прямого доступа
-- к пользовательским таблицам.
revoke all on public.shelves, public.books from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.shelves, public.books
  to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Storage: приватные обложки
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', false)
on conflict (id) do update set public = false;

-- Ограничения bucket: до 2 МБ, только растровые изображения.
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'book-covers';

drop policy if exists book_covers_select_own on storage.objects;
create policy book_covers_select_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists book_covers_insert_own on storage.objects;
create policy book_covers_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists book_covers_update_own on storage.objects;
create policy book_covers_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists book_covers_delete_own on storage.objects;
create policy book_covers_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- ---------------------------------------------------------------------------
-- 8. Проверка после выполнения
-- ---------------------------------------------------------------------------
-- Ожидаемые таблицы:
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public' and tablename in ('books', 'shelves');
--
-- Ожидаемые политики:
--   select schemaname, tablename, policyname, cmd, roles
--   from pg_policies
--   where schemaname in ('public', 'storage')
--   order by schemaname, tablename, policyname;
--
-- Ожидаемый bucket:
--   select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets
--   where id = 'book-covers';
