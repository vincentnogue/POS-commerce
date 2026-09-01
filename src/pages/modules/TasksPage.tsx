import { useEffect, useState, useCallback, useMemo } from 'react';
import { ClipboardCheck, Plus, Trash2, Pencil, Check, X as XIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { PageHeader, EmptyState, Modal, Badge, useToast } from '../../components/ui';
import type { Task, TaskPriority, TaskStatus } from '../../lib/types';

// Store task lists (migration 0075: public.tasks) — "restock endcap",
// "count register 2", etc. This is the first screen to actually use that
// table; assignment is by tenant_member (Staff ID), matching how the rest
// of the app attributes actions to staff rather than raw auth user ids.

type TaskWithNames = Task & { assignee_name: string | null; creator_name: string | null; store_name: string | null };

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];
const STATUSES: TaskStatus[] = ['open', 'in_progress', 'done', 'cancelled'];

const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'brand' | 'warning' | 'error'> = {
  low: 'neutral', normal: 'brand', high: 'warning', urgent: 'error',
};
const STATUS_TONE: Record<TaskStatus, 'neutral' | 'brand' | 'success' | 'error'> = {
  open: 'neutral', in_progress: 'brand', done: 'success', cancelled: 'error',
};

export function TasksPage() {
  const toast = useToast();
  const { t, formatDateTime } = useI18n();
  const { tenant, member } = useAuth();

  const [tasks, setTasks] = useState<TaskWithNames[]>([]);
  const [members, setMembers] = useState<{ id: string; display_name: string | null }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'mine'>('all');

  const [editing, setEditing] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAssignee, setFormAssignee] = useState('');
  const [formStore, setFormStore] = useState('');
  const [formDue, setFormDue] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('normal');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isManager = member?.role === 'admin' || member?.role === 'super_admin' || member?.role === 'manager';

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const [{ data: taskRows }, { data: memberRows }, { data: storeRows }] = await Promise.all([
      supabase.from('tasks').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('tenant_members').select('id, display_name').eq('tenant_id', tenant.id),
      supabase.from('stores').select('id, name').eq('tenant_id', tenant.id),
    ]);
    const memberMap: Record<string, string> = {};
    (memberRows ?? []).forEach((m) => { memberMap[m.id] = m.display_name || t('tasks.unnamed'); });
    const storeMap: Record<string, string> = {};
    (storeRows ?? []).forEach((s) => { storeMap[s.id] = s.name; });

    setTasks(
      ((taskRows as Task[]) ?? []).map((task) => ({
        ...task,
        assignee_name: task.assigned_to ? memberMap[task.assigned_to] ?? null : null,
        creator_name: task.created_by ? memberMap[task.created_by] ?? null : null,
        store_name: task.store_id ? storeMap[task.store_id] ?? null : null,
      }))
    );
    setMembers(memberRows ?? []);
    setStores(storeRows ?? []);
    setLoading(false);
  }, [tenant, t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (assignedFilter === 'mine' && task.assigned_to !== member?.id) return false;
      return true;
    });
  }, [tasks, statusFilter, assignedFilter, member]);

  const openCreate = () => {
    setEditing(null);
    setFormTitle('');
    setFormDescription('');
    setFormAssignee('');
    setFormStore('');
    setFormDue('');
    setFormPriority('normal');
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setFormTitle(task.title);
    setFormDescription(task.description ?? '');
    setFormAssignee(task.assigned_to ?? '');
    setFormStore(task.store_id ?? '');
    setFormDue(task.due_date ?? '');
    setFormPriority(task.priority);
    setModalOpen(true);
  };

  const submit = async () => {
    if (!tenant || !member) return;
    if (!formTitle.trim()) { toast('error', t('tasks.err.titleRequired')); return; }
    setSubmitting(true);
    const payload = {
      tenant_id: tenant.id,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      assigned_to: formAssignee || null,
      store_id: formStore || null,
      due_date: formDue || null,
      priority: formPriority,
    };
    const { error } = editing
      ? await supabase.from('tasks').update(payload).eq('id', editing.id)
      : await supabase.from('tasks').insert({ ...payload, created_by: member.id });
    setSubmitting(false);
    if (error) { toast('error', error.message); return; }
    toast('success', editing ? t('tasks.toast.updated') : t('tasks.toast.created'));
    setModalOpen(false);
    load();
  };

  const setStatus = async (task: Task, status: TaskStatus) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
      .eq('id', task.id);
    if (error) { toast('error', error.message); return; }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t('tasks.confirmDelete'))) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) { toast('error', error.message); return; }
    toast('success', t('tasks.toast.deleted'));
    load();
  };

  const isOverdue = (task: TaskWithNames) =>
    task.due_date && task.status !== 'done' && task.status !== 'cancelled' && new Date(task.due_date) < new Date(new Date().toDateString());

  return (
    <div>
      <PageHeader
        icon={ClipboardCheck}
        title={t('nav.tasks')}
        subtitle={t('tasks.subtitle')}
        action={
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> {t('tasks.new')}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')} className="input w-auto">
          <option value="all">{t('tasks.filter.allStatus')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`tasks.status.${s}`)}</option>)}
        </select>
        <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value as 'all' | 'mine')} className="input w-auto">
          <option value="all">{t('tasks.filter.everyone')}</option>
          <option value="mine">{t('tasks.filter.mine')}</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t('tasks.empty.title')} description={t('tasks.empty.desc')} />
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink-900 dark:text-ink-50">{task.title}</p>
                  <Badge tone={PRIORITY_TONE[task.priority]}>{t(`tasks.priority.${task.priority}`)}</Badge>
                  <Badge tone={STATUS_TONE[task.status]}>{t(`tasks.status.${task.status}`)}</Badge>
                  {isOverdue(task) && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-error-600">
                      <AlertCircle size={12} /> {t('tasks.overdue')}
                    </span>
                  )}
                </div>
                {task.description && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{task.description}</p>}
                <p className="mt-1 text-xs text-ink-400">
                  {task.assignee_name ? t('tasks.assignedTo', { name: task.assignee_name }) : t('tasks.unassigned')}
                  {task.store_name && ` · ${task.store_name}`}
                  {task.due_date && ` · ${t('tasks.due')} ${formatDateTime(task.due_date)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {task.status !== 'done' && (
                  <button onClick={() => setStatus(task, 'done')} title={t('tasks.markDone')} className="rounded-full p-2 text-success-600 hover:bg-success-100 dark:hover:bg-success-900/25">
                    <Check size={16} />
                  </button>
                )}
                {task.status !== 'cancelled' && task.status !== 'done' && (
                  <button onClick={() => setStatus(task, 'cancelled')} title={t('tasks.cancel')} className="rounded-full p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700">
                    <XIcon size={16} />
                  </button>
                )}
                {(isManager || task.created_by === member?.id) && (
                  <>
                    <button onClick={() => openEdit(task)} className="rounded-full p-2 text-ink-500 hover:bg-brand-50 dark:hover:bg-brand-900/25">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => remove(task.id)} className="rounded-full p-2 text-error-500 hover:bg-error-50 dark:hover:bg-error-900/25">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('tasks.editTitle') : t('tasks.new')}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{t('tasks.field.title')}</label>
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="input" placeholder={t('tasks.field.titlePlaceholder')} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{t('tasks.field.description')}</label>
            <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="input min-h-[80px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{t('tasks.field.assignee')}</label>
              <select value={formAssignee} onChange={(e) => setFormAssignee(e.target.value)} className="input">
                <option value="">{t('tasks.unassigned')}</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name || t('tasks.unnamed')}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{t('tasks.field.store')}</label>
              <select value={formStore} onChange={(e) => setFormStore(e.target.value)} className="input">
                <option value="">{t('tasks.field.allStores')}</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{t('tasks.field.due')}</label>
              <input type="date" value={formDue} onChange={(e) => setFormDue(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-400">{t('tasks.field.priority')}</label>
              <select value={formPriority} onChange={(e) => setFormPriority(e.target.value as TaskPriority)} className="input">
                {PRIORITIES.map((p) => <option key={p} value={p}>{t(`tasks.priority.${p}`)}</option>)}
              </select>
            </div>
          </div>
          <button onClick={submit} disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-50">
            {submitting ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
