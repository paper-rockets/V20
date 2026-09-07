import React from 'react';
import { StrokeProfile, MaterialType } from '../../types';

export interface BrushShapeGlyphProps {
  brushId?: string;
  profile?: StrokeProfile;
  materialType?: MaterialType;
  patternType?: string;
  /** World size, e.g. 0.015 to 0.14 */
  size?: number;
  color?: string;
  theme?: 'light' | 'dark';
  /** Bounding box width and height in px (default: 44) */
  boxSize?: number;
  className?: string;
}

const BRUSH_IMAGES: Record<string, string> = {
  clay: '/assets/brushes/clay.png',
  build: '/assets/brushes/build.png',
  move: '/assets/brushes/move.png',
  inflate: '/assets/brushes/inflate.png',
  pinch: '/assets/brushes/pinch.png',
  crease: '/assets/brushes/crease.png',
  flatten: '/assets/brushes/flatten.png',
  smooth: '/assets/brushes/smooth.png',
  // Legacy / Surface fallbacks
  streamline_ink: '/assets/brushes/clay.png',
  spatial_pipe: '/assets/brushes/build.png',
  chisel_marker: '/assets/brushes/pinch.png',
  drafting_wire: '/assets/brushes/crease.png',
  neon_cable: '/assets/brushes/inflate.png',
  conformal_bead: '/assets/brushes/flatten.png',
  stipple_texture: '/assets/brushes/smooth.png',
  matte_clay: '/assets/brushes/flatten.png',
};

/**
 * Normalizes size into a scale ratio (0.5 to 1.15) for visually scaling 3D sculpt marks.
 */
function getScaleFactor(size: number | undefined): number {
  if (size === undefined) return 0.85;
  const clamped = Math.max(0.012, Math.min(0.14, size));
  return 0.52 + ((clamped - 0.012) / (0.13 - 0.012)) * 0.58;
}

export const BrushShapeGlyph: React.FC<BrushShapeGlyphProps> = ({
  brushId = 'clay',
  size = 0.04,
  boxSize = 44,
  className = '',
}) => {
  const imageSrc = BRUSH_IMAGES[brushId] || BRUSH_IMAGES.clay;
  const scale = getScaleFactor(size);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden shrink-0 select-none ${className}`}
      style={{ width: boxSize, height: boxSize }}
    >
      <img
        src={imageSrc}
        alt={brushId}
        draggable={false}
        className="object-contain pointer-events-none transition-transform duration-100 ease-out"
        style={{
          width: `${Math.round(boxSize * 0.9)}px`,
          height: `${Math.round(boxSize * 0.9)}px`,
          transform: `scale(${scale.toFixed(2)})`,
        }}
        onError={(e) => {
          // Fallback if image not yet loaded
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
};
