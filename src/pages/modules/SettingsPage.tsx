import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Building2, Globe, Shield, CreditCard, Bell, Palette, Upload, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { CURRENCIES, getCountry } from '../../lib/localization';
import { PageHeader, Badge, Modal } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { Plan } from '../../lib/types';

type Tab = 'company' | 'localization' | 'security' | 'billing' | 'notifications' | 'appearance';

const NOTIF_KEYS = ['sales', 'low_stock', 'unpaid_invoices', 'deliveries', 'weekly_summary'] as const;
const NOTIF_LABELS: Record<string, string> = {
  sales: 'Ventes enregistrées',
  low_stock: 'Stock bas',
  unpaid_invoices: 'Factures impayées',
  deliveries: 'Livraisons planifiées',
  weekly_summary: 'Résumé hebdomadaire',
};

type NotifPrefs = Record<string, boolean>;

export function SettingsPage() {
  const { tenant, member, refreshProfile, subscription } = useAuth();
  const navigate = useNavigate();
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
  const [form, setForm] = useState({
    name: tenant?.name ?? '',
    business_type: tenant?.business_type ?? '',
    region: tenant?.region ?? '',
    city: tenant?.city ?? '',
  });
  const [contactForm, setContactForm] = useState({
    phone: '',
    address: '',
    email: '',
  });

  const tabs: { id: Tab; label: string; icon: typeof SettingsIcon }[] = [
    { id: 'company', label: 'Entreprise', icon: Building2 },
    { id: 'localization', label: 'Localisation', icon: Globe },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'billing', label: 'Facturation', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Apparence', icon: Palette },
  ];

  const saveCompany = async () => {
    if (!tenant) return;
    await supabase.from('tenants').update({
      name: form.name,
      business_type: form.business_type || null,
      region: form.region || null,
      city: form.city || null,
    }).eq('id', tenant.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await refreshProfile();
  };

  const saveContact = async () => {
    if (!tenant) return;
    // Save contact info to brand_settings (used on invoices/quotes)
    const { data: existing } = await supabase.from('brand_settings').select('id').eq('tenant_id', tenant.id).maybeSingle();
    if (existing) {
      await supabase.from('brand_settings').update({
        phone: contactForm.phone || null,
        address: contactForm.address || null,
        email: contactForm.email || null,
      }).eq('tenant_id', tenant.id);
    } else {
      await supabase.from('brand_settings').insert({
        tenant_id: tenant.id,
        phone: contactForm.phone || null,
        address: contactForm.address || null,
        email: contactForm.email || null,
      });
    }
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
    if (error) { alert('Erreur: ' + error.message); setUploading(false); return; }
    const url = supabase.storage.from('brand-assets').getPublicUrl(path).data.publicUrl;
    const { data: existing } = await supabase.from('brand_settings').select('id').eq('tenant_id', tenant.id).maybeSingle();
    if (existing) {
      await supabase.from('brand_settings').update({ [type === 'logo' ? 'logo_url' : 'stamp_url']: url }).eq('tenant_id', tenant.id);
    } else {
      await supabase.from('brand_settings').insert({ tenant_id: tenant.id, [type === 'logo' ? 'logo_url' : 'stamp_url']: url });
    }
    if (type === 'logo') setLogoUrl(url); else setStampUrl(url);
    setUploading(false);
  };

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

  const saveNotifs = async () => {
    if (!tenant) return;
    const { data: existing } = await supabase.from('notification_prefs').select('id').eq('tenant_id', tenant.id).maybeSingle();
    if (existing) {
      await supabase.from('notification_prefs').update({ prefs: notifPrefs }).eq('tenant_id', tenant.id);
    } else {
      await supabase.from('notification_prefs').insert({ tenant_id: tenant.id, prefs: notifPrefs });
    }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const changePassword = async () => {
    setPwdError(null);
    if (pwdForm.next.length < 6) { setPwdError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    const { error } = await supabase.auth.updateUser({ password: pwdForm.next });
    if (error) { setPwdError(error.message); return; }
    setShowPwdModal(false); setPwdForm({ next: '' });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const country = tenant ? getCountry(tenant.country_code) : undefined;
  const currencyInfo = tenant ? CURRENCIES[tenant.currency] : undefined;

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configurez votre commerce et votre compte." />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id ? 'bg-white dark:bg-ink-800 text-brand-700 shadow-soft' : 'text-ink-600 dark:text-ink-300 hover:bg-white/60 dark:bg-ink-800/60'
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        <div className="card p-6">
          {tab === 'company' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">Informations entreprise</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Nom du commerce"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
                  <Field label="Type de commerce"><input value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} className="input" /></Field>
                  <Field label="Région"><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="input" /></Field>
                  <Field label="Ville"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></Field>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={saveCompany} className="btn-primary">Enregistrer</button>
                  {saved && <span className="text-sm font-semibold text-success-700">✓ Enregistré</span>}
                </div>
              </div>

              <div className="border-t border-ink-100 dark:border-ink-800 pt-5">
                <h4 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Coordonnées de facturation</h4>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Utilisées sur les factures, devis et reçus.</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Téléphone"><input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="input" placeholder="+237 …" /></Field>
                  <Field label="Email"><input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="input" placeholder="contact@…" /></Field>
                  <div className="sm:col-span-2"><Field label="Adresse"><input value={contactForm.address} onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })} className="input" /></Field></div>
                </div>
                <button onClick={saveContact} className="btn-primary mt-4">Enregistrer les coordonnées</button>
              </div>

              <div className="border-t border-ink-100 dark:border-ink-800 pt-5">
                <h4 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Logo & cachet</h4>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Apparaissent sur vos factures et devis (Partie 3).</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="label mb-1">Logo</p>
                    <div className="flex items-center gap-3">
                      {logoUrl ? <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-lg border border-ink-200 dark:border-ink-700 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-ink-200 dark:border-ink-700 text-ink-300"><ImageIcon size={18} /></div>}
                      <label className="btn-ghost cursor-pointer text-xs">
                        <Upload size={13} /> Changer
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, 'logo'); }} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="label mb-1">Cachet</p>
                    <div className="flex items-center gap-3">
                      {stampUrl ? <img src={stampUrl} alt="Cachet" className="h-12 w-12 rounded-lg border border-ink-200 dark:border-ink-700 object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-ink-200 dark:border-ink-700 text-ink-300"><ImageIcon size={18} /></div>}
                      <label className="btn-ghost cursor-pointer text-xs">
                        <Upload size={13} /> Changer
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, 'stamp'); }} />
                      </label>
                    </div>
                  </div>
                </div>
                {uploading && <p className="mt-2 text-xs text-brand-600">Téléversement…</p>}
              </div>
            </div>
          )}

          {tab === 'localization' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">Localisation</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="text-xs uppercase text-ink-500 dark:text-ink-400">Pays</p>
                  <p className="mt-1 font-semibold text-ink-900 dark:text-ink-50">{country?.name ?? tenant?.country_name}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Indicatif : {country?.dialCode}</p>
                </div>
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase text-ink-500 dark:text-ink-400">Devise</p>
                      <p className="mt-1 font-semibold text-ink-900 dark:text-ink-50">{tenant?.currency} · {currencyInfo?.label}</p>
                      <p className="text-xs text-ink-500 dark:text-ink-400">Symbole : {currencyInfo?.symbol}</p>
                    </div>
                    <Badge tone="warning">Verrouillée</Badge>
                  </div>
                  <div className="mt-3 rounded-lg bg-brand-50 dark:bg-brand-900/25 p-3 text-xs text-ink-600 dark:text-ink-300">
                    <p className="font-semibold text-ink-700 dark:text-ink-200">Pourquoi la devise est-elle verrouillée ?</p>
                    <p className="mt-1">La devise est fixée à l'onboarding pour garantir la cohérence de tous vos rapports, factures et écritures comptables. La changer invalidated les montants historiques. Pour un changement exceptionnel (ex: migration EUR → XOF), contactez le support LIYHA GROUP qui pourra procéder via une opération supervisée.</p>
                  </div>
                </div>
                {country && country.mobileMoney.length > 0 && (
                  <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                    <p className="text-xs uppercase text-ink-500 dark:text-ink-400">Mobile Money disponible</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {country.mobileMoney.map((m) => <span key={m} className="rounded-full bg-brand-50 dark:bg-brand-900/25 px-3 py-1 text-xs font-semibold text-brand-700">{m}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">Sécurité</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="font-semibold text-ink-900 dark:text-ink-50">Mot de passe</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Modifiez votre mot de passe pour sécuriser votre compte.</p>
                  <button onClick={() => setShowPwdModal(true)} className="btn-ghost mt-3">Changer le mot de passe</button>
                </div>
                <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="font-semibold text-ink-900 dark:text-ink-50">Sessions actives</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Pour des raisons de sécurité, vous pouvez vous déconnecter des autres appareils.</p>
                  <button onClick={async () => { await supabase.auth.signOut({ scope: 'others' }); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="btn-ghost mt-3">Déconnecter les autres sessions</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'billing' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">Facturation & abonnement</h3>
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 dark:bg-brand-900/25/40 p-4">
                <p className="text-xs uppercase text-ink-500 dark:text-ink-400">Forfait actuel</p>
                <p className="mt-1 text-lg font-bold text-ink-900 dark:text-ink-50">{planInfo?.name ?? 'Aucun forfait'}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink-600 dark:text-ink-300">
                  {planInfo && <span>Prix: <strong>${planInfo.price_usd}/mois</strong></span>}
                  {planInfo && <span>Utilisateurs: <strong>{planInfo.max_users}</strong></span>}
                  {planInfo && <span>Magasins: <strong>{planInfo.max_stores}</strong></span>}
                </div>
                <button onClick={() => navigate('/subscribe')} className="btn-primary mt-4">Changer de forfait</button>
              </div>
              {subscription && (
                <div className="mt-3 rounded-xl border border-ink-200 dark:border-ink-700 p-4">
                  <p className="text-xs uppercase text-ink-500 dark:text-ink-400">Statut abonnement</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={subscription.status === 'active' ? 'success' : subscription.status === 'trialing' ? 'warning' : 'error'}>{subscription.status}</Badge>
                    {subscription.current_period_end && <span className="text-sm text-ink-500 dark:text-ink-400">jusqu'au {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">Notifications</h3>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Choisissez les alertes que vous souhaitez recevoir.</p>
              <div className="mt-4 space-y-3">
                {NOTIF_KEYS.map((key) => (
                  <label key={key} className="flex items-center justify-between rounded-xl border border-ink-200 dark:border-ink-700 p-3">
                    <span className="text-sm text-ink-700 dark:text-ink-200">{NOTIF_LABELS[key]}</span>
                    <input type="checkbox" checked={notifPrefs[key]} onChange={(e) => setNotifPrefs({ ...notifPrefs, [key]: e.target.checked })} className="h-4 w-4 accent-brand-500" />
                  </label>
                ))}
              </div>
              <button onClick={saveNotifs} className="btn-primary mt-4">Enregistrer les préférences</button>
              {saved && <span className="ml-3 text-sm font-semibold text-success-700">✓ Enregistré</span>}
            </div>
          )}

          {tab === 'appearance' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">Apparence</h3>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">Le mode sombre/clair se bascule depuis l'icône lune dans le header. La langue se change depuis le sélecteur du header.</p>
              <div className="mt-4 flex items-center gap-3">
                <Badge tone="brand">{member?.role}</Badge>
                <p className="text-xs text-ink-500 dark:text-ink-400">Votre rôle détermine les modules visibles et les permissions.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={showPwdModal} onClose={() => setShowPwdModal(false)} title="Changer le mot de passe">
        <div className="space-y-4">
          <Field label="Nouveau mot de passe"><input type="password" value={pwdForm.next} onChange={(e) => setPwdForm({ ...pwdForm, next: e.target.value })} className="input" placeholder="Minimum 6 caractères" /></Field>
          {pwdError && <p className="text-sm text-error-600">{pwdError}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setShowPwdModal(false)} className="btn-ghost">Annuler</button>
          <button onClick={changePassword} className="btn-primary">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}
