import { useState, type SVGProps } from 'react';
import { Search, ChevronDown, BookOpen, Zap, Shield, Users, CreditCard, Globe, Check, X } from 'lucide-react';
import { PLANS, TRIAL_DAYS } from '../lib/plans';
import { useI18n } from '../lib/i18n';

interface FAQItem {
  id: string;
  categoryKey: string;
  questionKey: string;
  answerKey: string;
  answerVars?: Record<string, string>;
  icon?: typeof BookOpen;
}

// Fully bilingual now: every question/answer is a help.* i18n key (see
// locales/{fr,en}.ts) instead of hardcoded English text. Most of this
// content reuses the help.* keys that already existed in both locale
// files but were never wired to any component — this page is what they
// were written for. A few items (integrations, API, split payments,
// members-per-plan, deeper security detail) had no matching keys yet;
// those were added alongside this rewrite. Team member counts and plan
// names come from the real PLANS data (src/lib/plans.ts) via
// help.team.a3's {list} placeholder, so they can never drift out of sync
// with what Pricing/Settings actually offer.
function useFaqItems(t: (key: string, vars?: Record<string, string | number>) => string): FAQItem[] {
  const membersList = PLANS.map((p) => `${t(`plan.name.${p.code}`)}: ${p.maxUsers}`).join(' · ');
  return [
    { id: 'quickstart-1', categoryKey: 'help.cat.quickstart', questionKey: 'help.quickstart.q1', answerKey: 'help.quickstart.a1', answerVars: { days: String(TRIAL_DAYS) }, icon: Zap },
    { id: 'quickstart-2', categoryKey: 'help.cat.quickstart', questionKey: 'help.quickstart.q2', answerKey: 'help.quickstart.a2', icon: Zap },
    { id: 'quickstart-3', categoryKey: 'help.cat.quickstart', questionKey: 'help.quickstart.q3', answerKey: 'help.quickstart.a3', answerVars: { days: String(TRIAL_DAYS) }, icon: Zap },
    { id: 'pos-1', categoryKey: 'help.cat.pos', questionKey: 'help.pos.q1', answerKey: 'help.pos.a1', icon: CreditCard },
    { id: 'pos-2', categoryKey: 'help.cat.pos', questionKey: 'help.pos.q2', answerKey: 'help.pos.a2', icon: CreditCard },
    { id: 'pos-3', categoryKey: 'help.cat.pos', questionKey: 'help.pos.q3', answerKey: 'help.pos.a3', icon: CreditCard },
    { id: 'pos-4', categoryKey: 'help.cat.pos', questionKey: 'help.pos.q4', answerKey: 'help.pos.a4', icon: CreditCard },
    { id: 'stock-1', categoryKey: 'help.cat.stock', questionKey: 'help.stock.q1', answerKey: 'help.stock.a1', icon: BookOpen },
    { id: 'stock-2', categoryKey: 'help.cat.stock', questionKey: 'help.stock.q2', answerKey: 'help.stock.a2', icon: BookOpen },
    { id: 'stock-3', categoryKey: 'help.cat.stock', questionKey: 'help.stock.q3', answerKey: 'help.stock.a3', icon: BookOpen },
    { id: 'invoicing-1', categoryKey: 'help.cat.invoicing', questionKey: 'help.invoicing.q1', answerKey: 'help.invoicing.a1', icon: BookOpen },
    { id: 'invoicing-2', categoryKey: 'help.cat.invoicing', questionKey: 'help.invoicing.q2', answerKey: 'help.invoicing.a2', icon: BookOpen },
    { id: 'invoicing-3', categoryKey: 'help.cat.invoicing', questionKey: 'help.invoicing.q3', answerKey: 'help.invoicing.a3', icon: BookOpen },
    { id: 'subscription-1', categoryKey: 'help.cat.subscription', questionKey: 'help.subscription.q1', answerKey: 'help.subscription.a1', icon: CreditCard },
    { id: 'subscription-2', categoryKey: 'help.cat.subscription', questionKey: 'help.subscription.q2', answerKey: 'help.subscription.a2', icon: CreditCard },
    { id: 'subscription-3', categoryKey: 'help.cat.subscription', questionKey: 'help.subscription.q3', answerKey: 'help.subscription.a3', icon: CreditCard },
    { id: 'team-1', categoryKey: 'help.cat.team', questionKey: 'help.team.q1', answerKey: 'help.team.a1', icon: Users },
    { id: 'team-2', categoryKey: 'help.cat.team', questionKey: 'help.team.q2', answerKey: 'help.team.a2', icon: Users },
    { id: 'team-3', categoryKey: 'help.cat.team', questionKey: 'help.team.q3', answerKey: 'help.team.a3', answerVars: { list: membersList }, icon: Users },
    { id: 'security-1', categoryKey: 'help.cat.security', questionKey: 'help.security.q1', answerKey: 'help.security.a1', icon: Shield },
    { id: 'security-2', categoryKey: 'help.cat.security', questionKey: 'help.security.q2', answerKey: 'help.security.a2', icon: Shield },
    { id: 'security-3', categoryKey: 'help.cat.security', questionKey: 'help.security.q3', answerKey: 'help.security.a3', icon: Shield },
    { id: 'integrations-1', categoryKey: 'help.cat.integrations', questionKey: 'help.integrations.q1', answerKey: 'help.integrations.a1', icon: Globe },
    { id: 'api-1', categoryKey: 'help.cat.api', questionKey: 'help.api.q1', answerKey: 'help.api.a1', icon: Zap },
  ];
}

// BUG FIX: this page used to hardcode a dark gradient background with no
// `dark:` variants at all (`bg-gradient-to-br from-ink-950 via-brand-950
// to-ink-900`), so it ignored the app's light/dark toggle (see
// src/lib/theme.tsx, which drives a real `.dark` class on <html>) and
// always rendered dark, even in light mode. Every surface below now follows
// the same light-by-default / dark-as-override pattern used elsewhere in
// the app (see Sidebar.tsx: `bg-brand-50 dark:bg-ink-900`).
export function HelpCenterPage() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const faqItems = useFaqItems(t);

  const filteredFAQs = faqItems.filter((item) => {
    const question = t(item.questionKey);
    const answer = t(item.answerKey, item.answerVars);
    const matchesSearch =
      question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      answer.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !selectedCategory || item.categoryKey === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(faqItems.map((item) => item.categoryKey)));

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-ink-900">
      {/* Hero Section — same "ambient gradient + tech" treatment used on the
          main landing hero (radial glows + a faint schematic circuit motif,
          brand/flow colors, gentle pulse), instead of a flat two-color
          gradient. No stock photo/video needed here: it's a small header
          band, not a full-bleed section. */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-600 to-flow-600 py-16">
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_-10%,rgba(255,255,255,0.18),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_90%_110%,rgba(20,181,148,0.25),transparent)]" />
          <div className="absolute -top-10 -right-10 w-72 h-72 opacity-20 animate-pulse-slow">
            <svg viewBox="0 0 200 200" className="w-full h-full text-white">
              <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <circle cx="100" cy="100" r="55" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <circle cx="100" cy="100" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
              <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <line x1="100" y1="20" x2="100" y2="180" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </svg>
          </div>
        </div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">{t('help.title')}</h1>
          <p className="text-xl text-white/90">
            {t('help.hero.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400 dark:text-ink-500" />
            <input
              type="text"
              placeholder={t('help.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 text-ink-900 dark:text-ink-50 placeholder-ink-400 dark:placeholder-ink-500 focus:border-flow-500 focus:outline-none transition"
            />
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full font-medium transition ${
              !selectedCategory
                ? 'bg-flow-500 text-white'
                : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-700/50'
            }`}
          >
            {t('help.allCategories')}
          </button>
          {categories.map((categoryKey) => (
            <button
              key={categoryKey}
              onClick={() => setSelectedCategory(categoryKey)}
              className={`px-4 py-2 rounded-full font-medium transition ${
                selectedCategory === categoryKey
                  ? 'bg-flow-500 text-white'
                  : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-700/50'
              }`}
            >
              {t(categoryKey)}
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-16">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((item) => {
              const Icon = item.icon || BookOpen;
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 overflow-hidden transition shadow-soft"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-brand-50 dark:hover:bg-ink-700/50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-flow-500 dark:text-flow-400 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-ink-900 dark:text-ink-50">{t(item.questionKey)}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">{t(item.categoryKey)}</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-ink-400 dark:text-ink-500 transition transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-6 py-4 bg-brand-50/60 dark:bg-ink-900/40 border-t border-ink-200 dark:border-ink-700/50">
                      <p className="text-ink-700 dark:text-ink-200 leading-relaxed">{t(item.answerKey, item.answerVars)}</p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <SearchIcon className="w-12 h-12 text-ink-300 dark:text-ink-600 mx-auto mb-4" />
              <p className="text-ink-500 dark:text-ink-300">{t('help.noResultsSimple')}</p>
            </div>
          )}
        </div>

        {/* Plan comparison — renders the real PLANS array (src/lib/plans.ts)
            directly instead of a separately hand-typed table, so this can
            never drift out of sync with what Pricing/Settings actually
            offer again. Real per-plan limits (users/stores/products) shown
            first since those are the concrete, checkable facts; features
            listed below as a checklist union across all four plans. */}
        <div className="my-16 py-12 border-y border-ink-200 dark:border-ink-700">
          <h2 className="text-3xl font-bold text-ink-900 dark:text-white mb-4 text-center">{t('help.planLevels.title')}</h2>
          <p className="text-center text-ink-600 dark:text-ink-300 mb-8 max-w-2xl mx-auto">
            {t('help.planLevels.desc')}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 dark:border-ink-700">
                  <th className="text-left py-4 px-4 font-semibold text-ink-900 dark:text-white">&nbsp;</th>
                  {PLANS.map((p) => (
                    <th key={p.code} className="text-center py-4 px-4 font-semibold">
                      <div className="text-ink-600 dark:text-ink-300">{t(`plan.name.${p.code}`)}</div>
                      <div className="text-xs text-ink-500 dark:text-ink-400">${p.priceMonthly}/mo</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white dark:bg-ink-950">
                  <td className="py-3 px-4 text-ink-900 dark:text-ink-100 font-medium">{t('help.planLevels.teamMembers')}</td>
                  {PLANS.map((p) => (
                    <td key={p.code} className="text-center py-3 px-4 text-ink-700 dark:text-ink-200">{p.maxUsers}</td>
                  ))}
                </tr>
                <tr className="bg-ink-50/50 dark:bg-ink-900/30">
                  <td className="py-3 px-4 text-ink-900 dark:text-ink-100 font-medium">{t('help.planLevels.stores')}</td>
                  {PLANS.map((p) => (
                    <td key={p.code} className="text-center py-3 px-4 text-ink-700 dark:text-ink-200">{p.maxStores}</td>
                  ))}
                </tr>
                <tr className="bg-white dark:bg-ink-950">
                  <td className="py-3 px-4 text-ink-900 dark:text-ink-100 font-medium">{t('help.planLevels.products')}</td>
                  {PLANS.map((p) => (
                    <td key={p.code} className="text-center py-3 px-4 text-ink-700 dark:text-ink-200">{p.maxProducts.toLocaleString()}</td>
                  ))}
                </tr>
                {Array.from(new Set(PLANS.flatMap((p) => p.features))).map((feature, idx) => (
                  <tr key={feature} className={idx % 2 === 0 ? 'bg-white dark:bg-ink-950' : 'bg-ink-50/50 dark:bg-ink-900/30'}>
                    <td className="py-3 px-4 text-ink-900 dark:text-ink-100 font-medium">{t(`plan.feature.${feature}`)}</td>
                    {PLANS.map((p) => (
                      <td key={p.code} className="text-center py-3 px-4">
                        {p.features.includes(feature) ? (
                          <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-ink-300 dark:text-ink-600 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4">
            {PLANS.map((p, i) => {
              const palette = [
                { bg: 'bg-brand-50 dark:bg-ink-800', border: 'border-brand-200 dark:border-ink-700', title: 'text-brand-900 dark:text-white', text: 'text-brand-700 dark:text-brand-200', btn: 'bg-brand-600 hover:bg-brand-700' },
                { bg: 'bg-flow-50 dark:bg-ink-800', border: 'border-flow-200 dark:border-ink-700', title: 'text-flow-900 dark:text-white', text: 'text-flow-700 dark:text-flow-200', btn: 'bg-flow-600 hover:bg-flow-700' },
                { bg: 'bg-action-50 dark:bg-ink-800', border: 'border-action-200 dark:border-ink-700', title: 'text-action-900 dark:text-white', text: 'text-action-700 dark:text-action-200', btn: 'bg-action-600 hover:bg-action-700' },
                { bg: 'bg-gray-50 dark:bg-ink-800', border: 'border-gray-200 dark:border-ink-700', title: 'text-gray-900 dark:text-white', text: 'text-gray-700 dark:text-gray-200', btn: 'bg-gray-600 hover:bg-gray-700' },
              ][i % 4];
              const isLast = i === PLANS.length - 1;
              return (
                <div key={p.code} className={`p-6 rounded-lg ${palette.bg} border ${palette.border}`}>
                  <h3 className={`font-bold mb-2 ${palette.title}`}>{t(`plan.name.${p.code}`)} (${p.priceMonthly}/mo)</h3>
                  <p className={`text-sm mb-4 ${palette.text}`}>
                    {p.maxUsers} {t('help.planLevels.userPlural')} &middot; {p.maxStores} {t(p.maxStores > 1 ? 'help.planLevels.storePlural' : 'help.planLevels.storeSingular')}
                  </p>
                  <a
                    href={isLast ? '/contact' : '/signup'}
                    className={`inline-block px-4 py-2 rounded-full text-white text-sm font-medium transition ${palette.btn}`}
                  >
                    {isLast ? t('plan.landingCta.contactSales') : t('plan.landingCta.tryFree')}
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Section — the only two real customer-facing addresses. */}
        <div className="rounded-lg bg-gradient-to-r from-brand-500/10 to-flow-500/10 border border-brand-500/30 p-8">
          <h2 className="text-2xl font-bold text-ink-900 dark:text-white mb-6">{t('help.contact.title')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <a
              href="mailto:support@liafrik.com"
              className="p-4 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 hover:border-flow-500/50 transition"
            >
              <p className="font-semibold text-ink-900 dark:text-white mb-2">{t('help.contact.emailSupport')}</p>
              <p className="text-sm text-ink-600 dark:text-ink-300">support@liafrik.com</p>
            </a>

            <a
              href="mailto:cs@liafrik.com"
              className="p-4 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 hover:border-flow-500/50 transition"
            >
              <p className="font-semibold text-ink-900 dark:text-white mb-2">{t('help.contact.customerService')}</p>
              <p className="text-sm text-ink-600 dark:text-ink-300">cs@liafrik.com</p>
            </a>
          </div>
        </div>

        {/* Quick Links — only pages that actually exist in the app (see
            src/App.tsx routes). "Getting Started Guide" and "Security
            Policy" used to link to "#" (nowhere); removed rather than left
            as dead links. */}
        <div className="mt-12 rounded-lg bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 p-8 shadow-soft">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-6">{t('help.quickLinks.title')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { labelKey: 'help.quickLinks.documentation', href: '/documentation' },
              { labelKey: 'help.quickLinks.termsOfService', href: '/terms' },
              { labelKey: 'help.quickLinks.privacyPolicy', href: '/privacy' },
              { labelKey: 'help.quickLinks.pricing', href: '/pricing' },
              { labelKey: 'help.quickLinks.contactSales', href: '/contact' },
            ].map((link) => (
              <a
                key={link.labelKey}
                href={link.href}
                className="text-flow-600 dark:text-flow-300 hover:text-flow-500 dark:hover:text-flow-200 transition text-sm font-medium"
              >
                → {t(link.labelKey)}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
