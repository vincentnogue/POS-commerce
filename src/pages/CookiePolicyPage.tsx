import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';

// Before this, the only cookie-related surface was CookieBanner.tsx linking
// to /privacy — there was no standalone page actually listing cookie
// categories, retention, and how to withdraw consent, which most cookie
// banners (and EU ePrivacy guidance) expect to exist behind the "Learn
// more" link. Reuses the same real toggle described in cookies.tsx rather
// than inventing categories the code doesn't have.
export function CookiePolicyPage() {
  const { t } = useI18n();
  return (
    <FooterPageLayout title={t('cookiePolicy.title')}>
      <p className="text-sm text-ink-500 dark:text-ink-400">{t('cookiePolicy.lastUpdate')}</p>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('cookiePolicy.s1.title')}</h2>
        <p>{t('cookiePolicy.s1.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('cookiePolicy.s2.title')}</h2>
        <p>{t('cookiePolicy.s2.text')}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>{t('cookiePolicy.s2.essential')}</strong> — {t('cookiePolicy.s2.essentialDesc')}</li>
          <li><strong>{t('cookiePolicy.s2.preference')}</strong> — {t('cookiePolicy.s2.preferenceDesc')}</li>
          <li><strong>{t('cookiePolicy.s2.analytics')}</strong> — {t('cookiePolicy.s2.analyticsDesc')}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('cookiePolicy.s3.title')}</h2>
        <p>{t('cookiePolicy.s3.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('cookiePolicy.s4.title')}</h2>
        <p>{t('cookiePolicy.s4.text')} <a href="mailto:privacy@liafrik.com" className="text-brand-600 hover:underline">privacy@liafrik.com</a>.</p>
      </section>
    </FooterPageLayout>
  );
}
