import React, { useRef, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { JoystickShell } from './JoystickShell';
import { AXIS_LABEL, useDrag } from './dragUtils';
import type { ConceptProps } from './conceptTypes';

const D = 136;
const C = D / 2;
const R1 = 31;
const R2 = 57;
const SPAN = 74;

const pt = (deg: number, r: number) => [
  C + Math.cos((deg * Math.PI) / 180) * r,
  C + Math.sin((deg * Math.PI) / 180) * r,
];

function wedge(deg: number, span = SPAN): string {
  const a0 = deg - span / 2;
  const a1 = deg + span / 2;
  const [x1, y1] = pt(a0, R1);
  const [x2, y2] = pt(a0, R2);
  const [x3, y3] = pt(a1, R2);
  const [x4, y4] = pt(a1, R1);
  return `M ${x1} ${y1} L ${x2} ${y2} A ${R2} ${R2} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${R1} ${R1} 0 0 0 ${x1} ${y1} Z`;
}

export const PetalJoystick: React.FC<ConceptProps> = ({
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

  // Center core drag (orbit in 3D, pan in 2D)
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

  // Outer rim drag (zoom)
  const rimDrag = useDrag({
    onMove: (info) => {
      onZoom(info.dy * 1.5);
    },
  });

  // Petal drag & click handling
  const handlePetalPointerDown = (axis: 'x' | 'y' | 'z', e: React.PointerEvent<Element>) => {
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
          {/* Sizing rim */}
          <circle className="hit" cx={C} cy={C} r={64} strokeWidth={13} {...rimDrag} />

          {pulling && (pull.x !== 0 || pull.y !== 0) && (
            <line className="jsk-leader" x1={C} y1={C} x2={C + pull.x} y2={C + pull.y} />
          )}

          {mode === '3d' &&
            axisInfo.map((info) => {
              const live = activeAxis === info.axis;
              const dim = info.usable < 0.25;
              return (
                <g key={info.axis} className={`settle jsk-shape ${dim ? 'dim' : ''}`}>
                  <path
                    d={wedge(info.angle)}
                    fill={live ? `var(--ax-${info.axis})` : 'none'}
                    stroke={`var(--ax-${info.axis})`}
                    strokeWidth={live ? 0 : 2.75}
                    strokeLinejoin="round"
                    style={{ transition: 'fill .14s ease, stroke-width .14s ease' }}
                  />
                  <path
                    d={wedge(info.angle)}
                    fill="transparent"
                    style={{ pointerEvents: 'auto', cursor: 'grab' }}
                    onPointerDown={(e) => handlePetalPointerDown(info.axis, e)}
                  />
                  <text
                    x={pt(info.angle, (R1 + R2) / 2)[0]}
                    y={pt(info.angle, (R1 + R2) / 2)[1] + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="650"
                    fill={live ? '#fff' : `var(--ax-${info.axis})`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {AXIS_LABEL[info.axis]}
                  </text>
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

        {mode === '2d' && (
          <div
            className="jsk-wing"
            style={{ position: 'absolute', left: C + 30, top: C - 26 }}
            {...rimDrag}
          >
            <ChevronUp size={13} strokeWidth={2.2} />
            <ChevronDown size={13} strokeWidth={2.2} />
          </div>
        )}
      </div>
    </JoystickShell>
  );
};
