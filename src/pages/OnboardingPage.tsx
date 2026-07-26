import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Building2, Globe, Coins, CreditCard, UserPlus, AlertCircle, Image as ImageIcon, Stamp, Upload } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { COUNTRIES, CURRENCIES, getCountry } from '../lib/localization';

const STEPS = ['Entreprise', 'Pays', 'Région & Ville', 'Devise', 'Forfait', 'Marque', 'Code commercial'];

const BUSINESS_TYPES = [
  'Boutique de quartier', 'Supermarché', 'Épicerie', 'Pharmacie', 'Magasin de mode',
  'Restaurant / Fast-food', 'Boulangerie', 'Quincaillerie', 'Boutique cosmétique',
  'Magasin d\'électronique', 'Librairie', 'Autre',
];

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);

  const [countryCode, setCountryCode] = useState('');
  const [region, setRegion] = useState('');
  const [customRegion, setCustomRegion] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');

  const [currency, setCurrency] = useState('');

  const [planCode, setPlanCode] = useState('pro');

  const [commercialCode, setCommercialCode] = useState('');
  const [commercialCodeValid, setCommercialCodeValid] = useState<boolean | null>(null);
  const [commercialRep, setCommercialRep] = useState<string | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [stampPreview, setStampPreview] = useState<string | null>(null);

  const country = countryCode ? getCountry(countryCode) : undefined;

  const onCountryChange = (code: string) => {
    setCountryCode(code);
    const c = getCountry(code);
    if (c) {
      setCurrency(c.currency);
      setRegion('');
      setCity('');
      setCustomRegion('');
      setCustomCity('');
    }
  };

  const next = () => {
    setError(null);
    if (step === 0 && !businessName.trim()) { setError('Veuillez saisir le nom de votre commerce.'); return; }
    if (step === 1 && !countryCode) { setError('Veuillez sélectionner un pays.'); return; }
    if (step === 2 && !city.trim() && !customCity.trim()) { setError('Veuillez saisir une ville.'); return; }
    if (step === 3 && !currency) { setError('Veuillez confirmer la devise.'); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const verifyCode = async () => {
    if (!commercialCode.trim()) {
      setCommercialCodeValid(null);
      setCommercialRep(null);
      return;
    }
    const { data } = await supabase
      .from('commercial_codes')
      .select('code, rep_name, is_active')
      .eq('code', commercialCode.trim())
      .eq('is_active', true)
      .maybeSingle();
    if (data) {
      setCommercialCodeValid(true);
      setCommercialRep(data.rep_name);
    } else {
      setCommercialCodeValid(false);
      setCommercialRep(null);
    }
  };

  const finish = async () => {
    if (!user) { navigate('/login'); return; }
    setSubmitting(true);
    setError(null);

    const finalRegion = customRegion || region;
    const finalCity = customCity || city;
    const finalName = businessName.trim();
    const countryInfo = getCountry(countryCode)!;

    if (!finalName) { setError('Veuillez saisir le nom du commerce.'); setSubmitting(false); return; }
    if (!countryCode) { setError('Veuillez sélectionner un pays.'); setSubmitting(false); return; }

    // 1. Find plan id
    const { data: plan } = await supabase.from('plans').select('id').eq('code', planCode).maybeSingle();

    // 2. Resolve commercial code id if valid
    let commercialCodeId: string | null = null;
    if (commercialCode.trim() && commercialCodeValid) {
      const { data: cc } = await supabase
        .from('commercial_codes')
        .select('id')
        .eq('code', commercialCode.trim())
        .maybeSingle();
      commercialCodeId = cc?.id ?? null;
    }

    // 3. Create tenant atomically via RPC (bypasses RLS race condition)
    const { data: tenant, error: rpcErr } = await supabase.rpc('create_tenant_for_user', {
      p_name: finalName,
      p_business_type: businessType,
      p_country_code: countryCode,
      p_country_name: countryInfo.name,
      p_region: finalRegion || null,
      p_city: finalCity || null,
      p_currency: currency,
      p_plan_id: plan?.id ?? null,
      p_commercial_code_id: commercialCodeId,
      p_logo_url: null,
      p_stamp_url: null,
    });

    if (rpcErr || !tenant) {
      const msg = rpcErr?.message ?? 'Erreur lors de la création du commerce.';
      setError(msg.includes('violates row-level security') ? 'Session non établie. Veuillez vous reconnecter.' : msg);
      setSubmitting(false);
      return;
    }

    // 4. Upload logo and stamp to the tenant folder (now that tenant exists)
    const tenantId = (tenant as any).id;
    let logoUrl: string | null = null;
    let stampUrl: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const { data: ul, error: ulErr } = await supabase.storage
        .from('brand-assets')
        .upload(`${tenantId}/logo.${ext}`, logoFile, { upsert: true });
      if (ulErr) {
        setError('Commerce créé, mais le logo n\'a pas pu être téléversé: ' + ulErr.message);
        setSubmitting(false);
        return;
      }
      logoUrl = supabase.storage.from('brand-assets').getPublicUrl(ul.path).data.publicUrl;
    }
    if (stampFile) {
      const ext = stampFile.name.split('.').pop();
      const { data: us, error: usErr } = await supabase.storage
        .from('brand-assets')
        .upload(`${tenantId}/stamp.${ext}`, stampFile, { upsert: true });
      if (usErr) {
        setError('Commerce créé, mais le cachet n\'a pas pu être téléversé: ' + usErr.message);
        setSubmitting(false);
        return;
      }
      stampUrl = supabase.storage.from('brand-assets').getPublicUrl(us.path).data.publicUrl;
    }

    // 5. Save brand settings if assets were uploaded
    if (logoUrl || stampUrl) {
      await supabase.from('brand_settings').insert({ tenant_id: tenantId, logo_url: logoUrl, stamp_url: stampUrl });
    }

    await refreshProfile();
    setSubmitting(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-900">
      <header className="border-b border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5">
          <Logo clickable />
          <p className="text-sm text-ink-500 dark:text-ink-400">Étape {step + 1} / {STEPS.length}</p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700'}`} />
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="card p-7"
        >
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StepHeader icon={Building2} title="Informations entreprise" subtitle="Comment s'appelle votre commerce ?" />
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="label">Nom du commerce</label>
                    <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="input" placeholder="Ex : Marco LLC" />
                  </div>
                  <div>
                    <label className="label">Type de commerce</label>
                    <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="input">
                      {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StepHeader icon={Globe} title="Pays" subtitle="Dans quel pays opérez-vous ?" />
                <div className="mt-6">
                  <label className="label">Pays</label>
                  <select value={countryCode} onChange={(e) => onCountryChange(e.target.value)} className="input">
                    <option value="">— Sélectionner —</option>
                    <optgroup label="Afrique">
                      {COUNTRIES.filter((c) => !['AE', 'US', 'FR', 'GB'].includes(c.code)).map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="International">
                      {COUNTRIES.filter((c) => ['AE', 'US', 'FR', 'GB'].includes(c.code)).map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  {country && (
                    <div className="mt-3 rounded-xl bg-brand-50 dark:bg-brand-900/25 p-3 text-sm text-brand-700">
                      <p>Indicatif : {country.dialCode} · Langues : {country.languages.join(', ')}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StepHeader icon={Globe} title="Région & Ville" subtitle="Localisez votre point de vente principal." />
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="label">Région / Province</label>
                    {country && country.regions.length > 0 ? (
                      <select value={region} onChange={(e) => setRegion(e.target.value)} className="input">
                        <option value="">— Sélectionner —</option>
                        {country.regions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <input value={customRegion} onChange={(e) => setCustomRegion(e.target.value)} className="input" placeholder="Saisir la région" />
                    )}
                    {country && country.regions.length > 0 && (
                      <input value={customRegion} onChange={(e) => setCustomRegion(e.target.value)} className="input mt-2" placeholder="Ou saisir une région non listée" />
                    )}
                  </div>
                  <div>
                    <label className="label">Ville</label>
                    {country && country.cities.length > 0 ? (
                      <select value={city} onChange={(e) => setCity(e.target.value)} className="input">
                        <option value="">— Sélectionner —</option>
                        {country.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input value={customCity} onChange={(e) => setCustomCity(e.target.value)} className="input" placeholder="Saisir la ville" />
                    )}
                    {country && country.cities.length > 0 && (
                      <input value={customCity} onChange={(e) => setCustomCity(e.target.value)} className="input mt-2" placeholder="Ou saisir une ville non listée" />
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StepHeader icon={Coins} title="Devise" subtitle="Auto-sélectionnée selon votre pays, verrouillée définitivement ensuite." />
                <div className="mt-6">
                  <label className="label">Devise du compte</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
                    {Object.entries(CURRENCIES).map(([code, info]) => (
                      <option key={code} value={code}>{code} — {info.label} ({info.symbol})</option>
                    ))}
                  </select>
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning-50 dark:bg-warning-900/25 p-3 text-xs text-warning-600">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    La devise est <strong>verrouillée définitivement</strong> après cette étape. Elle restera cohérente dans tout le compte (POS, factures, rapports, exports).
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StepHeader icon={CreditCard} title="Choix du forfait" subtitle="Sélectionnez le plan adapté à votre activité." />
                <div className="mt-6 space-y-3">
                  {[
                    { code: 'starter', name: 'Starter', price: '$9/mois', desc: '1 magasin · 2 utilisateurs · 100 produits' },
                    { code: 'pro', name: 'Pro', price: '$19/mois', desc: '2 magasins · 5 utilisateurs · 1 000 produits' },
                    { code: 'premium', name: 'Premium', price: '$49/mois', desc: '5 magasins · 15 utilisateurs · 10 000 produits' },
                    { code: 'entreprise', name: 'Entreprise', price: '$119/mois', desc: '20 magasins · 50 utilisateurs · illimité' },
                  ].map((p) => (
                    <button
                      key={p.code}
                      onClick={() => setPlanCode(p.code)}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                        planCode === p.code ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/25 ring-1 ring-brand-200' : 'border-ink-200 dark:border-ink-700 hover:border-brand-200'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-ink-900 dark:text-ink-50">{p.name}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400">{p.desc}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-brand-700">{p.price}</span>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${planCode === p.code ? 'border-brand-500 bg-brand-500' : 'border-ink-300 dark:border-ink-600'}`}>
                          {planCode === p.code && <Check size={12} className="text-white" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StepHeader icon={ImageIcon} title="Personnalisez votre marque" subtitle="Logo et cachet apparaîtront sur vos factures, devis et reçus." />
                <div className="mt-6 space-y-5">
                  <div>
                    <label className="label">Logo de l'entreprise</label>
                    <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">Apparaîtra sur vos factures, devis et reçus</p>
                    <div className="flex items-center gap-4">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded-xl border border-ink-200 dark:border-ink-700 object-contain bg-white dark:bg-ink-800 p-1" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-ink-300 dark:border-ink-600 bg-ink-50 dark:bg-ink-900">
                          <ImageIcon size={20} className="text-ink-400 dark:text-ink-500" />
                        </div>
                      )}
                      <label className="btn-ghost cursor-pointer text-sm">
                        <Upload size={14} /> Choisir un logo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }
                        }} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="label">Cachet / tampon officiel</label>
                    <p className="mb-2 text-xs text-ink-500 dark:text-ink-400">Laissez vide si vous n'en avez pas</p>
                    <div className="flex items-center gap-4">
                      {stampPreview ? (
                        <img src={stampPreview} alt="Stamp preview" className="h-16 w-16 rounded-xl border border-ink-200 dark:border-ink-700 object-contain bg-white dark:bg-ink-800 p-1" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-ink-300 dark:border-ink-600 bg-ink-50 dark:bg-ink-900">
                          <Stamp size={20} className="text-ink-400 dark:text-ink-500" />
                        </div>
                      )}
                      <label className="btn-ghost cursor-pointer text-sm">
                        <Upload size={14} /> Choisir un cachet
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setStampFile(f); setStampPreview(URL.createObjectURL(f)); }
                        }} />
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div key="5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StepHeader icon={UserPlus} title="Code commercial (optionnel)" subtitle="Si un commercial LiAfrik vous a référé, saisissez son code." />
                <div className="mt-6">
                  <label className="label">Code commercial</label>
                  <div className="flex gap-2">
                    <input
                      value={commercialCode}
                      onChange={(e) => { setCommercialCode(e.target.value); setCommercialCodeValid(null); setCommercialRep(null); }}
                      onBlur={verifyCode}
                      className="input"
                      placeholder="Laissez vide si vous n'en avez pas"
                    />
                    <button onClick={verifyCode} className="btn-ghost shrink-0">Vérifier</button>
                  </div>
                  {commercialCodeValid === true && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-success-700">
                      <Check size={14} /> Code valide — rattaché à {commercialRep}
                    </p>
                  )}
                  {commercialCodeValid === false && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-error-600">
                      <AlertCircle size={14} /> Code invalide ou inactif
                    </p>
                  )}
                  <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
                    Le code commercial est 100% optionnel. S'il est vide, votre compte est créé normalement.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-error-50 dark:bg-error-900/25 p-3 text-sm text-error-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="mt-7 flex items-center justify-between">
            <button onClick={prev} disabled={step === 0} className="btn-ghost disabled:opacity-40">
              <ArrowLeft size={16} /> Précédent
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={next} className="btn-primary">Suivant <ArrowRight size={16} /></button>
            ) : (
              <button onClick={finish} disabled={submitting} className="btn-primary">
                {submitting ? 'Création…' : 'Terminer'} {submitting ? null : <Check size={16} />}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StepHeader({ icon: Icon, title, subtitle }: { icon: typeof Building2; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-900/25 text-brand-600">
        <Icon size={20} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">{title}</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>
      </div>
    </div>
  );
}
