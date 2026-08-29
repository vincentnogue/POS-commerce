import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu, X, Globe, ChevronDown, ArrowRight, MapPin,
  ShoppingCart, Package, Store, Plug, FileText, BarChart3,
  ShieldCheck, Wallet, Check, CheckCircle2, Smartphone, TrendingUp, Receipt,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../lib/i18n';
import { PricingCard, type PricingPlan } from '../components/PricingCard';
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

// Swappable trust-marquee logos — real <img> files under /public/logos/.
// IMPORTANT: these are intentionally generic "logo slot" placeholders, NOT
// invented company names (an earlier version used made-up names like
// "Retail Group Afrique", which a site visitor would read as real
// customers — that's fabricated social proof and was correctly removed).
// Swap the 6 files in /public/logos/ for real partner/customer logos (with
// their permission) whenever they're available; no code change needed.
const LOGO_PLACEHOLDERS = [
  { src: '/logos/partner-1.svg', alt: 'Emplacement logo partenaire' },
  { src: '/logos/partner-2.svg', alt: 'Emplacement logo partenaire' },
  { src: '/logos/partner-3.svg', alt: 'Emplacement logo partenaire' },
  { src: '/logos/partner-4.svg', alt: 'Emplacement logo partenaire' },
  { src: '/logos/partner-5.svg', alt: 'Emplacement logo partenaire' },
  { src: '/logos/partner-6.svg', alt: 'Emplacement logo partenaire' },
];

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

      {/* Real stats strip — international framing, animated count-up */}
      <section className="bg-gray-50 dark:bg-ink-900 py-12 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                <CountUp value={1850} suffix="+" />
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('pLanding.stats.clients')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                <CountUp value={30} suffix="+" />
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('pLanding.stats.currencies')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                <CountUp value={9} suffix="+" />
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('pLanding.stats.processors')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{t('pLanding.stats.internationalValue')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('pLanding.stats.international')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust marquee — scrolling logo band. Generic placeholder logo
          slots (see LOGO_PLACEHOLDERS above) — not fabricated company
          names, ready to swap for real partner/customer logos. */}
      <section className="bg-white dark:bg-ink-950 py-10 border-b border-gray-200 dark:border-ink-800 overflow-hidden">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-ink-500 mb-6">
          {t('pLanding.trust.title')}
        </p>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white dark:from-ink-950 to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white dark:from-ink-950 to-transparent z-10" />
          <div className="flex w-max animate-marquee gap-16 px-8">
            {[...LOGO_PLACEHOLDERS, ...LOGO_PLACEHOLDERS].map((logo, i) => (
              <img
                key={`${logo.src}-${i}`}
                src={logo.src}
                alt={logo.alt}
                className="h-10 shrink-0 opacity-90 dark:opacity-80"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('pLanding.features.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('pLanding.features.desc')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURE_KEYS.map((f) => (
            <div
              key={f.key}
              className="rounded-xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 hover:border-brand-500/50 hover:shadow-lg transition"
            >
              <div className="w-11 h-11 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t(`pLanding.feature.${f.key}.title`)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t(`pLanding.feature.${f.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — light section (was hardcoded dark), fixed USD prices */}
      <section id="pricing" className="py-20 px-4 lg:px-8 bg-gray-50 dark:bg-ink-950 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <div className="inline-block px-4 py-2 rounded-full bg-flow-500/10 border border-flow-500/30 text-flow-700 dark:text-flow-300 text-sm font-semibold mb-6">
              {t('pLanding.pricing.badge')}
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">{t('pLanding.pricing.title')}</h2>
            <p className="text-lg text-gray-600 dark:text-ink-300 max-w-2xl mx-auto mb-2">
              {t('pLanding.pricing.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10 items-stretch">
            {LANDING_PLANS.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                onSelect={() => navigate(plan.cta.href)}
              />
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-flow-700 dark:text-flow-300 hover:text-flow-600 dark:hover:text-flow-200 font-medium">
              {t('pLanding.pricing.viewMatrix')} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
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
              <div className="relative w-full max-w-md" style={{ transform: 'perspective(1200px) rotateY(-18deg) rotateX(4deg)' }}>
                {/* Monitor screen */}
                <div className="rounded-xl bg-ink-950/90 border-4 border-ink-900 shadow-2xl p-4">
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-6 rounded bg-white/10" />
                    ))}
                  </div>
                  <div className="h-8 rounded bg-flow-500/40 mb-2" />
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-10 rounded bg-white/10" />
                    ))}
                  </div>
                </div>
                {/* Stand */}
                <div className="mx-auto w-4 h-10 bg-ink-800" />
                <div className="mx-auto w-40 h-6 rounded-full bg-ink-900 shadow-xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why LiAfrik built this */}
      <section className="py-20 px-4 lg:px-8 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          {t('pLanding.why.title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mt-10">
          {(['point1', 'point2', 'point3'] as const).map((key) => (
            <div key={key} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-brand-600 flex-shrink-0 mt-1" />
              <p className="text-gray-600 dark:text-gray-300">{t(`pLanding.why.${key}`)}</p>
            </div>
          ))}
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

        <div className="relative max-w-4xl mx-auto px-4 py-24 lg:px-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 backdrop-blur">
            <Globe size={14} className="text-flow-400" />
            <span className="text-xs font-medium tracking-wide text-ink-200">{t('pLanding.secondHero.badge')}</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">{t('pLanding.finalCta.title')}</h2>
          <p className="text-lg text-ink-300 mb-10 max-w-xl mx-auto">{t('pLanding.finalCta.desc')}</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-500 text-white rounded-full font-semibold hover:bg-brand-600 transition shadow-lg shadow-brand-500/30"
          >
            {t('pLanding.finalCta.button')} <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Let's work together section - REAL & SIMPLE */}
      <section className="py-20 px-4 lg:px-8 bg-white dark:bg-ink-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-5xl lg:text-6xl font-bold text-ink-900 dark:text-white mb-6 leading-tight">
                Let's work together<br />to find the right<br />system for your<br />business
              </h2>
              
              <p className="text-lg text-ink-700 dark:text-ink-300 mb-8 leading-relaxed">
                Our business consultants are available in person or by phone to help you find the right system. We'll help you get up and running, and then we're available 24/7/365 for troubleshooting and support.<br /><br />We're here to help—always.
              </p>

              <div className="mb-8">
                <p className="text-sm font-bold text-ink-900 dark:text-white mb-2">Call now</p>
                <p className="text-3xl font-bold text-brand-600 dark:text-brand-400 mb-6">+971XXXXXXXX</p>
              </div>

              <Link
                to="/contact"
                className="inline-block px-8 py-3 border-2 border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400 rounded-lg font-semibold hover:bg-brand-50 dark:hover:bg-brand-600/10 transition"
              >
                Schedule a call
              </Link>
            </div>

            <div className="relative h-96 rounded-xl overflow-hidden shadow-2xl bg-gradient-to-br from-brand-100 via-flow-100 to-action-100 dark:from-ink-800 dark:via-ink-700 dark:to-ink-600 flex items-center justify-center">
              <div className="text-center">
                <div className="text-7xl mb-4">👩‍💼</div>
                <p className="text-lg font-bold text-ink-900 dark:text-white">Expert Consultation</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Keep things flowing section - REAL DASHBOARD */}
      <section className="py-20 px-4 lg:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-ink-950 dark:to-ink-900 border-t border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl lg:text-6xl font-bold text-ink-900 dark:text-white mb-6 leading-tight">
            Keep things flowing with the all-in-one platform
          </h2>
          
          <p className="text-lg text-ink-600 dark:text-ink-400 mb-16 max-w-2xl">
            Transform your business with integrated software designed to streamline operations, enhance customer experiences, and boost profitability through insights.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Revenue Card */}
            <div className="bg-white dark:bg-ink-800 p-8 rounded-lg border border-gray-200 dark:border-ink-700 shadow-md">
              <p className="text-sm text-ink-600 dark:text-ink-400 font-medium mb-2">Daily Revenue</p>
              <p className="text-4xl font-bold text-brand-600 dark:text-brand-400 mb-3">AED 15,240</p>
              <p className="text-sm text-green-600 dark:text-green-400 mb-6">↑ 32% vs yesterday</p>
              <div className="flex items-end gap-2 h-16">
                <div className="flex-1 bg-brand-500 rounded h-1/3" />
                <div className="flex-1 bg-brand-600 rounded h-1/2" />
                <div className="flex-1 bg-brand-700 rounded h-3/4" />
                <div className="flex-1 bg-brand-800 rounded h-full" />
              </div>
            </div>

            {/* Clock In Card */}
            <div className="bg-gradient-to-br from-ink-800 to-ink-900 dark:from-ink-700 dark:to-ink-800 p-8 rounded-lg shadow-md flex flex-col items-center justify-center text-white">
              <div className="relative w-32 h-32 mb-6">
                <div className="absolute inset-0 border-4 border-green-500 rounded-full" />
                <div className="absolute inset-2 border-2 border-ink-600 rounded-full" />
                <div className="absolute inset-4 flex flex-col items-center justify-center">
                  <p className="text-sm font-semibold">Chris L.</p>
                  <p className="text-xs text-gray-300">Clocked in</p>
                  <p className="text-xs text-green-400 font-bold">9:07 AM</p>
                </div>
              </div>
            </div>

            {/* Order Card */}
            <div className="bg-gradient-to-br from-green-400 to-green-500 p-8 rounded-lg shadow-md text-white">
              <p className="text-lg font-bold mb-6">Order #568</p>
              <div className="space-y-3">
                <div className="bg-white/20 backdrop-blur p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🍔</span>
                    <p className="font-medium">Classic Burger</p>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🍟</span>
                    <p className="font-medium">Truffle Fries</p>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🥤</span>
                    <p className="font-medium">Chocolate Shake</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Loyalty Card */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 dark:from-ink-800 dark:to-ink-900 p-8 rounded-lg shadow-md border border-gray-700 dark:border-ink-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">SR</div>
                <div>
                  <p className="font-semibold text-white text-sm">Shannon Rodgers</p>
                  <p className="text-xs text-gray-400">Member since 2018</p>
                </div>
              </div>
              <div className="bg-white dark:bg-ink-900 p-4 rounded-lg">
                <p className="font-bold text-brand-600 dark:text-brand-400 text-3xl">2,817</p>
                <p className="text-xs text-ink-600 dark:text-ink-400">Points Balance</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/pricing"
              className="inline-block px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition shadow-lg"
            >
              Explore Food & Beverage →
            </Link>
          </div>
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
