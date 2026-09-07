/**
 * UI Mode Store
 *
 * The app ships two surfaces over one engine:
 *
 *   'play' - the default. Four tools, sixteen colours, six effects, one navigator.
 *   'pro'  - everything: the full 83-button dock, the colour studio, the converter.
 *
 * Nothing about the engine changes between them; only what is rendered. The flag
 * lives here rather than in App state because Toolbar already takes ~70 props and
 * threading a 71st through every panel would be worse than a module-level signal.
 *
 * Same tiny synchronous pub/sub as telemetryStore.ts: components that care
 * subscribe with useSyncExternalStore, nothing above them re-renders.
 */

import { useSyncExternalStore } from 'react';

export type UiMode = 'pro';

const MODE_KEY = 'remix3d.uiMode';
const ONBOARDED_KEY = 'remix3d.hasOnboarded';

type Listener = () => void;

/**
 * localStorage is not always reachable: private browsing can deny it or throw
 * on write, and some mobile webviews throw on read. Every access
 * is wrapped so a storage failure degrades to the default instead of a white screen.
 */
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Non-persistent session. The in-memory value still works for this run. */
  }
}

function notify(listeners: Set<Listener>): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.warn('UI mode listener error:', e);
    }
  }
}

// --- Mode (Studio Shell) ------------------------------------------------

export function getUiMode(): UiMode {
  return 'pro';
}

/** Reactive read. Maintained for Option3SphereNavigator gizmo compatibility */
export function useUiMode(): UiMode {
  return 'pro';
}

// --- First run / Onboarding ---------------------------------------------

let hasOnboarded: boolean = readStored(ONBOARDED_KEY) !== 'false';
const onboardedListeners = new Set<Listener>();

export function getHasOnboarded(): boolean {
  return hasOnboarded;
}

export function setHasOnboarded(value: boolean): void {
  if (hasOnboarded === value) return;
  hasOnboarded = value;
  writeStored(ONBOARDED_KEY, String(value));
  notify(onboardedListeners);
}

export function subscribeHasOnboarded(listener: Listener): () => void {
  onboardedListeners.add(listener);
  return () => {
    onboardedListeners.delete(listener);
  };
}

export function useHasOnboarded(): boolean {
  return useSyncExternalStore(subscribeHasOnboarded, getHasOnboarded, getHasOnboarded);
}
