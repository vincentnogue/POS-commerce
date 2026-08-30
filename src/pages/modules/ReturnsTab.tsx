import { useEffect, useState } from 'react';
import { Search, RotateCcw, Printer } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { EmptyState, useToast } from '../../components/ui';
import { printReturnReceipt } from '../../lib/receipt';
import type { Customer } from '../../lib/types';

type SaleRow = {
  id: string;
  reference: string;
  sale_date: string;
  total: number;
  store_id: string | null;
  customer_id: string | null;
  customer?: { name: string } | null;
};

type SaleItemRow = {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
};

// "Créer le module return ou exchange bien développé et cohérent" — a
// customer brings back a past sale (looked up by reference), picks which
// lines and how many units to return or exchange, and the refund method
// is limited to whatever the manager allows for this account
// (tenant.return_settings). Submitting calls process_sale_return(), which
// atomically restocks inventory, writes the stock movement and (for a
// store-credit refund) tops up the customer's credit balance — so this
// always stays consistent with Stock and Reports, exactly as requested.
export function ReturnsTab() {
  const { tenant, user, can } = useAuth();
  const { t, lang, locale } = useI18n();
  const toast = useToast();
  const currency = tenant?.currency ?? 'XOF';
  const canProcess = can('pos', 'create');

  const settings = tenant?.return_settings ?? { allow_cash: true, allow_card: true, allow_store_credit: true, allow_exchange: true };

  const [refSearch, setRefSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [sale, setSale] = useState<SaleRow | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([]);
  const [alreadyReturned, setAlreadyReturned] = useState<Record<string, number>>({});
  const [notFound, setNotFound] = useState(false);

  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [kind, setKind] = useState<'return' | 'exchange'>('return');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'mobile_money' | 'store_credit' | 'none'>('cash');
  const [reason, setReason] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastReturn, setLastReturn] = useState<{ reference: string; items: SaleItemRow[]; amount: number; method: string; kind: 'return' | 'exchange' } | null>(null);

  // BUG FIX: store-credit refunds require a customer to credit, but a
  // walk-in sale (very common at a POS) often has no customer_id at all —
  // the form used to just fail with "A customer must be selected to issue
  // store credit" and gave the cashier no way to actually attach one. Now,
  // when the original sale has no customer, a search picker appears right
  // where the error used to be a dead end.
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [pickedCustomerId, setPickedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name')
      .then(({ data }) => setCustomers((data as Customer[]) ?? []));
  }, [tenant]);

  const resolvedCustomerId = sale?.customer_id ?? pickedCustomerId;
  const pickedCustomer = customers.find((c) => c.id === pickedCustomerId);

  const availableMethods = [
    settings.allow_cash !== false ? 'cash' : null,
    settings.allow_card !== false ? 'card' : null,
    settings.allow_card !== false ? 'mobile_money' : null,
    settings.allow_store_credit !== false ? 'store_credit' : null,
  ].filter(Boolean) as string[];

  const methodLabel = (m: string) =>
    m === 'cash' ? t('pos.pay.cash') : m === 'card' ? t('pos.pay.cardLabel') : m === 'mobile_money' ? t('pos.pay.mobileMoney') : m === 'store_credit' ? t('returns.method.storeCredit') : t('returns.method.none');

  const searchSale = async () => {
    if (!tenant || !refSearch.trim()) return;
    setSearching(true);
    setNotFound(false);
    setSale(null);
    setSaleItems([]);
    setQtyById({});
    setLastReturn(null);

    const { data } = await supabase
      .from('sales')
      .select('id, reference, sale_date, total, store_id, customer_id, customer:customers(name)')
      .eq('tenant_id', tenant.id)
      .ilike('reference', refSearch.trim())
      .maybeSingle();

    if (!data) { setNotFound(true); setSearching(false); return; }

    const [{ data: items }, { data: returns }] = await Promise.all([
      supabase.from('sale_items').select('id, product_id, name, quantity, unit_price').eq('sale_id', data.id),
      supabase.from('sale_returns').select('id, sale_return_items(sale_item_id, quantity)').eq('original_sale_id', data.id),
    ]);

    const returnedMap: Record<string, number> = {};
    (returns ?? []).forEach((r: any) => {
      (r.sale_return_items ?? []).forEach((ri: any) => {
        if (ri.sale_item_id) returnedMap[ri.sale_item_id] = (returnedMap[ri.sale_item_id] ?? 0) + Number(ri.quantity);
      });
    });

    setSale(data as any);
    setSaleItems((items as any[]) ?? []);
    setAlreadyReturned(returnedMap);
    setPickedCustomerId(null);
    setCustomerSearch('');
    setSearching(false);
  };

  const remainingQty = (item: SaleItemRow) => Number(item.quantity) - (alreadyReturned[item.id] ?? 0);

  const setQty = (id: string, qty: number, max: number) => {
    setQtyById((m) => ({ ...m, [id]: Math.max(0, Math.min(qty, max)) }));
  };

  const selectedItems = saleItems.filter((i) => (qtyById[i.id] ?? 0) > 0);
  const refundTotal = selectedItems.reduce((s, i) => s + (qtyById[i.id] ?? 0) * Number(i.unit_price), 0);

  const submitReturn = async () => {
    if (!tenant || !user || !sale || selectedItems.length === 0) return;
    if (refundMethod === 'store_credit' && !resolvedCustomerId) {
      toast('error', t('returns.err.customerRequired'));
      return;
    }
    setSubmitting(true);
    const { data: returnId, error } = await supabase.rpc('process_sale_return', {
      p_tenant_id: tenant.id,
      p_sale_id: sale.id,
      p_items: selectedItems.map((i) => ({ sale_item_id: i.id, product_id: i.product_id, name: i.name, quantity: qtyById[i.id], unit_price: Number(i.unit_price) })),
      p_refund_method: kind === 'exchange' ? 'none' : refundMethod,
      p_kind: kind,
      p_reason: reason || null,
      p_customer_id: resolvedCustomerId,
      p_user_id: user.id,
      p_staff_code: staffCode || null,
    });
    setSubmitting(false);

    if (error) { toast('error', error.message); return; }

    setLastReturn({
      reference: String(returnId).slice(0, 8).toUpperCase(),
      items: selectedItems.map((i) => ({ ...i, quantity: qtyById[i.id] })),
      amount: refundTotal,
      method: kind === 'exchange' ? 'none' : refundMethod,
      kind,
    });
    toast('success', kind === 'exchange' ? t('returns.toast.exchangeProcessed') : t('returns.toast.returnProcessed'));
    setQtyById({});
    setReason('');
    setStaffCode('');
    // Reload remaining quantities for this sale so the same screen reflects it immediately.
    await searchSale();
  };

  const printSlip = () => {
    if (!lastReturn || !sale) return;
    printReturnReceipt(
      {
        reference: lastReturn.reference,
        originalReference: sale.reference,
        date: new Date(),
        items: lastReturn.items.map((i) => ({ name: i.name, quantity: i.quantity, unit_price: Number(i.unit_price) })),
        refundAmount: lastReturn.amount,
        refundMethod: lastReturn.method,
        kind: lastReturn.kind,
      },
      {
        title: lastReturn.kind === 'exchange' ? t('returns.slip.exchangeTitle') : t('returns.slip.returnTitle'),
        slipNumber: t('returns.slip.number'),
        date: t('pos.receipt.date'),
        originalSale: t('returns.slip.originalSale'),
        designation: t('pos.receipt.designation'),
        qty: t('pos.receipt.qty'),
        price: t('pos.receipt.price'),
        total: t('pos.receipt.total'),
        refundMethod: t('returns.slip.refundMethod'),
        refundAmount: t('returns.slip.refundAmount'),
        thanks: t('pos.receipt.thanks'),
        refundMethodLabel: methodLabel,
      },
      { businessName: tenant?.name ?? '', currency, lang, locale, formatMoney },
    );
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
          <input
            value={refSearch}
            onChange={(e) => setRefSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') searchSale(); }}
            placeholder={t('returns.searchPlaceholder')}
            className="input pl-9"
          />
        </div>
        <button onClick={searchSale} disabled={searching} className="btn-primary">{searching ? t('common.loading') : t('returns.searchBtn')}</button>
      </div>

      {!sale && !notFound && (
        <EmptyState icon={RotateCcw} title={t('returns.empty.title')} description={t('returns.empty.desc')} />
      )}

      {notFound && (
        <EmptyState icon={RotateCcw} title={t('returns.notFound.title')} description={t('returns.notFound.desc')} />
      )}

      {sale && (
        <div className="space-y-5">
          <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink-900 dark:text-ink-50">{sale.reference}</span>
              <span className="text-ink-500 dark:text-ink-400">{new Date(sale.sale_date).toLocaleString(locale)}</span>
              <span className="text-ink-600 dark:text-ink-300">{sale.customer?.name ?? t('pos.walkInCustomer')}</span>
              <span className="font-medium text-ink-900 dark:text-ink-50">{formatMoney(Number(sale.total), currency)}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-400 dark:text-ink-500">
                  <th className="py-2">{t('pos.receipt.designation')}</th>
                  <th className="py-2 text-right">{t('returns.col.sold')}</th>
                  <th className="py-2 text-right">{t('returns.col.remaining')}</th>
                  <th className="py-2 text-right">{t('returns.col.toReturn')}</th>
                </tr>
              </thead>
              <tbody>
                {saleItems.map((i) => {
                  const remaining = remainingQty(i);
                  return (
                    <tr key={i.id} className="border-b border-ink-50 dark:border-ink-800 last:border-0">
                      <td className="py-2.5 text-ink-900 dark:text-ink-50">{i.name}</td>
                      <td className="py-2.5 text-right text-ink-600 dark:text-ink-300">{i.quantity}</td>
                      <td className="py-2.5 text-right text-ink-600 dark:text-ink-300">{remaining}</td>
                      <td className="py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          disabled={remaining <= 0 || !canProcess}
                          value={qtyById[i.id] ?? 0}
                          onChange={(e) => setQty(i.id, Number(e.target.value), remaining)}
                          className="input w-20 py-1 text-right text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canProcess && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('returns.kind')}</label>
                <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="input">
                  <option value="return">{t('returns.kind.return')}</option>
                  {settings.allow_exchange !== false && <option value="exchange">{t('returns.kind.exchange')}</option>}
                </select>
              </div>
              {kind === 'return' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('returns.refundMethod')}</label>
                  <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as any)} className="input">
                    {availableMethods.length === 0 && <option value="cash">{t('pos.pay.cash')}</option>}
                    {availableMethods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
                  </select>
                </div>
              )}
              {kind === 'return' && refundMethod === 'store_credit' && !sale.customer_id && (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('returns.pickCustomer')}</label>
                  <input
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      const match = customers.find((c) => c.name.toLowerCase().includes(e.target.value.toLowerCase()));
                      setPickedCustomerId(match?.id ?? null);
                    }}
                    className="input"
                    placeholder={t('pos.searchCustomer')}
                  />
                  {pickedCustomer ? (
                    <p className="mt-1 text-xs text-success-700 dark:text-success-400">{t('pos.customerPrefix')}: {pickedCustomer.name}</p>
                  ) : (
                    <p className="mt-1 text-xs text-warning-700 dark:text-warning-400">{t('returns.pickCustomerHint')}</p>
                  )}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('stock.staffIdOptional')}</label>
                <input value={staffCode} onChange={(e) => setStaffCode(e.target.value)} className="input font-mono" placeholder="STF-001" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('returns.reason')}</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder={t('returns.reasonPlaceholder')} />
              </div>
            </div>
          )}

          {canProcess && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 p-3">
              <span className="text-sm text-ink-600 dark:text-ink-300">{t('returns.totalToRefund')}: <strong className="text-ink-900 dark:text-ink-50">{formatMoney(refundTotal, currency)}</strong></span>
              <button
                onClick={submitReturn}
                disabled={selectedItems.length === 0 || submitting || (kind === 'return' && refundMethod === 'store_credit' && !resolvedCustomerId)}
                className="btn-primary"
              >
                <RotateCcw size={15} /> {submitting ? t('returns.processing') : kind === 'exchange' ? t('returns.processExchange') : t('returns.processReturn')}
              </button>
            </div>
          )}

          {lastReturn && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-200 bg-success-50 dark:border-success-900/40 dark:bg-success-900/20 px-4 py-2.5 text-sm text-success-700 dark:text-success-300">
              <span>{t('returns.toast.done', { ref: lastReturn.reference })}</span>
              <button onClick={printSlip} className="text-xs font-semibold underline flex items-center gap-1"><Printer size={13} /> {t('returns.printSlip')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
