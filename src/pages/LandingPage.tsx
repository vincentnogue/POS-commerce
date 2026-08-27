import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  ShoppingCart, Boxes, FileText, Store, Globe, FileBarChart, Wallet, Users,
  ArrowRight, ArrowUpRight, Check, Star, Menu, X, Play, TrendingUp, Shield, Smartphone,
  Twitter, Linkedin, Facebook, Instagram, MapPin, Sparkles, Moon, Sun, Download, Zap, Gauge, Layers,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { COUNTRIES, CURRENCIES } from '../lib/localization';
import { useCookies } from '../lib/cookies';
import { useI18n, LANG_LABELS } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import { PLANS, TRIAL_DAYS } from '../lib/plans';
import { useTheme } from '../lib/theme';
import { useInstallPrompt } from '../lib/useInstallPrompt';

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const { formatNumber } = useI18n();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => formatNumber(Math.round(v)));
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (inView) {
      const controls = animate(count, to, { duration: 2, ease: 'easeOut' });
      const unsub = rounded.on('change', (v) => setDisplay(v));
      return () => { controls.stop(); unsub(); };
    }
  }, [inView, to]);

  return <span ref={ref}>{display}{suffix}</span>;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

function Section({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const FEATURES = [
  { icon: ShoppingCart, titleKey: 'landing.feature.pos.title', descKey: 'landing.feature.pos.desc' },
  { icon: Boxes, titleKey: 'landing.feature.stock.title', descKey: 'landing.feature.stock.desc' },
  { icon: FileText, titleKey: 'landing.feature.invoicing.title', descKey: 'landing.feature.invoicing.desc' },
  { icon: Store, titleKey: 'landing.feature.stores.title', descKey: 'landing.feature.stores.desc' },
  { icon: Globe, titleKey: 'landing.feature.currencies.title', descKey: 'landing.feature.currencies.desc' },
  { icon: FileBarChart, titleKey: 'landing.feature.reports.title', descKey: 'landing.feature.reports.desc' },
  { icon: Wallet, titleKey: 'landing.feature.accounting.title', descKey: 'landing.feature.accounting.desc' },
  { icon: Smartphone, titleKey: 'landing.feature.mobileMoney.title', descKey: 'landing.feature.mobileMoney.desc' },
  { icon: Users, titleKey: 'landing.feature.customers.title', descKey: 'landing.feature.customers.desc' },
  { icon: Users, titleKey: 'landing.feature.employees.title', descKey: 'landing.feature.employees.desc' },
];

const BENEFITS = [
  { icon: Zap, titleKey: 'landing.benefit.speed.title', descKey: 'landing.benefit.speed.desc' },
  { icon: Layers, titleKey: 'landing.benefit.simplicity.title', descKey: 'landing.benefit.simplicity.desc' },
  { icon: Shield, titleKey: 'landing.benefit.control.title', descKey: 'landing.benefit.control.desc' },
  { icon: TrendingUp, titleKey: 'landing.benefit.visibility.title', descKey: 'landing.benefit.visibility.desc' },
  { icon: Store, titleKey: 'landing.benefit.centralized.title', descKey: 'landing.benefit.centralized.desc' },
  { icon: Gauge, titleKey: 'landing.benefit.efficiency.title', descKey: 'landing.benefit.efficiency.desc' },
];

const TESTIMONIALS = [
  { name: 'Aïssatou Diallo', company: 'Boutique Sahel, Bamako', quoteKey: 'landing.testimonial.aissatou', initials: 'AD', tone: 'bg-action-500' },
  { name: 'Emmanuel Okonkwo', company: 'Okonkwo Stores, Lagos', quoteKey: 'landing.testimonial.emmanuel', initials: 'EO', tone: 'bg-brand-500' },
  { name: 'Fatou Ndiaye', company: 'Fatou Cosmetics, Dakar', quoteKey: 'landing.testimonial.fatou', initials: 'FN', tone: 'bg-flow-500' },
  { name: 'Larissa Stella', company: 'Stella Distribution, Yaoundé', quoteKey: 'landing.testimonial.larissa', initials: 'LS', tone: 'bg-success-600' },
];



export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { prefs } = useCookies();
  const { lang, setLang, t } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [showBanner, setShowBanner] = useState(false);
  const supportedCurrencies = ['XAF', 'XOF', 'NGN', 'KES', 'GHS', 'ZAR', 'MAD', 'EGP', 'USD', 'EUR', 'GBP', 'AED'];

  useEffect(() => {
    if (!prefs) {
      const timer = setTimeout(() => setShowBanner(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [prefs]);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-ink-800">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-ink-100 dark:border-ink-800 bg-white/85 dark:bg-ink-800/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <button onClick={() => scrollTo('features')} className="text-sm font-medium text-ink-700 dark:text-ink-200 hover:text-brand-600">{t('nav.features')}</button>
            <button onClick={() => scrollTo('africa')} className="text-sm font-medium text-ink-700 dark:text-ink-200 hover:text-brand-600">{t('nav.africa')}</button>
            <button onClick={() => scrollTo('pricing')} className="text-sm font-medium text-ink-700 dark:text-ink-200 hover:text-brand-600">{t('nav.pricing')}</button>
            <Link to="/pricing" className="text-sm font-medium text-ink-700 dark:text-ink-200 hover:text-brand-600">{t('nav.details')}</Link>
            <Link to="/about" className="text-sm font-medium text-ink-700 dark:text-ink-200 hover:text-brand-600">{t('nav.about')}</Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-ink-200 dark:border-ink-700 px-3 text-xs font-medium text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
            >
              {LANG_LABELS[lang]}<span className="text-ink-300">/</span>{LANG_LABELS[lang === 'fr' ? 'en' : 'fr' as Lang]}
            </button>
            <button
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
              aria-label={t('header.toggleTheme')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/login" className="text-sm font-medium text-ink-700 dark:text-ink-200 hover:text-brand-600">{t('nav.login')}</Link>
            <Link to="/signup" className="btn-primary">{t('nav.signup')}</Link>
          </div>
          <button onClick={() => setMenuOpen((v) => !v)} className="rounded-full p-2 text-ink-700 dark:text-ink-200 md:hidden">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-800 px-4 py-4 md:hidden"
          >
            <nav className="flex flex-col gap-3">
              <button onClick={() => scrollTo('features')} className="text-left text-sm font-medium text-ink-700 dark:text-ink-200">{t('nav.features')}</button>
              <button onClick={() => scrollTo('africa')} className="text-left text-sm font-medium text-ink-700 dark:text-ink-200">{t('nav.africa')}</button>
              <button onClick={() => scrollTo('pricing')} className="text-left text-sm font-medium text-ink-700 dark:text-ink-200">{t('nav.pricing')}</button>
              <Link to="/login" className="text-sm font-medium text-ink-700 dark:text-ink-200">{t('nav.login')}</Link>
              <button
                onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
                className="flex items-center gap-2 text-left text-sm font-medium text-ink-700 dark:text-ink-200"
              >
                {LANG_LABELS[lang]}<span className="text-ink-300">/</span>{LANG_LABELS[lang === 'fr' ? 'en' : 'fr' as Lang]}
              </button>
              <button onClick={toggleTheme} className="flex items-center gap-2 text-left text-sm font-medium text-ink-700 dark:text-ink-200">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? t('landing.theme.light') : t('landing.theme.dark')}
              </button>
              <Link to="/signup" className="btn-primary mt-2">{t('nav.freeTrial')}</Link>
            </nav>
          </motion.div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/60 via-white to-white dark:from-brand-900/20 dark:via-ink-900 dark:to-ink-900" />
        {/* Ambient floating gradient blobs for visual depth */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-700/20"
          animate={{ y: [0, 24, 0], x: [0, 16, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-40 h-80 w-80 rounded-full bg-flow-300/25 blur-3xl dark:bg-flow-700/15"
          animate={{ y: [0, -28, 0], x: [0, -18, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/3 -bottom-20 h-64 w-64 rounded-full bg-action-300/20 blur-3xl dark:bg-action-700/10"
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 dark:bg-brand-900/25 px-3 py-1.5 text-xs font-medium text-brand-700"
            >
              <Sparkles size={14} /> {t('landing.badge')}
            </motion.div>
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-5 text-5xl font-semibold leading-[0.98] tracking-tight text-ink-900 dark:text-ink-50 sm:text-6xl lg:text-7xl"
            >
              {t('landing.hero.title')} <span className="text-gradient-flow">{t('landing.hero.titleAccent')}</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 max-w-lg text-lg text-ink-600 dark:text-ink-300"
            >
              {t('landing.hero.desc')}
            </motion.p>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link to="/signup" className="btn-primary relative px-6 py-3 text-base overflow-hidden">
                <span className="absolute inset-0 -z-10 animate-pulse-glow rounded-full bg-brand-400/40 blur-md" />
                {t('landing.hero.cta')} <ArrowRight size={18} />
              </Link>
              <button onClick={() => scrollTo('features')} className="btn-ghost px-6 py-3 text-base">
                <Play size={16} /> {t('landing.hero.demo')}
              </button>
            </motion.div>
            {canInstall && (
              <button onClick={promptInstall} className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-500 dark:text-ink-400 transition hover:text-brand-600">
                <Download size={13} /> {t('landing.hero.install')}
              </button>
            )}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-8 flex items-center gap-6 text-sm text-ink-500 dark:text-ink-400"
            >
              <div className="flex items-center gap-2"><Check size={16} className="text-success-600" /> {t('landing.hero.noCard')}</div>
              <div className="flex items-center gap-2"><Check size={16} className="text-success-600" /> {t('landing.hero.setup')}</div>
            </motion.div>
          </div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="animate-float rounded-3xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-4 shadow-float">
              <div className="flex items-center gap-2 pb-3">
                <div className="h-3 w-3 rounded-full bg-error-500" />
                <div className="h-3 w-3 rounded-full bg-warning-500" />
                <div className="h-3 w-3 rounded-full bg-success-600" />
                <div className="ml-3 text-xs font-medium text-ink-400 dark:text-ink-500">app.posflow.africa/dashboard</div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { labelKey: 'landing.mock.monthRevenue', value: '$8,400', tone: 'bg-brand-100 dark:bg-brand-900/35 text-brand-700', icon: TrendingUp },
                  { labelKey: 'landing.mock.sales', value: '128', tone: 'bg-action-100 dark:bg-action-900/35 text-action-600', icon: ShoppingCart },
                  { labelKey: 'landing.mock.unpaid', value: '3', tone: 'bg-success-100 dark:bg-success-900/35 text-success-700', icon: FileText },
                  { labelKey: 'landing.mock.deliveries', value: '7', tone: 'bg-warning-100 dark:bg-warning-900/35 text-warning-600', icon: Store },
                ].map((s) => (
                  <div key={s.labelKey} className="rounded-2xl border border-ink-200 dark:border-ink-700 p-3">
                    <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full ${s.tone}`}>
                      <s.icon size={15} />
                    </div>
                    <p className="text-[10px] font-medium uppercase text-ink-500 dark:text-ink-400">{t(s.labelKey)}</p>
                    <p className="text-lg font-medium text-ink-900 dark:text-ink-50">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-ink-200 dark:border-ink-700 p-4">
                <p className="mb-3 text-xs font-medium text-ink-700 dark:text-ink-200">{t('landing.mock.weeklySales')}</p>
                <div className="flex items-end justify-between gap-2 h-32">
                  {[42, 65, 38, 80, 55, 90, 72].map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.8, delay: 0.6 + i * 0.08 }}
                        className="w-full rounded-t-md bg-gradient-to-t from-brand-300 to-flow-400"
                      />
                      <span className="text-[9px] text-ink-400 dark:text-ink-500">{t(`landing.mock.day${i}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -right-3 -top-3 hidden rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-3 py-2 text-xs font-medium text-ink-700 dark:text-ink-200 shadow-soft sm:block">
              <span className="text-success-600">+24%</span> {t('landing.mock.vsLastWeek')}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-ink-100 dark:border-ink-800 bg-brand-50/40 dark:bg-brand-900/25">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 lg:grid-cols-4 lg:px-8">
          {[
            { labelKey: 'landing.stats.countries', value: 54, suffix: '' },
            { labelKey: 'landing.stats.companies', value: 3200, suffix: '+' },
            { labelKey: 'landing.stats.transactions', value: 1250000, suffix: '+' },
            { labelKey: 'landing.stats.currencies', value: 16, suffix: '' },
          ].map((s) => (
            <div key={s.labelKey} className="text-center">
              <p className="text-3xl font-medium text-gradient-flow sm:text-4xl">
                <Counter to={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-600 dark:text-ink-300">{t(s.labelKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <Section className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-600">{t('landing.features.eyebrow')}</p>
          <h2 className="mt-2 text-3xl font-medium tracking-tight text-ink-900 dark:text-ink-50 sm:text-4xl">{t('landing.features.title')}</h2>
          <p className="mt-3 text-ink-600 dark:text-ink-300">{t('landing.features.desc')}</p>
        </Section>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Section key={f.titleKey} delay={(i % 4) * 0.08}>
              <div className="group relative h-full rounded-2xl2 border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-6 transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-float">
                {i === 0 && (
                  <span className="absolute right-5 top-5 rounded-full bg-brand-50 dark:bg-brand-900/35 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-brand-600">
                    {t('landing.features.posBadge')}
                  </span>
                )}
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-900/25 text-brand-600 transition group-hover:bg-brand-100 dark:group-hover:bg-brand-900/35">
                  <f.icon size={22} />
                </div>
                <h3 className="flex items-center gap-1.5 text-lg font-medium text-ink-900 dark:text-ink-50">
                  {t(f.titleKey)}
                  <ArrowUpRight size={15} className="text-ink-300 opacity-0 transition-all -translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-brand-500 group-hover:opacity-100" />
                </h3>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{t(f.descKey)}</p>
              </div>
            </Section>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-ink-50/60 dark:bg-ink-900/40 py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <Section className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-brand-600">{t('landing.benefits.eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-medium tracking-tight text-ink-900 dark:text-ink-50 sm:text-4xl">{t('landing.benefits.title')}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t('landing.benefits.desc')}</p>
          </Section>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <Section key={b.titleKey} delay={(i % 3) * 0.08}>
                <div className="flex h-full items-start gap-4 rounded-2xl2 border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-5">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-flow-50 dark:bg-flow-900/25 text-flow-600">
                    <b.icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t(b.titleKey)}</h3>
                    <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t(b.descKey)}</p>
                  </div>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* Africa section */}
      <section id="africa" className="relative overflow-hidden bg-ink-900 py-20 text-white">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2 lg:px-8">
          <div>
            <Section>
              <p className="text-sm font-medium uppercase tracking-wide text-flow-400">{t('landing.africa.eyebrow')}</p>
              <h2 className="mt-2 text-3xl font-medium sm:text-4xl">{t('landing.africa.title')}</h2>
              <p className="mt-4 text-ink-300">
                {t('landing.africa.desc')}
              </p>
            </Section>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { icon: Globe, titleKey: 'landing.africa.countries.title', descKey: 'landing.africa.countries.desc' },
                { icon: Smartphone, titleKey: 'landing.africa.mobileMoney.title', descKey: 'landing.africa.mobileMoney.desc' },
                { icon: Globe, titleKey: 'landing.africa.languages.title', descKey: 'landing.africa.languages.desc' },
                { icon: Shield, titleKey: 'landing.africa.data.title', descKey: 'landing.africa.data.desc' },
                { icon: TrendingUp, titleKey: 'landing.africa.multiCurrency.title', descKey: 'landing.africa.multiCurrency.desc' },
                { icon: MapPin, titleKey: 'landing.africa.timezones.title', descKey: 'landing.africa.timezones.desc' },
              ].map((f, i) => (
                <Section key={f.titleKey} delay={i * 0.05}>
                  <div className="rounded-xl border border-ink-700 bg-ink-800 p-4">
                    <f.icon size={20} className="mb-2 text-flow-400" />
                    <p className="text-sm font-medium">{t(f.titleKey)}</p>
                    <p className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">{t(f.descKey)}</p>
                  </div>
                </Section>
              ))}
            </div>
          </div>

          {/* Africa map illustration with animated dots */}
          <Section delay={0.2}>
            <div className="relative mx-auto aspect-square max-w-md">
              <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full text-ink-700 dark:text-ink-200">
                <path
                  d="M200 60 C 240 60, 290 80, 310 120 C 330 160, 340 200, 330 250 C 320 300, 290 340, 250 360 C 210 380, 170 380, 130 360 C 90 340, 70 300, 70 250 C 70 200, 80 160, 110 120 C 140 80, 160 60, 200 60 Z"
                  fill="currentColor"
                  opacity="0.4"
                />
                <path
                  d="M200 60 C 240 60, 290 80, 310 120 C 330 160, 340 200, 330 250 C 320 300, 290 340, 250 360 C 210 380, 170 380, 130 360 C 90 340, 70 300, 70 250 C 70 200, 80 160, 110 120 C 140 80, 160 60, 200 60 Z"
                  fill="none"
                  stroke="#14B594"
                  strokeWidth="1.5"
                  opacity="0.6"
                />
              </svg>
              {[
                { x: '32%', y: '52%', name: 'Dakar' },
                { x: '40%', y: '40%', name: 'Bamako' },
                { x: '46%', y: '48%', name: 'Abidjan' },
                { x: '52%', y: '52%', name: 'Accra' },
                { x: '55%', y: '55%', name: 'Lagos' },
                { x: '55%', y: '38%', name: 'Yaoundé' },
                { x: '62%', y: '42%', name: 'Kinshasa' },
                { x: '66%', y: '58%', name: 'Nairobi' },
                { x: '72%', y: '48%', name: 'Addis' },
                { x: '58%', y: '28%', name: 'Le Caire' },
                { x: '45%', y: '72%', name: 'Johannesburg' },
                { x: '50%', y: '20%', name: 'Tunis' },
                { x: '40%', y: '30%', name: 'Casablanca' },
              ].map((p, i) => (
                <div key={p.name} className="absolute" style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}>
                  <span
                    className="block h-3 w-3 rounded-full bg-action-400 ring-2 ring-action-500/40"
                    style={{ animation: `pulse-dot 2s ease-in-out infinite ${i * 0.2}s` }}
                  />
                </div>
              ))}
              <div className="absolute inset-x-0 bottom-0 text-center">
                <p className="text-xs font-medium text-ink-400 dark:text-ink-500">{t('landing.africa.mapFootnote', { countries: String(COUNTRIES.length), currencies: String(supportedCurrencies.length) })}</p>
              </div>
            </div>
          </Section>
        </div>
        <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3 px-4">
          {supportedCurrencies.map((c) => (
            <span key={c} className="rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-xs font-medium text-ink-200">
              {CURRENCIES[c]?.symbol ?? c} · {c}
            </span>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <Section className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-600">{t('landing.pricing.eyebrow')}</p>
          <h2 className="mt-2 text-3xl font-medium tracking-tight text-ink-900 dark:text-ink-50 sm:text-4xl">{t('landing.pricing.title')}</h2>
          <p className="mt-3 text-ink-600 dark:text-ink-300">{t('landing.pricing.desc')}</p>
        </Section>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => (
            <Section key={p.code} delay={i * 0.08}>
              <div className={`relative h-full rounded-2xl2 border bg-white dark:bg-ink-800 p-6 ${p.highlight ? 'border-brand-300 shadow-float ring-1 ring-brand-200' : 'border-ink-200 dark:border-ink-700'}`}>
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white">{t('pricing.popular')}</span>
                )}
                <h3 className="text-lg font-medium text-ink-900 dark:text-ink-50">{p.name}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-medium text-ink-900 dark:text-ink-50">${p.priceMonthly}</span>
                  <span className="mb-1 text-sm text-ink-500 dark:text-ink-400">{t('pricing.perMonth')}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/25 px-2.5 py-1.5 text-xs font-medium text-brand-700">
                  <Sparkles size={12} /> {TRIAL_DAYS}j {t('pricing.trial')}
                </div>
                <ul className="mt-5 space-y-2.5">
                  {p.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-700 dark:text-ink-200">
                      <Check size={16} className="mt-0.5 shrink-0 text-brand-500" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`mt-6 w-full justify-center ${p.highlight ? 'btn-primary' : 'btn-ghost'}`}>
                  {t('pricing.tryFree')}
                </Link>
              </div>
            </Section>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
            {t('landing.pricing.viewDetails')} <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-brand-50/50 dark:bg-brand-900/25 py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <Section className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-brand-600">{t('landing.testimonials.eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-medium tracking-tight text-ink-900 dark:text-ink-50 sm:text-4xl">{t('landing.testimonials.title')}</h2>
          </Section>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((tm, i) => (
              <Section key={tm.name} delay={i * 0.08}>
                <div className="h-full rounded-2xl2 border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-6">
                  <div className="mb-3 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} size={16} className="fill-action-400 text-action-400" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-ink-700 dark:text-ink-200">« {t(tm.quoteKey)} »</p>
                  <div className="mt-5 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white ${tm.tone}`}>
                      {tm.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{tm.name}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400">{tm.company}</p>
                    </div>
                  </div>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="relative overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 via-brand-500 to-flow-500 py-20">
          <div className="mx-auto max-w-4xl px-4 text-center text-white lg:px-8">
            <Section>
              <h2 className="text-4xl font-semibold tracking-tight sm:text-6xl">{t('landing.cta.title')}</h2>
              <p className="mt-4 text-lg text-brand-50">{t('landing.cta.desc')}</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-ink-800 px-7 py-3.5 text-base font-medium text-brand-700 shadow-float transition hover:scale-105 active:scale-100">
                  {t('landing.cta.button')} <ArrowRight size={18} />
                </Link>
                <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-base font-medium text-white transition hover:bg-white/10">
                  {t('landing.cta.secondary')}
                </Link>
              </div>
            </Section>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-800">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">{t('landing.footer.tagline')}</p>
              <div className="mt-4 flex items-center gap-3 text-ink-400 dark:text-ink-500">
                <Twitter size={18} className="hover:text-brand-600" />
                <Linkedin size={18} className="hover:text-brand-600" />
                <Facebook size={18} className="hover:text-brand-600" />
                <Instagram size={18} className="hover:text-brand-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('landing.footer.product')}</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-500 dark:text-ink-400">
                <li><button onClick={() => scrollTo('features')} className="hover:text-brand-600">{t('nav.features')}</button></li>
                <li><Link to="/pricing" className="hover:text-brand-600">{t('nav.pricing')}</Link></li>
                <li><Link to="/login" className="hover:text-brand-600">{t('nav.login')}</Link></li>
                <li><Link to="/signup" className="hover:text-brand-600">{t('landing.footer.createAccount')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('footer.company')}</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-500 dark:text-ink-400">
                <li><Link to="/about" className="hover:text-brand-600">{t('nav.about')}</Link></li>
                <li><Link to="/blog" className="hover:text-brand-600">{t('nav.blog')}</Link></li>
                <li><Link to="/careers" className="hover:text-brand-600">{t('nav.careers')}</Link></li>
                <li><Link to="/contact" className="hover:text-brand-600">{t('nav.contact')}</Link></li>
                <li><Link to="/help" className="hover:text-brand-600">{t('nav.help')}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('footer.legal')}</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-500 dark:text-ink-400">
                <li><Link to="/privacy" className="hover:text-brand-600">{t('footer.privacy')}</Link></li>
                <li><Link to="/terms" className="hover:text-brand-600">{t('footer.terms')}</Link></li>
                <li><Link to="/legal" className="hover:text-brand-600">{t('footer.legalNotice')}</Link></li>
                <li><button onClick={() => setShowBanner(true)} className="hover:text-brand-600">{t('footer.cookies')}</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ink-100 dark:border-ink-800 pt-6 text-xs text-ink-400 dark:text-ink-500 sm:flex-row">
            <p>{t('landing.footer.rights', { year: String(new Date().getFullYear()) })}</p>
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-ink-200 dark:border-ink-700 px-3 text-xs font-medium text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
              aria-label={t('header.switchLanguage')}
            >
              {LANG_LABELS[lang]}<span className="text-ink-300">/</span>{LANG_LABELS[lang === 'fr' ? 'en' : 'fr' as Lang]}
            </button>
            <p>{t('landing.footer.bornInAfrica')}</p>
          </div>
        </div>
      </footer>

      {showBanner && <CookieInlineBanner onClose={() => setShowBanner(false)} />}
    </div>
  );
}

function CookieInlineBanner({ onClose }: { onClose: () => void }) {
  const { setPrefs } = useCookies();
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl2 border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-5 shadow-float"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-700 dark:text-ink-200">
          {t('landing.cookie.text')} <Link to="/privacy" className="font-medium text-brand-600 underline">{t('landing.cookie.policy')}</Link>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setPrefs({ necessary: true, analytics: false, marketing: false }); onClose(); }} className="rounded-full border border-ink-200 dark:border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-900">{t('landing.cookie.decline')}</button>
          <button onClick={() => { setPrefs({ necessary: true, analytics: true, marketing: true }); onClose(); }} className="btn-primary px-3 py-1.5 text-xs">{t('landing.cookie.accept')}</button>
        </div>
      </div>
    </motion.div>
  );
}
