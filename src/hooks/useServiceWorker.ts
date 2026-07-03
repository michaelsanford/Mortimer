import { useEffect, useState } from 'react';

export type SwUpdateState = 'idle' | 'update-available';

/**
 * Registers the service worker (production only) and detects when a new SW
 * version is waiting to take over.
 *
 * Returns:
 *  - `updateState`: 'idle' normally, 'update-available' when a new SW is waiting.
 *  - `applyUpdate`: call this (e.g. from a banner button) to activate the new SW
 *    and reload the page.
 */
export function useServiceWorker(): {
  updateState: SwUpdateState;
  applyUpdate: () => void;
} {
  const [updateState, setUpdateState] = useState<SwUpdateState>('idle');
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Only register in production builds and if the browser supports SW
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const onUpdateFound = () => {
      const newWorker = registration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        // A new SW has installed and is now waiting — there is already an
        // active SW controlling the page (i.e. this is an update, not a
        // fresh install).
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          setWaitingWorker(newWorker);
          setUpdateState('update-available');
        }
      });
    };

    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        registration = reg;

        // Already has a waiting SW (page was refreshed while one was pending)
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          setUpdateState('update-available');
        }

        reg.addEventListener('updatefound', onUpdateFound);

        // Poll for updates every 60 s (catches long-lived sessions)
        const interval = setInterval(() => reg.update(), 60_000);

        return () => {
          clearInterval(interval);
          reg.removeEventListener('updatefound', onUpdateFound);
        };
      })
      .catch((err) =>
        console.error('[SW] Registration failed:', err)
      );
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) return;
    // Tell the waiting SW to skip waiting and become active
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    // Reload once the new SW has taken control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  };

  return { updateState, applyUpdate };
}
