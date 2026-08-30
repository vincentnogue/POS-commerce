import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Grid, List, Plus, CheckCircle, ExternalLink, Trash2, Store, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useTenant } from '../../lib/tenant';
import { useI18n } from '../../lib/i18n';
import { PageHeader, Modal, Badge, EmptyState, StatCard, useToast } from '../../components/ui';
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

const CATEGORY_KEYS = ['all', 'payments', 'ai', 'liafrik', 'logistics', 'communication', 'accounting', 'developers'];

// Real plan display names — never show the raw DB code ('basic' has no
// matching plan; the real lowest tier is 'Starter'). Keep in sync with
// src/lib/plans.ts.
const PLAN_DISPLAY_NAMES: Record<string, string> = { basic: 'Starter', starter: 'Starter', pro: 'Pro', premium: 'Premium', entreprise: 'Entreprise' };
const PLAN_HIERARCHY = ['basic', 'starter', 'pro', 'premium', 'entreprise'];

export function MarketplacePage() {
  const { t } = useI18n();
  const { user, member } = useAuth();
  const { tenant, plan } = useTenant();
  const toast = useToast();
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

  useEffect(() => { loadData(); }, [tenant?.id]);

  useEffect(() => {
    if (!tenant?.plan_id) { setPlanCode(null); return; }
    let cancelled = false;
    supabase.from('plans').select('code').eq('id', tenant.plan_id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setPlanCode(data?.code ?? null); });
    return () => { cancelled = true; };
  }, [tenant?.plan_id]);

  useEffect(() => {
    if (!user?.id || !tenant?.id) return;
    checkMarketplaceAccess();
  }, [user?.id, tenant?.id, plan]);

  async function checkMarketplaceAccess() {
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
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ tenant_id: tenant.id, user_id: user.id, action: 'connect' }),
      });
      if (response.ok) {
        const result = await response.json();
        setUserCanConnect(result.allowed && result.reason === 'access_granted');
        if (result.plan_limits) setIntegrationLimit(result.plan_limits.max_integrations);
      }
    } catch (error) {
      console.error('Failed to check marketplace access:', error);
      setUserCanConnect(member?.role === 'super_admin' || member?.role === 'admin');
    }
  }

  async function loadData() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const { data: providersData, error: providersError } = await supabase
        .from('integration_providers').select('*').eq('is_active', true)
        .order('is_featured', { ascending: false }).order('provider_name');
      if (providersError) throw providersError;
      setProviders(providersData || []);

      const { data: connectionsData, error: connectionsError } = await supabase
        .from('integration_connections').select('*').eq('tenant_id', tenant.id);
      if (connectionsError) throw connectionsError;
      setConnections(connectionsData || []);
      setActiveIntegrations(connectionsData?.length || 0);
    } catch (error: any) {
      toast('error', error.message ?? t('marketplace.err.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  const filteredProviders = providers.filter((provider) => {
    if (selectedCategory !== 'all' && provider.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return provider.provider_name.toLowerCase().includes(query) || provider.description?.toLowerCase().includes(query);
    }
    return true;
  });

  const featured = filteredProviders.filter((p) => p.is_featured && selectedCategory === 'all');
  const regular = filteredProviders.filter((p) => !p.is_featured || selectedCategory !== 'all');

  const getConnectionStatus = (providerId: string) => connections.find((c) => c.provider_id === providerId);

  const isProviderLocked = (provider: IntegrationProvider) => {
    if (!provider.minimum_plan) return false;
    const currentPlanIndex = PLAN_HIERARCHY.indexOf(planCode?.toLowerCase() || 'starter');
    const requiredPlanIndex = PLAN_HIERARCHY.indexOf(provider.minimum_plan.toLowerCase());
    return currentPlanIndex < requiredPlanIndex;
  };

  return (
    <div>
      <PageHeader
        icon={Store}
        title={t('marketplace.title')}
        subtitle={t('marketplace.subtitle')}
        action={
          <div className="flex items-center gap-1 rounded-lg border border-ink-200 dark:border-ink-700 p-1">
            <button onClick={() => setViewMode('grid')} className={`rounded-md p-1.5 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30' : 'text-ink-400 hover:text-ink-600'}`}>
              <Grid size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className={`rounded-md p-1.5 ${viewMode === 'list' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30' : 'text-ink-400 hover:text-ink-600'}`}>
              <List size={16} />
            </button>
          </div>
        }
      />

      {integrationLimit !== null && (
        <div className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${
          activeIntegrations >= integrationLimit && !userCanConnect
            ? 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-900/40 dark:bg-warning-900/20 dark:text-warning-300'
            : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300'
        }`}>
          {t('marketplace.planUsage', { active: activeIntegrations, limit: integrationLimit })}
          {activeIntegrations >= integrationLimit && !userCanConnect && ` — ${t('marketplace.planUsage.upgrade')}`}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t('marketplace.stats.available')} value={providers.length} icon={Store} tone="brand" />
        <StatCard label={t('marketplace.stats.connected')} value={activeIntegrations} icon={CheckCircle} tone="success" />
        <StatCard label={t('marketplace.stats.limit')} value={integrationLimit ?? '∞'} icon={Zap} tone="flow" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('marketplace.searchPlaceholder')}
            className="input pl-9"
          />
        </div>
        {CATEGORY_KEYS.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              selectedCategory === cat ? 'bg-brand-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700'
            }`}
          >
            {t(`marketplace.category.${cat}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
        </div>
      ) : (
        <>
          {selectedCategory === 'all' && featured.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">{t('marketplace.featured')}</h2>
              <div className={viewMode === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' : 'space-y-2'}>
                {featured.map((provider) => (
                  <IntegrationCard key={provider.id} provider={provider} connection={getConnectionStatus(provider.id)} isLocked={isProviderLocked(provider)} onConnect={() => setSelectedProvider(provider)} viewMode={viewMode} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {selectedCategory === 'all' ? t('marketplace.allIntegrations') : t('marketplace.integrations')}
            </h2>
            {regular.length === 0 ? (
              <EmptyState icon={Store} title={t('marketplace.empty.title')} description={t('marketplace.empty.desc')} />
            ) : (
              <div className={viewMode === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' : 'space-y-2'}>
                {regular.map((provider) => (
                  <IntegrationCard key={provider.id} provider={provider} connection={getConnectionStatus(provider.id)} isLocked={isProviderLocked(provider)} onConnect={() => setSelectedProvider(provider)} viewMode={viewMode} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selectedProvider && (
        <IntegrationConnectionModal
          provider={selectedProvider}
          connection={getConnectionStatus(selectedProvider.id)}
          onClose={() => setSelectedProvider(null)}
          onSuccess={() => { setSelectedProvider(null); loadData(); }}
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const isConnected = connection?.status === 'connected';

  if (viewMode === 'list') {
    return (
      <div className="card flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-800">
            {provider.logo_url ? <img src={provider.logo_url} alt={provider.provider_name} className="h-7 w-7 object-contain" /> : <Plus size={16} className="text-ink-400" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">{provider.provider_name}</h3>
            <p className="text-xs text-ink-500 dark:text-ink-400 line-clamp-1">{provider.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && <Badge tone="warning">{t('marketplace.premium')}</Badge>}
          {isConnected && <CheckCircle size={16} className="text-success-600" />}
          <button
            onClick={onConnect}
            disabled={isLocked}
            className={isConnected ? 'btn-ghost !px-3 !py-1 text-xs' : isLocked ? 'btn-ghost !px-3 !py-1 text-xs cursor-not-allowed opacity-50' : 'btn-primary !px-3 !py-1 text-xs'}
          >
            {isConnected ? t('marketplace.manage') : isLocked ? t('marketplace.upgrade') : t('marketplace.connect')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card group p-4 transition hover:border-brand-200 dark:hover:border-brand-800">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-800">
        {provider.logo_url ? <img src={provider.logo_url} alt={provider.provider_name} className="h-7 w-7 object-contain" /> : <Plus size={18} className="text-ink-400" />}
      </div>

      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">{provider.provider_name}</h3>
          <p className="text-xs text-ink-400 dark:text-ink-500">{provider.subcategory}</p>
        </div>
        {isConnected && (
          <div className="rounded-full bg-success-50 dark:bg-success-900/25 p-1">
            <CheckCircle size={14} className="text-success-600" />
          </div>
        )}
      </div>

      <p className="mb-3 text-xs text-ink-500 dark:text-ink-400 line-clamp-2">{provider.description}</p>

      <div className="mb-3 flex flex-wrap gap-1">
        {provider.capabilities.slice(0, 3).map((cap) => (
          <span key={cap} className="rounded-full bg-brand-50 dark:bg-brand-900/25 px-2 py-0.5 text-[11px] text-brand-700 dark:text-brand-300">{cap}</span>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 dark:border-ink-800 pt-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/integration/${provider.provider_key.toLowerCase()}`)} className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            {t('marketplace.more')} →
          </button>
          <a href={provider.documentation_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-ink-500 hover:text-brand-600 dark:text-ink-400">
            {t('marketplace.docs')} <ExternalLink size={11} />
          </a>
        </div>
        <button
          onClick={onConnect}
          disabled={isLocked}
          className={isConnected ? 'btn-ghost !px-3 !py-1 text-xs' : isLocked ? 'btn-ghost !px-3 !py-1 text-xs cursor-not-allowed opacity-50' : 'btn-primary !px-3 !py-1 text-xs'}
        >
          {isConnected ? t('marketplace.manage') : isLocked ? t('marketplace.upgrade') : t('marketplace.connect')}
        </button>
      </div>

      {isLocked && provider.minimum_plan && (
        <div className="mt-2 rounded-lg bg-warning-50 dark:bg-warning-900/20 p-2 text-center">
          <p className="text-xs font-medium text-warning-700 dark:text-warning-300">
            {t('marketplace.upgradeTo', { plan: PLAN_DISPLAY_NAMES[provider.minimum_plan.toLowerCase()] ?? provider.minimum_plan })}
          </p>
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
  const { t } = useI18n();
  const { tenant } = useTenant();
  const toast = useToast();
  const [showForm, setShowForm] = useState(!connection || connection.status === 'disconnected' || connection.status === 'error');
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    if (!connection || !tenant?.id) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('integration_connections')
        .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
        .eq('id', connection.id).eq('tenant_id', tenant.id);
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      toast('error', err.message ?? t('marketplace.err.disconnectFailed'));
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`${connection?.status === 'connected' ? t('marketplace.manage') : t('marketplace.connect')} ${provider.provider_name}`} maxWidth="max-w-md">
      {connection?.status === 'connected' && !showForm ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-success-200 bg-success-50 dark:border-success-900/40 dark:bg-success-900/20 p-3">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle size={16} className="text-success-600" />
              <span className="text-sm font-semibold text-success-700 dark:text-success-300">{t('marketplace.connected')}</span>
            </div>
            <p className="text-xs text-success-700 dark:text-success-300">
              {t('marketplace.account')}: <strong>{connection.account_name || t('marketplace.connectedAccount')}</strong>
            </p>
            {connection.last_tested_at && (
              <p className="mt-1 text-xs text-success-600 dark:text-success-400">{t('marketplace.lastTested')}: {new Date(connection.last_tested_at).toLocaleString()}</p>
            )}
          </div>

          {provider.capabilities.includes('webhooks') && (
            <div className="rounded-xl bg-ink-50 dark:bg-ink-800/50 p-3">
              <p className="mb-1 text-sm font-medium text-ink-900 dark:text-ink-50">{t('marketplace.webhookStatus')}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">{t('marketplace.webhookStatusDesc')}</p>
            </div>
          )}

          <div className="space-y-2">
            <button onClick={() => setShowForm(true)} className="btn-ghost w-full justify-center">{t('marketplace.updateCredentials')}</button>
            <button onClick={handleDisconnect} disabled={disconnecting} className="flex w-full items-center justify-center gap-2 rounded-lg border border-error-200 dark:border-error-900/40 px-4 py-2 text-sm font-medium text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 disabled:opacity-50">
              <Trash2 size={15} /> {disconnecting ? t('marketplace.disconnecting') : t('marketplace.disconnect')}
            </button>
          </div>

          <a href={provider.documentation_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700">
            <ExternalLink size={14} /> {t('marketplace.viewDocs')}
          </a>
        </div>
      ) : (
        <IntegrationCredentialForm
          providerKey={provider.provider_key}
          providerName={provider.provider_name}
          authSchema={provider.auth_schema || { type: 'object', properties: {}, required: [] }}
          tenantId={tenant?.id || ''}
          onSuccess={() => { setShowForm(false); onSuccess(); }}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
