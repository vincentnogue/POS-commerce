import { useState, useEffect } from 'react';
import { Globe, ArrowRight } from 'lucide-react';
import { PricingCard, type PricingPlan } from '../components/PricingCard';
import {
  getExchangeRates,
  getUserCurrency,
  convertPrice,
  getSupportedCurrencies,
  getCurrencyInfo,
  type ConvertedPrice,
} from '../lib/currency';

// Pricing plans (USD base)
const PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small businesses',
    basePrice: 29,
    features: [
      { name: 'Up to 5 integrations', included: true },
      { name: '100 requests per minute', included: true },
      { name: 'Up to 3 team members', included: true },
      { name: 'Email support', included: true },
      { name: 'API access', included: false },
      { name: 'Webhooks', included: false },
    ],
    cta: {
      text: 'Get Started',
      href: '/subscribe?plan=starter',
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For growing businesses',
    basePrice: 99,
    features: [
      { name: 'Up to 10 integrations', included: true },
      { name: '500 requests per minute', included: true },
      { name: 'Up to 10 team members', included: true },
      { name: 'Priority email & chat support', included: true },
      { name: 'API access', included: true },
      { name: 'Webhooks', included: true },
    ],
    cta: {
      text: 'Choose Plan',
      href: '/subscribe?plan=professional',
    },
    popular: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    basePrice: 299,
    features: [
      { name: 'Unlimited integrations', included: true },
      { name: '1000 requests per minute', included: true },
      { name: 'Unlimited team members', included: true },
      { name: '24/7 phone & dedicated manager', included: true },
      { name: 'API access', included: true },
      { name: 'Webhooks & custom integrations', included: true },
    ],
    cta: {
      text: 'Contact Sales',
      href: '/contact-sales?plan=enterprise',
    },
  },
];

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
          <p className="text-ink-300">Loading pricing...</p>
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
          Simple, Transparent Pricing
        </div>

        <h1 className="text-5xl font-bold text-white mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-ink-300 mb-8 max-w-2xl mx-auto">
          All plans include access to our full platform. Scale from startup to enterprise.
        </p>

        {/* Currency Selector */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <Globe className="w-5 h-5 text-flow-400" />
          <label htmlFor="currency" className="text-ink-300 font-medium">
            Currency:
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
            Rates updated hourly
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
          Frequently Asked Questions
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Can I change plans anytime?
            </h3>
            <p className="text-ink-300">
              Yes! You can upgrade or downgrade your plan anytime. Changes take effect on your next billing cycle.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Is there a free trial?
            </h3>
            <p className="text-ink-300">
              Yes! All plans include a 7-day free trial. No credit card required to start.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              What payment methods do you accept?
            </h3>
            <p className="text-ink-300">
              We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and local payment methods
              in 50+ countries through our integrations.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Do you offer refunds?
            </h3>
            <p className="text-ink-300">
              During the 7-day trial, you can cancel for a full refund. After that, subscriptions are non-refundable,
              but you can cancel anytime without penalties.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Can I use multiple payment methods?
            </h3>
            <p className="text-ink-300">
              Yes! Our Enterprise plan supports multiple payment methods and custom billing arrangements.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Ready to get started?
        </h2>
        <p className="text-xl text-ink-300 mb-8">
          Start your 7-day free trial today. No credit card required.
        </p>
        <button className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30">
          Start Free Trial
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
