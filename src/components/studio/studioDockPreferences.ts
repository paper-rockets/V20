export type StudioDockPosition = 'auto' | 'left' | 'right';

export interface StudioDockPreferences {
  position: StudioDockPosition;
  autoHide: boolean;
}

const STORAGE_KEY = 'remix3d.studioDock';
export const STUDIO_DOCK_EVENT = 'remix3d:studio-dock-change';

export const DEFAULT_STUDIO_DOCK_PREFERENCES: StudioDockPreferences = {
  position: 'auto',
  autoHide: false,
};

export const readStudioDockPreferences = (): StudioDockPreferences => {
  if (typeof window === 'undefined') return DEFAULT_STUDIO_DOCK_PREFERENCES;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    const position: StudioDockPosition = ['auto', 'left', 'right'].includes(stored.position)
      ? stored.position
      : 'auto';
    return { position, autoHide: stored.autoHide === true };
  } catch {
    return DEFAULT_STUDIO_DOCK_PREFERENCES;
  }
};

export const writeStudioDockPreferences = (preferences: StudioDockPreferences): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {}
  window.dispatchEvent(new CustomEvent<StudioDockPreferences>(STUDIO_DOCK_EVENT, { detail: preferences }));
};
