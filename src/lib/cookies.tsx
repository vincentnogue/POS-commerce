import { useState, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

type CookiePrefs = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
};

type CookieContextValue = {
  prefs: CookiePrefs | null;
  setPrefs: (p: CookiePrefs) => void;
  reset: () => void;
};

const CookieContext = createContext<CookieContextValue | undefined>(undefined);
const COOKIE_KEY = 'liafrik_cookie_prefs';

export function CookieProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<CookiePrefs | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(COOKIE_KEY);
    return raw ? (JSON.parse(raw) as CookiePrefs) : null;
  });

  const setPrefs = useCallback((p: CookiePrefs) => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(p));
    setPrefsState(p);
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(COOKIE_KEY);
    setPrefsState(null);
  }, []);

  return (
    <CookieContext.Provider value={{ prefs, setPrefs, reset }}>{children}</CookieContext.Provider>
  );
}

export function useCookies() {
  const ctx = useContext(CookieContext);
  if (!ctx) throw new Error('useCookies must be used within CookieProvider');
  return ctx;
}
