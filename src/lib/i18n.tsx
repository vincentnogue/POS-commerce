import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { fr } from './locales/fr';
import { en } from './locales/en';

export type Lang = 'fr' | 'en';

const dict: Record<Lang, Record<string, string>> = { fr, en };
const LOCALE_MAP: Record<Lang, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

type I18nContextValue = {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number | string, options?: Intl.NumberFormatOptions) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const STORAGE_KEY = 'liafrik_lang';
const URL_PARAM = 'lang';

function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'fr';
  // BUG FIX: the ?lang= query param was never actually read anywhere —
  // <link rel="alternate" hreflang="en" href=".../?lang=en"> in
  // index.html pointed search engines at a URL that, once loaded, fell
  // straight back to localStorage/browser language and could render in
  // the wrong language. hreflang only works if each annotated URL
  // reliably renders in the language it claims to.
  const fromUrl = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (fromUrl === 'fr' || fromUrl === 'en') return fromUrl;
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored === 'fr' || stored === 'en') return stored;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return browser === 'en' ? 'en' : 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = 'ltr';
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const locale = LOCALE_MAP[lang];

  const formatDate = useCallback(
    (value: string | Date, options: Intl.DateTimeFormatOptions = {}) => {
      const date = typeof value === 'string' ? new Date(value) : value;
      return date.toLocaleDateString(locale, options);
    },
    [locale]
  );

  const formatDateTime = useCallback(
    (value: string | Date, options: Intl.DateTimeFormatOptions = {}) => {
      const date = typeof value === 'string' ? new Date(value) : value;
      return date.toLocaleString(locale, options);
    },
    [locale]
  );

  const formatNumber = useCallback(
    (value: number | string, options: Intl.NumberFormatOptions = {}) => {
      const number = typeof value === 'string' ? Number(value) : value;
      return new Intl.NumberFormat(locale, options).format(number);
    },
    [locale]
  );

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const raw = dict[lang][key] ?? dict.fr[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, locale, setLang, t, formatDate, formatDateTime, formatNumber }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export const LANG_LABELS: Record<Lang, string> = { fr: 'FR', en: 'EN' };
