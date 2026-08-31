import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useTenant } from '../../lib/tenant';
import { Search, Grid, List, Plus, CheckCircle, AlertCircle, ExternalLink, Trash2 } from 'lucide-react';
import { IntegrationCredentialForm } from '../../components/IntegrationCredentialForm';

interface IntegrationProvider {
  id: string;
  provider_key: string;
  provider_name: string;
  description: string;
  logo_url: string | null;
  documentation_url: string;
  category: string;
  subcategory: string;
  auth_type: string;
  auth_schema: { type: string; properties: Record<string, { type: string; title: string }>; required: string[] } | null;
  capabilities: string[];
  minimum_plan: string | null;
  is_featured: boolean;
  is_active: boolean;
}

interface IntegrationConnection {
  id: string;
  provider_id: string;
  status: 'connected' | 'disconnected' | 'error' | 'expired';
  account_name: string | null;
  connected_at: string | null;
  error_message: string | null;
  last_tested_at: string | null;
  last_test_status: string | null;
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'payments', label: 'Payments' },
  { key: 'liafrik', label: 'Liafrik' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'communication', label: 'Communication' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'ai', label: 'AI' },
  { key: 'developers', label: 'Developers' },
];

// A handful of self-hosted partner logos are wordmark-style assets (icon +
// text side by side, or icon + text stacked) rather than a roughly square
// mark. object-contain inside the card's fixed square logo box shrinks
// those to fit their longest side, so they render visibly smaller/more
// "zoomed out" than square logos in the same grid (e.g. payunit.png is a
// 256x71 wide banner — contained inside a 44x44 box it renders at ~12px
// tall). The box below is overflow-hidden, so scaling the image past the
// box's bounds crops its edges instead of shrinking further, which is the
// effect we actually want here: a bigger, "zoomed in" mark instead of a
// tiny one centered in empty space.
const LOGO_ZOOM: Record<string, number> = {
  flutterwave: 1.35,
  payunit: 2.4,
};

function authTypeLabel(authType: string): string {
  if (authType === 'oauth2' || authType === 'oauth') return 'OAuth';
  if (authType.startsWith('api_key')) return 'API Key';
  return authType.replace(/_/g, ' ');
}

export function MarketplacePage() {
  const { user, member } = useAuth();
  const { tenant, plan } = useTenant();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userCanConnect, setUserCanConnect] = useState(false);
  const [integrationLimit, setIntegrationLimit] = useState<number | null>(null);
  const [activeIntegrations, setActiveIntegrations] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  // BUG FIX: isProviderLocked used to compare `plan?.plan_id` — that field
  // (from useTenant()'s `subscription`) holds the plan's UUID, never a
  // code like 'starter'/'pro'. Comparing a UUID against
  // ['basic','pro','premium','enterprise'] always resolved to -1, so every
  // tenant on every real plan (Starter through Entreprise) saw any
  // provider gated at 'pro'/'premium'/'basic' as permanently locked,
  // including paying Entreprise customers. We now resolve the tenant's
  // actual plan CODE from tenants.plan_id -> plans.code (the same
  // authoritative source create_tenant_for_user sets at signup) and match
  // it against the real plan codes used everywhere else in the app:
  // starter / pro / premium / entreprise (see src/lib/plans.ts).
  const [planCode, setPlanCode] = useState<string | null>(null);

  const checkMarketplaceAccess = useCallback(async () => {
    if (!user?.id || !tenant?.id) return;

    try {
      // BUG FIX: this used `process.env.VITE_SUPABASE_URL`, which does not
      // exist in a Vite browser bundle (process.env is a Node concept —
      // Vite exposes env vars via import.meta.env, as every other edge
      // function call in this app already does). The fetch URL was
      // literally "undefined/functions/v1/marketplace-access-check" and
      // always failed, silently falling back to admin/super_admin-only
      // access — so a manager or staff member with real plan-level
      // connect permission could never actually connect an integration.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace-access-check`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
          user_id: user.id,
          action: 'connect',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setUserCanConnect(result.allowed && result.reason === 'access_granted');
        if (result.plan_limits) {
          setIntegrationLimit(result.plan_limits.max_integrations);
        }
      }
    } catch (error) {
      console.error('Failed to check marketplace access:', error);
      // Super admin can always connect
      setUserCanConnect(member?.role === 'super_admin' || member?.role === 'admin');
    }
  }, [user?.id, tenant?.id, member?.role]);

  const loadData = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      setLoading(true);

      // Load all providers
      const { data: providersData, error: providersError } = await supabase
        .from('integration_providers')
        .select('*')
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('provider_name');

      if (providersError) throw providersError;
      setProviders(providersData || []);

      // Load tenant's connections
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('tenant_id', tenant.id);

      if (connectionsError) throw connectionsError;
      setConnections(connectionsData || []);
      setActiveIntegrations(connectionsData?.length || 0);
    } catch (error) {
      console.error('Failed to load marketplace data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  // Load providers and connections
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!tenant?.plan_id) {
      setPlanCode(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('plans')
      .select('code')
      .eq('id', tenant.plan_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPlanCode(data?.code ?? null);
      });
    return () => { cancelled = true; };
  }, [tenant?.plan_id]);

  // Check marketplace access and plan limits
  useEffect(() => {
    if (!user?.id || !tenant?.id) return;
    checkMarketplaceAccess();
  }, [user?.id, tenant?.id, plan, checkMarketplaceAccess]);

  // Filter providers based on search and category
  const filteredProviders = providers.filter(provider => {
    // Category filter
    if (selectedCategory !== 'all' && provider.category !== selectedCategory) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        provider.provider_name.toLowerCase().includes(query) ||
        provider.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Separate featured and regular
  const featured = filteredProviders.filter(p => p.is_featured && selectedCategory === 'all');
  const regular = filteredProviders.filter(p => !p.is_featured || selectedCategory !== 'all');

  // Find connection status for a provider
  const getConnectionStatus = (providerId: string) => {
    return connections.find(c => c.provider_id === providerId);
  };

  const isProviderLocked = (provider: IntegrationProvider) => {
    if (!provider.minimum_plan) return false;
    // Real plan codes (src/lib/plans.ts), lowest to highest. 'basic' is
    // kept as an alias of 'starter' for any older provider row still
    // seeded with that value (e.g. mtn_momo, migration 0053).
    const planHierarchy = ['basic', 'starter', 'pro', 'premium', 'entreprise'];
    const currentPlanIndex = planHierarchy.indexOf(planCode?.toLowerCase() || 'starter');
    const requiredPlanIndex = planHierarchy.indexOf(provider.minimum_plan.toLowerCase());
    return currentPlanIndex < requiredPlanIndex;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-50 dark:from-ink-900 dark:to-ink-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-ink-900 dark:text-white">Marketplace</h1>
          <p className="mt-2 text-lg text-ink-600 dark:text-ink-400">
            Connect external services and extend POS Flow with powerful integrations
          </p>
        </div>

        {/* Plan usage banner */}
        {integrationLimit !== null && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
              activeIntegrations >= integrationLimit && !userCanConnect
                ? 'border-warning-500/60 bg-warning-50 text-warning-600 dark:border-warning-600 dark:bg-warning-600/20/20 dark:text-warning-500/60'
                : 'border-ink-200 bg-white text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300'
            }`}
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">
              {activeIntegrations} / {integrationLimit} integrations connected on your current plan
              {activeIntegrations >= integrationLimit && !userCanConnect && ' — upgrade your plan to connect more integrations.'}
            </p>
          </div>
        )}

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-ink-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-10 pr-4 text-ink-900 placeholder-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedCategory === cat.key
                    ? 'bg-brand-500 text-white shadow-soft'
                    : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 hover:border-brand-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded p-2 ${viewMode === 'grid' ? 'bg-brand-100 text-brand-500 dark:bg-brand-900' : 'text-ink-600 hover:bg-ink-200 dark:text-ink-400'}`}
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded p-2 ${viewMode === 'list' ? 'bg-brand-100 text-brand-500 dark:bg-brand-900' : 'text-ink-600 hover:bg-ink-200 dark:text-ink-400'}`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
          </div>
        ) : (
          <>
            {/* Featured Integrations (only in "all" view) */}
            {selectedCategory === 'all' && featured.length > 0 && (
              <div className="mb-12">
                <h2 className="mb-4 text-2xl font-bold text-ink-900 dark:text-white">Featured</h2>
                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : ''}`}>
                  {featured.map(provider => (
                    <IntegrationCard
                      key={provider.id}
                      provider={provider}
                      connection={getConnectionStatus(provider.id)}
                      isLocked={isProviderLocked(provider)}
                      onConnect={() => setSelectedProvider(provider)}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Integrations */}
            <div>
              <h2 className="mb-4 text-2xl font-bold text-ink-900 dark:text-white">
                {selectedCategory === 'all' ? 'All Integrations' : 'Integrations'}
              </h2>
              {regular.length === 0 ? (
                <div className="rounded-lg border border-dashed border-ink-300 bg-white p-8 text-center dark:border-ink-600 dark:bg-ink-800">
                  <p className="text-ink-600 dark:text-ink-400">No integrations found</p>
                </div>
              ) : (
                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : ''}`}>
                  {regular.map(provider => (
                    <IntegrationCard
                      key={provider.id}
                      provider={provider}
                      connection={getConnectionStatus(provider.id)}
                      isLocked={isProviderLocked(provider)}
                      onConnect={() => setSelectedProvider(provider)}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Connection Modal (stub for now) */}
      {selectedProvider && (
        <IntegrationConnectionModal
          provider={selectedProvider}
          connection={getConnectionStatus(selectedProvider.id)}
          onClose={() => setSelectedProvider(null)}
          onSuccess={() => {
            setSelectedProvider(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

interface IntegrationCardProps {
  provider: IntegrationProvider;
  connection: IntegrationConnection | undefined;
  isLocked: boolean;
  onConnect: () => void;
  viewMode: 'grid' | 'list';
}

function IntegrationCard({ provider, connection, isLocked, onConnect, viewMode }: IntegrationCardProps) {
  const navigate = useNavigate();
  const isConnected = connection?.status === 'connected';

  if (viewMode === 'list') {
    const listZoom = LOGO_ZOOM[provider.provider_key.toLowerCase()];
    return (
      <div className="flex items-center justify-between rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-800">
        <div className="flex items-center gap-4">
          {provider.logo_url && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-ink-100 dark:bg-ink-700">
              <img
                src={provider.logo_url}
                alt={provider.provider_name}
                className="h-8 w-8 object-contain"
                style={listZoom ? { transform: `scale(${listZoom})` } : undefined}
              />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-ink-900 dark:text-white">{provider.provider_name}</h3>
            <p className="text-sm text-ink-600 dark:text-ink-400">{provider.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && <span className="text-xs font-semibold text-warning-600 dark:text-warning-500">Premium</span>}
          {isConnected && <CheckCircle className="h-5 w-5 text-success-600" />}
          <button
            onClick={onConnect}
            disabled={isLocked}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              isConnected
                ? 'bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-300'
                : isLocked
                  ? 'cursor-not-allowed bg-ink-100 text-ink-400 dark:bg-ink-700'
                  : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}
          >
            {isConnected ? 'Manage' : isLocked ? 'Upgrade' : 'Connect'}
          </button>
        </div>
      </div>
    );
  }

  const zoom = LOGO_ZOOM[provider.provider_key.toLowerCase()];

  // Compact card: a fixed-height header row (logo + name/category) and a
  // fixed-height meta row (auth badge + Docs), with the button pinned to
  // the bottom via mt-auto — same "buttons line up across the row" fix as
  // before, just applied to a much denser layout (see App Marketplace
  // reference design: small square icon, one-line title, no description
  // or capability tags on the card face).
  return (
    <div className="group flex flex-col rounded-xl border border-ink-200 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-md dark:border-ink-700 dark:bg-ink-800 dark:hover:border-brand-500">
      {/* Header: logo + name/category, status check top-right */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-700 overflow-hidden">
          {provider.logo_url ? (
            <img
              src={provider.logo_url}
              alt={provider.provider_name}
              className="h-8 w-8 object-contain"
              style={zoom ? { transform: `scale(${zoom})` } : undefined}
            />
          ) : (
            <Plus className="h-5 w-5 text-ink-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold leading-tight text-ink-900 dark:text-white">
            {provider.provider_name}
          </h3>
          <p className="truncate text-xs text-ink-500 dark:text-ink-400">{provider.subcategory}</p>
        </div>
        {isConnected && (
          <CheckCircle className="h-4 w-4 shrink-0 text-success-600 dark:text-success-500" />
        )}
      </div>

      {/* Meta row: auth type + Docs link — this is the whole "body" in the
          compact layout, no description or capability tags on the card
          face (still available via More →). */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="rounded-full bg-ink-100 px-2 py-0.5 font-medium text-ink-600 dark:bg-ink-700 dark:text-ink-300">
          {authTypeLabel(provider.auth_type)}
        </span>
        <a
          href={provider.documentation_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-ink-500 hover:text-brand-500 dark:text-ink-400 dark:hover:text-brand-400"
        >
          Docs
          <ExternalLink className="h-3 w-3" />
        </a>
        <button
          onClick={() => navigate(`/integration/${provider.provider_key.toLowerCase()}`)}
          className="ml-auto font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          More →
        </button>
      </div>

      <div className="mt-auto">
        <button
          onClick={onConnect}
          disabled={isLocked}
          className={`w-full rounded-full px-3 py-2 text-sm font-medium transition-colors ${
            isConnected
              ? 'bg-success-600 text-white hover:bg-success-600'
              : isLocked
                ? 'cursor-not-allowed bg-ink-100 text-ink-400 dark:bg-ink-700'
                : 'bg-brand-500 text-white hover:bg-brand-600'
          }`}
        >
          {isConnected ? 'Connected' : isLocked ? 'Upgrade' : 'Connect'}
        </button>

        {/* Lock Badge */}
        {isLocked && provider.minimum_plan && (
          <div className="mt-2 rounded bg-warning-50 p-2 text-center dark:bg-warning-600/20 dark:bg-opacity-30">
            <p className="text-xs font-medium text-warning-600 dark:text-warning-500">
              {/* Real plan display names — never show the raw DB code
                  ('basic' has no matching plan; the real lowest tier is
                  'Starter'). Keep in sync with src/lib/plans.ts. */}
              Upgrade to {(
                { basic: 'Starter', starter: 'Starter', pro: 'Pro', premium: 'Premium', entreprise: 'Entreprise' }[
                  provider.minimum_plan.toLowerCase()
                ] ?? provider.minimum_plan
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnectionModalProps {
  provider: IntegrationProvider;
  connection: IntegrationConnection | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

function IntegrationConnectionModal({ provider, connection, onClose, onSuccess }: ConnectionModalProps) {
  const { tenant } = useTenant();
  const [showForm, setShowForm] = useState(!connection || connection.status === 'disconnected' || connection.status === 'error');
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    if (!connection || !tenant?.id) return;

    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('integration_connections')
        .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
        .eq('id', connection.id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      onSuccess();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50">
      <div className="w-full max-w-md bg-white dark:bg-ink-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b border-ink-200 dark:border-ink-700 p-6">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white">
            {connection?.status === 'connected' ? 'Manage' : 'Connect'} {provider.provider_name}
          </h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {connection?.status === 'connected' && !showForm ? (
            // Connected state
            <div className="space-y-6">
              <div className="rounded-lg bg-success-50 dark:bg-success-600/20 border border-success-100 dark:border-success-600/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-500" />
                  <span className="font-semibold text-success-600 dark:text-success-500">Connected</span>
                </div>
                <p className="text-sm text-success-600 dark:text-success-500">
                  Account: <strong>{connection.account_name || 'Connected account'}</strong>
                </p>
                {connection.last_tested_at && (
                  <p className="text-xs text-success-600 dark:text-success-500 mt-2">
                    Last tested: {new Date(connection.last_tested_at).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Webhook status */}
              {provider.capabilities.includes('webhooks') && (
                <div className="p-4 bg-ink-50 dark:bg-ink-700 rounded-lg">
                  <p className="text-sm font-medium text-ink-900 dark:text-white mb-2">Webhook Status</p>
                  <p className="text-xs text-ink-600 dark:text-ink-400">
                    Webhooks are configured and ready to receive events.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-4 py-2 border border-ink-300 dark:border-ink-600 rounded-full text-ink-900 dark:text-white font-medium hover:bg-ink-50 dark:hover:bg-ink-700 transition-colors"
                >
                  Update Credentials
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="w-full px-4 py-2 border border-error-100 dark:border-error-500 rounded-full text-error-500 dark:text-error-500 font-medium hover:bg-error-50 dark:hover:bg-error-600/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>

              <a
                href={provider.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-brand-500 dark:text-brand-400 hover:text-brand-600 mt-4"
              >
                <ExternalLink className="w-4 h-4" />
                View Documentation
              </a>
            </div>
          ) : (
            // Form state
            <>
              <IntegrationCredentialForm
                providerKey={provider.provider_key}
                providerName={provider.provider_name}
                authSchema={provider.auth_schema || { type: 'object', properties: {}, required: [] }}
                tenantId={tenant?.id || ''}
                onSuccess={() => {
                  setShowForm(false);
                  onSuccess();
                }}
                onCancel={onClose}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
