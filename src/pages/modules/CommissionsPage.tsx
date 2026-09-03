import { useEffect, useState, useCallback, useMemo } from 'react';
import { Percent, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, EmptyState, StatCard, useToast } from '../../components/ui';
import type { CommissionRule, SaleCommission, Category } from '../../lib/types';

// Commission (migration 0075 tables + RPC in migration 0078): rules are
// managed here, the actual per-sale ledger is populated automatically by
// compute_sale_commission (called from POSPage at checkout) — this page
// is read-only on the ledger side, by design: individual rows shouldn't
// be hand-edited, only the rules that produce future ones.

type LedgerRow = SaleCommission & { member_name: string | null; sale_reference: string | null; sale_total: number | null };

export function CommissionsPage() {
  const toast = useToast();
  const { t, formatDateTime } = useI18n();
  const { tenant, member } = useAuth();

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [members, setMembers] = useState<{ id: string; display_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberFilter, setMemberFilter] = useState<string>('all');

  const [ruleName, setRuleName] = useState('');
  const [ruleRate, setRuleRate] = useState('5');
  const [ruleCategory, setRuleCategory] = useState('');

  const isManager = member?.role === 'admin' || member?.role === 'super_admin' || member?.role === 'manager';
  const currency = tenant?.currency ?? 'XOF';

  const load = useCallback(async () => {
    if (!tenant || !member) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [{ data: ruleRows }, { data: categoryRows }, { data: memberRows }, { data: ledgerRows }] = await Promise.all([
      supabase.from('commission_rules').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('tenant_id', tenant.id).order('name'),
      isManager ? supabase.from('tenant_members').select('id, display_name').eq('tenant_id', tenant.id) : Promise.resolve({ data: null }),
      isManager
        ? supabase.from('sale_commissions').select('*').eq('tenant_id', tenant.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false })
        : supabase.from('sale_commissions').select('*').eq('tenant_id', tenant.id).eq('member_id', member.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
    ]);

    setRules((ruleRows as CommissionRule[]) ?? []);
    setCategories((categoryRows as Category[]) ?? []);
    setMembers(memberRows ?? []);

    const rows = (ledgerRows as SaleCommission[]) ?? [];
    const saleIds = [...new Set(rows.map((r) => r.sale_id))];
    const memberIds = [...new Set(rows.map((r) => r.member_id))];
    const [{ data: sales }, { data: memberNames }] = await Promise.all([
      saleIds.length ? supabase.from('sales').select('id, reference, total').in('id', saleIds) : Promise.resolve({ data: [] }),
      memberIds.length ? supabase.from('tenant_members').select('id, display_name').in('id', memberIds) : Promise.resolve({ data: [] }),
    ]);
    const saleMap: Record<string, { reference: string; total: number }> = {};
    (sales ?? []).forEach((s: any) => { saleMap[s.id] = { reference: s.reference, total: s.total }; });
    const nameMap: Record<string, string> = {};
    (memberNames ?? []).forEach((m: any) => { nameMap[m.id] = m.display_name || t('tasks.unnamed'); });

    setLedger(rows.map((r) => ({
      ...r,
      member_name: nameMap[r.member_id] ?? null,
      sale_reference: saleMap[r.sale_id]?.reference ?? null,
      sale_total: saleMap[r.sale_id]?.total ?? null,
    })));
    setLoading(false);
  }, [tenant, member, isManager, t]);

  useEffect(() => { load(); }, [load]);

  const filteredLedger = useMemo(
    () => (memberFilter === 'all' ? ledger : ledger.filter((r) => r.member_id === memberFilter)),
    [ledger, memberFilter]
  );

  const totalCommission = useMemo(() => filteredLedger.reduce((sum, r) => sum + Number(r.amount), 0), [filteredLedger]);

  const createRule = async () => {
    if (!tenant || !ruleName.trim()) return;
    const rate = Number(ruleRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) { toast('error', t('commissions.err.invalidRate')); return; }
    const { error } = await supabase.from('commission_rules').insert({
      tenant_id: tenant.id, name: ruleName.trim(), rate_percent: rate, category_id: ruleCategory || null,
    });
    if (error) { toast('error', error.message); return; }
    setRuleName(''); setRuleRate('5'); setRuleCategory('');
    toast('success', t('commissions.toast.ruleCreated'));
    load();
  };

  const toggleRule = async (rule: CommissionRule) => {
    const { error } = await supabase.from('commission_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    if (error) { toast('error', error.message); return; }
    load();
  };

  const removeRule = async (id: string) => {
    if (!confirm(t('commissions.confirmDeleteRule'))) return;
    const { error } = await supabase.from('commission_rules').delete().eq('id', id);
    if (error) { toast('error', error.message); return; }
    load();
  };

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;

  if (!isManager) {
    // Staff see their own earnings only, no rule management.
    return (
      <div>
        <PageHeader icon={Percent} title={t('nav.commissions')} subtitle={t('commissions.subtitle.staff')} />
        <StatCardsRow amount={totalCommission} currency={currency} label={t('commissions.myTotal30d')} />
        <LedgerTable ledger={filteredLedger} loading={loading} currency={currency} formatDateTime={formatDateTime} t={t} showMember={false} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon={Percent} title={t('nav.commissions')} subtitle={t('commissions.subtitle.manager')} />

      <StatCardsRow amount={totalCommission} currency={currency} label={t('commissions.totalTeam30d')} />

      <h3 className="mb-3 mt-6 font-medium text-ink-900 dark:text-ink-50">{t('commissions.rules.title')}</h3>
      <div className="card mb-3 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder={t('commissions.rules.namePlaceholder')} className="input" />
          <input type="number" min={0} max={100} step={0.5} value={ruleRate} onChange={(e) => setRuleRate(e.target.value)} placeholder={t('commissions.rules.ratePlaceholder')} className="input" />
          <select value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)} className="input">
            <option value="">{t('commissions.rules.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={createRule} className="btn-primary justify-center"><Plus size={16} /> {t('commissions.rules.add')}</button>
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={Percent} title={t('commissions.rules.empty.title')} description={t('commissions.rules.empty.desc')} />
      ) : (
        <div className="mb-6 space-y-1.5">
          {rules.map((rule) => (
            <div key={rule.id} className="card flex items-center justify-between p-3">
              <div>
                <p className="font-medium text-ink-900 dark:text-ink-50">{rule.name}</p>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  {rule.rate_percent}% · {categoryName(rule.category_id) ?? t('commissions.rules.allCategories')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleRule(rule)} className={rule.is_active ? 'text-success-600' : 'text-ink-400'} title={rule.is_active ? t('commissions.rules.active') : t('commissions.rules.inactive')}>
                  {rule.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button onClick={() => removeRule(rule.id)} className="rounded-full p-1.5 text-error-500 hover:bg-error-50 dark:hover:bg-error-900/25"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-ink-900 dark:text-ink-50">{t('commissions.ledger.title')}</h3>
        <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} className="input w-auto">
          <option value="all">{t('commissions.filter.everyone')}</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.display_name || t('tasks.unnamed')}</option>)}
        </select>
      </div>
      <LedgerTable ledger={filteredLedger} loading={loading} currency={currency} formatDateTime={formatDateTime} t={t} showMember />
    </div>
  );
}

function StatCardsRow({ amount, currency, label }: { amount: number; currency: string; label: string }) {
  return (
    <div className="mb-6">
      <StatCard label={label} value={formatMoney(amount, currency)} icon={Percent} tone="success" />
    </div>
  );
}

function LedgerTable({
  ledger, loading, currency, formatDateTime, t, showMember,
}: {
  ledger: LedgerRow[]; loading: boolean; currency: string;
  formatDateTime: (iso: string) => string; t: (k: string, p?: any) => string; showMember: boolean;
}) {
  if (loading) return <p className="text-sm text-ink-400">{t('common.loading')}</p>;
  if (ledger.length === 0) return <EmptyState icon={Percent} title={t('commissions.ledger.empty.title')} description={t('commissions.ledger.empty.desc')} />;
  return (
    <div className="space-y-1.5">
      {ledger.map((row) => (
        <div key={row.id} className="card flex items-center justify-between p-3">
          <div>
            {showMember && <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{row.member_name}</p>}
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {row.sale_reference ?? '—'} · {formatDateTime(row.created_at)}
              {row.sale_total != null && ` · ${t('commissions.ledger.onSale', { amount: formatMoney(row.sale_total, currency) })}`}
            </p>
          </div>
          <span className="font-medium text-success-700">+{formatMoney(row.amount, currency)}</span>
        </div>
      ))}
    </div>
  );
}
