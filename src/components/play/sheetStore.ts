/**
 * Play-mode sheet coordinator.
 *
 * The zone law allows exactly one bottom sheet open at a time — opening one closes
 * any other. That is a single global fact, not per-component state, so it lives in
 * the same tiny pub/sub as uiModeStore rather than a React context that would
 * re-render the whole Play tree on every open and close.
 */

import { useSyncExternalStore } from 'react';

/** Pro-mode rail modes. Each corresponds to one contextual panel. */
export type ProMode = 'select' | 'draw' | 'create' | 'deform' | 'layers';

/** Every sheet or panel Play/Pro mode can raise. Add here, not as a loose string. */
export type SheetId = 'colour' | 'size' | 'fx' | 'brushes' | 'shapes' | 'settings' | ProMode | null;

type Listener = () => void;

let openSheet: SheetId = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.warn('Sheet listener error:', e);
    }
  }
}

export function getOpenSheet(): SheetId {
  return openSheet;
}

/** Opening a sheet implicitly closes whichever one was open. */
export function openSheetId(id: Exclude<SheetId, null>): void {
  if (openSheet === id) return;
  openSheet = id;
  notify();
}

export function closeSheet(): void {
  if (openSheet === null) return;
  openSheet = null;
  notify();
}

/** Tapping the button of an already-open sheet closes it. */
export function toggleSheet(id: Exclude<SheetId, null>): void {
  if (openSheet === id) closeSheet();
  else openSheetId(id);
}

export function subscribeSheet(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOpenSheet(): SheetId {
  return useSyncExternalStore(subscribeSheet, getOpenSheet, getOpenSheet);
}
