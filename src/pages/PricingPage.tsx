import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, ArrowRight, ArrowLeft, Radio, WifiOff } from 'lucide-react';
import { PricingCard, type PricingPlan } from '../components/PricingCard';
import { PLANS as REAL_PLANS } from '../lib/plans';
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
const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: 'Idéal pour démarrer votre commerce',
  pro: 'Pour les commerces en croissance',
  premium: 'Fonctionnalités avancées et support prioritaire',
  entreprise: 'Pour les grandes organisations multi-boutiques',
};

const PLANS: PricingPlan[] = REAL_PLANS.map((p) => ({
  id: p.code,
  name: p.name,
  description: PLAN_DESCRIPTIONS[p.code] ?? '',
  basePrice: p.priceMonthly,
  features: p.features.map((f) => ({ name: f, included: true })),
  cta: p.code === 'entreprise'
    ? { text: 'Contacter les ventes', href: '/contact' }
    : { text: 'Essayer gratuitement', href: '/signup' },
  popular: p.popular,
  badge: p.popular ? 'LE PLUS POPULAIRE' : undefined,
}));

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
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
  const [currency, setCurrency] = useState<string>('USD');
  const [convertedPrices, setConvertedPrices] = useState<Record<string, ConvertedPrice>>({});
  const [rates, setRates] = useState<ExchangeRate | null>(null);
  const [ratesLive, setRatesLive] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [showMatrix, setShowMatrix] = useState(false);

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
          <p className="text-ink-500 dark:text-ink-300">Chargement des tarifs...</p>
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
            <ArrowLeft size={18} /> Retour à l'accueil
          </Link>
          <Link to="/" className="text-lg font-bold text-brand-600">POS Flow</Link>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="inline-block px-4 py-2 rounded-full bg-flow-500/10 border border-flow-500/30 text-flow-600 dark:text-flow-300 text-sm font-semibold mb-6">
          Tarification simple et transparente
        </div>

        <h1 className="text-5xl font-bold text-ink-900 dark:text-white mb-4">
          Choisissez votre plan
        </h1>
        <p className="text-xl text-ink-600 dark:text-ink-300 mb-8 max-w-2xl mx-auto">
          Tous les plans incluent l'accès à notre plateforme complète. Prix affichés en dollars US (devise native) — convertissez dans n'importe laquelle de nos {currencies.length}+ devises ci-dessous.
        </p>

        {/* Currency Selector */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-flow-500 dark:text-flow-400" />
          <label htmlFor="currency" className="text-ink-600 dark:text-ink-300 font-medium">
            Devise :
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
              <Radio className="w-3.5 h-3.5" /> Taux en direct{ratesUpdatedAt ? ` · MàJ ${formatUpdatedAt(ratesUpdatedAt)}` : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-500/10 text-warning-700 dark:text-warning-400 text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5" /> Taux hors-ligne (indicatifs)
            </span>
          )}
        </div>

        <button
          onClick={() => setShowMatrix((v) => !v)}
          className="text-sm font-medium text-flow-600 dark:text-flow-300 hover:text-flow-500 dark:hover:text-flow-200 underline underline-offset-2"
        >
          {showMatrix ? 'Masquer' : 'Afficher'} la matrice complète de conversion ({currencies.length} devises)
        </button>
      </div>

      {/* Full currency conversion matrix */}
      {showMatrix && rates && (
        <div className="max-w-6xl mx-auto px-6 pb-16">
          <div className="rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 overflow-hidden shadow-soft">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 dark:border-ink-700 bg-brand-50 dark:bg-ink-900/50">
                    <th className="px-4 py-3 text-left font-semibold text-ink-700 dark:text-ink-200">Devise</th>
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
              ? `Taux réels via open.er-api.com, base USD${ratesUpdatedAt ? `, mis à jour le ${formatUpdatedAt(ratesUpdatedAt)}` : ''}.`
              : 'Le service de taux en direct est momentanément indisponible — ces valeurs sont des taux indicatifs hors-ligne, pas les taux du marché actuel.'}
          </p>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              convertedPrice={convertedPrices[plan.id] || {
                usd: plan.basePrice,
                currency: 'USD',
                amount: plan.basePrice,
                formatted: `$${plan.basePrice}`,
                rate: 1,
              }}
              onSelect={(planId) => {
                const cta = PLANS.find((p) => p.id === planId)?.cta;
                if (cta) {
                  window.location.href = cta.href;
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 border-t border-ink-200 dark:border-ink-800/50">
        <h2 className="text-3xl font-bold text-ink-900 dark:text-white text-center mb-12">
          Questions fréquentes
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              Puis-je changer de plan à tout moment ?
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              Oui ! Vous pouvez changer de plan à tout moment. Les changements prennent effet à votre prochain cycle de facturation.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              Y a-t-il un essai gratuit ?
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              Oui ! Tous les plans incluent un essai gratuit de 7 jours. Aucune carte bancaire requise pour démarrer.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              Quels moyens de paiement acceptez-vous ?
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              Nous acceptons les principales cartes bancaires (Visa, Mastercard, American Express), PayPal, ainsi que les moyens de paiement locaux
              dans le monde entier grâce à nos intégrations.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              Proposez-vous des remboursements ?
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              Pendant l'essai de 7 jours, vous pouvez annuler et être intégralement remboursé. Passé ce délai, les abonnements ne sont pas remboursables,
              mais vous pouvez annuler à tout moment sans pénalité.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink-900 dark:text-white mb-2">
              Puis-je utiliser plusieurs moyens de paiement ?
            </h3>
            <p className="text-ink-600 dark:text-ink-300">
              Oui ! Notre plan Entreprise prend en charge plusieurs moyens de paiement et des modalités de facturation personnalisées.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-ink-900 dark:text-white mb-4">
          Prêt à commencer ?
        </h2>
        <p className="text-xl text-ink-600 dark:text-ink-300 mb-8">
          Démarrez votre essai gratuit de 7 jours dès aujourd'hui. Aucune carte bancaire requise.
        </p>
        <button className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30">
          Démarrer l'essai gratuit
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
