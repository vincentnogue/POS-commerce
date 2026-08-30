import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';

export function TermsPage() {
  const { t } = useI18n();
  return (
    <FooterPageLayout title={t('terms.title')}>
      <p className="text-sm text-ink-500 dark:text-ink-400">{t('terms.lastUpdate')}</p>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('terms.s1.title')}</h2>
        <p>{t('terms.s1.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('terms.s2.title')}</h2>
        <p>
          <strong>{t('terms.s2.platform')}</strong>{t('terms.s2.platformDef')}{' '}
          <strong>{t('terms.s2.tenant')}</strong>{t('terms.s2.tenantDef')}{' '}
          <strong>{t('terms.s2.user')}</strong>{t('terms.s2.userDef')}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('terms.s3.title')}</h2>
        <p>{t('terms.s3.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('terms.s4.title')}</h2>
        <p>{t('terms.s4.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('terms.s5.title')}</h2>
        <p>{t('terms.s5.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('terms.s6.title')}</h2>
        <p>{t('terms.s6.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('terms.s7.title')}</h2>
        <p>{t('terms.s7.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('terms.s8.title')}</h2>
        <p>{t('terms.s8.text')} <a href="mailto:support@liafrik.com" className="text-brand-600 hover:underline">support@liafrik.com</a>.</p>
      </section>
    </FooterPageLayout>
  );
}
