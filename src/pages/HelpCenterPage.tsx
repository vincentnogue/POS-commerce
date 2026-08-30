import { useState } from 'react';
import { Search, ChevronDown, BookOpen, Zap, Shield, Users, CreditCard, Globe, Check, X } from 'lucide-react';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  icon?: typeof BookOpen;
}

interface PlanFeature {
  feature: string;
  starter: boolean;
  pro: boolean;
  business: boolean;
  enterprise: boolean;
}

const PLAN_FEATURES: PlanFeature[] = [
  { feature: 'Basic POS System', starter: true, pro: true, business: true, enterprise: true },
  { feature: 'Unlimited Products', starter: false, pro: false, business: true, enterprise: true },
  { feature: 'API Access', starter: false, pro: true, business: true, enterprise: true },
  { feature: 'Advanced Reports', starter: false, pro: true, business: true, enterprise: true },
  { feature: 'Custom Integrations', starter: false, pro: false, business: true, enterprise: true },
  { feature: 'Dedicated Support', starter: false, pro: false, business: false, enterprise: true },
  { feature: 'Priority Support', starter: false, pro: true, business: true, enterprise: true },
  { feature: 'SSO/SAML', starter: false, pro: false, business: false, enterprise: true },
  { feature: 'Audit Logs', starter: false, pro: true, business: true, enterprise: true },
  { feature: 'Multi-store Support', starter: false, pro: true, business: true, enterprise: true },
  { feature: 'Email Support', starter: true, pro: true, business: true, enterprise: true },
  { feature: 'Chat Support (24/7)', starter: false, pro: true, business: true, enterprise: true },
];

const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'getting-started',
    category: 'Getting Started',
    question: 'How do I set up my workspace?',
    answer: 'Simply sign up with your email, confirm your account, and follow our onboarding wizard. You\'ll be able to create your workspace, invite team members, and connect your first integration in minutes.',
    icon: Zap,
  },
  {
    id: 'integrations',
    category: 'Integrations',
    question: 'How many integrations can I connect?',
    answer: 'It depends on your plan. Starter includes 5 integrations, Professional includes 10, Enterprise includes unlimited. You can upgrade your plan anytime to add more integrations.',
    icon: Globe,
  },
  {
    id: 'payment-methods',
    category: 'Payments & Billing',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and local payment methods in 50+ countries through our payment processor integrations.',
    icon: CreditCard,
  },
  {
    id: 'trial',
    category: 'Trial & Subscription',
    question: 'How long is the trial period?',
    answer: 'Our trial period is 14 days. You don\'t need to enter credit card details to start your trial. After 14 days, you can upgrade to a paid plan or your account will remain in limited mode.',
    icon: Zap,
  },
  {
    id: 'security',
    category: 'Security & Compliance',
    question: 'How secure is my data?',
    answer: 'We use enterprise-grade security with AES-256 encryption, SOC 2 Type II compliance, and row-level database encryption. All credentials are encrypted at rest and never exposed to our frontend.',
    icon: Shield,
  },
  {
    id: 'team',
    category: 'Team Management',
    question: 'How many team members can I add?',
    answer: 'Starter allows 3 members, Professional allows 10 members, and Enterprise allows unlimited members. Each team member can be assigned specific roles and permissions.',
    icon: Users,
  },
  {
    id: 'api',
    category: 'API & Developers',
    question: 'Is there an API I can use?',
    answer: 'Yes! Professional and Enterprise plans include full REST API access with comprehensive documentation. You can integrate POS Flow into your own applications.',
    icon: Zap,
  },
  {
    id: 'billing',
    category: 'Billing',
    question: 'Can I change or cancel my plan?',
    answer: 'Yes, you can upgrade or downgrade your plan anytime. Changes take effect on your next billing cycle. You can also cancel your subscription without penalties, though you won\'t receive refunds for partial months.',
    icon: CreditCard,
  },
];

// BUG FIX: this page used to hardcode a dark gradient background with no
// `dark:` variants at all (`bg-gradient-to-br from-ink-950 via-brand-950
// to-ink-900`), so it ignored the app's light/dark toggle (see
// src/lib/theme.tsx, which drives a real `.dark` class on <html>) and
// always rendered dark, even in light mode. Every surface below now follows
// the same light-by-default / dark-as-override pattern used elsewhere in
// the app (see Sidebar.tsx: `bg-brand-50 dark:bg-ink-900`).
export function HelpCenterPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter FAQs based on search and category
  const filteredFAQs = FAQ_ITEMS.filter((item) => {
    const matchesSearch =
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !selectedCategory || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(new Set(FAQ_ITEMS.map((item) => item.category)));

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-ink-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Help Center</h1>
          <p className="text-xl text-white/90">
            Find answers to common questions and get support
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Search Box */}
        <div className="mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400 dark:text-ink-500" />
            <input
              type="text"
              placeholder="Search help articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-900 dark:text-ink-50 placeholder-ink-400 dark:placeholder-ink-500 focus:border-flow-500 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              !selectedCategory
                ? 'bg-flow-500 text-white'
                : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-700/50'
            }`}
          >
            All Categories
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedCategory === category
                  ? 'bg-flow-500 text-white'
                  : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-700/50'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ Items */}
        <div className="space-y-3 mb-16">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((item) => {
              const Icon = item.icon || BookOpen;
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 overflow-hidden transition shadow-soft"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-brand-50 dark:hover:bg-ink-700/50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-flow-500 dark:text-flow-400 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-ink-900 dark:text-ink-50">{item.question}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">{item.category}</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-ink-400 dark:text-ink-500 transition transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-6 py-4 bg-brand-50/60 dark:bg-ink-900/40 border-t border-ink-200 dark:border-ink-700/50">
                      <p className="text-ink-700 dark:text-ink-200 leading-relaxed">{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <SearchIcon className="w-12 h-12 text-ink-300 dark:text-ink-600 mx-auto mb-4" />
              <p className="text-ink-500 dark:text-ink-300">No results found. Try a different search term.</p>
            </div>
          )}
        </div>

        {/* Plan Features Matrix */}
        <div className="my-16 py-12 border-y border-ink-200 dark:border-ink-700">
          <h2 className="text-3xl font-bold text-ink-900 dark:text-white mb-4 text-center">Plan Access Levels</h2>
          <p className="text-center text-ink-600 dark:text-ink-300 mb-8 max-w-2xl mx-auto">
            Choose the plan that fits your needs. See exactly what features you'll have access to at each level.
            <br/>
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Green checkmark = You have access</span>
            <br/>
            <span className="text-sm text-ink-400 dark:text-ink-500 font-medium">✗ Gray X = Not available in this plan</span>
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 dark:border-ink-700">
                  <th className="text-left py-4 px-4 font-semibold text-ink-900 dark:text-white">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold">
                    <div className="text-ink-600 dark:text-ink-300">Starter</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">$9/mo</div>
                  </th>
                  <th className="text-center py-4 px-4 font-semibold">
                    <div className="text-ink-600 dark:text-ink-300">Professional</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">$19/mo</div>
                  </th>
                  <th className="text-center py-4 px-4 font-semibold">
                    <div className="text-ink-600 dark:text-ink-300">Business</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">$49/mo</div>
                  </th>
                  <th className="text-center py-4 px-4 font-semibold">
                    <div className="text-ink-600 dark:text-ink-300">Enterprise</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">$119/mo</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-ink-950' : 'bg-ink-50/50 dark:bg-ink-900/30'}>
                    <td className="py-3 px-4 text-ink-900 dark:text-ink-100 font-medium">{item.feature}</td>
                    <td className="text-center py-3 px-4">
                      {item.starter ? (
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-ink-300 dark:text-ink-600 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {item.pro ? (
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-ink-300 dark:text-ink-600 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {item.business ? (
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-ink-300 dark:text-ink-600 mx-auto" />
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {item.enterprise ? (
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-ink-300 dark:text-ink-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Plan Selection CTA */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 rounded-lg bg-brand-50 dark:bg-ink-800 border border-brand-200 dark:border-ink-700">
              <h3 className="font-bold text-brand-900 dark:text-white mb-2">Starter ($9/mo)</h3>
              <p className="text-sm text-brand-700 dark:text-brand-200 mb-4">Perfect for getting started</p>
              <a href="/signup" className="inline-block px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition">
                Try for Free
              </a>
            </div>

            <div className="p-6 rounded-lg bg-flow-50 dark:bg-ink-800 border border-flow-200 dark:border-ink-700">
              <h3 className="font-bold text-flow-900 dark:text-white mb-2">Professional ($19/mo)</h3>
              <p className="text-sm text-flow-700 dark:text-flow-200 mb-4">Recommended for growing businesses</p>
              <a href="/signup" className="inline-block px-4 py-2 rounded-lg bg-flow-600 text-white text-sm font-medium hover:bg-flow-700 transition">
                Try for Free
              </a>
            </div>

            <div className="p-6 rounded-lg bg-action-50 dark:bg-ink-800 border border-action-200 dark:border-ink-700">
              <h3 className="font-bold text-action-900 dark:text-white mb-2">Business ($49/mo)</h3>
              <p className="text-sm text-action-700 dark:text-action-200 mb-4">For advanced users</p>
              <a href="/signup" className="inline-block px-4 py-2 rounded-lg bg-action-600 text-white text-sm font-medium hover:bg-action-700 transition">
                Try for Free
              </a>
            </div>

            <div className="p-6 rounded-lg bg-gray-50 dark:bg-ink-800 border border-gray-200 dark:border-ink-700">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Enterprise ($119/mo)</h3>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">Custom solutions for teams</p>
              <a href="/contact" className="inline-block px-4 py-2 rounded-lg bg-gray-600 text-white text-sm font-medium hover:bg-gray-700 transition">
                Contact Sales
              </a>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="rounded-lg bg-gradient-to-r from-brand-500/10 to-flow-500/10 border border-brand-500/30 p-8">
          <h2 className="text-2xl font-bold text-ink-900 dark:text-white mb-6">Didn't find what you're looking for?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a
              href="mailto:support@liafrik.com"
              className="p-4 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 hover:border-flow-500/50 transition"
            >
              <p className="font-semibold text-ink-900 dark:text-white mb-2">Email Support</p>
              <p className="text-sm text-ink-600 dark:text-ink-300">support@liafrik.com</p>
              <p className="text-xs text-ink-400 dark:text-ink-400 mt-2">Response time: 24 hours</p>
            </a>

            <a
              href="tel:+97143221234"
              className="p-4 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 hover:border-flow-500/50 transition"
            >
              <p className="font-semibold text-ink-900 dark:text-white mb-2">Phone Support</p>
              <p className="text-sm text-ink-600 dark:text-ink-300">+971 4 XXX XXXX</p>
              <p className="text-xs text-ink-400 dark:text-ink-400 mt-2">Available: 9AM-6PM GST</p>
            </a>

            <a
              href="/api-documentation"
              className="p-4 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 hover:border-flow-500/50 transition"
            >
              <p className="font-semibold text-ink-900 dark:text-white mb-2">API Documentation</p>
              <p className="text-sm text-ink-600 dark:text-ink-300">View technical docs</p>
              <p className="text-xs text-ink-400 dark:text-ink-400 mt-2">Complete API reference</p>
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-12 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 p-8 shadow-soft">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-6">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Getting Started Guide', href: '#' },
              { label: 'API Documentation', href: '#' },
              { label: 'Security Policy', href: '#' },
              { label: 'Terms of Service', href: '#' },
              { label: 'Privacy Policy', href: '#' },
              { label: 'Contact Sales', href: '#' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-flow-600 dark:text-flow-300 hover:text-flow-500 dark:hover:text-flow-200 transition text-sm font-medium"
              >
                → {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
