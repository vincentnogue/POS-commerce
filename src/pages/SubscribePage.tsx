import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Check, AlertCircle, CreditCard, Sparkles } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { PLANS, annualPrice } from '../lib/plans';

export function SubscribePage() {
  const { tenant, access } = useAuth();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  const startCheckout = async (planCode: string) => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    setCheckoutPlan(planCode);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          plan_code: planCode,
          billing,
          tenant_id: tenant.id,
          success_url: `${window.location.origin}/dashboard?upgraded=1`,
          cancel_url: `${window.location.origin}/subscribe?canceled=1`,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur lors de l'initialisation du paiement."); return; }
      if (json.url) window.location.href = json.url;
    } catch (e: any) {
      setError(e.message ?? 'Erreur de connexion au système de paiement.');
    } finally {
      setLoading(false);
      setCheckoutPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <Logo clickable />
          <span className="text-sm text-ink-500">{tenant?.name}</span>
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
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-warning-50 px-4 py-1.5 text-sm font-semibold text-warning-700">
                <Clock size={15} /> Il vous reste {access.trialDaysLeft} jour{access.trialDaysLeft > 1 ? 's' : ''} d'essai
              </div>
              <h1 className="text-3xl font-extrabold text-ink-900">Choisissez votre forfait</h1>
              <p className="mt-2 text-sm text-ink-500">Continuez à utiliser LiAfrik Flow sans interruption après votre essai.</p>
            </>
          ) : (
            <>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-error-50 px-4 py-1.5 text-sm font-semibold text-error-700">
                <AlertCircle size={15} /> Votre essai est terminé
              </div>
              <h1 className="text-3xl font-extrabold text-ink-900">Activez votre abonnement</h1>
              <p className="mt-2 text-sm text-ink-500">Choisissez un forfait pour retrouver l'accès à vos modules.</p>
            </>
          )}
        </motion.div>

        {error && (
          <div className="mx-auto mb-6 flex max-w-md items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
            <Sparkles size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-full border border-ink-200 bg-white p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${billing === 'monthly' ? 'bg-brand-500 text-white' : 'text-ink-600'}`}
            >Mensuel</button>
            <button
              onClick={() => setBilling('annual')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${billing === 'annual' ? 'bg-brand-500 text-white' : 'text-ink-600'}`}
            >Annuel <span className="text-xs opacity-80">2 mois offerts</span></button>
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
                  <span className="mb-3 inline-block rounded-full bg-brand-500 px-3 py-0.5 text-[10px] font-bold uppercase text-white">Populaire</span>
                )}
                <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
                <p className="mt-2 text-3xl font-extrabold text-ink-900">
                  ${price}<span className="text-sm font-normal text-ink-500">/{billing === 'annual' ? 'an' : 'mois'}</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink-600">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-success-500" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => startCheckout(plan.code)}
                  disabled={loading}
                  className={`mt-6 w-full justify-center py-3 ${plan.highlight ? 'btn-primary' : 'btn-ghost border-brand-200 text-brand-700'}`}
                >
                  {loading && checkoutPlan === plan.code ? 'Redirection…' : <><CreditCard size={15} /> Choisir {plan.name}</>}
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-ink-400">
          Paiement sécurisé par Stripe. Annulation à tout moment. TVA non incluse.
        </p>
      </div>
    </div>
  );
}
