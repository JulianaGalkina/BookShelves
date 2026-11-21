# Supabase для Shelves

## Что находится в этой папке

- `migrations/0001_init.sql` — начальная схема: таблицы `shelves` и `books`, ограничения, индексы, триггеры, RLS и приватный bucket `book-covers`.

Миграция рассчитана на новый проект. Если таблицы `books` или `shelves` уже существуют, не запускайте файл вслепую: `create table if not exists` не добавит недостающие колонки и ограничения. Сначала сравните фактическую схему с файлом.

## Порядок настройки

1. Создать проект Supabase.
2. В **Authentication → Providers → Email** включить Email.
3. Отключить **Confirm email** — для текущего прототипа регистрация должна сразу создавать сессию.
4. В **Authentication → URL Configuration** указать:
   - Site URL: `http://localhost:5173`;
   - Redirect URL: `http://localhost:5173/**`.
5. В **Authentication → Settings** установить минимальную длину пароля 8.
6. Открыть **SQL Editor** и выполнить содержимое `migrations/0001_init.sql`.
7. Проверить, что bucket `book-covers` создан как приватный, с лимитом 2 МБ и MIME-типами `image/jpeg`, `image/png`, `image/webp`.
8. Создать демо-пользователя в **Authentication → Users → Add user**:
   - email: `bookishg@shelves.com`;
   - password: `BookishGirrrl`;
   - auto-confirm: включён.
9. Заполнить демо-аккаунт книгами и полками через приложение после подключения клиента.
10. Взять **Project URL** и **anon public key** из **Project Settings → API**.

`service_role` key не используется в браузере и не должен попадать в `.env.local` или репозиторий.

## Переменные окружения

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

`VITE_`-переменные попадают в клиентский бандл. Это нормально для `anon` key: доступ ограничен RLS. `service_role` в клиент не добавлять.

## Проверка схемы

После выполнения SQL в SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('books', 'shelves');

select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'book-covers';
```

Ожидается:

- у `books` и `shelves` `rowsecurity = true`;
- политики `*_own` для `select`, `insert`, `update`, `delete`;
- bucket `book-covers` с `public = false`.

## Проверка RLS

SQL Editor работает от имени администратора и обходит RLS. Поэтому проверять доступ нужно через клиент с токеном пользователя.

1. Создать двух пользователей A и B.
2. Войти под A и создать книгу и полку.
3. Войти под B: книги и полки A не должны отображаться.
4. Под A попробовать вставить книгу с `shelf_id` полки B — запрос должен быть отклонён.
5. Без входа запрос с одним `anon` key не должен возвращать строки.
6. Файл обложки по чужому пути не должен открываться.

## Обложки

- Bucket приватный; в БД хранится только `books.cover_path`.
- Путь: `<user_id>/<book_id>.jpg`.
- Для показа использовать `createSignedUrl` или `createSignedUrls`.
- При замене обложки удалять старый объект, иначе останутся неиспользуемые файлы.
- При удалении книги удалять её объект из Storage.
- При удалении пользователя строки таблиц удаляются каскадно, но объекты Storage автоматически не удаляются; для очистки нужен отдельный административный сценарий.

## Демо-аккаунт

Демо-пользователь создаётся вручную в Dashboard. Его данные доступны для изменения всем, кто знает опубликованный пароль. Это допустимо для демо, но данные следует считать одноразовыми и периодически сбрасывать.
