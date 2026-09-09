import { fr } from './locales/fr';
import { en } from './locales/en';
import { ar } from './locales/ar';
import { pt } from './locales/pt';
import { es } from './locales/es';
import { sw } from './locales/sw';
import { zh } from './locales/zh';

export type Lang = 'fr' | 'en' | 'ar' | 'pt' | 'es' | 'sw' | 'zh';

const dict: Record<Lang, Record<string, string>> = { fr, en, ar, pt, es, sw, zh };

// Extracted as a standalone pure function (out of i18n.tsx, which is
// otherwise a component-only file for fast-refresh purposes) so the
// fallback chain (current language → French → the raw key itself) and
// the {var} interpolation can be unit tested without mounting the full
// I18nProvider/React tree. This is the exact logic the `t()` hook already
// used inline — behavior is unchanged, it's just callable in isolation
// now.
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const raw = dict[lang][key] ?? dict.fr[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
