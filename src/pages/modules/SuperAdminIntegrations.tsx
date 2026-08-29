import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plug, Check, Loader2, Trash2 } from 'lucide-react';

interface Integration {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  logo_url: string;
  featured: boolean;
  schema?: any;
}

interface Connection {
  id: string;
  tenant_id: string;
  integration_id: string;
  status: string;
  created_at: string;
}

export function SuperAdminIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load all integration providers
      const { data: integs, error: integError } = await supabase
        .from('integration_providers')
        .select('*')
        .eq('status', 'active');

      if (integError) throw integError;
      setIntegrations(integs || []);

      // Load connections for this tenant
      const { data: conns, error: connError } = await supabase
        .from('integration_connections')
        .select('*');

      if (connError) throw connError;
      setConnections(conns || []);
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(integration: Integration) {
    // For now, just show the integration details
    setSelectedIntegration(integration);
  }

  async function handleDisconnect(connectionId: string) {
    try {
      const { error } = await supabase
        .from('integration_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 text-flow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
          <Plug className="w-8 h-8 text-flow-400" />
          All Integrations (Super Admin Access)
        </h1>
        <p className="text-ink-300">Full access to {integrations.length} payment processors and integrations</p>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {integrations.map((integration) => {
          const isConnected = connections.some((c) => c.integration_id === integration.id);

          return (
            <div
              key={integration.id}
              className="rounded-lg bg-ink-900/50 border border-ink-700 p-6 hover:border-flow-500/50 transition"
            >
              {/* Logo */}
              <div className="mb-4">
                <img
                  src={integration.logo_url}
                  alt={integration.name}
                  className="w-12 h-12 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/></svg>';
                  }}
                />
              </div>

              {/* Name & Status */}
              <h3 className="text-lg font-bold text-white mb-2">{integration.name}</h3>
              <p className="text-sm text-ink-300 mb-4">{integration.description}</p>

              {/* Category Badge */}
              <div className="mb-4">
                <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-flow-500/20 text-flow-300">
                  {integration.category}
                </span>
                {integration.featured && (
                  <span className="ml-2 inline-block px-2 py-1 rounded text-xs font-semibold bg-brand-500/20 text-brand-300">
                    Featured
                  </span>
                )}
              </div>

              {/* Status & Actions */}
              <div className="flex gap-2">
                {isConnected ? (
                  <>
                    <button
                      onClick={() => setSelectedIntegration(integration)}
                      className="flex-1 px-4 py-2 rounded bg-flow-500/20 text-flow-300 hover:bg-flow-500/30 transition font-medium text-sm"
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => {
                        const conn = connections.find((c) => c.integration_id === integration.id);
                        if (conn) handleDisconnect(conn.id);
                      }}
                      className="px-4 py-2 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(integration)}
                    className="w-full px-4 py-2 rounded bg-brand-500 text-white hover:bg-brand-600 transition font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <Plug className="w-4 h-4" />
                    Connect
                  </button>
                )}
              </div>

              {/* Connected Indicator */}
              {isConnected && (
                <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
                  <Check className="w-4 h-4" />
                  Connected
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Connected Integrations Summary */}
      {connections.length > 0 && (
        <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Active Connections ({connections.length})</h2>
          <div className="space-y-3">
            {connections.map((conn) => {
              const integration = integrations.find((i) => i.id === conn.integration_id);
              return (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-3 rounded bg-ink-800/50 border border-ink-700"
                >
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="font-medium text-white">{integration?.name}</p>
                      <p className="text-xs text-ink-400">Connected: {new Date(conn.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    className="px-3 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition text-sm"
                  >
                    Disconnect
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
