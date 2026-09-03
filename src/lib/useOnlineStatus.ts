import { useEffect, useState } from 'react';

// navigator.onLine only reflects actual network-adapter state (Wi-Fi/
// ethernet up or down) — it can still report `true` with no real path to
// the internet (e.g. connected to a router with no upstream). It's a
// reasonable, zero-dependency signal for "definitely offline" though,
// which is what the POS offline queue needs: the sale insert itself will
// fail on its own if `true` turns out to be wrong, same as before this
// existed.
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
