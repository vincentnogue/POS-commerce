import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft, Sparkles, Moon, Sun } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { PLANS, annualPrice, annualSavings, TRIAL_DAYS } from '../lib/plans';

export function PricingPage() {
  const { t, lang } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-ink-800">
      <header className="sticky top-0 z-30 border-b border-ink-100 dark:border-ink-800 bg-white/85 dark:bg-ink-800/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 lg:px-8">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
              aria-label="Mode sombre/clair"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/login" className="text-sm font-medium text-ink-700 dark:text-ink-200 hover:text-brand-600">{t('nav.login')}</Link>
            <Link to="/signup" className="btn-primary">{t('nav.signup')}</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-medium uppercase tracking-wide text-brand-600">{t('nav.pricing')}</p>
          <h1 className="mt-2 text-4xl font-medium tracking-tight text-ink-900 dark:text-ink-50 sm:text-5xl">Un plan pour chaque ambition</h1>
          <p className="mt-4 text-lg text-ink-600 dark:text-ink-300">{t('pricing.subtitle')}</p>

          {/* Monthly / Annual toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-900 p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${!annual ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-50 shadow-soft' : 'text-ink-500 dark:text-ink-400'}`}
            >
              {t('pricing.monthly')}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition ${annual ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-50 shadow-soft' : 'text-ink-500 dark:text-ink-400'}`}
            >
              {t('pricing.annual')}
              <span className="rounded-full bg-success-100 dark:bg-success-900/35 px-2 py-0.5 text-[10px] font-medium text-success-700">{t('pricing.annualSave')}</span>
            </button>
          </div>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => {
            const displayPrice = annual ? annualPrice(p.priceMonthly) : p.priceMonthly;
            return (
              <motion.div
                key={p.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`relative flex h-full flex-col rounded-2xl2 border bg-white dark:bg-ink-800 p-6 ${p.highlight ? 'border-brand-300 shadow-float ring-1 ring-brand-200' : 'border-ink-200 dark:border-ink-700'}`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white">
                    {t('pricing.popular')}
                  </span>
                )}
                <h3 className="text-lg font-medium text-ink-900 dark:text-ink-50">{p.name}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-medium text-ink-900 dark:text-ink-50">${displayPrice}</span>
                  <span className="mb-1 text-sm text-ink-500 dark:text-ink-400">{annual ? '/an' : t('pricing.perMonth')} {t('pricing.usd')}</span>
                </div>
                {annual && (
                  <p className="mt-1 text-xs font-medium text-success-600">
                    {t('pricing.annualSave')} · ${(annualSavings(p.priceMonthly))} {t('pricing.usd')}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">{p.maxUsers} utilisateurs · {p.maxStores} magasin{p.maxStores > 1 ? 's' : ''}</p>

                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/25 px-2.5 py-1.5 text-xs font-medium text-brand-700">
                  <Sparkles size={12} /> {TRIAL_DAYS}{lang === 'fr' ? 'j' : 'd'} {lang === 'fr' ? 'essai gratuit' : 'free trial'}
                </div>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-700 dark:text-ink-200">
                      <Check size={16} className="mt-0.5 shrink-0 text-brand-500" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`mt-6 w-full justify-center ${p.highlight ? 'btn-primary' : 'btn-ghost'}`}>
                  {t('pricing.tryFree')} <ArrowRight size={16} />
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            { title: 'Paiement flexible', desc: 'Carte bancaire via Stripe, Mobile Money via Flutterwave.' },
            { title: 'Sans engagement', desc: 'Annulez à tout moment, vos données restent exportables.' },
            { title: 'Support inclus', desc: 'Tous les plans incluent un support. Entreprise dispose du 24/7.' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 dark:bg-brand-900/25 p-5">
              <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{f.title}</p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
            <ArrowLeft size={14} /> {t('pricing.backHome')}
          </Link>
        </div>
      </section>
    </div>
  );
}
