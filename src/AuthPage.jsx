import { useState } from 'react';

const USERS_KEY = 'shelves-auth-users-v1';
const SESSION_KEY = 'shelves-auth-session-v1';
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEMO_ACCOUNT = {
  id: 'shelves-demo-account',
  email: 'bookishg@shelves.com',
  password: 'BookishGirrrl',
  isDemo: true,
};

function readUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

export function getCurrentUser() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!session?.id) return null;
    if (session.id === DEMO_ACCOUNT.id) return DEMO_ACCOUNT;
    const user = readUsers().find((account) => account.id === session.id);
    return user ? { id: user.id, email: user.email, isDemo: false } : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
}

function beginSession(account, onAuthenticated) {
  const user = { id: account.id, email: account.email, isDemo: Boolean(account.isDemo) };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id }));
  onAuthenticated(user);
}

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  function handleLogin(event) {
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
    const account = normalizedEmail === DEMO_ACCOUNT.email
      ? (password === DEMO_ACCOUNT.password ? DEMO_ACCOUNT : null)
      : readUsers().find((user) => user.email === normalizedEmail && user.password === password);

    if (!account) {
      setError('Проверьте адрес почты и пароль.');
      return;
    }
    beginSession(account, onAuthenticated);
  }

  function handleRegister(event) {
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
    const users = readUsers();
    if (normalizedEmail === DEMO_ACCOUNT.email || users.some((user) => user.email === normalizedEmail)) {
      setError('Аккаунт с таким адресом уже существует.');
      return;
    }

    const account = { id: crypto.randomUUID(), email: normalizedEmail, password };
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify([...users, account]));
      beginSession(account, onAuthenticated);
    } catch {
      setError('Не удалось сохранить аккаунт в этом браузере.');
    }
  }

  function signInAsDemo() {
    beginSession(DEMO_ACCOUNT, onAuthenticated);
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <a className="brand auth-brand" href="#top" aria-label="Shelves — книжный трекер">
          Shelves<span className="title-period">.</span>
        </a>
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-heading">
            <span className="eyebrow"><span className="eyebrow-line" /> ЛИЧНОЕ ПРОСТРАНСТВО</span>
            <h1 id="auth-title">{mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h1>
            <p>{mode === 'login' ? 'Войдите, чтобы открыть свою книжную полку.' : 'Зарегистрируйтесь, чтобы вести свой каталог книг.'}</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Действие с аккаунтом">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'auth-tab is-active' : 'auth-tab'} onClick={() => changeMode('login')}>Вход</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'auth-tab is-active' : 'auth-tab'} onClick={() => changeMode('register')}>Регистрация</button>
          </div>

          <form className="auth-form" noValidate onSubmit={mode === 'login' ? handleLogin : handleRegister}>
            <label className="auth-field">
              <span>Электронная почта</span>
              <input type="email" name="email" autoComplete="username" required value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="name@example.com" />
            </label>
            <label className="auth-field">
              <span>Пароль</span>
              <input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? MIN_PASSWORD_LENGTH : undefined} required value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder={mode === 'register' ? `Не менее ${MIN_PASSWORD_LENGTH} символов` : 'Введите пароль'} />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" type="submit">{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
          </form>

          <section className="demo-account" aria-labelledby="demo-account-title">
            <div className="demo-account-heading">
              <span className="section-kicker">ДЛЯ ЗНАКОМСТВА</span>
              <h2 id="demo-account-title">Тестовый аккаунт</h2>
            </div>
            <dl className="demo-credentials">
              <div><dt>Почта</dt><dd>{DEMO_ACCOUNT.email}</dd></div>
              <div><dt>Пароль</dt><dd>{DEMO_ACCOUNT.password}</dd></div>
            </dl>
            <button type="button" className="button button-secondary demo-submit" onClick={signInAsDemo}>Войти под тестовым аккаунтом</button>
          </section>
        </section>
        <p className="auth-footnote">Локальный прототип: вход, регистрация и книги сохраняются только в этом браузере.</p>
      </div>
    </main>
  );
}
