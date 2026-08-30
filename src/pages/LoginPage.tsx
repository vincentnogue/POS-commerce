import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

export function LoginPage() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';

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
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-error-50 dark:bg-error-900/25 p-3 text-sm text-error-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
            {t('login.noAccount')}{' '}
            <Link to="/signup" className="font-medium text-brand-600 hover:underline">{t('login.createAccount')}</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
