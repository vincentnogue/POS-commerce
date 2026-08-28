import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, X, Globe, ChevronDown, Play, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const { lang, setLang, t } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      navigate(`/signup?email=${encodeURIComponent(email)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 dark:border-ink-800 bg-white/95 dark:bg-ink-950/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-brand-600">POS Flow</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <div className="relative group">
                <button className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 flex items-center gap-1">
                  Retail <ChevronDown size={16} />
                </button>
                <div className="absolute left-0 mt-0 w-48 bg-white dark:bg-ink-900 border border-gray-200 dark:border-ink-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Point of Sale</a>
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Inventory</a>
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Analytics</a>
                </div>
              </div>

              <div className="relative group">
                <button className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 flex items-center gap-1">
                  Products <ChevronDown size={16} />
                </button>
                <div className="absolute left-0 mt-0 w-48 bg-white dark:bg-ink-900 border border-gray-200 dark:border-ink-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Core Platform</a>
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Integrations</a>
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">API</a>
                </div>
              </div>

              <Link to="/pricing" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">Pricing</Link>

              <div className="relative group">
                <button className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 flex items-center gap-1">
                  Resources <ChevronDown size={16} />
                </button>
                <div className="absolute left-0 mt-0 w-48 bg-white dark:bg-ink-900 border border-gray-200 dark:border-ink-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                  <Link to="/help" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Help Center</Link>
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Blog</a>
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Integrations</a>
                  <a href="#" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Academy</a>
                </div>
              </div>
            </nav>

            {/* Right Actions */}
            <div className="hidden md:flex items-center gap-4">
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-brand-600">
                <Globe size={18} />
              </button>
              <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">Login</Link>
              <Link to="/signup" className="px-6 py-2 bg-brand-600 text-white rounded-full font-medium hover:bg-brand-700 transition">
                Get a Demo
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-700 dark:text-gray-300"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-ink-700 space-y-3"
            >
              <Link to="/pricing" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Pricing</Link>
              <Link to="/help" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Help</Link>
              <Link to="/login" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Login</Link>
              <Link to="/signup" className="block w-full px-6 py-2 bg-brand-600 text-white rounded-full font-medium text-center">Get a Demo</Link>
            </motion.div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-black min-h-screen flex items-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1600&h=900&fit=crop"
            alt="Restaurant worker using POS"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 py-20 lg:px-8 w-full">
          <div className="max-w-2xl">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 inline-flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-full px-4 py-2 backdrop-blur"
            >
              <Play size={16} className="text-brand-600 fill-brand-600" />
              <span className="text-sm font-medium text-gray-300">How POS Flow is Built For Busy</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
            >
              Built For{' '}
              <span className="relative inline-block">
                <span className="text-white">Busy</span>
                <svg
                  className="absolute left-0 right-0 bottom-2 w-full h-3"
                  viewBox="0 0 300 50"
                  preserveAspectRatio="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M 0 30 Q 75 5 150 30 T 300 30"
                    stroke="#ea6317"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-gray-300 mb-8 max-w-lg leading-relaxed"
            >
              The POS built for peak volume, slim margins, and complexity at scale — trusted by 3200+ businesses in 54 countries.
            </motion.p>

            {/* CTA Form */}
            <motion.form
              onSubmit={handleGetStarted}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-8 flex gap-2"
            >
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-6 py-3 rounded-full bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
                required
              />
              <button
                type="submit"
                className="px-8 py-3 bg-brand-600 text-white rounded-full font-semibold hover:bg-brand-700 transition whitespace-nowrap"
              >
                Get Started
              </button>
            </motion.form>

            {/* Sub-CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition font-medium"
              >
                Browse integrations <ArrowRight size={18} />
              </Link>
            </motion.div>

            {/* Privacy */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-xs text-gray-500 mt-4"
            >
              We'll never share your email. See our{' '}
              <a href="#" className="underline hover:text-gray-400">
                Privacy Policy
              </a>
            </motion.p>
          </div>
        </div>
      </section>

      {/* Features Band */}
      <section className="bg-gray-50 dark:bg-ink-900 py-12 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">54</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Countries Supported</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">3200+</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Businesses Trust Us</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">7</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Payment Processors</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-brand-50 to-orange-50 dark:from-brand-900/20 dark:to-orange-900/20 rounded-3xl p-12 text-center">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Ready to grow your business?</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">Start your 14-day free trial today. No credit card required.</p>
          <Link
            to="/signup"
            className="inline-block px-8 py-4 bg-brand-600 text-white rounded-full font-semibold hover:bg-brand-700 transition"
          >
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-ink-800 bg-white dark:bg-ink-950">
        <div className="max-w-7xl mx-auto px-4 py-12 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Product</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#" className="hover:text-brand-600">Features</a></li>
                <li><a href="#" className="hover:text-brand-600">Pricing</a></li>
                <li><a href="#" className="hover:text-brand-600">Integrations</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Company</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#" className="hover:text-brand-600">About</a></li>
                <li><a href="#" className="hover:text-brand-600">Blog</a></li>
                <li><a href="#" className="hover:text-brand-600">Careers</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Resources</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link to="/help" className="hover:text-brand-600">Help Center</Link></li>
                <li><a href="#" className="hover:text-brand-600">Documentation</a></li>
                <li><a href="#" className="hover:text-brand-600">Status</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Legal</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#" className="hover:text-brand-600">Privacy</a></li>
                <li><a href="#" className="hover:text-brand-600">Terms</a></li>
                <li><a href="#" className="hover:text-brand-600">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-ink-800 pt-8 flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">© 2026 POS Flow. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600">
                {lang.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
