import { useEffect, useState } from 'react';
import { Search, Printer, Receipt } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { EmptyState } from '../../components/ui';
import { printSaleReceipt } from '../../lib/receipt';

type SaleRow = {
  id: string;
  reference: string;
  sale_date: string;
  total: number;
  payment_method: string | null;
  payment_reference: string | null;
  customer_id: string | null;
  user_id: string | null;
  customer?: { name: string } | null;
};

// Every sale has been persisted with its line items since day one — the
// gap was never the data, it was that there was no screen to look an old
// sale up by reference/customer/date and reprint its receipt. This panel
// reuses the exact same receipt layout as a fresh checkout (src/lib/receipt.ts).
export function SaleHistoryTab() {
  const { tenant } = useAuth();
  const { t, lang, locale } = useI18n();
  const currency = tenant?.currency ?? 'XOF';

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const { data } = await supabase.from('tenant_members').select('user_id, display_name').eq('tenant_id', tenant.id);
      const map: Record<string, string> = {};
      (data ?? []).forEach((m: any) => { if (m.user_id) map[m.user_id] = m.display_name ?? t('pos.history.unnamedStaff'); });
      setStaffNames(map);
    })();
  }, [tenant]);

  const runSearch = async () => {
    if (!tenant) return;
    setLoading(true);
    setSearched(true);

    let matchingCustomerIds: string[] = [];
    if (search.trim()) {
      const { data: matches } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenant.id)
        .ilike('name', `%${search.trim()}%`);
      matchingCustomerIds = (matches ?? []).map((c: any) => c.id);
    }

    let query = supabase
      .from('sales')
      .select('id, reference, sale_date, total, payment_method, payment_reference, customer_id, user_id, customer:customers(name)')
      .eq('tenant_id', tenant.id)
      .order('sale_date', { ascending: false })
      .limit(100);

    if (dateFilter) {
      query = query.gte('sale_date', `${dateFilter}T00:00:00`).lte('sale_date', `${dateFilter}T23:59:59`);
    }

    if (search.trim()) {
      const orParts = [`reference.ilike.%${search.trim()}%`];
      if (matchingCustomerIds.length > 0) {
        orParts.push(`customer_id.in.(${matchingCustomerIds.join(',')})`);
      }
      query = query.or(orParts.join(','));
    }

    const { data } = await query;
    setSales((data as any[]) ?? []);
    setLoading(false);
  };

  const paymentLabel = (m: string | null) =>
    m === 'cash' ? t('pos.pay.cash') : m === 'card' ? t('pos.pay.cardLabel') : m === 'mobile_money' ? t('pos.pay.mobileMoney') : (m ?? '—');

  const reprint = async (sale: SaleRow) => {
    const { data: items } = await supabase.from('sale_items').select('name, quantity, unit_price').eq('sale_id', sale.id);
    printSaleReceipt(
      {
        reference: sale.reference,
        date: new Date(sale.sale_date),
        items: (items ?? []).map((i: any) => ({ name: i.name, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
        total: Number(sale.total),
        paymentMethod: sale.payment_method ?? '',
        paymentReference: sale.payment_reference,
        staffName: sale.user_id ? staffNames[sale.user_id] ?? null : null,
      },
      {
        title: t('pos.receipt.title'),
        receipt: t('pos.receipt.receipt'),
        date: t('pos.receipt.date'),
        designation: t('pos.receipt.designation'),
        qty: t('pos.receipt.qty'),
        price: t('pos.receipt.price'),
        total: t('pos.receipt.total'),
        paymentMode: t('pos.receipt.paymentMode'),
        refLabel: t('pos.receipt.refLabel'),
        status: t('pos.receipt.status'),
        statusPaid: t('pos.receipt.statusPaid'),
        thanks: t('pos.receipt.thanks'),
        keepProof: t('pos.receipt.keepProof'),
        staffLabel: t('pos.history.staffLabel'),
        paymentMethodLabel: paymentLabel,
      },
      { businessName: tenant?.name ?? '', currency, lang, locale, formatMoney },
    );
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            placeholder={t('pos.history.searchPlaceholder')}
            className="input pl-9"
          />
        </div>
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="input w-auto" />
        <button onClick={runSearch} className="btn-primary">{t('pos.history.searchBtn')}</button>
      </div>

      {!searched ? (
        <EmptyState icon={Receipt} title={t('pos.history.empty.title')} description={t('pos.history.empty.desc')} />
      ) : loading ? (
        <p className="py-10 text-center text-sm text-ink-400 dark:text-ink-500">{t('common.loading')}</p>
      ) : sales.length === 0 ? (
        <EmptyState icon={Receipt} title={t('pos.history.noResults.title')} description={t('pos.history.noResults.desc')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-400 dark:text-ink-500">
                <th className="py-2">{t('pos.history.col.reference')}</th>
                <th className="py-2">{t('common.date')}</th>
                <th className="py-2">{t('pos.history.col.customer')}</th>
                <th className="py-2">{t('pos.history.col.staff')}</th>
                <th className="py-2 text-right">{t('pos.history.col.total')}</th>
                <th className="py-2">{t('pos.history.col.payment')}</th>
                <th className="py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-ink-50 dark:border-ink-800 last:border-0">
                  <td className="py-2.5 font-medium text-ink-900 dark:text-ink-50">{s.reference}</td>
                  <td className="py-2.5 text-ink-600 dark:text-ink-300">{new Date(s.sale_date).toLocaleString(locale)}</td>
                  <td className="py-2.5 text-ink-600 dark:text-ink-300">{s.customer?.name ?? '—'}</td>
                  <td className="py-2.5 text-ink-600 dark:text-ink-300">{s.user_id ? staffNames[s.user_id] ?? '—' : '—'}</td>
                  <td className="py-2.5 text-right font-medium text-ink-900 dark:text-ink-50">{formatMoney(Number(s.total), currency)}</td>
                  <td className="py-2.5 text-ink-600 dark:text-ink-300">{paymentLabel(s.payment_method)}</td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => reprint(s)} className="rounded-lg border border-ink-200 dark:border-ink-700 px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:hover:bg-brand-900/25">
                      <Printer size={13} className="inline -mt-0.5 mr-1" /> {t('pos.history.reprint')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
