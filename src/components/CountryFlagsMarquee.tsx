import { COUNTRIES } from '../lib/countries';

/**
 * Horizontally auto-scrolling banner of real country flags — actual flag
 * images (flagcdn.com, the same public flag-image CDN used across the
 * industry, one static PNG per ISO code, no key/auth needed) shown as
 * circular badges, not Unicode emoji. Emoji flags render inconsistently
 * across OS/browsers (some show only letter codes), so real images read
 * as genuine flags everywhere. Runs at a slower, calmer pace
 * (.animate-marquee-slow) than the shorter logo marquees elsewhere on the
 * page. Used under the pricing tables to back up the "works for merchants
 * worldwide" framing with an honest, concrete list rather than a vague claim.
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
        <div className="flex w-max animate-marquee-slow gap-5 hover:[animation-play-state:paused]">
          {loop.map((c, i) => (
            <div
              key={`${c.code}-${i}`}
              role="listitem"
              title={lang === 'fr' ? c.fr : c.en}
              className="shrink-0 h-14 w-14 rounded-full overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10 bg-gray-100 dark:bg-ink-800"
            >
              <img
                src={`https://flagcdn.com/w160/${c.code.toLowerCase()}.png`}
                alt={lang === 'fr' ? c.fr : c.en}
                loading="lazy"
                width={160}
                height={160}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
