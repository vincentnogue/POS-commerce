import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Check, AlertCircle, CreditCard, Sparkles, Smartphone, Wallet } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { PLANS, annualPrice } from '../lib/plans';

type PspId = 'stripe' | 'flutterwave' | 'paystack' | 'payunit';

const PSP_META: Record<PspId, { functionName: string; icon: typeof CreditCard; labelKey: string }> = {
  stripe: { functionName: 'stripe-checkout', icon: CreditCard, labelKey: 'subscribe.card' },
  flutterwave: { functionName: 'flutterwave-checkout', icon: Smartphone, labelKey: 'subscribe.mobileMoney' },
  paystack: { functionName: 'paystack-checkout', icon: Smartphone, labelKey: 'subscribe.psp.paystack' },
  payunit: { functionName: 'payunit-checkout', icon: Wallet, labelKey: 'subscribe.psp.payunit' },
};

export function SubscribePage() {
  const { tenant, user, access } = useAuth();
  const { t } = useI18n();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  // "quand le client clique sur pay, uniquement les méthodes de paiement
  // actives s'affichent... si une seule méthode existe qu'il fasse avec" —
  // this used to hardcode Stripe + Flutterwave regardless of whether
  // either was actually configured, with no Paystack/PayUnit option at
  // all. Now it asks the backend which of the 4 platform PSPs actually
  // have their secret keys set, shows a picker only when more than one
  // is real, and silently uses the one available PSP otherwise.
  const [activeProviders, setActiveProviders] = useState<PspId[] | null>(null);
  const [provider, setProvider] = useState<PspId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-providers-status`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        });
        const status = await res.json();
        const active = (Object.keys(PSP_META) as PspId[]).filter((id) => status[id]);
        if (cancelled) return;
        setActiveProviders(active);
        setProvider(active[0] ?? null);
      } catch {
        // Backend unreachable — fail closed to Stripe (card payments are
        // the most universally reachable option) rather than showing a
        // picker with providers we can't confirm are actually configured.
        if (!cancelled) { setActiveProviders(['stripe']); setProvider('stripe'); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startCheckout = async (planCode: string) => {
    if (!tenant || !provider) return;
    setLoading(true);
    setError(null);
    setCheckoutPlan(planCode);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      };

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${PSP_META[provider].functionName}`;
      const body = provider === 'stripe'
        ? {
            plan_code: planCode,
            billing,
            tenant_id: tenant.id,
            success_url: `${window.location.origin}/dashboard?upgraded=1`,
            cancel_url: `${window.location.origin}/subscribe?canceled=1`,
          }
        : {
            plan_code: planCode,
            billing,
            tenant_id: tenant.id,
            customer_email: user?.email ?? '',
            customer_name: tenant.name,
            success_url: `${window.location.origin}/dashboard?upgraded=1`,
          };

      const res = await fetch(apiUrl, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? t('subscribe.error.init')); return; }
      if (json.url) window.location.href = json.url;
    } catch (e) {
      setError((e instanceof Error ? e.message : undefined) ?? t('subscribe.error.connection'));
    } finally {
      setLoading(false);
      setCheckoutPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-900">
      <header className="border-b border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <Logo clickable />
          <span className="text-sm text-ink-500 dark:text-ink-400">{tenant?.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 text-center"
        >
          {!access.hasActiveSubscription && access.trialDaysLeft > 0 ? (
            <>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-warning-50 dark:bg-warning-900/25 px-4 py-1.5 text-sm font-medium text-warning-700">
                <Clock size={15} /> {t(access.trialDaysLeft > 1 ? 'subscribe.trialLeft_plural' : 'subscribe.trialLeft', { count: access.trialDaysLeft })}
              </div>
              <h1 className="text-3xl font-semibold text-ink-900 dark:text-ink-50">{t('subscribe.choosePlan')}</h1>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{t('subscribe.choosePlanDesc')}</p>
            </>
          ) : (
            <>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-error-50 dark:bg-error-900/25 px-4 py-1.5 text-sm font-medium text-error-700">
                <AlertCircle size={15} /> {t('subscribe.trialEnded')}
              </div>
              <h1 className="text-3xl font-semibold text-ink-900 dark:text-ink-50">{t('subscribe.activate')}</h1>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{t('subscribe.activateDesc')}</p>
            </>
          )}
        </motion.div>

        {error && (
          <div className="mx-auto mb-6 flex max-w-md items-start gap-2 rounded-xl bg-brand-50 dark:bg-brand-900/25 p-3 text-sm text-brand-700">
            <Sparkles size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${billing === 'monthly' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}
            >{t('pricing.monthly')}</button>
            <button
              onClick={() => setBilling('annual')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${billing === 'annual' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}
            >{t('pricing.annual')} <span className="text-xs opacity-80">{t('pricing.annualSave')}</span></button>
          </div>
        </div>

        {activeProviders && activeProviders.length > 1 && (
          <div className="mb-8 flex justify-center">
            <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
              {activeProviders.map((id) => {
                const meta = PSP_META[id];
                const Icon = meta.icon;
                return (
                  <button
                    key={id}
                    onClick={() => setProvider(id)}
                    className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition ${provider === id ? 'bg-ink-900 text-white dark:bg-brand-500' : 'text-ink-600 dark:text-ink-300'}`}
                  ><Icon size={15} /> {t(meta.labelKey)}</button>
                );
              })}
            </div>
          </div>
        )}
        {activeProviders && activeProviders.length === 0 && (
          <p className="mx-auto mb-8 max-w-md text-center text-sm text-warning-700 dark:text-warning-400">{t('subscribe.noPspConfigured')}</p>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const price = billing === 'annual' ? annualPrice(plan.priceMonthly) : plan.priceMonthly;
            return (
              <motion.div
                key={plan.code}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`card p-6 ${plan.highlight ? 'ring-2 ring-brand-300' : ''}`}
              >
                {plan.popular && (
                  <span className="mb-3 inline-block rounded-full bg-brand-500 px-3 py-0.5 text-[10px] font-medium uppercase text-white">{t('subscribe.popular')}</span>
                )}
                <h3 className="text-lg font-medium text-ink-900 dark:text-ink-50">{t('plan.name.' + plan.code)}</h3>
                <p className="mt-2 text-3xl font-medium text-ink-900 dark:text-ink-50">
                  ${price}<span className="text-sm font-normal text-ink-500 dark:text-ink-400">/{billing === 'annual' ? t('subscribe.perYear') : t('subscribe.perMonth')}</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink-600 dark:text-ink-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-success-500" /> {t(`plan.feature.${f}`)}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => startCheckout(plan.code)}
                  disabled={loading || !provider}
                  className={`mt-6 w-full justify-center py-3 ${plan.highlight ? 'btn-primary' : 'btn-ghost border-brand-200 text-brand-700'}`}
                >
                  {loading && checkoutPlan === plan.code ? t('subscribe.redirecting') : <><CreditCard size={15} /> {t('subscribe.choose')} {t('plan.name.' + plan.code)}</>}
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-ink-400 dark:text-ink-500">
          {t('subscribe.footer')}
        </p>
      </div>
    </div>
  );
}
