import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, Check, ArrowRight, ArrowLeft } from 'lucide-react';

interface Industry {
  id: string;
  name: string;
  icon: string;
  description: string;
  challenges: string[];
  solutions: string[];
  features: string[];
  color: 'brand' | 'flow' | 'action';
  cta: string;
}

const INDUSTRIES: Industry[] = [
  {
    id: 'retail',
    name: 'Retail & Boutiques',
    icon: '/icon-shop-now.png',
    description: 'Streamline inventory, boost sales, and delight customers.',
    challenges: [
      'Managing multiple store locations',
      'Inventory visibility across stores',
      'Customer loyalty programs',
      'Multi-channel selling'
    ],
    solutions: [
      'Real-time inventory sync across all locations',
      'Customer loyalty and rewards programs',
      'Unified POS for online + offline sales',
      'Advanced analytics and reporting'
    ],
    features: [
      'Multi-store management',
      'Customer database with history',
      'Inventory tracking',
      'Sales analytics',
      'Mobile payment support',
      'eCommerce integration'
    ],
    color: 'brand',
    cta: 'Start Your Retail Plan'
  },
  {
    id: 'services',
    name: 'Salons, Spas & Services',
    icon: '/icon-scissors.png',
    description: 'Manage appointments, staff, and client relationships effortlessly.',
    challenges: [
      'Appointment scheduling conflicts',
      'Staff commission tracking',
      'Client retention',
      'Service package management'
    ],
    solutions: [
      'Appointment booking with reminders',
      'Staff management with commission tracking',
      'Client profiles with service history',
      'Service package and gift card management'
    ],
    features: [
      'Online appointment booking',
      'Staff scheduling',
      'Commission tracking',
      'Client history',
      'Gift card management',
      'SMS/Email reminders',
      'Performance analytics'
    ],
    color: 'action',
    cta: 'Start Your Service Plan'
  },
  {
    id: 'professional',
    name: 'Professional Services',
    icon: '/icon-professional-services.png',
    description: 'Handle client billing, project tracking, and professional reporting.',
    challenges: [
      'Project-based invoicing',
      'Time tracking',
      'Client expense management',
      'Professional reporting'
    ],
    solutions: [
      'Project-based POS system',
      'Built-in time tracking',
      'Expense management',
      'Professional invoice templates'
    ],
    features: [
      'Project management',
      'Time tracking',
      'Expense tracking',
      'Professional invoices',
      'Client portal',
      'Performance metrics',
      'Detailed reporting'
    ],
    color: 'brand',
    cta: 'Start Your Professional Plan'
  }
];

export function IndustrySolutionsPage() {
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
            <ArrowLeft size={18} /> Back
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            Solutions Built for Your Industry
          </h1>
          <p className="text-xl text-white/90">
            From retail to services to distribution. POS Flow adapts to your business.
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
                    <h2 className="text-3xl font-bold mb-4">{industry.name}</h2>
                    <p className="text-lg mb-6 text-white/95">{industry.description}</p>
                    <Link
                      to="/pricing"
                      className="inline-block px-6 py-3 bg-white text-brand-600 font-semibold rounded-full hover:bg-gray-100 transition w-fit"
                    >
                      {industry.cta} <ArrowRight size={16} className="inline ml-2" />
                    </Link>
                  </div>

                  {/* Right: Solutions & Features */}
                  <div>
                    <div className="mb-8">
                      <h3 className="font-bold text-ink-900 dark:text-white mb-4 text-lg">
                        Key Challenges We Solve
                      </h3>
                      <ul className="space-y-2">
                        {industry.challenges.map((challenge, i) => (
                          <li key={i} className="flex gap-2 text-sm text-ink-700 dark:text-ink-300">
                            <Check size={16} className="text-green-600 flex-shrink-0" />
                            {challenge}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-bold text-ink-900 dark:text-white mb-4 text-lg">
                        Our Solutions
                      </h3>
                      <ul className="space-y-2">
                        {industry.solutions.map((solution, i) => (
                          <li key={i} className="flex gap-2 text-sm text-ink-700 dark:text-ink-300">
                            <TrendingUp size={16} className="text-brand-600 flex-shrink-0" />
                            {solution}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Features List */}
                <div className="border-t border-ink-200 dark:border-ink-700 p-8 md:p-12 bg-white/50 dark:bg-ink-900/50">
                  <h3 className="font-bold text-ink-900 dark:text-white mb-6">Included Features</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {industry.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
                        <Check size={16} className="text-green-600 flex-shrink-0" />
                        {feature}
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
            Find Your Perfect Solution
          </h2>
          <p className="text-white/90 mb-8">
            Get started with a 14-day free trial. No credit card required.
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-full hover:bg-gray-100 transition"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </div>
  );
}
