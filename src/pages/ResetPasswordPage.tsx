import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Supabase sends the recovery token as a URL fragment (#access_token=...);
  // supabase-js's detectSessionInUrl (enabled in lib/supabase.ts) parses it
  // automatically and opens a temporary "recovery" session. We just wait a
  // tick for that to happen before allowing the form to submit.
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setLinkInvalid(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError(t('reset.error.passwordTooShort')); return; }
    if (password !== confirm) { setError(t('reset.error.passwordMismatch')); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-900 lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 to-flow-600 lg:block">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo size="lg" clickable />
          <div>
            <h2 className="text-4xl font-medium leading-tight">{t('reset.hero.titleLine1')}<br />{t('reset.hero.titleLine2')}</h2>
          </div>
          <p className="text-sm text-brand-50">© {new Date().getFullYear()} {t('reset.copyright')}</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden mb-6"><Link to="/"><Logo size="lg" /></Link></div>

          {linkInvalid ? (
            <div className="rounded-2xl border border-error-100 dark:border-error-900/40 bg-error-50 dark:bg-error-900/25 p-5">
              <AlertCircle size={22} className="mb-2 text-error-600" />
              <h1 className="text-lg font-semibold text-ink-900 dark:text-ink-50">{t('reset.invalid.title')}</h1>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t('reset.invalid.text')}</p>
              <Link to="/forgot-password" className="btn-primary mt-4 inline-flex justify-center py-2.5">{t('reset.invalid.requestNew')}</Link>
            </div>
          ) : done ? (
            <div className="rounded-2xl border border-success-100 dark:border-success-900/40 bg-success-50 dark:bg-success-900/25 p-5">
              <CheckCircle2 size={22} className="mb-2 text-success-600" />
              <h1 className="text-lg font-semibold text-ink-900 dark:text-ink-50">{t('reset.done.title')}</h1>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t('reset.done.text')}</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-50">{t('reset.title')}</h1>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('reset.subtitle')}</p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label className="label">{t('reset.newPassword')}</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10" placeholder="••••••••" />
                  </div>
                </div>
                <div>
                  <label className="label">{t('reset.confirmPassword')}</label>
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
                <button type="submit" disabled={loading || !ready} className="btn-primary w-full justify-center py-3">
                  {loading ? t('reset.submitting') : t('reset.submit')}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
