import { Link } from 'react-router-dom';
import { Smartphone, Monitor, Wifi, Battery, Check, ArrowRight, ShoppingCart } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface Device {
  id: string;
  name: string;
  description: string;
  price: string;
  specs: string[];
  image: string;
  best_for: string;
  color: 'brand' | 'flow' | 'action';
}

const DEVICES: Device[] = [
  {
    id: 'flex',
    name: 'POS Flow Flex',
    description: 'Portable, handheld terminal for mobile-first businesses',
    price: '$749',
    specs: [
      '7" touchscreen display',
      'Built-in payment reader',
      '4G + WiFi + Bluetooth',
      'All-day battery life',
      'Rugged design',
      'IP54 water-resistant'
    ],
    image: '📱',
    best_for: 'Field service, delivery, food trucks, outdoor retail',
    color: 'flow'
  },
  {
    id: 'mini',
    name: 'POS Flow Mini',
    description: 'Compact countertop terminal with built-in printer',
    price: '$1,349',
    specs: [
      '7" HD touchscreen',
      'Built-in receipt printer',
      'Payment integration',
      'Compact footprint',
      'Cloud-connected',
      'Full app ecosystem'
    ],
    image: '💳',
    best_for: 'Small retail, boutiques, service counters, takeout',
    color: 'brand'
  },
  {
    id: 'station',
    name: 'POS Flow Station',
    description: 'Professional dual-screen POS for restaurants & retail',
    price: '$2,199',
    specs: [
      '14" merchant display (HD)',
      '8" customer-facing screen',
      'Industrial receipt printer',
      'Order management system',
      'Multi-terminal sync',
      'Advanced analytics'
    ],
    image: '🖥️',
    best_for: 'Full-service restaurants, high-volume retail, multi-station setup',
    color: 'action'
  },
  {
    id: 'reader',
    name: 'POS Flow Card Reader',
    description: 'Wireless mobile payment reader for on-the-go transactions',
    price: '$199',
    specs: [
      'Portable design',
      'Contactless + Chip + Swipe',
      'Works with any phone',
      'Real-time reporting',
      'No WiFi required',
      'Instant settlement'
    ],
    image: '💰',
    best_for: 'Startups, pop-ups, mobile professionals, markets',
    color: 'flow'
  }
];

export function HardwarePage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-ink-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            Professional Hardware for Every Business
          </h1>
          <p className="text-xl text-white/90 mb-8">
            From mobile readers to advanced multi-screen stations. All integrated with POS Flow.
          </p>
          <Link
            to="/pricing"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            View Pricing Plans
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
                    {device.name}
                  </h3>
                  <p className="text-ink-600 dark:text-ink-300 mb-4 text-sm">
                    {device.description}
                  </p>

                  <div className="mb-6 pb-6 border-b border-ink-200 dark:border-ink-700">
                    <div className="text-3xl font-bold text-brand-600">
                      {device.price}
                      <span className="text-sm font-normal text-ink-500"> + monthly plan</span>
                    </div>
                  </div>

                  {/* Specs */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-ink-900 dark:text-white mb-3">Key Features</h4>
                    <ul className="space-y-2">
                      {device.specs.map((spec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink-700 dark:text-ink-300">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          {spec}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Best For */}
                  <div className="mb-6 p-4 bg-ink-50 dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-700">
                    <p className="text-xs font-semibold text-ink-600 dark:text-ink-400 mb-1">BEST FOR</p>
                    <p className="text-sm text-ink-900 dark:text-ink-50">
                      {device.best_for}
                    </p>
                  </div>

                  {/* CTA */}
                  <Link
                    to="/pricing"
                    className={`block text-center px-4 py-2 bg-gradient-to-r ${colorMap[device.color]} text-white font-semibold rounded-lg hover:opacity-90 transition`}
                  >
                    Get {device.name} <ArrowRight size={16} className="inline ml-2" />
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
            Compare Devices
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 dark:border-ink-700">
                  <th className="text-left py-4 px-4 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold">Flex</th>
                  <th className="text-center py-4 px-4 font-semibold">Mini</th>
                  <th className="text-center py-4 px-4 font-semibold">Station</th>
                  <th className="text-center py-4 px-4 font-semibold">Reader</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Portable', flex: true, mini: false, station: false, reader: true },
                  { feature: 'Touchscreen', flex: true, mini: true, station: true, reader: false },
                  { feature: 'Receipt Printer', flex: false, mini: true, station: true, reader: false },
                  { feature: 'Dual Display', flex: false, mini: false, station: true, reader: false },
                  { feature: 'Multi-user', flex: false, mini: true, station: true, reader: false },
                  { feature: 'WiFi + 4G', flex: true, mini: true, station: true, reader: true },
                  { feature: 'All-day Battery', flex: true, mini: false, station: false, reader: false },
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-brand-50/30 dark:bg-ink-900/30' : ''}>
                    <td className="py-3 px-4 font-medium text-ink-900 dark:text-ink-100">{row.feature}</td>
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
            Ready to Upgrade Your Business?
          </h2>
          <p className="text-white/90 mb-8">
            Choose your hardware, select a plan, and start accepting payments in minutes.
          </p>
          <Link
            to="/pricing"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </div>
  );
}
