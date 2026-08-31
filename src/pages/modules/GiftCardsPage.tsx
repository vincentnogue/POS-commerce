import { useEffect, useState, useMemo } from 'react';
import { Plus, Gift, RefreshCw, Ban, History } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
import { DataTable, SearchInput, Field } from '../../components/DataTable';
import { issueGiftCard, rechargeGiftCard, cancelGiftCard, listGiftCards } from '../../lib/giftCards';
import type { GiftCard, GiftCardTransaction, Customer } from '../../lib/types';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-success-50 text-success-700 dark:bg-success-900/25',
  depleted: 'bg-ink-100 text-ink-500 dark:bg-ink-800',
  expired: 'bg-warning-50 text-warning-700 dark:bg-warning-900/25',
  cancelled: 'bg-error-50 text-error-600 dark:bg-error-900/25',
  inactive: 'bg-ink-100 text-ink-500 dark:bg-ink-800',
};

export function GiftCardsPage() {
  const toast = useToast();
  const { t, formatDate } = useI18n();
  const { tenant } = useAuth();
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const currency = tenant?.currency ?? 'XOF';

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueAmount, setIssueAmount] = useState('');
  const [issueCustomerId, setIssueCustomerId] = useState('');
  const [issueExpiresAt, setIssueExpiresAt] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);

  const [rechargeCard, setRechargeCard] = useState<GiftCard | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeSubmitting, setRechargeSubmitting] = useState(false);

  const [historyCard, setHistoryCard] = useState<GiftCard | null>(null);
  const [historyTx, setHistoryTx] = useState<GiftCardTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data, error } = await listGiftCards(tenant.id);
    if (error) toast('error', error);
    setCards(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant]);

  useEffect(() => { (async () => {
    if (!tenant) return;
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
    setCustomers((data as Customer[]) ?? []);
  })(); }, [tenant]);

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return cards.filter((c) => !q || c.code.toLowerCase().includes(q) || customerName(c.customer_id).toLowerCase().includes(q));
  }, [cards, search, customers]);

  const openIssue = () => { setIssueAmount(''); setIssueCustomerId(''); setIssueExpiresAt(''); setIssueOpen(true); };

  const submitIssue = async () => {
    if (!tenant) return;
    const amount = Number(issueAmount);
    if (!amount || amount <= 0) { toast('error', t('giftCards.err.invalidAmount')); return; }
    setIssueSubmitting(true);
    const { data, error } = await issueGiftCard({
      tenantId: tenant.id,
      amount,
      customerId: issueCustomerId || null,
      expiresAt: issueExpiresAt ? new Date(issueExpiresAt).toISOString() : null,
    });
    setIssueSubmitting(false);
    if (error) { toast('error', error); return; }
    setIssueOpen(false);
    toast('success', t('giftCards.toast.issued', { code: data?.code ?? '' }));
    load();
  };

  const submitRecharge = async () => {
    if (!tenant || !rechargeCard) return;
    const amount = Number(rechargeAmount);
    if (!amount || amount <= 0) { toast('error', t('giftCards.err.invalidAmount')); return; }
    setRechargeSubmitting(true);
    const { error } = await rechargeGiftCard({ tenantId: tenant.id, code: rechargeCard.code, amount });
    setRechargeSubmitting(false);
    if (error) { toast('error', error); return; }
    setRechargeCard(null);
    setRechargeAmount('');
    toast('success', t('giftCards.toast.recharged'));
    load();
  };

  const cancel = async (card: GiftCard) => {
    if (!tenant) return;
    if (!confirm(t('giftCards.confirmCancel', { code: card.code }))) return;
    const { error } = await cancelGiftCard({ tenantId: tenant.id, code: card.code });
    if (error) { toast('error', error); return; }
    load();
  };

  const openHistory = async (card: GiftCard) => {
    if (!tenant) return;
    setHistoryCard(card);
    setHistoryLoading(true);
    const { data } = await supabase
      .from('gift_card_transactions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('gift_card_id', card.id)
      .order('created_at', { ascending: false });
    setHistoryTx((data as GiftCardTransaction[]) ?? []);
    setHistoryLoading(false);
  };

  return (
    <div>
      <PageHeader
        title={t('giftCards.title')}
        subtitle={t('giftCards.subtitle', { count: cards.length })}
        action={<button onClick={openIssue} className="btn-primary"><Plus size={16} /> {t('giftCards.new')}</button>}
      />
      <div className="card p-5">
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} /></div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Gift} title={t('giftCards.empty.title')} description={t('giftCards.empty.desc')} action={<button onClick={openIssue} className="btn-primary"><Plus size={15} /> {t('common.add')}</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'code', label: t('giftCards.col.code'), render: (c) => <span className="font-mono font-medium text-ink-900 dark:text-ink-50">{c.code}</span> },
              { key: 'customer', label: t('giftCards.col.customer'), render: (c) => <span className="text-ink-600 dark:text-ink-300">{customerName(c.customer_id)}</span> },
              { key: 'balance', label: t('giftCards.col.balance'), className: 'text-right', render: (c) => <span className="font-medium text-ink-900 dark:text-ink-50">{formatMoney(c.balance, c.currency || currency)}</span> },
              { key: 'initial', label: t('giftCards.col.initial'), className: 'text-right', render: (c) => <span className="text-ink-500 dark:text-ink-400">{formatMoney(c.initial_balance, c.currency || currency)}</span> },
              { key: 'status', label: t('giftCards.col.status'), render: (c) => (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? ''}`}>{t(`giftCards.status.${c.status}`)}</span>
              )},
              { key: 'expires', label: t('giftCards.col.expires'), render: (c) => c.expires_at ? <span className="text-ink-500 dark:text-ink-400">{formatDate(new Date(c.expires_at))}</span> : <span className="text-ink-400 dark:text-ink-500">—</span> },
              { key: 'actions', label: '', className: 'text-right', render: (c) => (
                <div className="flex justify-end gap-2">
                  <button title={t('giftCards.action.history')} onClick={() => openHistory(c)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><History size={15} /></button>
                  {c.status !== 'cancelled' && (
                    <button title={t('giftCards.action.recharge')} onClick={() => { setRechargeCard(c); setRechargeAmount(''); }} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><RefreshCw size={15} /></button>
                  )}
                  {c.status !== 'cancelled' && (
                    <button title={t('giftCards.action.cancel')} onClick={() => cancel(c)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Ban size={15} /></button>
                  )}
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>

      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title={t('giftCards.new')} maxWidth="max-w-lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t('giftCards.field.amount')}>
              <input type="number" value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} className="input" placeholder="10000" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('giftCards.field.customer')} hint={t('giftCards.field.customerHint')}>
              <select value={issueCustomerId} onChange={(e) => setIssueCustomerId(e.target.value)} className="input">
                <option value="">{t('giftCards.field.noCustomer')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('giftCards.field.expiresAt')} hint={t('giftCards.field.expiresHint')}>
              <input type="date" value={issueExpiresAt} onChange={(e) => setIssueExpiresAt(e.target.value)} className="input" />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setIssueOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={submitIssue} disabled={issueSubmitting} className="btn-primary disabled:opacity-50">{t('common.create')}</button>
        </div>
      </Modal>

      <Modal open={!!rechargeCard} onClose={() => setRechargeCard(null)} title={t('giftCards.recharge.title', { code: rechargeCard?.code ?? '' })} maxWidth="max-w-sm">
        <Field label={t('giftCards.field.amount')}>
          <input type="number" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} className="input" placeholder="5000" />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setRechargeCard(null)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={submitRecharge} disabled={rechargeSubmitting} className="btn-primary disabled:opacity-50">{t('giftCards.action.recharge')}</button>
        </div>
      </Modal>

      <Modal open={!!historyCard} onClose={() => setHistoryCard(null)} title={t('giftCards.history.title', { code: historyCard?.code ?? '' })}>
        <div className="space-y-3">
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/25 p-3 text-center">
            <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('giftCards.col.balance')}</p>
            <p className="text-2xl font-medium text-brand-700">{formatMoney(historyCard?.balance ?? 0, historyCard?.currency || currency)}</p>
          </div>
          {historyLoading ? (
            <p className="py-4 text-center text-sm text-ink-400">{t('common.loading')}</p>
          ) : historyTx.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-400">{t('giftCards.history.empty')}</p>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {historyTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-2 text-sm">
                  <div>
                    <p className="text-ink-900 dark:text-ink-50">{t(`giftCards.txType.${tx.type}`)}{tx.notes ? ` — ${tx.notes}` : ''}</p>
                    <p className="text-xs text-ink-400 dark:text-ink-500">{formatDate(new Date(tx.created_at))}</p>
                  </div>
                  <span className={`font-medium ${tx.amount >= 0 ? 'text-success-700' : 'text-error-600'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount, historyCard?.currency || currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
