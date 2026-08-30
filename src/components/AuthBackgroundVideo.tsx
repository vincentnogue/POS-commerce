import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// PRODUCT REQUEST: the auth screens' left panel was a flat gradient.
// Product asked for a background video of a "satisfied shopping
// experience". We can't hotlink a third-party stock video into a
// commercial product's auth screen without an actual license for it, so
// this wires up the real <video> element (autoplay/loop/muted/playsInline
// so it also works on mobile Safari, and it's skipped entirely under
// prefers-reduced-motion) pointed at a local, self-hosted path. Drop a
// licensed video file at public/videos/shopping-experience.mp4 (and a
// matching poster frame at public/videos/shopping-experience.jpg) and it
// will play automatically — nothing else to wire up. Until that file
// exists, the <video> simply has nothing to play and the animated
// gradient below shows through as a graceful fallback, so the page never
// shows a broken/missing-media state.
const AUTH_BG_VIDEO_SRC = '/videos/shopping-experience.mp4';
const AUTH_BG_VIDEO_POSTER = '/videos/shopping-experience.jpg';

export function AuthBackgroundVideo() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <>
      {/* Animated gradient fallback — always rendered behind the video so
          there's no flash of empty background while the video loads, and
          it's what's visible until a real video file is added. */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-brand-600 to-flow-600"
        animate={reducedMotion ? {} : { backgroundPosition: ['0% 0%', '100% 100%'] }}
        transition={{ duration: 12, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        style={{ backgroundSize: '200% 200%' }}
      />
      {!reducedMotion && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={AUTH_BG_VIDEO_SRC}
          poster={AUTH_BG_VIDEO_POSTER}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      {/* Dark overlay so the logo/headline stay legible over any footage */}
      <div className="absolute inset-0 bg-ink-900/55" />
    </>
  );
}
