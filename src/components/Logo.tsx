import { Link } from 'react-router-dom';

export function Logo({ size = 'md', clickable = false }: { size?: 'sm' | 'md' | 'lg'; clickable?: boolean }) {
  const sizes = {
    sm: { container: 'w-6 h-6', text: 'text-base' },
    md: { container: 'w-8 h-8', text: 'text-lg' },
    lg: { container: 'w-10 h-10', text: 'text-2xl' },
  };
  const s = sizes[size];
  const content = (
    <div className="flex items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <img 
          src="/logo-pos-icon.png" 
          alt="POS Flow" 
          className={`${s.container} rounded-lg`}
        />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-action-500 ring-2 ring-white" />
      </div>
      <span className={`tracking-tight text-ink-900 dark:text-ink-50 ${s.text}`}>
        <span className="font-bold">POS</span> <span className="font-medium text-gradient-flow">Flow</span>
      </span>
    </div>
  );
  if (clickable) {
    return <Link to="/">{content}</Link>;
  }
  return content;
}
