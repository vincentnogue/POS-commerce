import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu, X, Globe, ChevronDown, ArrowRight, MapPin,
  ShoppingCart, Package, Store, Plug, FileText, BarChart3,
  ShieldCheck, Wallet, Check, CheckCircle2, Smartphone, TrendingUp, Receipt, Moon, Sun,
  Search, Coffee, Shirt, Sparkles, CreditCard, Banknote, Percent, Lock, Instagram,
  Facebook, Linkedin, Youtube,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useI18n } from '../lib/i18n';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { PricingCard, type PricingPlan } from '../components/PricingCard';
import { PLANS as REAL_PLANS } from '../lib/plans';

// Real feature set — every entry below maps to an actual module that ships
// in this app (see src/pages/modules/*), not aspirational copy. Titles/descriptions
// come from i18n (pLanding.feature.*) so the EN toggle translates this grid too.

// Sample data for the hero section's dashboard preview card (real
// recharts component, not live data — see PosLiveDemo below).
const REVENUE_TREND_SAMPLE = [
  { day: 'Lun', value: 1180 }, { day: 'Mar', value: 1420 }, { day: 'Mer', value: 1290 },
  { day: 'Jeu', value: 1610 }, { day: 'Ven', value: 1980 }, { day: 'Sam', value: 2260 },
  { day: 'Dim', value: 2450 },
];

// Multi-tab feature showcase — 8 tabs, each backed by a real shipped
// module. Bullet copy only ever names things that actually exist
// (checked against src/pages/modules/*): POSPage (barcode scan, split
// payment, staff-linked invoice), MarketplacePage (real live payment
// providers), StockPage (multi-store transfers), ReportsPage/
// DashboardPage (real charts), UsersPage (per-module role permissions,
// staff traceability — NOT payroll/attendance/recruiting, which this
// product does not have even though the reference photo for this tab
// happens to show that kind of UI), CustomersPage + store-credit
// returns, StoresPage (multi-location), and the real API docs.
const FEATURE_TABS = [
  { key: 'pos', image: '/feature-tabs/pos.jpg' },
  { key: 'payments', image: '/feature-tabs/payments.jpg' },
  { key: 'inventory', image: '/feature-tabs/inventory.jpg' },
  { key: 'analytics', image: '/feature-tabs/analytics.jpg' },
  { key: 'employees', image: '/feature-tabs/employees.jpg' },
  { key: 'crm', image: '/feature-tabs/crm.jpg' },
  { key: 'multistore', image: '/feature-tabs/multistore.jpg' },
  { key: 'integrations', image: '/feature-tabs/integrations.jpg' },
] as const;

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

function formatUSD(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================================
// HERO / CTA BACKGROUND VIDEOS — the only place to edit when real footage
// is ready. Two options:
//
//   A) You have real video files: put them in /public/videos/ (create that
//      folder) named e.g. hero-background.mp4 and cta-background.mp4, then
//      change the two `src:` values below to '/videos/hero-background.mp4'
//      and '/videos/cta-background.mp4'. Do the same for `poster:` with a
//      still frame image (or drop the poster line to use the video's own
//      first frame). No other code needs to change.
//
//   B) You have videos hosted elsewhere (YouTube, Vimeo, your own CDN):
//      replace `src:` with that direct .mp4 URL (must be a direct video
//      file link, not a YouTube watch-page URL — YouTube embeds need an
//      <iframe>, which this background-video treatment isn't built for).
//
// Real footage — 3 clips that autoplay in sequence for the main hero
// (see VideoCarousel below): each plays once, then hands off to the next,
// looping back to the first. 2 more clips do the same for the second/
// bottom hero band near the footer.
// Real, confirmed Instagram business handle (given directly by the
// business owner) — the "Follow us" section below links to
// https://instagram.com/<this, without the @>.
const INSTAGRAM_HANDLE = '@liafrik_tech';

const HERO_VIDEOS = [
  { src: '/videos/hero-1.mp4', poster: '/videos/hero-1-poster.jpg' },
  { src: '/videos/hero-2.mp4', poster: '/videos/hero-2-poster.jpg' },
  { src: '/videos/hero-3.mp4', poster: '/videos/hero-3-poster.jpg' },
];
const CTA_VIDEOS = [
  { src: '/videos/bottom-1.mp4', poster: '/videos/bottom-1-poster.jpg' },
  { src: '/videos/bottom-2.mp4', poster: '/videos/bottom-2-poster.jpg' },
];

// Plays a list of background videos back-to-back: each clip autoplays once
// (no native loop), and on its 'ended' event we advance to the next clip,
// wrapping back to the first — a lightweight after-play carousel with no
// extra deps. Falls back to the first clip's poster frame (fully static)
// for users who prefer reduced motion, same as the previous single-video
// behavior.
// lucide-react has no TikTok glyph — this is the one social icon in the
// footer that needs a hand-drawn SVG. Sized and colored (currentColor) to
// drop into the same row as the lucide icons (Facebook/Instagram/Linkedin/
// Youtube) without looking out of place.
function TikTokIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.62h-3.1v13.44a2.59 2.59 0 0 1-4.66 1.55 2.59 2.59 0 0 1 2.07-4.14c.28 0 .55.04.8.12V9.98a5.7 5.7 0 0 0-.8-.06 5.72 5.72 0 1 0 5.72 5.72V8.6a8.7 8.7 0 0 0 5.07 1.62V7.13a5.62 5.62 0 0 1-3.7-1.31Z" />
    </svg>
  );
}

function VideoCarousel({ videos, className, reducedMotion }: { videos: { src: string; poster: string }[]; className?: string; reducedMotion: boolean }) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const el = videoRef.current;
    if (!el) return;
    el.load();
    el.play().catch(() => {});
  }, [index, reducedMotion]);

  if (reducedMotion) {
    return <img src={videos[0].poster} alt="" className={className} />;
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      poster={videos[index].poster}
      className={className}
      onEnded={() => setIndex((i) => (i + 1) % videos.length)}
    >
      <source src={videos[index].src} type="video/mp4" />
    </video>
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

      {/* Main POS panel — deliberately translucent ("frosted glass") rather
          than a flat opaque card: this sits directly over the hero's
          background video, and an opaque panel here was hiding most of
          the footage on the right side (the only part not already
          darkened by the left-side legibility gradient). Heavy blur
          keeps every number/line fully legible over any frame of video,
          while still letting the motion show through. */}
      <div className="relative rounded-3xl border border-ink-700/80 bg-ink-900/55 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
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
            className={`mt-3 w-full rounded-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
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

// Plan descriptions and CTA copy are i18n keys (plan.landingDesc.*), not
// literal text — see buildLandingPlans() below, called from inside the
// component where t() is available. PLAN_DESCRIPTION_KEYS just maps a
// plan code to which description key it uses.
const PLAN_DESCRIPTION_KEYS: Record<string, string> = {
  starter: 'plan.landingDesc.starter',
  pro: 'plan.landingDesc.pro',
  premium: 'plan.landingDesc.premium',
  entreprise: 'plan.landingDesc.entreprise',
};

function buildLandingPlans(t: (key: string) => string): PricingPlan[] {
  return REAL_PLANS.map((p) => ({
    id: p.code,
    name: t(`plan.name.${p.code}`),
    description: t(PLAN_DESCRIPTION_KEYS[p.code] ?? ''),
    basePrice: p.priceMonthly,
    features: p.features.slice(0, 6).map((f) => ({ name: t(`plan.feature.${f}`), included: true })),
    cta: p.code === 'entreprise'
      ? { text: t('plan.landingCta.contactSales'), href: '/contact' }
      : { text: t('plan.landingCta.tryFree'), href: '/signup' },
    popular: p.popular,
    badge: p.popular ? t('plan.landingBadge.mostPopular') : undefined,
  }));
}

// Cycles a grid tile through a small set of real provider logos — one
// visible at a time, crossfading to the next on an interval. Used to pack
// many real integration logos into a compact grid without needing one
// tile per provider (space-efficient "changes side, shows another logo"
// effect requested for the integrations showcase).
function RotatingLogoTile({ providers, delayMs = 0 }: { providers: EcosystemProvider[]; delayMs?: number }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (providers.length <= 1) return;
    const start = setTimeout(() => {
      const id = setInterval(() => setIndex((i) => (i + 1) % providers.length), 3200);
      return () => clearInterval(id);
    }, delayMs);
    return () => clearTimeout(start);
  }, [providers.length, delayMs]);

  const provider = providers[index % providers.length];
  if (!provider) return null;

  return (
    <div className="relative aspect-square rounded-2xl bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 shadow-sm flex items-center justify-center p-4 overflow-hidden">
      <img
        key={provider.provider_key}
        src={provider.logo_url}
        alt={provider.provider_name}
        title={provider.provider_name}
        loading="lazy"
        className="max-h-[70%] max-w-[70%] object-contain animate-[fadein_0.5s_ease-in-out]"
      />
    </div>
  );
}

// Product catalog for the "Let's get busy" POS checkout mockup (a purely
// decorative visual, not live data) — names go through i18n
// (pLanding.busyHero.mockup.*) same as everything else; prices are display
// text only (fake demo receipt), not real currency conversion.
const MOCKUP_PRODUCTS = [
  { key: 'water', labelKey: 'productWater', price: '$1.50', icon: Coffee, tint: 'from-sky-100 to-sky-50 text-sky-600' },
  { key: 'almonds', labelKey: 'productAlmonds', price: '$4.20', icon: Package, tint: 'from-amber-100 to-amber-50 text-amber-600' },
  { key: 'tote', labelKey: 'productTote', price: '$8.00', icon: Shirt, tint: 'from-brand-100 to-brand-50 text-brand-600' },
  { key: 'mug', labelKey: 'productMug', price: '$6.50', icon: Coffee, tint: 'from-flow-100 to-flow-50 text-flow-600' },
  { key: 'notebook', labelKey: 'productNotebook', price: '$3.10', icon: FileText, tint: 'from-violet-100 to-violet-50 text-violet-600' },
  { key: 'candle', labelKey: 'productCandle', price: '$9.90', icon: Sparkles, tint: 'from-rose-100 to-rose-50 text-rose-600' },
];
const MOCKUP_CART_LINES = [
  { key: 'almonds', labelKey: 'productAlmonds', qty: 1, price: '$4.20' },
  { key: 'tote', labelKey: 'productTote', qty: 1, price: '$8.00' },
  { key: 'mug', labelKey: 'productMug', qty: 1, price: '$6.50' },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState(0);
  const [email, setEmail] = useState('');
  const { lang, setLang, t } = useI18n();
  useDocumentMeta(t('seo.landing.title'), t('seo.landing.desc'));
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const heroReducedMotion = usePrefersReducedMotion();
  const [ecosystemProviders, setEcosystemProviders] = useState<EcosystemProvider[]>([]);
  const landingPlans = useMemo(() => buildLandingPlans(t), [t]);

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

              <a href="#pricing" onClick={scrollToPricing} className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">{t('pLanding.nav.pricing')}</a>

              <Link to="/about" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">{t('pLanding.nav.about')}</Link>

              <Link to="/contact" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">{t('pLanding.nav.contact')}</Link>

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
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              aria-label={menuOpen ? t('pLanding.nav.closeMenu') : t('pLanding.nav.openMenu')}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {menuOpen && (
            <motion.div
              id="landing-mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-ink-700 space-y-3"
            >
              <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.footer.features')}</a>
              <Link to="/marketplace" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.productsMarketplace')}</Link>
              <a href="#pricing" onClick={scrollToPricing} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.pricing')}</a>
              <Link to="/about" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.about')}</Link>
              <Link to="/contact" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.contact')}</Link>
              <Link to="/documentation" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.docs')}</Link>
              <Link to="/blog" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.footer.blog')}</Link>
              <Link to="/resources" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.resources')}</Link>
              <Link to="/help" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.help')}</Link>
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
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">{t('pLanding.nav.login')}</Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)} className="block w-full px-6 py-2 bg-brand-600 text-white rounded-full font-medium text-center">{t('pLanding.nav.cta')}</Link>
            </motion.div>
          )}
        </div>
      </header>

      {/* Hero Section — the product demo is the focal visual; video adds
          ambient motion behind it (muted, looped, no controls) */}
      <section className="relative bg-ink-950 overflow-hidden">
        {/* Background video layer — 3 real clips in HERO_VIDEOS near the
            top of this file, playing in sequence via VideoCarousel. Full
            opacity + a left-to-right gradient (not a flat tint) so the
            footage stays genuinely visible on the right/demo side, with
            just enough darkening on the left/text side for legibility.
            Falls back to a static poster frame for reduced-motion users
            instead of autoplaying. */}
        <div className="absolute inset-0" aria-hidden="true">
          <VideoCarousel
            videos={HERO_VIDEOS}
            reducedMotion={heroReducedMotion}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950/80 via-ink-950/45 to-ink-950/15" />
        </div>

        {/* Fine grid texture, layered above the video */}
        <div className="absolute inset-0" aria-hidden="true">
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
          <div className="flex w-max animate-[flagscroll_60s_linear_infinite] hover:[animation-play-state:paused] gap-4">
            {[...ecosystemProviders, ...ecosystemProviders].map((p, i) => (
              <div
                key={`${p.provider_key}-${i}`}
                className="flex items-center gap-3 h-[62px] min-w-[168px] px-6 rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800 shadow-sm shrink-0"
              >
                <img src={p.logo_url} alt="" loading="lazy" className="h-8 w-auto max-w-[92px] object-contain" />
                <span className="text-sm font-semibold text-gray-700 dark:text-ink-200 whitespace-nowrap">{p.provider_name}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
              {t('pLanding.ecosystem.cta')} <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}

      {/* Real, verifiable stats only. 1,893+ active clients is a confirmed,
          sourced figure (per business owner, 2026-09-01) — update this
          number as it changes, never let it go stale or become a guess.
          30 currencies (src/lib/currency.ts, CURRENCY_CONFIG) and 12
          payment processors (category='payments' rows in the seeded
          integration_providers migrations) are both counted directly from
          actual code/data, not estimated — recount both whenever a
          currency or payment provider is added/removed so this stays
          accurate. */}
      <section className="bg-gray-50 dark:bg-ink-900 py-12 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                <CountUp value={1893} suffix="+" />
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('pLanding.stats.clients')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                <CountUp value={30} />
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('pLanding.stats.currencies')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                <CountUp value={12} suffix="+" />
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

      {/* Features — real module icons in a slow, pausable auto-scroll
          banner instead of a static 4-column grid. Same infinite-marquee
          technique as the flags/logos bands above (render the list twice,
          translate exactly -50% so the loop is seamless): saves vertical
          space versus one row per module and reads as a lively "everything
          included" strip. Each card still links straight to its module's
          detail in the tabbed showcase below via an anchor, and the full
          title/description stays available on hover/focus so nothing is
          lost versus the old grid — just presented more compactly. */}
      <section id="features" className="py-20 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="text-center mb-14 px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('pLanding.features.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('pLanding.features.desc')}
          </p>
        </div>

        <div
          className="flex w-max gap-5 animate-[flagscroll_38s_linear_infinite] hover:[animation-play-state:paused] px-4"
          role="list"
        >
          {[...FEATURE_KEYS, ...FEATURE_KEYS].map((f, i) => (
            <div
              key={`${f.key}-${i}`}
              role="listitem"
              aria-hidden={i >= FEATURE_KEYS.length}
              className="group w-64 shrink-0 rounded-xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 hover:border-brand-500/50 hover:shadow-lg transition"
            >
              <div className="w-11 h-11 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4 transition group-hover:bg-brand-500/20">
                <f.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t(`pLanding.feature.${f.key}.title`)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t(`pLanding.feature.${f.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Technology partners — "meet your customers wherever they shop"
          style layout (photo left, badge/heading/copy right), matching the
          requested reference design. No named partner logos here — those
          (Sellia, OpenAI) belong on the Marketplace page where they're
          real, connectable providers; this section stays generic so it
          never gets ahead of what's actually shown there. */}
      <section className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <img
              src="/sections/retail-store.jpg"
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <span className="inline-block text-xs font-bold tracking-widest text-brand-600 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-300 rounded-full px-4 py-1.5 mb-5">
              {t('pLanding.techPartners.badge')}
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-5">
              {t('pLanding.techPartners.title')}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              {t('pLanding.techPartners.desc')}
            </p>
            <Link to="/marketplace" className="inline-flex items-center gap-2 font-semibold text-brand-600 hover:text-brand-700">
              {t('pLanding.techPartners.cta')} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Integrations showcase — "connect to the tools you already use"
          style layout (badge/heading/copy left, icon grid right), matching
          the requested reference design. Reuses the same live
          integration_providers data as the ecosystem strip above the fold
          (never invents providers) — packed into a compact grid where each
          tile cycles through several real logos (RotatingLogoTile) instead
          of listing one tile per provider, to keep the grid small. Only
          rendered once real data has loaded, same guard as the strip. */}
      {ecosystemProviders.length > 0 && (
        <section className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block text-xs font-bold tracking-widest text-brand-600 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-300 rounded-full px-4 py-1.5 mb-5">
                {t('pLanding.ecosystem.heading')}
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-5">
                {t('pLanding.integrationsGrid.title')}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                {t('pLanding.integrationsGrid.desc')}
              </p>
              <Link to="/marketplace" className="inline-flex items-center gap-2 font-semibold text-brand-600 hover:text-brand-700">
                {t('pLanding.integrationsGrid.cta')} <ArrowRight size={18} />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: Math.min(16, Math.max(8, ecosystemProviders.length)) }).map((_, tileIndex) => {
                // Round-robin: each tile owns every Nth provider (N = tile
                // count) so tiles cycle through different logos, not the
                // same one in sync.
                const tileCount = Math.min(16, Math.max(8, ecosystemProviders.length));
                const tileProviders = ecosystemProviders.filter((_, i) => i % tileCount === tileIndex);
                if (tileProviders.length === 0) return null;
                return (
                  <RotatingLogoTile
                    key={tileIndex}
                    providers={tileProviders}
                    delayMs={tileIndex * 350}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Industries teaser — links to the real dedicated page
          (IndustrySolutionsPage) rather than duplicating its content here.
          Only the 3 verticals that page actually documents today (post
          restaurant-claims cleanup). No hardware teaser: POS Flow does not
          sell/support physical hardware today, so a hardware CTA here would
          be a false claim. */}
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
            { icon: '/icon-shop-now.png', key: 'retail' },
            { icon: '/icon-scissors.png', key: 'services' },
            { icon: '/icon-professional-services.png', key: 'professional' },
          ].map((ind) => (
            <Link
              key={ind.key}
              to="/industry-solutions"
              className="group rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-7 hover:border-brand-500/50 hover:shadow-lg transition"
            >
              <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center mb-4">
                <img src={ind.icon} alt="" className="w-6 h-6 object-contain" style={{ filter: 'invert(35%) sepia(70%) saturate(500%) hue-rotate(190deg) brightness(95%)' }} />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5">{t(`pLanding.industries.${ind.key}.title`)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{t(`pLanding.industries.${ind.key}.desc`)}</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 dark:border-brand-800 px-3 py-1 text-sm font-medium text-brand-600 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/20 transition-all">
                {t('pLanding.industries.link')} <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Multi-tab feature showcase — 8 tabs matching the requested
          reference layout (tab bar on top, image left / copy right below).
          Each tab's bullet list only names real, shipped features. */}
      <section className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl lg:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          {t('pLanding.featureTabs.title')}
        </h2>
        <p className="text-center text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10">
          {t('pLanding.featureTabs.subtitle')}
        </p>

        {/* Tab bar */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 border-b border-gray-200 dark:border-ink-800 mb-12">
          {FEATURE_TABS.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setActiveFeatureTab(i)}
              className={`relative pb-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeFeatureTab === i
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {t(`pLanding.featureTabs.${tab.key}.tabLabel`)}
              {activeFeatureTab === i && (
                <motion.span layoutId="featureTabUnderline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 dark:bg-brand-400" />
              )}
            </button>
          ))}
        </div>

        {/* Active tab content */}
        <motion.div
          key={activeFeatureTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-ink-700 shadow-xl bg-white">
            <img
              src={FEATURE_TABS[activeFeatureTab].image}
              alt={t(`pLanding.featureTabs.${FEATURE_TABS[activeFeatureTab].key}.tabLabel`)}
              className="w-full h-auto object-contain"
            />
          </div>
          <div>
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t(`pLanding.featureTabs.${FEATURE_TABS[activeFeatureTab].key}.title`)}
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
              {t(`pLanding.featureTabs.${FEATURE_TABS[activeFeatureTab].key}.desc`)}
            </p>
            <ul className="space-y-3 mb-6">
              {(['point1', 'point2', 'point3', 'point4'] as const).map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300">
                  <Check className="w-5 h-5 text-brand-600 dark:text-brand-400 mt-0.5 flex-shrink-0" />
                  {t(`pLanding.featureTabs.${FEATURE_TABS[activeFeatureTab].key}.${p}`)}
                </li>
              ))}
            </ul>
            <Link
              to={FEATURE_TABS[activeFeatureTab].key === 'integrations' ? '/marketplace' : '/signup'}
              className="inline-flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-semibold hover:gap-2.5 transition-all"
            >
              {t(`pLanding.featureTabs.${FEATURE_TABS[activeFeatureTab].key}.cta`)} <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
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
            {landingPlans.map((plan) => (
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
        <div className="flex w-max animate-[flagscroll_75s_linear_infinite] hover:[animation-play-state:paused] gap-5">
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
      <section className="relative overflow-hidden">
        <div className="relative">
          {/* Right-side gradient backdrop (spans full width, dark panel sits on top of it on the left) */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-800 via-flow-600 to-flow-400" />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 min-h-[560px] max-w-[1800px] mx-auto">
            {/* Dark content panel */}
            <div className="relative bg-brand-900/95 px-6 sm:px-10 lg:px-16 py-14 lg:py-20 flex flex-col justify-center">
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

            {/* Device mockup panel — a realistic POS checkout screen: search
                bar, category tabs, an icon-coded product grid, and a full
                cart panel with line items, tax and payment methods. Mirrors
                the real checkout layout in POSPage.tsx, no stock photo. */}
            <div className="relative hidden lg:flex items-center justify-center p-4 overflow-hidden">
              <div className="relative w-full" style={{ transform: 'perspective(1400px) rotateY(-10deg) rotateX(2deg)' }}>
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
                        <span className="text-[8px] text-gray-400">{t('pLanding.busyHero.mockup.searchPlaceholder')}</span>
                      </div>
                      {/* Category tabs */}
                      <div className="flex gap-1.5 mb-2.5">
                        {[
                          { labelKey: 'catAll', active: true },
                          { labelKey: 'catDrinks', active: false },
                          { labelKey: 'catSnacks', active: false },
                          { labelKey: 'catHome', active: false },
                        ].map((cat) => (
                          <span
                            key={cat.labelKey}
                            className={`text-[8px] font-semibold px-2 py-1 rounded-full ${cat.active ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                          >
                            {t(`pLanding.busyHero.mockup.${cat.labelKey}`)}
                          </span>
                        ))}
                      </div>
                      {/* Product grid */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {MOCKUP_PRODUCTS.map((p) => (
                          <div key={p.key} className="rounded-lg bg-white border border-gray-100 p-1.5 shadow-sm">
                            <div className={`h-7 rounded-md bg-gradient-to-br ${p.tint} flex items-center justify-center mb-1`}>
                              <p.icon size={11} strokeWidth={2} />
                            </div>
                            <p className="text-[6.5px] font-medium text-ink-700 leading-tight truncate">{t(`pLanding.busyHero.mockup.${p.labelKey}`)}</p>
                            <p className="text-[7.5px] font-bold text-brand-600">{p.price}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: cart */}
                    <div className="flex-1 bg-ink-950 p-3.5 flex flex-col">
                      <p className="text-[8px] font-semibold text-white/50 tracking-wide mb-2">{t('pLanding.busyHero.mockup.currentSale')}</p>
                      <div className="space-y-1.5 mb-2.5 flex-1">
                        {MOCKUP_CART_LINES.map((line) => (
                          <div key={line.key} className="flex items-center justify-between">
                            <span className="text-[7.5px] text-white/80 truncate">{line.qty}× {t(`pLanding.busyHero.mockup.${line.labelKey}`)}</span>
                            <span className="text-[7.5px] font-semibold text-white">{line.price}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/10 pt-2 space-y-1 mb-2.5">
                        <div className="flex items-center justify-between text-[7px] text-white/50">
                          <span className="flex items-center gap-1"><Percent size={8} /> {t('pLanding.busyHero.mockup.tax')}</span>
                          <span>$0.00</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold text-white">{t('pLanding.busyHero.mockup.total')}</span>
                          <span className="text-lg font-bold text-flow-400">$18.70</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <div className="flex-1 flex items-center justify-center gap-1 bg-white/10 rounded-md py-1.5">
                          <Banknote size={10} className="text-flow-400" />
                          <span className="text-[7px] font-medium text-white/80">{t('pLanding.busyHero.mockup.cash')}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center gap-1 bg-flow-500 rounded-md py-1.5">
                          <CreditCard size={10} className="text-white" />
                          <span className="text-[7px] font-medium text-white">{t('pLanding.busyHero.mockup.card')}</span>
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

      {/* Second hero — full video-backed CTA band before the footer.
          2 real clips in CTA_VIDEOS near the top of this file, playing
          in sequence via VideoCarousel. */}
      <section className="relative bg-ink-950 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <VideoCarousel
            videos={CTA_VIDEOS}
            reducedMotion={heroReducedMotion}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_65%_at_50%_50%,rgba(14,18,14,0.72),rgba(14,18,14,0.3)_65%,rgba(14,18,14,0.1)_100%)]" />
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
      <section className="py-20 px-4 lg:px-8 bg-white dark:bg-ink-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold text-ink-900 dark:text-white mb-6 leading-tight">
                {t('pLanding.workTogether.title')}
              </h2>
              <p className="text-lg text-ink-700 dark:text-ink-300 mb-8 leading-relaxed whitespace-pre-line">
                {t('pLanding.workTogether.desc')}
              </p>

              <div className="space-y-4 mb-8">
                {(['assessment', 'recommendation', 'support'] as const).map((key) => (
                  <div key={key} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 mt-1 text-white text-sm font-bold">✓</div>
                    <div>
                      <p className="font-semibold text-ink-900 dark:text-white">{t(`pLanding.workTogether.point.${key}.title`)}</p>
                      <p className="text-sm text-ink-600 dark:text-ink-400">{t(`pLanding.workTogether.point.${key}.desc`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right image — real photo (was an emoji on a gradient
                placeholder). "Contact us" floats as a pill badge anchored at
                the photo's bottom-left corner — the only CTA for this
                section (no separate email block/button in the text column,
                to avoid repeating the same action twice). */}
            <div className="relative h-96 rounded-xl overflow-hidden shadow-xl group">
              <img
                src="/work-together-photo.jpg"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/50 via-transparent to-transparent" />
              <Link
                to="/contact"
                className="absolute bottom-6 left-6 inline-flex items-center gap-2 px-6 py-3 bg-white text-ink-900 rounded-full font-semibold shadow-lg shadow-black/20 transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105 animate-pulse-slow"
              >
                {t('pLanding.workTogether.cta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Keep things flowing section — the real dashboard, not mock cards.
          A previous version of this section showed four illustrative cards
          with made-up example figures ($2,450, "+32% vs yesterday",
          $1,000 -> 3,672.50 AED) as if they were live data; none of it came
          from an actual account. Replaced with an actual screenshot of the
          real, running dashboard (public/dashboard-screenshot.png). */}
      <section className="py-20 px-4 lg:px-8 bg-gray-50 dark:bg-ink-950 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-ink-900 dark:text-white mb-6 whitespace-pre-line">
            {t('pLanding.keepFlowing.title')}
          </h2>
          <p className="text-lg text-ink-600 dark:text-ink-300 mb-12 max-w-2xl mx-auto">
            {t('pLanding.keepFlowing.desc')}
          </p>

          {/* Real screenshot presented as a browser window (traffic-light
              dots + address bar showing the platform's actual domain)
              instead of a bare image — this both reads as a proper product
              shot rather than a flat cropped banner, and gives the very
              wide capture (native desktop resolution, ~2.3:1) some vertical
              weight so it doesn't look stretched thin at marketing-page
              width. The screenshot itself was also cropped to remove the
              dead gray margin that used to sit below the cards. */}
          <div className="mx-auto max-w-5xl rounded-2xl bg-[#172B3A] border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-error-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success-500/70" />
              </div>
              <div className="mx-auto flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1 text-xs text-white/60">
                <Lock size={11} /> pos.liafrik.com
              </div>
            </div>
            <img
              src="/dashboard-screenshot.png"
              alt={t('pLanding.keepFlowing.screenshotAlt')}
              className="w-full h-auto"
            />
          </div>

          {/* CTA */}
          <div className="mt-12">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 text-white rounded-full font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/30"
            >
              {t('pLanding.keepFlowing.cta')} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Instagram — "Follow us" band, not a live-fetched feed. The handle
          (@liafrik_tech) is real and confirmed by the business owner, but
          no Instagram Graph API access token is configured for this
          project yet, so this deliberately does NOT fabricate a grid of
          fake posts/photos — that would misrepresent content as real
          Instagram activity when it isn't. To turn this into an actual
          live feed once a Graph API token exists, replace this section
          with calls to the Instagram Graph API's /me/media endpoint
          server-side (never expose the token client-side) and render the
          real returned photos here. */}
      <section className="relative overflow-hidden bg-gradient-to-r from-brand-600 to-flow-600 py-16">
        <div className="absolute inset-0 bg-grid opacity-20" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 text-center lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs font-bold tracking-widest text-white">
            <Instagram size={14} /> {t('pLanding.instagram.badge')}
          </span>
          <h2 className="mt-5 text-2xl lg:text-3xl font-bold text-white">
            {t('pLanding.instagram.title')}
          </h2>
          <p className="mt-3 text-white/80">
            {t('pLanding.instagram.desc')}
          </p>
          <a
            href={`https://instagram.com/${INSTAGRAM_HANDLE.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-white/90"
          >
            <Instagram size={17} /> {t('pLanding.instagram.cta', { handle: INSTAGRAM_HANDLE })}
          </a>
        </div>
      </section>

      {/* Footer — always-dark "premium" treatment (independent of the
          site's light/dark toggle, like most SaaS marketing footers): a
          gradient accent hairline on top, a brand column with tagline,
          and a CTA pill button reusing the shared .btn-primary pill style
          from the audit below instead of a one-off rounded-full class. */}
      <footer className="relative overflow-hidden bg-ink-950">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/70 to-transparent" />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
            <div className="md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5">
                <img src="/logo-pos-icon.png" alt="POS Flow" className="h-9 w-9" />
                <span className="text-xl font-bold tracking-tight text-white">
                  POS <span className="text-brand-400">Flow</span>
                </span>
              </Link>
              <p className="mt-3 max-w-xs text-sm text-ink-400">
                {t('pLanding.footer.tagline')}
              </p>
              <Link to="/signup" className="btn-primary mt-6 inline-flex">
                {t('pLanding.nav.cta')}
              </Link>
            </div>

            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-200">{t('pLanding.footer.product')}</p>
              <ul className="space-y-2.5 text-sm text-ink-400">
                <li><a href="#features" className="transition hover:text-brand-400">{t('pLanding.footer.features')}</a></li>
                <li><a href="#pricing" onClick={scrollToPricing} className="transition hover:text-brand-400">{t('pLanding.nav.pricing')}</a></li>
                <li><Link to="/marketplace" className="transition hover:text-brand-400">{t('pLanding.footer.marketplace')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-200">{t('pLanding.footer.company')}</p>
              <ul className="space-y-2.5 text-sm text-ink-400">
                <li><Link to="/about" className="transition hover:text-brand-400">{t('pLanding.footer.about')}</Link></li>
                <li><Link to="/careers" className="transition hover:text-brand-400">{t('pLanding.footer.careers')}</Link></li>
                <li><Link to="/blog" className="transition hover:text-brand-400">{t('pLanding.footer.blog')}</Link></li>
                <li><Link to="/contact" className="transition hover:text-brand-400">{t('pLanding.footer.contact')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-200">{t('pLanding.footer.resources')}</p>
              <ul className="space-y-2.5 text-sm text-ink-400">
                <li><Link to="/resources" className="transition hover:text-brand-400">{t('pLanding.footer.resources')}</Link></li>
                <li><Link to="/help" className="transition hover:text-brand-400">{t('pLanding.footer.help')}</Link></li>
                <li><Link to="/documentation" className="transition hover:text-brand-400">{t('pLanding.footer.docs')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-200">{t('pLanding.footer.legal')}</p>
              <ul className="space-y-2.5 text-sm text-ink-400">
                <li><Link to="/privacy" className="transition hover:text-brand-400">{t('pLanding.footer.privacy')}</Link></li>
                <li><Link to="/terms" className="transition hover:text-brand-400">{t('pLanding.footer.terms')}</Link></li>
                <li><Link to="/refund-policy" className="transition hover:text-brand-400">{t('pLanding.footer.refundPolicy')}</Link></li>
                <li><Link to="/cookie-policy" className="transition hover:text-brand-400">{t('pLanding.footer.cookiePolicy')}</Link></li>
                <li><Link to="/acceptable-use" className="transition hover:text-brand-400">{t('pLanding.footer.acceptableUse')}</Link></li>
                <li><Link to="/sla" className="transition hover:text-brand-400">{t('pLanding.footer.sla')}</Link></li>
                <li><Link to="/legal" className="transition hover:text-brand-400">{t('pLanding.footer.legalNotice')}</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-6 border-t border-white/10 pt-8 sm:flex-row sm:justify-between">
            <p className="text-sm text-ink-500">
              {t('pLanding.footer.rightsPrefix', { year: new Date().getFullYear() })}
              <a href="https://liafrik.com" target="_blank" rel="noopener noreferrer" className="text-ink-400 underline transition hover:text-brand-400">
                LiAfrik
              </a>
              {t('pLanding.footer.rightsSuffix')}
            </p>

            {/* Real, official accounts only — every URL here is one the
                business owner gave directly, none guessed or templated. */}
            <div className="flex items-center gap-4">
              <a href="https://www.tiktok.com/@liyahgroup?_r=1&_t=ZS-9981XGgaxrE" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-ink-400 transition hover:text-brand-400">
                <TikTokIcon size={18} />
              </a>
              <a href="https://www.facebook.com/share/1LMAGqsy3n/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-ink-400 transition hover:text-brand-400">
                <Facebook size={18} />
              </a>
              <a href="https://www.instagram.com/liafrik_tech?igsi=eXBjdTc5NG42Zml4&utm_source=qr" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-ink-400 transition hover:text-brand-400">
                <Instagram size={18} />
              </a>
              <a href="https://www.linkedin.com/company/liafrik/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-ink-400 transition hover:text-brand-400">
                <Linkedin size={18} />
              </a>
              <a href="https://youtube.com/@liyah-n?si=D-lXwovYubw3sdaf" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-ink-400 transition hover:text-brand-400">
                <Youtube size={18} />
              </a>
            </div>

            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm text-ink-400 transition hover:border-brand-400/50 hover:text-brand-400"
            >
              <Globe size={14} /> {lang.toUpperCase()}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
