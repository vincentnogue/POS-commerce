import * as Sentry from '@sentry/react';

// Wraps the whole app. Before this, an uncaught render error anywhere
// produced a blank white page with no way back except closing the tab —
// no error was ever recorded anywhere, and the person using the POS at
// the register had no idea what to do next.
//
// Deliberately does NOT use the app's own useI18n()/t() — this is the
// last-resort fallback for when something in the app tree (which
// includes I18nProvider) has already crashed, so it can't safely depend
// on that context existing. Two short, hardcoded lines (FR/EN) instead.
export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#EAF3EE',
          color: '#0D2C20',
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
            Something went wrong — Une erreur est survenue
          </h1>
          <p style={{ marginBottom: '24px', maxWidth: '480px', color: '#465047' }}>
            Please reload the page. If this keeps happening, contact support.
            <br />
            Veuillez recharger la page. Si le problème persiste, contactez le support.
          </p>
          <button
            onClick={() => { resetError(); window.location.reload(); }}
            style={{
              padding: '10px 24px',
              borderRadius: '9999px',
              background: '#2E8C66',
              color: 'white',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Reload — Recharger
          </button>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
