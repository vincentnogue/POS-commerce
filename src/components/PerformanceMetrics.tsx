import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, ShoppingCart, Package, Undo2, CreditCard, Sparkles } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { formatMoney } from '../lib/localization';
import type { Sale } from '../lib/types';

const WEEKDAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const METHOD_COLORS: Record<string, string> = {
  cash: '#2E8C66',
  card: '#2E63DD',
  mobile_money: '#F96F22',
  split: '#8B5CF6',
};

interface PerformanceMetricsProps {
  /** Real sales for this tenant (as already fetched by DashboardPage — no
   * separate query here, single source of truth). */
  sales: Sale[];
  /** Real count of returns/exchanges in the last 7 days (sale_returns table). */
  returnsLast7Days: number;
  /** Real active product count for this tenant. */
  activeProductCount: number;
  currency: string;
}

/**
 * Real, tenant-scoped performance metrics — replaces a previous version of
 * this component that rendered entirely hardcoded numbers (fake "1,240
 * active users", invented daily volumes) regardless of which tenant was
 * logged in. Every figure here is computed from data the tenant's own
 * account actually produced; modules with genuinely no activity yet show
 * that plainly instead of a fabricated number.
 */
export function PerformanceMetrics({ sales, returnsLast7Days, activeProductCount, currency }: PerformanceMetricsProps) {
  const { t, lang } = useI18n();
  const WEEKDAYS = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_FR;

  const { dailySales, last7Total, prev7Total, methodBreakdown } = useMemo(() => {
    const now = new Date();
    const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const daySet = new Map(days.map((d) => [dayKey(d), { day: WEEKDAYS[d.getDay()], count: 0, revenue: 0 }]));

    let last7Total = 0;
    let prev7Total = 0;
    const methodTotals: Record<string, number> = {};

    for (const s of sales) {
      const d = new Date(s.sale_date);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
      const total = Number(s.total) || 0;

      if (daysAgo >= 0 && daysAgo < 7) {
        last7Total += total;
        const bucket = daySet.get(dayKey(d));
        if (bucket) { bucket.count += 1; bucket.revenue += total; }
        const method = s.payment_method ?? 'cash';
        methodTotals[method] = (methodTotals[method] ?? 0) + total;
      } else if (daysAgo >= 7 && daysAgo < 14) {
        prev7Total += total;
      }
    }

    const methodBreakdown = Object.entries(methodTotals)
      .map(([method, value]) => ({ method, value }))
      .sort((a, b) => b.value - a.value);

    return { dailySales: Array.from(daySet.values()), last7Total, prev7Total, methodBreakdown };
  }, [sales, WEEKDAYS]);

  // Week-over-week trend — null (not "0%") when there's no prior-week data
  // to compare against, e.g. a brand-new store, so we never show a
  // confident-looking percentage backed by nothing.
  const salesTrend = prev7Total > 0 ? Math.round(((last7Total - prev7Total) / prev7Total) * 100) : null;
  const last7Count = dailySales.reduce((sum, d) => sum + d.count, 0);

  const cards = [
    {
      key: 'pos',
      icon: ShoppingCart,
      label: t('dashboard.performance.pos'),
      value: last7Count.toLocaleString(),
      sub: t('dashboard.performance.pos.sub'),
      trend: salesTrend,
    },
    {
      key: 'revenue',
      icon: TrendingUp,
      label: t('dashboard.performance.revenue'),
      value: formatMoney(last7Total, currency),
      sub: t('dashboard.performance.revenue.sub'),
      trend: salesTrend,
    },
    {
      key: 'stock',
      icon: Package,
      label: t('dashboard.performance.stock'),
      value: activeProductCount.toLocaleString(),
      sub: t('dashboard.performance.stock.sub'),
      trend: null,
    },
    {
      key: 'returns',
      icon: Undo2,
      label: t('dashboard.performance.returns'),
      value: returnsLast7Days.toLocaleString(),
      sub: t('dashboard.performance.returns.sub'),
      trend: null,
    },
  ];

  const hasAnyActivity = sales.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-flow-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.performance.title')}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{t('dashboard.performance.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.key}
            className="relative overflow-hidden rounded-2xl p-5 bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-500/10">
                <c.icon size={18} className="text-brand-600 dark:text-brand-400" />
              </div>
              {c.trend !== null && (
                <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${c.trend >= 0 ? 'bg-flow-50 dark:bg-flow-500/10 text-flow-700 dark:text-flow-400' : 'bg-error-50 dark:bg-error-500/10 text-error-700 dark:text-error-400'}`}>
                  {c.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {c.trend >= 0 ? '+' : ''}{c.trend}%
                </div>
              )}
            </div>
            <h4 className="text-sm font-semibold mb-1 text-gray-900 dark:text-white">{c.label}</h4>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            <p className="text-xs mt-2 text-gray-500">{c.sub}</p>
          </div>
        ))}
      </div>

      {!hasAnyActivity ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-ink-700 p-10 text-center">
          <Activity className="mx-auto mb-3 text-gray-300 dark:text-ink-600" size={28} />
          <p className="text-sm text-gray-500 dark:text-ink-400">{t('dashboard.performance.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-2xl p-6 shadow-sm">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('dashboard.performance.chart.sales')}</h4>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-ink-700" />
                <XAxis dataKey="day" stroke="#6b7280" className="dark:stroke-gray-400" />
                <YAxis stroke="#6b7280" className="dark:stroke-gray-400" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }} />
                <Line type="monotone" dataKey="count" stroke="#2E8C66" strokeWidth={2} dot={{ fill: '#2E8C66', r: 4 }} activeDot={{ r: 6 }} name={t('dashboard.performance.chart.salesCount')} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-2xl p-6 shadow-sm">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('dashboard.performance.chart.revenue')}</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-ink-700" />
                <XAxis dataKey="day" stroke="#6b7280" className="dark:stroke-gray-400" />
                <YAxis stroke="#6b7280" className="dark:stroke-gray-400" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
                  formatter={(value) => formatMoney(Number(value) || 0, currency)}
                />
                <Bar dataKey="revenue" fill="#2E8C66" name={t('dashboard.performance.chart.revenueLabel')} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {methodBreakdown.length > 0 && (
            <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-2xl p-6 shadow-sm lg:col-span-2">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard size={18} className="text-brand-600 dark:text-brand-400" />
                {t('dashboard.performance.chart.payments')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={methodBreakdown} dataKey="value" nameKey="method" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {methodBreakdown.map((m) => (
                        <Cell key={m.method} fill={METHOD_COLORS[m.method] ?? '#9CA3AF'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }}
                      formatter={(value) => formatMoney(Number(value) || 0, currency)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {methodBreakdown.map((m) => {
                    const pct = last7Total > 0 ? Math.round((m.value / last7Total) * 100) : 0;
                    return (
                      <div key={m.method} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: METHOD_COLORS[m.method] ?? '#9CA3AF' }} />
                          {m.method === 'cash' ? t('pos.pay.cash')
                            : m.method === 'card' ? t('pos.pay.cardLabel')
                            : m.method === 'mobile_money' ? t('pos.pay.mobileMoney')
                            : m.method === 'split' ? t('pos.split.label')
                            : m.method}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
