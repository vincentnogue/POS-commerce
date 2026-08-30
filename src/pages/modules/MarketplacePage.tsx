import { useEffect, useState } from 'react';
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

  // Load providers and connections
  useEffect(() => {
    loadData();
  }, [tenant?.id]);

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
  }, [user?.id, tenant?.id, plan]);

  async function checkMarketplaceAccess() {
    if (!user?.id || !tenant?.id) return;

    try {
      // Call marketplace-access-check function
      const response = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/marketplace-access-check`, {
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
  }

  async function loadData() {
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
  }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Marketplace</h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
            Connect external services and extend POS Flow with powerful integrations
          </p>
        </div>

        {/* Plan usage banner */}
        {integrationLimit !== null && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
              activeIntegrations >= integrationLimit && !userCanConnect
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
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
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-slate-900 placeholder-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`rounded-full px-4 py-2 transition-colors ${
                  selectedCategory === cat.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
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
              className={`rounded p-2 ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400'}`}
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded p-2 ${viewMode === 'list' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400'}`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          </div>
        ) : (
          <>
            {/* Featured Integrations (only in "all" view) */}
            {selectedCategory === 'all' && featured.length > 0 && (
              <div className="mb-12">
                <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">Featured</h2>
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
              <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">
                {selectedCategory === 'all' ? 'All Integrations' : 'Integrations'}
              </h2>
              {regular.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-800">
                  <p className="text-slate-600 dark:text-slate-400">No integrations found</p>
                </div>
              ) : (
                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''}`}>
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
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-4">
          {provider.logo_url && (
            <img
              src={provider.logo_url}
              alt={provider.provider_name}
              className="h-10 w-10 rounded object-contain"
            />
          )}
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{provider.provider_name}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{provider.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Premium</span>}
          {isConnected && <CheckCircle className="h-5 w-5 text-green-600" />}
          <button
            onClick={onConnect}
            disabled={isLocked}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              isConnected
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                : isLocked
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isConnected ? 'Manage' : isLocked ? 'Upgrade' : 'Connect'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col rounded-lg border border-slate-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600">
      {/* Logo */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
        {provider.logo_url ? (
          <img
            src={provider.logo_url}
            alt={provider.provider_name}
            className="h-8 w-8 object-contain"
          />
        ) : (
          <Plus className="h-6 w-6 text-slate-400" />
        )}
      </div>

      {/* Name & Status */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">{provider.provider_name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{provider.subcategory}</p>
        </div>
        {isConnected && (
          <div className="rounded-full bg-green-100 p-1 dark:bg-green-900">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        )}
      </div>

      {/* Description */}
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">{provider.description}</p>

      {/* Capabilities */}
      <div className="mb-4 flex flex-wrap gap-1">
        {provider.capabilities.slice(0, 3).map(cap => (
          <span
            key={cap}
            className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          >
            {cap}
          </span>
        ))}
      </div>

      {/* BUG FIX: this card used to be a plain block div, so in a CSS
          grid row (which stretches every card to the tallest card's
          height by default), the Connect/Upgrade button sat wherever
          normal document flow put it — right after however much
          description/capability-tag text came before it. Cards with a
          longer description, more capability tags, or (since the plan-
          gating fix) a Lock Badge that only some cards show, ended up
          with their buttons at visibly different vertical positions in
          the same row — "les boutons ont glissé". flex flex-col above +
          mt-auto here pins this footer to the bottom of every card
          regardless of how much content is above it, so buttons always
          line up across a row. */}
      <div className="mt-auto">
        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/integration/${provider.provider_key.toLowerCase()}`)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              More →
            </button>
            <a
              href={provider.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
            >
              Docs
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <button
            onClick={onConnect}
            disabled={isLocked}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              isConnected
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                : isLocked
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isConnected ? 'Manage' : isLocked ? 'Upgrade' : 'Connect'}
          </button>
        </div>

        {/* Lock Badge */}
        {isLocked && provider.minimum_plan && (
          <div className="mt-2 rounded bg-amber-50 p-2 text-center dark:bg-amber-900 dark:bg-opacity-30">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
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
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {connection?.status === 'connected' ? 'Manage' : 'Connect'} {provider.provider_name}
          </h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {connection?.status === 'connected' && !showForm ? (
            // Connected state
            <div className="space-y-6">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-green-700 dark:text-green-400">Connected</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400">
                  Account: <strong>{connection.account_name || 'Connected account'}</strong>
                </p>
                {connection.last_tested_at && (
                  <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                    Last tested: {new Date(connection.last_tested_at).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Webhook status */}
              {provider.capabilities.includes('webhooks') && (
                <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Webhook Status</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Webhooks are configured and ready to receive events.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Update Credentials
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="w-full px-4 py-2 border border-red-300 dark:border-red-600 rounded-lg text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>

              <a
                href={provider.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 mt-4"
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
