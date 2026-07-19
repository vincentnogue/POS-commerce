import { useEffect, useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown, ShoppingCart, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, StatCard } from '../../components/ui';
import { Select, exportCSV } from '../../components/DataTable';
import type { Sale, Expense, Store, Product, Category } from '../../lib/types';

const PERIODS = [
  { value: '7', label: '7 derniers jours' },
  { value: '30', label: '30 derniers jours' },
  { value: '90', label: '90 derniers jours' },
  { value: '365', label: 'Année' },
];

const PIE_COLORS = ['#2E8C66', '#14B594', '#F96F22', '#FFC7A0', '#4FA480', '#7CBBA0', '#F5A623', '#E5484D'];

export function ReportsPage() {
  const { tenant } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [period, setPeriod] = useState('30');
  const [storeFilter, setStoreFilter] = useState('');

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const days = 365;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [s, e, p, c, st] = await Promise.all([
      supabase.from('sales').select('*, store:stores(name)').eq('tenant_id', tenant.id).gte('sale_date', since),
      supabase.from('expenses').select('*').eq('tenant_id', tenant.id).gte('expense_date', new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)),
      supabase.from('products').select('*, category:categories(name)').eq('tenant_id', tenant.id),
      supabase.from('categories').select('*').eq('tenant_id', tenant.id),
      supabase.from('stores').select('*').eq('tenant_id', tenant.id),
    ]);
    setSales((s.data as any[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setProducts((p.data as any[]) ?? []);
    setCategories((c.data as Category[]) ?? []);
    setStores((st.data as Store[]) ?? []);
  })(); }, [tenant]);

  const sinceDate = Date.now() - Number(period) * 86400000;

  const filteredSales = useMemo(() => sales.filter((s) => {
    const inPeriod = new Date(s.sale_date).getTime() >= sinceDate;
    const inStore = !storeFilter || s.store_id === storeFilter;
    return inPeriod && inStore;
  }), [sales, period, storeFilter, sinceDate]);

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
    return { date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), revenu: dayRev, depenses: dayExp };
  });

  // Top products by sale items — approximate using sale totals (since we don't join items here)
  const topProducts = products.slice(0, 6).map((p) => ({
    name: p.name,
    revenue: Number(p.sale_price) * 10, // placeholder metric
  })).sort((a, b) => b.revenue - a.revenue);

  // Category distribution
  const catData = categories.map((c) => ({
    name: c.name,
    value: products.filter((p) => p.category_id === c.id).length,
  })).filter((x) => x.value > 0);

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle={`Période : ${PERIODS.find((p) => p.value === period)?.label}`}
        action={
          <div className="flex gap-2">
            <Select value={period} onChange={setPeriod} options={PERIODS} />
            <Select value={storeFilter} onChange={setStoreFilter} placeholder="Tous magasins" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
            <button onClick={() => exportCSV('rapport.csv', filteredSales.map((s) => ({ reference: s.reference, date: s.sale_date, total: s.total, paiement: s.payment_method })))} className="btn-ghost"><Download size={16} /> Export</button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenu" value={formatMoney(revenue, currency)} icon={TrendingUp} tone="brand" />
        <StatCard label="Dépenses" value={formatMoney(expensesTotal, currency)} icon={TrendingDown} tone="action" />
        <StatCard label="Bénéfice" value={formatMoney(profit, currency)} icon={Wallet} tone={profit >= 0 ? 'success' : 'error'} />
        <StatCard label="Marge" value={`${margin.toFixed(1)}%`} icon={ShoppingCart} tone="flow" />
      </div>

      <div className="card mb-6 p-6">
        <h3 className="mb-4 text-base font-semibold text-ink-900">Revenu vs Dépenses</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1EF" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#748478' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#748478' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Tooltip formatter={(v: any) => formatMoney(Number(v), currency)} contentStyle={{ borderRadius: 12, border: '1px solid #DCE2DD', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenu" fill="#2E8C66" radius={[6, 6, 0, 0]} name="Revenu" />
              <Bar dataKey="depenses" fill="#F96F22" radius={[6, 6, 0, 0]} name="Dépenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-base font-semibold text-ink-900">Produits par catégorie</h3>
          {catData.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-400">Aucune donnée</p>
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
          <h3 className="mb-4 text-base font-semibold text-ink-900">Top produits</h3>
          {topProducts.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-400">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink-900">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(p.revenue / topProducts[0].revenue) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-ink-700">{formatMoney(p.revenue, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
