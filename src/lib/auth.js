export const MIN_PASSWORD_LENGTH = 8;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const authRedirectUrl = (path = '/') => new URL(path, window.location.origin).href;

// Read before Supabase consumes the callback fragment.
const callbackUrl = new URL(window.location.href);
const fragment = new URLSearchParams(callbackUrl.hash.slice(1));
export const authCallback = {
  recovery: callbackUrl.pathname === '/reset-password' || fragment.get('type') === 'recovery',
  error: fragment.get('error_code') || fragment.get('error')
    || callbackUrl.searchParams.get('error_code') || callbackUrl.searchParams.get('error'),
};

export function clearAuthCallback(path = window.location.pathname) {
  window.history.replaceState({}, '', path);
}

export function authErrorMessage(error, fallback) {
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code) || error?.status === 429) {
    return 'Слишком много попыток. Подождите несколько минут и попробуйте снова.';
  }
  if (error?.code === 'same_password') return 'Придумайте пароль, который отличается от прежнего.';
  if (error?.code === 'weak_password') return 'Выберите более надёжный пароль: не менее 8 символов.';
  if (['session_not_found', 'refresh_token_not_found', 'otp_expired'].includes(error?.code)) {
    return 'Ссылка устарела. Запросите новое письмо для восстановления пароля.';
  }
  return fallback;
}
