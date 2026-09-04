import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, MessageSquare, Users, History, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { supabase } from '../../lib/supabase';
import { PageHeader, EmptyState, useToast, Badge } from '../../components/ui';
import type { Customer, CustomerMessage } from '../../lib/types';

type LoyaltyTier = { id: string; name: string };
type CustomerSegment = { id: string; name: string };
type Audience = { kind: 'all' } | { kind: 'tier'; id: string; name: string } | { kind: 'segment'; id: string; name: string };

// Real customer messaging: sends a bulk SMS/WhatsApp to a chosen audience
// (all customers, or filtered by loyalty tier / segment) via the tenant's
// connected Twilio account. Reuses the notifications-twilio edge function
// as-is (it already supports bulk sends to a recipient list) — this page
// is the missing piece: recipient selection, composing, and a real send
// history, none of which existed anywhere before.
export function MessagesPage() {
  const { tenant, user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  useDocumentMeta(t('messages.title'), t('messages.desc'));

  const [twilioConnectionId, setTwilioConnectionId] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [audience, setAudience] = useState<Audience>({ kind: 'all' });
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [history, setHistory] = useState<CustomerMessage[]>([]);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    (async () => {
      setCheckingConnection(true);
      const { data: provider } = await supabase.from('integration_providers').select('id').eq('provider_key', 'twilio').maybeSingle();
      if (!provider) { if (!cancelled) setCheckingConnection(false); return; }
      const { data: connection } = await supabase
        .from('integration_connections')
        .select('id, status')
        .eq('tenant_id', tenant.id)
        .eq('provider_id', provider.id)
        .eq('status', 'connected')
        .maybeSingle();
      if (cancelled) return;
      if (connection) {
        setTwilioConnectionId(connection.id);
      }
      setCheckingConnection(false);
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const [c, tr, sg, h] = await Promise.all([
        supabase.from('customers').select('*').eq('tenant_id', tenant.id),
        supabase.from('loyalty_tiers').select('id, name').eq('tenant_id', tenant.id),
        supabase.from('customer_segments').select('id, name').eq('tenant_id', tenant.id),
        supabase.from('customer_messages').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(20),
      ]);
      setCustomers((c.data as Customer[]) ?? []);
      setTiers(tr.data ?? []);
      setSegments(sg.data ?? []);
      setHistory((h.data as CustomerMessage[]) ?? []);
    })();
  }, [tenant]);

  const recipients = customers.filter((c) => {
    if (!c.phone) return false;
    if (audience.kind === 'all') return true;
    if (audience.kind === 'tier') return c.loyalty_tier_id === audience.id;
    if (audience.kind === 'segment') return c.segment_id === audience.id;
    return false;
  });
  const recipientsWithoutPhone = customers.filter((c) => !c.phone && (
    audience.kind === 'all' ||
    (audience.kind === 'tier' && c.loyalty_tier_id === audience.id) ||
    (audience.kind === 'segment' && c.segment_id === audience.id)
  )).length;

  const audienceLabel = audience.kind === 'all' ? t('messages.audience.all') : audience.name;

  const send = async () => {
    if (!tenant || !twilioConnectionId || recipients.length === 0 || !message.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('notifications-twilio', {
        body: {
          tenant_id: tenant.id,
          connection_id: twilioConnectionId,
          action: 'send_bulk',
          channel,
          recipients: recipients.map((c) => ({ phone: c.phone as string, name: c.name })),
          template: message,
        },
      });
      if (error || !data) {
        toast('error', t('messages.err.sendFailed', { message: error?.message ?? '' }));
        return;
      }
      const sentCount = data.sent ?? 0;
      const failedCount = data.failed ?? 0;

      await supabase.from('customer_messages').insert({
        tenant_id: tenant.id,
        connection_id: twilioConnectionId,
        channel,
        audience: audienceLabel,
        message: message.trim(),
        recipient_count: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
        results: data.results ?? null,
        sent_by: user?.id ?? null,
      });

      if (failedCount > 0) {
        toast('error', t('messages.toast.partial', { sent: sentCount, failed: failedCount }));
      } else {
        toast('success', t('messages.toast.success', { count: sentCount }));
      }
      setMessage('');
      const { data: refreshed } = await supabase.from('customer_messages').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(20);
      setHistory((refreshed as CustomerMessage[]) ?? []);
    } catch (e: unknown) {
      toast('error', t('messages.err.sendFailed', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSending(false);
    }
  };

  if (checkingConnection) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-ink-400" size={28} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('messages.title')} subtitle={t('messages.desc')} icon={MessageSquare} />

      {!twilioConnectionId ? (
        <EmptyState
          icon={AlertTriangle}
          title={t('messages.notConnected.title')}
          description={t('messages.notConnected.desc')}
          action={<Link to="/marketplace" className="btn-primary">{t('messages.notConnected.cta')}</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-5">
            <h3 className="font-semibold text-ink-900 dark:text-ink-50 mb-4">{t('messages.compose.title')}</h3>

            <label className="label">{t('messages.audience.label')}</label>
            <select
              className="input mb-4"
              value={audience.kind === 'all' ? 'all' : `${audience.kind}:${audience.id}`}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'all') { setAudience({ kind: 'all' }); return; }
                const [kind, id] = v.split(':');
                if (kind === 'tier') { const tr = tiers.find((x) => x.id === id); if (tr) setAudience({ kind: 'tier', id: tr.id, name: `${t('messages.audience.tierPrefix')} ${tr.name}` }); }
                if (kind === 'segment') { const sg = segments.find((x) => x.id === id); if (sg) setAudience({ kind: 'segment', id: sg.id, name: `${t('messages.audience.segmentPrefix')} ${sg.name}` }); }
              }}
            >
              <option value="all">{t('messages.audience.all')}</option>
              {tiers.length > 0 && (
                <optgroup label={t('messages.audience.tiersGroup')}>
                  {tiers.map((tr) => <option key={tr.id} value={`tier:${tr.id}`}>{tr.name}</option>)}
                </optgroup>
              )}
              {segments.length > 0 && (
                <optgroup label={t('messages.audience.segmentsGroup')}>
                  {segments.map((sg) => <option key={sg.id} value={`segment:${sg.id}`}>{sg.name}</option>)}
                </optgroup>
              )}
            </select>

            <p className="text-sm text-ink-500 dark:text-ink-400 mb-4 flex items-center gap-1.5">
              <Users size={15} /> {t('messages.audience.count', { count: recipients.length })}
              {recipientsWithoutPhone > 0 && <span className="text-warning-600 dark:text-warning-400">· {t('messages.audience.noPhone', { count: recipientsWithoutPhone })}</span>}
            </p>

            <label className="label">{t('messages.channel.label')}</label>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setChannel('whatsapp')} className={`px-4 py-2 rounded-lg text-sm font-medium border ${channel === 'whatsapp' ? 'bg-brand-500 text-white border-brand-500' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300'}`}>WhatsApp</button>
              <button onClick={() => setChannel('sms')} className={`px-4 py-2 rounded-lg text-sm font-medium border ${channel === 'sms' ? 'bg-brand-500 text-white border-brand-500' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300'}`}>SMS</button>
            </div>

            <label className="label">{t('messages.compose.messageLabel')}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input min-h-[110px] mb-4"
              placeholder={t('messages.compose.placeholder')}
              maxLength={1000}
            />

            <button
              onClick={send}
              disabled={sending || recipients.length === 0 || !message.trim()}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? t('messages.compose.sending') : t('messages.compose.send', { count: recipients.length })}
            </button>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 dark:text-ink-50 mb-4 flex items-center gap-2"><History size={16} /> {t('messages.history.title')}</h3>
            {history.length === 0 ? (
              <p className="text-sm text-ink-400 dark:text-ink-500">{t('messages.history.empty')}</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="border-b border-ink-100 dark:border-ink-800 pb-3 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{new Date(h.created_at).toLocaleString()}</span>
                      <Badge tone={h.channel === 'whatsapp' ? 'brand' : 'flow'}>{h.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</Badge>
                    </div>
                    <p className="text-sm text-ink-700 dark:text-ink-200 line-clamp-2 mb-1">{h.message}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {h.audience} · {t('messages.history.result', { sent: h.sent_count, failed: h.failed_count })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
