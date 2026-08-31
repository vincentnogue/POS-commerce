import { useEffect, useState, useCallback } from 'react';
import { Clock, LogIn, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { PageHeader, EmptyState, useToast } from '../../components/ui';

// Staff clock-in/out for shift traceability — not payroll, scheduling, or
// attendance management, which this product intentionally does not do
// (see the comment in LandingPage.tsx explaining why marketing copy must
// never claim that). This is purely "who was on the floor and when".
type TimeClockEntry = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
};

function formatDuration(startIso: string, endIso: string | null, locale: string) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return locale.startsWith('fr') ? `${h}h${String(m).padStart(2, '0')}` : `${h}h ${String(m).padStart(2, '0')}m`;
}

export function TimeClockPage() {
  const toast = useToast();
  const { t, formatDateTime, locale } = useI18n();
  const { tenant, user, member } = useAuth();
  const [myOpenEntry, setMyOpenEntry] = useState<TimeClockEntry | null>(null);
  const [entries, setEntries] = useState<TimeClockEntry[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  const isManager = member?.role === 'admin' || member?.role === 'super_admin' || member?.role === 'manager';

  const load = useCallback(async () => {
    if (!tenant || !user) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [{ data: mine }, { data: teamEntries }, { data: teamMembers }] = await Promise.all([
      supabase.from('time_clock_entries').select('*').eq('tenant_id', tenant.id).eq('user_id', user.id).is('clock_out', null).maybeSingle(),
      isManager
        ? supabase.from('time_clock_entries').select('*').eq('tenant_id', tenant.id).gte('clock_in', since.toISOString()).order('clock_in', { ascending: false })
        : supabase.from('time_clock_entries').select('*').eq('tenant_id', tenant.id).eq('user_id', user.id).gte('clock_in', since.toISOString()).order('clock_in', { ascending: false }),
      isManager ? supabase.from('tenant_members').select('user_id, display_name').eq('tenant_id', tenant.id) : Promise.resolve({ data: null }),
    ]);

    setMyOpenEntry((mine as TimeClockEntry) ?? null);
    setEntries((teamEntries as TimeClockEntry[]) ?? []);
    if (teamMembers) {
      const map: Record<string, string> = {};
      (teamMembers as { user_id: string; display_name: string | null }[]).forEach((m) => { if (m.user_id) map[m.user_id] = m.display_name || '—'; });
      setMemberNames(map);
    }
    setLoading(false);
  }, [tenant, user, isManager]);

  useEffect(() => { load(); }, [load]);

  const clockIn = async () => {
    if (!tenant || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('time_clock_entries').insert({ tenant_id: tenant.id, user_id: user.id, note: note.trim() || null });
    setSubmitting(false);
    if (error) { toast('error', error.message); return; }
    setNote('');
    toast('success', t('timeclock.clockedIn'));
    load();
  };

  const clockOut = async () => {
    if (!myOpenEntry) return;
    setSubmitting(true);
    const { error } = await supabase.from('time_clock_entries').update({ clock_out: new Date().toISOString() }).eq('id', myOpenEntry.id);
    setSubmitting(false);
    if (error) { toast('error', error.message); return; }
    toast('success', t('timeclock.clockedOut'));
    load();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('time_clock_entries').delete().eq('id', id);
    load();
  };

  const nameFor = (uid: string) => (uid === user?.id ? (member?.display_name || t('timeclock.me')) : memberNames[uid] || '—');

  return (
    <div>
      <PageHeader icon={Clock} title={t('nav.timeclock')} subtitle={t('timeclock.subtitle')} />

      <div className="mb-6 card p-5 text-center">
        {myOpenEntry ? (
          <>
            <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('timeclock.clockedInSince')}</p>
            <p className="mt-1 text-2xl font-medium text-success-700">{formatDateTime(myOpenEntry.clock_in)}</p>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{formatDuration(myOpenEntry.clock_in, null, locale)}</p>
            <button onClick={clockOut} disabled={submitting} className="btn-primary mt-4 justify-center disabled:opacity-50">
              <LogOut size={16} /> {t('timeclock.clockOut')}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-500 dark:text-ink-400">{t('timeclock.notClockedIn')}</p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('timeclock.notePlaceholder')}
              className="input mx-auto mt-3 max-w-xs"
            />
            <button onClick={clockIn} disabled={submitting} className="btn-primary mt-3 justify-center disabled:opacity-50">
              <LogIn size={16} /> {t('timeclock.clockIn')}
            </button>
          </>
        )}
      </div>

      <h3 className="mb-3 font-medium text-ink-900 dark:text-ink-50">{isManager ? t('timeclock.teamHistory') : t('timeclock.myHistory')}</h3>
      {loading ? (
        <p className="text-sm text-ink-400">{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <EmptyState icon={Clock} title={t('timeclock.empty.title')} description={t('timeclock.empty.desc')} />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="card flex items-center justify-between p-4">
              <div>
                {isManager && <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{nameFor(e.user_id)}</p>}
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  {formatDateTime(e.clock_in)} → {e.clock_out ? formatDateTime(e.clock_out) : t('timeclock.inProgress')}
                </p>
                {e.note && <p className="mt-0.5 text-xs italic text-ink-400 dark:text-ink-500">{e.note}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{formatDuration(e.clock_in, e.clock_out, locale)}</span>
                {isManager && (
                  <button onClick={() => deleteEntry(e.id)} className="text-error-500 hover:text-error-700">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
