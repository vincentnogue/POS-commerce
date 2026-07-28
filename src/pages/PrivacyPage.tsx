import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';

export function PrivacyPage() {
  const { t } = useI18n();
  return (
    <FooterPageLayout title={t('privacy.title')}>
      <p className="text-sm text-ink-500 dark:text-ink-400">{t('privacy.lastUpdate')}</p>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">{t('privacy.s1.title')}</h2>
        <p>{t('privacy.s1.text')} <a href="mailto:dpo@liafrik.com" className="text-brand-600 hover:underline">dpo@liafrik.com</a>.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">{t('privacy.s2.title')}</h2>
        <p>{t('privacy.s2.intro')}</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>{t('privacy.s2.item1')}</li>
          <li>{t('privacy.s2.item2')}</li>
          <li>{t('privacy.s2.item3')}</li>
          <li>{t('privacy.s2.item4')}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">{t('privacy.s3.title')}</h2>
        <p>{t('privacy.s3.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">{t('privacy.s4.title')}</h2>
        <p>{t('privacy.s4.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">{t('privacy.s5.title')}</h2>
        <p>{t('privacy.s5.text')} <a href="mailto:privacy@liafrik.com" className="text-brand-600 hover:underline">privacy@liafrik.com</a>.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">{t('privacy.s6.title')}</h2>
        <p>{t('privacy.s6.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">{t('privacy.s7.title')}</h2>
        <p>{t('privacy.s7.text')}</p>
      </section>
    </FooterPageLayout>
  );
}
