import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// "Remember me" (LoginPage): a checked box keeps the session in
// localStorage (survives closing the browser — Supabase's normal
// default), unchecked moves it to sessionStorage (cleared when the tab/
// browser closes). The Supabase client's storage adapter is fixed at
// creation time, so this is a small adapter that picks the backing
// store per-call based on a preference flag written BEFORE sign-in
// (see auth.tsx's signIn/signInWithGoogle). The preference flag itself
// always lives in localStorage so it's readable at boot, before any
// session exists. Defaulting to localStorage when the flag has never
// been set at all preserves the exact behaviour every existing user
// already has today — nobody gets silently signed out by this change.
const REMEMBER_ME_KEY = 'liafrik-remember-me';

export function setRememberMePreference(remember: boolean) {
  try {
    window.localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
  } catch {
    // Storage can throw in locked-down/private-browsing contexts —
    // falling back to the default (localStorage-backed) session is a
    // safe failure mode, not a broken login.
  }
}

function activeSessionStorage(): Storage {
  try {
    return window.localStorage.getItem(REMEMBER_ME_KEY) === 'false' ? window.sessionStorage : window.localStorage;
  } catch {
    return window.localStorage;
  }
}

const rememberMeAwareStorage = {
  getItem: (key: string) => activeSessionStorage().getItem(key),
  setItem: (key: string, value: string) => activeSessionStorage().setItem(key, value),
  removeItem: (key: string) => activeSessionStorage().removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: rememberMeAwareStorage,
  },
});
