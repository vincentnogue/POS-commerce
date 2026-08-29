import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu, X, Globe, ChevronDown, ArrowRight, MapPin,
  ShoppingCart, Package, Store, Plug, FileText, BarChart3,
  ShieldCheck, Wallet, Check, CheckCircle2, Smartphone, TrendingUp, Receipt,
  Clock, CreditCard, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { PricingCard, type PricingPlan } from '../components/PricingCard';
import { CountryFlagsMarquee } from '../components/CountryFlagsMarquee';
import { PLANS as REAL_PLANS } from '../lib/plans';

// Real feature set — every entry below maps to an actual module that ships
// in this app (see src/pages/modules/*), not aspirational copy. Titles/descriptions
// come from i18n (pLanding.feature.*) so the EN toggle translates this grid too.
const FEATURE_KEYS = [
  { icon: ShoppingCart, key: 'pos' },
  { icon: Package, key: 'stock' },
  { icon: Store, key: 'stores' },
  { icon: Wallet, key: 'currencies' },
  { icon: FileText, key: 'invoicing' },
  { icon: Plug, key: 'marketplace' },
  { icon: BarChart3, key: 'reports' },
  { icon: ShieldCheck, key: 'roles' },
] as const;

// Demo cart for the hero product showcase — illustrative, generic retail items
// (rice, oil, soap) run through the real checkout vocabulary (cart, subtotal,
// tax, mobile money) that ships in src/pages/modules/POSPage.tsx. Not a live
// embed of the authenticated app (that needs a logged-in tenant + real data),
// but a faithful, clearly-labelled preview of how a sale actually flows.
const DEMO_ITEMS = [
  { key: 'item1', price: 4.5, qty: 1 },
  { key: 'item2', price: 6, qty: 2 },
  { key: 'item3', price: 1.5, qty: 3 },
] as const;

// Shape of a row from the real integration_providers table, used only for
// the landing page's ecosystem strip (subset of columns, public-readable).
type EcosystemProvider = {
  provider_key: string;
  provider_name: string;
  logo_url: string;
  category: string;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// Scroll-triggered count-up for stat numbers. Starts counting once the
// element enters the viewport (IntersectionObserver, fires once), jumps
// straight to the final value when the user prefers reduced motion.
function CountUp({ value, suffix = '', duration = 1400 }: { value: number; suffix?: string; duration?: number }) {
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration, reducedMotion]);

  return <span ref={ref}>{display}{suffix}</span>;
}

function formatUSD(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Reusable scroll-triggered reveal (fade + rise), fires once per element.
// Instant (no motion) when the user prefers reduced motion.
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reducedMotion = usePrefersReducedMotion();
  if (reducedMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Cycles through: empty → items added one by one → paid → brief pause → reset.
// Fully static (final, paid state) when the user prefers reduced motion.
function usePosDemoStep() {
  const reducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(reducedMotion ? DEMO_ITEMS.length + 1 : 0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (reducedMotion) {
      setStep(DEMO_ITEMS.length + 1);
      return;
    }
    const maxStep = DEMO_ITEMS.length + 2; // items..., paid, hold
    const delays = [900, 900, 900, 700, 2600, 1400]; // per-step dwell time
    const advance = () => {
      setStep((s) => {
        const next = s >= maxStep ? 0 : s + 1;
        timerRef.current = setTimeout(advance, delays[next] ?? 900);
        return next;
      });
    };
    timerRef.current = setTimeout(advance, delays[0]);
    return () => clearTimeout(timerRef.current);
  }, [reducedMotion]);

  return { step, reducedMotion, itemCount: DEMO_ITEMS.length };
}

function PosLiveDemo() {
  const { t } = useI18n();
  const { step, reducedMotion, itemCount } = usePosDemoStep();
  const [salesToday, setSalesToday] = useState(842.5);

  const visibleItems = DEMO_ITEMS.slice(0, Math.min(step, itemCount));
  const isPaid = step >= itemCount + 1;
  const subtotal = visibleItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const total = subtotal + tax;

  // Bump the "today's sales" stat once per completed sale — small, honest
  // motion cue rather than a runaway counter.
  const prevPaid = useRef(false);
  useEffect(() => {
    if (isPaid && !prevPaid.current) setSalesToday((v) => v + total);
    prevPaid.current = isPaid;
  }, [isPaid, total]);

  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      {/* Ambient glow — subtle, no particles */}
      <div className="absolute -inset-8 bg-gradient-to-br from-brand-500/20 via-flow-500/10 to-transparent rounded-[2.5rem] blur-2xl" aria-hidden="true" />

      {/* Backing layer for depth — slight offset, no heavy 3D */}
      <div className="absolute inset-0 translate-x-3 translate-y-4 rotate-2 rounded-3xl bg-ink-800/60 border border-ink-700/60 hidden sm:block" aria-hidden="true" />

      {/* Main POS panel */}
      <div className="relative rounded-3xl border border-ink-700/80 bg-ink-900/95 backdrop-blur shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-800">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-action-500" />
            <span className="text-sm font-semibold text-white">{t('pLanding.hero.demo.panelTitle')}</span>
          </div>
          <Receipt size={16} className="text-ink-500" />
        </div>

        <div className="px-5 py-4 min-h-[168px]">
          {visibleItems.length === 0 ? (
            <p className="text-sm text-ink-500 py-8 text-center">{t('pLanding.hero.demo.cartEmpty')}</p>
          ) : (
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {visibleItems.map((item) => (
                  <motion.li
                    key={item.key}
                    initial={reducedMotion ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-ink-200">
                      {item.qty}× {t(`pLanding.hero.demo.${item.key}`)}
                    </span>
                    <span className="text-ink-400 tabular-nums">{formatUSD(item.price * item.qty)}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-ink-800 bg-ink-950/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>{t('pLanding.hero.demo.subtotal')}</span>
            <span className="tabular-nums">{formatUSD(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>{t('pLanding.hero.demo.tax')}</span>
            <span className="tabular-nums">{formatUSD(tax)}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-semibold text-white">{t('pLanding.hero.demo.total')}</span>
            <motion.span
              key={total}
              initial={reducedMotion ? false : { opacity: 0.4 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold text-white tabular-nums"
            >
              {formatUSD(total)}
            </motion.span>
          </div>

          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              isPaid ? 'bg-brand-500 text-white' : 'bg-white text-ink-900'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isPaid ? (
                <motion.span
                  key="paid"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <Check size={16} /> {t('pLanding.hero.demo.paid')}
                </motion.span>
              ) : (
                <motion.span key="pay" className="flex items-center gap-2">
                  {t('pLanding.hero.demo.pay')}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Floating card — today's sales, subtle live-count feel */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, -6, 0] }}
        transition={reducedMotion ? { duration: 0.4 } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="hidden sm:flex absolute -top-6 -right-6 items-center gap-3 rounded-2xl border border-ink-700/80 bg-ink-900/95 backdrop-blur px-4 py-3 shadow-xl shadow-black/30"
      >
        <div className="h-8 w-8 rounded-lg bg-flow-500/15 flex items-center justify-center">
          <TrendingUp size={16} className="text-flow-400" />
        </div>
        <div>
          <p className="text-[11px] text-ink-500 leading-none mb-1">{t('pLanding.hero.demo.statSalesToday')}</p>
          <p className="text-sm font-semibold text-white tabular-nums leading-none">{formatUSD(salesToday)}</p>
        </div>
      </motion.div>

      {/* Floating card — payment confirmation toast */}
      <AnimatePresence>
        {isPaid && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 6 }}
            transition={{ duration: 0.4 }}
            className="hidden sm:flex absolute -bottom-5 -left-6 items-center gap-2.5 rounded-2xl border border-brand-500/30 bg-ink-900/95 backdrop-blur px-4 py-3 shadow-xl shadow-black/30"
          >
            <div className="h-7 w-7 rounded-full bg-brand-500/15 flex items-center justify-center">
              <Smartphone size={14} className="text-brand-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-white leading-none mb-1">{t('pLanding.hero.demo.paid')}</p>
              <p className="text-[11px] text-ink-500 leading-none">{t('pLanding.hero.demo.viaMobileMoney')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: 'Idéal pour démarrer votre commerce',
  pro: 'Pour les commerces en croissance',
  premium: 'Fonctionnalités avancées et support prioritaire',
  entreprise: 'Pour les grandes organisations multi-boutiques',
};

const LANDING_PLANS: PricingPlan[] = REAL_PLANS.map((p) => ({
  id: p.code,
  name: p.name,
  description: PLAN_DESCRIPTIONS[p.code] ?? '',
  basePrice: p.priceMonthly,
  features: p.features.slice(0, 6).map((f) => ({ name: f, included: true })),
  cta: p.code === 'entreprise'
    ? { text: 'Contacter les ventes', href: '/contact' }
    : { text: 'Essayer gratuitement', href: '/signup' },
  popular: p.popular,
  badge: p.popular ? 'LE PLUS CHOISI' : undefined,
}));

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const heroReducedMotion = usePrefersReducedMotion();
  const [ecosystemProviders, setEcosystemProviders] = useState<EcosystemProvider[]>([]);

  // Real integrations only — pulled live from the same integration_providers
  // table that powers /marketplace (public SELECT policy, no auth needed).
  // Never hardcode brand names here: if a provider isn't actually in the
  // marketplace yet, it must not appear as "compatible" on the landing page.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('integration_providers')
      .select('provider_key, provider_name, logo_url, category')
      .eq('is_active', true)
      .not('logo_url', 'is', null)
      .order('is_featured', { ascending: false })
      .limit(14)
      .then(({ data }) => {
        if (!cancelled && data) setEcosystemProviders(data as EcosystemProvider[]);
      });
    return () => { cancelled = true; };
  }, []);

  // Real, live merchant count — see supabase/functions/platform-stats.
  // No hardcoded fallback number: if the fetch fails, the stat card simply
  // doesn't render rather than showing an unverifiable placeholder.
  const [merchantCount, setMerchantCount] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('platform-stats');
        if (error) throw error;
        if (typeof data?.merchantCount === 'number') setMerchantCount(data.merchantCount);
      } catch (error) {
        console.error('platform-stats fetch failed:', error);
      }
    })();
  }, []);

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      navigate(`/signup?email=${encodeURIComponent(email)}`);
    }
  };

  const scrollToPricing = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 dark:border-ink-800 bg-white/95 dark:bg-ink-950/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo-pos-icon.png" alt="POS Flow" className="h-9 w-9" />
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                POS <span className="text-brand-600">Flow</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <div className="relative group">
                <button className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 flex items-center gap-1">
                  {t('pLanding.nav.products')} <ChevronDown size={16} />
                </button>
                <div className="absolute left-0 mt-0 w-64 bg-white dark:bg-ink-900 border border-gray-200 dark:border-ink-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                  <a href="#features" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">{t('pLanding.nav.productsFeatures')}</a>
                  <Link to="/marketplace" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">{t('pLanding.nav.productsMarketplace')}</Link>
                </div>
              </div>

              <a href="#pricing" onClick={scrollToPricing} className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">{t('pLanding.nav.pricing')}</a>

              <Link to="/about" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">{t('pLanding.nav.about')}</Link>

              <div className="relative group">
                <Link to="/resources" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 flex items-center gap-1">
                  {t('pLanding.nav.resources')} <ChevronDown size={16} />
                </Link>
                <div className="absolute left-0 mt-0 w-48 bg-white dark:bg-ink-900 border border-gray-200 dark:border-ink-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                  <Link to="/documentation" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">{t('pLanding.nav.docs')}</Link>
                  <Link to="/help" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">{t('pLanding.nav.help')}</Link>
                  <Link to="/blog" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">{t('pLanding.nav.blog')}</Link>
                </div>
              </div>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-brand-600"
              >
                <Globe size={18} /> {lang.toUpperCase()}
              </button>
              <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">{t('pLanding.nav.login')}</Link>
              <Link to="/signup" className="px-6 py-2 bg-brand-600 text-white rounded-full font-medium hover:bg-brand-700 transition">
                {t('pLanding.nav.cta')}
              </Link>
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-700 dark:text-gray-300"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-ink-700 space-y-3"
            >
              <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.footer.features')}</a>
              <a href="#pricing" onClick={scrollToPricing} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.pricing')}</a>
              <Link to="/about" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.about')}</Link>
              <Link to="/documentation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.docs')}</Link>
              <Link to="/resources" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.resources')}</Link>
              <Link to="/help" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.help')}</Link>
              <Link to="/login" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.login')}</Link>
              <Link to="/signup" className="block w-full px-6 py-2 bg-brand-600 text-white rounded-full font-medium text-center">{t('pLanding.nav.cta')}</Link>
            </motion.div>
          )}
        </div>
      </header>

      {/* Hero Section — the product demo is the focal visual; video adds
          ambient motion behind it (muted, looped, no controls) */}
      <section className="relative bg-ink-950 overflow-hidden">
        {/* Background video layer — free Mixkit-licensed clip (no attribution
            required, commercial use OK). Falls back to a static poster frame
            for reduced-motion users instead of autoplaying. */}
        <div className="absolute inset-0" aria-hidden="true">
          {heroReducedMotion ? (
            <img
              src="https://assets.mixkit.co/videos/15914/15914-thumb-360-1.jpg"
              alt=""
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="https://assets.mixkit.co/videos/15914/15914-thumb-360-1.jpg"
              className="w-full h-full object-cover opacity-80"
            >
              <source src="https://assets.mixkit.co/videos/15914/15914-360.mp4" type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-ink-950/55" />
        </div>

        {/* Ambient gradient + grid, layered above the video */}
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(46,140,102,0.25),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_85%_60%,rgba(20,181,148,0.12),transparent)]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '56px 56px',
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 pt-16 pb-20 lg:pt-24 lg:pb-28 lg:px-8">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-10 items-center">
            {/* Copy column */}
            <div className="max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-7 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 backdrop-blur"
              >
                <MapPin size={14} className="text-action-500" />
                <span className="text-xs font-medium tracking-wide text-ink-200">{t('pLanding.hero.badge')}</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08 }}
                className="text-[2.75rem] leading-[1.08] sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight"
              >
                {t('pLanding.hero.titleStart')}{' '}
                <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-flow-400 to-brand-300">
                  {t('pLanding.hero.titleAccent')}
                </span>{' '}
                {t('pLanding.hero.titleEnd')}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16 }}
                className="text-lg text-ink-300 mb-9 leading-relaxed"
              >
                {t('pLanding.hero.desc')}
              </motion.p>

              <motion.form
                onSubmit={handleGetStarted}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.24 }}
                className="mb-5 flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="email"
                  placeholder={t('pLanding.hero.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-5 py-3.5 rounded-xl bg-white text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
                <button
                  type="submit"
                  className="group px-7 py-3.5 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all whitespace-nowrap inline-flex items-center justify-center gap-2"
                >
                  {t('pLanding.hero.start')}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </motion.form>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <a href="#features" className="text-sm font-medium text-ink-300 hover:text-white transition-colors">
                  {t('pLanding.hero.exploreFeatures')}
                </a>
                <a href="#pricing" onClick={scrollToPricing} className="text-sm font-medium text-ink-300 hover:text-white transition-colors">
                  {t('pLanding.hero.viewPricing')}
                </a>
                <span className="text-xs text-ink-500">{t('pLanding.hero.noCard')}</span>
              </motion.div>
            </div>

            {/* Product showcase column */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
            >
              <PosLiveDemo />
              <p className="hidden sm:block text-center text-[11px] text-ink-600 mt-8">
                {t('pLanding.hero.demo.caption')}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Real integrations ecosystem — live from the marketplace's own
          integration_providers table (same data /marketplace uses). Only
          providers actually seeded there (real logo_url) appear here, so
          this can never overstate what's actually connectable today.
          Reuses the existing .animate-marquee keyframe (src/index.css). */}
      {ecosystemProviders.length > 0 && (
        <section className="bg-gray-50 dark:bg-ink-900 py-10 border-b border-gray-200 dark:border-ink-800 overflow-hidden" aria-label="Integration ecosystem">
          <p className="text-center text-xs font-semibold tracking-wide text-gray-500 dark:text-ink-400 mb-6 px-4">
            {t('pLanding.ecosystem.heading')}
          </p>
          <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
              {[...ecosystemProviders, ...ecosystemProviders].map((p, i) => (
                <div
                  key={`${p.provider_key}-${i}`}
                  className="flex items-center gap-2.5 h-[62px] min-w-[160px] px-5 rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800 shadow-sm shrink-0"
                >
                  <img src={p.logo_url} alt="" loading="lazy" className="h-7 w-7 object-contain" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-ink-200 whitespace-nowrap">{p.provider_name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mt-6">
            <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
              {t('pLanding.ecosystem.cta')} <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}

      {/* Real stats strip — 30+ currencies (src/lib/currency.ts) and 9+
          payment processors (seeded integration_providers) are counted
          directly from actual code/data. The merchant-count card is added
          conditionally, ONLY once a real count is fetched live from the
          platform-stats edge function (supabase/functions/platform-stats) —
          never a hardcoded literal. A hardcoded "1850+ merchants" number
          was added and removed twice before this because it wasn't backed
          by anything queryable; this fetch is what makes it legitimate. */}
      <section className="bg-gray-50 dark:bg-ink-900 py-16 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className={`grid grid-cols-2 gap-4 md:gap-6 ${merchantCount !== null ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            {[
              ...(merchantCount !== null
                ? [{ icon: Users, value: merchantCount, suffix: '+', labelKey: 'pLanding.stats.clients' }]
                : []),
              { icon: Wallet, value: 30, suffix: '+', labelKey: 'pLanding.stats.currencies' },
              { icon: Plug, value: 9, suffix: '+', labelKey: 'pLanding.stats.processors' },
              { icon: Globe, value: null, labelKey: 'pLanding.stats.international' },
            ].map((stat, i) => (
              <Reveal key={stat.labelKey} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800/60 px-5 py-7 text-center transition hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-lg">
                  <div className="w-11 h-11 mx-auto rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
                    <stat.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {stat.value !== null ? <CountUp value={stat.value} suffix={stat.suffix} /> : t('pLanding.stats.internationalValue')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t(stat.labelKey)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 lg:px-8 max-w-7xl mx-auto">
        <Reveal className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('pLanding.features.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('pLanding.features.desc')}
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURE_KEYS.map((f, i) => (
            <Reveal key={f.key} delay={i * 0.06}>
              <div className="group relative h-full rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/5">
                <div className="w-11 h-11 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                  <f.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t(`pLanding.feature.${f.key}.title`)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t(`pLanding.feature.${f.key}.desc`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Buy smarter / Sell faster / Grow smarter — each pillar maps to a
          real shipped module, not aspirational copy: purchasing/suppliers,
          the POS checkout itself, and reports/multi-location/marketplace. */}
      <section className="py-24 px-4 lg:px-8 bg-gray-50 dark:bg-ink-900 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              {t('pLanding.bsg.title')}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('pLanding.bsg.desc')}
            </p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Package, key: 'buy', to: '/purchases' },
              { icon: ShoppingCart, key: 'sell', to: '/signup' },
              { icon: TrendingUp, key: 'grow', to: '/pricing' },
            ].map((card, i) => (
              <Reveal key={card.key} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-8 flex flex-col">
                  <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-5">
                    <card.icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t(`pLanding.bsg.${card.key}.title`)}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-5 flex-1">{t(`pLanding.bsg.${card.key}.desc`)}</p>
                  <ul className="space-y-2 mb-6">
                    {(['point1', 'point2', 'point3'] as const).map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Check className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" />
                        {t(`pLanding.bsg.${card.key}.${p}`)}
                      </li>
                    ))}
                  </ul>
                  <Link to={card.to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 mt-auto">
                    {t(`pLanding.bsg.${card.key}.cta`)} <ArrowRight size={14} />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations by category — real cards, real logos, real category
          tags, live from integration_providers (same data as the marquee
          above and /marketplace itself). Grouped by the actual `category`
          column values in the database: payments, accounting, ecommerce,
          communication, shipping — never invented categories like
          "banking" or "delivery" that don't exist in this system yet. */}
      {ecosystemProviders.length > 0 && (
        <section id="integrations" className="py-24 px-4 lg:px-8 max-w-7xl mx-auto">
          <Reveal className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3">
                {t('pLanding.integrationsGrid.title')}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl">
                {t('pLanding.integrationsGrid.desc')}
              </p>
            </div>
            <Link
              to="/marketplace"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink-950 dark:bg-white text-white dark:text-ink-950 text-sm font-semibold hover:opacity-90 transition"
            >
              {t('pLanding.integrationsGrid.cta')} <ArrowRight size={14} />
            </Link>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ecosystemProviders.slice(0, 9).map((p, i) => (
              <Reveal key={p.provider_key} delay={i * 0.04}>
                <div className="relative h-full rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/5">
                  <span className="absolute right-5 top-6 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-ink-500">
                    {p.category}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-ink-800 border border-gray-200 dark:border-ink-700 flex items-center justify-center mb-4">
                    <img src={p.logo_url} alt="" loading="lazy" className="h-7 w-7 object-contain" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5">{p.provider_name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {t(`pLanding.integrationsGrid.category.${p.category}`)}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-gray-200 dark:border-ink-700 bg-gray-50 dark:bg-ink-900 px-6 py-5 flex-wrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('pLanding.integrationsGrid.apiNote')}</span>
            <Link to="/documentation" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              {t('pLanding.integrationsGrid.apiCta')} →
            </Link>
          </Reveal>
        </section>
      )}

      {/* Industries + Hardware teaser — links to the real dedicated pages
          (IndustrySolutionsPage, HardwarePage) rather than duplicating their
          content here. Only the 3 verticals that page actually documents
          today (post restaurant-claims cleanup). */}
      <section className="py-16 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {t('pLanding.industries.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('pLanding.industries.desc')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: Store, key: 'retail' },
            { icon: Smartphone, key: 'services' },
            { icon: BarChart3, key: 'professional' },
          ].map((ind) => (
            <Link
              key={ind.key}
              to="/industry-solutions"
              className="group rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-7 hover:border-brand-500/50 hover:shadow-lg transition"
            >
              <div className="w-11 h-11 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                <ind.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5">{t(`pLanding.industries.${ind.key}.title`)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{t(`pLanding.industries.${ind.key}.desc`)}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 transition-all">
                {t('pLanding.industries.link')} <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-ink-700 bg-gray-50 dark:bg-ink-900 px-7 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('pLanding.hardwareTeaser.text')}</p>
          <Link to="/hardware" className="inline-flex items-center gap-1.5 shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700">
            {t('pLanding.hardwareTeaser.cta')} <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Pricing — light section (was hardcoded dark), fixed USD prices */}
      <section id="pricing" className="py-24 px-4 lg:px-8 bg-gray-50 dark:bg-ink-950 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-4">
            <div className="inline-block px-4 py-2 rounded-full bg-flow-500/10 border border-flow-500/30 text-flow-700 dark:text-flow-300 text-sm font-semibold mb-6">
              {t('pLanding.pricing.badge')}
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('pLanding.pricing.title')}</h2>
            <p className="text-lg text-gray-600 dark:text-ink-300 max-w-2xl mx-auto mb-2">
              {t('pLanding.pricing.desc')}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10 items-stretch">
            {LANDING_PLANS.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 0.08} className="h-full">
                <div className={plan.popular ? 'h-full rounded-2xl shadow-2xl shadow-brand-500/20' : 'h-full'}>
                  <PricingCard
                    plan={plan}
                    onSelect={() => navigate(plan.cta.href)}
                  />
                </div>
              </Reveal>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-flow-700 dark:text-flow-300 hover:text-flow-600 dark:hover:text-flow-200 font-medium">
              {t('pLanding.pricing.viewMatrix')} <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <CountryFlagsMarquee title={t('pLanding.worldwide.title')} lang={lang} />
      </section>

      {/* "Let's get busy"-style hero, in LiAfrik colors — checklist + email
          capture on a solid brand panel, stylized POS device mockup on a
          gradient panel (no stock photo — the product's own UI, styled as
          hardware, stays consistent with the rest of this page). */}
      <section className="px-4 lg:px-8 max-w-7xl mx-auto py-4">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Right-side gradient backdrop (spans full width, dark panel sits on top of it on the left) */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-800 via-flow-600 to-flow-400" />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 min-h-[560px]">
            {/* Dark content panel */}
            <div className="relative bg-brand-900/95 px-8 py-14 lg:px-14 lg:py-16 flex flex-col justify-center">
              <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-8">
                {t('pLanding.busyHero.titleBefore')}{' '}
                <span className="relative inline-block">
                  <span>{t('pLanding.busyHero.titleHighlight')}</span>
                  <svg
                    className="absolute -left-2 -right-2 -top-2 -bottom-1 w-[calc(100%+16px)] h-[calc(100%+12px)]"
                    viewBox="0 0 220 70"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <ellipse cx="110" cy="35" rx="105" ry="30" fill="none" stroke="#F96F22" strokeWidth="4" />
                  </svg>
                </span>
              </h2>

              <div className="space-y-5 mb-10">
                {(['point1', 'point2', 'point3'] as const).map((key) => (
                  <div key={key} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-white flex-shrink-0" />
                    <p className="text-white/90 text-lg">{t(`pLanding.busyHero.${key}`)}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleGetStarted} className="flex gap-2 max-w-md">
                <input
                  type="email"
                  required
                  placeholder={t('pLanding.busyHero.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-5 py-3 rounded-full bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-action-500"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-action-500 text-white rounded-full font-semibold hover:bg-action-600 transition whitespace-nowrap"
                >
                  {t('pLanding.busyHero.cta')}
                </button>
              </form>
            </div>

            {/* Device mockup panel */}
            <div className="relative hidden lg:flex items-center justify-center p-12 overflow-hidden">
              {/* Ambient glow behind the device */}
              <div className="absolute w-72 h-72 bg-flow-400/30 rounded-full blur-3xl" aria-hidden="true" />

              <div className="relative w-full max-w-md" style={{ transform: 'perspective(1200px) rotateY(-18deg) rotateX(4deg)' }}>
                {/* Monitor screen */}
                <div className="rounded-xl bg-ink-950/90 border-4 border-ink-900 shadow-2xl shadow-black/50 p-4">
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="h-6 rounded bg-brand-400/40" />
                    <div className="h-6 rounded bg-white/10" />
                    <div className="h-6 rounded bg-white/10" />
                    <div className="h-6 rounded bg-action-400/30" />
                  </div>
                  <div className="h-8 rounded bg-flow-500/40 mb-2" />
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className={`h-10 rounded ${i === 4 ? 'bg-brand-400/30' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>
                {/* Stand */}
                <div className="mx-auto w-4 h-10 bg-ink-800" />
                <div className="mx-auto w-40 h-6 rounded-full bg-ink-900 shadow-xl" />
                {/* Ground shadow */}
                <div className="mx-auto w-48 h-3 rounded-full bg-black/40 blur-md -mt-1" />

                {/* Floating live-status badge, echoing the hero demo's style */}
                <div className="absolute -top-4 -right-6 flex items-center gap-2 rounded-full border border-white/10 bg-ink-900/95 backdrop-blur px-3 py-2 shadow-xl shadow-black/30">
                  <span className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
                  <span className="text-xs font-medium text-white">{t('pLanding.busyHero.liveBadge')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why LiAfrik built this */}
      <section className="py-24 px-4 lg:px-8 max-w-6xl mx-auto">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            {t('pLanding.why.title')}
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['point1', 'point2', 'point3'] as const).map((key, i) => (
            <Reveal key={key} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/5">
                <div className="w-11 h-11 rounded-xl bg-brand-500/10 flex items-center justify-center mb-5">
                  <Check className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{t(`pLanding.why.${key}`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Trust & control — every claim maps to a real, shipped module:
          granular role permissions (src/pages/modules/UsersPage.tsx),
          traceable sale history with reprint (SaleHistoryTab.tsx), and
          multi-store management (StoresPage.tsx). No invented
          certifications or security standards. */}
      <section className="py-16 px-4 lg:px-8 bg-gray-50 dark:bg-ink-900 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              {t('pLanding.trust.title')}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('pLanding.trust.desc')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: ShieldCheck, key: 'roles' },
              { icon: Receipt, key: 'traceability' },
              { icon: Store, key: 'multiLocation' },
            ].map((item) => (
              <div key={item.key} className="rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-6">
                <div className="w-11 h-11 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5">{t(`pLanding.trust.${item.key}.title`)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t(`pLanding.trust.${item.key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Second hero — full video-backed CTA band before the footer */}
      <section className="relative bg-ink-950 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          {heroReducedMotion ? (
            <img
              src="https://assets.mixkit.co/videos/49137/49137-thumb-360-4.jpg"
              alt=""
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="https://assets.mixkit.co/videos/49137/49137-thumb-360-4.jpg"
              className="w-full h-full object-cover opacity-80"
            >
              <source src="https://assets.mixkit.co/videos/49137/49137-360.mp4" type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-ink-950/60" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_20%,rgba(20,181,148,0.18),transparent)]" />
        </div>

        <Reveal className="relative max-w-4xl mx-auto px-4 py-24 lg:px-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 backdrop-blur">
            <Globe size={14} className="text-flow-400" />
            <span className="text-xs font-medium tracking-wide text-ink-200">{t('pLanding.secondHero.badge')}</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">{t('pLanding.finalCta.title')}</h2>
          <p className="text-lg text-ink-300 mb-10 max-w-xl mx-auto">{t('pLanding.finalCta.desc')}</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-500 text-white rounded-full font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40"
          >
            {t('pLanding.finalCta.button')} <ArrowRight size={18} />
          </Link>
        </Reveal>
      </section>

      {/* Let's work together section removed: its i18n keys were never
          filled in (rendered raw as "pLanding.workTogether.title" instead of
          real text) and it showed a placeholder phone number
          ("+971XXXXXXXX") and an emoji in place of an image — none of it
          was ever real content. Deleted rather than fixed in place, per the
          request to remove it outright. */}

      {/* Keep things flowing section — dashboard-style layout (2-col: real-module
          checklist + a large illustrative report/dashboard panel), matching the
          dark "Less admin. More control" treatment from the reference design.
          The panel is a built graphic (bars/stat readouts), not a stock photo or
          a screenshot claiming to be the live product — no invented percentages,
          same real-module list as before (stock, day-open, POS sale, return
          credit), now as a checklist instead of four small cards. */}
      <section className="py-24 px-4 lg:px-8 bg-ink-950">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-16 items-center">
          <Reveal>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 whitespace-pre-line">
              {t('pLanding.keepFlowing.title')}
            </h2>
            <ul className="space-y-4 my-8">
              {(['benefit1', 'benefit2', 'benefit3', 'benefit4'] as const).map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="text-sm text-ink-200">{t(`pLanding.keepFlowing.${key}`)}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/30"
            >
              {t('pLanding.keepFlowing.cta')} <ArrowRight size={18} />
            </Link>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="p-3 rounded-3xl bg-[#172B3A] border border-white/10 shadow-2xl">
              <div className="rounded-2xl bg-ink-900/60 p-8 h-[420px] sm:h-[480px] flex flex-col">
                <div className="flex items-end gap-3 flex-1 mb-6">
                  {[
                    { h: 42, Icon: Package, labelKey: 'pLanding.keepFlowing.card1.title' },
                    { h: 68, Icon: Clock, labelKey: 'pLanding.keepFlowing.card2.title' },
                    { h: 88, Icon: Receipt, labelKey: 'pLanding.keepFlowing.card3.title' },
                    { h: 55, Icon: CreditCard, labelKey: 'pLanding.keepFlowing.card4.title' },
                  ].map(({ h, Icon }, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-flow-400"
                        style={{ height: `${h}%` }}
                      />
                      <Icon size={16} className="text-ink-400" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(['benefit1', 'benefit3'] as const).map((key) => (
                    <div key={key} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                      <p className="text-xs text-ink-400">{t(`pLanding.keepFlowing.${key}`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-ink-800 bg-white dark:bg-ink-950">
        <div className="max-w-7xl mx-auto px-4 py-12 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">{t('pLanding.footer.product')}</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#features" className="hover:text-brand-600">{t('pLanding.footer.features')}</a></li>
                <li><a href="#pricing" onClick={scrollToPricing} className="hover:text-brand-600">{t('pLanding.nav.pricing')}</a></li>
                <li><Link to="/marketplace" className="hover:text-brand-600">{t('pLanding.footer.marketplace')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">{t('pLanding.footer.company')}</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link to="/about" className="hover:text-brand-600">{t('pLanding.footer.about')}</Link></li>
                <li><Link to="/careers" className="hover:text-brand-600">{t('pLanding.footer.careers')}</Link></li>
                <li><Link to="/blog" className="hover:text-brand-600">{t('pLanding.footer.blog')}</Link></li>
                <li><Link to="/contact" className="hover:text-brand-600">{t('pLanding.footer.contact')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">{t('pLanding.footer.resources')}</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link to="/resources" className="hover:text-brand-600">{t('pLanding.footer.resources')}</Link></li>
                <li><Link to="/help" className="hover:text-brand-600">{t('pLanding.footer.help')}</Link></li>
                <li><Link to="/documentation" className="hover:text-brand-600">{t('pLanding.footer.docs')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">{t('pLanding.footer.legal')}</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link to="/privacy" className="hover:text-brand-600">{t('pLanding.footer.privacy')}</Link></li>
                <li><Link to="/terms" className="hover:text-brand-600">{t('pLanding.footer.terms')}</Link></li>
                <li><Link to="/legal" className="hover:text-brand-600">{t('pLanding.footer.legalNotice')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-ink-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('pLanding.footer.rights', { year: new Date().getFullYear() })}
            </p>
            <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600">
              {lang.toUpperCase()}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
