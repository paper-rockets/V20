/**
 * First-run onboarding store.
 *
 * This uses the same tiny synchronous pub/sub pattern as telemetryStore.ts, so
 * subscribers update without pushing onboarding state through the app shell.
 */

import { useSyncExternalStore } from 'react';

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
      console.warn('Onboarding listener error:', e);
    }
  }
}

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
