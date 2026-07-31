import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';

export function LegalPage() {
  const { t } = useI18n();
  return (
    <FooterPageLayout title={t('legal.title')}>
      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('legal.publisher.title')}</h2>
        <p><strong>LiAfrik</strong><br />
        {t('legal.publisher.holding')}<br />
        {t('legal.publisher.hq')}<br />
        {t('legal.publisher.office')}<br />
        {t('legal.publisher.contact')} <a href="mailto:cs@liafrik.com" className="text-brand-600 hover:underline">cs@liafrik.com</a></p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('legal.director.title')}</h2>
        <p>{t('legal.director.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('legal.hosting.title')}</h2>
        <p>{t('legal.hosting.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('legal.ip.title')}</h2>
        <p>{t('legal.ip.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('legal.trademark.title')}</h2>
        <p>{t('legal.trademark.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('legal.mediation.title')}</h2>
        <p>{t('legal.mediation.text')}</p>
      </section>
    </FooterPageLayout>
  );
}
