import React, { useRef, useState } from 'react';
import { JoystickShell } from './JoystickShell';
import { AXIS_LABEL, useAngleDrag, useDrag } from './dragUtils';
import type { ConceptProps } from './conceptTypes';

const D = 136;
const C = D / 2;
const RING_R = 52;
const TAB_R = 52;

const pt = (deg: number, r: number) => ({
  x: C + Math.cos((deg * Math.PI) / 180) * r,
  y: C + Math.sin((deg * Math.PI) / 180) * r,
});

export const CollarJoystick: React.FC<ConceptProps> = ({
  mode,
  onSetMode,
  locked,
  onToggleLock,
  axisInfo,
  readout,
  onOrbit,
  onZoom,
  onSelectView,
  onSelectAxis,
  onAxisDrag,
  onRingSweep,
}) => {
  const [selectedAxis, setSelectedAxis] = useState<string>('y');
  const [pull, setPull] = useState({ x: 0, y: 0 });
  const [pulling, setPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startDragTime = useRef(0);
  const startPos = useRef({ x: 0, y: 0 });

  const centreOf = () => {
    const r = containerRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };

  const coreDrag = useDrag({
    onStart: (info) => {
      setPulling(true);
      setPull({ x: 0, y: 0 });
      startPos.current = { x: info.x, y: info.y };
    },
    onMove: (info) => {
      const maxPull = 18;
      const dist = Math.hypot(info.totalX, info.totalY);
      const factor = dist > maxPull ? maxPull / dist : 1;
      setPull({ x: info.totalX * factor, y: info.totalY * factor });
      onOrbit(info.dx, info.dy);
    },
    onEnd: () => {
      setPulling(false);
      setPull({ x: 0, y: 0 });
    },
  });

  const ringDrag = useAngleDrag(centreOf, {
    onSweep: (delta) => {
      if (onRingSweep) onRingSweep(delta);
      else onOrbit(-delta * 180, 0);
    },
  });

  const handleTabPointerDown = (axis: 'x' | 'y' | 'z', e: React.PointerEvent<Element>) => {
    e.preventDefault();
    e.stopPropagation();
    startDragTime.current = Date.now();
    startPos.current = { x: e.clientX, y: e.clientY };
    setSelectedAxis(axis);
    onSelectAxis?.(axis);

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startPos.current.x;
      const dy = ev.clientY - startPos.current.y;
      if (Math.hypot(dx, dy) > 4) {
        onAxisDrag?.(axis, dx);
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      const elapsed = Date.now() - startDragTime.current;
      const moved = Math.hypot(ev.clientX - startPos.current.x, ev.clientY - startPos.current.y);
      if (elapsed < 350 && moved < 6) {
        if (axis === 'y') onSelectView('top');
        else if (axis === 'x') onSelectView('side');
        else if (axis === 'z') onSelectView('front');
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <JoystickShell mode={mode} onSetMode={onSetMode} locked={locked} onToggleLock={onToggleLock}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
        <svg className="jsk-svg" viewBox={`0 0 ${D} ${D}`}>
          {/* Blue collar ring */}
          <circle
            cx={C}
            cy={C}
            r={RING_R}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={4.5}
            strokeOpacity={0.85}
          />
          <circle
            className="hit"
            cx={C}
            cy={C}
            r={RING_R}
            strokeWidth={16}
            {...ringDrag}
          />

          {pulling && (pull.x !== 0 || pull.y !== 0) && (
            <line className="jsk-leader" x1={C} y1={C} x2={C + pull.x} y2={C + pull.y} />
          )}
        </svg>

        <div
          className={`jsk-core ${mode === '3d' ? 'ball' : 'flat'} ${pulling ? 'live' : ''}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${pull.x}px), calc(-50% + ${pull.y}px))`,
          }}
          {...coreDrag}
        >
          <span className="jsk-core-dot" />
        </div>

        {/* 3 tabs riding the ring */}
        {mode === '3d' &&
          axisInfo.map((info) => {
            const p = pt(info.angle, TAB_R);
            const live = selectedAxis === info.axis;
            return (
              <button
                key={info.axis}
                type="button"
                className={`jsk-tab settle ${info.usable < 0.25 ? 'dim' : ''}`}
                style={{ left: p.x, top: p.y }}
                aria-label={`Select ${AXIS_LABEL[info.axis]}`}
                onPointerDown={(e) => handleTabPointerDown(info.axis, e)}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    fontSize: 11.5,
                    fontWeight: 650,
                    letterSpacing: '-0.02em',
                    background: live
                      ? `var(--ax-${info.axis})`
                      : 'linear-gradient(180deg, #fff 0%, #f4f2ef 100%)',
                    color: live ? '#fff' : `var(--ax-${info.axis})`,
                    boxShadow:
                      '0 4px 10px -4px rgba(28,32,37,.34), 0 1px 2px rgba(28,32,37,.1), inset 0 1px 0 rgba(255,255,255,.9)',
                    transform: live ? 'scale(1.1)' : 'none',
                    transition: 'background .14s ease, color .14s ease, transform .14s ease',
                  }}
                >
                  {AXIS_LABEL[info.axis]}
                </span>
              </button>
            );
          })}
      </div>
    </JoystickShell>
  );
};
