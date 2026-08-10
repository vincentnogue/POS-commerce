import { useState } from 'react';
import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';
import {
  Rocket, ShoppingCart, Boxes, FileText, CreditCard, Users, ShieldCheck,
  ChevronDown, MessageCircle,
} from 'lucide-react';

type Item = { qKey: string; aKey: string };
type Category = { icon: any; titleKey: string; items: Item[] };

const CATEGORIES: Category[] = [
  {
    icon: Rocket,
    titleKey: 'help.cat.quickstart',
    items: [
      { qKey: 'help.quickstart.q1', aKey: 'help.quickstart.a1' },
      { qKey: 'help.quickstart.q2', aKey: 'help.quickstart.a2' },
      { qKey: 'help.quickstart.q3', aKey: 'help.quickstart.a3' },
    ],
  },
  {
    icon: ShoppingCart,
    titleKey: 'help.cat.pos',
    items: [
      { qKey: 'help.pos.q1', aKey: 'help.pos.a1' },
      { qKey: 'help.pos.q2', aKey: 'help.pos.a2' },
      { qKey: 'help.pos.q3', aKey: 'help.pos.a3' },
    ],
  },
  {
    icon: Boxes,
    titleKey: 'help.cat.stock',
    items: [
      { qKey: 'help.stock.q1', aKey: 'help.stock.a1' },
      { qKey: 'help.stock.q2', aKey: 'help.stock.a2' },
      { qKey: 'help.stock.q3', aKey: 'help.stock.a3' },
    ],
  },
  {
    icon: FileText,
    titleKey: 'help.cat.invoicing',
    items: [
      { qKey: 'help.invoicing.q1', aKey: 'help.invoicing.a1' },
      { qKey: 'help.invoicing.q2', aKey: 'help.invoicing.a2' },
      { qKey: 'help.invoicing.q3', aKey: 'help.invoicing.a3' },
    ],
  },
  {
    icon: CreditCard,
    titleKey: 'help.cat.subscription',
    items: [
      { qKey: 'help.subscription.q1', aKey: 'help.subscription.a1' },
      { qKey: 'help.subscription.q2', aKey: 'help.subscription.a2' },
      { qKey: 'help.subscription.q3', aKey: 'help.subscription.a3' },
    ],
  },
  {
    icon: Users,
    titleKey: 'help.cat.team',
    items: [
      { qKey: 'help.team.q1', aKey: 'help.team.a1' },
      { qKey: 'help.team.q2', aKey: 'help.team.a2' },
    ],
  },
  {
    icon: ShieldCheck,
    titleKey: 'help.cat.security',
    items: [
      { qKey: 'help.security.q1', aKey: 'help.security.a1' },
      { qKey: 'help.security.q2', aKey: 'help.security.a2' },
    ],
  },
];

function AccordionItem({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <div className="border-b border-ink-100 dark:border-ink-800 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
      >
        <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{t(item.qKey)}</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-4 text-sm text-ink-600 dark:text-ink-300">{t(item.aKey)}</p>}
    </div>
  );
}

export function HelpCenterPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (i) => !query.trim() || t(i.qKey).toLowerCase().includes(query.toLowerCase()) || t(i.aKey).toLowerCase().includes(query.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <FooterPageLayout title={t('help.title')}>
      <div className="not-prose mb-8">
        <p className="text-ink-600 dark:text-ink-300">{t('help.intro')}</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('help.searchPlaceholder')}
          className="input mt-4 w-full max-w-md"
        />
      </div>

      <div className="not-prose space-y-8">
        {filtered.map((cat) => (
          <div key={cat.titleKey} className="card p-5">
            <div className="mb-1 flex items-center gap-2.5">
              <cat.icon size={18} className="text-brand-600" />
              <h2 className="text-base font-medium text-ink-900 dark:text-ink-50">{t(cat.titleKey)}</h2>
            </div>
            <div>
              {cat.items.map((item) => <AccordionItem key={item.qKey} item={item} />)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-ink-400 dark:text-ink-500">{t('help.noResults', { query })}</p>
        )}
      </div>

      <div className="not-prose mt-10 flex items-center gap-4 rounded-2xl border border-brand-100 dark:border-brand-900/40 bg-brand-50 dark:bg-brand-900/20 p-5">
        <MessageCircle size={28} className="shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('help.ctaTitle')}</p>
          <p className="text-sm text-ink-600 dark:text-ink-300">{t('help.ctaText')}</p>
        </div>
      </div>
    </FooterPageLayout>
  );
}
