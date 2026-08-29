import { Link } from 'react-router-dom';
import { Heart, Clock, BarChart3, Users, ShoppingCart, Mail, ArrowRight, Check } from 'lucide-react';

interface AddOn {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  features: string[];
  icon: React.ReactNode;
  color: 'brand' | 'flow' | 'action';
}

const ADD_ONS: AddOn[] = [
  {
    id: 'loyalty',
    name: 'Loyalty & Rewards',
    category: 'Customer Engagement',
    description: 'Build customer loyalty with points, rewards, and exclusive offers',
    price: '$29/month',
    features: [
      'Points-based rewards program',
      'Tiered membership levels',
      'Birthday rewards',
      'Automatic point tracking',
      'Promotion scheduling',
      'Customer analytics'
    ],
    icon: <Heart size={32} className="text-pink-600" />,
    color: 'brand'
  },
  {
    id: 'scheduling',
    name: 'Staff Scheduling',
    category: 'Team Management',
    description: 'Manage shift scheduling, time tracking, and employee performance',
    price: '$49/month',
    features: [
      'Drag-and-drop scheduling',
      'Employee availability',
      'Shift swapping',
      'Time clock integration',
      'Labor cost tracking',
      'Performance analytics'
    ],
    icon: <Clock size={32} className="text-blue-600" />,
    color: 'flow'
  },
  {
    id: 'analytics',
    name: 'Advanced Analytics',
    category: 'Business Intelligence',
    description: 'Deep insights into sales, inventory, and customer behavior',
    price: '$79/month',
    features: [
      'Custom dashboards',
      'Real-time reporting',
      'Forecasting tools',
      'Trend analysis',
      'Export to Excel/PDF',
      'White-label reports'
    ],
    icon: <BarChart3 size={32} className="text-green-600" />,
    color: 'action'
  },
  {
    id: 'crm',
    name: 'Customer Relationship',
    category: 'Sales & Marketing',
    description: 'Manage customer relationships and marketing campaigns',
    price: '$39/month',
    features: [
      'Customer database',
      'Purchase history',
      'Email campaigns',
      'SMS marketing',
      'Customer segmentation',
      'Campaign tracking'
    ],
    icon: <Users size={32} className="text-purple-600" />,
    color: 'brand'
  },
  {
    id: 'inventory',
    name: 'Advanced Inventory',
    category: 'Operations',
    description: 'Sophisticated inventory management with forecasting and auto-reorder',
    price: '$59/month',
    features: [
      'Real-time stock levels',
      'Multi-location inventory',
      'Barcode scanning',
      'Automatic reordering',
      'Supplier management',
      'SKU optimization'
    ],
    icon: <ShoppingCart size={32} className="text-orange-600" />,
    color: 'flow'
  },
  {
    id: 'marketing',
    name: 'Email & SMS Marketing',
    category: 'Marketing Automation',
    description: 'Automate customer communications and marketing campaigns',
    price: '$49/month',
    features: [
      'Email templates',
      'SMS broadcasts',
      'Automated workflows',
      'A/B testing',
      'Delivery tracking',
      'Integration with loyalty'
    ],
    icon: <Mail size={32} className="text-red-600" />,
    color: 'action'
  },
];

export function AddOnsPage() {
  return (
    <div className="min-h-screen bg-brand-50 dark:bg-ink-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            Extend Your POS Flow
          </h1>
          <p className="text-xl text-white/90 mb-8">
            Add powerful features with our modular add-ons. Start with what you need, add more as you grow.
          </p>
          <Link
            to="/pricing"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            View Bundle Packages
          </Link>
        </div>
      </div>

      {/* Add-ons Grid */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ADD_ONS.map((addon) => {
            const colorMap = {
              brand: 'border-brand-200 dark:border-brand-700',
              flow: 'border-flow-200 dark:border-flow-700',
              action: 'border-action-200 dark:border-action-700'
            };
            const bgMap = {
              brand: 'bg-brand-50 dark:bg-brand-900/20',
              flow: 'bg-flow-50 dark:bg-flow-900/20',
              action: 'bg-action-50 dark:bg-action-900/20'
            };

            return (
              <div
                key={addon.id}
                className={`border ${colorMap[addon.color]} rounded-xl overflow-hidden bg-white dark:bg-ink-800 shadow-lg hover:shadow-xl transition`}
              >
                {/* Header */}
                <div className={`p-8 ${bgMap[addon.color]}`}>
                  <div className="mb-4">{addon.icon}</div>
                  <h3 className="text-xl font-bold text-ink-900 dark:text-white mb-2">
                    {addon.name}
                  </h3>
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-3">
                    {addon.category}
                  </p>
                  <p className="text-sm text-ink-700 dark:text-ink-300">
                    {addon.description}
                  </p>
                </div>

                {/* Price */}
                <div className="border-t border-ink-200 dark:border-ink-700 p-8">
                  <p className="text-2xl font-bold text-ink-900 dark:text-white mb-6">
                    {addon.price}
                  </p>

                  {/* Features */}
                  <div className="space-y-3 mb-8">
                    {addon.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-ink-700 dark:text-ink-300">
                        <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <Link
                    to="/pricing"
                    className="block text-center px-4 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition"
                  >
                    Add to Plan
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bundle Section */}
      <div className="bg-white dark:bg-ink-800 border-t border-ink-200 dark:border-ink-700 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-ink-900 dark:text-white">
            Popular Bundles
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Growth Bundle',
                price: '$99/month',
                addons: ['Loyalty & Rewards', 'Email & SMS Marketing', 'Staff Scheduling'],
                color: 'brand'
              },
              {
                name: 'Pro Bundle',
                price: '$199/month',
                addons: ['All Growth Bundle', 'Advanced Analytics', 'Advanced Inventory'],
                color: 'flow',
                badge: 'Most Popular'
              },
              {
                name: 'Enterprise Bundle',
                price: 'Custom Pricing',
                addons: ['All Pro Bundle', 'Customer Relationship', 'Priority Support'],
                color: 'action'
              }
            ].map((bundle, idx) => (
              <div
                key={idx}
                className={`rounded-xl p-8 border-2 ${
                  bundle.color === 'brand'
                    ? 'border-brand-300 bg-brand-50 dark:bg-brand-900/20'
                    : bundle.color === 'flow'
                    ? 'border-flow-300 bg-flow-50 dark:bg-flow-900/20'
                    : 'border-action-300 bg-action-50 dark:bg-action-900/20'
                }`}
              >
                {bundle.badge && (
                  <div className="inline-block px-3 py-1 bg-brand-600 text-white text-xs font-bold rounded-full mb-4">
                    {bundle.badge}
                  </div>
                )}
                <h3 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">
                  {bundle.name}
                </h3>
                <p className="text-3xl font-bold text-brand-600 mb-6">
                  {bundle.price}
                </p>
                <ul className="space-y-3 mb-8">
                  {bundle.addons.map((addon, i) => (
                    <li key={i} className="flex items-center gap-2 text-ink-700 dark:text-ink-300">
                      <Check size={16} className="text-green-600" />
                      {addon}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="block text-center px-6 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition"
                >
                  Choose Bundle
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Small, Scale Big
          </h2>
          <p className="text-white/90 mb-8">
            Add only what you need. Upgrade or downgrade your add-ons anytime.
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Start Your Free Trial <ArrowRight size={16} className="inline ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
}
