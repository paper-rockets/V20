import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getFps, subscribeFps } from '../../core/telemetryStore';

/**
 * Frame rate and input lag, for testing on real hardware.
 *
 * A note on reading the frame number: the app deliberately slows down when you
 * are not touching the screen (20fps on a Tab S6 Lite, 30 on an S25 Ultra) to
 * save battery and keep a fanless tablet cool. A low number while idle is the
 * app resting, not the app struggling. The number that matters is the one while
 * you are drawing — that is why this shows the drawing figure separately.
 *
 * Input lag here means: how long from your finger or pen moving to the next
 * frame being drawn. It is measured only while you are actually touching the
 * screen, because that is the only time the question means anything.
 */

export const PlayStats: React.FC<{ theme?: 'light' | 'dark' }> = ({ theme = 'dark' }) => {
  const fps = useSyncExternalStore(subscribeFps, getFps, getFps);
  const [lagMs, setLagMs] = useState<number>(0);
  const [activeFps, setActiveFps] = useState<number>(0);

  const pendingInputAt = useRef<number | null>(null);
  const isDown = useRef<boolean>(false);
  const smoothedLag = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const onDown = () => {
      isDown.current = true;
      pendingInputAt.current = performance.now();
    };
    const onMove = () => {
      if (isDown.current && pendingInputAt.current === null) {
        pendingInputAt.current = performance.now();
      }
    };
    const onUp = () => {
      isDown.current = false;
      pendingInputAt.current = null;
    };

    // Capture phase and passive: the viewport stops propagation on its own
    // handlers, and we must never interfere with drawing.
    const opts = { capture: true, passive: true } as AddEventListenerOptions;
    window.addEventListener('pointerdown', onDown, opts);
    window.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointerup', onUp, opts);
    window.addEventListener('pointercancel', onUp, opts);

    const tick = () => {
      const t = pendingInputAt.current;
      if (t !== null) {
        const sample = performance.now() - t;
        pendingInputAt.current = null;
        // Exponential smoothing, or the number is unreadable noise.
        smoothedLag.current = smoothedLag.current * 0.8 + sample * 0.2;
        setLagMs(smoothedLag.current);
      }
      if (isDown.current) setActiveFps(getFps());
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointerdown', onDown, opts);
      window.removeEventListener('pointermove', onMove, opts);
      window.removeEventListener('pointerup', onUp, opts);
      window.removeEventListener('pointercancel', onUp, opts);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const isLight = theme === 'light';
  const resting = !isDown.current;

  // Plain text, no panel. It has to stay readable over a white canvas and over a
  // dark model, so it carries its own outline rather than a background box, and
  // sits above everything including sheets and full-screen views.
  const outline = isLight
    ? '0 0 3px #fff, 0 0 6px #fff, 0 1px 2px rgba(0,0,0,0.35)'
    : '0 0 3px #000, 0 0 6px #000, 0 1px 2px rgba(0,0,0,0.9)';

  const Line: React.FC<{ label: string; value: React.ReactNode; unit: string; dim?: boolean }> = ({
    label,
    value,
    unit,
    dim,
  }) => (
    <div className="flex items-baseline gap-1">
      <span className="opacity-70">{label}</span>
      <span className={`font-bold tabular-nums ${dim ? 'opacity-70' : ''}`}>{value}</span>
      <span className="opacity-50">{unit}</span>
    </div>
  );

  return (
    <div
      className={`fixed left-2.5 z-[2147483647] text-[11px] font-mono leading-tight
        pointer-events-none select-none ${isLight ? 'text-neutral-900' : 'text-white'}`}
      // Under the project name, not the bottom corner: on a phone the bottom
      // strip reaches the left edge and the numbers landed on top of the colour
      // button. This gap is empty in every layout.
      style={{ top: 'calc(max(env(safe-area-inset-top), 4px) + 60px)', textShadow: outline }}
    >
      <Line label="now" value={fps} unit={resting ? 'fps · resting' : 'fps'} dim={resting} />
      <Line label="draw" value={activeFps || '--'} unit="fps" />
      <Line label="lag" value={lagMs ? lagMs.toFixed(0) : '--'} unit="ms" />
    </div>
  );
};
