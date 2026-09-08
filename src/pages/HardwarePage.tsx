import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useI18n } from '../lib/i18n';

interface Device {
  id: string;
  price: string;
  image: string;
  color: 'brand' | 'flow' | 'action';
  specCount: number;
}

// Product names ("POS Flow Flex", etc.) stay as-is across languages —
// proper nouns for real SKUs, same convention as most hardware brands.
// Everything else (description, specs, "best for") is looked up via
// hardware.device.<id>.* translation keys.
const DEVICES: Device[] = [
  { id: 'flex', price: '$749', image: '📱', color: 'flow', specCount: 6 },
  { id: 'mini', price: '$1,349', image: '💳', color: 'brand', specCount: 6 },
  { id: 'station', price: '$2,199', image: '🖥️', color: 'action', specCount: 5 },
  { id: 'reader', price: '$199', image: '💰', color: 'flow', specCount: 6 },
];

const COMPARE_ROWS = [
  { key: 'portable', flex: true, mini: false, station: false, reader: true },
  { key: 'touchscreen', flex: true, mini: true, station: true, reader: false },
  { key: 'printer', flex: false, mini: true, station: true, reader: false },
  { key: 'dualDisplay', flex: false, mini: false, station: true, reader: false },
  { key: 'multiUser', flex: false, mini: true, station: true, reader: false },
  { key: 'connectivity', flex: true, mini: true, station: true, reader: true },
  { key: 'battery', flex: true, mini: false, station: false, reader: false },
];

export function HardwarePage() {
  const { t } = useI18n();
  useDocumentMeta(t('hardware.metaTitle'), t('hardware.metaDesc'));
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

      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            {t('hardware.title')}
          </h1>
          <p className="text-xl text-white/90 mb-8">
            {t('hardware.subtitle')}
          </p>
          <Link
            to="/pricing"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-full hover:bg-gray-100 transition"
          >
            {t('hardware.viewPricing')}
          </Link>
        </div>
      </div>

      {/* Device Grid */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {DEVICES.map((device) => {
            const colorMap = {
              brand: 'from-brand-500 to-brand-600',
              flow: 'from-flow-500 to-flow-600',
              action: 'from-action-500 to-action-600'
            };
            const borderMap = {
              brand: 'border-brand-200 dark:border-brand-700',
              flow: 'border-flow-200 dark:border-flow-700',
              action: 'border-action-200 dark:border-action-700'
            };
            const deviceName = t(`hardware.device.${device.id}.name`);

            return (
              <div
                key={device.id}
                className={`border ${borderMap[device.color]} rounded-xl overflow-hidden bg-white dark:bg-ink-800 shadow-lg hover:shadow-xl transition`}
              >
                {/* Device Image Header */}
                <div className={`bg-gradient-to-r ${colorMap[device.color]} p-16 text-center`}>
                  <div className="text-6xl">{device.image}</div>
                </div>

                {/* Content */}
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">
                    {deviceName}
                  </h3>
                  <p className="text-ink-600 dark:text-ink-300 mb-4 text-sm">
                    {t(`hardware.device.${device.id}.description`)}
                  </p>

                  <div className="mb-6 pb-6 border-b border-ink-200 dark:border-ink-700">
                    <div className="text-3xl font-bold text-brand-600">
                      {device.price}
                      <span className="text-sm font-normal text-ink-500"> {t('hardware.plusMonthlyPlan')}</span>
                    </div>
                  </div>

                  {/* Specs */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-ink-900 dark:text-white mb-3">{t('hardware.keyFeatures')}</h4>
                    <ul className="space-y-2">
                      {Array.from({ length: device.specCount }, (_, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink-700 dark:text-ink-300">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          {t(`hardware.device.${device.id}.spec.${i}`)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Best For */}
                  <div className="mb-6 p-4 bg-ink-50 dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-700">
                    <p className="text-xs font-semibold text-ink-600 dark:text-ink-400 mb-1">{t('hardware.bestFor')}</p>
                    <p className="text-sm text-ink-900 dark:text-ink-50">
                      {t(`hardware.device.${device.id}.bestFor`)}
                    </p>
                  </div>

                  {/* CTA */}
                  <Link
                    to="/pricing"
                    className={`block text-center px-4 py-2 bg-gradient-to-r ${colorMap[device.color]} text-white font-semibold rounded-full hover:opacity-90 transition`}
                  >
                    {t('hardware.get')} {deviceName} <ArrowRight size={16} className="inline ml-2" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison Section */}
      <div className="bg-white dark:bg-ink-800 py-20 border-t border-ink-200 dark:border-ink-700">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-ink-900 dark:text-white">
            {t('hardware.compareTitle')}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 dark:border-ink-700">
                  <th className="text-left py-4 px-4 font-semibold">{t('hardware.compare.feature')}</th>
                  <th className="text-center py-4 px-4 font-semibold">{t('hardware.device.flex.name')}</th>
                  <th className="text-center py-4 px-4 font-semibold">{t('hardware.device.mini.name')}</th>
                  <th className="text-center py-4 px-4 font-semibold">{t('hardware.device.station.name')}</th>
                  <th className="text-center py-4 px-4 font-semibold">{t('hardware.device.reader.name')}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.key} className={i % 2 === 0 ? 'bg-brand-50/30 dark:bg-ink-900/30' : ''}>
                    <td className="py-3 px-4 font-medium text-ink-900 dark:text-ink-100">{t(`hardware.compare.${row.key}`)}</td>
                    <td className="text-center py-3 px-4">
                      {row.flex ? <Check size={20} className="mx-auto text-green-600" /> : '—'}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.mini ? <Check size={20} className="mx-auto text-green-600" /> : '—'}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.station ? <Check size={20} className="mx-auto text-green-600" /> : '—'}
                    </td>
                    <td className="text-center py-3 px-4">
                      {row.reader ? <Check size={20} className="mx-auto text-green-600" /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {t('hardware.ctaTitle')}
          </h2>
          <p className="text-white/90 mb-8">
            {t('hardware.ctaDesc')}
          </p>
          <Link
            to="/pricing"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-full hover:bg-gray-100 transition"
          >
            {t('hardware.ctaButton')}
          </Link>
        </div>
      </div>
    </div>
  );
}
