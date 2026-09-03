import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';

// Standard for any platform that processes payments and stores customer
// PII on behalf of tenants — required by most payment processors
// (including Paddle, being added as a PSP) as a condition of using their
// checkout, and referenced by terms.s7 ("fraude ou usage illicite") without
// ever spelling out what that means. This page is that definition.
export function AcceptableUsePage() {
  const { t } = useI18n();
  return (
    <FooterPageLayout title={t('aup.title')}>
      <p className="text-sm text-ink-500 dark:text-ink-400">{t('aup.lastUpdate')}</p>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('aup.s1.title')}</h2>
        <p>{t('aup.s1.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('aup.s2.title')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('aup.s2.item1')}</li>
          <li>{t('aup.s2.item2')}</li>
          <li>{t('aup.s2.item3')}</li>
          <li>{t('aup.s2.item4')}</li>
          <li>{t('aup.s2.item5')}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('aup.s3.title')}</h2>
        <p>{t('aup.s3.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('aup.s4.title')}</h2>
        <p>{t('aup.s4.text')} <a href="mailto:abuse@liafrik.com" className="text-brand-600 hover:underline">abuse@liafrik.com</a>.</p>
      </section>
    </FooterPageLayout>
  );
}
