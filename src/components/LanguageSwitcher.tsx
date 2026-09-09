import { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useI18n, LANG_LABELS, LANG_NATIVE_NAMES } from '../lib/i18n';
import type { Lang } from '../lib/i18n';

const ALL_LANGS: Lang[] = ['fr', 'en', 'ar', 'pt', 'es', 'sw', 'zh'];

// Replaces the old fr<->en toggle button (Header.tsx + 3 spots in
// LandingPage.tsx) now that there are 7 languages, not 2 — a binary
// toggle can't reach the other 5. Same dark/light-aware pill styling as
// the button it replaces.
export function LanguageSwitcher({ className = '', variant = 'default' }: { className?: string; variant?: 'default' | 'dark' }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          variant === 'dark'
            ? 'inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs font-medium text-ink-400 transition hover:border-brand-400/50 hover:text-brand-400'
            : 'inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 dark:border-ink-700 px-3 text-xs font-medium text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600'
        }
        aria-label={t('header.switchLanguage')}
        aria-expanded={open}
      >
        <Globe size={14} />
        {LANG_LABELS[lang]}
      </button>
      {open && (
        <div className={`absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border py-1 shadow-lg ${
          variant === 'dark' ? 'border-white/10 bg-ink-900' : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800'
        }`}>
          {ALL_LANGS.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => { setLang(code); setOpen(false); }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                variant === 'dark'
                  ? `hover:bg-white/5 ${lang === code ? 'font-medium text-brand-400' : 'text-ink-300'}`
                  : `hover:bg-brand-50 dark:hover:bg-brand-900/25 ${lang === code ? 'font-medium text-brand-700' : 'text-ink-700 dark:text-ink-200'}`
              }`}
            >
              {LANG_NATIVE_NAMES[code]}
              {lang === code && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
