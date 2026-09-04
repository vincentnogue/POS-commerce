import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, ArrowRight, ArrowLeft, Radio, WifiOff, Check, X } from 'lucide-react';
import { type PricingPlan } from '../components/PricingCard';
import { CountryFlagsMarquee } from '../components/CountryFlagsMarquee';
import { PLANS as REAL_PLANS, TRIAL_DAYS } from '../lib/plans';
import { useI18n } from '../lib/i18n';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useJsonLd } from '../lib/useJsonLd';
import {
  getExchangeRates,
  convertPrice,
  getSupportedCurrencies,
  getCurrencyInfo,
  formatPrice,
  getRatesStatus,
  type ConvertedPrice,
  type ExchangeRate,
} from '../lib/currency';

// BUG FIX: this page used to define its own disconnected, placeholder plan
// list (Starter/Professional/Enterprise at $29/$99/$299, English SaaS-API
// copy). The real, only prices in the app are $9 / $19 / $49 / $119 — see
// src/lib/plans.ts. We now derive this page's plans from that single
// source of truth so the two pages can never drift apart again.
//
// Fully bilingual now: plan names/descriptions/features/CTAs and all page
// chrome go through t() (see pricing2.* and plan.* keys in
// locales/{fr,en}.ts) instead of being hardcoded French — this page used
// to render French text unconditionally regardless of the site's selected
// language.
function buildPlans(t: (key: string, vars?: Record<string, string | number>) => string): PricingPlan[] {
  return REAL_PLANS.map((p) => ({
    id: p.code,
    name: t(`plan.name.${p.code}`),
    description: t(`plan.landingDesc.${p.code}`),
    basePrice: p.priceMonthly,
    features: p.features.map((f) => ({ name: t(`plan.feature.${f}`), included: true })),
    cta: p.code === 'entreprise'
      ? { text: t('plan.landingCta.contactSales'), href: '/contact' }
      : { text: t('plan.landingCta.tryFree'), href: '/signup' },
    popular: p.popular,
    badge: p.popular ? t('plan.landingBadge.mostPopular') : undefined,
  }));
}

function formatUpdatedAt(iso: string | null, locale: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(locale, {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// BUG FIX: this page used to hardcode a dark gradient background with no
// `dark:` variants (see src/lib/theme.tsx for the app's real light/dark
// toggle), and only offered a single-currency dropdown instead of an actual
// comparison matrix — plus the underlying rates were never real (see the
// fix in src/lib/currency.ts). This page now respects both display modes
// and renders a real matrix of every supported currency against every plan,
// using live converted rates, with an honest "en direct / hors-ligne"
// indicator instead of silently presenting stale numbers as current.
export function PricingPage() {
  const { t, lang } = useI18n();
  useDocumentMeta(t('seo.pricing.title'), t('seo.pricing.desc'));
  // FAQPage structured data — built from the exact same t() calls
  // rendered in the FAQ section below, so this can never drift out of
  // sync with the real, visible page content.
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { q: t('pricing2.faq1.q'), a: t('pricing2.faq1.a') },
      { q: t('pricing2.faq2.q'), a: t('pricing2.faq2.a', { days: TRIAL_DAYS }) },
      { q: t('pricing2.faq3.q'), a: t('pricing2.faq3.a') },
      { q: t('pricing2.faq4.q'), a: t('pricing2.faq4.a', { days: TRIAL_DAYS }) },
      { q: t('pricing2.faq5.q'), a: t('pricing2.faq5.a', { planName: t('plan.name.entreprise') }) },
    ].map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
  const [currency, setCurrency] = useState<string>('USD');
  const [convertedPrices, setConvertedPrices] = useState<Record<string, ConvertedPrice>>({});
  const [rates, setRates] = useState<ExchangeRate | null>(null);
  const [ratesLive, setRatesLive] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [showMatrix, setShowMatrix] = useState(false);

  const PLANS = buildPlans(t);
  // Plans are cumulative/additive in the real data: each higher plan's
  // feature list is a superset of the one below it. The top plan
  // (Entreprise) therefore already lists every feature that exists, in a
  // sensible order — used as-is here rather than re-deriving/sorting a
  // union, so the matrix's row order always matches the plan data exactly.
  const ALL_FEATURES: string[] = REAL_PLANS[REAL_PLANS.length - 1].features;
  const dateLocale = lang === 'fr' ? 'fr-FR' : 'en-US';

  useEffect(() => {
    const initializePage = async () => {
      try {
        setLoading(true);

        const availableCurrencies = getSupportedCurrencies();
        setCurrencies(availableCurrencies);

        // One real fetch powers both the currency selector's converted
        // cards AND the full matrix below — no need to hit the rates
        // endpoint once per cell.
        const liveRates = await getExchangeRates();
        setRates(liveRates);
        const status = getRatesStatus();
        setRatesLive(status.live);
        setRatesUpdatedAt(status.updatedAt);

        // Native currency is USD — don't auto-switch to the visitor's
        // detected locale/IP currency on load (per explicit product
        // decision). The selector below still lets anyone switch manually
        // to see converted prices in their own currency.
        setCurrency('USD');
        await convertPricesForCurrency('USD');
      } catch (error) {
        console.error('Error initializing pricing page:', error);
        setCurrency('USD');
        await convertPricesForCurrency('USD');
      } finally {
        setLoading(false);
      }
    };

    initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency);
    await convertPricesForCurrency(newCurrency);
  };

  async function convertPricesForCurrency(targetCurrency: string) {
    const converted: Record<string, ConvertedPrice> = {};
    for (const plan of PLANS) {
      converted[plan.id] = await convertPrice(plan.basePrice, targetCurrency);
    }
    setConvertedPrices(converted);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 dark:bg-ink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-flow-500/30 border-t-flow-500 animate-spin mx-auto mb-4" />
          <p className="text-ink-500 dark:text-ink-300">{t('pricing2.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-ink-900">
      {/* Sticky top bar — back to home */}
      <div className="sticky top-0 z-40 border-b border-ink-200 dark:border-ink-800 bg-white/90 dark:bg-ink-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 dark:text-ink-300 hover:text-brand-600 dark:hover:text-brand-400 transition"
          >
            <ArrowLeft size={18} /> {t('pricing2.backToHome')}
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-pos-icon.png" alt="POS Flow" className="h-7 w-7" />
            <span className="text-lg font-bold text-brand-600">POS Flow</span>
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="inline-block px-4 py-2 rounded-full bg-flow-500/10 border border-flow-500/30 text-flow-600 dark:text-flow-300 text-sm font-semibold mb-6">
          {t('pricing2.badge')}
        </div>

        <h1 className="text-5xl font-bold text-ink-900 dark:text-white mb-4">
          {t('pricing2.title')}
        </h1>
        <p className="text-xl text-ink-600 dark:text-ink-300 mb-8 max-w-2xl mx-auto">
          {t('pricing2.subtitle', { count: currencies.length })}
        </p>

        {/* Currency Selector */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-flow-500 dark:text-flow-400" />
          <label htmlFor="currency" className="text-ink-600 dark:text-ink-300 font-medium">
            {t('pricing2.currencyLabel')}
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-900 dark:text-white font-semibold hover:border-flow-500/50 transition cursor-pointer"
          >
            {currencies.map((curr) => (
              <option key={curr} value={curr}>
                {curr} - {getCurrencyInfo(curr).name}
              </option>
            ))}
          </select>

          {ratesLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-500/10 text-success-700 dark:text-success-400 text-xs font-medium">
              <Radio className="w-3.5 h-3.5" /> {t('pricing2.ratesLive')}{ratesUpdatedAt ? t('pricing2.ratesUpdatedAt', { date: formatUpdatedAt(ratesUpdatedAt, dateLocale) }) : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-500/10 text-warning-700 dark:text-warning-400 text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5" /> {t('pricing2.ratesOffline')}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <button
            onClick={() => setShowMatrix((v) => !v)}
            className="text-sm font-medium text-flow-600 dark:text-flow-300 hover:text-flow-500 dark:hover:text-flow-200 underline underline-offset-2"
          >
            {t(showMatrix ? 'pricing2.hideMatrix' : 'pricing2.showMatrix', { count: currencies.length })}
          </button>
        </div>
      </div>

      {/* BUG FIX / PRODUCT CHANGE: this page used to show a flat 4-card
          grid (name + price + a plain feature list per card, see
          PricingCard) and hid the real comparison behind a
          click-to-reveal toggle most visitors never clicked. A prospect
          comparing 4 plans across ~20 features has to mentally cross-
          reference 4 separate cards to see what changes between tiers.
          The comparison table already existed and was already correct
          (built straight from src/lib/plans.ts, the single real source
          of truth) — it's now the primary, always-visible content, with
          price + CTA folded into the table itself so nothing is lost by
          removing the card grid. Plans are cumulative/additive in the
          real data: a feature present in a lower plan is present in
          every plan above it, which this table makes directly visible. */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl lg:text-3xl font-bold text-ink-900 dark:text-white mb-2">
            {t('pricing2.comparisonTitle')}
          </h2>
          <p className="text-ink-600 dark:text-ink-300">
            {t('pricing2.comparisonDesc')}
          </p>
        </div>
        <div className="rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 overflow-hidden shadow-soft">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 dark:border-ink-700 bg-brand-50 dark:bg-ink-900/50">
                  <th className="px-4 py-3 text-left font-semibold text-ink-700 dark:text-ink-200 sticky left-0 bg-brand-50 dark:bg-ink-900/50">{t('pricing2.featureCol')}</th>
                  {PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className={`px-4 py-3 text-center font-semibold whitespace-nowrap ${
                        plan.popular ? 'text-brand-700 dark:text-brand-300 bg-brand-100/60 dark:bg-brand-500/10' : 'text-ink-700 dark:text-ink-200'
                      }`}
                    >
                      {plan.popular && <span className="block text-[10px] font-bold text-brand-500 mb-0.5">{t('pricing2.recommended')}</span>}
                      <span className="text-base">{plan.name}</span>
                      <span className="block mt-1 text-lg font-bold text-ink-900 dark:text-white tabular-nums">
                        {convertedPrices[plan.id]?.formatted ?? `$${plan.basePrice}`}
                        <span className="text-xs font-normal text-ink-500 dark:text-ink-400">{t('pricing2.perMonth')}</span>
                      </span>
                      <span className="block mt-0.5 text-[11px] font-normal text-ink-500 dark:text-ink-400 normal-case">{plan.description}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-ink-100 dark:border-ink-700/50 bg-brand-50/40 dark:bg-ink-900/20">
                  <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-ink-50 sticky left-0 bg-brand-50/40 dark:bg-ink-900/20">{t('pricing2.staffIncluded')}</td>
                  {REAL_PLANS.map((p) => (
                    <td key={p.code} className={`px-4 py-2.5 text-center tabular-nums text-ink-700 dark:text-ink-200 ${p.popular ? 'bg-brand-50/60 dark:bg-brand-500/5' : ''}`}>{p.maxUsers}</td>
                  ))}
                </tr>
                <tr className="border-b border-ink-100 dark:border-ink-700/50 bg-brand-50/40 dark:bg-ink-900/20">
                  <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-ink-50 sticky left-0 bg-brand-50/40 dark:bg-ink-900/20">{t('pricing2.storesIncluded')}</td>
                  {REAL_PLANS.map((p) => (
                    <td key={p.code} className={`px-4 py-2.5 text-center tabular-nums text-ink-700 dark:text-ink-200 ${p.popular ? 'bg-brand-50/60 dark:bg-brand-500/5' : ''}`}>{p.maxStores}</td>
                  ))}
                </tr>
                <tr className="border-b border-ink-100 dark:border-ink-700/50 bg-brand-50/40 dark:bg-ink-900/20">
                  <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-ink-50 sticky left-0 bg-brand-50/40 dark:bg-ink-900/20">{t('pricing2.productsIncluded')}</td>
                  {REAL_PLANS.map((p) => (
                    <td key={p.code} className={`px-4 py-2.5 text-center tabular-nums text-ink-700 dark:text-ink-200 ${p.popular ? 'bg-brand-50/60 dark:bg-brand-500/5' : ''}`}>{p.maxProducts.toLocaleString(dateLocale)}</td>
                  ))}
                </tr>
                {ALL_FEATURES.map((feature) => (
                  <tr key={feature} className="border-b border-ink-100 dark:border-ink-700/50 last:border-0 hover:bg-brand-50/60 dark:hover:bg-ink-900/40">
                    <td className="px-4 py-2.5 text-ink-900 dark:text-ink-50 sticky left-0 bg-white dark:bg-ink-800">{t(`plan.feature.${feature}`)}</td>
                    {REAL_PLANS.map((p) => (
                      <td key={p.code} className={`px-4 py-2.5 text-center ${p.popular ? 'bg-brand-50/40 dark:bg-brand-500/5' : ''}`}>
                        {p.features.includes(feature) ? (
                          <Check className="w-4 h-4 text-success-600 dark:text-success-400 inline" />
                        ) : (
                          <X className="w-4 h-4 text-ink-300 dark:text-ink-600 inline" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-brand-50/60 dark:bg-ink-900/40">
                  <td className="px-4 py-4 sticky left-0 bg-brand-50/60 dark:bg-ink-900/40"></td>
                  {PLANS.map((plan) => (
                    <td key={plan.id} className="px-4 py-4 text-center">
                      <Link
                        to={plan.cta.href}
                        className={`inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                          plan.popular
                            ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-md shadow-brand-500/30'
                            : 'bg-flow-500/10 text-flow-700 dark:text-flow-300 hover:bg-flow-500/20 border border-flow-500/30'
                        }`}
                      >
                        {plan.cta.text}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Full currency conversion matrix */}
      {showMatrix && rates && (
        <div className="max-w-6xl mx-auto px-6 pb-16">
          <div className="rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 overflow-hidden shadow-soft">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 dark:border-ink-700 bg-brand-50 dark:bg-ink-900/50">
                    <th className="px-4 py-3 text-left font-semibold text-ink-700 dark:text-ink-200">{t('pricing2.currencyCol')}</th>
                    {PLANS.map((plan) => (
                      <th key={plan.id} className="px-4 py-3 text-right font-semibold text-ink-700 dark:text-ink-200 whitespace-nowrap">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((curr) => {
                    const info = getCurrencyInfo(curr);
                    const rate = rates[curr] ?? 1;
                    return (
                      <tr
                        key={curr}
                        className={`border-b border-ink-100 dark:border-ink-700/50 last:border-0 hover:bg-brand-50/60 dark:hover:bg-ink-900/40 ${
                          curr === currency ? 'bg-flow-500/5' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 text-ink-900 dark:text-ink-50">
                          <span className="font-medium">{curr}</span>
                          <span className="text-ink-400 dark:text-ink-500 ml-2 text-xs">{info.name}</span>
                        </td>
                        {PLANS.map((plan) => (
                          <td key={plan.id} className="px-4 py-2.5 text-right tabular-nums text-ink-700 dark:text-ink-200 whitespace-nowrap">
                            {formatPrice(plan.basePrice * rate, curr)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-ink-400 dark:text-ink-500 mt-3">
            {ratesLive
              ? t('pricing2.liveRatesNote') + (ratesUpdatedAt ? t('pricing2.liveRatesUpdated', { date: formatUpdatedAt(ratesUpdatedAt, dateLocale) }) : '')
              : t('pricing2.offlineRatesNote')}
          </p>
        </div>
      )}

      {/* Pricing Cards grid removed — replaced by the always-visible
          feature comparison table above (price + CTA now live inside the
          table itself), per product decision: a 4-card grid forced
          visitors to cross-reference cards manually instead of seeing the
          full comparison at a glance. */}

      <div className="border-t border-ink-200 dark:border-ink-800/50">
        <CountryFlagsMarquee title={t('pricing2.flagsTitle')} lang={lang} speed="slow" />
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 border-t border-ink-200 dark:border-ink-800/50">
        <h2 className="text-3xl font-bold text-ink-900 dark:text-white text-center mb-12">
          {t('pricing2.faqTitle')}
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              {t('pricing2.faq1.q')}
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              {t('pricing2.faq1.a')}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              {t('pricing2.faq2.q')}
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              {t('pricing2.faq2.a', { days: TRIAL_DAYS })}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              {t('pricing2.faq3.q')}
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              {t('pricing2.faq3.a')}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              {t('pricing2.faq4.q')}
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              {t('pricing2.faq4.a', { days: TRIAL_DAYS })}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              {t('pricing2.faq5.q')}
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              {t('pricing2.faq5.a', { planName: t('plan.name.entreprise') })}
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-ink-900 dark:text-white mb-4">
          {t('pricing2.ctaTitle')}
        </h2>
        <p className="text-xl text-ink-600 dark:text-ink-300 mb-8">
          {t('pricing2.ctaDesc', { days: TRIAL_DAYS })}
        </p>
        <button className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30">
          {t('pricing2.ctaButton')}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
