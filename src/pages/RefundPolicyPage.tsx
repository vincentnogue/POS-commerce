import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';

// Missing legal page found in the international-compliance audit: the
// platform processes real subscription payments (Stripe, PayPal,
// Flutterwave, Paystack, PayUnit — see SubscribePage) and is adding Paddle
// (merchant-of-record billing, which itself requires a published refund
// policy from any seller using it) but had no refund/cancellation policy
// page anywhere — only a one-line mention of cancellation buried in
// terms.s4. Content here describes what's actually true today (14-day
// trial, monthly/annual billing, cancel-anytime-access-until-period-end
// per terms.s4/s7) rather than inventing guarantees the product doesn't
// back.
export function RefundPolicyPage() {
  const { t } = useI18n();
  return (
    <FooterPageLayout title={t('refund.title')}>
      <p className="text-sm text-ink-500 dark:text-ink-400">{t('refund.lastUpdate')}</p>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('refund.s1.title')}</h2>
        <p>{t('refund.s1.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('refund.s2.title')}</h2>
        <p>{t('refund.s2.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('refund.s3.title')}</h2>
        <p>{t('refund.s3.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('refund.s4.title')}</h2>
        <p>{t('refund.s4.text')}</p>
      </section>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('refund.s5.title')}</h2>
        <p>{t('refund.s5.text')} <a href="mailto:support@liafrik.com" className="text-brand-600 hover:underline">support@liafrik.com</a>.</p>
      </section>
    </FooterPageLayout>
  );
}
