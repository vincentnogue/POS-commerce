import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, ExternalLink, Copy, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { useToast } from './ui';

// Real online-payment link + QR generation at POS checkout — the audit
// found that "card"/"mobile money" at checkout only ever meant the
// cashier typing a reference by hand, with none of the 12 connected
// payment providers ever actually called. This is the first real fix for
// that: when the tenant has one of these 3 providers connected, generate
// an actual hosted checkout link via their already-working (but
// previously never-called) edge functions, show it as a scannable QR the
// customer can pay from their own phone, and poll for confirmation.
//
// Scoped to exactly the 3 providers whose functions return a hosted
// checkout URL well-suited to a QR code (Flutterwave, Paystack, PayUnit).
// Stripe's function only supports PaymentIntents (an embedded card form,
// not a shareable link) and M-Pesa/Orange Money push directly to a phone
// number instead of returning a link — both are a different UI shape,
// deliberately left for a follow-up rather than forced into this one.
//
// Each provider's edge function has its own real, already-audited
// contract (see stripe-payments/flutterwave-payments/etc. — action names,
// GET-vs-POST verify, body vs query-param action) — this does not
// pretend they're uniform where they aren't.

type QrProviderKey = 'flutterwave' | 'paystack' | 'payunit';

interface ConnectedProvider {
  key: QrProviderKey;
  providerName: string;
  connectionId: string;
}

interface Props {
  tenantId: string;
  amount: number;
  currency: string;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
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

// Returns { link, reference } or throws.
async function createCheckoutLink(provider: QrProviderKey, req: Props, connectionId: string) {
  const headers = await authHeaders();

  if (provider === 'flutterwave') {
    const res = await fetch(`${FUNCTIONS_BASE}/flutterwave-payments?action=create_payment_link`, {
      method: 'POST', headers,
      body: JSON.stringify({
        tenant_id: req.tenantId, connection_id: connectionId, amount: req.amount, currency: req.currency,
        description: req.saleReference ?? 'POS sale', customer_email: req.customerEmail ?? undefined,
        customer_name: req.customerName ?? undefined, customer_phone: req.customerPhone ?? undefined,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message ?? 'Flutterwave error');
    return { link: json.paymentLink as string, reference: json.transactionReference as string };
  }

  if (provider === 'paystack') {
    const res = await fetch(`${FUNCTIONS_BASE}/paystack-payments?action=initialize_transaction`, {
      method: 'POST', headers,
      body: JSON.stringify({
        tenant_id: req.tenantId, connection_id: connectionId, amount: req.amount, currency: req.currency,
        email: req.customerEmail || 'customer@pos-sale.local',
        customer_name: req.customerName ?? undefined, customer_phone: req.customerPhone ?? undefined,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message ?? 'Paystack error');
    return { link: json.authorizationUrl as string, reference: json.reference as string };
  }

  // payunit — action travels in the JSON body, not a query param
  const res = await fetch(`${FUNCTIONS_BASE}/payunit-payments`, {
    method: 'POST', headers,
    body: JSON.stringify({
      action: 'initialize_payment', tenant_id: req.tenantId, connection_id: connectionId,
      amount: req.amount, currency: req.currency, email: req.customerEmail ?? undefined, phone: req.customerPhone ?? undefined,
      description: req.saleReference ?? 'POS sale',
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? 'PayUnit error');
  return { link: json.payment_url as string, reference: json.reference as string };
}

// Returns true once the provider confirms the payment succeeded.
async function checkStatus(provider: QrProviderKey, tenantId: string, connectionId: string, reference: string): Promise<boolean> {
  const headers = await authHeaders();

  if (provider === 'flutterwave') {
    const res = await fetch(`${FUNCTIONS_BASE}/flutterwave-payments?action=verify_transaction&transaction_id=${encodeURIComponent(reference)}`, { headers });
    const json = await res.json();
    return json.success && json.status === 'successful';
  }
  if (provider === 'paystack') {
    const res = await fetch(`${FUNCTIONS_BASE}/paystack-payments?action=verify_transaction&reference=${encodeURIComponent(reference)}`, { headers });
    const json = await res.json();
    return json.success && ['success', 'successful'].includes(json.status);
  }
  // payunit
  const res = await fetch(`${FUNCTIONS_BASE}/payunit-payments`, {
    method: 'POST', headers,
    body: JSON.stringify({ action: 'verify_payment', tenant_id: tenantId, connection_id: connectionId, transaction_reference: reference }),
  });
  const json = await res.json();
  return json.success && ['completed', 'success', 'successful'].includes(json.status);
}

export function OnlinePaymentModal(props: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [selected, setSelected] = useState<ConnectedProvider | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const keys: QrProviderKey[] = ['flutterwave', 'paystack', 'payunit'];
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
        return { key: p.provider_key as QrProviderKey, providerName: p.provider_name, connectionId: c.id };
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

  const generate = async () => {
    if (!selected) return;
    setGenerating(true);
    setError(null);
    try {
      const { link: checkoutLink, reference: ref } = await createCheckoutLink(selected.key, props, selected.connectionId);
      setLink(checkoutLink);
      setReference(ref);
      const dataUrl = await QRCode.toDataURL(checkoutLink, { width: 240, margin: 1 });
      setQrDataUrl(dataUrl);

      // Best-effort polling — bounded (2 minutes), never blocks the
      // cashier from confirming manually if the customer says they paid
      // before the poll catches up.
      pollAttempts.current = 0;
      pollRef.current = setInterval(async () => {
        pollAttempts.current += 1;
        if (pollAttempts.current > 24) { stopPolling(); return; }
        try {
          const ok = await checkStatus(selected.key, props.tenantId, selected.connectionId, ref);
          if (ok) {
            stopPolling();
            setConfirmed(true);
            toast('success', t('pos.onlinePayment.confirmed'));
          }
        } catch {
          // Transient verify failures are expected mid-payment — keep polling.
        }
      }, 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pos.onlinePayment.error'));
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('pos.onlinePayment.title')}</h2>
          <button onClick={props.onClose} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">✕</button>
        </div>

        <div className="p-5">
          {providers.length === 0 ? (
            <div className="text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-warning-500" />
              <p className="text-sm text-ink-600 dark:text-ink-300">{t('pos.onlinePayment.noProvider')}</p>
            </div>
          ) : confirmed ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success-600" />
              <p className="mb-4 font-medium text-ink-900 dark:text-white">{t('pos.onlinePayment.confirmed')}</p>
              <button onClick={() => onConfirmedAndClose(props, reference, onCloseWrap)} className="btn-primary w-full justify-center">
                {t('pos.onlinePayment.useReference')}
              </button>
            </div>
          ) : !qrDataUrl ? (
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
              {error && <p className="text-sm text-error-600">{error}</p>}
              <button onClick={generate} disabled={generating} className="btn-primary w-full justify-center disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode size={16} />}
                {t('pos.onlinePayment.generate')}
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <img src={qrDataUrl} alt="QR" className="mx-auto rounded-xl border border-ink-200 dark:border-ink-700" />
              <p className="text-sm text-ink-500 dark:text-ink-400">{t('pos.onlinePayment.scanHint')}</p>
              <div className="flex gap-2">
                <a href={link ?? '#'} target="_blank" rel="noopener noreferrer" className="btn-ghost flex-1 justify-center">
                  <ExternalLink size={15} /> {t('pos.onlinePayment.openLink')}
                </a>
                <button onClick={copyLink} className="btn-ghost flex-1 justify-center">
                  {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />} {copied ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <p className="flex items-center justify-center gap-2 text-xs text-ink-400"><Loader2 className="h-3 w-3 animate-spin" /> {t('pos.onlinePayment.waiting')}</p>
              <button
                onClick={() => { stopPolling(); onConfirmedAndClose(props, reference, onCloseWrap); }}
                className="text-xs text-ink-400 underline hover:text-ink-600 dark:hover:text-ink-200"
              >
                {t('pos.onlinePayment.manualConfirm')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function onCloseWrap() { props.onClose(); }
}

function onConfirmedAndClose(props: Props, reference: string | null, close: () => void) {
  props.onConfirmed(reference ?? '');
  close();
}
