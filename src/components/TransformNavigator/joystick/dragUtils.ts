import React, { useCallback, useRef } from 'react';

export interface DragInfo {
  dx: number;
  dy: number;
  totalX: number;
  totalY: number;
  x: number;
  y: number;
}

export interface DragHandlers {
  onStart?: (info: DragInfo) => void;
  onMove: (info: DragInfo) => void;
  onEnd?: () => void;
}

export interface DragProps {
  onPointerDown: (e: React.PointerEvent<Element>) => void;
  onPointerMove: (e: React.PointerEvent<Element>) => void;
  onPointerUp: (e: React.PointerEvent<Element>) => void;
  onPointerCancel: (e: React.PointerEvent<Element>) => void;
}

export function useDrag(handlers: DragHandlers): DragProps {
  const ref = useRef<{ id: number; lastX: number; lastY: number; startX: number; startY: number } | null>(null);
  const latest = useRef(handlers);
  latest.current = handlers;

  const onPointerDown = useCallback((e: React.PointerEvent<Element>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported
    }
    ref.current = {
      id: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    };
    latest.current.onStart?.({ dx: 0, dy: 0, totalX: 0, totalY: 0, x: e.clientX, y: e.clientY });
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<Element>) => {
    const s = ref.current;
    if (!s || s.id !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const info: DragInfo = {
      dx: e.clientX - s.lastX,
      dy: e.clientY - s.lastY,
      totalX: e.clientX - s.startX,
      totalY: e.clientY - s.startY,
      x: e.clientX,
      y: e.clientY,
    };
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    if (info.dx === 0 && info.dy === 0) return;
    latest.current.onMove(info);
  }, []);

  const finish = useCallback((e: React.PointerEvent<Element>) => {
    const s = ref.current;
    if (!s || s.id !== e.pointerId) return;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // pointer was already released
    }
    ref.current = null;
    latest.current.onEnd?.();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish };
}

export function useAngleDrag(
  centreOf: () => { x: number; y: number } | null,
  handlers: { onStart?: () => void; onSweep: (radians: number) => void; onEnd?: () => void }
): DragProps {
  const last = useRef(0);
  const latest = useRef(handlers);
  latest.current = handlers;

  const angleAt = (x: number, y: number): number | null => {
    const c = centreOf();
    if (!c) return null;
    return Math.atan2(y - c.y, x - c.x);
  };

  return useDrag({
    onStart: ({ x, y }) => {
      const a = angleAt(x, y);
      if (a !== null) last.current = a;
      latest.current.onStart?.();
    },
    onMove: ({ x, y }) => {
      const a = angleAt(x, y);
      if (a === null) return;
      let delta = a - last.current;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      last.current = a;
      if (delta !== 0) latest.current.onSweep(delta);
    },
    onEnd: () => latest.current.onEnd?.(),
  });
}

export function createStepper(step: number) {
  let carry = 0;
  return {
    push(amount: number): number {
      carry += amount;
      const steps = Math.trunc(carry / step);
      if (steps === 0) return 0;
      carry -= steps * step;
      return steps * step;
    },
  };
}

export const AXIS_LABEL = { x: 'X', y: 'Y', z: 'Z' } as const;

export const STEP = {
  move: 0.25,
  turn: Math.PI / 12,
  size: 0.05,
};

export const SENS = {
  move: (cameraDistance: number) => cameraDistance * 0.0022,
  size: 0.0065,
};
