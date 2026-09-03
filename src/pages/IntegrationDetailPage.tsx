import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ShieldCheck, Zap, CheckCircle, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenant';
import { IntegrationConnectionModal, type IntegrationProviderLike, type IntegrationConnectionLike } from '../components/IntegrationConnectionModal';

// Rebuilt from scratch. The previous version of this page hardcoded a
// fake data blob (INTEGRATION_DETAILS) for exactly 2 of the 25+ real
// entries in `integration_providers` — invented country/currency counts,
// invented per-plan feature matrices, invented pricing, and a "Connect"
// button with no onClick that did nothing. Opening any integration other
// than Stripe or PayPal simply showed "Integration not found".
//
// Every field shown below now comes from the same `integration_providers`
// / `integration_connections` tables the working Marketplace grid reads,
// and "Connect" opens the exact same IntegrationConnectionModal the grid
// uses — so every app in the marketplace, not just two of them, gets a
// real detail page with a real, working connect flow.

interface Provider extends IntegrationProviderLike {
  description: string;
  logo_url: string | null;
  category: string;
  subcategory: string;
  auth_type: string;
  minimum_plan: string | null;
  webhook_support: boolean;
  is_featured: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  basic: 'Starter', starter: 'Starter', pro: 'Pro', premium: 'Premium', entreprise: 'Entreprise',
};
const PLAN_HIERARCHY = ['basic', 'starter', 'pro', 'premium', 'entreprise'];

function authTypeLabel(authType: string): string {
  if (authType === 'oauth2' || authType === 'oauth') return 'OAuth';
  if (authType.startsWith('api_key')) return 'API Key';
  return authType.replace(/_/g, ' ');
}

function capabilityLabel(cap: string): string {
  return cap.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function IntegrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tenant } = useTenant();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [connection, setConnection] = useState<IntegrationConnectionLike | undefined>(undefined);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: providerRow } = await supabase
      .from('integration_providers')
      .select('*')
      .ilike('provider_key', id)
      .eq('is_active', true)
      .maybeSingle();

    if (!providerRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setProvider(providerRow as Provider);

    if (tenant?.id) {
      const { data: connectionRow } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('provider_id', providerRow.id)
        .maybeSingle();
      setConnection(connectionRow ?? undefined);
    }

    if (tenant?.plan_id) {
      const { data: planRow } = await supabase.from('plans').select('code').eq('id', tenant.plan_id).maybeSingle();
      setPlanCode(planRow?.code ?? null);
    }
    setLoading(false);
  }, [id, tenant?.id, tenant?.plan_id]);

  useEffect(() => { load(); }, [load]);

  const isLocked = (() => {
    if (!provider?.minimum_plan) return false;
    const currentIdx = PLAN_HIERARCHY.indexOf(planCode?.toLowerCase() || 'starter');
    const requiredIdx = PLAN_HIERARCHY.indexOf(provider.minimum_plan.toLowerCase());
    return currentIdx < requiredIdx;
  })();

  const isConnected = connection?.status === 'connected';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
      </div>
    );
  }

  if (notFound || !provider) {
    return (
      <div className="min-h-screen bg-white dark:bg-ink-950">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="mb-6 text-lg text-ink-700 dark:text-ink-300">This integration isn't available.</p>
          <Link to="/marketplace" className="btn-primary inline-flex">
            <ArrowLeft size={16} /> Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950">
      {/* Header */}
      <div className="border-b border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-900">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Link to="/marketplace" className="mb-6 inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
            <ArrowLeft className="h-5 w-5" />
            Back to Marketplace
          </Link>

          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700">
              {provider.logo_url ? (
                <img src={provider.logo_url} alt={provider.provider_name} className="h-11 w-11 object-contain" />
              ) : (
                <Zap className="h-7 w-7 text-ink-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold text-ink-900 dark:text-white">{provider.provider_name}</h1>
                {provider.is_featured && (
                  <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    Featured
                  </span>
                )}
                {isConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-semibold text-success-700 dark:bg-success-900/30 dark:text-success-400">
                    <CheckCircle size={12} /> Connected
                  </span>
                )}
              </div>
              <p className="mt-2 text-lg text-ink-600 dark:text-ink-300">{provider.description}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium capitalize text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                  {provider.category}
                </span>
                <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium capitalize text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                  {provider.subcategory}
                </span>
                <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                  {authTypeLabel(provider.auth_type)}
                </span>
                {provider.webhook_support && (
                  <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
                    Webhooks
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Capabilities */}
          <div className="lg:col-span-2">
            <h2 className="mb-5 text-xl font-bold text-ink-900 dark:text-white">Capabilities</h2>
            {provider.capabilities?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {provider.capabilities.map((cap) => (
                  <div key={cap} className="flex items-center gap-2.5 rounded-lg border border-ink-200 bg-ink-50 p-3 dark:border-ink-700 dark:bg-ink-800">
                    <CheckCircle className="h-4 w-4 shrink-0 text-success-600" />
                    <span className="text-sm text-ink-700 dark:text-ink-200">{capabilityLabel(cap)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500 dark:text-ink-400">No capabilities listed for this integration yet.</p>
            )}

            <div className="mt-10 rounded-lg border border-ink-200 bg-ink-50 p-6 dark:border-ink-700 dark:bg-ink-800">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-ink-900 dark:text-white">
                <ShieldCheck className="h-5 w-5 text-brand-500" />
                Security
              </h3>
              <p className="text-sm text-ink-600 dark:text-ink-400">
                Credentials are encrypted at rest and scoped to your organization only — never shared across tenants.
                Authentication method: <strong className="text-ink-800 dark:text-ink-200">{authTypeLabel(provider.auth_type)}</strong>.
              </p>
            </div>

            <a
              href={provider.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-between rounded-lg border border-ink-200 bg-white p-5 transition hover:border-brand-300 dark:border-ink-700 dark:bg-ink-800 dark:hover:border-brand-500"
            >
              <div>
                <p className="mb-1 font-bold text-ink-900 dark:text-white">Documentation</p>
                <p className="text-sm text-ink-500 dark:text-ink-400">Read the official integration docs</p>
              </div>
              <ExternalLink className="h-5 w-5 text-ink-400" />
            </a>
          </div>

          {/* Connect sidebar */}
          <div>
            <div className="sticky top-6 rounded-2xl2 border border-ink-200 bg-white p-6 shadow-soft dark:border-ink-700 dark:bg-ink-800">
              {isConnected ? (
                <>
                  <div className="mb-4 rounded-lg border border-success-100 bg-success-50 p-3 text-sm text-success-700 dark:border-success-600/40 dark:bg-success-600/20 dark:text-success-400">
                    Connected{connection?.account_name ? ` — ${connection.account_name}` : ''}
                  </div>
                  <button onClick={() => setShowModal(true)} className="btn-ghost w-full">Manage connection</button>
                </>
              ) : isLocked ? (
                <>
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning-50 p-3 text-sm text-warning-700 dark:bg-warning-600/20 dark:text-warning-400">
                    <Lock size={16} className="shrink-0" />
                    Requires the {PLAN_LABEL[provider.minimum_plan?.toLowerCase() ?? ''] ?? provider.minimum_plan} plan or higher.
                  </div>
                  <Link to="/pricing" className="btn-primary w-full justify-center">Upgrade plan</Link>
                </>
              ) : (
                <button onClick={() => setShowModal(true)} className="btn-primary w-full justify-center">
                  Connect {provider.provider_name}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <IntegrationConnectionModal
          provider={provider}
          connection={connection}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
