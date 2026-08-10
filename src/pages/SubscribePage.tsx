import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Check, AlertCircle, CreditCard, Sparkles, Smartphone } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { PLANS, annualPrice } from '../lib/plans';

export function SubscribePage() {
  const { tenant, user, access } = useAuth();
  const { t } = useI18n();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [provider, setProvider] = useState<'stripe' | 'flutterwave'>('stripe');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  const startCheckout = async (planCode: string) => {
    if (!tenant) return;
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

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${provider === 'stripe' ? 'stripe-checkout' : 'flutterwave-checkout'}`;
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
    } catch (e: any) {
      setError(e.message ?? t('subscribe.error.connection'));
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

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
            <button
              onClick={() => setProvider('stripe')}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition ${provider === 'stripe' ? 'bg-ink-900 text-white dark:bg-brand-500' : 'text-ink-600 dark:text-ink-300'}`}
            ><CreditCard size={15} /> {t('subscribe.card')}</button>
            <button
              onClick={() => setProvider('flutterwave')}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition ${provider === 'flutterwave' ? 'bg-ink-900 text-white dark:bg-brand-500' : 'text-ink-600 dark:text-ink-300'}`}
            ><Smartphone size={15} /> {t('subscribe.mobileMoney')}</button>
          </div>
        </div>

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
                      <Check size={15} className="mt-0.5 shrink-0 text-success-500" /> {t(f)}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => startCheckout(plan.code)}
                  disabled={loading}
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
