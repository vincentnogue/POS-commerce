import { useEffect } from 'react';

// BUG FIX: this is a client-rendered SPA with no per-page title/meta
// management anywhere (confirmed: no react-helmet, no document.title
// assignment in any page file) — every single route shared the exact
// same <title> and meta description from index.html, meaning Google
// indexed /pricing, /about, /blog, /help, /contact etc. all under the
// identical title and snippet. That hurts both ranking (duplicate title
// tags across a site are a real, well-documented SEO problem) and
// click-through rate (search results all look the same).
//
// This sets document.title and the meta[name=description] tag on mount,
// per page. Search engine crawlers that execute JavaScript (Googlebot
// does) see the updated values by the time they render the page, which
// is the standard lightweight approach for client-rendered SPAs that
// don't have a server-rendering layer.
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let previousDescription: string | null = null;
    let metaEl: HTMLMetaElement | null = null;
    if (description) {
      metaEl = document.querySelector('meta[name="description"]');
      if (metaEl) {
        previousDescription = metaEl.getAttribute('content');
        metaEl.setAttribute('content', description);
      }
    }

    return () => {
      document.title = previousTitle;
      if (metaEl && previousDescription !== null) {
        metaEl.setAttribute('content', previousDescription);
      }
    };
  }, [title, description]);
}
