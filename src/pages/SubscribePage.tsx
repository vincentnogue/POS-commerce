import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Check, AlertCircle, CreditCard, Sparkles, Smartphone, Wallet, ShieldCheck, Lock, Crown } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { PLANS, annualPrice } from '../lib/plans';

type PspId = 'stripe' | 'flutterwave' | 'paystack' | 'payunit' | 'paddle';

const PSP_META: Record<PspId, { functionName: string; icon: typeof CreditCard; labelKey: string }> = {
  stripe: { functionName: 'stripe-checkout', icon: CreditCard, labelKey: 'subscribe.card' },
  flutterwave: { functionName: 'flutterwave-checkout', icon: Smartphone, labelKey: 'subscribe.mobileMoney' },
  paystack: { functionName: 'paystack-checkout', icon: Smartphone, labelKey: 'subscribe.psp.paystack' },
  payunit: { functionName: 'payunit-checkout', icon: Wallet, labelKey: 'subscribe.psp.payunit' },
  paddle: { functionName: 'paddle-checkout', icon: CreditCard, labelKey: 'subscribe.psp.paddle' },
};

// Paddle Billing checkout is an overlay opened by Paddle.js in the
// browser, not a redirect to a hosted URL like the other 4 PSPs — so it
// needs its script loaded once, on demand, rather than at every page load.
let paddleJsPromise: Promise<void> | null = null;
function loadPaddleJs(): Promise<void> {
  if ((window as any).Paddle) return Promise.resolve();
  if (!paddleJsPromise) {
    paddleJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paddle.js'));
      document.head.appendChild(script);
    });
  }
  return paddleJsPromise;
}

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
  const [paddleConfig, setPaddleConfig] = useState<{ clientToken: string; sandbox: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // DEAD-BUTTON FIX: this fetch previously had no timeout, so if it ever
    // hung (network issue, cold-starting function), activeProviders stayed
    // null forever — neither the picker nor the "no payment method
    // configured" message would ever render, and every plan button stayed
    // silently disabled with zero visible explanation. A merchant clicking
    // it would see nothing happen at all, with the still-showing trial
    // banner the only thing on screen — easy to misread as "it says my
    // subscription has ended" when really the page just never finished
    // loading. Racing the fetch against a timeout means we always land in
    // a visible state (the picker, the warning, or the catch's Stripe
    // fallback) within a few seconds.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-providers-status`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          signal: controller.signal,
          cache: 'no-store',
        });
        const status = await res.json();
        const active = (Object.keys(PSP_META) as PspId[]).filter((id) => status[id]);
        if (cancelled) return;
        setActiveProviders(active);
        setProvider(active[0] ?? null);
        if (status.paddle && status.paddle_client_token) {
          setPaddleConfig({ clientToken: status.paddle_client_token, sandbox: !!status.paddle_sandbox });
        }
      } catch {
        // Backend unreachable — fail closed to Stripe (card payments are
        // the most universally reachable option) rather than showing a
        // picker with providers we can't confirm are actually configured.
        if (!cancelled) { setActiveProviders(['stripe']); setProvider('stripe'); }
      } finally {
        clearTimeout(timeoutId);
      }
    })();
    return () => { cancelled = true; clearTimeout(timeoutId); };
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

      if (provider === 'paddle') {
        if (!paddleConfig) { setError(t('subscribe.error.init')); return; }
        const plan = PLANS.find((p) => p.code === planCode);
        if (!plan) return;
        const amount = billing === 'annual' ? annualPrice(plan.priceMonthly) : plan.priceMonthly;

        const res = await fetch(apiUrl, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({
            plan_code: planCode,
            plan_name: t('plan.name.' + planCode),
            billing,
            amount_usd: amount,
            tenant_id: tenant.id,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? t('subscribe.error.init')); return; }

        await loadPaddleJs();
        const Paddle = (window as any).Paddle;
        if (paddleConfig.sandbox) Paddle.Environment.set('sandbox');
        Paddle.Initialize({ token: paddleConfig.clientToken });
        Paddle.Checkout.open({
          transactionId: json.transaction_id,
          settings: { successUrl: `${window.location.origin}/dashboard?upgraded=1` },
        });
        return;
      }

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

      // BUG FIX: Stripe and Flutterwave finalize a subscription via a real
      // webhook (stripe-webhook / flutterwave-webhook). Paystack and
      // PayUnit have no webhook endpoint configured for this project — the
      // redirect back to /dashboard?upgraded=1 was never actually read by
      // anything, so a customer paying via either of these two would land
      // on the dashboard having paid, with their plan never upgraded.
      // Store what finalize-subscription-payment needs (called from
      // DashboardPage on that redirect) since only this page knows
      // plan_code/billing at this point — the provider's own reference we
      // just got back is what ties it to the actual payment.
      if ((provider === 'paystack' || provider === 'payunit') && json.reference) {
        localStorage.setItem('posflow_pending_subscription', JSON.stringify({
          tenant_id: tenant.id, provider, reference: json.reference, plan_code: planCode, billing,
        }));
      }

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
      <header className="sticky top-0 z-20 border-b border-ink-100 dark:border-ink-800 bg-white/85 dark:bg-ink-800/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Logo clickable />
          <div className="flex items-center gap-2 rounded-full border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-900 px-3 py-1.5 text-xs font-medium text-ink-500 dark:text-ink-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            {tenant?.name}
          </div>
        </div>
      </header>

      {/* Ambient premium background, matching the landing page's hero treatment */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.4]" />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-700/10"
          animate={{ y: [0, 24, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-flow-300/15 blur-3xl dark:bg-flow-700/10"
          animate={{ y: [0, -24, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10 text-center"
          >
            {!access.hasActiveSubscription && access.trialDaysLeft > 0 ? (
              <>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/25 px-4 py-1.5 text-sm font-medium text-warning-700 dark:text-warning-300">
                  <Clock size={15} /> {t(access.trialDaysLeft > 1 ? 'subscribe.trialLeft_plural' : 'subscribe.trialLeft', { count: access.trialDaysLeft })}
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-5xl">
                  {t('subscribe.choosePlan')}
                </h1>
                <p className="mx-auto mt-3 max-w-lg text-base text-ink-500 dark:text-ink-400">{t('subscribe.choosePlanDesc')}</p>
              </>
            ) : (
              <>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/25 px-4 py-1.5 text-sm font-medium text-error-700 dark:text-error-300">
                  <AlertCircle size={15} /> {t('subscribe.trialEnded')}
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-5xl">
                  {t('subscribe.activate')}
                </h1>
                <p className="mx-auto mt-3 max-w-lg text-base text-ink-500 dark:text-ink-400">{t('subscribe.activateDesc')}</p>
              </>
            )}
          </motion.div>

          {error && (
            <div className="mx-auto mb-6 flex max-w-md items-start gap-2 rounded-xl border border-brand-100 dark:border-brand-900/40 bg-brand-50 dark:bg-brand-900/25 p-3.5 text-sm text-brand-700 dark:text-brand-300">
              <Sparkles size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="mb-4 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1 shadow-soft">
              <button
                onClick={() => setBilling('monthly')}
                className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${billing === 'monthly' ? 'bg-ink-900 text-white dark:bg-brand-500' : 'text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-100'}`}
              >{t('pricing.monthly')}</button>
              <button
                onClick={() => setBilling('annual')}
                className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${billing === 'annual' ? 'bg-ink-900 text-white dark:bg-brand-500' : 'text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-100'}`}
              >
                {t('pricing.annual')}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${billing === 'annual' ? 'bg-white/20 text-white' : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'}`}>
                  {t('pricing.annualSave')}
                </span>
              </button>
            </div>
          </div>

          {activeProviders && activeProviders.length > 1 && (
            <div className="mb-10 flex justify-center">
              <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1 shadow-soft">
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
            <div className="mx-auto mb-10 flex max-w-lg items-start gap-3 rounded-xl border border-warning-300 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/25 p-4 text-sm text-warning-800 dark:text-warning-300">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{t('subscribe.noPspConfigured')}</span>
            </div>
          )}
          {activeProviders && activeProviders.length === 1 && (
            <div className="mb-10 flex justify-center">
              <p className="text-xs text-ink-400 dark:text-ink-500">
                {t('subscribe.payingWith', { provider: t(PSP_META[activeProviders[0]].labelKey) })}
              </p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan, i) => {
              const price = billing === 'annual' ? annualPrice(plan.priceMonthly) : plan.priceMonthly;
              return (
                <motion.div
                  key={plan.code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className={`relative flex flex-col rounded-2xl2 border bg-white dark:bg-ink-800 p-7 transition-all hover:-translate-y-1 ${
                    plan.highlight
                      ? 'border-brand-300 dark:border-brand-600 shadow-float ring-1 ring-brand-200 dark:ring-brand-800 lg:scale-[1.04]'
                      : 'border-ink-200 dark:border-ink-700 shadow-soft hover:shadow-float'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-brand-500 to-flow-500 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-soft">
                      <Crown size={10} /> {t('subscribe.popular')}
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">{t('plan.name.' + plan.code)}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-ink-900 dark:text-ink-50 tabular-nums">${price}</span>
                    <span className="text-sm text-ink-400 dark:text-ink-500">/{billing === 'annual' ? t('subscribe.perYear') : t('subscribe.perMonth')}</span>
                  </div>
                  {billing === 'annual' && (
                    <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">{t('pricing.annualSave')}</p>
                  )}
                  <ul className="mt-6 flex-1 space-y-3 text-sm text-ink-600 dark:text-ink-300">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40">
                          <Check size={10} strokeWidth={3} className="text-brand-600 dark:text-brand-400" />
                        </span>
                        {t(`plan.feature.${f}`)}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => startCheckout(plan.code)}
                    disabled={loading || !provider}
                    className={`mt-7 w-full justify-center py-3 text-sm ${plan.highlight ? 'btn-primary' : 'btn-ghost border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300'}`}
                  >
                    {loading && checkoutPlan === plan.code ? t('subscribe.redirecting') : <><CreditCard size={15} /> {t('subscribe.choose')} {t('plan.name.' + plan.code)}</>}
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* Trust bar — the kind of reassurance a globally-trusted platform shows at checkout */}
          <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-ink-400 dark:text-ink-500">
            <span className="flex items-center gap-1.5"><Lock size={13} /> {t('subscribe.trust.encrypted')}</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> {t('subscribe.trust.pci')}</span>
            <span className="flex items-center gap-1.5"><Sparkles size={13} /> {t('subscribe.trust.cancelAnytime')}</span>
          </div>

          <p className="mt-4 text-center text-xs text-ink-400 dark:text-ink-500">
            {t('subscribe.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}
