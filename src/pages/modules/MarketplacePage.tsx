import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useTenant } from '../../lib/tenant';
import { Search, Grid, List, Filter, Plus, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

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
  { key: 'developers', label: 'Developers' },
];

export function MarketplacePage() {
  const { user } = useAuth();
  const { tenant, plan } = useTenant();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);

  // Load providers and connections
  useEffect(() => {
    loadData();
  }, [tenant?.id]);

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
    const planHierarchy = ['basic', 'pro', 'premium', 'enterprise'];
    const currentPlanIndex = planHierarchy.indexOf(plan?.code?.toLowerCase() || 'basic');
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
    <div className="group rounded-lg border border-slate-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600">
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
        <a
          href={provider.documentation_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          Docs
          <ExternalLink className="h-3 w-3" />
        </a>

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
      {isLocked && (
        <div className="mt-2 rounded bg-amber-50 p-2 text-center dark:bg-amber-900 dark:bg-opacity-30">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Upgrade to {provider.minimum_plan}</p>
        </div>
      )}
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
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-slate-800">
        <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">
          {connection?.status === 'connected' ? 'Manage' : 'Connect'} {provider.provider_name}
        </h2>

        <div className="mb-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">{provider.description}</p>

          {connection?.status === 'connected' && (
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900 dark:bg-opacity-30">
              <p className="text-sm text-green-700 dark:text-green-400">
                ✓ Connected to <strong>{connection.account_name || 'account'}</strong>
              </p>
            </div>
          )}

          {connection?.status === 'error' && (
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900 dark:bg-opacity-30">
              <p className="text-sm text-red-700 dark:text-red-400">{connection.error_message}</p>
            </div>
          )}

          <div className="space-y-3">
            {/* Placeholder: Credential form will go here */}
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Credential form for {provider.auth_type} will render here
              </p>
            </div>

            <a
              href={provider.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <ExternalLink className="h-4 w-4" />
              View Documentation
            </a>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            disabled
            className="flex-1 cursor-not-allowed rounded-lg bg-blue-600 px-4 py-2 font-medium text-white opacity-50"
          >
            (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
}
