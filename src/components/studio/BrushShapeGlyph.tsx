import React, { useState } from 'react';
import { StrokeProfile, MaterialType } from '../../types';
import { resolveAssetUrl } from '../../utils/assetUrl';

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

const bImg = (name: string) => resolveAssetUrl(`assets/brushes/${name}`);

export const BRUSH_IMAGES: Record<string, string> = {
  clay: bImg('clay.png'),
  build: bImg('build.png'),
  move: bImg('move.png'),
  inflate: bImg('inflate.png'),
  pinch: bImg('pinch.png'),
  crease: bImg('crease.png'),
  flatten: bImg('flatten.png'),
  smooth: bImg('smooth.png'),
  // Legacy / Surface fallbacks
  streamline_ink: bImg('clay.png'),
  spatial_pipe: bImg('build.png'),
  chisel_marker: bImg('pinch.png'),
  drafting_wire: bImg('crease.png'),
  neon_cable: bImg('inflate.png'),
  conformal_bead: bImg('flatten.png'),
  stipple_texture: bImg('smooth.png'),
  matte_clay: bImg('flatten.png'),
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
  const [loadError, setLoadError] = useState(false);
  const imageSrc = BRUSH_IMAGES[brushId] || BRUSH_IMAGES.clay;
  const scale = getScaleFactor(size);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden shrink-0 select-none ${className}`}
      style={{ width: boxSize, height: boxSize }}
    >
      {!loadError ? (
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
          onError={() => setLoadError(true)}
        />
      ) : (
        <div
          data-testid="glyph-fallback"
          className="glyph-fallback w-full h-full rounded-full border border-current opacity-40 flex items-center justify-center text-[10px] font-bold"
        >
          {brushId.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
};
