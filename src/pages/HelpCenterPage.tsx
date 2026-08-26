import { useState } from 'react';
import { HelpCircle, ChevronDown, Mail, MessageSquare, Phone, BookOpen, AlertCircle, CheckCircle } from 'lucide-react';

export function HelpCenterPage() {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      id: 'trial',
      category: 'Trial & Billing',
      question: 'How long is the free trial?',
      answer: 'All new accounts get 14 days of free access to all platform features. No credit card required. You can cancel anytime or upgrade to a paid plan when ready.',
    },
    {
      id: 'payment-methods',
      category: 'Payments',
      question: 'What payment methods do you support?',
      answer: 'We support 7 payment processors: Stripe, PayPal, Flutterwave, Paystack, M-Pesa, Orange Money, and PayUnit.net. This covers 200+ countries and 50+ currencies. Each processor supports multiple payment methods (cards, wallets, local methods).',
    },
    {
      id: 'integration-limit',
      category: 'Integrations',
      question: 'How many integrations can I connect?',
      answer: 'Limits depend on your plan: Starter (5), Professional (10), Enterprise (unlimited), Custom (unlimited). You can always upgrade your plan to connect more integrations.',
    },
    {
      id: 'api-access',
      category: 'API & Developers',
      question: 'Do I have API access?',
      answer: 'API access is available on Professional, Enterprise, and Custom plans. Starter plan does not include API access. All APIs use standard REST with JWT authentication. Full documentation available in our API Documentation.',
    },
    {
      id: 'data-security',
      category: 'Security',
      question: 'How is my data secured?',
      answer: 'We use enterprise-grade security: end-to-end encryption (TLS 1.3), encryption at rest (AES-256), multi-tenant isolation with row-level security, PCI DSS Level 1 compliance, and GDPR/CCPA compliance. All data is encrypted and isolated by tenant.',
    },
    {
      id: 'export-data',
      category: 'Data Management',
      question: 'Can I export my data?',
      answer: 'Yes! You can export all your data in multiple formats: CSV, Excel, PDF, or JSON. Use Settings → Data Export. For GDPR requests, we provide complete data exports within 30 days.',
    },
    {
      id: 'multi-store',
      category: 'Operations',
      question: 'Can I manage multiple stores?',
      answer: 'Yes. The number of stores depends on your plan: Starter (1), Professional (5), Enterprise (unlimited). Each store has its own inventory, staff, and settings, but shares the same account and billing.',
    },
    {
      id: 'offline-mode',
      category: 'Technology',
      question: 'Does the POS work offline?',
      answer: 'Yes! The POS module is fully offline-first. It works without internet and syncs automatically when connected. No data is lost. Perfect for areas with unreliable connectivity.',
    },
    {
      id: 'team-access',
      category: 'Users',
      question: 'How do I add team members?',
      answer: 'Go to Users → Add User. Assign roles: super_admin (full access), admin (full access), manager (operational access), staff (basic POS access), or viewer (read-only). Each role has specific permissions.',
    },
    {
      id: 'cancel',
      category: 'Billing',
      question: 'How do I cancel my subscription?',
      answer: 'Go to Settings → Billing → Subscriptions. Click "Cancel Subscription". Your data remains accessible until the end of your billing period. You can reactivate anytime without losing data.',
    },
    {
      id: 'accounting-sync',
      category: 'Integrations',
      question: 'How does accounting sync work?',
      answer: 'Professional and Enterprise plans can sync with Libooks automatically. Transactions sync daily at midnight UTC. You can also manually sync anytime. Sync includes: sales, expenses, invoices, and inventory movements.',
    },
    {
      id: 'webhook-test',
      category: 'API & Developers',
      question: 'Can I test webhooks before going live?',
      answer: 'Yes! Professional and higher plans include webhook testing. Use the API Documentation section to set up and test webhook endpoints. We provide webhook event simulator and delivery logs.',
    },
    {
      id: 'uptime',
      category: 'Infrastructure',
      question: 'What is your uptime guarantee?',
      answer: 'We offer 99.9% uptime SLA for Enterprise plans. Professional plans get 99.5%. We monitor 24/7 and maintain automatic failover. Check our status page at status.posflow.io anytime.',
    },
    {
      id: 'support-hours',
      category: 'Support',
      question: 'What are your support hours?',
      answer: 'Email support: 24/7. Live chat: Mon-Fri 9am-6pm UTC. Phone: Enterprise only, 24/7. Response time: Email (24h), Chat (2h), Phone (30min). All support requests are tracked with ticket numbers.',
    },
  ];

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(faqs.map((f) => f.category))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-ink-800/50 bg-ink-950/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="w-8 h-8 text-flow-400" />
            <h1 className="text-3xl font-bold text-white">Help Center</h1>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-ink-900/50 border border-ink-800 text-white placeholder-ink-500 focus:outline-none focus:border-flow-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* FAQ by Category */}
            <div className="space-y-8">
              {categories.map((category) => {
                const categoryFaqs = filteredFaqs.filter((f) => f.category === category);
                if (categoryFaqs.length === 0) return null;

                return (
                  <div key={category}>
                    <h2 className="text-2xl font-bold text-white mb-4">{category}</h2>
                    <div className="space-y-3">
                      {categoryFaqs.map((faq) => (
                        <div
                          key={faq.id}
                          className="rounded-lg bg-ink-900/50 border border-ink-800 overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-ink-900/70 transition text-left"
                          >
                            <h3 className="font-semibold text-white flex-1">{faq.question}</h3>
                            <ChevronDown
                              className={`w-5 h-5 text-flow-400 transition-transform ${expandedFaq === faq.id ? 'rotate-180' : ''}`}
                            />
                          </button>

                          {expandedFaq === faq.id && (
                            <div className="px-6 py-4 border-t border-ink-800 bg-ink-900/30">
                              <p className="text-ink-300 leading-relaxed">{faq.answer}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredFaqs.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-ink-600 mx-auto mb-4" />
                <p className="text-ink-400">No help articles found. Try a different search.</p>
              </div>
            )}
          </div>

          {/* Sidebar - Support Options */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Quick Links */}
              <div className="rounded-lg bg-gradient-to-br from-flow-500/20 to-brand-500/20 border border-flow-500/30 p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Documentation
                </h3>
                <div className="space-y-2">
                  <a href="/documentation" className="block text-flow-400 hover:text-flow-300 transition text-sm">
                    API Reference
                  </a>
                  <a href="/documentation" className="block text-flow-400 hover:text-flow-300 transition text-sm">
                    Integration Guides
                  </a>
                  <a href="https://docs.posflow.io" target="_blank" rel="noopener noreferrer" className="block text-flow-400 hover:text-flow-300 transition text-sm">
                    Full Docs
                  </a>
                </div>
              </div>

              {/* Contact Support */}
              <div className="rounded-lg bg-gradient-to-br from-brand-500/20 to-flow-500/20 border border-brand-500/30 p-6">
                <h3 className="font-bold text-white mb-4">Contact Support</h3>
                <div className="space-y-4">
                  <a href="mailto:support@posflow.io" className="flex items-center gap-3 text-ink-300 hover:text-white transition">
                    <Mail className="w-5 h-5 text-brand-400" />
                    <div className="text-sm">
                      <div className="font-semibold">Email</div>
                      <div className="text-xs text-ink-400">support@posflow.io</div>
                    </div>
                  </a>

                  <a href="#" className="flex items-center gap-3 text-ink-300 hover:text-white transition">
                    <MessageSquare className="w-5 h-5 text-brand-400" />
                    <div className="text-sm">
                      <div className="font-semibold">Live Chat</div>
                      <div className="text-xs text-ink-400">Mon-Fri 9am-6pm UTC</div>
                    </div>
                  </a>

                  <a href="tel:+18447675356" className="flex items-center gap-3 text-ink-300 hover:text-white transition">
                    <Phone className="w-5 h-5 text-brand-400" />
                    <div className="text-sm">
                      <div className="font-semibold">Phone</div>
                      <div className="text-xs text-ink-400">+1-844-POS-FLOW</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* Status */}
              <div className="rounded-lg bg-ink-900/50 border border-ink-800 p-6">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  System Status
                </h3>
                <a href="https://status.posflow.io" target="_blank" rel="noopener noreferrer" className="text-flow-400 hover:text-flow-300 text-sm transition">
                  View status page →
                </a>
              </div>

              {/* Response Times */}
              <div className="rounded-lg bg-ink-900/50 border border-ink-800 p-6">
                <h3 className="font-bold text-white mb-3">Response Times</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-400">Email:</span>
                    <span className="text-white">24 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-400">Chat:</span>
                    <span className="text-white">2 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-400">Phone:</span>
                    <span className="text-white">30 minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
