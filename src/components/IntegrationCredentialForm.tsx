import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthSchema {
  type: string;
  properties: Record<string, { type: string; title: string }>;
  required: string[];
}

interface IntegrationCredentialFormProps {
  providerKey: string;
  providerName: string;
  authSchema: AuthSchema;
  tenantId: string;
  onSuccess: (connectionId: string) => void;
  onCancel: () => void;
}

interface FormError {
  field?: string;
  message: string;
}

export function IntegrationCredentialForm({
  providerKey,
  providerName,
  authSchema,
  tenantId,
  onSuccess,
  onCancel,
}: IntegrationCredentialFormProps) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FormError[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fields = Object.entries(authSchema.properties || {});

  // Validate required fields
  const validateForm = (): boolean => {
    const newErrors: FormError[] = [];
    authSchema.required?.forEach(fieldName => {
      if (!credentials[fieldName]?.trim()) {
        newErrors.push({
          field: fieldName,
          message: `${authSchema.properties[fieldName]?.title || fieldName} is required`,
        });
      }
    });
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await supabase.functions.invoke('integration-test-connection', {
        body: {
          provider_key: providerKey,
          credentials,
          tenant_id: tenantId,
        },
      });

      if (response.error) {
        setTestResult({
          success: false,
          message: response.error.message || 'Test failed',
        });
        return;
      }

      const data = response.data;
      if (data.success) {
        setTestResult({
          success: true,
          message: data.message,
        });
        // Save on successful test
        handleSaveConnection(data);
      } else {
        setTestResult({
          success: false,
          message: data.message,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  // Save connection
  const handleSaveConnection = async (testData?: any) => {
    if (!validateForm()) return;

    setSaving(true);

    try {
      const response = await supabase.functions.invoke('integration-save-connection', {
        body: {
          tenant_id: tenantId,
          provider_id: providerKey, // In real implementation, use provider UUID
          credentials: {
            ...credentials,
            account_name: testData?.account_name || credentials.account_name,
          },
        },
      });

      if (response.error) {
        setErrors([{ message: response.error.message || 'Failed to save connection' }]);
        return;
      }

      const data = response.data;
      if (data.success) {
        onSuccess(data.connection_id);
      } else {
        setErrors([{ message: data.message }]);
      }
    } catch (err) {
      setErrors([{ message: err.message || 'Failed to save connection' }]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Connect {providerName}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Provide your credentials. They will be encrypted and stored securely.
        </p>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        {fields.map(([fieldName, fieldConfig]) => (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {fieldConfig.title || fieldName}
              {authSchema.required?.includes(fieldName) && (
                <span className="text-red-600 ml-1">*</span>
              )}
            </label>
            <input
              type={fieldName.toLowerCase().includes('secret') || fieldName.toLowerCase().includes('password') ? 'password' : 'text'}
              value={credentials[fieldName] || ''}
              onChange={(e) => {
                setCredentials(prev => ({ ...prev, [fieldName]: e.target.value }));
                // Clear error for this field
                setErrors(errors.filter(err => err.field !== fieldName));
              }}
              placeholder={`Enter ${fieldConfig.title || fieldName}`}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
            />
            {errors.find(e => e.field === fieldName) && (
              <p className="mt-1 text-sm text-red-600">
                {errors.find(e => e.field === fieldName)?.message}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* General errors */}
      {errors.some(e => !e.field) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex gap-2 items-start">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              {errors.map((err, i) => (
                !err.field && <p key={i} className="text-sm text-red-700 dark:text-red-400">{err.message}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={`p-3 border rounded-lg ${
          testResult.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex gap-2 items-start">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${testResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {testResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          disabled={testing || saving}
          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleTestConnection}
          disabled={testing || saving}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {testing && <Loader className="w-4 h-4 animate-spin" />}
          Test Connection
        </button>
        {testResult?.success && (
          <button
            onClick={() => handleSaveConnection()}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader className="w-4 h-4 animate-spin" />}
            Save
          </button>
        )}
      </div>

      {/* Help text */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-slate-600 dark:text-slate-400">
        <p>
          Your credentials are encrypted and stored securely. Only your organization can access them.
          Never shared between tenants.
        </p>
      </div>
    </div>
  );
}
