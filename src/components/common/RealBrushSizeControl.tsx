import React from 'react';
import { BrushSettings } from '../../types';

export interface RealBrushSizeControlProps {
  brushSettings: BrushSettings;
  onSizeChange: (newSize: number) => void;
  theme?: 'light' | 'dark';
  showHeading?: boolean;
}

export const RealBrushSizeControl: React.FC<RealBrushSizeControlProps> = ({
  brushSettings,
  onSizeChange,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const isFlat = brushSettings.profile === 'ribbon' || brushSettings.profile === 'conformal';
  const isMarker = brushSettings.profile === 'marker';

  // Integer scale for display (10 to 100)
  const displaySizeNumber = Math.round(
    ((brushSettings.size - 0.008) / (0.16 - 0.008)) * 90 + 10
  );

  // Map 3D world size (0.008 to 0.16) to actual on-screen preview pixel diameter (4px to 48px)
  const pixelSize = Math.max(4, Math.min(48, Math.round(brushSettings.size * 320)));
  const color = brushSettings.color || '#38bdf8';
  const opacity = brushSettings.opacity ?? 1.0;

  const shapeBorderColor = isLight ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.35)';

  return (
    <div className="flex flex-col gap-2 w-full select-none">
      {/* Live Actual Shape & Real Size Preview Area */}
      <div
        className={`relative w-full h-14 rounded-lg flex items-center justify-center overflow-hidden border transition-colors ${
          isLight
            ? 'bg-black/[0.03] border-black/10'
            : 'bg-white/[0.04] border-white/[0.08]'
        }`}
        title={`Actual brush size: ${displaySizeNumber}`}
      >
        {/* Single live size number in top right corner */}
        <span className={`absolute top-1 right-1.5 text-[10px] font-mono font-bold ${
          isLight ? 'text-neutral-500' : 'text-neutral-400'
        }`}>
          {displaySizeNumber}
        </span>

        {isFlat ? (
          /* Flat Ribbon Shape: horizontal band with rounded edges */
          <div
            className="transition-all duration-75 ease-out shadow-xs"
            style={{
              width: `${Math.max(10, Math.round(pixelSize * 1.6))}px`,
              height: `${Math.max(3, Math.round(pixelSize * 0.36))}px`,
              borderRadius: `${Math.max(1.5, Math.round(pixelSize * 0.18))}px`,
              backgroundColor: color,
              opacity: opacity,
              border: `1px solid ${shapeBorderColor}`,
            }}
          />
        ) : isMarker ? (
          /* Chisel Marker Shape: tilted angled stroke */
          <div
            className="transition-all duration-75 ease-out shadow-xs"
            style={{
              width: `${Math.max(10, Math.round(pixelSize * 1.5))}px`,
              height: `${Math.max(3, Math.round(pixelSize * 0.4))}px`,
              borderRadius: '1.5px',
              backgroundColor: color,
              opacity: opacity,
              border: `1px solid ${shapeBorderColor}`,
              transform: 'rotate(-35deg)',
            }}
          />
        ) : (
          /* 3D Round / Tube Shape: perfect circle */
          <div
            className="rounded-full transition-all duration-75 ease-out shadow-xs"
            style={{
              width: `${pixelSize}px`,
              height: `${pixelSize}px`,
              backgroundColor: color,
              opacity: opacity,
              border: `1px solid ${shapeBorderColor}`,
            }}
          />
        )}
      </div>

      {/* Smooth Size Slider */}
      <input
        type="range"
        min="0.008"
        max="0.16"
        step="0.002"
        value={brushSettings.size}
        onChange={(e) => onSizeChange(parseFloat(e.target.value))}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-500 ${
          isLight ? 'bg-black/15' : 'bg-white/20'
        }`}
        aria-label="Brush size"
      />
    </div>
  );
};