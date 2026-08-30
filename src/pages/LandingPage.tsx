import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu, X, Globe, ChevronDown, ArrowRight, MapPin,
  ShoppingCart, Package, Store, Plug, FileText, BarChart3,
  ShieldCheck, Wallet, Check, CheckCircle2, Smartphone, TrendingUp, Receipt, Moon, Sun,
  Search, Coffee, Shirt, Sparkles, CreditCard, Banknote, Percent, MessageCircle, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { PricingCard, type PricingPlan } from '../components/PricingCard';
import { PLANS as REAL_PLANS } from '../lib/plans';

// Real feature set — every entry below maps to an actual module that ships
// in this app (see src/pages/modules/*), not aspirational copy. Titles/descriptions
// come from i18n (pLanding.feature.*) so the EN toggle translates this grid too.

// Sample data for the landing page's "revenue" / "performance" chart
// illustrations. These are marketing mockups (same as the static
// "$2,450" figure and the old CSS-bar chart they replace) — not live
// data — but they now render through the same recharts components the
// real Dashboard/Reports modules use, instead of four fixed-height <div>s.
const REVENUE_TREND_SAMPLE = [
  { day: 'Lun', value: 1180 }, { day: 'Mar', value: 1420 }, { day: 'Mer', value: 1290 },
  { day: 'Jeu', value: 1610 }, { day: 'Ven', value: 1980 }, { day: 'Sam', value: 2260 },
  { day: 'Dim', value: 2450 },
];

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

// Real national flags (flagcdn.com, ISO 3166-1 alpha-2 codes) — UAE-anchored
// with a strong African footprint, then the rest of the world. Purely a
// visual statement of geographic reach, not a claim of offices/customers
// per country. 150+ real, valid ISO codes.
const FLAG_COUNTRIES = [
  // Gulf / Middle East
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'qa', name: 'Qatar' },
  { code: 'kw', name: 'Kuwait' },
  { code: 'bh', name: 'Bahrain' },
  { code: 'om', name: 'Oman' },
  { code: 'jo', name: 'Jordan' },
  { code: 'lb', name: 'Lebanon' },
  { code: 'iq', name: 'Iraq' },
  { code: 'il', name: 'Israel' },
  { code: 'tr', name: 'Türkiye' },
  // Africa
  { code: 'ng', name: 'Nigeria' },
  { code: 'gh', name: 'Ghana' },
  { code: 'ke', name: 'Kenya' },
  { code: 'za', name: 'South Africa' },
  { code: 'cm', name: 'Cameroon' },
  { code: 'sn', name: 'Senegal' },
  { code: 'ci', name: "Côte d'Ivoire" },
  { code: 'ug', name: 'Uganda' },
  { code: 'tz', name: 'Tanzania' },
  { code: 'ma', name: 'Morocco' },
  { code: 'eg', name: 'Egypt' },
  { code: 'et', name: 'Ethiopia' },
  { code: 'rw', name: 'Rwanda' },
  { code: 'bw', name: 'Botswana' },
  { code: 'dz', name: 'Algeria' },
  { code: 'tn', name: 'Tunisia' },
  { code: 'ly', name: 'Libya' },
  { code: 'sd', name: 'Sudan' },
  { code: 'ml', name: 'Mali' },
  { code: 'bf', name: 'Burkina Faso' },
  { code: 'ne', name: 'Niger' },
  { code: 'td', name: 'Chad' },
  { code: 'gn', name: 'Guinea' },
  { code: 'bj', name: 'Benin' },
  { code: 'tg', name: 'Togo' },
  { code: 'sl', name: 'Sierra Leone' },
  { code: 'lr', name: 'Liberia' },
  { code: 'gm', name: 'Gambia' },
  { code: 'gw', name: 'Guinea-Bissau' },
  { code: 'cv', name: 'Cabo Verde' },
  { code: 'mr', name: 'Mauritania' },
  { code: 'cd', name: 'DR Congo' },
  { code: 'cg', name: 'Congo' },
  { code: 'ga', name: 'Gabon' },
  { code: 'gq', name: 'Equatorial Guinea' },
  { code: 'cf', name: 'Central African Republic' },
  { code: 'ao', name: 'Angola' },
  { code: 'zm', name: 'Zambia' },
  { code: 'zw', name: 'Zimbabwe' },
  { code: 'mz', name: 'Mozambique' },
  { code: 'mw', name: 'Malawi' },
  { code: 'na', name: 'Namibia' },
  { code: 'sz', name: 'Eswatini' },
  { code: 'ls', name: 'Lesotho' },
  { code: 'mg', name: 'Madagascar' },
  { code: 'mu', name: 'Mauritius' },
  { code: 'ss', name: 'South Sudan' },
  { code: 'so', name: 'Somalia' },
  { code: 'dj', name: 'Djibouti' },
  { code: 'er', name: 'Eritrea' },
  { code: 'bi', name: 'Burundi' },
  // Europe
  { code: 'fr', name: 'France' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'de', name: 'Germany' },
  { code: 'es', name: 'Spain' },
  { code: 'it', name: 'Italy' },
  { code: 'pt', name: 'Portugal' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'be', name: 'Belgium' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'at', name: 'Austria' },
  { code: 'ie', name: 'Ireland' },
  { code: 'se', name: 'Sweden' },
  { code: 'no', name: 'Norway' },
  { code: 'dk', name: 'Denmark' },
  { code: 'fi', name: 'Finland' },
  { code: 'pl', name: 'Poland' },
  { code: 'cz', name: 'Czechia' },
  { code: 'gr', name: 'Greece' },
  { code: 'ro', name: 'Romania' },
  { code: 'hu', name: 'Hungary' },
  { code: 'ua', name: 'Ukraine' },
  { code: 'lu', name: 'Luxembourg' },
  { code: 'is', name: 'Iceland' },
  { code: 'hr', name: 'Croatia' },
  { code: 'bg', name: 'Bulgaria' },
  { code: 'sk', name: 'Slovakia' },
  { code: 'si', name: 'Slovenia' },
  { code: 'rs', name: 'Serbia' },
  { code: 'lt', name: 'Lithuania' },
  { code: 'lv', name: 'Latvia' },
  { code: 'ee', name: 'Estonia' },
  { code: 'cy', name: 'Cyprus' },
  { code: 'mt', name: 'Malta' },
  { code: 'al', name: 'Albania' },
  // Americas
  { code: 'us', name: 'United States' },
  { code: 'ca', name: 'Canada' },
  { code: 'mx', name: 'Mexico' },
  { code: 'br', name: 'Brazil' },
  { code: 'ar', name: 'Argentina' },
  { code: 'cl', name: 'Chile' },
  { code: 'co', name: 'Colombia' },
  { code: 'pe', name: 'Peru' },
  { code: 've', name: 'Venezuela' },
  { code: 'ec', name: 'Ecuador' },
  { code: 'uy', name: 'Uruguay' },
  { code: 'py', name: 'Paraguay' },
  { code: 'bo', name: 'Bolivia' },
  { code: 'do', name: 'Dominican Republic' },
  { code: 'cr', name: 'Costa Rica' },
  { code: 'pa', name: 'Panama' },
  { code: 'gt', name: 'Guatemala' },
  { code: 'hn', name: 'Honduras' },
  { code: 'sv', name: 'El Salvador' },
  { code: 'ni', name: 'Nicaragua' },
  { code: 'jm', name: 'Jamaica' },
  { code: 'tt', name: 'Trinidad and Tobago' },
  { code: 'ht', name: 'Haiti' },
  { code: 'cu', name: 'Cuba' },
  // Asia-Pacific
  { code: 'in', name: 'India' },
  { code: 'cn', name: 'China' },
  { code: 'jp', name: 'Japan' },
  { code: 'kr', name: 'South Korea' },
  { code: 'sg', name: 'Singapore' },
  { code: 'my', name: 'Malaysia' },
  { code: 'id', name: 'Indonesia' },
  { code: 'th', name: 'Thailand' },
  { code: 'vn', name: 'Vietnam' },
  { code: 'ph', name: 'Philippines' },
  { code: 'pk', name: 'Pakistan' },
  { code: 'bd', name: 'Bangladesh' },
  { code: 'lk', name: 'Sri Lanka' },
  { code: 'np', name: 'Nepal' },
  { code: 'kh', name: 'Cambodia' },
  { code: 'mm', name: 'Myanmar' },
  { code: 'la', name: 'Laos' },
  { code: 'mn', name: 'Mongolia' },
  { code: 'hk', name: 'Hong Kong' },
  { code: 'tw', name: 'Taiwan' },
  { code: 'au', name: 'Australia' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'fj', name: 'Fiji' },
  { code: 'pg', name: 'Papua New Guinea' },
  { code: 'kz', name: 'Kazakhstan' },
  { code: 'uz', name: 'Uzbekistan' },
  { code: 'af', name: 'Afghanistan' },
  { code: 'ir', name: 'Iran' },
  { code: 'ye', name: 'Yemen' },
  { code: 'sy', name: 'Syria' },
  { code: 'az', name: 'Azerbaijan' },
  { code: 'ge', name: 'Georgia' },
  { code: 'am', name: 'Armenia' },
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

      {/* Floating card — mini dashboard preview, using the same real
          recharts component (and sample data) as the "keepFlowing"
          section below and the real Dashboard module itself
          (src/pages/modules/DashboardPage.tsx). Added per product
          request without touching the existing panel/cards above. */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: -10 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, 6, 0] }}
        transition={reducedMotion ? { duration: 0.4 } : { duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        className="hidden sm:flex absolute -top-6 -left-6 w-36 flex-col gap-1.5 rounded-2xl border border-ink-700/80 bg-ink-900/95 backdrop-blur px-3 py-2.5 shadow-xl shadow-black/30"
      >
        <div className="flex items-center gap-1.5">
          <BarChart3 size={12} className="text-brand-400" />
          <span className="text-[10px] font-semibold text-ink-300">{t('pLanding.hero.demo.dashboardLabel')}</span>
        </div>
        <div className="h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={REVENUE_TREND_SAMPLE} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="heroDashboardGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E8C66" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#2E8C66" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#2E8C66" strokeWidth={2} fill="url(#heroDashboardGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

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
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const heroReducedMotion = usePrefersReducedMotion();
  const [ecosystemProviders, setEcosystemProviders] = useState<EcosystemProvider[]>([]);
  const [activeTab, setActiveTab] = useState<'pos' | 'payments' | 'inventory' | 'analytics' | 'employees' | 'crm' | 'stores' | 'integrations'>('pos');

  // Real, live merchant count — see supabase/functions/platform-stats. No
  // hardcoded fallback number: if the fetch fails, the stat card simply
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
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) setEcosystemProviders(data as EcosystemProvider[]);
      });
    return () => { cancelled = true; };
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

              <Link to="/pricing" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">{t('pLanding.nav.pricing')}</Link>

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

              <Link to="/contact" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">Contact us</Link>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={toggle}
                aria-label={theme === 'dark' ? t('pLanding.nav.themeLight') : t('pLanding.nav.themeDark')}
                title={theme === 'dark' ? t('pLanding.nav.themeLight') : t('pLanding.nav.themeDark')}
                className="flex items-center justify-center h-9 w-9 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-ink-800 transition"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
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
              <Link to="/pricing" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.pricing')}</Link>
              <Link to="/about" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.about')}</Link>
              <Link to="/documentation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.docs')}</Link>
              <Link to="/resources" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.resources')}</Link>
              <Link to="/help" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.help')}</Link>
              <Link to="/contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Contact us</Link>
              <div className="flex items-center gap-3 py-2">
                <button
                  onClick={toggle}
                  aria-label={theme === 'dark' ? t('pLanding.nav.themeLight') : t('pLanding.nav.themeDark')}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === 'dark' ? t('pLanding.nav.themeLight') : t('pLanding.nav.themeDark')}
                </button>
                <span className="text-gray-300 dark:text-ink-700">•</span>
                <button
                  onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <Globe size={16} /> {lang.toUpperCase()}
                </button>
              </div>
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
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="https://assets.mixkit.co/videos/15914/15914-thumb-360-1.jpg"
              className="w-full h-full object-cover"
            >
              <source src="https://assets.mixkit.co/videos/15914/15914-360.mp4" type="video/mp4" />
            </video>
          )}
          {/* Lighter, uneven overlay: darker over the copy column (left) to
              keep text legible, much lighter elsewhere so the video is
              actually visible instead of being washed out by a flat 55%
              black layer across the whole section. */}
          <div className="absolute inset-0 bg-ink-950/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 via-ink-950/50 to-ink-950/15 lg:to-ink-950/5" />
        </div>

        {/* Ambient gradient + tech effects, layered above the video */}
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(46,140,102,0.25),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_85%_60%,rgba(20,181,148,0.12),transparent)]" />
          
          {/* Tech effect - top left corner */}
          <div className="absolute top-0 left-0 w-80 h-80 opacity-20">
            <svg viewBox="0 0 200 200" className="w-full h-full text-flow-500">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <line x1="50" y1="20" x2="50" y2="80" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </svg>
          </div>
          
          {/* Tech effect - bottom right corner */}
          <div className="absolute bottom-0 right-0 w-80 h-80 opacity-20">
            <svg viewBox="0 0 200 200" className="w-full h-full text-brand-500">
              <circle cx="150" cy="150" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <circle cx="150" cy="150" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <circle cx="150" cy="150" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <line x1="120" y1="150" x2="180" y2="150" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <line x1="150" y1="120" x2="150" y2="180" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </svg>
          </div>
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
                  className="flex-1 px-5 py-3.5 rounded-full bg-white text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
                <button
                  type="submit"
                  className="group px-7 py-3.5 bg-brand-500 text-white rounded-full font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all whitespace-nowrap inline-flex items-center justify-center gap-2"
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
          Placed immediately below the hero, per brand direction. */}
      {ecosystemProviders.length > 0 && (
        <section className="bg-gray-50 dark:bg-ink-900 py-10 border-b border-gray-200 dark:border-ink-800 overflow-hidden" aria-label="Integration ecosystem">
          <p className="text-center text-xs font-semibold tracking-wide text-gray-500 dark:text-ink-400 mb-6 px-4">
            {t('pLanding.ecosystem.heading')}
          </p>
          <div className="flex w-max animate-[flagscroll_100s_linear_infinite] hover:[animation-play-state:paused] gap-3">
            {[...ecosystemProviders, ...ecosystemProviders].map((p, i) => (
              <div
                key={`${p.provider_key}-${i}`}
                className="flex items-center gap-2.5 h-[62px] min-w-[160px] px-5 rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800 shadow-sm shrink-0"
              >
                <img src={p.logo_url} alt="" loading="lazy" className="h-8 w-auto max-w-[92px] object-contain" />
                <span className="text-sm font-semibold text-gray-700 dark:text-ink-200 whitespace-nowrap">{p.provider_name}</span>
              </div>
            ))}
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
      <section className="bg-gray-50 dark:bg-ink-900 py-10 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className={`grid grid-cols-2 gap-3 md:gap-4 ${merchantCount !== null ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            {[
              ...(merchantCount !== null
                ? [{ icon: Users, value: merchantCount, suffix: '+', labelKey: 'pLanding.stats.clients' }]
                : []),
              { icon: Wallet, value: 30, suffix: '+', labelKey: 'pLanding.stats.currencies' },
              { icon: Plug, value: 9, suffix: '+', labelKey: 'pLanding.stats.processors' },
              { icon: Globe, value: null, labelKey: 'pLanding.stats.international' },
            ].map((stat, i) => (
              <Reveal key={stat.labelKey} delay={i * 0.06}>
                <div className="h-full rounded-xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800/60 px-4 py-4 text-center transition hover:border-brand-300 dark:hover:border-brand-500/40 hover:shadow-md">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-brand-500/10 flex items-center justify-center mb-2">
                    <stat.icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {stat.value !== null ? <CountUp value={stat.value} suffix={stat.suffix} /> : t('pLanding.stats.internationalValue')}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t(stat.labelKey)}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="text-center mt-4">
            <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
              {t('pLanding.ecosystem.cta')} <ArrowRight size={14} />
            </Link>
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
          {FEATURE_KEYS.map((f, i) => {
            // Static class strings, not interpolated — Tailwind's build-time
            // scanner can't see dynamically-built class names like
            // `bg-${color}-500/10`, so those would silently vanish from the
            // production CSS bundle. This lookup keeps the varied per-card
            // tint while staying scanner-safe.
            const tints = [
              { bg: 'bg-brand-500/10', icon: 'text-brand-600 dark:text-brand-400' },
              { bg: 'bg-flow-500/10', icon: 'text-flow-600 dark:text-flow-400' },
              { bg: 'bg-action-500/10', icon: 'text-action-600 dark:text-action-400' },
            ];
            const tint = tints[i % tints.length];
            return (
              <motion.div
                key={f.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: (i % 4) * 0.08, ease: 'easeOut' }}
                className="rounded-xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 hover:border-brand-500/50 hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <div className={`w-11 h-11 rounded-lg ${tint.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${tint.icon}`} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t(`pLanding.feature.${f.key}.title`)}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t(`pLanding.feature.${f.key}.desc`)}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Industries teaser — links to the real dedicated page
          (IndustrySolutionsPage) rather than duplicating its content here.
          Only the 3 verticals that page actually documents today (post
          restaurant-claims cleanup). No hardware teaser: POS Flow does not
          sell/support physical hardware today, so a hardware CTA here would
          be a false claim.
          Icons are the premium PNGs (rendered via CSS mask so they can be
          recolored: brand-blue on this section's white cards, white in
          dark mode) rather than plain lucide glyphs — was previously
          duplicated verbatim, checklists and all, in a second section
          further down the page; that duplicate has been removed and this
          is now the only "which business is this for" section. */}
      <section className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {t('pLanding.industries.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('pLanding.industries.desc')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: '/icon-shop-now.png', key: 'retail' },
            { icon: '/icon-scissors.png', key: 'services' },
            { icon: '/icon-professional-services.png', key: 'professional' },
          ].map((ind) => (
            <Link
              key={ind.key}
              to="/industry-solutions"
              className="group rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-8 hover:border-brand-500/50 hover:shadow-xl transition"
            >
              <div className="w-14 h-14 rounded-xl bg-brand-500/10 flex items-center justify-center mb-5 group-hover:scale-105 transition">
                <div
                  className="w-7 h-7 bg-brand-600 dark:bg-white"
                  style={{
                    WebkitMaskImage: `url(${ind.icon})`,
                    maskImage: `url(${ind.icon})`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                  }}
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t(`pLanding.industries.${ind.key}.title`)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{t(`pLanding.industries.${ind.key}.desc`)}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 transition-all">
                {t('pLanding.industries.link')} <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* POS Features Showcase - Multi-tab section */}
      <section className="py-20 px-4 lg:px-8 bg-white dark:bg-ink-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              POS system to help your business succeed
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              All the tools you need to manage your entire business in one powerful platform
            </p>
          </div>

          {/* Tabs Navigation */}
          <div className="mb-12">
            <div className="flex flex-wrap gap-2 justify-center pb-6 border-b border-gray-200 dark:border-ink-700">
              {[
                { id: 'pos', label: 'Point of sale', icon: ShoppingCart },
                { id: 'payments', label: 'Payments', icon: CreditCard },
                { id: 'inventory', label: 'Inventory management', icon: Package },
                { id: 'analytics', label: 'Sales analytics', icon: BarChart3 },
                { id: 'employees', label: 'Employee management', icon: Smartphone },
                { id: 'crm', label: 'CRM and customer loyalty', icon: TrendingUp },
                { id: 'stores', label: 'Multi-store management', icon: Store },
                { id: 'integrations', label: 'Integrations', icon: Plug },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                    activeTab === tab.id
                      ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Image/Visual - Uniform sizing */}
            <div className="relative h-96 lg:h-[500px] overflow-hidden rounded-xl shadow-lg bg-gray-200 dark:bg-ink-800">
              <img
                src={
                  activeTab === 'pos' ? '/feature-pos.jpg' :
                  activeTab === 'payments' ? '/feature-payments.jpg' :
                  activeTab === 'inventory' ? '/feature-inventory.jpg' :
                  activeTab === 'analytics' ? '/feature-analytics.jpg' :
                  activeTab === 'employees' ? '/feature-employees.jpg' :
                  activeTab === 'crm' ? '/feature-crm.jpg' :
                  activeTab === 'stores' ? '/feature-multistore.jpg' :
                  '/feature-integrations.jpg'
                }
                alt={`${activeTab} interface preview`}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Right: Description */}
            <div>
              {activeTab === 'pos' && (
                <div className="space-y-4">
                  <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    Point of sale
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Transform your smartphone or tablet into an easy-to-use point of sale
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Issue printed or electronic receipts</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Apply discounts and issue refunds</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Keep recording sales even when offline</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Connect a receipt printer, barcode scanner, and cash drawer</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Real-time sales tracking and inventory sync</span>
                    </li>
                  </ul>
                  <Link to="/pos" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold mt-6">
                    Explore Point of Sale <ArrowRight size={16} />
                  </Link>
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="space-y-4">
                  <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    Payments
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Accept payments from customers worldwide with secure, reliable payment processing
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Support 200+ payment methods globally</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Mobile money, cards, digital wallets</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Automatic currency conversion</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Integrated with Stripe, PayPal, and more</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">PCI-DSS compliant and secure</span>
                    </li>
                  </ul>
                  <Link to="/marketplace" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold mt-6">
                    Explore Payment Options <ArrowRight size={16} />
                  </Link>
                </div>
              )}

              {activeTab === 'inventory' && (
                <div className="space-y-4">
                  <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    Inventory management
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Track stock levels, manage suppliers, and optimize inventory across locations
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Real-time stock tracking</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Low stock alerts and reorder automation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Barcode scanning integration</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Multi-location inventory sync</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Supplier management and pricing</span>
                    </li>
                  </ul>
                  <Link to="/stock" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold mt-6">
                    Manage Inventory <ArrowRight size={16} />
                  </Link>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-4">
                  <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    Sales analytics
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Get detailed insights into your business performance with comprehensive reporting
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Real-time sales dashboards</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Revenue, profit, and margin tracking</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Customer behavior analysis</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Custom report builder</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Export and share reports</span>
                    </li>
                  </ul>
                  <Link to="/reports" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold mt-6">
                    View Reports <ArrowRight size={16} />
                  </Link>
                </div>
              )}

              {activeTab === 'employees' && (
                <div className="space-y-4">
                  <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    Employee management
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Manage staff, track hours, and monitor sales performance per team member
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Clock-in/clock-out tracking</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Role-based access control</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Performance metrics per cashier</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Shift scheduling</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Payroll integration ready</span>
                    </li>
                  </ul>
                  <Link to="/users" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold mt-6">
                    Manage Team <ArrowRight size={16} />
                  </Link>
                </div>
              )}

              {activeTab === 'crm' && (
                <div className="space-y-4">
                  <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    CRM and customer loyalty
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Build lasting customer relationships with loyalty programs and personalized engagement
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Customer database and profiles</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Points-based loyalty program</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">SMS and email campaigns</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Customer segmentation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Repeat purchase analytics</span>
                    </li>
                  </ul>
                  <Link to="/customers" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold mt-6">
                    Manage Customers <ArrowRight size={16} />
                  </Link>
                </div>
              )}

              {activeTab === 'stores' && (
                <div className="space-y-4">
                  <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    Multi-store management
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Manage multiple locations from a single dashboard with centralized control
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Unified inventory across locations</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Centralized reporting and analytics</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Store-specific permissions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Consolidated customer database</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Transfer stock between locations</span>
                    </li>
                  </ul>
                  <Link to="/stores" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold mt-6">
                    Manage Stores <ArrowRight size={16} />
                  </Link>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-4">
                  <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                    Integrations
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-300">
                    Connect with your favorite tools and services for seamless workflow
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Payment gateway integrations</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Shipping and logistics partners</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Accounting software sync</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">CRM and marketing tools</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">Custom API access</span>
                    </li>
                  </ul>
                  <Link to="/marketplace" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 font-semibold mt-6">
                    Browse Marketplace <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </div>
          </div>
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

      {/* Global markets band — real national flags (flagcdn.com), a visual
          statement of reach, not a claim of customers/offices in each
          country. UAE + strong African presence + rest of world, per brand
          positioning (Liafrik, Dubai & Africa). Placed right after the
          pricing/currency-matrix section, per brand direction. */}
      <section className="bg-white dark:bg-ink-950 py-8 border-b border-gray-100 dark:border-ink-800 overflow-hidden" aria-label="Global markets">
        <p className="text-center text-xs font-semibold tracking-wide text-gray-500 dark:text-ink-400 mb-5 px-4">
          {t('pLanding.flags.heading')}
        </p>
        <div className="flex w-max animate-[flagscroll_170s_linear_infinite] hover:[animation-play-state:paused] gap-5">
          {[...FLAG_COUNTRIES, ...FLAG_COUNTRIES].map((c, i) => (
            <div
              key={`${c.code}-${i}`}
              className="h-14 w-14 shrink-0 rounded-full overflow-hidden border border-gray-200 dark:border-ink-700 shadow-sm bg-gray-100"
              title={c.name}
            >
              <img
                src={`https://flagcdn.com/w160/${c.code}.png`}
                alt={i < FLAG_COUNTRIES.length ? c.name : ''}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </section>

      {/* "Let's get busy"-style hero, in LiAfrik colors — checklist + email
          capture on a solid brand panel, stylized POS device mockup on a
          gradient panel (no stock photo — the product's own UI, styled as
          hardware, stays consistent with the rest of this page). */}
      <section className="overflow-hidden">
        <div className="relative">
          {/* Right-side gradient backdrop (spans full width, dark panel sits on top of it on the left) */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-800 via-flow-600 to-flow-400" />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 min-h-[560px]">
            {/* Dark content panel */}
            <div className="relative bg-brand-900/95 px-8 py-14 lg:px-14 lg:py-16 xl:pl-24 flex flex-col justify-center">
              <div className="max-w-xl">
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
            </div>

            {/* Device mockup panel — a realistic POS checkout screen: search
                bar, category tabs, an icon-coded product grid, and a full
                cart panel with line items, tax and payment methods. Mirrors
                the real checkout layout in POSPage.tsx, no stock photo. */}
            <div className="relative hidden lg:flex items-center justify-center p-10 overflow-hidden">
              <div className="relative w-full max-w-lg" style={{ transform: 'perspective(1400px) rotateY(-12deg) rotateX(2deg)' }}>
                <div className="rounded-2xl bg-white border-4 border-ink-900 shadow-2xl overflow-hidden">
                  {/* Screen top bar */}
                  <div className="flex items-center justify-between bg-ink-950 px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-400/70" />
                      <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
                      <span className="h-2 w-2 rounded-full bg-flow-400" />
                    </div>
                    <span className="text-[9px] font-semibold text-white/50 tracking-widest">POS FLOW · CHECKOUT</span>
                    <span className="text-[9px] font-medium text-white/40">S. Amara</span>
                  </div>

                  <div className="flex bg-gray-50">
                    {/* Left: catalog */}
                    <div className="flex-[1.5] p-3.5 border-r border-gray-100">
                      {/* Search */}
                      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2.5">
                        <Search size={10} className="text-gray-400" />
                        <span className="text-[8px] text-gray-400">Search or scan barcode…</span>
                      </div>
                      {/* Category tabs */}
                      <div className="flex gap-1.5 mb-2.5">
                        {[
                          { label: 'All', active: true },
                          { label: 'Drinks', active: false },
                          { label: 'Snacks', active: false },
                          { label: 'Home', active: false },
                        ].map((cat) => (
                          <span
                            key={cat.label}
                            className={`text-[8px] font-semibold px-2 py-1 rounded-full ${cat.active ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                          >
                            {cat.label}
                          </span>
                        ))}
                      </div>
                      {/* Product grid */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { name: 'Sparkling water', price: '$1.50', icon: Coffee, tint: 'from-sky-100 to-sky-50 text-sky-600' },
                          { name: 'Roasted almonds', price: '$4.20', icon: Package, tint: 'from-amber-100 to-amber-50 text-amber-600' },
                          { name: 'Cotton tote', price: '$8.00', icon: Shirt, tint: 'from-brand-100 to-brand-50 text-brand-600' },
                          { name: 'Ceramic mug', price: '$6.50', icon: Coffee, tint: 'from-flow-100 to-flow-50 text-flow-600' },
                          { name: 'Notebook A5', price: '$3.10', icon: FileText, tint: 'from-violet-100 to-violet-50 text-violet-600' },
                          { name: 'Candle 200g', price: '$9.90', icon: Sparkles, tint: 'from-rose-100 to-rose-50 text-rose-600' },
                        ].map((p) => (
                          <div key={p.name} className="rounded-lg bg-white border border-gray-100 p-1.5 shadow-sm">
                            <div className={`h-7 rounded-md bg-gradient-to-br ${p.tint} flex items-center justify-center mb-1`}>
                              <p.icon size={11} strokeWidth={2} />
                            </div>
                            <p className="text-[6.5px] font-medium text-ink-700 leading-tight truncate">{p.name}</p>
                            <p className="text-[7.5px] font-bold text-brand-600">{p.price}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: cart */}
                    <div className="flex-1 bg-ink-950 p-3.5 flex flex-col">
                      <p className="text-[8px] font-semibold text-white/50 tracking-wide mb-2">CURRENT SALE · #INV-0842</p>
                      <div className="space-y-1.5 mb-2.5 flex-1">
                        {[
                          { name: 'Roasted almonds', qty: 1, price: '$4.20' },
                          { name: 'Cotton tote', qty: 1, price: '$8.00' },
                          { name: 'Ceramic mug', qty: 1, price: '$6.50' },
                        ].map((line) => (
                          <div key={line.name} className="flex items-center justify-between">
                            <span className="text-[7.5px] text-white/80 truncate">{line.qty}× {line.name}</span>
                            <span className="text-[7.5px] font-semibold text-white">{line.price}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/10 pt-2 space-y-1 mb-2.5">
                        <div className="flex items-center justify-between text-[7px] text-white/50">
                          <span className="flex items-center gap-1"><Percent size={8} /> Tax</span>
                          <span>$0.00</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold text-white">Total</span>
                          <span className="text-lg font-bold text-flow-400">$18.70</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <div className="flex-1 flex items-center justify-center gap-1 bg-white/10 rounded-md py-1.5">
                          <Banknote size={10} className="text-flow-400" />
                          <span className="text-[7px] font-medium text-white/80">Cash</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center gap-1 bg-flow-500 rounded-md py-1.5">
                          <CreditCard size={10} className="text-white" />
                          <span className="text-[7px] font-medium text-white">Card</span>
                        </div>
                      </div>
                    </div>
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
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="https://assets.mixkit.co/videos/49137/49137-thumb-360-4.jpg"
              className="w-full h-full object-cover"
            >
              <source src="https://assets.mixkit.co/videos/49137/49137-360.mp4" type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-ink-950/40" />
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

      {/* Let's work together section */}
      <section className="py-24 px-4 lg:px-8 bg-white dark:bg-ink-900 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left content */}
            <div>
              <span className="inline-block text-xs font-bold tracking-widest uppercase text-brand-600 dark:text-brand-400 mb-4">
                {t('pLanding.workTogether.eyebrow')}
              </span>
              <h2 className="text-4xl lg:text-5xl font-bold text-ink-900 dark:text-white mb-6 leading-tight">
                {t('pLanding.workTogether.title')}
              </h2>
              <p className="text-lg text-ink-700 dark:text-ink-300 mb-10 leading-relaxed whitespace-pre-line">
                {t('pLanding.workTogether.desc')}
              </p>

              <div className="space-y-6">
                {(['assessment', 'recommendation', 'support'] as const).map((key) => (
                  <div key={key} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 text-white text-base font-bold shadow-sm shadow-brand-500/40">✓</div>
                    <div>
                      <p className="font-semibold text-ink-900 dark:text-white">{t(`pLanding.workTogether.point.${key}.title`)}</p>
                      <p className="text-sm text-ink-600 dark:text-ink-400 mt-0.5">{t(`pLanding.workTogether.point.${key}.desc`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right image — the real photo provided for this section (a
                merchant at her own checkout counter, matching what POS Flow
                is actually for), with a subtle cinematic zoom (Ken Burns)
                and a single "Contact us" card anchored to the bottom-left
                corner — no separate email/button block in the text column. */}
            <div className="relative h-[420px] rounded-2xl overflow-hidden shadow-2xl">
              <motion.img
                src="/work-together-merchant.jpg"
                alt={t('pLanding.workTogether.photoAlt')}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
                initial={false}
                animate={heroReducedMotion ? { scale: 1 } : { scale: [1, 1.06, 1] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/40 via-transparent to-transparent" />

              <Link
                to="/contact"
                className="absolute bottom-5 left-5 inline-flex items-center gap-2.5 bg-white dark:bg-ink-800 text-ink-900 dark:text-white pl-3 pr-5 py-3 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
              >
                <span className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center">
                  <MessageCircle size={17} className="text-brand-600 dark:text-brand-400" />
                </span>
                <span className="font-semibold text-sm">{t('pLanding.workTogether.cta')}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* One connected platform section — a single dashboard-style mockup
          (not 4 disconnected cards), matching the requested reference
          layout: app chrome, KPI row, chart + top-stores row. Every figure
          is a clearly illustrative example built from POS Flow's real
          feature set (sales, staff day-sessions, multi-store, purchases) —
          no fictional kitchen orders, no loyalty-points program, no named
          "customers" standing in for real testimonials. */}
      <section className="py-24 px-4 lg:px-8 bg-gray-50 dark:bg-ink-950 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl lg:text-5xl font-bold text-ink-900 dark:text-white mb-4">
              {t('pLanding.keepFlowing.title')}
            </h2>
            <p className="text-lg text-ink-600 dark:text-ink-400 max-w-2xl mx-auto">
              {t('pLanding.keepFlowing.subtitle')}
            </p>
          </div>

          {/* Dashboard window — the actual real POS Flow dashboard,
              screenshotted from the live app (not a recreated mockup), so
              every number and label here is exactly what a merchant really
              sees after logging in. */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-[20px] bg-gradient-to-r from-brand-500/30 via-flow-500/20 to-brand-500/30 blur-xl opacity-60" aria-hidden="true" />
            <div className="relative rounded-2xl border border-gray-200 dark:border-ink-700 shadow-2xl overflow-hidden">
              <img
                src="/dashboard-screenshot.png"
                alt={t('pLanding.keepFlowing.screenshotAlt')}
                loading="lazy"
                className="block w-full h-auto"
              />
            </div>
          </div>

          {/* Platform capabilities strip — real feature set, same entries
              as FEATURE_KEYS used elsewhere on this page
              (src/pages/modules/*), giving visible breadth alongside the
              real screenshot without inventing anything new. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {[
              { icon: Wallet, key: 'currencies' },
              { icon: Store, key: 'stores' },
              { icon: ShieldCheck, key: 'roles' },
              { icon: Search, key: 'barcode' },
              { icon: CreditCard, key: 'splitPayments' },
            ].map((cap) => (
              <span
                key={cap.key}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 dark:text-ink-300 bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-full px-3 py-1.5 shadow-sm"
              >
                <cap.icon size={12} className="text-brand-600 dark:text-brand-400" />
                {t(`pLanding.keepFlowing.capability.${cap.key}`)}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 text-center">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 text-white rounded-full font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/30"
            >
              {t('pLanding.keepFlowing.cta')} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer — always dark (not light/dark-toggled like the rest of the
          page) for a deliberate "premium" close to the page, matching the
          video-hero sections above. Added a brand column (logo, one-line
          description already used elsewhere on this page, and the two real
          support addresses) beside the existing four link columns, plus a
          subtle top gradient line and ambient glow consistent with the
          "high-tech" treatment used in the hero. Nothing in the four
          existing link columns was removed or reordered. */}
      <footer className="relative overflow-hidden bg-ink-950 border-t border-white/10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_15%_0%,rgba(46,140,102,0.12),transparent)]" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 py-16 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo-pos-icon.png" alt="" className="w-8 h-8 rounded-lg" />
                <span className="text-lg font-semibold tracking-tight text-white">POS Flow</span>
              </div>
              <p className="text-sm text-ink-400 mb-5 max-w-[220px]">
                {t('pLanding.footer.tagline')}
              </p>
              <div className="space-y-1.5 text-sm">
                <a href="mailto:support@liafrik.com" className="block text-ink-300 hover:text-brand-400 transition">support@liafrik.com</a>
                <a href="mailto:cs@liafrik.com" className="block text-ink-300 hover:text-brand-400 transition">cs@liafrik.com</a>
              </div>
            </div>
            <div>
              <p className="font-semibold text-white mb-4">{t('pLanding.footer.product')}</p>
              <ul className="space-y-2 text-sm text-ink-400">
                <li><a href="#features" className="hover:text-brand-400 transition">{t('pLanding.footer.features')}</a></li>
                <li><a href="#pricing" onClick={scrollToPricing} className="hover:text-brand-400 transition">{t('pLanding.nav.pricing')}</a></li>
                <li><Link to="/marketplace" className="hover:text-brand-400 transition">{t('pLanding.footer.marketplace')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white mb-4">{t('pLanding.footer.company')}</p>
              <ul className="space-y-2 text-sm text-ink-400">
                <li><Link to="/about" className="hover:text-brand-400 transition">{t('pLanding.footer.about')}</Link></li>
                <li><Link to="/careers" className="hover:text-brand-400 transition">{t('pLanding.footer.careers')}</Link></li>
                <li><Link to="/blog" className="hover:text-brand-400 transition">{t('pLanding.footer.blog')}</Link></li>
                <li><Link to="/contact" className="hover:text-brand-400 transition">{t('pLanding.footer.contact')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white mb-4">{t('pLanding.footer.resources')}</p>
              <ul className="space-y-2 text-sm text-ink-400">
                <li><Link to="/resources" className="hover:text-brand-400 transition">{t('pLanding.footer.resources')}</Link></li>
                <li><Link to="/help" className="hover:text-brand-400 transition">{t('pLanding.footer.help')}</Link></li>
                <li><Link to="/documentation" className="hover:text-brand-400 transition">{t('pLanding.footer.docs')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white mb-4">{t('pLanding.footer.legal')}</p>
              <ul className="space-y-2 text-sm text-ink-400">
                <li><Link to="/privacy" className="hover:text-brand-400 transition">{t('pLanding.footer.privacy')}</Link></li>
                <li><Link to="/terms" className="hover:text-brand-400 transition">{t('pLanding.footer.terms')}</Link></li>
                <li><Link to="/legal" className="hover:text-brand-400 transition">{t('pLanding.footer.legalNotice')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-ink-500">
              {t('pLanding.footer.rights', { year: new Date().getFullYear() })}
            </p>
            <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-sm text-ink-400 hover:text-brand-400 transition">
              {lang.toUpperCase()}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
