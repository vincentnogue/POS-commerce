import { useI18n } from '../../lib/i18n';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { usePerformanceData } from '../../lib/usePerformanceData';
import { PerformanceMetrics } from '../../components/PerformanceMetrics';

// Extracted out of DashboardPage.tsx into its own module/route, per
// request — and per a follow-up clarification, also still deployed as a
// compact widget embedded directly on the Dashboard (see the
// PerformanceMetrics section in DashboardPage.tsx). Both this full page
// and that widget share usePerformanceData() so the 14-day-window fix
// below applies to both instead of just one.
//
// BUG FIX (kept from the original extraction): DashboardPage used to
// pass PerformanceMetrics its `sales` state, which is actually a
// `.limit(8)` "recent sales" query meant for a small list shown
// elsewhere on the dashboard — but PerformanceMetrics needs a full
// 14-day window (7 days for the current totals/chart, plus the prior 7
// days to compute the week-over-week trend). Any tenant with more than
// 8 sales in that window got silently wrong revenue/trend numbers.
export function PerformancePage() {
  const { t } = useI18n();
  useDocumentMeta(t('dashboard.performance.title'), t('dashboard.performance.subtitle'));
  const { loading, sales, activeProductCount, returnsLast7Days, currency } = usePerformanceData();

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
