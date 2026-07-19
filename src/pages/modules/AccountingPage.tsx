import { useEffect, useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown, Wallet, FileBarChart } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, StatCard } from '../../components/ui';
import { DataTable, Select, exportCSV } from '../../components/DataTable';
import type { Sale, Expense, Purchase } from '../../lib/types';

export function AccountingPage() {
  const { tenant } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const [s, e, p] = await Promise.all([
      supabase.from('sales').select('*').eq('tenant_id', tenant.id).gte('sale_date', start).lte('sale_date', end),
      supabase.from('expenses').select('*').eq('tenant_id', tenant.id).gte('expense_date', start).lte('expense_date', end),
      supabase.from('purchases').select('*').eq('tenant_id', tenant.id).gte('purchase_date', start).lte('purchase_date', end),
    ]);
    setSales((s.data as Sale[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setPurchases((p.data as Purchase[]) ?? []);
    setLoading(false);
  })(); }, [tenant, year]);

  const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const expensesTotal = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const purchasesTotal = purchases.reduce((s, x) => s + Number(x.total), 0);
  const cogs = purchasesTotal; // simplified
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expensesTotal;

  const monthly = useMemo(() => {
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
  }, [sales, expenses, purchases]);

  const years = [String(new Date().getFullYear()), String(new Date().getFullYear() - 1), String(new Date().getFullYear() - 2)];

  return (
    <div>
      <PageHeader
        title="Comptabilité"
        subtitle={`Exercice ${year}`}
        action={
          <div className="flex gap-2">
            <Select value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
            <button onClick={() => exportCSV('comptabilite.csv', monthly.map((m) => ({ mois: m.month, revenu: m.revenu, depenses: m.depenses, achats: m.achats, resultat: m.resultat })))} className="btn-ghost"><Download size={16} /> Export</button>
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
