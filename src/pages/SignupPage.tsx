import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, AlertCircle, Check } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) setError(error);
    else {
      // Wait for session to be established before navigating
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate('/onboarding');
      else setError('Compte créé. Veuillez vous connecter pour continuer.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-900 lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-flow-600 to-brand-600 lg:block">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo size="lg" clickable />
          <div>
            <h2 className="text-4xl font-extrabold leading-tight">Démarrez gratuitement,<br />en 5 minutes.</h2>
            <ul className="mt-6 space-y-3 text-brand-50">
              {['Aucune carte bancaire requise', 'POS, stock, facturation inclus', 'Multi-magasins, multi-devises', 'Mobile Money intégré'].map((f) => (
                <li key={f} className="flex items-center gap-2"><Check size={16} /> {f}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-brand-50">© LIYHA GROUP — Dubaï / Yaoundé-Soa</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-500 dark:text-ink-400 hover:text-brand-600">
            <ArrowLeft size={15} /> Retour
          </Link>
          <div className="lg:hidden mb-6"><Link to="/"><Logo size="lg" /></Link></div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Créer votre compte</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">L'onboarding vous guidera ensuite pour configurer votre commerce.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" placeholder="vous@exemple.com" />
              </div>
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10" placeholder="6 caractères min." />
              </div>
            </div>
            <div>
              <label className="label">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input pl-10" placeholder="••••••••" />
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-error-50 dark:bg-error-900/25 p-3 text-sm text-error-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
            Déjà un compte ?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:underline">Se connecter</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
