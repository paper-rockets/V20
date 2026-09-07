import { useEffect, useRef, RefObject } from 'react';

export interface UseDismissibleSurfaceOptions {
  isOpen: boolean;
  onClose: () => void;
  surfaceRef: RefObject<HTMLElement | null>;
  triggerRef?: RefObject<HTMLElement | null>;
  /**
   * When true (default), clicking on a canvas element outside the surface closes the surface
   * and prevents the event from starting a drawing stroke.
   */
  suppressCanvasClick?: boolean;
  /**
   * If true (default), pressing the Escape key will close the surface.
   */
  closeOnEscape?: boolean;
}

/**
 * Reusable hook for floating panels, popovers, sheets, and dialogs.
 * 
 * Provides:
 * - Outside pointer dismissal
 * - Escape key dismissal with focus restoration to opener
 * - Protection against dismissal when pointer is inside surface
 * - Suppression of the initial canvas pointerdown that closes the surface (prevents drawing a dot)
 * - Safe listener cleanup on unmount
 */
export function useDismissibleSurface({
  isOpen,
  onClose,
  surfaceRef,
  triggerRef,
  suppressCanvasClick = true,
  closeOnEscape = true,
}: UseDismissibleSurfaceOptions): void {
  const openerRef = useRef<HTMLElement | null>(null);

  // Store active element when opening to restore focus on close
  useEffect(() => {
    if (isOpen) {
      openerRef.current = (triggerRef?.current || document.activeElement) as HTMLElement | null;
    }
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;

    // Use capture phase to intercept outside clicks before they reach canvas stroke handlers
    const handlePointerDownCapture = (event: PointerEvent) => {
      const surface = surfaceRef.current;
      if (!surface) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Click inside surface -> do not dismiss
      if (surface === target || surface.contains(target)) {
        return;
      }

      // Click on opener trigger button -> let the button toggle naturally
      if (triggerRef?.current && (triggerRef.current === target || triggerRef.current.contains(target))) {
        return;
      }

      // Check if target is a canvas or viewport surface
      const isCanvas = target.tagName === 'CANVAS' || !!target.closest('canvas');

      if (suppressCanvasClick && isCanvas) {
        // Stop canvas from processing pointerdown so it doesn't paint a dot or start an accidental stroke
        event.stopPropagation();
        event.preventDefault();
      }

      onClose();

      // Restore focus if appropriate
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!closeOnEscape) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        onClose();

        if (openerRef.current && typeof openerRef.current.focus === 'function') {
          openerRef.current.focus();
        }
      }
    };

    window.addEventListener('pointerdown', handlePointerDownCapture, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDownCapture, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, surfaceRef, triggerRef, suppressCanvasClick, closeOnEscape]);
}
