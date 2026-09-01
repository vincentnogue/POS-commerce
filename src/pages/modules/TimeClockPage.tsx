import { useEffect, useState, useCallback } from 'react';
import { Clock, LogIn, LogOut, Trash2, Pencil, History as HistoryIcon } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { PageHeader, EmptyState, Modal, useToast } from '../../components/ui';

// Staff clock-in/out for shift traceability — not payroll, scheduling, or
// attendance management, which this product intentionally does not do
// (see the comment in LandingPage.tsx explaining why marketing copy must
// never claim that). This is purely "who was on the floor and when".
type Correction = {
  at: string;
  by: string;
  by_name: string;
  field: 'clock_in' | 'clock_out';
  old_value: string | null;
  new_value: string | null;
  reason: string;
};

type TimeClockEntry = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  corrections: Correction[];
};

function formatDuration(startIso: string, endIso: string | null, locale: string) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return locale.startsWith('fr') ? `${h}h${String(m).padStart(2, '0')}` : `${h}h ${String(m).padStart(2, '0')}m`;
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in the browser's local
// time, and give that same shape back — these two just cross the boundary
// to/from the ISO strings the DB stores.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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

  // Manager correction (see migration 0071): edits a possibly-forgotten
  // clock-out or a mistaken clock-in, and always appends to the row's
  // `corrections` audit trail rather than silently overwriting history.
  const [editingEntry, setEditingEntry] = useState<TimeClockEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<TimeClockEntry | null>(null);

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
    setEntries(((teamEntries as TimeClockEntry[]) ?? []).map((e) => ({ ...e, corrections: e.corrections ?? [] })));
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
    if (!confirm(t('timeclock.confirmDelete'))) return;
    await supabase.from('time_clock_entries').delete().eq('id', id);
    load();
  };

  const nameFor = (uid: string) => (uid === user?.id ? (member?.display_name || t('timeclock.me')) : memberNames[uid] || '—');

  const openEdit = (entry: TimeClockEntry) => {
    setEditingEntry(entry);
    setEditClockIn(toLocalInputValue(entry.clock_in));
    setEditClockOut(toLocalInputValue(entry.clock_out));
    setEditReason('');
  };

  const submitEdit = async () => {
    if (!editingEntry || !user) return;
    if (!editReason.trim()) { toast('error', t('timeclock.err.reasonRequired')); return; }
    const newClockIn = fromLocalInputValue(editClockIn);
    const newClockOut = fromLocalInputValue(editClockOut);
    if (!newClockIn) { toast('error', t('timeclock.err.invalidTime')); return; }
    if (newClockOut && new Date(newClockOut) < new Date(newClockIn)) { toast('error', t('timeclock.err.outBeforeIn')); return; }

    const now = new Date().toISOString();
    const byName = member?.display_name || t('timeclock.me');
    const newCorrections: Correction[] = [...editingEntry.corrections];
    if (newClockIn !== editingEntry.clock_in) {
      newCorrections.push({ at: now, by: user.id, by_name: byName, field: 'clock_in', old_value: editingEntry.clock_in, new_value: newClockIn, reason: editReason.trim() });
    }
    if (newClockOut !== editingEntry.clock_out) {
      newCorrections.push({ at: now, by: user.id, by_name: byName, field: 'clock_out', old_value: editingEntry.clock_out, new_value: newClockOut, reason: editReason.trim() });
    }
    if (newCorrections.length === editingEntry.corrections.length) {
      // Nothing actually changed — no point writing a no-op correction row.
      setEditingEntry(null);
      return;
    }

    setEditSubmitting(true);
    const { error } = await supabase
      .from('time_clock_entries')
      .update({ clock_in: newClockIn, clock_out: newClockOut, corrections: newCorrections })
      .eq('id', editingEntry.id);
    setEditSubmitting(false);
    if (error) { toast('error', error.message); return; }
    setEditingEntry(null);
    toast('success', t('timeclock.toast.corrected'));
    load();
  };

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
                  {e.corrections.length > 0 && ` · ${t('timeclock.correctedTag', { count: e.corrections.length })}`}
                </p>
                {e.note && <p className="mt-0.5 text-xs italic text-ink-400 dark:text-ink-500">{e.note}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{formatDuration(e.clock_in, e.clock_out, locale)}</span>
                {e.corrections.length > 0 && (
                  <button onClick={() => setHistoryEntry(e)} title={t('timeclock.viewHistory')} className="text-ink-400 hover:text-brand-600 dark:text-ink-500">
                    <HistoryIcon size={15} />
                  </button>
                )}
                {isManager && (
                  <>
                    <button onClick={() => openEdit(e)} title={t('timeclock.correct')} className="text-ink-400 hover:text-brand-600 dark:text-ink-500">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => deleteEntry(e.id)} title={t('common.delete')} className="text-error-500 hover:text-error-700">
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editingEntry} onClose={() => setEditingEntry(null)} title={t('timeclock.correct')} maxWidth="max-w-sm">
        <div className="space-y-3">
          <div>
            <label className="label">{t('timeclock.clockIn')}</label>
            <input type="datetime-local" value={editClockIn} onChange={(e) => setEditClockIn(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{t('timeclock.clockOut')}</label>
            <input type="datetime-local" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} className="input" />
            <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">{t('timeclock.clockOutEmptyHint')}</p>
          </div>
          <div>
            <label className="label">
              {t('timeclock.reasonLabel')}
              <span className="ml-1 text-error-500">*</span>
            </label>
            <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} className="input" rows={2} placeholder={t('timeclock.reasonPlaceholder')} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setEditingEntry(null)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={submitEdit} disabled={editSubmitting} className="btn-primary disabled:opacity-50">{t('common.save')}</button>
        </div>
      </Modal>

      <Modal open={!!historyEntry} onClose={() => setHistoryEntry(null)} title={t('timeclock.historyTitle')} maxWidth="max-w-md">
        <div className="max-h-80 space-y-2 overflow-y-auto scroll-thin">
          {(historyEntry?.corrections ?? []).slice().reverse().map((c, i) => (
            <div key={i} className="rounded-lg border border-ink-100 dark:border-ink-800 p-3 text-sm">
              <p className="text-ink-900 dark:text-ink-50">
                {t(c.field === 'clock_in' ? 'timeclock.correctionClockIn' : 'timeclock.correctionClockOut')}
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {c.old_value ? formatDateTime(c.old_value) : '—'} → {c.new_value ? formatDateTime(c.new_value) : '—'}
              </p>
              <p className="mt-1 text-xs italic text-ink-400 dark:text-ink-500">"{c.reason}"</p>
              <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">{c.by_name} · {formatDateTime(c.at)}</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
