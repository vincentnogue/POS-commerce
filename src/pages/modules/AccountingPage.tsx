import { useEffect, useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown, Wallet, FileBarChart, FileDown } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, StatCard } from '../../components/ui';
import { DataTable, Select, exportCSV } from '../../components/DataTable';
import type { Sale, Expense, Purchase } from '../../lib/types';

type Period = 'month' | 'quarter' | 'year';

export function AccountingPage() {
  const { tenant } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [period, setPeriod] = useState<Period>('year');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth()));
  const [quarter, setQuarter] = useState(String(Math.floor(new Date().getMonth() / 3)));
  const [loading, setLoading] = useState(true);

  const currency = tenant?.currency ?? 'XOF';

  const { start, end, label } = useMemo(() => {
    const y = Number(year);
    if (period === 'month') {
      const m = Number(month);
      const s = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10), label: `${['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'][m]} ${y}` };
    }
    if (period === 'quarter') {
      const q = Number(quarter);
      const s = new Date(y, q * 3, 1);
      const e = new Date(y, q * 3 + 3, 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10), label: `T${q + 1} ${y}` };
    }
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `Exercice ${y}` };
  }, [period, year, month, quarter]);

  useEffect(() => { (async () => {
    if (!tenant) return;
    const [s, e, p] = await Promise.all([
      supabase.from('sales').select('*').eq('tenant_id', tenant.id).gte('sale_date', start).lte('sale_date', end),
      supabase.from('expenses').select('*').eq('tenant_id', tenant.id).gte('expense_date', start).lte('expense_date', end),
      supabase.from('purchases').select('*').eq('tenant_id', tenant.id).gte('purchase_date', start).lte('purchase_date', end),
    ]);
    setSales((s.data as Sale[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setPurchases((p.data as Purchase[]) ?? []);
    setLoading(false);
  })(); }, [tenant, start, end]);

  const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const expensesTotal = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const purchasesTotal = purchases.reduce((s, x) => s + Number(x.total), 0);
  const cogs = purchasesTotal; // simplified
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expensesTotal;

  const monthly = useMemo(() => {
    // For year: 12 months. For quarter: 3 months. For month: single row.
    if (period === 'month') {
      return [{ month: label, revenu: revenue, depenses: expensesTotal, achats: purchasesTotal, resultat: netProfit }];
    }
    if (period === 'quarter') {
      const q = Number(quarter);
      return [0, 1, 2].map((i) => {
        const m = q * 3 + i;
        const ms = sales.filter((s) => new Date(s.sale_date).getMonth() === m && new Date(s.sale_date).getFullYear() === Number(year));
        const me = expenses.filter((e) => new Date(e.expense_date).getMonth() === m && new Date(e.expense_date).getFullYear() === Number(year));
        const mp = purchases.filter((p) => new Date(p.purchase_date).getMonth() === m && new Date(p.purchase_date).getFullYear() === Number(year));
        return {
          month: ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'][m],
          revenu: ms.reduce((s, x) => s + Number(x.total), 0),
          depenses: me.reduce((s, x) => s + Number(x.amount), 0),
          achats: mp.reduce((s, x) => s + Number(x.total), 0),
          resultat: ms.reduce((s, x) => s + Number(x.total), 0) - me.reduce((s, x) => s + Number(x.amount), 0) - mp.reduce((s, x) => s + Number(x.total), 0),
        };
      });
    }
    return Array.from({ length: 12 }).map((_, m) => {
      const monthSales = sales.filter((s) => new Date(s.sale_date).getMonth() === m);
      const monthExp = expenses.filter((e) => new Date(e.expense_date).getMonth() === m);
      const monthPurch = purchases.filter((p) => new Date(p.purchase_date).getMonth() === m);
      return {
        month: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][m],
        revenu: monthSales.reduce((s, x) => s + Number(x.total), 0),
        depenses: monthExp.reduce((s, x) => s + Number(x.amount), 0),
        achats: monthPurch.reduce((s, x) => s + Number(x.total), 0),
        resultat: monthSales.reduce((s, x) => s + Number(x.total), 0) - monthExp.reduce((s, x) => s + Number(x.amount), 0) - monthPurch.reduce((s, x) => s + Number(x.total), 0),
      };
    });
  }, [sales, expenses, purchases, period, quarter, year, label, revenue, expensesTotal, purchasesTotal, netProfit]);

  const years = [String(new Date().getFullYear()), String(new Date().getFullYear() - 1), String(new Date().getFullYear() - 2)];
  const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  return (
    <div>
      <PageHeader
        title="Comptabilité"
        subtitle={label}
        action={
          <div className="flex flex-wrap gap-2">
            <Select value={period} onChange={(v) => setPeriod(v as Period)} options={[{ value: 'month', label: 'Mois' }, { value: 'quarter', label: 'Trimestre' }, { value: 'year', label: 'Année' }]} />
            {period === 'month' && <Select value={month} onChange={setMonth} options={months.map((m, i) => ({ value: String(i), label: m }))} />}
            {period === 'quarter' && <Select value={quarter} onChange={setQuarter} options={[{ value: '0', label: 'T1' }, { value: '1', label: 'T2' }, { value: '2', label: 'T3' }, { value: '3', label: 'T4' }]} />}
            <Select value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
            <button onClick={() => exportCSV(`comptabilite-${label.replace(/\s/g, '-')}.csv`, monthly.map((m) => ({ mois: m.month, revenu: m.revenu, depenses: m.depenses, achats: m.achats, resultat: m.resultat })))} className="btn-ghost"><Download size={16} /> Export CSV</button>
            <button onClick={() => {
              const content = `Compte de résultat — ${label}\n\nChiffre d'affaires: ${formatMoney(revenue, currency)}\nCoût des achats: ${formatMoney(cogs, currency)}\nMarge brute: ${formatMoney(grossProfit, currency)}\nDépenses: ${formatMoney(expensesTotal, currency)}\nRésultat net: ${formatMoney(netProfit, currency)}\n\nDétail mensuel:\n${monthly.map((m) => `${m.month}: Rev=${formatMoney(m.revenu, currency)} Dép=${formatMoney(m.depenses, currency)} Ach=${formatMoney(m.achats, currency)} Rés=${formatMoney(m.resultat, currency)}`).join('\n')}`;
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `comptabilite-${label.replace(/\s/g, '-')}.txt`; a.click(); URL.revokeObjectURL(url);
            }} className="btn-ghost"><FileDown size={16} /> Export PDF</button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires" value={formatMoney(revenue, currency)} icon={TrendingUp} tone="brand" />
        <StatCard label="Coût des achats" value={formatMoney(cogs, currency)} icon={TrendingDown} tone="action" />
        <StatCard label="Dépenses" value={formatMoney(expensesTotal, currency)} icon={Wallet} tone="warning" />
        <StatCard label="Résultat net" value={formatMoney(netProfit, currency)} icon={FileBarChart} tone={netProfit >= 0 ? 'success' : 'error'} />
      </div>

      <div className="card mb-6 p-6">
        <h3 className="mb-2 text-base font-semibold text-ink-900">Compte de résultat simplifié</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-ink-100 pb-2"><span className="text-ink-600">Chiffre d'affaires</span><span className="font-semibold text-ink-900">{formatMoney(revenue, currency)}</span></div>
          <div className="flex justify-between border-b border-ink-100 pb-2"><span className="text-ink-600">- Coût des marchandises (achats)</span><span className="text-ink-900">{formatMoney(cogs, currency)}</span></div>
          <div className="flex justify-between border-b border-ink-100 pb-2"><span className="font-semibold text-ink-700">Marge brute</span><span className="font-semibold text-ink-900">{formatMoney(grossProfit, currency)}</span></div>
          <div className="flex justify-between border-b border-ink-100 pb-2"><span className="text-ink-600">- Dépenses opérationnelles</span><span className="text-ink-900">{formatMoney(expensesTotal, currency)}</span></div>
          <div className="flex justify-between pt-1"><span className="font-bold text-ink-900">Résultat net</span><span className={`font-bold ${netProfit >= 0 ? 'text-success-700' : 'text-error-600'}`}>{formatMoney(netProfit, currency)}</span></div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-4 text-base font-semibold text-ink-900">Détail mensuel</h3>
        <DataTable
          loading={loading}
          columns={[
            { key: 'month', label: 'Mois', render: (m) => <span className="font-medium text-ink-900">{m.month}</span> },
            { key: 'revenu', label: 'Revenu', className: 'text-right', render: (m) => <span className="text-ink-900">{formatMoney(m.revenu, currency)}</span> },
            { key: 'depenses', label: 'Dépenses', className: 'text-right', render: (m) => <span className="text-ink-900">{formatMoney(m.depenses, currency)}</span> },
            { key: 'achats', label: 'Achats', className: 'text-right', render: (m) => <span className="text-ink-900">{formatMoney(m.achats, currency)}</span> },
            { key: 'resultat', label: 'Résultat', className: 'text-right', render: (m) => <span className={m.resultat >= 0 ? 'font-semibold text-success-700' : 'font-semibold text-error-600'}>{formatMoney(m.resultat, currency)}</span> },
          ]}
          rows={monthly}
        />
      </div>
    </div>
  );
}
