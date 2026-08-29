import { COUNTRIES, flagEmoji } from '../lib/countries';

/**
 * Horizontally auto-scrolling banner of real country flags (native Unicode
 * flag emoji — the browser/OS renders the actual flag for each ISO code,
 * so there are no logo images to source, host, or license). Used under the
 * pricing tables to back up the "works for merchants worldwide" framing
 * with an honest, concrete list rather than a vague claim.
 *
 * The list is duplicated once so the CSS marquee can loop seamlessly at
 * -50% translateX with no visible seam.
 */
export function CountryFlagsMarquee({ title, lang }: { title: string; lang: 'fr' | 'en' }) {
  const loop = [...COUNTRIES, ...COUNTRIES];

  return (
    <div className="py-14">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-8">
        {title}
      </p>
      <div
        className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        role="list"
        aria-label={title}
      >
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
          {loop.map((c, i) => (
            <div
              key={`${c.code}-${i}`}
              role="listitem"
              className="flex shrink-0 items-center gap-2 rounded-full border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-4 py-2 shadow-sm"
            >
              <span className="text-xl leading-none" aria-hidden="true">{flagEmoji(c.code)}</span>
              <span className="text-sm font-medium text-ink-700 dark:text-ink-200 whitespace-nowrap">
                {lang === 'fr' ? c.fr : c.en}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
