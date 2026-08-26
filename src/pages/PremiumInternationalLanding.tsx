import { useState } from 'react';
import { ArrowRight, Globe, Shield, Zap, Layers, Smartphone, BarChart3, Lock, Truck, CreditCard, Send, BookOpen, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';

export function PremiumLandingPage() {
  const navigate = useNavigate();
  const [showMockupSection, setShowMockupSection] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900">
      {/* Navigation */}
      <nav className="border-b border-ink-800/50 bg-ink-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-pos-icon.png" alt="POS Flow" className="w-8 h-8 rounded-lg" />
            <span className="text-xl font-bold text-white">POS <span className="text-flow-400">Flow</span></span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#documentation" className="text-ink-300 hover:text-white transition">Docs</a>
            <a href="#mockup" className="text-ink-300 hover:text-white transition">Platform</a>
            <Button onClick={() => navigate('/login')} variant="ghost" size="sm" className="text-ink-300">
              Sign In
            </Button>
            <Button onClick={() => navigate('/signup')} size="sm">
              Start Free Trial
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-flow-500/30 bg-flow-500/10">
            <Globe size={16} className="text-flow-400" />
            <span className="text-sm text-flow-300">Enterprise ERP/POS for Global Businesses</span>
          </div>

          <h1 className="text-6xl font-bold text-white leading-tight">
            Enterprise-Grade Commerce Platform <br />
            <span className="text-gradient-flow">Built for the Global Market</span>
          </h1>

          <p className="text-xl text-ink-300 max-w-3xl mx-auto">
            The only POS/ERP platform built from day one for international markets. Multi-currency, multi-language, 
            multi-region. From emerging markets to Fortune 500 enterprises.
          </p>

          <div className="flex gap-4 justify-center pt-8">
            <Button 
              onClick={() => navigate('/signup')} 
              size="lg"
              className="gap-2"
            >
              Start 14-Day Free Trial <ArrowRight size={20} />
            </Button>
            <Button 
              onClick={() => document.getElementById('overview')?.scrollIntoView({ behavior: 'smooth' })} 
              variant="outline" 
              size="lg"
            >
              Watch Demo
            </Button>
          </div>

          <p className="text-sm text-ink-400 pt-4">
            No credit card required • Full access to all features • Cancel anytime
          </p>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-4 gap-6 mt-20 pt-20 border-t border-ink-800/50">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">195+</div>
            <div className="text-ink-400">Countries Supported</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">50+</div>
            <div className="text-ink-400">Currencies</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">15+</div>
            <div className="text-ink-400">Payment Methods</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-white">10</div>
            <div className="text-ink-400">Integrations</div>
          </div>
        </div>
      </section>

      {/* Overview Section */}
      <section id="overview" className="max-w-7xl mx-auto px-6 py-24 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-white">Why Global Businesses Choose POS Flow</h2>
          <p className="text-xl text-ink-300">Designed for compliance, scalability, and international growth</p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8 hover:border-flow-500/50 transition">
            <Globe className="w-12 h-12 text-flow-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Truly Global</h3>
            <p className="text-ink-300">
              Built for 195+ countries. Multi-currency, multi-language, multi-tax jurisdiction support. 
              Not retrofitted for localization – built internationally from the ground up.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8 hover:border-flow-500/50 transition">
            <Shield className="w-12 h-12 text-flow-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Enterprise Security</h3>
            <p className="text-ink-300">
              GDPR-compliant. SOC 2 ready. End-to-end encryption. Row-level security isolation. 
              Audit logs for every transaction. Meet the strictest compliance requirements.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8 hover:border-flow-500/50 transition">
            <Zap className="w-12 h-12 text-flow-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Lightning Fast</h3>
            <p className="text-ink-300">
              Serverless edge functions. Real-time sync. Offline-first POS. Zero latency webhooks. 
              Enterprise SLA guaranteed.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8 hover:border-flow-500/50 transition">
            <Layers className="w-12 h-12 text-flow-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Integration Tax</h3>
            <p className="text-ink-300">
              15+ integrations built-in. Stripe, PayPal, Flutterwave, Paystack, M-Pesa, Orange Money. 
              DHL shipping. Libooks accounting. Sellia e-commerce. All production-ready.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8 hover:border-flow-500/50 transition">
            <Smartphone className="w-12 h-12 text-flow-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Mobile First</h3>
            <p className="text-ink-300">
              Works offline. Syncs when connected. Touch-optimized POS. Responsive design. 
              Native mobile apps for iOS/Android (coming soon).
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8 hover:border-flow-500/50 transition">
            <BarChart3 className="w-12 h-12 text-flow-400 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Real-Time Analytics</h3>
            <p className="text-ink-300">
              Dashboards that update live. Export to any BI tool. Multi-dimensional reporting. 
              Role-based insights. Predictive analytics ready.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-white">Simple, Transparent Pricing</h2>
          <p className="text-xl text-ink-300">14 days free. No credit card. Pause or cancel anytime.</p>
        </div>

        <div className="grid grid-cols-4 gap-6">
          {['Starter', 'Professional', 'Enterprise', 'Custom'].map((plan, i) => (
            <div 
              key={i} 
              className={`rounded-2xl p-8 border transition ${
                plan === 'Enterprise' 
                  ? 'border-flow-500/50 bg-gradient-to-br from-flow-500/20 to-ink-900 ring-1 ring-flow-500/50' 
                  : 'border-ink-800/50 bg-ink-900/50 hover:border-ink-700/50'
              }`}
            >
              <h3 className="text-xl font-bold text-white mb-2">{plan}</h3>
              <p className="text-sm text-ink-400 mb-6">For growing businesses</p>
              <div className="text-3xl font-bold text-white mb-6">
                {plan === 'Custom' ? 'Contact us' : `$${[99, 299, 999][i]}`}
                {plan !== 'Custom' && <span className="text-sm text-ink-400">/mo</span>}
              </div>
              <Button className="w-full" variant={plan === 'Enterprise' ? 'default' : 'outline'}>
                Choose Plan
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Mockup Section */}
      <section id="mockup" className="max-w-7xl mx-auto px-6 py-24 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-white">See It In Action</h2>
          <p className="text-xl text-ink-300">Explore the platform interface and workflows</p>
        </div>

        <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-12 text-center space-y-6 min-h-96 flex flex-col items-center justify-center">
          <Download size={64} className="text-flow-400/50 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">Platform Screenshots & Walkthrough</h3>
            <p className="text-ink-300 max-w-2xl">
              Upload high-fidelity mockups, demo videos, and interactive guides to show how users navigate 
              the platform, manage inventory, process payments, and generate reports.
            </p>
          </div>
          <p className="text-sm text-ink-400">
            📸 Mockups • 🎥 Demo Videos • 📖 User Guides • 🎯 Feature Highlights
          </p>
          <Button size="lg" className="gap-2">
            <Download size={20} /> View Platform Demo
          </Button>
        </div>
      </section>

      {/* Global Coverage */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-white">Truly Global Coverage</h2>
          <p className="text-xl text-ink-300">Payment methods, currencies, and compliance for every market</p>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Payments */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8">
            <CreditCard className="w-8 h-8 text-flow-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-4">Payment Methods (15+)</h3>
            <ul className="space-y-2 text-ink-300 text-sm">
              <li>✓ Stripe (195+ countries)</li>
              <li>✓ PayPal (200+ countries)</li>
              <li>✓ Flutterwave (50+ African markets)</li>
              <li>✓ Paystack (West Africa)</li>
              <li>✓ M-Pesa (East Africa)</li>
              <li>✓ Orange Money (West Africa)</li>
              <li>✓ Local payment methods in 50+ countries</li>
            </ul>
          </div>

          {/* Fulfillment */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8">
            <Truck className="w-8 h-8 text-flow-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-4">Shipping & Logistics</h3>
            <ul className="space-y-2 text-ink-300 text-sm">
              <li>✓ DHL (220+ countries)</li>
              <li>✓ UPS (ready to integrate)</li>
              <li>✓ FedEx (ready to integrate)</li>
              <li>✓ Local couriers (configurable)</li>
              <li>✓ Real-time tracking</li>
              <li>✓ Multi-carrier selection</li>
              <li>✓ Customs documentation</li>
            </ul>
          </div>

          {/* Compliance */}
          <div className="bg-ink-900/50 border border-ink-800/50 rounded-2xl p-8">
            <Lock className="w-8 h-8 text-flow-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-4">Compliance & Standards</h3>
            <ul className="space-y-2 text-ink-300 text-sm">
              <li>✓ GDPR (EU)</li>
              <li>✓ CCPA (California)</li>
              <li>✓ PIPEDA (Canada)</li>
              <li>✓ SOC 2 Type II</li>
              <li>✓ PCI DSS Level 1</li>
              <li>✓ Multi-currency VAT/GST</li>
              <li>✓ Regional tax compliance</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section id="documentation" className="max-w-7xl mx-auto px-6 py-24 space-y-12 bg-ink-900/30 -mx-6 px-6 rounded-2xl">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-flow-500/30 bg-flow-500/10">
            <BookOpen size={16} className="text-flow-400" />
            <span className="text-sm text-flow-300">Complete Resources</span>
          </div>
          <h2 className="text-4xl font-bold text-white">Documentation & Support</h2>
          <p className="text-xl text-ink-300">Everything you need to get started and scale globally</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <a href="https://docs.posflow.io/getting-started" target="_blank" rel="noopener noreferrer" className="bg-ink-900/50 border border-ink-800/50 rounded-xl p-6 hover:border-flow-500/50 transition group">
            <BookOpen className="w-8 h-8 text-flow-400 mb-3 group-hover:scale-110 transition" />
            <h3 className="font-bold text-white mb-2">Getting Started</h3>
            <p className="text-sm text-ink-400">Setup guide, onboarding, first transactions</p>
            <div className="text-flow-400 text-sm mt-4 flex items-center gap-1">
              Read Docs <ArrowRight size={14} />
            </div>
          </a>

          <a href="https://docs.posflow.io/api" target="_blank" rel="noopener noreferrer" className="bg-ink-900/50 border border-ink-800/50 rounded-xl p-6 hover:border-flow-500/50 transition group">
            <Layers className="w-8 h-8 text-flow-400 mb-3 group-hover:scale-110 transition" />
            <h3 className="font-bold text-white mb-2">API Reference</h3>
            <p className="text-sm text-ink-400">REST API, webhooks, integrations guide</p>
            <div className="text-flow-400 text-sm mt-4 flex items-center gap-1">
              Explore API <ArrowRight size={14} />
            </div>
          </a>

          <a href="https://docs.posflow.io/compliance" target="_blank" rel="noopener noreferrer" className="bg-ink-900/50 border border-ink-800/50 rounded-xl p-6 hover:border-flow-500/50 transition group">
            <Shield className="w-8 h-8 text-flow-400 mb-3 group-hover:scale-110 transition" />
            <h3 className="font-bold text-white mb-2">Compliance</h3>
            <p className="text-sm text-ink-400">Security, GDPR, regulations, certifications</p>
            <div className="text-flow-400 text-sm mt-4 flex items-center gap-1">
              Learn More <ArrowRight size={14} />
            </div>
          </a>
        </div>

        <div className="bg-gradient-to-r from-flow-500/10 to-brand-500/10 border border-flow-500/30 rounded-xl p-8 text-center">
          <h3 className="text-xl font-bold text-white mb-2">24/7 Support</h3>
          <p className="text-ink-300 mb-4">Email, live chat, community forum. Response within 1 hour for enterprise plans.</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline">Contact Sales</Button>
            <Button variant="outline">Community Forum</Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <div className="space-y-6 bg-gradient-to-br from-flow-500/20 to-brand-500/20 border border-flow-500/30 rounded-2xl p-12">
          <h2 className="text-4xl font-bold text-white">Ready to Go Global?</h2>
          <p className="text-xl text-ink-300 max-w-2xl mx-auto">
            Join businesses in 50+ countries using POS Flow to manage commerce at global scale.
          </p>
          <div className="flex gap-4 justify-center pt-8">
            <Button 
              onClick={() => navigate('/signup')} 
              size="lg"
              className="gap-2"
            >
              Start 14-Day Free Trial <ArrowRight size={20} />
            </Button>
            <Button 
              onClick={() => navigate('/login')} 
              variant="outline" 
              size="lg"
            >
              Sign In
            </Button>
          </div>
          <p className="text-sm text-ink-400">No credit card required • Full feature access • Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-800/50 bg-ink-950/50 backdrop-blur-xl mt-24">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo-pos-icon.png" alt="POS Flow" className="w-6 h-6 rounded" />
                <span className="font-bold text-white">POS Flow</span>
              </div>
              <p className="text-sm text-ink-400">Enterprise commerce platform for global businesses.</p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-ink-400">
                <li><a href="https://docs.posflow.io" className="hover:text-white transition">Documentation</a></li>
                <li><a href="#mockup" className="hover:text-white transition">Platform Demo</a></li>
                <li><a href="/pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">Status Page</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-ink-400">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition">GDPR Compliance</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Connect</h3>
              <ul className="space-y-2 text-sm text-ink-400">
                <li><a href="mailto:support@posflow.io" className="hover:text-white transition">support@posflow.io</a></li>
                <li><a href="#" className="hover:text-white transition">Twitter</a></li>
                <li><a href="#" className="hover:text-white transition">LinkedIn</a></li>
                <li><a href="#" className="hover:text-white transition">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-ink-800/50 pt-8 text-center text-sm text-ink-400">
            <p>© 2026 POS Flow. All rights reserved. | Enterprise ERP/POS for Global Businesses</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
