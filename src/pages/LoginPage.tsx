import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.61z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password, rememberMe);
    setLoading(false);
    if (error) setError(error);
    else navigate(from, { replace: true });
  };

  const submitGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    // On success the browser navigates away to Google immediately —
    // this only runs when signInWithOAuth itself failed to even start
    // the redirect (e.g. misconfiguration), so it's safe to stop the
    // spinner and show the error inline.
    if (error) {
      setGoogleLoading(false);
      setError(error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-900 lg:grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative hidden overflow-hidden lg:block" style={{backgroundImage: 'url(/auth-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center'}}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo size="lg" clickable />
          <div>
            <h2 className="text-4xl font-medium leading-tight">{t('login.hero.titleLine1')}<br />{t('login.hero.titleLine2')}</h2>
            <p className="mt-4 max-w-md text-brand-50">{t('login.hero.subtitle')}</p>
          </div>
          <p className="text-sm text-brand-50">© {new Date().getFullYear()} {t('login.copyright')}</p>
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
            <ArrowLeft size={15} /> {t('common.back')}
          </Link>
          <div className="lg:hidden mb-6"><Link to="/"><Logo size="lg" /></Link></div>
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-50">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">{t('login.email')}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10" placeholder={t('login.emailPlaceholder')}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label">{t('login.password')}</label>
                <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">{t('login.forgotPassword')}</Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10" placeholder="••••••••"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              {t('login.rememberMe')}
            </label>
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-error-50 dark:bg-error-900/25 p-3 text-sm text-error-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
            <span className="text-xs uppercase text-ink-400 dark:text-ink-500">{t('login.orDivider')}</span>
            <div className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
          </div>

          <button
            type="button"
            onClick={submitGoogle}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 py-3 text-sm font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-700 disabled:opacity-50"
          >
            <GoogleIcon /> {googleLoading ? t('login.submitting') : t('login.googleSignIn')}
          </button>

          <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
            {t('login.noAccount')}{' '}
            <Link to="/signup" className="font-medium text-brand-600 hover:underline">{t('login.createAccount')}</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
