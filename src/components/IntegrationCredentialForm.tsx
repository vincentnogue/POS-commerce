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
        message: err instanceof Error ? err.message : 'Connection test failed',
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
      setErrors([{ message: err instanceof Error ? err.message : 'Failed to save connection' }]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-ink-900 dark:text-white">
          Connect {providerName}
        </h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
          Provide your credentials. They will be encrypted and stored securely.
        </p>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        {fields.map(([fieldName, fieldConfig]) => (
          <div key={fieldName}>
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1.5">
              {fieldConfig.title || fieldName}
              {authSchema.required?.includes(fieldName) && (
                <span className="text-error-500 ml-1">*</span>
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
              className="input"
            />
            {errors.find(e => e.field === fieldName) && (
              <p className="mt-1 text-sm text-error-600">
                {errors.find(e => e.field === fieldName)?.message}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* General errors */}
      {errors.some(e => !e.field) && (
        <div className="p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
          <div className="flex gap-2 items-start">
            <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
            <div>
              {errors.map((err, i) => (
                !err.field && <p key={i} className="text-sm text-error-700 dark:text-error-400">{err.message}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={`p-3 border rounded-lg ${
          testResult.success
            ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800'
            : 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800'
        }`}>
          <div className="flex gap-2 items-start">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${testResult.success ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'}`}>
              {testResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Actions — same tokens as every other form in the app: btn-ghost
          for Cancel, btn-primary (brand action color) for the primary
          step, success color reserved for the confirming Save once the
          test has actually passed. Previously these were raw
          bg-blue-600/bg-green-600, the one visibly different button
          style in the whole connection flow. */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          disabled={testing || saving}
          className="btn-ghost flex-1"
        >
          Cancel
        </button>
        <button
          onClick={handleTestConnection}
          disabled={testing || saving}
          className="btn-primary flex-1"
        >
          {testing && <Loader className="w-4 h-4 animate-spin" />}
          Test Connection
        </button>
        {testResult?.success && (
          <button
            onClick={() => handleSaveConnection()}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-success-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-all hover:bg-success-700 hover:shadow-float active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving && <Loader className="w-4 h-4 animate-spin" />}
            Save
          </button>
        )}
      </div>

      {/* Help text */}
      <div className="p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg text-sm text-ink-600 dark:text-ink-400">
        <p>
          Your credentials are encrypted and stored securely. Only your organization can access them.
          Never shared between tenants.
        </p>
      </div>
    </div>
  );
}
