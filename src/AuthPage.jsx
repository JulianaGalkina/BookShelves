import { useState } from 'react';
import { supabase, isGoogleSignInEnabled } from './lib/supabase.js';
import { MIN_PASSWORD_LENGTH, EMAIL_PATTERN, authRedirectUrl, authErrorMessage } from './lib/auth.js';

const DEMO_ACCOUNT = {
  email: 'bookishg@shelves.com',
  password: 'BookishGirrrl',
};

export default function AuthPage({ onAuthenticated, initialMode = 'login', initialError = '', onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
  }

  async function runAction(action, fallback) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (actionError) {
      setError(authErrorMessage(actionError, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLocaleLowerCase('en-US');
    if (!normalizedEmail || !password) {
      setError('Введите адрес электронной почты и пароль.');
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Введите корректный адрес электронной почты.');
      return;
    }

    await runAction(async () => {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError) throw authError;
      onAuthenticated(data.user);
    }, 'Не удалось войти. Проверьте почту, пароль и соединение.');
  }

  async function handleRegister(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLocaleLowerCase('en-US');
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Введите корректный адрес электронной почты.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов.`);
      return;
    }

    await runAction(async () => {
      const { data, error: authError } = await supabase.auth.signUp({ email: normalizedEmail, password });
      if (authError) {
        if (['user_already_exists', 'email_exists'].includes(authError.code)) {
          setError('Аккаунт с такой почтой уже существует.');
          return;
        }
        throw authError;
      }
      if (!data.session) {
        setError('Не удалось войти после регистрации. Обратитесь к администратору.');
        return;
      }
      onAuthenticated(data.session.user);
    }, 'Не удалось создать аккаунт. Проверьте соединение и попробуйте снова.');
  }

  async function signInAsDemo() {
    await runAction(async () => {
      const { data, error: authError } = await supabase.auth.signInWithPassword(DEMO_ACCOUNT);
      if (authError) throw authError;
      onAuthenticated(data.user);
    }, 'Не удалось войти в тестовый аккаунт. Попробуйте позже.');
  }

  async function sendResetEmail(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLocaleLowerCase('en-US');
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Введите корректный адрес электронной почты.');
      return;
    }
    await runAction(async () => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: authRedirectUrl('/reset-password'),
      });
      if (resetError) throw resetError;
      setNotice('Если аккаунт с такой почтой существует, вы получите письмо со ссылкой для смены пароля. Проверьте также папку «Спам».');
    }, 'Не удалось отправить письмо. Попробуйте позже. Если ошибка повторяется, обратитесь к администратору.');
  }

  async function signInWithGoogle() {
    await runAction(async () => {
      if (!await isGoogleSignInEnabled()) {
        setError('Вход через Google пока не подключён. Войдите по почте и паролю.');
        return;
      }
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: authRedirectUrl(), skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('Missing OAuth URL');
      window.location.assign(data.url);
    }, 'Не удалось открыть вход через Google. Попробуйте позже или войдите по почте и паролю.');
  }

  const forgot = mode === 'forgot';

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <a className="brand auth-brand" href="#top" aria-label="Shelves — книжный трекер">
          Shelves<span className="title-period">.</span>
        </a>
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-heading">
            <span className="eyebrow"><span className="eyebrow-line" /> ЛИЧНОЕ ПРОСТРАНСТВО</span>
            <h1 id="auth-title">{forgot ? 'Забыли пароль?' : mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h1>
            <p>{forgot ? 'Укажите почту аккаунта — отправим ссылку для смены пароля.' : mode === 'login' ? 'Войдите, чтобы открыть свою книжную полку.' : 'Зарегистрируйтесь, чтобы вести свой каталог книг.'}</p>
          </div>

          {!forgot && <div className="auth-tabs" role="tablist" aria-label="Действие с аккаунтом">
            <button type="button" role="tab" disabled={busy} aria-selected={mode === 'login'} className={mode === 'login' ? 'auth-tab is-active' : 'auth-tab'} onClick={() => changeMode('login')}>Вход</button>
            <button type="button" role="tab" disabled={busy} aria-selected={mode === 'register'} className={mode === 'register' ? 'auth-tab is-active' : 'auth-tab'} onClick={() => changeMode('register')}>Регистрация</button>
          </div>}

          <form className={forgot ? 'auth-form auth-spaced' : 'auth-form'} noValidate onSubmit={forgot ? sendResetEmail : mode === 'login' ? handleLogin : handleRegister}>
            <label className="auth-field">
              <span>Электронная почта</span>
              <input type="email" name="email" autoComplete="email" required disabled={busy} value={email} onChange={(event) => { setEmail(event.target.value); setError(''); setNotice(''); }} placeholder="name@example.com" />
            </label>
            {!forgot && <label className="auth-field">
              <span>Пароль</span>
              <input type="password" name="password" disabled={busy} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? MIN_PASSWORD_LENGTH : undefined} required value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder={mode === 'register' ? `Не менее ${MIN_PASSWORD_LENGTH} символов` : 'Введите пароль'} />
            </label>}
            {mode === 'login' && <button className="auth-link" type="button" disabled={busy} onClick={() => changeMode('forgot')}>Забыли пароль?</button>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Подождите…' : forgot ? 'Отправить ссылку' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
            {forgot && <button className="auth-link" type="button" disabled={busy} onClick={() => { changeMode('login'); onBack?.(); }}>Вернуться ко входу</button>}
          </form>

          {!forgot && <>
          <div className="auth-divider"><span>или</span></div>
          <button type="button" className="button button-secondary auth-submit" disabled={busy} onClick={signInWithGoogle}>Войти через Google</button>
          <section className="demo-account" aria-labelledby="demo-account-title">
            <div className="demo-account-heading">
              <span className="section-kicker">ДЛЯ ЗНАКОМСТВА</span>
              <h2 id="demo-account-title">Тестовый аккаунт</h2>
            </div>
            <dl className="demo-credentials">
              <div><dt>Почта</dt><dd>{DEMO_ACCOUNT.email}</dd></div>
              <div><dt>Пароль</dt><dd>{DEMO_ACCOUNT.password}</dd></div>
            </dl>
            <button type="button" className="button button-secondary demo-submit" onClick={signInAsDemo} disabled={busy}>Войти под тестовым аккаунтом</button>
          </section>
          </>}
        </section>
        <p className="auth-footnote">Аккаунт и каталог сохраняются в Supabase и доступны после входа.</p>
      </div>
    </main>
  );
}
