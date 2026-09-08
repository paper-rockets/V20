import React, { useRef, useState } from 'react';
import { JoystickShell } from './JoystickShell';
import { useDrag } from './dragUtils';
import type { ConceptProps } from './conceptTypes';

const D = 136;
const C = D / 2;
const CONE_R = 41;
const ARC_R = 57;
const RIM_R = 64;

const polar = (deg: number, r: number) => ({
  x: C + Math.cos((deg * Math.PI) / 180) * r,
  y: C + Math.sin((deg * Math.PI) / 180) * r,
});

function arcPath(deg: number, r: number, span: number): string {
  const a0 = ((deg - span / 2) * Math.PI) / 180;
  const a1 = ((deg + span / 2) * Math.PI) / 180;
  return `M ${C + Math.cos(a0) * r} ${C + Math.sin(a0) * r} A ${r} ${r} 0 0 1 ${
    C + Math.cos(a1) * r
  } ${C + Math.sin(a1) * r}`;
}

export const DiscJoystick: React.FC<ConceptProps> = ({
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
}) => {
  const [activeAxis, setActiveAxis] = useState<string | null>(null);
  const [pull, setPull] = useState({ x: 0, y: 0 });
  const [pulling, setPulling] = useState(false);
  const startDragTime = useRef(0);
  const startPos = useRef({ x: 0, y: 0 });

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

  const rimDrag = useDrag({
    onMove: (info) => {
      onZoom(info.dy * 1.5);
    },
  });

  const handleAxisPointerDown = (axis: 'x' | 'y' | 'z', e: React.PointerEvent<Element>) => {
    e.preventDefault();
    e.stopPropagation();
    startDragTime.current = Date.now();
    startPos.current = { x: e.clientX, y: e.clientY };
    setActiveAxis(axis);
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
      setActiveAxis(null);
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
      <div style={{ position: 'absolute', inset: 0 }}>
        <svg className="jsk-svg" viewBox={`0 0 ${D} ${D}`}>
          {/* Rim sizes */}
          <circle className="hit" cx={C} cy={C} r={RIM_R} strokeWidth={13} {...rimDrag} />

          {pulling && (pull.x !== 0 || pull.y !== 0) && (
            <line className="jsk-leader" x1={C} y1={C} x2={C + pull.x} y2={C + pull.y} />
          )}

          {mode === '3d' &&
            axisInfo.map((info) => {
              const live = activeAxis === info.axis;
              return (
                <g key={`arc-${info.axis}`} className="settle">
                  <path
                    className={`jsk-shape ${live ? 'live' : ''} ${info.usable < 0.25 ? 'dim' : ''}`}
                    d={arcPath(info.angle, ARC_R, 58)}
                    fill="none"
                    stroke={`var(--ax-${info.axis})`}
                    strokeWidth={live ? 7 : 5}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-width .16s ease, opacity .18s ease' }}
                  />
                  <path
                    className="hit"
                    d={arcPath(info.angle, ARC_R, 58)}
                    onPointerDown={(e) => handleAxisPointerDown(info.axis, e)}
                  />
                </g>
              );
            })}

          {mode === '3d' &&
            axisInfo.map((info) => {
              const p = polar(info.angle, CONE_R);
              const live = activeAxis === info.axis;
              return (
                <g
                  key={`cone-${info.axis}`}
                  className="settle"
                  transform={`translate(${p.x} ${p.y}) rotate(${info.angle})`}
                >
                  <polygon
                    className={`jsk-shape ${live ? 'live' : ''} ${info.usable < 0.25 ? 'dim' : ''}`}
                    points="11,0 -7,7.5 -7,-7.5"
                    fill={`var(--ax-${info.axis})`}
                    stroke={`var(--ax-${info.axis})`}
                    strokeWidth={3}
                    strokeLinejoin="round"
                  />
                  <circle
                    r={20}
                    fill="transparent"
                    style={{ pointerEvents: 'auto', cursor: 'grab' }}
                    onPointerDown={(e) => handleAxisPointerDown(info.axis, e)}
                  />
                </g>
              );
            })}
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
      </div>
    </JoystickShell>
  );
};
