import { useState } from 'react';
import { Settings as SettingsIcon, Building2, Globe, Shield, CreditCard, Bell, Palette } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { CURRENCIES, getCountry } from '../../lib/localization';
import { PageHeader, Badge } from '../../components/ui';
import { Field } from '../../components/DataTable';

type Tab = 'company' | 'localization' | 'security' | 'billing' | 'notifications' | 'appearance';

export function SettingsPage() {
  const { tenant, member, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('company');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: tenant?.name ?? '',
    business_type: tenant?.business_type ?? '',
    region: tenant?.region ?? '',
    city: tenant?.city ?? '',
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
                tab === t.id ? 'bg-white text-brand-700 shadow-soft' : 'text-ink-600 hover:bg-white/60'
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        <div className="card p-6">
          {tab === 'company' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900">Informations entreprise</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Nom du commerce"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
                <Field label="Type de commerce"><input value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} className="input" /></Field>
                <Field label="Région"><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="input" /></Field>
                <Field label="Ville"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></Field>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button onClick={saveCompany} className="btn-primary">Enregistrer</button>
                {saved && <span className="text-sm font-semibold text-success-700">✓ Enregistré</span>}
              </div>
            </div>
          )}

          {tab === 'localization' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900">Localisation</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-ink-200 p-4">
                  <p className="text-xs uppercase text-ink-500">Pays</p>
                  <p className="mt-1 font-semibold text-ink-900">{country?.name ?? tenant?.country_name}</p>
                  <p className="text-xs text-ink-500">Indicatif : {country?.dialCode}</p>
                </div>
                <div className="rounded-xl border border-ink-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase text-ink-500">Devise</p>
                      <p className="mt-1 font-semibold text-ink-900">{tenant?.currency} · {currencyInfo?.label}</p>
                      <p className="text-xs text-ink-500">Symbole : {currencyInfo?.symbol}</p>
                    </div>
                    <Badge tone="warning">Verrouillée</Badge>
                  </div>
                  <p className="mt-2 text-xs text-ink-500">La devise est verrouillée définitivement à l'onboarding pour garantir la cohérence comptable.</p>
                </div>
                {country && country.mobileMoney.length > 0 && (
                  <div className="rounded-xl border border-ink-200 p-4">
                    <p className="text-xs uppercase text-ink-500">Mobile Money disponible</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {country.mobileMoney.map((m) => <span key={m} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{m}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900">Sécurité</h3>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-ink-200 p-4">
                  <p className="font-semibold text-ink-900">Authentification à deux facteurs (2FA)</p>
                  <p className="mt-1 text-sm text-ink-500">Renforcez la sécurité de votre compte avec un second facteur.</p>
                  <button className="btn-ghost mt-3">Activer le 2FA</button>
                </div>
                <div className="rounded-xl border border-ink-200 p-4">
                  <p className="font-semibold text-ink-900">Sessions actives</p>
                  <p className="mt-1 text-sm text-ink-500">Gérez les appareils connectés à votre compte.</p>
                </div>
                <div className="rounded-xl border border-ink-200 p-4">
                  <p className="font-semibold text-ink-900">Journal de connexion</p>
                  <p className="mt-1 text-sm text-ink-500">Consultez l'historique des connexions à votre compte.</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'billing' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900">Facturation & abonnement</h3>
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
                <p className="text-xs uppercase text-ink-500">Forfait actuel</p>
                <p className="mt-1 text-lg font-bold text-ink-900">{tenant?.plan_id ? 'Plan en cours' : 'Aucun forfait'}</p>
                <p className="text-sm text-ink-500">Géré par le Super Admin. Pour changer de forfait, contactez LIYHA GROUP.</p>
              </div>
              <p className="mt-4 text-xs text-ink-500">La couche paiement est abstraite (interface PaymentProvider). Stripe est intégré pour les tests ; Flutterwave (Mobile Money) sera branché à l'avenir sans refonte.</p>
            </div>
          )}

          {tab === 'notifications' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900">Notifications</h3>
              <div className="mt-4 space-y-3">
                {['Ventes enregistrées', 'Stock bas', 'Factures impayées', 'Livraisons planifiées', 'Résumé hebdomadaire'].map((n) => (
                  <label key={n} className="flex items-center justify-between rounded-xl border border-ink-200 p-3">
                    <span className="text-sm text-ink-700">{n}</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-brand-500" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div>
              <h3 className="text-base font-semibold text-ink-900">Apparence</h3>
              <p className="mt-2 text-sm text-ink-500">Le mode sombre/clair se bascule depuis l'icône lune dans le header.</p>
              <div className="mt-4 flex items-center gap-3">
                <Badge tone="brand">{member?.role}</Badge>
                <p className="text-xs text-ink-500">Votre rôle détermine les modules visibles et les permissions.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
