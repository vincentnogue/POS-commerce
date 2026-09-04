import { motion } from 'framer-motion';
import { Building2, Globe2, Heart, Target } from 'lucide-react';
import { FooterPageLayout } from '../components/FooterPageLayout';
import { useI18n } from '../lib/i18n';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export function AboutPage() {
  const { t } = useI18n();
  useDocumentMeta(t('seo.about.title'), t('seo.about.desc'));
  return (
    <FooterPageLayout title={t('about.title')}>
      <p className="text-lg">{t('about.intro')}</p>

      <div className="grid gap-6 sm:grid-cols-2 my-8">
        {[
          { icon: Target, title: t('about.mission.title'), text: t('about.mission.text') },
          { icon: Globe2, title: t('about.vision.title'), text: t('about.vision.text') },
          { icon: Heart, title: t('about.values.title'), text: t('about.values.text') },
          { icon: Building2, title: t('about.company.title'), text: t('about.company.text') },
        ].map((v, i) => (
          <motion.div
            key={v.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 dark:bg-brand-900/25 p-6"
          >
            <v.icon className="mb-3 text-brand-600" size={24} />
            <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{v.title}</h3>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{v.text}</p>
          </motion.div>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-medium text-ink-900 dark:text-ink-50">{t('about.history.title')}</h2>
        <p>{t('about.history.p1')}</p>
        <p className="mt-4">{t('about.history.p2')}</p>
      </section>
    </FooterPageLayout>
  );
}
