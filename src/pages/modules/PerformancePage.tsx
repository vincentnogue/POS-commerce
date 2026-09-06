import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { PerformanceMetrics } from '../../components/PerformanceMetrics';
import type { Sale } from '../../lib/types';

// Extracted out of DashboardPage.tsx into its own module/route, per
// request — this used to be a section embedded at the bottom of the
// dashboard.
//
// BUG FIX along the way: DashboardPage was passing PerformanceMetrics its
// `sales` state, which is actually a `.limit(8)` "recent sales" query
// meant for a small list shown elsewhere on the dashboard — but
// PerformanceMetrics needs a full 14-day window (7 days for the current
// totals/chart, plus the prior 7 days to compute the week-over-week
// trend). Any tenant with more than 8 sales in that window got silently
// wrong revenue/trend numbers. This page fetches its own properly-scoped
// 14-day query instead of reusing a differently-scoped one.
export function PerformancePage() {
  const { tenant } = useAuth();
  const { t } = useI18n();
  useDocumentMeta(t('dashboard.performance.title'), t('dashboard.performance.subtitle'));

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeProductCount, setActiveProductCount] = useState(0);
  const [returnsLast7Days, setReturnsLast7Days] = useState(0);
  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      setLoading(true);
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 13 * 86400000);
      fourteenDaysAgo.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(now.getTime() - 6 * 86400000);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const [{ data: salesData }, { count: productCount }, { count: returnsCount }] = await Promise.all([
        supabase
          .from('sales')
          .select('*')
          .eq('tenant_id', tenant.id)
          .neq('sale_status', 'cancelled')
          .gte('sale_date', fourteenDaysAgo.toISOString()),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true),
        supabase.from('sale_returns').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).gte('created_at', sevenDaysAgo.toISOString()),
      ]);

      setSales((salesData as Sale[]) ?? []);
      setActiveProductCount(productCount ?? 0);
      setReturnsLast7Days(returnsCount ?? 0);
      setLoading(false);
    })();
  }, [tenant]);

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center py-24 text-ink-400">…</div>
      ) : (
        <PerformanceMetrics
          sales={sales}
          returnsLast7Days={returnsLast7Days}
          activeProductCount={activeProductCount}
          currency={currency}
        />
      )}
    </div>
  );
}
