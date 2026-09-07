import React, { useRef, useCallback } from 'react';
import { Sun, Moon, Compass } from 'lucide-react';

interface CelestialDomeWidgetProps {
  altitude: number; // -15 to 90
  azimuth: number;  // 0 to 360
  onChange: (altitude: number, azimuth: number) => void;
}

export const CelestialDomeWidget: React.FC<CelestialDomeWidgetProps> = ({
  altitude,
  azimuth,
  onChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Center is (100, 100), radius is 80
  const radius = 75;
  const cx = 100;
  const cy = 100;

  // Convert altitude (0=edge, 90=center) and azimuth (0=North/top, 90=East/right, 180=South/bottom, 270=West/left)
  // Distance from center = radius * (1 - clamp(altitude, 0, 90) / 90)
  const normAlt = Math.max(0, Math.min(90, altitude));
  const r = radius * (1 - normAlt / 90);
  const azRad = ((azimuth - 90) * Math.PI) / 180; // offset so 0° is North (up)
  const sunX = cx + r * Math.cos(azRad);
  const sunY = cy + r * Math.sin(azRad);

  const handlePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Scale to SVG 200x200
      const scaleX = 200 / rect.width;
      const scaleY = 200 / rect.height;
      const svgX = clickX * scaleX - cx;
      const svgY = clickY * scaleY - cy;

      const dist = Math.min(radius, Math.sqrt(svgX * svgX + svgY * svgY));
      const newAlt = Math.round((1 - dist / radius) * 90);

      let newAz = (Math.atan2(svgY, svgX) * 180) / Math.PI + 90;
      if (newAz < 0) newAz += 360;
      newAz = Math.round(newAz) % 360;

      onChange(newAlt, newAz);
    },
    [onChange, radius, cx, cy]
  );

  const isNight = altitude < 0;

  return (
    <div className="flex flex-col items-center select-none">
      <div className="text-xs text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5">
        <Compass className="w-3.5 h-3.5 text-zinc-400" />
        <span>Drag Dome to Position Sun</span>
      </div>

      <div className="relative w-44 h-44 bg-[#14161f] rounded-full p-2 border border-neutral-700/60 shadow-inner flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          className="w-full h-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handlePointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) {
              handlePointer(e);
            }
          }}
        >
          {/* Outer Horizon Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="#0f1118"
            stroke="#343b4f"
            strokeWidth="2"
          />

          {/* 60 deg elevation ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius * (1 - 60 / 90)}
            fill="none"
            stroke="#22283a"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* 30 deg elevation ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius * (1 - 30 / 90)}
            fill="none"
            stroke="#22283a"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Cardinal axes */}
          <line x1={cx} y1={cy - radius} x2={cx} y2={cy + radius} stroke="#252d40" strokeWidth="1" />
          <line x1={cx - radius} y1={cy} x2={cx + radius} y2={cy} stroke="#252d40" strokeWidth="1" />

          {/* Cardinal Labels */}
          <text x={cx} y={cy - radius + 14} fill="#8e9bb3" fontSize="10" fontWeight="bold" textAnchor="middle">
            N
          </text>
          <text x={cx + radius - 12} y={cy + 4} fill="#8e9bb3" fontSize="10" fontWeight="bold" textAnchor="middle">
            E
          </text>
          <text x={cx} y={cy + radius - 6} fill="#8e9bb3" fontSize="10" fontWeight="bold" textAnchor="middle">
            S
          </text>
          <text x={cx - radius + 12} y={cy + 4} fill="#8e9bb3" fontSize="10" fontWeight="bold" textAnchor="middle">
            W
          </text>

          {/* Zenith Center Point */}
          <circle cx={cx} cy={cy} r="2" fill="#506180" />

          {/* Sun Position Indicator */}
          {!isNight ? (
            <g transform={`translate(${sunX}, ${sunY})`}>
              <circle r="12" fill="#fbbf24" fillOpacity="0.25" />
              <circle r="8" fill="#f59e0b" fillOpacity="0.5" />
              <circle r="5" fill="#fef3c7" stroke="#fbbf24" strokeWidth="1.5" />
            </g>
          ) : (
            <g transform={`translate(${cx}, ${cy})`}>
              <circle r="6" fill="#93c5fd" fillOpacity="0.8" />
              <circle r="3" fill="#ffffff" />
            </g>
          )}
        </svg>

        {/* Position Badge overlay */}
        <div className="absolute -bottom-2 bg-neutral-900/90 text-neutral-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-neutral-700">
          Alt: {altitude}° | Az: {azimuth}°
        </div>
      </div>
    </div>
  );
};
