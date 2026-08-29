import { COUNTRIES } from '../lib/countries';

/**
 * Horizontally auto-scrolling banner of real country flags — circular flag
 * photos (flagcdn.com, the same free/public flag CDN used in the reference
 * design), not emoji or text pills. Matches the "flag-item" circles from
 * the supplied premium landing page exactly: a plain round flag image,
 * nothing else. Used to back up the "works for merchants worldwide"
 * framing with an honest, concrete list of real countries.
 *
 * The list is duplicated once so the CSS marquee can loop seamlessly at
 * -50% translateX with no visible seam.
 */
export function CountryFlagsMarquee({ title }: { title: string; lang?: 'fr' | 'en' }) {
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
        <div className="flex w-max animate-marquee gap-5 hover:[animation-play-state:paused]">
          {loop.map((c, i) => (
            <div
              key={`${c.code}-${i}`}
              role="listitem"
              title={c.en}
              className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white dark:border-ink-800 shadow-md bg-ink-100 dark:bg-ink-800"
            >
              <img
                src={`https://flagcdn.com/w160/${c.code.toLowerCase()}.png`}
                alt={c.en}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
