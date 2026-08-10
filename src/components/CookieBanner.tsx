import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Check, X, Settings as SettingsIcon } from 'lucide-react';
import { useCookies } from '../lib/cookies';
import { useI18n } from '../lib/i18n';

export function CookieBanner() {
  const { prefs, setPrefs } = useCookies();
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!prefs) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }
  }, [prefs]);

  const acceptAll = () => { setPrefs({ necessary: true, analytics: true, marketing: true }); setShow(false); };
  const refuse = () => { setPrefs({ necessary: true, analytics: false, marketing: false }); setShow(false); };
  const saveCustom = () => { setPrefs({ necessary: true, analytics, marketing }); setShow(false); setShowPrefs(false); };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.4 }}
          className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl2 border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-5 shadow-float"
        >
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/25 text-brand-600">
              <Cookie size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-ink-700 dark:text-ink-200">
                {t('cookie.text')}{' '}
                <Link to="/privacy" className="font-medium text-brand-600 underline">{t('cookie.privacyLink')}</Link>.
              </p>
              {showPrefs && (
                <div className="mt-3 space-y-2 rounded-xl bg-ink-50 dark:bg-ink-900 p-3">
                  <label className="flex items-center justify-between text-sm">
                    <span className="text-ink-700 dark:text-ink-200">{t('cookie.necessary')} <span className="text-xs text-ink-400 dark:text-ink-500">{t('cookie.necessaryHint')}</span></span>
                    <input type="checkbox" checked disabled className="h-4 w-4 accent-brand-500" />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    <span className="text-ink-700 dark:text-ink-200">{t('cookie.analytics')}</span>
                    <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="h-4 w-4 accent-brand-500" />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    <span className="text-ink-700 dark:text-ink-200">{t('cookie.marketing')}</span>
                    <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-4 w-4 accent-brand-500" />
                  </label>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={acceptAll} className="btn-primary px-3 py-1.5 text-xs"><Check size={14} /> {t('cookie.acceptAll')}</button>
                <button onClick={refuse} className="btn-ghost px-3 py-1.5 text-xs">{t('cookie.refuse')}</button>
                {showPrefs ? (
                  <button onClick={saveCustom} className="btn-ghost px-3 py-1.5 text-xs">{t('cookie.saveChoices')}</button>
                ) : (
                  <button onClick={() => setShowPrefs(true)} className="btn-ghost px-3 py-1.5 text-xs"><SettingsIcon size={13} /> {t('cookie.customize')}</button>
                )}
                <button onClick={() => setShow(false)} className="ml-auto rounded-full p-1.5 text-ink-400 dark:text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"><X size={16} /></button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
