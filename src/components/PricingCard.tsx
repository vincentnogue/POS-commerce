import { Check, X, Crown } from 'lucide-react';
import type { ConvertedPrice } from '../lib/currency';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  basePrice: number; // USD — the only currency shown on marketing pages;
                      // full multi-currency conversion lives on /pricing's matrix.
  features: {
    name: string;
    included: boolean;
  }[];
  cta: {
    text: string;
    href: string;
  };
  popular?: boolean;
  badge?: string;
}

interface PricingCardProps {
  plan: PricingPlan;
  // Optional: when provided (e.g. by /pricing's currency selector), the
  // card shows this converted price instead of the raw USD base price.
  // Landing-page callers pass nothing on purpose, so marketing mockups
  // always show USD.
  convertedPrice?: ConvertedPrice;
  onSelect?: (planId: string) => void;
}

// BUG FIX: this card used to hardcode dark-only colors (text-white,
// bg-ink-900/50) with no `dark:` variants — on any light background
// (like the real /pricing page after its own theme fix) the price and
// plan name rendered white-on-white, effectively invisible. It also put
// the CTA button in the middle of the card (right after the price, above
// the feature list) instead of anchored at the bottom. Both fixed below:
// full light/dark support, and a flex column layout with `mt-auto` so the
// CTA always sits at the bottom regardless of how many features a plan
// lists.
export function PricingCard({ plan, convertedPrice, onSelect }: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col h-full rounded-2xl border-2 transition-all ${
        plan.popular
          ? 'border-brand-500 bg-gradient-to-b from-brand-500/10 to-transparent dark:from-brand-500/10 dark:to-transparent shadow-lg shadow-brand-500/10 scale-105 bg-white dark:bg-ink-900'
          : 'border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900/50 hover:border-flow-500/50'
      }`}
    >
      {/* Badge — premium gradient pill with icon + soft glow, instead of a
          flat single-color chip */}
      {plan.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-flow-600 text-white text-xs font-bold whitespace-nowrap shadow-lg shadow-brand-500/40 ring-1 ring-white/40">
            <Crown size={12} className="fill-white/90" strokeWidth={2.5} />
            {plan.badge || 'MOST POPULAR'}
          </div>
        </div>
      )}

      <div className="p-8 flex flex-col flex-1">
        {/* Plan Name */}
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
        <p className="text-sm text-gray-500 dark:text-ink-300 mb-6">{plan.description}</p>

        {/* Price — USD by default; converted price shown only when a caller
            (the /pricing currency selector) explicitly supplies one */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              {convertedPrice ? convertedPrice.formatted : `$${plan.basePrice}`}
            </span>
            <span className="text-gray-400 dark:text-ink-400">
              {convertedPrice ? '/mois' : 'USD / mois'}
            </span>
          </div>
          {convertedPrice && convertedPrice.currency !== 'USD' && (
            <p className="text-xs text-gray-400 dark:text-ink-500 mt-2">
              ${plan.basePrice} USD/mois, converti en {convertedPrice.currency}
            </p>
          )}
        </div>

        {/* Features List */}
        <div className="space-y-4 flex-1">
          <p className="text-xs font-semibold text-gray-400 dark:text-ink-400 uppercase tracking-wider">
            Inclus
          </p>

          {plan.features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3">
              {feature.included ? (
                <Check className="w-5 h-5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="w-5 h-5 text-gray-300 dark:text-ink-600 flex-shrink-0 mt-0.5" />
              )}
              <span
                className={`text-sm ${
                  feature.included ? 'text-gray-700 dark:text-white' : 'text-gray-400 dark:text-ink-500 line-through'
                }`}
              >
                {feature.name}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Button — anchored to the bottom of the card via mt-auto,
            regardless of feature-list length */}
        <button
          onClick={() => onSelect?.(plan.id)}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-all mt-8 ${
            plan.popular
              ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/30'
              : 'bg-flow-500/10 text-flow-700 dark:text-flow-300 hover:bg-flow-500/20 border border-flow-500/30'
          }`}
        >
          {plan.cta.text}
        </button>
      </div>
    </div>
  );
}
