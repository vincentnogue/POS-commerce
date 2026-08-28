import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, TrendingUp } from 'lucide-react';
import { useReducedMotion } from '../lib/hooks/useReducedMotion';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface StatCard {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  delay: number;
}

const SAMPLE_PRODUCTS = [
  { id: '1', name: 'Signature Burger', price: 12.99 },
  { id: '2', name: 'Grilled Chicken', price: 14.99 },
  { id: '3', name: 'Caesar Salad', price: 9.99 },
  { id: '4', name: 'Iced Tea', price: 2.99 },
];

const STATS: StatCard[] = [
  { id: 'trans', label: 'Transactions Today', value: '2,847', icon: <Zap size={20} />, delay: 0.2 },
  { id: 'rev', label: 'Revenue', value: '$34.2k', icon: <TrendingUp size={20} />, delay: 0.4 },
  { id: 'orders', label: 'Orders', value: '892', icon: <Check size={20} />, delay: 0.6 },
];

export function HeroLiafrikPOS() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [displayedTotal, setDisplayedTotal] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const actualTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // Animate the hero demo
  useEffect(() => {
    if (prefersReducedMotion) return;

    const timeline = [
      { delay: 2000, action: 'add', product: 0 },
      { delay: 3500, action: 'add', product: 1 },
      { delay: 4800, action: 'add', product: 3 },
      { delay: 6200, action: 'process' },
      { delay: 8500, action: 'complete' },
    ];

    timeline.forEach((step) => {
      const timer = setTimeout(() => {
        if (step.action === 'add' && step.product !== undefined) {
          const product = SAMPLE_PRODUCTS[step.product];
          setCart((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            if (existing) {
              return prev.map((item) =>
                item.id === product.id ? { ...item, qty: item.qty + 1 } : item
              );
            }
            return [...prev, { ...product, qty: 1 }];
          });
        } else if (step.action === 'process') {
          setIsProcessing(true);
        } else if (step.action === 'complete') {
          setShowConfirmation(true);
          setTimeout(() => {
            setCart([]);
            setDisplayedTotal(0);
            setIsProcessing(false);
            setShowConfirmation(false);
          }, 2000);
        }
      }, step.delay);

      return () => clearTimeout(timer);
    });
  }, [prefersReducedMotion]);

  // Animate cart total counter
  useEffect(() => {
    if (!actualTotal) return;

    let current = displayedTotal;
    const target = actualTotal;
    const increment = (target - current) / 20;

    const interval = setInterval(() => {
      current += increment;
      if (Math.abs(current - target) < 0.1) {
        setDisplayedTotal(target);
        clearInterval(interval);
      } else {
        setDisplayedTotal(current);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [actualTotal, displayedTotal]);

  const floatingVariants = (delay: number) => ({
    initial: { y: 0, opacity: 0 },
    animate: {
      y: prefersReducedMotion ? 0 : [0, -8, 0],
      opacity: 1,
      transition: {
        duration: 4,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  });

  return (
    <section className="relative min-h-screen bg-gradient-to-b from-white via-gray-50 to-white dark:from-ink-950 dark:via-ink-900 dark:to-ink-950 overflow-hidden pt-20">
      {/* Subtle background grid */}
      <div className="absolute inset-0 opacity-30 dark:opacity-10">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Copy & CTA */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            >
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Modern POS Platform
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white leading-tight"
            >
              POS Platform for{' '}
              <span className="relative">
                <span className="relative z-10">Modern Businesses</span>
                <motion.span
                  className="absolute bottom-2 left-0 h-3 bg-blue-600/20 dark:bg-blue-500/20 -z-10"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  style={{ maxWidth: 'calc(100% + 20px)' }}
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-xl leading-relaxed font-light"
            >
              Unified payments, inventory, and analytics. Real-time insights. Global reach. Built for scale.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <button
                onClick={() => navigate('/signup')}
                className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                Start Free Trial
              </button>
              <button
                onClick={() => navigate('/marketplace')}
                className="px-8 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-ink-800 transition-colors duration-200"
              >
                View Integrations
              </button>
            </motion.div>

            {/* Trust metric */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-sm text-gray-500 dark:text-gray-500 pt-4"
            >
              14-day free trial • No credit card required • Enterprise-grade security
            </motion.p>
          </motion.div>

          {/* Right: Interactive POS Demo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative h-96 md:h-[500px] lg:h-[600px] flex items-center justify-center"
          >
            {/* Main POS Interface */}
            <motion.div
              layoutId="pos-terminal"
              className="relative w-80 md:w-96 bg-white dark:bg-ink-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-ink-700 overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <h3 className="text-white font-semibold text-sm">Order Terminal</h3>
              </div>

              {/* Items List */}
              <div className="px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
                <AnimatePresence>
                  {cart.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ type: 'spring', stiffness: 100 }}
                      className="flex items-center justify-between text-sm border-b border-gray-100 dark:border-ink-700 pb-2"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white text-xs">{item.name}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">
                          {item.qty}x @ ${item.price.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white text-xs">
                        ${(item.price * item.qty).toFixed(2)}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {cart.length === 0 && (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-gray-400 dark:text-gray-500 text-xs py-8"
                  >
                    Awaiting order...
                  </motion.p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-ink-700" />

              {/* Total Section */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-ink-700/50 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    ${displayedTotal.toFixed(2)}
                  </span>
                </div>

                {/* Processing State */}
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-center gap-2 py-2"
                    >
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="w-3 h-3 rounded-full border-2 border-blue-600 border-t-transparent"
                      />
                      <span className="text-xs text-blue-600 font-medium">Processing...</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Confirmation */}
                <AnimatePresence>
                  {showConfirmation && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center justify-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 rounded px-3"
                    >
                      <Check size={16} className="text-green-600 dark:text-green-400" />
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Payment Confirmed
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isProcessing || cart.length === 0}
                  className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors ${
                    isProcessing || cart.length === 0
                      ? 'bg-gray-200 dark:bg-ink-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Complete Payment'}
                </motion.button>
              </div>
            </motion.div>

            {/* Floating Stats Cards */}
            {STATS.map((stat, idx) => (
              <motion.div
                key={stat.id}
                initial="initial"
                animate="animate"
                variants={floatingVariants(stat.delay)}
                className={`absolute backdrop-blur bg-white/80 dark:bg-ink-800/80 border border-gray-200/50 dark:border-ink-700/50 rounded-xl px-4 py-3 shadow-lg ${
                  idx === 0
                    ? 'top-8 -left-16 md:-left-24'
                    : idx === 1
                      ? '-bottom-8 left-1/2 transform -translate-x-1/2'
                      : 'top-1/3 -right-20 md:-right-32'
                }`}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + stat.delay, type: 'spring' }}
                  className="space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400">{stat.icon}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {stat.label}
                  </p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 + stat.delay }}
                    className="text-lg font-bold text-gray-900 dark:text-white"
                  >
                    {stat.value}
                  </motion.p>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Bottom Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pt-12 border-t border-gray-200 dark:border-ink-700"
        >
          {[
            { title: '180+ Currencies', desc: 'Global transactions in real-time' },
            { title: '7 Payment Processors', desc: 'Stripe, PayPal, Flutterwave & more' },
            { title: '54 Countries', desc: 'Enterprise-grade compliance & security' },
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + idx * 0.1 }}
              className="space-y-2"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
