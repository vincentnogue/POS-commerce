import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';

// The plans (Starter/Pro/Premium/Entreprise, see terms.s4) exist and the
// product is being positioned at an international, "enterprise commerce
// platform" level, but nothing described what uptime commitment a paying
// tenant actually gets. Written to match what's real: the app runs on
// Supabase-hosted infrastructure (src/lib/supabase.ts), so this states a
// target commitment and a credit process rather than inventing a
// third-party status page or monitoring dashboard the product doesn't have.
export function SlaPage() {
  const { t } = useI18n();
  return (
    <FooterPageLayout title={t('sla.title')}>
      <p className="text-sm text-ink-500 dark:text-ink-400">{t('sla.lastUpdate')}</p>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('sla.s1.title')}</h2>
        <p>{t('sla.s1.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('sla.s2.title')}</h2>
        <p>{t('sla.s2.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('sla.s3.title')}</h2>
        <p>{t('sla.s3.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('sla.s4.title')}</h2>
        <p>{t('sla.s4.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('sla.s5.title')}</h2>
        <p>{t('sla.s5.text')} <a href="mailto:support@liafrik.com" className="text-brand-600 hover:underline">support@liafrik.com</a>.</p>
      </section>
    </FooterPageLayout>
  );
}
