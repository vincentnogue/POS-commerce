import { useState } from 'react';
import { CheckCircle, ExternalLink, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenant';
import { IntegrationCredentialForm } from './IntegrationCredentialForm';

// Extracted from MarketplacePage so the SAME real connect/manage/disconnect
// flow backs every entry point into an integration — the grid card, the
// list row, AND the /integration/:id detail page. Before this, the detail
// page had its own hardcoded, fake "Connect" button (no onClick at all)
// with a completely different color scheme (raw bg-blue-600/bg-green-600
// vs. the app's brand/success tokens everywhere else) — a single shared
// component makes that drift impossible going forward.

export interface IntegrationProviderLike {
  id: string;
  provider_key: string;
  provider_name: string;
  documentation_url: string;
  auth_schema: { type: string; properties: Record<string, { type: string; title: string }>; required: string[] } | null;
  capabilities: string[];
}

export interface IntegrationConnectionLike {
  id: string;
  provider_id: string;
  status: 'connected' | 'disconnected' | 'error' | 'expired';
  account_name: string | null;
  connected_at: string | null;
  error_message: string | null;
  last_tested_at: string | null;
  last_test_status: string | null;
}

interface Props {
  provider: IntegrationProviderLike;
  connection: IntegrationConnectionLike | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

export function IntegrationConnectionModal({ provider, connection, onClose, onSuccess }: Props) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl2 bg-white shadow-xl dark:bg-ink-800">
        <div className="relative border-b border-ink-200 p-6 dark:border-ink-700">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white">
            {connection?.status === 'connected' ? 'Manage' : 'Connect'} {provider.provider_name}
          </h2>
          <button onClick={onClose} className="absolute right-4 top-4 text-ink-500 hover:text-ink-700 dark:hover:text-ink-300">
            ✕
          </button>
        </div>

        <div className="p-6">
          {connection?.status === 'connected' && !showForm ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-success-100 bg-success-50 p-4 dark:border-success-600/40 dark:bg-success-600/20">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success-600 dark:text-success-500" />
                  <span className="font-semibold text-success-600 dark:text-success-500">Connected</span>
                </div>
                <p className="text-sm text-success-600 dark:text-success-500">
                  Account: <strong>{connection.account_name || 'Connected account'}</strong>
                </p>
                {connection.last_tested_at && (
                  <p className="mt-2 text-xs text-success-600 dark:text-success-500">
                    Last tested: {new Date(connection.last_tested_at).toLocaleString()}
                  </p>
                )}
              </div>

              {provider.capabilities.includes('webhooks') && (
                <div className="rounded-lg bg-ink-50 p-4 dark:bg-ink-700">
                  <p className="mb-2 text-sm font-medium text-ink-900 dark:text-white">Webhook Status</p>
                  <p className="text-xs text-ink-600 dark:text-ink-400">Webhooks are configured and ready to receive events.</p>
                </div>
              )}

              <div className="space-y-2">
                <button onClick={() => setShowForm(true)} className="btn-ghost w-full">Update Credentials</button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-error-100 px-4 py-2 font-medium text-error-500 transition-colors hover:bg-error-50 disabled:opacity-50 dark:border-error-500 dark:hover:bg-error-600/20"
                >
                  <Trash2 className="h-4 w-4" />
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>

              <a
                href={provider.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                <ExternalLink className="h-4 w-4" />
                View Documentation
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
        </div>
      </div>
    </div>
  );
}
