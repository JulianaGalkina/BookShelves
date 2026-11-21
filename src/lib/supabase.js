import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.local.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export async function isGoogleSignInEnabled() {
  const response = await fetch(new URL('/auth/v1/settings', supabaseUrl), {
    headers: { apikey: supabaseAnonKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Auth settings unavailable');
  const settings = await response.json();
  return settings.external?.google === true;
}
