import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface FeaturedProvider {
  provider_key: string;
  provider_name: string;
  logo_url: string | null;
}

/**
 * Auto-scrolling banner of the platform's real, already-connectable
 * integrations — pulled live from `integration_providers` (the same table
 * that powers the Marketplace page), filtered to `is_featured` and
 * `is_active`. This intentionally does NOT hardcode brand names: it only
 * ever shows partners this product genuinely offers today, so the list
 * can never drift out of sync with what Marketplace actually lists (and
 * never grows to include names that were only ever a mockup).
 */
export function IntegrationsMarquee({ title }: { title: string }) {
  const [providers, setProviders] = useState<FeaturedProvider[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('integration_providers')
      .select('provider_key, provider_name, logo_url')
      .eq('is_featured', true)
      .eq('is_active', true)
      .order('provider_name')
      .then(({ data }) => {
        if (!cancelled && data) setProviders(data as FeaturedProvider[]);
      });
    return () => { cancelled = true; };
  }, []);

  if (providers.length === 0) return null;

  const loop = [...providers, ...providers];

  return (
    <div className="py-10 border-y border-gray-200 dark:border-ink-800 bg-white dark:bg-ink-900">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-8">
        {title}
      </p>
      <div
        className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        role="list"
        aria-label={title}
      >
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
          {loop.map((p, i) => (
            <div
              key={`${p.provider_key}-${i}`}
              role="listitem"
              className="flex shrink-0 items-center gap-3 h-16 min-w-[170px] px-6 rounded-2xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-950 shadow-sm"
            >
              {p.logo_url && (
                <img src={p.logo_url} alt="" loading="lazy" className="h-6 w-6 object-contain" aria-hidden="true" />
              )}
              <span className="text-sm font-semibold text-ink-700 dark:text-ink-200 whitespace-nowrap">
                {p.provider_name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
