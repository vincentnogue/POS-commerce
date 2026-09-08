import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useI18n } from '../lib/i18n';

interface Industry {
  id: string;
  icon: string;
  challengeCount: number;
  solutionCount: number;
  featureCount: number;
  color: 'brand' | 'flow' | 'action';
}

// Industry name/description/challenges/solutions/features are all looked
// up via industrySolutions.industry.<id>.* translation keys — only the
// icon path and per-list item counts (needed to iterate) live here.
const INDUSTRIES: Industry[] = [
  { id: 'retail', icon: '/icon-shop-now.png', challengeCount: 4, solutionCount: 4, featureCount: 6, color: 'brand' },
  { id: 'services', icon: '/icon-scissors.png', challengeCount: 4, solutionCount: 4, featureCount: 7, color: 'action' },
  { id: 'professional', icon: '/icon-professional-services.png', challengeCount: 4, solutionCount: 4, featureCount: 7, color: 'brand' },
];

export function IndustrySolutionsPage() {
  const { t } = useI18n();
  useDocumentMeta(t('industrySolutions.metaTitle'), t('industrySolutions.metaDesc'));
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-ink-900">
      {/* Back Button */}
      <div className="sticky top-0 z-40 bg-brand-50 dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition"
          >
            <ArrowLeft size={18} /> {t('common.back')}
          </button>
        </div>
      </div>

      {/* Hero — video background (real shopping/retail motion) instead of a
          flat gradient. Reuses the same Mixkit clip (49137, verified free
          commercial license, already used on the main landing page) rather
          than sourcing a new untested asset. Reduced-motion users get the
          static poster frame via Tailwind's motion-reduce: variant instead
          of an autoplaying video. */}
      <div className="relative overflow-hidden py-24 sm:py-28">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src="https://assets.mixkit.co/videos/49137/49137-thumb-360-4.jpg"
            alt=""
            className="hidden motion-reduce:block w-full h-full object-cover"
          />
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="https://assets.mixkit.co/videos/49137/49137-thumb-360-4.jpg"
            className="block motion-reduce:hidden w-full h-full object-cover"
          >
            <source src="https://assets.mixkit.co/videos/49137/49137-360.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-br from-brand-700/92 via-brand-600/85 to-flow-700/90" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/15 text-white text-xs font-semibold tracking-wide uppercase backdrop-blur-sm mb-6">
            {t('industrySolutions.badge')}
          </span>
          <h1 className="text-5xl font-bold text-white mb-4">
            {t('industrySolutions.title')}
          </h1>
          <p className="text-xl text-white/90">
            {t('industrySolutions.subtitle')}
          </p>
        </div>
      </div>

      {/* Industry Cards */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="space-y-12">
          {INDUSTRIES.map((industry) => {
            const colorMap = {
              brand: 'from-brand-500 to-brand-600',
              flow: 'from-flow-500 to-flow-600',
              action: 'from-action-500 to-action-600'
            };
            const bgMap = {
              brand: 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-700',
              flow: 'bg-flow-50 dark:bg-flow-900/20 border-flow-200 dark:border-flow-700',
              action: 'bg-action-50 dark:bg-action-900/20 border-action-200 dark:border-action-700'
            };
            const prefix = `industrySolutions.industry.${industry.id}`;

            return (
              <div
                key={industry.id}
                className={`border rounded-xl overflow-hidden bg-white dark:bg-ink-800 shadow-lg ${bgMap[industry.color]}`}
              >
                <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12">
                  {/* Left: Icon & Intro */}
                  <div className={`flex flex-col justify-center bg-gradient-to-br ${colorMap[industry.color]} text-white p-8 rounded-lg`}>
                    <div className="mb-6">
                      <div
                        className="w-11 h-11 bg-white"
                        style={{
                          WebkitMaskImage: `url(${industry.icon})`,
                          maskImage: `url(${industry.icon})`,
                          WebkitMaskSize: 'contain',
                          maskSize: 'contain',
                          WebkitMaskRepeat: 'no-repeat',
                          maskRepeat: 'no-repeat',
                          WebkitMaskPosition: 'center',
                          maskPosition: 'center',
                        }}
                      />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">{t(`${prefix}.name`)}</h2>
                    <p className="text-lg mb-6 text-white/95">{t(`${prefix}.description`)}</p>
                    <Link
                      to="/pricing"
                      className="inline-block px-6 py-3 bg-white text-brand-600 font-semibold rounded-full hover:bg-gray-100 transition w-fit"
                    >
                      {t(`${prefix}.cta`)} <ArrowRight size={16} className="inline ml-2" />
                    </Link>
                  </div>

                  {/* Right: Solutions & Features */}
                  <div>
                    <div className="mb-8">
                      <h3 className="font-bold text-ink-900 dark:text-white mb-4 text-lg">
                        {t('industrySolutions.keyChallenges')}
                      </h3>
                      <ul className="space-y-2">
                        {Array.from({ length: industry.challengeCount }, (_, i) => (
                          <li key={i} className="flex gap-2 text-sm text-ink-700 dark:text-ink-300">
                            <Check size={16} className="text-green-600 flex-shrink-0" />
                            {t(`${prefix}.challenge.${i}`)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-bold text-ink-900 dark:text-white mb-4 text-lg">
                        {t('industrySolutions.ourSolutions')}
                      </h3>
                      <ul className="space-y-2">
                        {Array.from({ length: industry.solutionCount }, (_, i) => (
                          <li key={i} className="flex gap-2 text-sm text-ink-700 dark:text-ink-300">
                            <TrendingUp size={16} className="text-brand-600 flex-shrink-0" />
                            {t(`${prefix}.solution.${i}`)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Features List */}
                <div className="border-t border-ink-200 dark:border-ink-700 p-8 md:p-12 bg-white/50 dark:bg-ink-900/50">
                  <h3 className="font-bold text-ink-900 dark:text-white mb-6">{t('industrySolutions.includedFeatures')}</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from({ length: industry.featureCount }, (_, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
                        <Check size={16} className="text-green-600 flex-shrink-0" />
                        {t(`${prefix}.feature.${i}`)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-16 mt-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {t('industrySolutions.ctaTitle')}
          </h2>
          <p className="text-white/90 mb-8">
            {t('industrySolutions.ctaDesc')}
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-full hover:bg-gray-100 transition"
          >
            {t('industrySolutions.ctaButton')}
          </Link>
        </div>
      </div>
    </div>
  );
}
