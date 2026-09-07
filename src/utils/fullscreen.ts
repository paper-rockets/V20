// src/utils/fullscreen.ts

// Cross-browser document fullscreen element types
interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  mozRequestFullScreen?: (options?: FullscreenOptions) => Promise<void>;
  msRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
}

/**
 * Checks if the document is currently in browser Fullscreen mode
 * or running in standalone PWA / iOS full-screen mode.
 */
export function isFullscreen(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const doc = document as FullscreenDocument;
  const isDocFs = !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );

  return isDocFs;
}

/**
 * Checks if the web app is running in installed PWA standalone / fullscreen display mode.
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari standalone flag
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return isStandalone;
}

/**
 * Requests full screen on the given element (or document.documentElement by default).
 */
export async function enterFullscreen(element?: HTMLElement): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const target = (element || document.documentElement) as FullscreenElement;

  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen();
      return true;
    } else if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
      return true;
    } else if (target.mozRequestFullScreen) {
      await target.mozRequestFullScreen();
      return true;
    } else if (target.msRequestFullscreen) {
      await target.msRequestFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('[Fullscreen] Request failed:', err);
  }

  return false;
}

/**
 * Exits browser Fullscreen mode.
 */
export async function exitFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const doc = document as FullscreenDocument;

  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
      return true;
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return true;
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
      return true;
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('[Fullscreen] Exit failed:', err);
  }

  return false;
}

/**
 * Toggles fullscreen on and off.
 */
export async function toggleFullscreen(element?: HTMLElement): Promise<boolean> {
  if (isFullscreen()) {
    await exitFullscreen();
    return false;
  } else {
    return await enterFullscreen(element);
  }
}

/**
 * Subscribes to full screen changes across standard and vendor prefixes.
 */
export function subscribeFullscreenChange(callback: (active: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = () => {
    callback(isFullscreen());
  };

  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}
