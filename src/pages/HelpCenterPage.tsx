import { useState } from 'react';
import { Search, ChevronDown, BookOpen, Zap, Shield, Users, CreditCard, Globe } from 'lucide-react';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  icon?: typeof BookOpen;
}

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
    answer: 'Our trial period is 7 days. You don\'t need to enter credit card details to start your trial. After 7 days, you can upgrade to a paid plan or your account will remain in limited mode.',
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

interface Contact {
  type: string;
  label: string;
  value: string;
  icon: typeof Globe;
}

const CONTACTS: Contact[] = [
  {
    type: 'email',
    label: 'Email Support',
    value: 'support@pos.liafrik.com',
    icon: Globe,
  },
  {
    type: 'phone',
    label: 'Phone Support',
    value: '+971 4 XXX XXXX (Dubai)',
    icon: Globe,
  },
  {
    type: 'documentation',
    label: 'Documentation',
    value: 'Visit our API docs',
    icon: BookOpen,
  },
];

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
    <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900">
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
            <input
              type="text"
              placeholder="Search help articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-lg bg-ink-900/50 border border-ink-700 text-white placeholder-ink-400 focus:border-flow-500 focus:outline-none transition"
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
                : 'bg-ink-800/50 text-ink-300 hover:bg-ink-700/50'
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
                  : 'bg-ink-800/50 text-ink-300 hover:bg-ink-700/50'
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
                  className="rounded-lg border border-ink-700 bg-ink-900/50 overflow-hidden transition"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-ink-800/50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-flow-400 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-white">{item.question}</p>
                        <p className="text-xs text-ink-400 mt-1">{item.category}</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-ink-400 transition transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-6 py-4 bg-ink-800/30 border-t border-ink-700/50">
                      <p className="text-ink-200 leading-relaxed">{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <SearchIcon className="w-12 h-12 text-ink-600 mx-auto mb-4" />
              <p className="text-ink-300">No results found. Try a different search term.</p>
            </div>
          )}
        </div>

        {/* Contact Section */}
        <div className="rounded-lg bg-gradient-to-r from-brand-500/10 to-flow-500/10 border border-brand-500/30 p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Didn't find what you're looking for?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <a
              href="mailto:support@pos.liafrik.com"
              className="p-4 rounded-lg bg-ink-900/50 border border-ink-700 hover:border-flow-500/50 transition"
            >
              <p className="font-semibold text-white mb-2">Email Support</p>
              <p className="text-sm text-ink-300">support@pos.liafrik.com</p>
              <p className="text-xs text-ink-400 mt-2">Response time: 24 hours</p>
            </a>

            <a
              href="tel:+97143221234"
              className="p-4 rounded-lg bg-ink-900/50 border border-ink-700 hover:border-flow-500/50 transition"
            >
              <p className="font-semibold text-white mb-2">Phone Support</p>
              <p className="text-sm text-ink-300">+971 4 XXX XXXX</p>
              <p className="text-xs text-ink-400 mt-2">Available: 9AM-6PM GST</p>
            </a>

            <a
              href="/api-documentation"
              className="p-4 rounded-lg bg-ink-900/50 border border-ink-700 hover:border-flow-500/50 transition"
            >
              <p className="font-semibold text-white mb-2">API Documentation</p>
              <p className="text-sm text-ink-300">View technical docs</p>
              <p className="text-xs text-ink-400 mt-2">Complete API reference</p>
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-12 rounded-lg bg-ink-900/50 border border-ink-700 p-8">
          <h2 className="text-xl font-bold text-white mb-6">Quick Links</h2>
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
                className="text-flow-300 hover:text-flow-200 transition text-sm font-medium"
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
