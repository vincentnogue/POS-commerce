import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useI18n } from '../lib/i18n';

export function FooterPageLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-brand-600">
            <ArrowLeft size={14} /> {t('pricing.backHome')}
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
        <div className="mt-8 space-y-6 text-ink-700 leading-relaxed">{children}</div>
      </article>
    </div>
  );
}
