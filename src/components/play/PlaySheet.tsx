import React, { useEffect, useRef } from 'react';
import { SheetId, closeSheet, useOpenSheet } from './sheetStore';
import { StudioCloseButton } from '../common/StudioCloseButton';

/**
 * The one bottom-sheet primitive every Play popover uses.
 *
 * Zone law: sheets rise from the bottom edge only, never wider than the screen and
 * never taller than 40vh, so the canvas above stays visible and drawable. Touching
 * the canvas dismisses — a child should never have to find a close button.
 */

interface PlaySheetProps {
  id: Exclude<SheetId, null>;
  title: string;
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  /** Lists of settings need more room than a row of swatches. */
  tall?: boolean;
}

export const PlaySheet: React.FC<PlaySheetProps> = ({ id, title, children, theme = 'dark', tall = false }) => {
  const open = useOpenSheet() === id;
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape closes, and so does a pointer landing anywhere that is not this sheet.
  // The canvas is the common case, but tapping another zone should dismiss too.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || !sheetRef.current || sheetRef.current.contains(target)) return;

      closeSheet();

      // Dismissing a sheet must not also leave a mark. Without this, tapping the
      // canvas to put a menu away draws a dot exactly where you tapped — which is
      // baffling if you are seven. Swallow only canvas taps: taps on other chrome
      // (a tool button, the top strip) should still do the thing you tapped.
      const el = target instanceof Element ? target : (target as Node).parentElement;
      if (el && el.closest('canvas')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', onKey);
    // Capture phase: the viewport stops propagation on its own pointer handlers,
    // so a bubbling listener would never see a tap that lands on the canvas.
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  if (!open) return null;

  const isLight = theme === 'light';

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label={title}
      data-sheet-id={id}
      data-theme={theme}
      className={`pr-surface paperrocket-play-sheet fixed left-0 right-0 bottom-0 sm:left-auto sm:right-5 sm:bottom-5 z-50 w-full sm:w-[380px] sm:max-w-[400px] rounded-t-3xl sm:rounded-2xl border-t border-x sm:border shadow-2xl font-sans
        motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-250 motion-safe:ease-out
        ${isLight ? 'bg-white border-neutral-200 text-neutral-800' : 'bg-[#18191d] border-zinc-800 text-zinc-100'}`}
      style={{
        maxHeight: tall ? '70vh' : '38vh',
        paddingBottom: 'max(env(safe-area-inset-bottom), 14px)',
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div className="paperrocket-sheet-header px-5 pt-3.5 pb-1 flex items-center justify-between min-h-[40px]">
        <h2 className="text-sm font-extrabold tracking-tight">{title}</h2>
        <StudioCloseButton onClick={closeSheet} ariaLabel={`Close ${title}`} theme={theme} />
      </div>

      <div className="paperrocket-sheet-body px-5 pb-3 overflow-y-auto studio-scroll" style={{ maxHeight: tall ? 'calc(70vh - 68px)' : 'calc(38vh - 68px)' }}>
        {children}
      </div>
    </div>
  );
};
