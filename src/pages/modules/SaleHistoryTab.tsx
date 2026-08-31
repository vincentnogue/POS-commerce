import { useEffect, useState } from 'react';
import { Search, Printer, Receipt, FileText, Download, Mail } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { EmptyState, Modal, useToast } from '../../components/ui';
import { printSaleReceipt } from '../../lib/receipt';
import { downloadInvoicePdf, printInvoicePdf, type BrandSettings } from '../../lib/invoicePdf';
import type { Invoice, InvoiceItem, Customer } from '../../lib/types';

type SaleRow = {
  id: string;
  reference: string;
  sale_date: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  payment_method: string | null;
  payment_reference: string | null;
  payment_status: string;
  customer_id: string | null;
  user_id: string | null;
  customer?: { name: string; email: string | null } | null;
};

// Every sale has been persisted with its line items since day one — the
// original gap was that there was no screen to look an old sale up by
// reference/customer/date and reprint its receipt (fixed below). A
// second, separate gap: a completed POS sale and the Invoices module
// were entirely disconnected — sales.total/subtotal/tax_total were never
// copied into an invoices row and invoices.sale_id was never set from a
// checkout, so a sale had no way to produce/view/reprint a real invoice
// document (only the receipt). This tab now also lets you generate a
// real invoice from a sale (or open the existing one if already
// generated), reusing the exact same invoice PDF used by the Invoices
// module (src/lib/invoicePdf.ts) — not a second, different-looking
// document.
export function SaleHistoryTab() {
  const { tenant } = useAuth();
  const { t, lang, locale } = useI18n();
  const toast = useToast();
  const currency = tenant?.currency ?? 'XOF';

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [invoiceBySale, setInvoiceBySale] = useState<Record<string, Invoice>>({});
  const [invoiceBusy, setInvoiceBusy] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandSettings>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewItems, setViewItems] = useState<InvoiceItem[]>([]);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!tenant) return;
    supabase.from('brand_settings').select('*').eq('tenant_id', tenant.id).maybeSingle()
      .then(({ data }) => setBrand((data as BrandSettings) ?? null));
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const { data } = await supabase.from('tenant_members').select('user_id, display_name').eq('tenant_id', tenant.id);
      const map: Record<string, string> = {};
      (data ?? []).forEach((m: any) => { if (m.user_id) map[m.user_id] = m.display_name ?? t('pos.history.unnamedStaff'); });
      setStaffNames(map);
    })();
  }, [tenant, t]);

  // BUG FIX: this tab used to show nothing at all until the user typed a
  // search and pressed the button — a blank "Historique" tab looks exactly
  // like "receipts aren't showing up", even though every sale was already
  // being recorded correctly. Load the most recent sales automatically so
  // there's always something to see; search/date filters narrow it down.
  useEffect(() => {
    if (!tenant) return;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .select('id, reference, sale_date, subtotal, tax_total, discount_total, total, payment_method, payment_reference, payment_status, customer_id, user_id, customer:customers(name, email)')
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
    const rows = (data as any[]) ?? [];
    setSales(rows);
    setLoading(false);

    // Which of these sales already have a real invoice generated —
    // this is the actual sale<->invoice sync, read straight from
    // invoices.sale_id (no separate/duplicated status to drift out of
    // sync with).
    if (rows.length > 0) {
      const { data: invs } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenant.id)
        .in('sale_id', rows.map((s) => s.id));
      const map: Record<string, Invoice> = {};
      (invs ?? []).forEach((inv: any) => { if (inv.sale_id) map[inv.sale_id] = inv; });
      setInvoiceBySale(map);
    } else {
      setInvoiceBySale({});
    }
  };

  const paymentLabel = (m: string | null) =>
    m === 'cash' ? t('pos.pay.cash') : m === 'card' ? t('pos.pay.cardLabel') : m === 'mobile_money' ? t('pos.pay.mobileMoney') : (m ?? '—');

  const reprint = async (sale: SaleRow) => {
    // BUG FIX: this used to fetch line items (await) BEFORE printSaleReceipt
    // called window.open() internally. Browsers block window.open() once
    // it's no longer a direct synchronous result of the click — silently,
    // no error — which is exactly the "receipt not visible from history"
    // bug. Opening the window here, synchronously, first thing on click,
    // keeps it tied to the user gesture; the data loads into it afterward.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // A real, visible failure now instead of nothing happening: this
      // path only hits if the browser's popup blocker is on and the user
      // hasn't allowed pop-ups for this site.
      alert(t('pos.history.popupBlocked'));
      return;
    }

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
      printWindow,
    );
  };

  // Generate a real invoice from a sale — same tables/columns/number
  // format as a manually-created invoice in the Invoices module
  // (src/pages/modules/InvoicesPage.tsx save()), just populated from the
  // sale's own already-computed totals and its real sale_items instead of
  // re-keying everything by hand. Linked via invoices.sale_id, which is
  // what makes this a real, queryable sync instead of a one-off copy.
  const generateInvoice = async (sale: SaleRow): Promise<Invoice | null> => {
    if (!tenant) return null;
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
    const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
    const num = `FAC-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`;
    const { data: inv, error } = await supabase.from('invoices').insert({
      tenant_id: tenant.id,
      customer_id: sale.customer_id,
      sale_id: sale.id,
      number: num,
      status: sale.payment_status === 'paid' ? 'paid' : 'sent',
      issue_date: sale.sale_date.slice(0, 10),
      subtotal: sale.subtotal,
      tax_total: sale.tax_total,
      discount_total: sale.discount_total,
      total: sale.total,
      paid_amount: sale.payment_status === 'paid' ? sale.total : 0,
      notes: t('pos.history.invoiceGeneratedNote', { reference: sale.reference }),
    }).select().single();
    if (error) { toast('error', error.message); return null; }
    if (inv && items && items.length > 0) {
      const { error: itemsErr } = await supabase.from('invoice_items').insert(items.map((it: any) => ({
        invoice_id: inv.id, product_id: it.product_id, name: it.name, quantity: it.quantity,
        unit_price: it.unit_price, discount: it.discount, tax_rate: it.tax_rate, total: it.total,
      })));
      if (itemsErr) { toast('error', itemsErr.message); return null; }
    }
    setInvoiceBySale((m) => ({ ...m, [sale.id]: inv }));
    return inv as Invoice;
  };

  const openInvoice = async (sale: SaleRow) => {
    setInvoiceBusy(sale.id);
    try {
      let inv = invoiceBySale[sale.id];
      if (!inv) {
        const created = await generateInvoice(sale);
        if (!created) return;
        inv = created;
        toast('success', t('pos.history.invoiceGenerated', { number: inv.number }));
      }
      const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
      const customer = sale.customer_id
        ? (await supabase.from('customers').select('*').eq('id', sale.customer_id).maybeSingle()).data as Customer | null
        : null;
      setViewItems((items as InvoiceItem[]) ?? []);
      setViewCustomer(customer);
      setViewInvoice(inv);
    } finally {
      setInvoiceBusy(null);
    }
  };

  const pdfInput = () => ({ invoice: viewInvoice as Invoice, items: viewItems, tenant, brand, customer: viewCustomer, currency });
  const handlePrintInvoice = async () => { if (viewInvoice) await printInvoicePdf(pdfInput()); };
  const handleDownloadInvoice = async () => { if (viewInvoice) await downloadInvoicePdf(pdfInput()); };

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
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => reprint(s)} className="rounded-lg border border-ink-200 dark:border-ink-700 px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:hover:bg-brand-900/25">
                        <Printer size={13} className="inline -mt-0.5 mr-1" /> {t('pos.history.reprint')}
                      </button>
                      <button
                        onClick={() => openInvoice(s)}
                        disabled={invoiceBusy === s.id}
                        className="rounded-lg border border-ink-200 dark:border-ink-700 px-2.5 py-1 text-xs font-medium text-ink-700 dark:text-ink-200 transition hover:bg-brand-50 dark:hover:bg-brand-900/25 disabled:opacity-50"
                      >
                        <FileText size={13} className="inline -mt-0.5 mr-1" />
                        {invoiceBusy === s.id ? t('common.loading') : invoiceBySale[s.id] ? t('pos.history.viewInvoice') : t('pos.history.generateInvoice')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Real invoice viewer — same PDF as the Invoices module
          (src/lib/invoicePdf.ts), opened either for an invoice already
          linked to this sale or one just generated from it. */}
      <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title={viewInvoice?.number ?? ''} maxWidth="max-w-lg">
        {viewInvoice && (
          <div>
            <div className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-ink-500 dark:text-ink-400">{t('pos.history.col.customer')}</span><span className="font-medium text-ink-900 dark:text-ink-50">{viewCustomer?.name ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-ink-500 dark:text-ink-400">{t('invoices.col.total')}</span><span className="font-medium text-ink-900 dark:text-ink-50">{formatMoney(Number(viewInvoice.total), currency)}</span></div>
            </div>
            <table className="w-full text-sm mb-4">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-400 dark:text-ink-500">
                <th className="py-2">{t('pos.receipt.designation')}</th><th className="py-2 text-right">{t('pos.receipt.qty')}</th><th className="py-2 text-right">{t('pos.receipt.total')}</th>
              </tr></thead>
              <tbody>
                {viewItems.map((it) => (
                  <tr key={it.id} className="border-b border-ink-50 dark:border-ink-800 last:border-0">
                    <td className="py-2 text-ink-900 dark:text-ink-50">{it.name}</td>
                    <td className="py-2 text-right text-ink-600 dark:text-ink-300">{it.quantity}</td>
                    <td className="py-2 text-right font-medium text-ink-900 dark:text-ink-50">{formatMoney(Number(it.total), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={handleDownloadInvoice} className="btn-ghost text-sm"><Download size={15} /> {t('invoices.downloadPdf')}</button>
              <button onClick={handlePrintInvoice} className="btn-primary text-sm"><Printer size={15} /> {t('invoices.print')}</button>
              {viewCustomer?.email && (
                <a
                  href={`mailto:${viewCustomer.email}?subject=${encodeURIComponent(t('invoices.emailSubject', { number: viewInvoice.number }))}&body=${encodeURIComponent(t('invoices.emailBody', { number: viewInvoice.number, total: formatMoney(Number(viewInvoice.total), currency) }))}`}
                  className="btn-ghost text-sm"
                >
                  <Mail size={15} /> {t('invoices.sendEmail')}
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
