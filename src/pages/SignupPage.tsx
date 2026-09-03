import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, AlertCircle, Check } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';

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

export function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submitGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleLoading(false);
      setError(error);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError(t('signup.error.passwordTooShort')); return; }
    if (password !== confirm) { setError(t('signup.error.passwordMismatch')); return; }
    setLoading(true);
    const { error } = await signUp(email, password);
    
    if (error) {
      setLoading(false);
      setError(error);
      return;
    }

    // Wait for auth state to be established
    let retries = 0;
    const maxRetries = 20; // 10 seconds max
    while (retries < maxRetries) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          // Session established, navigate to onboarding
          // Small delay to ensure auth context is updated
          await new Promise(resolve => setTimeout(resolve, 100));
          navigate('/onboarding', { replace: true });
          return;
        }
      } catch (_err) {
        // Continue retrying
      }
      retries++;
      // Wait 500ms before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setLoading(false);
    setError(t('signup.error.createdMustLogin'));
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-900 lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block" style={{backgroundImage: 'url(/auth-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center'}}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo size="lg" clickable />
          <div>
            <h2 className="text-4xl font-medium leading-tight">{t('signup.hero.titleLine1')}<br />{t('signup.hero.titleLine2')}</h2>
            <ul className="mt-6 space-y-3 text-brand-50">
              {['signup.hero.feat1', 'signup.hero.feat2', 'signup.hero.feat3', 'signup.hero.feat4'].map((k) => (
                <li key={k} className="flex items-center gap-2"><Check size={16} /> {t(k)}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-brand-50">© {new Date().getFullYear()} {t('signup.copyright')}</p>
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
            <ArrowLeft size={15} /> {t('common.back')}
          </Link>
          <div className="lg:hidden mb-6"><Link to="/"><Logo size="lg" /></Link></div>
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-50">{t('signup.title')}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('signup.subtitle')}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">{t('signup.email')}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" placeholder={t('signup.emailPlaceholder')} />
              </div>
            </div>
            <div>
              <label className="label">{t('signup.password')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10" placeholder={t('signup.passwordPlaceholder')} />
              </div>
            </div>
            <div>
              <label className="label">{t('signup.confirmPassword')}</label>
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
              {loading ? t('signup.submitting') : t('signup.submit')}
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
            {t('signup.haveAccount')}{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline">{t('signup.signIn')}</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
