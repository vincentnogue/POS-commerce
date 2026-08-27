import { useState, useEffect } from 'react';
import { Globe, ArrowRight } from 'lucide-react';
import { PricingCard, type PricingPlan } from '../components/PricingCard';
import { PLANS as REAL_PLANS } from '../lib/plans';
import {
  getExchangeRates,
  getUserCurrency,
  convertPrice,
  getSupportedCurrencies,
  getCurrencyInfo,
  type ConvertedPrice,
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

export function PricingPage() {
  const [currency, setCurrency] = useState<string>('USD');
  const [convertedPrices, setConvertedPrices] = useState<Record<string, ConvertedPrice>>({});
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<string[]>([]);

  // Detect user's currency and load prices on mount
  useEffect(() => {
    const initializePage = async () => {
      try {
        setLoading(true);

        // Get available currencies
        const availableCurrencies = getSupportedCurrencies();
        setCurrencies(availableCurrencies);

        // Try to detect user's currency
        const userCurrency = await getUserCurrency();
        setCurrency(userCurrency);

        // Convert prices for this currency
        await convertPricesForCurrency(userCurrency);
      } catch (error) {
        console.error('Error initializing pricing page:', error);
        // Fallback to USD
        setCurrency('USD');
        await convertPricesForCurrency('USD');
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, []);

  // Convert prices when currency changes
  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency);
    await convertPricesForCurrency(newCurrency);
  };

  async function convertPricesForCurrency(targetCurrency: string) {
    const converted: Record<string, ConvertedPrice> = {};

    for (const plan of PLANS) {
      const price = await convertPrice(plan.basePrice, targetCurrency);
      converted[plan.id] = price;
    }

    setConvertedPrices(converted);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-flow-500/30 border-t-flow-500 animate-spin mx-auto mb-4" />
          <p className="text-ink-300">Chargement des tarifs...</p>
        </div>
      </div>
    );
  }

  const currencyInfo = getCurrencyInfo(currency);

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-block px-4 py-2 rounded-full bg-flow-500/10 border border-flow-500/30 text-flow-300 text-sm font-semibold mb-6">
          Tarification simple et transparente
        </div>

        <h1 className="text-5xl font-bold text-white mb-4">
          Choisissez votre plan
        </h1>
        <p className="text-xl text-ink-300 mb-8 max-w-2xl mx-auto">
          Tous les plans incluent l'accès à notre plateforme complète. Évoluez de la petite boutique à l'entreprise.
        </p>

        {/* Currency Selector */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <Globe className="w-5 h-5 text-flow-400" />
          <label htmlFor="currency" className="text-ink-300 font-medium">
            Devise :
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="px-4 py-2 rounded-lg bg-ink-800/50 border border-ink-700 text-white font-semibold hover:border-flow-500/50 transition cursor-pointer"
          >
            {currencies.map((curr) => (
              <option key={curr} value={curr}>
                {curr} - {getCurrencyInfo(curr).name}
              </option>
            ))}
          </select>
          <span className="text-ink-400 text-sm ml-2">
            Taux mis à jour chaque heure
          </span>
        </div>
      </div>

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
                // Navigate to subscription page
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
      <div className="max-w-4xl mx-auto px-6 py-20 border-t border-ink-800/50">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Questions fréquentes
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Puis-je changer de plan à tout moment ?
            </h3>
            <p className="text-ink-300">
              Oui ! Vous pouvez changer de plan à tout moment. Les changements prennent effet à votre prochain cycle de facturation.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Y a-t-il un essai gratuit ?
            </h3>
            <p className="text-ink-300">
              Oui ! Tous les plans incluent un essai gratuit de 7 jours. Aucune carte bancaire requise pour démarrer.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Quels moyens de paiement acceptez-vous ?
            </h3>
            <p className="text-ink-300">
              Nous acceptons les principales cartes bancaires (Visa, Mastercard, American Express), PayPal, ainsi que les moyens de paiement locaux
              dans le monde entier grâce à nos intégrations.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Proposez-vous des remboursements ?
            </h3>
            <p className="text-ink-300">
              Pendant l'essai de 7 jours, vous pouvez annuler et être intégralement remboursé. Passé ce délai, les abonnements ne sont pas remboursables,
              but you can cancel anytime without penalties.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Puis-je utiliser plusieurs moyens de paiement ?
            </h3>
            <p className="text-ink-300">
              Oui ! Notre plan Entreprise prend en charge plusieurs moyens de paiement et des modalités de facturation personnalisées.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Prêt à commencer ?
        </h2>
        <p className="text-xl text-ink-300 mb-8">
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
