import * as Sentry from '@sentry/react';

// Error tracking — this app had NONE before: a production error was
// invisible until a merchant reported it themselves, on a system that
// handles real money and real inventory.
//
// The DSN below is safe to commit: unlike an API secret key, a Sentry DSN
// is meant to be public — it's shipped in every client bundle by design
// for every Sentry web SDK, and it only lets events be sent IN, never
// read back out. VITE_SENTRY_DSN can still override it per environment
// (e.g. to point a staging build at a different Sentry project) without
// a code change, same pattern as VITE_SUPABASE_URL elsewhere in this
// codebase — the hardcoded value is just a working default so error
// tracking isn't silently off if that env var was never set on the
// hosting platform.
const DEFAULT_DSN = 'https://cf1e6a5a625c0d32ab9138e1ff4efada@o4512032831045632.ingest.de.sentry.io/4512032839172176';

// Only enabled in a production build: local development errors are
// noisy, expected, and not worth polluting a shared Sentry project with.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || DEFAULT_DSN;
  if (!import.meta.env.PROD) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Session replay / performance tracing are real added cost (extra
    // requests, extra bytes) for a benefit this app doesn't need yet —
    // just error capture, which is the actual gap. Left off deliberately
    // rather than turned on by default "because it's available".
    integrations: [],
    tracesSampleRate: 0,
  });
}
