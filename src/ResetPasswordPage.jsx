import { useState } from 'react';
import { supabase } from './lib/supabase.js';
import { MIN_PASSWORD_LENGTH, authErrorMessage } from './lib/auth.js';

export default function ResetPasswordPage({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function savePassword(event) {
    event.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен содержать не менее ${MIN_PASSWORD_LENGTH} символов.`);
      return;
    }
    if (password !== confirmation) {
      setError('Пароли не совпадают.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirmation('');
      setSaved(true);
    } catch (updateError) {
      setError(authErrorMessage(updateError, 'Не удалось сохранить пароль. Проверьте соединение и попробуйте снова. Если ссылка устарела, запросите новую.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <span className="brand auth-brand">Shelves<span className="title-period">.</span></span>
        <section className="auth-panel" aria-labelledby="reset-title">
          <div className="auth-heading">
            <h1 id="reset-title">{saved ? 'Пароль изменён' : 'Новый пароль'}</h1>
            <p>{saved ? 'Теперь вы можете входить с новым паролем.' : 'Придумайте новый пароль для своего аккаунта.'}</p>
          </div>
          {saved ? (
            <button className="button button-primary auth-submit auth-spaced" onClick={onComplete}>Открыть каталог</button>
          ) : (
            <form className="auth-form auth-spaced" onSubmit={savePassword} noValidate>
              <label className="auth-field">
                <span>Новый пароль</span>
                <input type="password" name="new-password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} placeholder="Не менее 8 символов" />
              </label>
              <label className="auth-field">
                <span>Повторите пароль</span>
                <input type="password" name="confirm-password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить пароль'}</button>
              {error && <a className="auth-link" href="/reset-password?retry=1">Запросить новую ссылку</a>}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
