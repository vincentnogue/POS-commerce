import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Crown, Users, Building2, DollarSign, Plug, BarChart3, Shield, TrendingUp,
  Trash2, Check
} from 'lucide-react';
import { Spinner, Badge } from '../../components/ui';

type Tab = 'overview' | 'tenants' | 'users' | 'subscriptions' | 'integrations' | 'payments' | 'audit';

interface Tenant {
  id: string;
  name: string;
  plan_id: string;
  created_at: string;
}

interface Integration {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  logo_url: string;
  featured: boolean;
}

interface Connection {
  id: string;
  tenant_id: string;
  integration_id: string;
  status: string;
  created_at: string;
}

interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
}

export function SuperAdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // UI states
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);

      // Load integrations
      const { data: integsData } = await supabase
        .from('integration_providers')
        .select('*')
        .eq('status', 'active');

      setIntegrations(integsData || []);

      // Load connections
      const { data: connsData } = await supabase
        .from('integration_connections')
        .select('*');

      setConnections(connsData || []);

      // Load tenants
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*')
        .limit(100);

      setTenants(tenantsData || []);

      // Load subscriptions
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('*')
        .limit(100);

      setSubscriptions(subsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnectIntegration(connectionId: string) {
    try {
      await supabase
        .from('integration_connections')
        .delete()
        .eq('id', connectionId);

      loadAllData();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900">
      {/* Header */}
      <div className="border-b border-ink-800/50 bg-ink-950/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Crown className="w-8 h-8 text-brand-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Super Admin Dashboard</h1>
              <p className="text-ink-300 text-sm">Full platform control and monitoring</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'integrations', label: 'Integrations', icon: Plug },
              { id: 'tenants', label: 'Tenants', icon: Building2 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'subscriptions', label: 'Subscriptions', icon: DollarSign },
              { id: 'audit', label: 'Audit Log', icon: Shield },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id as Tab)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${
                  tab === id
                    ? 'bg-flow-500 text-white'
                    : 'bg-ink-800/50 text-ink-200 hover:bg-ink-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink-400 text-sm">Total Tenants</p>
                  <p className="text-3xl font-bold text-white">{tenants.length}</p>
                </div>
                <Building2 className="w-8 h-8 text-flow-400" />
              </div>
            </div>

            <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink-400 text-sm">Active Integrations</p>
                  <p className="text-3xl font-bold text-white">{connections.length}</p>
                </div>
                <Plug className="w-8 h-8 text-brand-400" />
              </div>
            </div>

            <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink-400 text-sm">Active Subscriptions</p>
                  <p className="text-3xl font-bold text-white">
                    {subscriptions.filter((s) => s.status === 'active').length}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink-400 text-sm">Payment Processors</p>
                  <p className="text-3xl font-bold text-white">{integrations.length}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {tab === 'integrations' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">All Payment Processors & Integrations</h2>

            {/* Integration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {integrations.map((integration) => {
                const isConnected = connections.some((c) => c.integration_id === integration.id);
                const connectionCount = connections.filter((c) => c.integration_id === integration.id).length;

                return (
                  <div
                    key={integration.id}
                    className="rounded-lg bg-ink-900/50 border border-ink-700 p-6 hover:border-flow-500/50 transition"
                  >
                    <div className="mb-4">
                      <img
                        src={integration.logo_url}
                        alt={integration.name}
                        className="w-12 h-12 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23333"/></svg>';
                        }}
                      />
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">{integration.name}</h3>
                    <p className="text-sm text-ink-300 mb-4">{integration.description}</p>

                    <div className="mb-4 flex gap-2">
                      <Badge tone="neutral">{integration.category}</Badge>
                      {integration.featured && <Badge tone="brand">Featured</Badge>}
                    </div>

                    {isConnected && (
                      <div className="mb-3 p-2 rounded bg-green-500/10 border border-green-500/30">
                        <p className="text-xs text-green-300 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {connectionCount} connection{connectionCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSelectedIntegration(integration);
                        document.getElementById('active-connections-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="w-full px-4 py-2 rounded bg-flow-500 text-white hover:bg-flow-600 transition font-medium text-sm"
                    >
                      {isConnected ? 'Manage Connections' : 'Connect Now'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Active Connections */}
            {connections.length > 0 && (
              <div id="active-connections-section" className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  Active Connections ({connections.length})
                </h3>
                <div className="space-y-3">
                  {connections.map((conn) => {
                    const integration = integrations.find((i) => i.id === conn.integration_id);
                    const isSelected = selectedIntegration?.id === conn.integration_id;
                    return (
                      <div
                        key={conn.id}
                        className={`flex items-center justify-between p-4 rounded bg-ink-800/50 border transition ${isSelected ? 'border-flow-500 ring-1 ring-flow-500/50' : 'border-ink-700'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Check className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="font-medium text-white">{integration?.name}</p>
                            <p className="text-xs text-ink-400">
                              Connected: {new Date(conn.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDisconnectIntegration(conn.id)}
                          className="px-4 py-2 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition text-sm flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Disconnect
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tenants Tab */}
        {tab === 'tenants' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">All Tenants ({tenants.length})</h2>
            <div className="rounded-lg bg-ink-900/50 border border-ink-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ink-700 bg-ink-800/50">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink-200">Tenant Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink-200">ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink-200">Plan</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink-200">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr key={tenant.id} className="border-b border-ink-700 hover:bg-ink-800/30 transition">
                        <td className="px-6 py-4 text-white font-medium">{tenant.name}</td>
                        <td className="px-6 py-4 text-ink-300 text-sm font-mono">{tenant.id.slice(0, 8)}...</td>
                        <td className="px-6 py-4 text-ink-300">{tenant.plan_id || 'Free'}</td>
                        <td className="px-6 py-4 text-ink-300 text-sm">
                          {new Date(tenant.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Subscriptions Tab */}
        {tab === 'subscriptions' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Active Subscriptions ({subscriptions.length})</h2>
            <div className="rounded-lg bg-ink-900/50 border border-ink-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ink-700 bg-ink-800/50">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink-200">Plan</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink-200">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-ink-200">Period End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="border-b border-ink-700 hover:bg-ink-800/30 transition">
                        <td className="px-6 py-4 text-white font-medium">{sub.plan_id}</td>
                        <td className="px-6 py-4">
                          <Badge
                            tone={sub.status === 'active' ? 'success' : 'neutral'}
                          >
                            {sub.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-ink-300 text-sm">
                          {new Date(sub.current_period_end).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Other tabs */}
        {tab === 'users' && (
          <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-8 text-center">
            <Users className="w-12 h-12 text-ink-600 mx-auto mb-4" />
            <p className="text-ink-300">User management system ready for implementation</p>
          </div>
        )}

        {tab === 'audit' && (
          <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-8 text-center">
            <Shield className="w-12 h-12 text-ink-600 mx-auto mb-4" />
            <p className="text-ink-300">Audit logs tracking all platform activity</p>
          </div>
        )}
      </div>
    </div>
  );
}
