import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname ?? '/dashboard';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
    else navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-900 lg:grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 to-flow-600 lg:block">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo size="lg" clickable />
          <div>
            <h2 className="text-4xl font-medium leading-tight">La gestion commerciale,<br />enfin simple.</h2>
            <p className="mt-4 max-w-md text-brand-50">Reconnectez-vous à votre tableau de bord, vos ventes, votre stock — partout en Afrique.</p>
          </div>
          <p className="text-sm text-brand-50">© {new Date().getFullYear()} LiAfrik — Dubaï / Afrique</p>
        </div>
      </div>

      {/* Form */}
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
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-50">Connexion</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Heureux de vous revoir sur POS Flow.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10" placeholder="vous@exemple.com"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Mot de passe</label>
                <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">Mot de passe oublié ?</Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10" placeholder="••••••••"
                />
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-error-50 dark:bg-error-900/25 p-3 text-sm text-error-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
            Pas encore de compte ?{' '}
            <Link to="/signup" className="font-medium text-brand-600 hover:underline">Créer un compte</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
