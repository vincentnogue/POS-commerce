import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'POS Flow — Gestion commerciale',
        short_name: 'POS Flow',
        description: "La plateforme de gestion commerciale conçue pour les réalités du terrain africain, prête pour le monde entier.",
        theme_color: '#1a6b4d',
        background_color: '#EAF3EE',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell + static assets for instant reloads and basic
        // offline resilience. Deliberately NOT caching Supabase API calls —
        // stale POS/inventory data offline would be actively dangerous
        // (oversell risk), so those always go to the network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && !url.pathname.startsWith('/api'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'app-shell' },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        // Vendor code split out of the app's own chunks. This doesn't
        // shrink the total bytes a first-time visitor downloads (the
        // libraries below are genuinely used — framer-motion in
        // particular is pulled in by App.tsx/ui.tsx/Sidebar.tsx/
        // CookieBanner.tsx, all loaded on every single page including
        // an anonymous landing-page visit), but it fixes what the
        // "chunk larger than 500kB" build warning was actually pointing
        // at: everything was landing in one undifferentiated ~780kB
        // entry chunk. Splitting by vendor:
        // - lets returning visitors get a full cache hit on
        //   react-vendor/motion-vendor/supabase-vendor across
        //   deployments where only app code (not these libraries)
        //   changed — those chunks are usually the least likely to
        //   change release to release;
        // - lets the browser fetch these chunks in parallel instead of
        //   one large sequential blob;
        // - keeps future dependency bumps (e.g. upgrading recharts)
        //   from invalidating the cache for React itself.
        // Actually trimming framer-motion out of the always-loaded path
        // would need touching the 10+ files that import it directly —
        // a real behavior-risk change, deliberately left alone here.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'motion-vendor': ['framer-motion'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'charts-vendor': ['recharts'],
        },
      },
    },
  },
});
