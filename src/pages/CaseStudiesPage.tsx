import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useDocumentMeta } from '../lib/useDocumentMeta';

// BUG FIX / INTEGRITY: this page used to display three fully fabricated
// case studies — invented company names, invented people ("Sarah
// Mitchell", "Marco Rossi", "Jessica Lee"), invented quotes attributed to
// them, and invented result percentages (+34% sales, -82% inventory
// errors...) — plus a stats block claiming "10,000+ Active Businesses",
// "$2.5B+ Annual Transactions", "4.8/5 Customer Rating" and "98% Uptime
// SLA", none of which are real numbers. This directly contradicted the
// deliberate honesty already enforced elsewhere in this codebase (see
// LandingPage.tsx: the real, verified "1,893+ active clients" figure,
// with an explicit comment recording that an earlier fabricated "1850+
// merchants" figure was removed for exactly this reason). Publishing
// invented customer names and quotes as real testimonials is also a
// real legal exposure (endorsement/advertising rules), not just an
// inconsistency.
//
// Fix: no invented companies, people, quotes, or stats. Only the real,
// already-verified figures used elsewhere on the site, and an honest
// invitation for real customers to be featured — nothing here until an
// actual customer agrees to it.
export function CaseStudiesPage() {
  useDocumentMeta(
    'Case Studies — POS Flow',
    'Real, verified numbers on the merchants using POS Flow — and how to get your own business featured here.'
  );
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-50 dark:bg-ink-900">
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

      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            Case studies, coming soon
          </h1>
          <p className="text-xl text-white/90">
            We'd rather show real merchant stories than invented ones — here's where they'll go once we have some to share.
          </p>
        </div>
      </div>

      {/* Real, verified numbers only — same source as the landing page
          hero. No fabricated case studies to fill this space until a
          real customer agrees to be featured. */}
      <div className="bg-white dark:bg-ink-800 border-t border-b border-ink-200 dark:border-ink-700 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-ink-900 dark:text-white">
            The real numbers, today
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-brand-600 mb-2">1,893+</p>
              <p className="text-ink-600 dark:text-ink-300">Active clients worldwide</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-flow-600 mb-2">30+</p>
              <p className="text-ink-600 dark:text-ink-300">Currencies with live conversion</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-action-600 mb-2">9+</p>
              <p className="text-ink-600 dark:text-ink-300">Integrated payment processors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invitation to real customers, not a placeholder full of invented
          ones. */}
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 px-4 py-1.5 text-xs font-bold tracking-widest text-brand-600 dark:text-brand-300 mb-6">
          <Sparkles size={13} /> BE THE FIRST
        </span>
        <h2 className="text-3xl font-bold text-ink-900 dark:text-white mb-4">
          Using POS Flow for your business?
        </h2>
        <p className="text-lg text-ink-600 dark:text-ink-300 mb-8">
          We'd love to feature your real story here — with your name, your numbers, and your permission. No invented case studies, ever.
        </p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-8 py-3 bg-brand-500 text-white font-semibold rounded-full hover:bg-brand-600 transition"
        >
          Tell us your story <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
