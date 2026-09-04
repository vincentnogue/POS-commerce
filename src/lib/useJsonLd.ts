import { useEffect } from 'react';

// Injects a page-specific <script type="application/ld+json"> tag (e.g.
// FAQPage schema built from real, already-visible page content) and
// removes it on unmount/navigation, so it never lingers and gets
// attributed to a different page. Complements the single site-wide
// SoftwareApplication schema in index.html, which can't hold per-page
// data like a page's actual FAQ content.
export function useJsonLd(data: object | null) {
  useEffect(() => {
    if (!data) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [data]);
}
