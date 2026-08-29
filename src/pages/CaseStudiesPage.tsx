import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, Award, Users, BarChart3, ArrowRight, ArrowLeft } from 'lucide-react';

interface CaseStudy {
  id: string;
  company: string;
  industry: string;
  logo: string;
  challenge: string;
  solution: string;
  results: Array<{ metric: string; value: string; icon: React.ReactNode }>;
  testimonial: string;
  author: string;
  role: string;
  color: 'brand' | 'flow' | 'action';
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 1,
    company: 'The Brew Co.',
    industry: 'Coffee Shop Chain',
    logo: '☕',
    challenge: 'Managing 5 locations with inconsistent inventory and payment processing across different systems',
    solution: 'Implemented POS Flow with multi-store inventory sync and unified payment processing',
    results: [
      { metric: 'Sales Increase', value: '+34%', icon: <TrendingUp size={24} className="text-green-600" /> },
      { metric: 'Inventory Error', value: '-82%', icon: <Award size={24} className="text-green-600" /> },
      { metric: 'Customer Repeat', value: '+56%', icon: <Users size={24} className="text-green-600" /> },
    ],
    testimonial: 'POS Flow unified our operations across all 5 locations. We now have real-time inventory visibility and processing costs dropped by 18%.',
    author: 'Sarah Mitchell',
    role: 'Owner, The Brew Co.',
    color: 'brand'
  },
  {
    id: 2,
    company: 'Milano Restaurant Group',
    industry: 'Italian Restaurant',
    logo: '🍝',
    challenge: 'Kitchen inefficiencies causing order delays and customer complaints about wait times',
    solution: 'Deployed Kitchen Display System and table management features with staff scheduling',
    results: [
      { metric: 'Avg Order Time', value: '-28%', icon: <TrendingUp size={24} className="text-green-600" /> },
      { metric: 'Satisfaction', value: '+41%', icon: <Award size={24} className="text-green-600" /> },
      { metric: 'Revenue/Night', value: '+22%', icon: <BarChart3 size={24} className="text-green-600" /> },
    ],
    testimonial: 'The kitchen display system transformed our operations. Orders flow smoothly now, staff coordination is seamless, and customers notice the faster service.',
    author: 'Marco Rossi',
    role: 'General Manager, Milano Restaurant',
    color: 'flow'
  },
  {
    id: 3,
    company: 'Luxe Beauty Salon',
    industry: 'Salon & Spa',
    logo: '💅',
    challenge: 'Double-booking appointments, missed reminders, poor client retention tracking',
    solution: 'Integrated online booking, SMS reminders, and client loyalty program',
    results: [
      { metric: 'Booking Errors', value: '-100%', icon: <Award size={24} className="text-green-600" /> },
      { metric: 'No-shows', value: '-45%', icon: <Users size={24} className="text-green-600" /> },
      { metric: 'Client Retention', value: '+63%', icon: <TrendingUp size={24} className="text-green-600" /> },
    ],
    testimonial: 'Online booking eliminated our double-booking nightmare. SMS reminders cut no-shows in half, and our loyalty program has clients coming back weekly.',
    author: 'Jessica Lee',
    role: 'Salon Manager, Luxe Beauty',
    color: 'action'
  },
];

export function CaseStudiesPage() {
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
            Real Businesses. Real Results.
          </h1>
          <p className="text-xl text-white/90">
            See how POS Flow helped businesses like yours grow and streamline operations.
          </p>
        </div>
      </div>

      {/* Case Studies */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="space-y-16">
          {CASE_STUDIES.map((study) => {
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
                key={study.id}
                className={`border ${borderMap[study.color]} rounded-xl overflow-hidden bg-white dark:bg-ink-800 shadow-lg`}
              >
                {/* Header */}
                <div className={`bg-gradient-to-r ${colorMap[study.color]} p-8 text-white`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl">{study.logo}</div>
                    <div>
                      <h2 className="text-2xl font-bold">{study.company}</h2>
                      <p className="text-white/80">{study.industry}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8 md:p-12">
                  <div className="grid md:grid-cols-2 gap-12 mb-12">
                    {/* Challenge & Solution */}
                    <div>
                      <h3 className="text-xl font-bold text-ink-900 dark:text-white mb-3">
                        The Challenge
                      </h3>
                      <p className="text-ink-700 dark:text-ink-300 mb-8 leading-relaxed">
                        {study.challenge}
                      </p>

                      <h3 className="text-xl font-bold text-ink-900 dark:text-white mb-3">
                        Our Solution
                      </h3>
                      <p className="text-ink-700 dark:text-ink-300 leading-relaxed">
                        {study.solution}
                      </p>
                    </div>

                    {/* Results */}
                    <div className="bg-gradient-to-br from-brand-50 to-flow-50 dark:from-ink-900 dark:to-ink-800 p-8 rounded-lg border border-ink-200 dark:border-ink-700">
                      <h3 className="text-xl font-bold text-ink-900 dark:text-white mb-6">
                        The Results
                      </h3>
                      <div className="space-y-6">
                        {study.results.map((result, i) => (
                          <div key={i} className="flex items-center gap-4">
                            {result.icon}
                            <div>
                              <p className="text-3xl font-bold text-brand-600">
                                {result.value}
                              </p>
                              <p className="text-sm text-ink-600 dark:text-ink-400">
                                {result.metric}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Testimonial */}
                  <div className="border-t border-ink-200 dark:border-ink-700 pt-8">
                    <blockquote className="text-lg text-ink-700 dark:text-ink-300 italic mb-4">
                      "{study.testimonial}"
                    </blockquote>
                    <p className="font-semibold text-ink-900 dark:text-white">
                      {study.author}
                    </p>
                    <p className="text-sm text-ink-500">
                      {study.role}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white dark:bg-ink-800 border-t border-ink-200 dark:border-ink-700 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-ink-900 dark:text-white">
            Trusted by 10,000+ Businesses
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-brand-600 mb-2">10K+</p>
              <p className="text-ink-600 dark:text-ink-300">Active Businesses</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-flow-600 mb-2">$2.5B+</p>
              <p className="text-ink-600 dark:text-ink-300">Annual Transactions</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-action-600 mb-2">4.8/5</p>
              <p className="text-ink-600 dark:text-ink-300">Customer Rating</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-green-600 mb-2">98%</p>
              <p className="text-ink-600 dark:text-ink-300">Uptime SLA</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Write Your Success Story?
          </h2>
          <p className="text-white/90 mb-8">
            Join thousands of successful businesses using POS Flow.
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Start Free Trial <ArrowRight size={16} className="inline ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
}
