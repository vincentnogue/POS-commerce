import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Shield, ChevronDown, ExternalLink } from 'lucide-react';

interface PlanAccess {
  plan: string;
  features: { feature: string; included: boolean }[];
  canConnect: boolean;
  apiLimit?: string;
}

const INTEGRATION_DETAILS: Record<string, any> = {
  stripe: {
    name: 'Stripe',
    logo: '💳',
    description: 'Process payments globally with the most trusted payment processor',
    countries: 195,
    currencies: 135,
    volume: '1M+ transactions/day',
    pricing: '2.9% + $0.30 per transaction',
    features: [
      'Real-time payment processing',
      'Subscription billing & recurring charges',
      'Automated invoicing',
      'Chargeback & fraud protection',
      'Multi-currency support',
      'Webhook events & API',
      'PCI DSS compliance',
      '24/7 support',
    ],
    plans: [
      {
        plan: 'Starter ($9/mo)',
        features: [
          { feature: 'Basic payment processing', included: true },
          { feature: 'USD only', included: true },
          { feature: 'Webhook notifications', included: true },
          { feature: 'Multi-currency support', included: false },
          { feature: 'Advanced fraud tools', included: false },
          { feature: 'Payout scheduling', included: false },
        ],
        canConnect: true,
        apiLimit: '100 calls/min',
      },
      {
        plan: 'Professional ($19/mo)',
        features: [
          { feature: 'Full payment processing', included: true },
          { feature: 'Multi-currency (50+)', included: true },
          { feature: 'Webhook notifications', included: true },
          { feature: 'Basic fraud detection', included: true },
          { feature: 'Advanced fraud tools', included: false },
          { feature: 'Payout scheduling', included: false },
        ],
        canConnect: true,
        apiLimit: '500 calls/min',
      },
      {
        plan: 'Business ($49/mo)',
        features: [
          { feature: 'Full payment processing', included: true },
          { feature: 'Multi-currency (135+)', included: true },
          { feature: 'Advanced webhooks', included: true },
          { feature: 'Advanced fraud detection', included: true },
          { feature: 'Payout scheduling', included: true },
          { feature: 'Custom integrations', included: true },
        ],
        canConnect: true,
        apiLimit: '1000 calls/min',
      },
      {
        plan: 'Enterprise ($119/mo)',
        features: [
          { feature: 'Full payment processing', included: true },
          { feature: 'All currencies (135+)', included: true },
          { feature: 'Advanced webhooks', included: true },
          { feature: 'Advanced fraud detection', included: true },
          { feature: 'Payout scheduling', included: true },
          { feature: 'Custom integrations', included: true },
        ],
        canConnect: true,
        apiLimit: 'Unlimited',
      },
    ],
    docs: 'https://stripe.com/docs',
    support: 'https://support.stripe.com',
  },
  paypal: {
    name: 'PayPal',
    logo: '🅿️',
    description: 'Accept payments from 300M+ PayPal users worldwide',
    countries: 200,
    currencies: 100,
    volume: '2M+ transactions/day',
    pricing: '2.99% + $0.30 per transaction',
    features: [
      'PayPal wallet integration',
      'Credit card processing',
      'Local payment methods',
      'Subscription & recurring billing',
      'Buyer & seller protection',
      'Smart Payment Buttons',
      'Cryptocurrency ready',
      'Advanced reporting',
    ],
    plans: [
      {
        plan: 'Starter ($9/mo)',
        features: [
          { feature: 'PayPal wallet only', included: true },
          { feature: 'Single currency', included: true },
          { feature: 'Basic reporting', included: true },
          { feature: 'Credit card processing', included: false },
          { feature: 'Webhooks', included: false },
        ],
        canConnect: true,
        apiLimit: '100 calls/min',
      },
      {
        plan: 'Professional ($19/mo)',
        features: [
          { feature: 'PayPal wallet', included: true },
          { feature: 'Multi-currency (50+)', included: true },
          { feature: 'Advanced reporting', included: true },
          { feature: 'Credit card processing', included: true },
          { feature: 'Webhooks', included: false },
        ],
        canConnect: true,
        apiLimit: '500 calls/min',
      },
      {
        plan: 'Business ($49/mo)',
        features: [
          { feature: 'Full payment methods', included: true },
          { feature: 'Multi-currency (100+)', included: true },
          { feature: 'Advanced reporting', included: true },
          { feature: 'Webhooks & APIs', included: true },
          { feature: 'Custom integration', included: true },
        ],
        canConnect: true,
        apiLimit: '1000 calls/min',
      },
      {
        plan: 'Enterprise ($119/mo)',
        features: [
          { feature: 'All payment methods', included: true },
          { feature: 'All currencies (100+)', included: true },
          { feature: 'Advanced APIs', included: true },
          { feature: 'Custom integration', included: true },
          { feature: 'Dedicated support', included: true },
        ],
        canConnect: true,
        apiLimit: 'Unlimited',
      },
    ],
    docs: 'https://developer.paypal.com/docs',
    support: 'https://www.paypal.com/us/webapps/mpp/contact-us',
  },
};

export function IntegrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const integration = INTEGRATION_DETAILS[id || ''];

  if (!integration) {
    return (
      <div className="min-h-screen bg-white dark:bg-ink-950">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <button
            onClick={() => navigate('/marketplace')}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Marketplace
          </button>
          <p className="text-gray-900 dark:text-white text-lg">Integration not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-ink-700 bg-gray-50 dark:bg-ink-900">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <button
            onClick={() => navigate('/marketplace')}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Marketplace
          </button>

          <div className="flex items-start gap-6">
            <div className="text-6xl">{integration.logo}</div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {integration.name}
              </h1>
              <p className="text-xl text-gray-600 dark:text-ink-300 mb-6">{integration.description}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-ink-400 mb-1">Countries</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{integration.countries}</p>
                </div>
                <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-ink-400 mb-1">Currencies</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{integration.currencies}</p>
                </div>
                <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-ink-400 mb-1">Volume</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{integration.volume}</p>
                </div>
                <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-ink-400 mb-1">Pricing</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{integration.pricing}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integration.features.map((feature: string, idx: number) => (
              <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-ink-800 rounded-lg border border-gray-200 dark:border-ink-700">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                <span className="text-gray-700 dark:text-ink-100">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Comparison Matrix */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Plan Access Levels</h2>
          <p className="text-gray-600 dark:text-ink-300 mb-8">
            Click on each plan to see what features are available
          </p>

          <div className="space-y-4">
            {integration.plans.map((plan: PlanAccess, idx: number) => {
              const isExpanded = expandedPlan === `${id}-${idx}`;

              return (
                <div key={idx} className="rounded-lg border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800 overflow-hidden">
                  <button
                    onClick={() => setExpandedPlan(isExpanded ? null : `${id}-${idx}`)}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-ink-700 transition text-left"
                  >
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.plan}</h3>
                      {plan.apiLimit && (
                        <p className="text-sm text-gray-500 dark:text-ink-400 mt-1">API Limit: {plan.apiLimit}</p>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-6 h-6 text-gray-400 transition transform flex-shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-6 py-6 bg-gray-50 dark:bg-ink-700 border-t border-gray-200 dark:border-ink-600">
                      <div className="space-y-3 mb-6">
                        {plan.features.map((item: any, fIdx: number) => (
                          <div key={fIdx} className="flex items-center gap-3">
                            {item.included ? (
                              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 dark:text-ink-600 flex-shrink-0" />
                            )}
                            <span
                              className={`text-base ${
                                item.included
                                  ? 'text-gray-900 dark:text-white'
                                  : 'text-gray-400 dark:text-ink-500 line-through'
                              }`}
                            >
                              {item.feature}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        className={`w-full px-6 py-3 rounded-lg font-semibold transition ${
                          plan.canConnect
                            ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
                            : 'bg-gray-200 dark:bg-ink-600 text-gray-500 dark:text-ink-400 cursor-not-allowed'
                        }`}
                        disabled={!plan.canConnect}
                      >
                        {plan.canConnect ? `Connect ${integration.name}` : 'Upgrade to enable'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Security Section */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Security & Compliance
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="font-bold text-gray-900 dark:text-white mb-2">🔐 Encryption</p>
              <p className="text-gray-700 dark:text-ink-300">AES-256-GCM encryption for all credentials</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white mb-2">✅ Compliance</p>
              <p className="text-gray-700 dark:text-ink-300">PCI DSS, SOC 2 Type II, GDPR compliant</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white mb-2">🔔 Webhooks</p>
              <p className="text-gray-700 dark:text-ink-300">HMAC-SHA256 signed verification</p>
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href={integration.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-lg bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 hover:border-blue-500 dark:hover:border-blue-500 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900 dark:text-white mb-1">📚 Documentation</p>
                <p className="text-sm text-gray-600 dark:text-ink-400">Read official docs</p>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400" />
            </div>
          </a>

          <a
            href={integration.support}
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-lg bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 hover:border-blue-500 dark:hover:border-blue-500 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900 dark:text-white mb-1">🆘 Support</p>
                <p className="text-sm text-gray-600 dark:text-ink-400">Get help from {integration.name}</p>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400" />
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
