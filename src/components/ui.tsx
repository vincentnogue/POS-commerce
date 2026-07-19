import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label, value, icon: Icon, tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: 'brand' | 'flow' | 'action' | 'warning' | 'error' | 'success';
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-100 text-brand-700',
    flow: 'bg-flow-100 text-flow-700',
    action: 'bg-action-100 text-action-600',
    warning: 'bg-warning-100 text-warning-600',
    error: 'bg-error-100 text-error-600',
    success: 'bg-success-100 text-success-700',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-5"
    >
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full ${tones[tone]}`}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-900">{value}</p>
    </motion.div>
  );
}

export function PageHeader({
  title, subtitle, action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Icon size={26} />
      </div>
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({
  children, tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'action' | 'success' | 'warning' | 'error' | 'flow';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-700',
    brand: 'bg-brand-100 text-brand-700',
    action: 'bg-action-100 text-action-600',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-600',
    error: 'bg-error-100 text-error-600',
    flow: 'bg-flow-100 text-flow-700',
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function Modal({
  open, onClose, title, children, maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`relative w-full ${maxWidth} rounded-2xl2 bg-white p-6 shadow-float`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">✕</button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
    </div>
  );
}
