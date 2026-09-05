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
//
// Extended for blog posts (og/image/url) — these were previously frozen
// to the site's generic homepage OG tags for every URL, meaning sharing
// a specific /blog/:slug link on WhatsApp/Twitter/LinkedIn always showed
// the homepage's title/description/image instead of that article's own.
export function useDocumentMeta(title: string, description?: string, options?: { image?: string; url?: string; type?: string }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const restoreFns: Array<() => void> = [];

    const setMeta = (selector: string, attr: 'content', value: string) => {
      const el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) return;
      const previous = el.getAttribute(attr);
      el.setAttribute(attr, value);
      restoreFns.push(() => { if (previous !== null) el.setAttribute(attr, previous); });
    };

    if (description) {
      setMeta('meta[name="description"]', 'content', description);
      setMeta('meta[property="og:description"]', 'content', description);
      setMeta('meta[name="twitter:description"]', 'content', description);
    }
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[name="twitter:title"]', 'content', title);
    if (options?.image) {
      setMeta('meta[property="og:image"]', 'content', options.image);
      setMeta('meta[name="twitter:image"]', 'content', options.image);
    }
    if (options?.url) setMeta('meta[property="og:url"]', 'content', options.url);
    if (options?.type) setMeta('meta[property="og:type"]', 'content', options.type);

    return () => {
      document.title = previousTitle;
      restoreFns.forEach((fn) => fn());
    };
  }, [title, description, options?.image, options?.url, options?.type]);
}
