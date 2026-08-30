import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Package, FileText, Truck, Plus, TrendingUp, Zap,
  Coins, ArrowRight, Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney, getCountry } from '../../lib/localization';
import { StatCard, PageHeader } from '../../components/ui';
import { PerformanceMetrics } from '../../components/PerformanceMetrics';
import type { Sale } from '../../lib/types';

const WEEKDAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DashboardPage() {
  const { tenant } = useAuth();
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [unpaid, setUnpaid] = useState(0);
  const [deliveriesToday, setDeliveriesToday] = useState(0);
  const [activeProductCount, setActiveProductCount] = useState(0);
  const [returnsLast7Days, setReturnsLast7Days] = useState(0);

  const currency = tenant?.currency ?? 'XOF';
  const country = tenant ? getCountry(tenant.country_code) : undefined;
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const today = new Date();
  const dateStr = today.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const WEEKDAYS = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_FR;

  const SHORTCUTS = [
    { icon: ShoppingCart, label: t('dashboard.shortcuts.sell'), to: '/pos', desc: t('dashboard.shortcuts.sellDesc') },
    { icon: Package, label: t('dashboard.shortcuts.addProduct'), to: '/products?new=1', desc: t('dashboard.shortcuts.addProductDesc') },
    { icon: FileText, label: t('dashboard.shortcuts.invoices'), to: '/invoices', desc: t('dashboard.shortcuts.invoicesDesc') },
    { icon: Truck, label: t('dashboard.shortcuts.deliveries'), to: '/deliveries?today=1', desc: t('dashboard.shortcuts.deliveriesDesc') },
  ];

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      setLoading(true);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('sale_date', { ascending: false })
        .limit(200);
      setSales((salesData as Sale[]) ?? []);

      const { count: unpaidCount } = await supabase
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('payment_status', 'unpaid');
      setUnpaid(unpaidCount ?? 0);

      const { count: delCount } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('scheduled_date', startOfToday)
        .lt('scheduled_date', new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString());
      setDeliveriesToday(delCount ?? 0);

      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);
      setActiveProductCount(productCount ?? 0);

      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const { count: returnsCount } = await supabase
        .from('sale_returns')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('created_at', sevenDaysAgo);
      setReturnsLast7Days(returnsCount ?? 0);

      setLoading(false);
    })();
  }, [tenant]);

  const monthRevenue = sales
    .filter((s) => new Date(s.sale_date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    .reduce((sum, s) => sum + Number(s.total), 0);

  const todayCount = sales.filter((s) => {
    const d = new Date(s.sale_date);
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }).length;

  // Build 7-day chart
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayRevenue = sales
      .filter((s) => {
        const d = new Date(s.sale_date);
        return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
      })
      .reduce((sum, s) => sum + Number(s.total), 0);
    return { day: WEEKDAYS[date.getDay()], value: dayRevenue };
  });

  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return t('dashboard.greeting.morning');
    if (h < 18) return t('dashboard.greeting.afternoon');
    return t('dashboard.greeting.evening');
  })();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 dark:border-brand-900 border-t-brand-500 dark:border-t-brand-400" />
          <p className="text-sm font-medium text-ink-600 dark:text-ink-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={<>{greeting} <span className="inline-block">👋</span></>}
        subtitle={`${tenant?.city ?? country?.name ?? ''} · ${dateStr}`}
        action={<Link to="/pos" className="btn-primary"><Plus size={16} /> {t('dashboard.newSale')}</Link>}
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.stat.monthRevenue')} value={formatMoney(monthRevenue, currency)} icon={Coins} tone="brand" />
        <StatCard label={t('dashboard.stat.salesToday')} value={todayCount} icon={ShoppingCart} tone="action" />
        <StatCard label={t('dashboard.stat.unpaid')} value={unpaid} icon={FileText} tone="success" />
        <StatCard label={t('dashboard.stat.deliveriesInProgress')} value={deliveriesToday} icon={Truck} tone="warning" />
      </div>

      {/* Chart + Shortcuts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="card p-6 lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('dashboard.chart.title')}</h3>
              <p className="text-xs text-ink-500 dark:text-ink-400">{formatMoney(chartData.reduce((s, d) => s + d.value, 0), currency)} {t('dashboard.chart.total')}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/25 px-2.5 py-1 text-xs font-medium text-brand-700">
              <TrendingUp size={12} /> {t('dashboard.chart.weekly')}
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E8C66" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2E8C66" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#748478' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#748478' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                <Tooltip
                  formatter={(v) => [formatMoney(Number(v), currency), t('dashboard.chart.tooltipSales')]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #DCE2DD', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="value" stroke="#2E8C66" strokeWidth={2.5} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Shortcuts */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="card p-6"
        >
          <h3 className="mb-4 flex items-center gap-2 text-base font-medium text-ink-900 dark:text-ink-50">
            <Zap size={16} className="text-action-500" /> {t('dashboard.shortcuts.title')}
          </h3>
          <div className="space-y-2.5">
            {SHORTCUTS.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                className="group flex w-full items-center gap-3 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-3 transition hover:border-action-200 hover:bg-action-50/40 dark:hover:bg-action-900/25"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-action-100 dark:bg-action-900/35 text-action-600 transition group-hover:bg-action-500 group-hover:text-white">
                  <s.icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{s.label}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">{s.desc}</p>
                </div>
                <ArrowRight size={15} className="text-ink-400 dark:text-ink-500 transition group-hover:text-action-500" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent sales */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="card mt-6 p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('dashboard.recentSales.title')}</h3>
          <Link to="/invoices" className="text-xs font-medium text-brand-600 hover:underline">{t('dashboard.recentSales.viewAll')}</Link>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-400 dark:text-ink-500">{t('dashboard.recentSales.loading')}</p>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/25 text-brand-500">
              <Sparkles size={22} />
            </div>
            <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('dashboard.recentSales.empty')}</p>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{t('dashboard.recentSales.emptyDesc')}</p>
            <Link to="/pos" className="btn-primary mt-4"><Plus size={15} /> {t('dashboard.recentSales.emptyCta')}</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
                  <th className="pb-2 font-medium">{t('dashboard.table.reference')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.table.date')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.table.payment')}</th>
                  <th className="pb-2 text-right font-medium">{t('dashboard.table.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 6).map((s) => (
                  <tr key={s.id} className="border-b border-ink-50 dark:border-ink-800 last:border-0">
                    <td className="py-3 font-medium text-ink-900 dark:text-ink-50">{s.reference}</td>
                    <td className="py-3 text-ink-600 dark:text-ink-300">{new Date(s.sale_date).toLocaleDateString(locale)}</td>
                    <td className="py-3">
                      <span className={`badge ${s.payment_status === 'paid' ? 'bg-success-100 dark:bg-success-900/35 text-success-700' : 'bg-warning-100 dark:bg-warning-900/35 text-warning-600'}`}>
                        {s.payment_status === 'paid' ? t('dashboard.paid') : t('dashboard.unpaid')}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium text-ink-900 dark:text-ink-50">{formatMoney(s.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Performance Metrics Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-12"
      >
        <PerformanceMetrics
          sales={sales}
          returnsLast7Days={returnsLast7Days}
          activeProductCount={activeProductCount}
          currency={currency}
        />
      </motion.div>
    </div>
  );
}
