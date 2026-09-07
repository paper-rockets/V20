// src/registerServiceWorker.ts

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

export function registerPWA() {
  if (typeof window === 'undefined') return;

  // 1. Capture beforeinstallprompt for custom install UI
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener(true));
    console.log('[PWA] beforeinstallprompt captured, ready for install.');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
    console.log('[PWA] Application successfully installed!');
  });

  // 2. Register service worker in production / modern environments
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = './sw.js';
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);

          // Check for updates
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (!installingWorker) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[PWA] New content available; please refresh.');
                } else {
                  console.log('[PWA] Content is cached for offline use.');
                }
              }
            };
          };
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }
}

/**
 * Checks if the PWA can currently be prompted for installation.
 */
export function canInstallPWA(): boolean {
  return deferredPrompt !== null;
}

/**
 * Prompts user to install the application as a PWA.
 */
export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    return 'unavailable';
  }

  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
    return choice.outcome;
  } catch (err) {
    console.warn('[PWA] Install prompt failed:', err);
    return 'unavailable';
  }
}

/**
 * Subscribes to changes in install availability.
 */
export function subscribeInstallAvailability(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(canInstallPWA());

  return () => {
    installListeners.delete(callback);
  };
}
