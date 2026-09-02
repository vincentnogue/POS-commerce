import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Building2, Globe, Shield, CreditCard, Bell, Palette, Upload, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { CURRENCIES, getCountry } from '../../lib/localization';
import { PageHeader, Badge, Modal, useToast } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { Plan, TenantCurrency } from '../../lib/types';

type Tab = 'company' | 'localization' | 'security' | 'billing' | 'notifications' | 'appearance';

const NOTIF_KEYS = ['sales', 'low_stock', 'unpaid_invoices', 'deliveries', 'weekly_summary'] as const;
const NOTIF_LABELS: Record<string, string> = {
  sales: 'settings.notif.sales',
  low_stock: 'settings.notif.low_stock',
  unpaid_invoices: 'settings.notif.unpaid_invoices',
  deliveries: 'settings.notif.deliveries',
  weekly_summary: 'settings.notif.weekly_summary',
};

type NotifPrefs = Record<string, boolean>;

export function SettingsPage() {
  const { tenant, member, refreshProfile, subscription } = useAuth();
  const { t, formatDate } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('company');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [planInfo, setPlanInfo] = useState<Plan | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(Object.fromEntries(NOTIF_KEYS.map((k) => [k, true])));
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ next: '' });
  const [pwdError, setPwdError] = useState<string | null>(null);
  // Accepted foreign currencies (see migration 0074) — the tenant's own
  // currency stays fixed (see the "locked" block above), this is only
  // about additional currencies a cashier can collect payment in.
  const [tenantCurrencies, setTenantCurrencies] = useState<TenantCurrency[]>([]);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [currencyForm, setCurrencyForm] = useState({ currency_code: '', rate_to_tenant_currency: '' });
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencyErr, setCurrencyErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: tenant?.name ?? '',
    business_type: tenant?.business_type ?? '',
    region: tenant?.region ?? '',
    city: tenant?.city ?? '',
  });
  const [maxXReports, setMaxXReports] = useState(String(tenant?.max_x_reports_per_day ?? 0));
  const [xReportSaving, setXReportSaving] = useState(false);
  // D365-style checkout discount config (see migration 0067): which
  // discount mechanism(s) are enabled and the rules for each.
  const [discountForm, setDiscountForm] = useState({
    discount_mode: tenant?.discount_mode ?? 'manual_approval',
    threshold: String(tenant?.manual_discount_requires_approval_above ?? 0),
    earnRate: String(tenant?.loyalty_points_per_currency ?? 1),
    pointValue: String(tenant?.loyalty_point_value ?? 0.01),
  });
  const [discountSaving, setDiscountSaving] = useState(false);
  const [contactForm, setContactForm] = useState({
    phone: '',
    address: '',
    email: '',
  });

  const tabs: { id: Tab; labelKey: string; icon: typeof SettingsIcon }[] = [
    { id: 'company', labelKey: 'settings.tab.company', icon: Building2 },
    { id: 'localization', labelKey: 'settings.tab.localization', icon: Globe },
    { id: 'security', labelKey: 'settings.tab.security', icon: Shield },
    { id: 'billing', labelKey: 'settings.tab.billing', icon: CreditCard },
    { id: 'notifications', labelKey: 'settings.tab.notifications', icon: Bell },
    { id: 'appearance', labelKey: 'settings.tab.appearance', icon: Palette },
  ];

  const saveCompany = async () => {
    if (!tenant) return;
    const { error } = await supabase.from('tenants').update({
      name: form.name,
      business_type: form.business_type || null,
      region: form.region || null,
      city: form.city || null,
    }).eq('id', tenant.id);
    if (error) { toast('error', error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await refreshProfile();
  };

  const saveXReportLimit = async () => {
    if (!tenant) return;
    const n = Number(maxXReports);
    if (!Number.isInteger(n) || n < 0) { toast('error', t('settings.security.xReportLimitInvalid')); return; }
    setXReportSaving(true);
    const { error } = await supabase.from('tenants').update({ max_x_reports_per_day: n }).eq('id', tenant.id);
    setXReportSaving(false);
    if (error) { toast('error', error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await refreshProfile();
  };

  const saveDiscountSettings = async () => {
    if (!tenant) return;
    const threshold = Number(discountForm.threshold);
    const earnRate = Number(discountForm.earnRate);
    const pointValue = Number(discountForm.pointValue);
    if (Number.isNaN(threshold) || threshold < 0 || Number.isNaN(earnRate) || earnRate < 0 || Number.isNaN(pointValue) || pointValue < 0) {
      toast('error', t('settings.security.xReportLimitInvalid'));
      return;
    }
    setDiscountSaving(true);
    const { error } = await supabase.from('tenants').update({
      discount_mode: discountForm.discount_mode,
      manual_discount_requires_approval_above: threshold,
      loyalty_points_per_currency: earnRate,
      loyalty_point_value: pointValue,
    }).eq('id', tenant.id);
    setDiscountSaving(false);
    if (error) { toast('error', error.message); return; }
    toast('success', t('settings.security.discountSaved'));
    await refreshProfile();
  };

  const saveContact = async () => {
    if (!tenant) return;
    // Save contact info to brand_settings (used on invoices/quotes)
    const { data: existing } = await supabase.from('brand_settings').select('id').eq('tenant_id', tenant.id).maybeSingle();
    const { error } = existing
      ? await supabase.from('brand_settings').update({
          phone: contactForm.phone || null,
          address: contactForm.address || null,
          email: contactForm.email || null,
        }).eq('tenant_id', tenant.id)
      : await supabase.from('brand_settings').insert({
          tenant_id: tenant.id,
          phone: contactForm.phone || null,
          address: contactForm.address || null,
          email: contactForm.email || null,
        });
    if (error) { toast('error', error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const loadBranding = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('brand_settings').select('*').eq('tenant_id', tenant.id).maybeSingle();
    if (data) {
      setLogoUrl(data.logo_url ?? null);
      setStampUrl(data.stamp_url ?? null);
      setContactForm({ phone: data.phone ?? '', address: data.address ?? '', email: data.email ?? '' });
    }
  };

  useState(() => { loadBranding(); });

  const uploadAsset = async (file: File, type: 'logo' | 'stamp') => {
    if (!tenant) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${tenant.id}/${type}.${ext}`;
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true });
    if (error) { toast('error', error.message); setUploading(false); return; }
    const url = supabase.storage.from('brand-assets').getPublicUrl(path).data.publicUrl;
    const { data: existing } = await supabase.from('brand_settings').select('id').eq('tenant_id', tenant.id).maybeSingle();
    const { error: saveErr } = existing
      ? await supabase.from('brand_settings').update({ [type === 'logo' ? 'logo_url' : 'stamp_url']: url }).eq('tenant_id', tenant.id)
      : await supabase.from('brand_settings').insert({ tenant_id: tenant.id, [type === 'logo' ? 'logo_url' : 'stamp_url']: url });
    if (saveErr) { toast('error', saveErr.message); setUploading(false); return; }
    if (type === 'logo') setLogoUrl(url); else setStampUrl(url);
    setUploading(false);
    toast('success', type === 'logo' ? t('settings.toast.logoUpdated') : t('settings.toast.stampUpdated'));
  };

  useEffect(() => {
    if (!tenant) return;
    setDiscountForm({
      discount_mode: tenant.discount_mode ?? 'manual_approval',
      threshold: String(tenant.manual_discount_requires_approval_above ?? 0),
      earnRate: String(tenant.loyalty_points_per_currency ?? 1),
      pointValue: String(tenant.loyalty_point_value ?? 0.01),
    });
  }, [tenant]);

  useEffect(() => {
    if (!tenant?.plan_id) return;
    supabase.from('plans').select('*').eq('id', tenant.plan_id).maybeSingle().then(({ data }) => setPlanInfo(data as Plan | null));
  }, [tenant?.plan_id]);

  useEffect(() => {
    if (!tenant) return;
    supabase.from('notification_prefs').select('*').eq('tenant_id', tenant.id).maybeSingle().then(({ data }) => {
      if (data) setNotifPrefs({ ...Object.fromEntries(NOTIF_KEYS.map((k) => [k, true])), ...data.prefs });
    });
  }, [tenant]);

  const loadCurrencies = () => {
    if (!tenant) return;
    supabase.from('tenant_currencies').select('*').eq('tenant_id', tenant.id).order('currency_code')
      .then(({ data }) => setTenantCurrencies((data as TenantCurrency[]) ?? []));
  };
  useEffect(loadCurrencies, [tenant]);

  const openNewCurrency = () => { setCurrencyForm({ currency_code: '', rate_to_tenant_currency: '' }); setCurrencyErr(null); setCurrencyModalOpen(true); };

  const saveCurrency = async () => {
    if (!tenant) return;
    const code = currencyForm.currency_code.trim().toUpperCase();
    const rate = Number(currencyForm.rate_to_tenant_currency);
    if (!code || code.length !== 3) { setCurrencyErr(t('settings.currencies.err.codeInvalid')); return; }
    if (!rate || rate <= 0) { setCurrencyErr(t('settings.currencies.err.rateInvalid')); return; }
    setCurrencySaving(true);
    setCurrencyErr(null);
    const { error } = await supabase.from('tenant_currencies').upsert(
      { tenant_id: tenant.id, currency_code: code, rate_to_tenant_currency: rate, is_active: true, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,currency_code' }
    );
    setCurrencySaving(false);
    if (error) { setCurrencyErr(error.message); return; }
    setCurrencyModalOpen(false);
    loadCurrencies();
  };

  const toggleCurrencyActive = async (c: TenantCurrency) => {
    await supabase.from('tenant_currencies').update({ is_active: !c.is_active, updated_at: new Date().toISOString() }).eq('id', c.id);
    loadCurrencies();
  };

  const removeCurrency = async (c: TenantCurrency) => {
    if (!window.confirm(t('settings.currencies.confirmDelete'))) return;
    await supabase.from('tenant_currencies').delete().eq('id', c.id);
    loadCurrencies();
  };

  const saveNotifs = async () => {
    if (!tenant) return;
    const { data: existing } = await supabase.from('notification_prefs').select('id').eq('tenant_id', tenant.id).maybeSingle();
    const { error } = existing
      ? await supabase.from('notification_prefs').update({ prefs: notifPrefs }).eq('tenant_id', tenant.id)
      : await supabase.from('notification_prefs').insert({ tenant_id: tenant.id, prefs: notifPrefs });
    if (error) { toast('error', error.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const changePassword = async () => {
    setPwdError(null);
    if (pwdForm.next.length < 6) { setPwdError(t('settings.err.passwordMinLength')); return; }
    const { error } = await supabase.auth.updateUser({ password: pwdForm.next });
    if (error) { setPwdError(error.message); return; }
    setShowPwdModal(false); setPwdForm({ next: '' });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const country = tenant ? getCountry(tenant.country_code) : undefined;
  const currencyInfo = tenant ? CURRENCIES[tenant.currency] : undefined;

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                tab === tabItem.id ? 'bg-white dark:bg-ink-800 text-brand-700 shadow-soft' : 'text-ink-600 dark:text-ink-300 hover:bg-white/60 dark:bg-ink-800/60'
              }`}
            >
              <tabItem.icon size={16} /> {t(tabItem.labelKey)}
            </button>
          ))}
        </div>

        <div className="card p-6">
          {tab === 'company' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('settings.company.info')}</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label={t('settings.company.businessName')}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
                  <Field label={t('settings.company.businessType')}><input value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} className="input" /></Field>
                  <Field label={t('settings.company.region')}><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="input" /></Field>
                  <Field label={t('settings.company.city')}><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></Field>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={saveCompany} className="btn-primary">{t('common.save')}</button>
                  {saved && <span className="text-sm font-medium text-success-700">✓ {t('settings.saved')}</span>}
                </div>
              </div>

              <div className="border-t border-ink-100 dark:border-ink-800 pt-5">
                <h4 className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('settings.billingContact.title')}</h4>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{t('settings.billingContact.desc')}</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label={t('settings.billingContact.phone')}><input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="input" placeholder="+237 …" /></Field>
                  <Field label={t('settings.billingContact.email')}><input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="input" placeholder="contact@…" /></Field>
                  <div className="sm:col-span-2"><Field label={t('settings.billingContact.address')}><input value={contactForm.address} onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })} className="input" /></Field></div>
                </div>
                <button onClick={saveContact} className="btn-primary mt-4">{t('settings.billingContact.save')}</button>
              </div>

              <div className="border-t border-ink-100 dark:border-ink-800 pt-5">
                <h4 className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('settings.assets.title')}</h4>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{t('settings.assets.desc')}</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="label mb-1">{t('settings.assets.logo')}</p>
                    <div className="flex items-center gap-3">
                      {logoUrl ? <img src={logoUrl} alt={t('settings.assets.logo')} className="h-12 w-12 rounded-lg border border-ink-200 dark:border-ink-700 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-ink-200 dark:border-ink-700 text-ink-300"><ImageIcon size={18} /></div>}
                      <label className="btn-ghost cursor-pointer text-xs">
                        <Upload size={13} /> {t('settings.assets.change')}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, 'logo'); }} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="label mb-1">{t('settings.assets.stamp')}</p>
                    <div className="flex items-center gap-3">
                      {stampUrl ? <img src={stampUrl} alt={t('settings.assets.stamp')} className="h-12 w-12 rounded-lg border border-ink-200 dark:border-ink-700 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-ink-200 dark:border-ink-700 text-ink-300"><ImageIcon size={18} /></div>}
                      <label className="btn-ghost cursor-pointer text-xs">
                        <Upload size={13} /> {t('settings.assets.change')}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, 'stamp'); }} />
                      </label>
                    </div>
                  </div>
                </div>
                {uploading && <p className="mt-2 text-xs text-brand-600">{t('settings.assets.uploading')}</p>}
              </div>
            </div>
          )}

          {tab === 'localization' && (
            <div>
              <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('settings.localization.title')}</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('settings.localization.country')}</p>
                  <p className="mt-1 font-medium text-ink-900 dark:text-ink-50">{country?.name ?? tenant?.country_name}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">{t('settings.localization.dialCode')}: {country?.dialCode}</p>
                </div>
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('settings.localization.currency')}</p>
                      <p className="mt-1 font-medium text-ink-900 dark:text-ink-50">{tenant?.currency} · {currencyInfo?.label}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400">{t('settings.localization.symbol')}: {currencyInfo?.symbol}</p>
                    </div>
                    <Badge tone="warning">{t('settings.localization.locked')}</Badge>
                  </div>
                  <div className="mt-3 rounded-lg bg-brand-50 dark:bg-brand-900/25 p-3 text-xs text-ink-600 dark:text-ink-300">
                    <p className="font-medium text-ink-700 dark:text-ink-200">{t('settings.localization.whyLocked')}</p>
                    <p className="mt-1">{t('settings.localization.lockedExplanation')}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-ink-900 dark:text-ink-50">{t('settings.currencies.title')}</p>
                      <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('settings.currencies.subtitle')}</p>
                    </div>
                    <button onClick={openNewCurrency} className="btn-ghost text-sm"><Plus size={14} /> {t('settings.currencies.add')}</button>
                  </div>
                  {tenantCurrencies.filter((c) => c.currency_code !== tenant?.currency).length === 0 ? (
                    <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">{t('settings.currencies.empty')}</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {tenantCurrencies.filter((c) => c.currency_code !== tenant?.currency).map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-ink-900 dark:text-ink-50">{c.currency_code}</span>
                            <span className="ml-2 text-ink-500 dark:text-ink-400">1 {c.currency_code} = {c.rate_to_tenant_currency} {tenant?.currency}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => toggleCurrencyActive(c)} className={`text-xs font-semibold ${c.is_active ? 'text-success-700' : 'text-ink-400'}`}>
                              {c.is_active ? t('promotions.status.active') : t('promotions.status.inactive')}
                            </button>
                            <button onClick={() => removeCurrency(c)} className="text-ink-400 hover:text-error-600"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">{t('settings.currencies.note')}</p>
                </div>
                {country && country.mobileMoney.length > 0 && (
                  <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                    <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('settings.localization.mobileMoneyAvailable')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {country.mobileMoney.map((m) => <span key={m} className="rounded-full bg-brand-50 dark:bg-brand-900/25 px-3 py-1 text-xs font-medium text-brand-700">{m}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div>
              <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('settings.security.title')}</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="font-medium text-ink-900 dark:text-ink-50">{t('settings.security.password')}</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('settings.security.passwordDesc')}</p>
                  <button onClick={() => setShowPwdModal(true)} className="btn-ghost mt-3">{t('settings.security.changePassword')}</button>
                </div>
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="font-medium text-ink-900 dark:text-ink-50">{t('settings.security.activeSessions')}</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('settings.security.activeSessionsDesc')}</p>
                  <button onClick={async () => { await supabase.auth.signOut({ scope: 'others' }); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="btn-ghost mt-3">{t('settings.security.signOutOthers')}</button>
                </div>
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="font-medium text-ink-900 dark:text-ink-50">{t('settings.security.xReportLimit')}</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('settings.security.xReportLimitDesc')}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={maxXReports}
                      onChange={(e) => setMaxXReports(e.target.value)}
                      className="input w-28"
                    />
                    <span className="text-sm text-ink-500 dark:text-ink-400">{t('settings.security.xReportLimitUnit')}</span>
                    <button onClick={saveXReportLimit} disabled={xReportSaving} className="btn-ghost">{t('common.save')}</button>
                  </div>
                  <p className="mt-2 text-xs text-ink-400">{t('settings.security.xReportLimitZero')}</p>
                </div>
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="font-medium text-ink-900 dark:text-ink-50">{t('settings.security.discountTitle')}</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('settings.security.discountDesc')}</p>

                  <div className="mt-3">
                    <label className="label">{t('settings.security.discountMode')}</label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {(['manual_approval', 'loyalty_points', 'both'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setDiscountForm((f) => ({ ...f, discount_mode: mode }))}
                          className={`rounded-xl border p-3 text-left text-sm font-medium transition ${
                            discountForm.discount_mode === mode
                              ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/25 text-brand-700'
                              : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-brand-200'
                          }`}
                        >
                          {t(`settings.security.discountMode.${mode}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(discountForm.discount_mode === 'manual_approval' || discountForm.discount_mode === 'both') && (
                    <div className="mt-4">
                      <Field label={t('settings.security.discountThreshold')} hint={t('settings.security.discountThresholdDesc')}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={discountForm.threshold}
                          onChange={(e) => setDiscountForm((f) => ({ ...f, threshold: e.target.value }))}
                          className="input"
                        />
                      </Field>
                    </div>
                  )}

                  {(discountForm.discount_mode === 'loyalty_points' || discountForm.discount_mode === 'both') && (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={t('settings.security.loyaltyEarnRate')} hint={t('settings.security.loyaltyEarnRateDesc')}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={discountForm.earnRate}
                          onChange={(e) => setDiscountForm((f) => ({ ...f, earnRate: e.target.value }))}
                          className="input"
                        />
                      </Field>
                      <Field label={t('settings.security.loyaltyPointValue')} hint={t('settings.security.loyaltyPointValueDesc')}>
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          value={discountForm.pointValue}
                          onChange={(e) => setDiscountForm((f) => ({ ...f, pointValue: e.target.value }))}
                          className="input"
                        />
                      </Field>
                    </div>
                  )}

                  <button onClick={saveDiscountSettings} disabled={discountSaving} className="btn-primary mt-4">{t('common.save')}</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'billing' && (
            <div>
              <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('settings.billing.title')}</h3>
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 dark:bg-brand-900/25 p-4">
                <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('settings.billing.currentPlan')}</p>
                <p className="mt-1 text-lg font-medium text-ink-900 dark:text-ink-50">{planInfo?.name ?? t('settings.billing.noPlan')}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink-600 dark:text-ink-300">
                  {planInfo && <span>{t('settings.billing.price')}: <strong>${planInfo.price_usd}/{t('settings.billing.month')}</strong></span>}
                  {planInfo && <span>{t('settings.billing.users')}: <strong>{planInfo.max_users}</strong></span>}
                  {planInfo && <span>{t('settings.billing.stores')}: <strong>{planInfo.max_stores}</strong></span>}
                </div>
                <button onClick={() => navigate('/subscribe')} className="btn-primary mt-4">{t('settings.billing.changePlan')}</button>
              </div>
              {subscription && (
                <div className="mt-3 rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('settings.billing.subscriptionStatus')}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={subscription.status === 'active' ? 'success' : subscription.status === 'trialing' ? 'warning' : 'error'}>{subscription.status}</Badge>
                    {subscription.current_period_end && <span className="text-sm text-ink-500 dark:text-ink-400">{t('settings.billing.until')} {formatDate(subscription.current_period_end)}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <div>
              <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('settings.notifications.title')}</h3>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('settings.notifications.desc')}</p>
              <div className="mt-4 space-y-3">
                {NOTIF_KEYS.map((key) => (
                  <label key={key} className="flex items-center justify-between rounded-xl border border-ink-200 dark:border-ink-700 p-3">
                    <span className="text-sm text-ink-700 dark:text-ink-200">{t(NOTIF_LABELS[key])}</span>
                    <input type="checkbox" checked={notifPrefs[key]} onChange={(e) => setNotifPrefs({ ...notifPrefs, [key]: e.target.checked })} className="h-4 w-4 accent-brand-500" />
                  </label>
                ))}
              </div>
              <button onClick={saveNotifs} className="btn-primary mt-4">{t('settings.notifications.save')}</button>
              {saved && <span className="ml-3 text-sm font-medium text-success-700">✓ {t('settings.saved')}</span>}
            </div>
          )}

          {tab === 'appearance' && (
            <div>
              <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('settings.appearance.title')}</h3>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{t('settings.appearance.desc')}</p>
              <div className="mt-4 flex items-center gap-3">
                <Badge tone="brand">{member?.role}</Badge>
                <p className="text-xs text-ink-500 dark:text-ink-400">{t('settings.appearance.roleDesc')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={showPwdModal} onClose={() => setShowPwdModal(false)} title={t('settings.security.changePassword')}>
        <div className="space-y-4">
          <Field label={t('settings.security.newPassword')}><input type="password" value={pwdForm.next} onChange={(e) => setPwdForm({ ...pwdForm, next: e.target.value })} className="input" placeholder={t('settings.security.passwordPlaceholder')} /></Field>
          {pwdError && <p className="text-sm text-error-600">{pwdError}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setShowPwdModal(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={changePassword} className="btn-primary">{t('common.save')}</button>
        </div>
      </Modal>

      <Modal open={currencyModalOpen} onClose={() => setCurrencyModalOpen(false)} title={t('settings.currencies.add')}>
        <div className="space-y-4">
          <Field label={t('settings.currencies.codeLabel')} hint={t('settings.currencies.codeHint')}>
            <input
              value={currencyForm.currency_code}
              onChange={(e) => setCurrencyForm((f) => ({ ...f, currency_code: e.target.value.toUpperCase().slice(0, 3) }))}
              className="input"
              placeholder="USD"
              maxLength={3}
            />
          </Field>
          <Field label={t('settings.currencies.rateLabel')} hint={t('settings.currencies.rateHint', { home: tenant?.currency ?? '' })}>
            <input
              type="number"
              min={0}
              step="0.0001"
              value={currencyForm.rate_to_tenant_currency}
              onChange={(e) => setCurrencyForm((f) => ({ ...f, rate_to_tenant_currency: e.target.value }))}
              className="input"
            />
          </Field>
          {currencyErr && <p className="text-sm text-error-600">{currencyErr}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setCurrencyModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={saveCurrency} disabled={currencySaving} className="btn-primary disabled:opacity-50">{t('common.save')}</button>
        </div>
      </Modal>
    </div>
  );
}
