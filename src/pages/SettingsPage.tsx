import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  Settings, Globe, DollarSign, MapPin, Bell, Lock, LogOut,
  Save, Loader2, CheckCircle, AlertCircle,
} from 'lucide-react';
import { PageHeader, Spinner, Badge } from '../components/ui';

interface TenantSettings {
  id: string;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  language: string;
  notification_email: string;
}

const COUNTRIES = [
  { code: 'AE', name: 'United Arab Emirates', timezone: 'Asia/Dubai', currency: 'AED' },
  { code: 'US', name: 'United States', timezone: 'America/New_York', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', timezone: 'Europe/London', currency: 'GBP' },
  { code: 'FR', name: 'France', timezone: 'Europe/Paris', currency: 'EUR' },
  { code: 'DE', name: 'Germany', timezone: 'Europe/Berlin', currency: 'EUR' },
  { code: 'SG', name: 'Singapore', timezone: 'Asia/Singapore', currency: 'SGD' },
  { code: 'HK', name: 'Hong Kong', timezone: 'Asia/Hong_Kong', currency: 'HKD' },
  { code: 'JP', name: 'Japan', timezone: 'Asia/Tokyo', currency: 'JPY' },
  { code: 'CN', name: 'China', timezone: 'Asia/Shanghai', currency: 'CNY' },
  { code: 'IN', name: 'India', timezone: 'Asia/Kolkata', currency: 'INR' },
  { code: 'NG', name: 'Nigeria', timezone: 'Africa/Lagos', currency: 'NGN' },
  { code: 'KE', name: 'Kenya', timezone: 'Africa/Nairobi', currency: 'KES' },
  { code: 'ZA', name: 'South Africa', timezone: 'Africa/Johannesburg', currency: 'ZAR' },
  { code: 'EG', name: 'Egypt', timezone: 'Africa/Cairo', currency: 'EGP' },
  { code: 'CA', name: 'Canada', timezone: 'America/Toronto', currency: 'CAD' },
  { code: 'AU', name: 'Australia', timezone: 'Australia/Sydney', currency: 'AUD' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ar', name: 'العربية' },
  { code: 'zh', name: '中文' },
];

type Tab = 'general' | 'billing' | 'security' | 'notifications';

export function SettingsPage() {
  const { tenant, user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant?.id)
        .single();

      if (error) throw error;

      setSettings(data as TenantSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveSettings() {
    if (!settings) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('tenants')
        .update({
          name: settings.name,
          country: settings.country,
          timezone: settings.timezone,
          currency: settings.currency,
          language: settings.language,
          notification_email: settings.notification_email,
        })
        .eq('id', settings.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  const handleCountryChange = (countryCode: string) => {
    if (!settings) return;

    const country = COUNTRIES.find((c) => c.code === countryCode);
    if (country) {
      setSettings({
        ...settings,
        country: countryCode,
        timezone: country.timezone,
        currency: country.currency,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900">
        <PageHeader
          icon={Settings}
          title="Settings"
          subtitle="Manage your account and workspace settings"
        />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-6 text-red-300">
            Failed to load settings. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900">
      {/* Header */}
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Manage your account and workspace settings"
      />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Message */}
        {message && (
          <div
            className={`mb-6 rounded-lg border p-4 flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-ink-800/50">
          {[
            { id: 'general', label: 'General', icon: Globe },
            { id: 'billing', label: 'Billing', icon: DollarSign },
            { id: 'security', label: 'Security', icon: Lock },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`px-6 py-4 font-medium flex items-center gap-2 border-b-2 transition ${
                tab === id
                  ? 'border-flow-500 text-white'
                  : 'border-transparent text-ink-400 hover:text-ink-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {tab === 'general' && (
          <div className="space-y-8">
            {/* Workspace Name */}
            <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Workspace Name</h3>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-ink-800/50 border border-ink-700 text-white focus:border-flow-500 focus:outline-none transition"
              />
              <p className="text-sm text-ink-400 mt-2">
                This is your workspace name visible to team members
              </p>
            </div>

            {/* Country & Timezone */}
            <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-flow-400" />
                Location & Timezone
              </h3>

              <div className="space-y-4">
                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">
                    Country
                  </label>
                  <select
                    value={settings.country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-ink-800/50 border border-ink-700 text-white focus:border-flow-500 focus:outline-none transition cursor-pointer"
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Timezone (Read-only, auto-set by country) */}
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2">
                    Timezone
                  </label>
                  <input
                    type="text"
                    value={settings.timezone}
                    disabled
                    className="w-full px-4 py-2 rounded-lg bg-ink-800/30 border border-ink-700 text-ink-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-ink-400 mt-2">
                    Automatically set based on your country
                  </p>
                </div>

                {/* Currency (Read-only, auto-set by country) */}
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-brand-400" />
                    Currency
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={settings.currency}
                      disabled
                      className="flex-1 px-4 py-2 rounded-lg bg-ink-800/30 border border-ink-700 text-ink-400 cursor-not-allowed"
                    />
                    <Badge tone="brand">{settings.currency}</Badge>
                  </div>
                  <p className="text-xs text-ink-400 mt-2">
                    Platform base currency. All prices in USD, auto-converted to {settings.currency}
                  </p>
                </div>
              </div>
            </div>

            {/* Language */}
            <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Language</h3>
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-ink-800/50 border border-ink-700 text-white focus:border-flow-500 focus:outline-none transition cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Save Button */}
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-flow-500 text-white font-semibold hover:bg-flow-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        )}

        {/* Billing Tab */}
        {tab === 'billing' && (
          <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Billing Information</h3>
            <p className="text-ink-300 mb-6">
              Manage your billing details and payment methods
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Notification Email
                </label>
                <input
                  type="email"
                  value={settings.notification_email}
                  onChange={(e) =>
                    setSettings({ ...settings, notification_email: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-ink-800/50 border border-ink-700 text-white focus:border-flow-500 focus:outline-none transition"
                />
                <p className="text-xs text-ink-400 mt-2">
                  We'll send invoice and payment notifications to this email
                </p>
              </div>
              <button
                onClick={saveSettings}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-flow-500 text-white font-semibold hover:bg-flow-600 transition"
              >
                <Save className="w-5 h-5" />
                Save Email
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {tab === 'security' && (
          <div className="space-y-6">
            <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-brand-400" />
                Account Security
              </h3>

              <div className="space-y-6">
                <div>
                  <p className="text-sm text-ink-300 mb-4">
                    Current User: <span className="font-semibold text-white">{user?.email}</span>
                  </p>
                  <button className="px-6 py-2 rounded-full bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 transition font-medium">
                    Change Password
                  </button>
                </div>

                <div className="border-t border-ink-700 pt-6">
                  <h4 className="text-sm font-semibold text-white mb-4">Two-Factor Authentication</h4>
                  <p className="text-sm text-ink-400 mb-4">
                    Add an extra layer of security to your account
                  </p>
                  <button className="px-6 py-2 rounded-full bg-flow-500/20 text-flow-300 hover:bg-flow-500/30 transition font-medium">
                    Enable 2FA
                  </button>
                </div>

                <div className="border-t border-ink-700 pt-6">
                  <h4 className="text-sm font-semibold text-white mb-4">Danger Zone</h4>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-6 py-2 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 transition font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {tab === 'notifications' && (
          <div className="rounded-lg bg-ink-900/50 border border-ink-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5 text-flow-400" />
              Notification Preferences
            </h3>

            <div className="space-y-4">
              {[
                { id: 'payment', label: 'Payment Notifications', description: 'Get notified about payments' },
                { id: 'invoice', label: 'Invoice Notifications', description: 'Receive invoices via email' },
                { id: 'team', label: 'Team Updates', description: 'Updates about team activity' },
                { id: 'security', label: 'Security Alerts', description: 'Important security notifications' },
              ].map((notification) => (
                <label
                  key={notification.id}
                  className="flex items-start gap-3 p-4 rounded-lg bg-ink-800/50 border border-ink-700 hover:border-flow-500/30 transition cursor-pointer"
                >
                  <input type="checkbox" defaultChecked className="mt-1" />
                  <div>
                    <p className="font-medium text-white">{notification.label}</p>
                    <p className="text-xs text-ink-400">{notification.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={saveSettings}
              className="mt-6 flex items-center gap-2 px-6 py-3 rounded-full bg-flow-500 text-white font-semibold hover:bg-flow-600 transition"
            >
              <Save className="w-5 h-5" />
              Save Preferences
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
