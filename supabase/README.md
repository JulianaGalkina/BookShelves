# Supabase для Shelves

## Что находится в этой папке

- `migrations/0001_init.sql` — начальная схема: таблицы `shelves` и `books`, ограничения, индексы, RLS и приватный bucket `book-covers`.
- `migrations/0002_profiles.sql` — профиль и триггер его создания.
- `migrations/0003_profiles_without_username.sql` — удаляет отдельный логин из профиля; сохраняет только ID пользователя и системные даты.

Миграция рассчитана на новый проект. Если таблицы `books` или `shelves` уже существуют, не запускайте файл вслепую: `create table if not exists` не добавит недостающие колонки и ограничения. Сначала сравните фактическую схему с файлом.

## Порядок настройки

1. Создать проект Supabase.
2. В **Authentication → Providers → Email** включить Email.
3. Отключить **Confirm email** — для текущего прототипа регистрация должна сразу создавать сессию.
4. В **Authentication → URL Configuration** указать:
   - Site URL: `http://127.0.0.1:5174/`;
   - Redirect URLs: `http://127.0.0.1:5174/` и `http://127.0.0.1:5174/reset-password`;
   - если открываете сайт через `localhost`, также добавить `http://localhost:5174/` и `http://localhost:5174/reset-password`.
5. В **Authentication → Settings** установить минимальную длину пароля 8.
6. Открыть **SQL Editor** и по порядку выполнить `0001_init.sql`, `0002_profiles.sql` и `0003_profiles_without_username.sql`. Если первые две миграции уже применены — выполнить только `0003`.
7. Проверить, что bucket `book-covers` создан как приватный, с лимитом 2 МБ и MIME-типами `image/jpeg`, `image/png`, `image/webp`.
8. Создать демо-пользователя в **Authentication → Users → Add user**:
   - email: `bookishg@shelves.com`;
   - password: `BookishGirrrl`;
   - auto-confirm: включён.
9. Заполнить демо-аккаунт книгами и полками через приложение.
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

## Клиент и профиль

- `.env.local` в корне проекта содержит `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`; файл игнорируется Git. Заполните значениями из **Project Settings → API**.
- `.env.example` — шаблон переменных без секретов.
- `src/lib/supabase.js` — клиент Supabase, который использует приложение. После заполнения `.env.local` перезапустите Vite.
- `migrations/0002_profiles.sql` и `0003_profiles_without_username.sql` — таблица профилей и триггер; третья миграция удаляет поле логина.

Регистрация принимает только email и пароль. Триггер создаёт профиль без отдельного логина.

## Восстановление пароля

В коде готовы запрос письма, маршрут `/reset-password`, форма нового пароля и обработка недействительной ссылки. Дополнительный SQL не требуется.

1. В **Authentication → URL Configuration** добавить точные URL из раздела выше. Адрес возврата строится из адреса открытого приложения, поэтому порт и имя хоста должны совпадать.
2. В **Authentication → Email → Templates → Reset password** оставить ссылку `{{ .ConfirmationURL }}`. Нельзя подменять её прямой ссылкой на приложение: сначала Supabase должен проверить одноразовый токен.
3. Настроить **Custom SMTP**: адрес отправителя, имя отправителя, host, port, username и password почтового сервиса. Эти данные вводятся в Supabase, не в клиентский `.env.local`. Стандартная отправка Supabase ограничена адресами участников команды проекта; для обычных пользователей нужен свой SMTP.
4. Сохранить `Confirm email` выключенным для согласованной регистрации без подтверждения. Письмо восстановления отправляется только по отдельному запросу пользователя.
5. При публикации добавить реальные HTTPS-адреса сайта и `/reset-password`, сменить Site URL. Хостинг должен отдавать `index.html` для `/reset-password` (SPA fallback). Локальные ссылки работают только на компьютере с запущенным приложением.

Ручная проверка владельцем: на собственном тестовом аккаунте запросить письмо → открыть ссылку → задать новый пароль → выйти → проверить, что старый пароль отклоняется, а новый открывает прежние книги. Проверить также истёкшую ссылку, перезагрузку формы и повторный запрос. Приложение не подтверждает существование введённого email.

Документация: [сброс пароля](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [разрешённые адреса возврата](https://supabase.com/docs/guides/auth/redirect-urls).

## Вход через Google

Кнопка и обработка возврата реализованы. При проверке 21.11.2026 Google в подключённом проекте выключен; Client ID и Client Secret в репозитории отсутствуют.

1. Открыть [Google Cloud Console](https://console.cloud.google.com/), выбрать или создать проект. В **Google Auth Platform** настроить **Branding** (название Shelves, почта поддержки) и **Audience**. Для внешних пользователей выбрать External; в режиме Testing добавить свою Google-почту в Test users. Запрашивать только базовые данные входа — `openid`, email и profile.
2. В **Clients → Create client** создать OAuth client типа **Web application**. Authorized JavaScript origins: `http://localhost:5174` (и фактический HTTPS origin после публикации).
3. В **Authorized redirect URIs** вставить callback подключённого облачного Supabase:

   ```text
   https://oolkfdamthcxpzzeqkur.supabase.co/auth/v1/callback
   ```

   Сверить значение с Callback URL на странице Google provider в своём Supabase. Даже при локально запущенном приложении здесь указывается callback облачного проекта, не `/reset-password` и не адрес Vite.
4. В [Supabase → Authentication → Sign In / Providers](https://supabase.com/dashboard/project/oolkfdamthcxpzzeqkur/auth/providers) открыть **Google**, включить провайдера, вставить Client ID и Client Secret, сохранить. Client Secret хранить только там: не добавлять в `VITE_`-переменные, Git или чат.
5. В **URL Configuration** разрешить адрес возврата приложения: `http://127.0.0.1:5174/` и/или `http://localhost:5174/`. Настройка из раздела восстановления уже покрывает оба сценария. Существующие значения `.env.local` менять не нужно.
6. Открыть приложение, нажать «Войти через Google», выбрать добавленный тестовый аккаунт и завершить вход. Проверить пользователя в Authentication → Users и профиль в `public.profiles`, создать книгу и проверить её после выхода и повторного входа. Проверить отмену Google-входа и вход под вторым аккаунтом. Если email уже использовался, проверить сохранение прежнего каталога: связывание идентичностей выполняет Supabase, ручного копирования книг по email нет.

Перед доступом для всех пользователей завершить настройки Google Audience/публикации, которые потребует консоль. Пароль Google в Shelves не передаётся. Профиль создаётся существующим триггером, RLS остаётся привязанным к `auth.users.id`.

Документация: [Google OAuth через Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
