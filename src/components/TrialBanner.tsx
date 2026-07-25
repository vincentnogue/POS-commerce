import { Link } from 'react-router-dom';
import { Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function TrialBanner() {
  const { access } = useAuth();

  if (access.isSuperAdmin) return null;
  if (access.hasActiveSubscription && !access.inTrial) return null;
  if (!access.inTrial && !access.blocked) return null;

  const daysLeft = access.trialDaysLeft;
  const isExpired = access.blocked;

  if (isExpired) {
    return (
      <div className="sticky top-16 z-10 flex items-center justify-between gap-3 border-b border-error-200 bg-error-50 dark:bg-error-900/25 px-4 py-2.5 text-sm lg:px-8">
        <div className="flex items-center gap-2 text-error-700">
          <AlertCircle size={16} className="shrink-0" />
          <span className="font-semibold">Votre essai gratuit est terminé.</span>
          <span className="hidden sm:inline">Choisissez un forfait pour retrouver l'accès à vos modules.</span>
        </div>
        <Link to="/subscribe" className="shrink-0 rounded-lg bg-error-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-error-700">
          Choisir un forfait
        </Link>
      </div>
    );
  }

  const tone = daysLeft <= 2 ? 'bg-error-50 dark:bg-error-900/25 border-error-200 text-error-700' : daysLeft <= 5 ? 'bg-warning-50 dark:bg-warning-900/25 border-warning-200 text-warning-700' : 'bg-brand-50 dark:bg-brand-900/25 border-brand-200 text-brand-700';

  return (
    <div className={`sticky top-16 z-10 flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm lg:px-8 ${tone}`}>
      <div className="flex items-center gap-2">
        <Clock size={16} className="shrink-0" />
        <span className="font-semibold">Il vous reste {daysLeft} jour{daysLeft > 1 ? 's' : ''} d'essai gratuit.</span>
        <span className="hidden sm:inline">Choisissez un forfait pour éviter toute interruption.</span>
      </div>
      <Link to="/subscribe" className="shrink-0 rounded-lg bg-white/80 dark:bg-ink-800/80 px-4 py-1.5 text-xs font-bold text-ink-800 dark:text-ink-100 transition hover:bg-white dark:bg-ink-800">
        Choisir un forfait
      </Link>
    </div>
  );
}
