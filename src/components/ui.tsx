import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export function StatCard({
  label, value, icon: Icon, tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: 'brand' | 'flow' | 'action' | 'warning' | 'error' | 'success';
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-100 dark:bg-brand-900/35 text-brand-700',
    flow: 'bg-flow-100 dark:bg-flow-900/35 text-flow-700',
    action: 'bg-action-100 dark:bg-action-900/35 text-action-600',
    warning: 'bg-warning-100 dark:bg-warning-900/35 text-warning-600',
    error: 'bg-error-100 dark:bg-error-900/35 text-error-600',
    success: 'bg-success-100 dark:bg-success-900/35 text-success-700',
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
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
      <p className="mt-1 text-2xl font-medium text-ink-900 dark:text-ink-50">{value}</p>
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
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
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
    <div className="flex flex-col items-center justify-center rounded-2xl2 border border-dashed border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-6 py-16 text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/25 text-brand-500">
        <Icon size={26} />
      </div>
      <h3 className="text-lg font-medium text-ink-900 dark:text-ink-50">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">{description}</p>}
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
    neutral: 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200',
    brand: 'bg-brand-100 dark:bg-brand-900/35 text-brand-700',
    action: 'bg-action-100 dark:bg-action-900/35 text-action-600',
    success: 'bg-success-100 dark:bg-success-900/35 text-success-700',
    warning: 'bg-warning-100 dark:bg-warning-900/35 text-warning-600',
    error: 'bg-error-100 dark:bg-error-900/35 text-error-600',
    flow: 'bg-flow-100 dark:bg-flow-900/35 text-flow-700',
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
        className={`relative w-full ${maxWidth} rounded-2xl2 bg-white dark:bg-ink-800 p-6 shadow-float`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink-900 dark:text-ink-50">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-ink-400 dark:text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-700 dark:text-ink-200">✕</button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 dark:border-brand-900 border-t-brand-500 dark:border-t-brand-400" />
        <p className="text-sm font-medium text-ink-600 dark:text-ink-300">Loading...</p>
      </div>
    </div>
  );
}

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<{ toast: (tone: ToastTone, message: string) => void } | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const icons: Record<ToastTone, typeof CheckCircle> = { success: CheckCircle, error: AlertCircle, info: Info };
  const tones: Record<ToastTone, string> = {
    success: 'border-success-200 bg-success-50 dark:bg-success-900/25 text-success-800',
    error: 'border-error-200 bg-error-50 dark:bg-error-900/25 text-error-800',
    info: 'border-brand-200 bg-brand-50 dark:bg-brand-900/25 text-brand-800',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.tone];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-float ${tones[t.tone]}`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="text-sm font-medium">{t.message}</span>
                <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="ml-2 opacity-60 hover:opacity-100">
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ 
  variant = 'default', 
  size = 'md', 
  className = '', 
  ...props 
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    default: 'bg-flow-600 text-white hover:bg-flow-700 border border-flow-600',
    outline: 'bg-transparent text-ink-200 hover:bg-ink-900/50 border border-ink-700 hover:border-ink-600',
    ghost: 'bg-transparent text-ink-300 hover:bg-ink-900/30 border border-transparent',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
