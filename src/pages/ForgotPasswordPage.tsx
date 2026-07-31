import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show the same success state whether or not the email exists —
    // confirming/denying account existence here would leak which emails
    // are registered.
    if (error && error.message.toLowerCase().includes('rate limit')) {
      setError('Trop de tentatives. Réessayez dans quelques minutes.');
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-900 lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 to-flow-600 lg:block">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo size="lg" clickable />
          <div>
            <h2 className="text-4xl font-medium leading-tight">Ça arrive à tout<br />le monde.</h2>
            <p className="mt-4 max-w-md text-brand-50">Entrez votre email et on vous envoie un lien pour choisir un nouveau mot de passe.</p>
          </div>
          <p className="text-sm text-brand-50">© {new Date().getFullYear()} LiAfrik — Dubaï / Afrique</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <Link to="/login" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-500 dark:text-ink-400 hover:text-brand-600">
            <ArrowLeft size={15} /> Retour à la connexion
          </Link>
          <div className="lg:hidden mb-6"><Link to="/"><Logo size="lg" /></Link></div>

          {sent ? (
            <div className="rounded-2xl border border-success-100 dark:border-success-900/40 bg-success-50 dark:bg-success-900/25 p-5">
              <CheckCircle2 size={22} className="mb-2 text-success-600" />
              <h1 className="text-lg font-medium text-ink-900 dark:text-ink-50">Vérifiez votre boîte mail</h1>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                Si un compte existe pour <strong>{email}</strong>, un email avec un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos spams.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-medium text-ink-900 dark:text-ink-50">Mot de passe oublié</h1>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">On vous envoie un lien de réinitialisation par email.</p>

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
                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-error-50 dark:bg-error-900/25 p-3 text-sm text-error-600">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
