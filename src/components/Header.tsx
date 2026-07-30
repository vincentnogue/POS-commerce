import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Moon, Sun, Menu, Download } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { useI18n, LANG_LABELS } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import type { Notification } from '../lib/types';
import { useInstallPrompt } from '../lib/useInstallPrompt';

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { theme, toggle } = useTheme();
  const { canInstall, promptInstall } = useInstallPrompt();
  const { user } = useAuth();
  const { lang, setLang, t } = useI18n();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingNotifs(true);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setNotifs((data as Notification[]) ?? []);
      setLoadingNotifs(false);
    })();
  }, [user]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifs((n) => n.map((x) => ({ ...x, read: true })));
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-100 dark:border-ink-800 bg-white/80 dark:bg-ink-800/80 px-4 backdrop-blur lg:px-6">
      <button onClick={onOpenSidebar} className="rounded-full p-2 text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 lg:hidden">
        <Menu size={20} />
      </button>

      <div className="relative flex-1 max-w-xl">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) navigate(`/products?q=${encodeURIComponent(query)}`); }}
          placeholder={t('header.search')}
          className="hidden w-full rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 py-2 pl-10 pr-4 text-sm placeholder:text-ink-400 dark:text-ink-500 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-50 sm:block"
        />
        <button className="rounded-full border border-ink-200 dark:border-ink-700 p-2 text-ink-600 dark:text-ink-300 sm:hidden">
          <Search size={18} />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-ink-200 dark:border-ink-700 px-3 text-xs font-bold text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
          aria-label="Switch language"
        >
          {LANG_LABELS[lang]}
          <span className="text-ink-300">/</span>
          {LANG_LABELS[lang === 'fr' ? 'en' : 'fr' as Lang]}
        </button>
        {canInstall && (
          <button
            onClick={promptInstall}
            title="Installer l'application"
            className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
          >
            <Download size={16} />
          </button>
        )}
        <button
          onClick={toggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
          aria-label="Mode sombre/clair"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="relative" ref={ref}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
          >
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-action-500 px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl2 border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 py-2 shadow-float">
              <div className="flex items-center justify-between px-4 py-2">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">Notifications</p>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs font-semibold text-brand-600 hover:underline">
                    Tout marquer lu
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto scroll-thin">
                {loadingNotifs ? (
                  <p className="px-4 py-6 text-center text-sm text-ink-400 dark:text-ink-500">Chargement…</p>
                ) : notifs.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-ink-400 dark:text-ink-500">Aucune notification</p>
                ) : (
                  notifs.map((n) => (
                    <div key={n.id} className={`border-t border-ink-100 dark:border-ink-800 px-4 py-3 ${n.read ? '' : 'bg-brand-50/50 dark:bg-brand-900/25'}`}>
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{n.body}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
