import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

export function FooterPageLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-white dark:bg-ink-800">
      <header className="sticky top-0 z-30 border-b border-ink-100 dark:border-ink-800 bg-white/85 dark:bg-ink-800/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 dark:text-ink-300 hover:text-brand-600">
              <ArrowLeft size={14} /> {t('pricing.backHome')}
            </Link>
            <button
              onClick={toggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
              aria-label="Mode sombre/clair"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 dark:text-ink-50 sm:text-4xl">{title}</h1>
        <div className="mt-8 space-y-6 text-ink-700 dark:text-ink-200 leading-relaxed">{children}</div>
      </article>
    </div>
  );
}
