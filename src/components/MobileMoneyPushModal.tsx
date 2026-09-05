import { useState, useEffect, useCallback, useRef } from 'react';
import { Smartphone, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { useToast } from './ui';

// Real push-to-phone mobile money — a different UI shape from
// OnlinePaymentModal (QR/link) on purpose: M-Pesa's STK Push and Orange
// Money's payment API don't return a shareable link at all, they send a
// prompt straight to the customer's phone that they approve with their
// mobile money PIN. So this asks for the phone number instead of
// generating anything to scan, then polls the same way.
//
// Both edge functions (mpesa-payments, orange-money-payments) already
// existed with real, working logic and the tenant-membership security
// check — they were simply never called from anywhere in the app, same
// root cause as every other orphaned marketplace provider found this
// session.

type PushProviderKey = 'mpesa' | 'orange_money';

interface ConnectedProvider {
  key: PushProviderKey;
  providerName: string;
  connectionId: string;
}

interface Props {
  tenantId: string;
  countryCode: string;
  amount: number;
  currency: string;
  saleReference?: string;
  onClose: () => void;
  onConfirmed: (reference: string) => void;
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

async function pushToPhone(provider: PushProviderKey, req: Props, connectionId: string, phone: string) {
  const headers = await authHeaders();

  if (provider === 'mpesa') {
    const res = await fetch(`${FUNCTIONS_BASE}/mpesa-payments`, {
      method: 'POST', headers,
      body: JSON.stringify({
        action: 'initiate_stk_push', tenant_id: req.tenantId, connection_id: connectionId,
        amount: req.amount, phone_number: phone, account_reference: req.saleReference ?? 'POS sale',
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message ?? 'M-Pesa error');
    return { requestId: json.checkoutRequestId as string };
  }

  const res = await fetch(`${FUNCTIONS_BASE}/orange-money-payments`, {
    method: 'POST', headers,
    body: JSON.stringify({
      action: 'initiate_payment', tenant_id: req.tenantId, connection_id: connectionId,
      customer_phone: phone, amount: req.amount, currency: req.currency,
      description: req.saleReference ?? 'POS sale', merchant_reference: req.saleReference ?? `pos-${Date.now()}`,
      country_code: req.countryCode,
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? 'Orange Money error');
  return { requestId: json.paymentId as string };
}

async function checkPushStatus(provider: PushProviderKey, tenantId: string, connectionId: string, requestId: string): Promise<boolean> {
  const headers = await authHeaders();

  if (provider === 'mpesa') {
    const res = await fetch(`${FUNCTIONS_BASE}/mpesa-payments`, {
      method: 'POST', headers,
      body: JSON.stringify({ action: 'query_transaction', tenant_id: tenantId, connection_id: connectionId, checkout_request_id: requestId }),
    });
    const json = await res.json();
    return json.success && json.status === 'succeeded';
  }

  const res = await fetch(`${FUNCTIONS_BASE}/orange-money-payments?payment_id=${encodeURIComponent(requestId)}`, {
    method: 'POST', headers,
    body: JSON.stringify({ action: 'check_status', tenant_id: tenantId, connection_id: connectionId }),
  });
  const json = await res.json();
  return json.success && json.status === 'succeeded';
}

export function MobileMoneyPushModal(props: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [selected, setSelected] = useState<ConnectedProvider | null>(null);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const keys: PushProviderKey[] = ['mpesa', 'orange_money'];
      const { data: providerRows } = await supabase.from('integration_providers').select('id, provider_key, provider_name').in('provider_key', keys);
      if (!providerRows?.length) { if (!cancelled) setLoadingProviders(false); return; }
      const { data: connections } = await supabase
        .from('integration_connections')
        .select('id, provider_id')
        .eq('tenant_id', props.tenantId)
        .eq('status', 'connected')
        .in('provider_id', providerRows.map((p) => p.id));
      if (cancelled) return;
      const connected = (connections ?? []).map((c) => {
        const p = providerRows.find((pr) => pr.id === c.provider_id)!;
        return { key: p.provider_key as PushProviderKey, providerName: p.provider_name, connectionId: c.id };
      });
      setProviders(connected);
      setSelected(connected[0] ?? null);
      setLoadingProviders(false);
    })();
    return () => { cancelled = true; };
  }, [props.tenantId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  const send = async () => {
    if (!selected || !phone.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { requestId: id } = await pushToPhone(selected.key, props, selected.connectionId, phone.trim());
      setRequestId(id);
      toast('info', t('pos.mobilePush.sent'));

      pollAttempts.current = 0;
      pollRef.current = setInterval(async () => {
        pollAttempts.current += 1;
        if (pollAttempts.current > 24) { stopPolling(); return; }
        try {
          const ok = await checkPushStatus(selected.key, props.tenantId, selected.connectionId, id);
          if (ok) {
            stopPolling();
            setConfirmed(true);
            toast('success', t('pos.mobilePush.confirmed'));
          }
        } catch {
          // Transient verify failures are expected mid-payment.
        }
      }, 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pos.mobilePush.error'));
    } finally {
      setSending(false);
    }
  };

  if (loadingProviders) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-2xl2 bg-white p-8 dark:bg-ink-800"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl2 bg-white shadow-xl dark:bg-ink-800">
        <div className="flex items-center justify-between border-b border-ink-200 p-5 dark:border-ink-700">
          <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('pos.mobilePush.title')}</h2>
          <button onClick={props.onClose} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">✕</button>
        </div>

        <div className="p-5">
          {providers.length === 0 ? (
            <div className="text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-warning-500" />
              <p className="text-sm text-ink-600 dark:text-ink-300">{t('pos.mobilePush.noProvider')}</p>
            </div>
          ) : confirmed ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success-600" />
              <p className="mb-4 font-medium text-ink-900 dark:text-white">{t('pos.mobilePush.confirmed')}</p>
              <button onClick={() => { props.onConfirmed(requestId ?? ''); props.onClose(); }} className="btn-primary w-full justify-center">
                {t('pos.onlinePayment.useReference')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {providers.length > 1 && (
                <div className="flex gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setSelected(p)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${selected?.key === p.key ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/20' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300'}`}
                    >
                      {p.providerName}
                    </button>
                  ))}
                </div>
              )}

              {!requestId ? (
                <>
                  <div>
                    <label className="label">{t('pos.mobilePush.phoneLabel')}</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t('pos.mobilePush.phonePlaceholder')}
                      className="input"
                    />
                  </div>
                  {error && <p className="text-sm text-error-600">{error}</p>}
                  <button onClick={send} disabled={sending || !phone.trim()} className="btn-primary w-full justify-center disabled:opacity-50">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone size={16} />}
                    {t('pos.mobilePush.send')}
                  </button>
                </>
              ) : (
                <div className="space-y-3 text-center">
                  <Smartphone className="mx-auto h-10 w-10 text-brand-500" />
                  <p className="text-sm text-ink-600 dark:text-ink-300">{t('pos.mobilePush.checkPhone', { phone })}</p>
                  <p className="flex items-center justify-center gap-2 text-xs text-ink-400"><Loader2 className="h-3 w-3 animate-spin" /> {t('pos.onlinePayment.waiting')}</p>
                  <button
                    onClick={() => { stopPolling(); props.onConfirmed(requestId ?? ''); props.onClose(); }}
                    className="text-xs text-ink-400 underline hover:text-ink-600 dark:hover:text-ink-200"
                  >
                    {t('pos.onlinePayment.manualConfirm')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
