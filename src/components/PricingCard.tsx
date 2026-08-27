import { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { ConvertedPrice } from '../lib/currency';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  basePrice: number; // USD
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
  convertedPrice: ConvertedPrice;
  onSelect?: (planId: string) => void;
}

export function PricingCard({ plan, convertedPrice, onSelect }: PricingCardProps) {
  return (
    <div
      className={`relative rounded-2xl border-2 transition-all ${
        plan.popular
          ? 'border-brand-500 bg-gradient-to-b from-brand-500/10 to-transparent shadow-lg shadow-brand-500/20 scale-105'
          : 'border-ink-700 bg-ink-900/50 hover:border-flow-500/50'
      }`}
    >
      {/* Badge */}
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="px-4 py-1 rounded-full bg-brand-500 text-white text-xs font-bold">
            {plan.badge || 'MOST POPULAR'}
          </div>
        </div>
      )}

      <div className="p-8">
        {/* Plan Name */}
        <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
        <p className="text-sm text-ink-300 mb-6">{plan.description}</p>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">
              {convertedPrice.formatted}
            </span>
            <span className="text-ink-400">/month</span>
          </div>
          <p className="text-xs text-ink-500 mt-2">
            USD ${plan.basePrice}/month, converted to {convertedPrice.currency}
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => onSelect?.(plan.id)}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-all mb-8 ${
            plan.popular
              ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/30'
              : 'bg-flow-500/20 text-flow-300 hover:bg-flow-500/30 border border-flow-500/30'
          }`}
        >
          {plan.cta.text}
        </button>

        {/* Features List */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
            What's Included
          </p>

          {plan.features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3">
              {feature.included ? (
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="w-5 h-5 text-ink-600 flex-shrink-0 mt-0.5" />
              )}
              <span
                className={`text-sm ${
                  feature.included ? 'text-white' : 'text-ink-500 line-through'
                }`}
              >
                {feature.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
