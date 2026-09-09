import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { translate, type Lang } from './translate';

export type { Lang };

const LOCALE_MAP: Record<Lang, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  ar: 'ar-SA',
  pt: 'pt-PT',
  es: 'es-ES',
  sw: 'sw-KE',
  zh: 'zh-CN',
};

// Right-to-left languages — currently just Arabic. Sets <html dir="rtl">
// so native RTL behavior (text direction, some browser-default mirroring)
// applies; this does NOT mirror the app's own layout (sidebars, icons,
// flex/grid direction across ~150 components) — that's real, separate
// follow-up work, not something a dir attribute alone fixes. Tracked here
// rather than silently doing nothing for Arabic readers.
const RTL_LANGS: readonly Lang[] = ['ar'];

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

const ALL_LANGS: readonly Lang[] = ['fr', 'en', 'ar', 'pt', 'es', 'sw', 'zh'];
function isLang(v: string | null): v is Lang {
  return !!v && (ALL_LANGS as readonly string[]).includes(v);
}

function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'fr';
  // BUG FIX: the ?lang= query param was never actually read anywhere —
  // <link rel="alternate" hreflang="en" href=".../?lang=en"> in
  // index.html pointed search engines at a URL that, once loaded, fell
  // straight back to localStorage/browser language and could render in
  // the wrong language. hreflang only works if each annotated URL
  // reliably renders in the language it claims to.
  const fromUrl = new URLSearchParams(window.location.search).get(URL_PARAM);
  if (isLang(fromUrl)) return fromUrl;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLang(stored)) return stored;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return isLang(browser) ? browser : 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
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

  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);

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

export const LANG_LABELS: Record<Lang, string> = { fr: 'FR', en: 'EN', ar: 'AR', pt: 'PT', es: 'ES', sw: 'SW', zh: '中文' };
export const LANG_NATIVE_NAMES: Record<Lang, string> = {
  fr: 'Français', en: 'English', ar: 'العربية', pt: 'Português', es: 'Español', sw: 'Kiswahili', zh: '中文',
};
