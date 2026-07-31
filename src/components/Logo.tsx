import { Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Logo({ size = 'md', clickable = false }: { size?: 'sm' | 'md' | 'lg'; clickable?: boolean }) {
  const sizes = {
    sm: { icon: 18, text: 'text-base' },
    md: { icon: 22, text: 'text-lg' },
    lg: { icon: 28, text: 'text-2xl' },
  };
  const s = sizes[size];
  const content = (
    <div className="flex items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <div className="inline-flex items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/25 text-brand-600">
          <Globe size={s.icon} strokeWidth={2.2} />
        </div>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-action-500 ring-2 ring-white" />
      </div>
      <span className={`font-medium tracking-tight text-ink-900 dark:text-ink-50 ${s.text}`}>
        POS <span className="text-gradient-flow">Flow</span>
      </span>
    </div>
  );
  if (clickable) {
    return <Link to="/">{content}</Link>;
  }
  return content;
}
