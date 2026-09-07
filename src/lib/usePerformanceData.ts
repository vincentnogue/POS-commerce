import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';
import type { Sale } from './types';

// Shared by PerformancePage (the full standalone module) and the compact
// widget embedded on DashboardPage — same query, same 14-day window, in
// one place, so both stay correct together instead of one of them
// silently drifting out of sync with the other's bug fixes.
//
// PerformanceMetrics needs a full 14-day window (7 days for the current
// totals/chart, plus the prior 7 days to compute the week-over-week
// trend) — never reuse a differently-scoped "recent sales" query for
// this, that was the original bug (see PerformancePage.tsx history).
export function usePerformanceData() {
  const { tenant } = useAuth();
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

  return { loading, sales, activeProductCount, returnsLast7Days, currency };
}
