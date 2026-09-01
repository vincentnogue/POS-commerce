import { useEffect, useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown, ShoppingCart, Wallet, ArrowUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney, localDateStr } from '../../lib/localization';
import { PageHeader, StatCard, Modal } from '../../components/ui';
import { Select, SearchInput, exportCSV } from '../../components/DataTable';
import type { Sale, Expense, Store, Product, Category } from '../../lib/types';

const PERIODS = [
  { value: '7', labelKey: 'reports.period.last7' },
  { value: '30', labelKey: 'reports.period.last30' },
  { value: '90', labelKey: 'reports.period.last90' },
  { value: '365', labelKey: 'reports.period.year' },
];

const PIE_COLORS = ['#2E8C66', '#14B594', '#F96F22', '#FFC7A0', '#4FA480', '#7CBBA0', '#F5A623', '#E5484D'];

export function ReportsPage() {
  const { tenant } = useAuth();
  const { t, lang } = useI18n();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [period, setPeriod] = useState('30');
  const [storeFilter, setStoreFilter] = useState('');
  // Sales register (Dynamics-365-style transaction list) — search,
  // payment-method filter, sortable columns, and a line-item drill-down,
  // on top of the aggregate charts above rather than replacing them.
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [registerSearch, setRegisterSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [sortKey, setSortKey] = useState<'sale_date' | 'total' | 'reference'>('sale_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [detailItems, setDetailItems] = useState<{ name: string; quantity: number; unit_price: number; total: number }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const days = 365;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [s, e, p, c, st] = await Promise.all([
      supabase.from('sales').select('*, store:stores(name)').eq('tenant_id', tenant.id).gte('sale_date', since),
      supabase.from('expenses').select('*').eq('tenant_id', tenant.id).gte('expense_date', localDateStr(new Date(Date.now() - days * 86400000))),
      supabase.from('products').select('*, category:categories(name)').eq('tenant_id', tenant.id),
      supabase.from('categories').select('*').eq('tenant_id', tenant.id),
      supabase.from('stores').select('*').eq('tenant_id', tenant.id),
    ]);
    setSales((s.data as any[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setProducts((p.data as any[]) ?? []);
    setCategories((c.data as Category[]) ?? []);
    setStores((st.data as Store[]) ?? []);
    const { data: members } = await supabase.from('tenant_members').select('user_id, display_name').eq('tenant_id', tenant.id);
    const staffMap: Record<string, string> = {};
    (members ?? []).forEach((m: any) => { if (m.user_id) staffMap[m.user_id] = m.display_name ?? t('reports.unknownStaff'); });
    setStaffNames(staffMap);
  })(); }, [tenant, t]);

  const sinceDate = Date.now() - Number(period) * 86400000;

  const filteredSales = useMemo(() => sales.filter((s) => {
    const inPeriod = new Date(s.sale_date).getTime() >= sinceDate;
    const inStore = !storeFilter || s.store_id === storeFilter;
    return inPeriod && inStore;
  }), [sales, storeFilter, sinceDate]);

  // Sales-by-store breakdown (Dynamics-365-Commerce-style store comparison):
  // always computed off the period alone, ignoring storeFilter, so the
  // comparison table keeps showing every store even while one is selected
  // elsewhere on the page — clicking a row here is what drives storeFilter.
  const salesByStore = useMemo(() => {
    const periodSales = sales.filter((s) => new Date(s.sale_date).getTime() >= sinceDate);
    const map = new Map<string, { id: string; name: string; revenue: number; count: number }>();
    periodSales.forEach((s) => {
      const id = s.store_id ?? '__none__';
      const name = (s as any).store?.name ?? t('reports.byStore.noStore');
      const row = map.get(id) ?? { id, name, revenue: 0, count: 0 };
      row.revenue += Number(s.total);
      row.count += 1;
      map.set(id, row);
    });
    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const total = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.map((r) => ({ ...r, avgBasket: r.count > 0 ? r.revenue / r.count : 0, share: total > 0 ? (r.revenue / total) * 100 : 0 }));
  }, [sales, sinceDate, t]);

  const filteredExpenses = useMemo(() => expenses.filter((e) => new Date(e.expense_date).getTime() >= sinceDate && (!storeFilter || e.store_id === storeFilter)), [expenses, sinceDate, storeFilter]);

  const revenue = filteredSales.reduce((s, x) => s + Number(x.total), 0);
  const expensesTotal = filteredExpenses.reduce((s, x) => s + Number(x.amount), 0);
  const profit = revenue - expensesTotal;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Daily revenue chart
  const days = Number(period);
  const chartData = Array.from({ length: Math.min(days, 30) }).map((_, i) => {
    const d = new Date(Date.now() - (Math.min(days, 30) - 1 - i) * 86400000);
    const dayRev = filteredSales.filter((s) => { const sd = new Date(s.sale_date); return sd.toDateString() === d.toDateString(); }).reduce((s, x) => s + Number(x.total), 0);
    const dayExp = filteredExpenses.filter((e) => new Date(e.expense_date).toDateString() === d.toDateString()).reduce((s, x) => s + Number(x.amount), 0);
    return { date: d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit' }), revenu: dayRev, depenses: dayExp };
  });

  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number }[]>([]);

  useEffect(() => {
    if (!tenant || filteredSales.length === 0) { setTopProducts([]); return; }
    (async () => {
      const saleIds = filteredSales.map((s) => s.id);
      const { data: items } = await supabase
        .from('sale_items')
        .select('product_id, quantity, unit_price, product:products(name)')
        .in('sale_id', saleIds);
      if (!items) { setTopProducts([]); return; }
      const byProduct: Record<string, number> = {};
      (items as any[]).forEach((item) => {
        const name = item.product?.name ?? t('reports.unknownProduct');
        byProduct[name] = (byProduct[name] ?? 0) + Number(item.quantity) * Number(item.unit_price);
      });
      setTopProducts(
        Object.entries(byProduct)
          .map(([name, revenue]) => ({ name, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 6),
      );
    })();
  }, [tenant, filteredSales, t]);

  // Category distribution
  const catData = categories.map((c) => ({
    name: c.name,
    value: products.filter((p) => p.category_id === c.id).length,
  })).filter((x) => x.value > 0);

  const registerRows = useMemo(() => {
    const q = registerSearch.toLowerCase().trim();
    let rows = filteredSales.filter((s) =>
      (!q || s.reference.toLowerCase().includes(q)) &&
      (!paymentFilter || s.payment_method === paymentFilter)
    );
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'sale_date') cmp = new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime();
      else if (sortKey === 'total') cmp = Number(a.total) - Number(b.total);
      else cmp = a.reference.localeCompare(b.reference);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filteredSales, registerSearch, paymentFilter, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const openSaleDetail = async (s: Sale) => {
    setDetailSale(s);
    setDetailLoading(true);
    const { data } = await supabase.from('sale_items').select('name, quantity, unit_price, total').eq('sale_id', s.id);
    setDetailItems((data as any[]) ?? []);
    setDetailLoading(false);
  };

  const paymentMethodLabel = (m: string | null) =>
    m === 'cash' ? t('pos.pay.cash') : m === 'card' ? t('pos.pay.cardLabel') : m === 'mobile_money' ? t('pos.pay.mobileMoney') : m === 'gift_card' ? t('pos.pay.giftCard') : m === 'split' ? t('pos.split.label') : (m ?? '—');

  return (
    <div>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.periodLabel', { label: t(PERIODS.find((p) => p.value === period)?.labelKey ?? '') })}
        action={
          <div className="flex gap-2">
            <Select value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: t(p.labelKey) }))} />
            <Select value={storeFilter} onChange={setStoreFilter} placeholder={t('reports.allStores')} options={stores.map((s) => ({ value: s.id, label: s.name }))} />
            <button onClick={() => exportCSV('rapport.csv', filteredSales.map((s) => ({ reference: s.reference, date: s.sale_date, total: s.total, paiement: s.payment_method })))} className="btn-ghost"><Download size={16} /> {t('common.export')}</button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('reports.revenue')} value={formatMoney(revenue, currency)} icon={TrendingUp} tone="brand" />
        <StatCard label={t('accounting.expenses')} value={formatMoney(expensesTotal, currency)} icon={TrendingDown} tone="action" />
        <StatCard label={t('reports.profit')} value={formatMoney(profit, currency)} icon={Wallet} tone={profit >= 0 ? 'success' : 'error'} />
        <StatCard label={t('reports.margin')} value={`${margin.toFixed(1)}%`} icon={ShoppingCart} tone="flow" />
      </div>

      <div className="card mb-6 p-6">
        <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('reports.revenueVsExpenses')}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1EF" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#748478' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#748478' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Tooltip formatter={(v: any) => formatMoney(Number(v), currency)} contentStyle={{ borderRadius: 12, border: '1px solid #DCE2DD', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenu" fill="#2E8C66" radius={[6, 6, 0, 0]} name={t('reports.revenue')} />
              <Bar dataKey="depenses" fill="#F96F22" radius={[6, 6, 0, 0]} name={t('accounting.expenses')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales by store — lets a multi-store tenant see at a glance which
          locations are driving revenue instead of having to flip the
          single-store filter above one store at a time. Clicking a row
          sets storeFilter, which then also narrows the charts, stat cards
          and register below to that store — same drill-down pattern as
          the sales register's row click below. */}
      {stores.length > 1 && (
        <div className="card mb-6 p-6">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('reports.byStore.title')}</h3>
            {storeFilter ? (
              <button onClick={() => setStoreFilter('')} className="btn-ghost !px-3 !py-1 text-xs">{t('reports.allStores')}</button>
            ) : (
              <span className="text-xs text-ink-400 dark:text-ink-500">{t('reports.byStore.clearFilter')}</span>
            )}
          </div>
          {salesByStore.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-400 dark:text-ink-500">{t('common.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    <th className="pb-2.5 font-medium">{t('reports.byStore.col.store')}</th>
                    <th className="pb-2.5 text-right font-medium">{t('reports.byStore.col.transactions')}</th>
                    <th className="pb-2.5 text-right font-medium">{t('reports.byStore.col.avgBasket')}</th>
                    <th className="pb-2.5 text-right font-medium">{t('reports.byStore.col.revenue')}</th>
                    <th className="pb-2.5 pl-4 font-medium">{t('reports.byStore.col.share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {salesByStore.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => r.id !== '__none__' && setStoreFilter(storeFilter === r.id ? '' : r.id)}
                      className={`border-b border-ink-50 dark:border-ink-800 last:border-0 ${r.id !== '__none__' ? 'cursor-pointer hover:bg-brand-50/30 dark:hover:bg-brand-900/25' : ''} ${storeFilter === r.id ? 'bg-brand-50/60 dark:bg-brand-900/40' : ''}`}
                    >
                      <td className="py-2.5 font-medium text-ink-900 dark:text-ink-50">{r.name}</td>
                      <td className="py-2.5 text-right text-ink-600 dark:text-ink-300">{r.count}</td>
                      <td className="py-2.5 text-right text-ink-600 dark:text-ink-300">{formatMoney(r.avgBasket, currency)}</td>
                      <td className="py-2.5 text-right font-medium text-ink-900 dark:text-ink-50">{formatMoney(r.revenue, currency)}</td>
                      <td className="py-2.5 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${r.share}%` }} />
                          </div>
                          <span className="tabular-nums text-xs text-ink-500 dark:text-ink-400">{r.share.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('reports.productsByCategory')}</h3>
          {catData.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-400 dark:text-ink-500">{t('common.empty')}</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                    {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #DCE2DD', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('reports.topProducts')}</h3>
          {topProducts.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-400 dark:text-ink-500">{t('common.empty')}</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/25 text-xs font-medium text-brand-700">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(p.revenue / topProducts[0].revenue) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{formatMoney(p.revenue, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sales register — full transaction-level detail (reference, date,
          store, staff, payment method, total), searchable/sortable/
          filterable and with a line-item drill-down per sale, on top of
          the aggregate charts above. Reprinting a receipt or generating
          an invoice for a sale stays in POS -> Historique
          (src/pages/modules/SaleHistoryTab.tsx) rather than being
          duplicated here with a second code path that could drift out of
          sync with it — this view is for visibility and analysis. */}
      <div className="card mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('reports.register.title')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={registerSearch} onChange={setRegisterSearch} placeholder={t('reports.register.searchPlaceholder')} />
            <Select
              value={paymentFilter}
              onChange={setPaymentFilter}
              placeholder={t('reports.register.allPayments')}
              options={[
                { value: 'cash', label: t('pos.pay.cash') },
                { value: 'card', label: t('pos.pay.cardLabel') },
                { value: 'mobile_money', label: t('pos.pay.mobileMoney') },
                { value: 'gift_card', label: t('pos.pay.giftCard') },
                { value: 'split', label: t('pos.split.label') },
              ]}
            />
            <button
              onClick={() => exportCSV('registre-ventes.csv', registerRows.map((s) => ({
                reference: s.reference, date: s.sale_date, magasin: (s as any).store?.name ?? '', paiement: s.payment_method, statut: s.sale_status, total: s.total,
              })))}
              className="btn-ghost"
            ><Download size={16} /> {t('common.export')}</button>
          </div>
        </div>

        {registerRows.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-400 dark:text-ink-500">{t('common.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  <th className="pb-2.5 font-medium">
                    <button onClick={() => toggleSort('reference')} className="flex items-center gap-1 hover:text-brand-600">{t('reports.register.col.reference')} <ArrowUpDown size={11} /></button>
                  </th>
                  <th className="pb-2.5 font-medium">
                    <button onClick={() => toggleSort('sale_date')} className="flex items-center gap-1 hover:text-brand-600">{t('common.date')} <ArrowUpDown size={11} /></button>
                  </th>
                  <th className="pb-2.5 font-medium">{t('reports.register.col.store')}</th>
                  <th className="pb-2.5 font-medium">{t('reports.register.col.staff')}</th>
                  <th className="pb-2.5 font-medium">{t('reports.register.col.payment')}</th>
                  <th className="pb-2.5 font-medium">{t('common.status')}</th>
                  <th className="pb-2.5 text-right font-medium">
                    <button onClick={() => toggleSort('total')} className="ml-auto flex items-center gap-1 hover:text-brand-600">{t('reports.register.col.total')} <ArrowUpDown size={11} /></button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {registerRows.slice(0, 200).map((s) => (
                  <tr key={s.id} onClick={() => openSaleDetail(s)} className="cursor-pointer border-b border-ink-50 dark:border-ink-800 last:border-0 hover:bg-brand-50/30 dark:hover:bg-brand-900/25">
                    <td className="py-2.5 font-medium text-ink-900 dark:text-ink-50">{s.reference}</td>
                    <td className="py-2.5 text-ink-600 dark:text-ink-300">{new Date(s.sale_date).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</td>
                    <td className="py-2.5 text-ink-600 dark:text-ink-300">{(s as any).store?.name ?? '—'}</td>
                    <td className="py-2.5 text-ink-600 dark:text-ink-300">{s.user_id ? staffNames[s.user_id] ?? '—' : '—'}</td>
                    <td className="py-2.5 text-ink-600 dark:text-ink-300">{paymentMethodLabel(s.payment_method)}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.sale_status === 'completed' ? 'bg-success-50 text-success-700 dark:bg-success-900/25' : 'bg-warning-50 text-warning-700 dark:bg-warning-900/25'}`}>
                        {s.sale_status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium text-ink-900 dark:text-ink-50">{formatMoney(Number(s.total), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {registerRows.length > 200 && (
              <p className="mt-3 text-center text-xs text-ink-400 dark:text-ink-500">{t('reports.register.truncated', { shown: '200', total: String(registerRows.length) })}</p>
            )}
          </div>
        )}
      </div>

      {/* Sale line-item drill-down */}
      <Modal open={!!detailSale} onClose={() => setDetailSale(null)} title={detailSale?.reference ?? ''} maxWidth="max-w-lg">
        {detailSale && (
          <div>
            {detailLoading ? (
              <p className="py-8 text-center text-sm text-ink-400 dark:text-ink-500">{t('common.loading')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-400 dark:text-ink-500">
                  <th className="py-2">{t('pos.receipt.designation')}</th><th className="py-2 text-right">{t('pos.receipt.qty')}</th><th className="py-2 text-right">{t('pos.receipt.price')}</th><th className="py-2 text-right">{t('pos.receipt.total')}</th>
                </tr></thead>
                <tbody>
                  {detailItems.map((it, i) => (
                    <tr key={i} className="border-b border-ink-50 dark:border-ink-800 last:border-0">
                      <td className="py-2 text-ink-900 dark:text-ink-50">{it.name}</td>
                      <td className="py-2 text-right text-ink-600 dark:text-ink-300">{it.quantity}</td>
                      <td className="py-2 text-right text-ink-600 dark:text-ink-300">{formatMoney(Number(it.unit_price), currency)}</td>
                      <td className="py-2 text-right font-medium text-ink-900 dark:text-ink-50">{formatMoney(Number(it.total), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-4 flex justify-between border-t border-ink-100 dark:border-ink-800 pt-3">
              <span className="text-sm text-ink-500 dark:text-ink-400">{t('reports.register.col.total')}</span>
              <span className="text-base font-bold text-ink-900 dark:text-white">{formatMoney(Number(detailSale.total), currency)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
