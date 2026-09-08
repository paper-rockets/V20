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

const PROFILE_BY_BRUSH: Record<string, StrokeProfile> = {
  spatial_pipe: 'tube',
  drafting_wire: 'tube',
  neon_cable: 'tube',
  chisel_marker: 'marker',
  conformal_bead: 'conformal',
  terrazzo_fleck: 'conformal',
  matte_clay: 'conformal',
};

const PATTERN_BRUSHES = new Set(['halftone_dot', 'stipple_texture', 'line_hatch', 'crosshatch', 'terrazzo_fleck']);

export const BrushShapeGlyph: React.FC<BrushShapeGlyphProps> = ({
  brushId = 'clay',
  profile,
  patternType,
  boxSize = 44,
  className = '',
}) => {
  const resolvedProfile = profile || PROFILE_BY_BRUSH[brushId] || 'ribbon';
  const showPattern = patternType !== 'none' && (Boolean(patternType) || PATTERN_BRUSHES.has(brushId));

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 select-none text-current ${className}`}
      style={{ width: boxSize, height: boxSize }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="h-full w-full fill-none stroke-current" role="presentation">
        {resolvedProfile === 'tube' && (
          <>
            <path d="M6 26C13 10 25 31 34 14" strokeWidth="4.5" strokeLinecap="round" opacity="0.16" />
            <path d="M6 26C13 10 25 31 34 14" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="34" cy="14" r="2.3" strokeWidth="1.5" />
          </>
        )}
        {resolvedProfile === 'ribbon' && (
          <path d="M5 26C12 8 23 31 35 12L35 18C24 35 13 14 5 30Z" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
        )}
        {resolvedProfile === 'marker' && (
          <>
            <path d="M7 29L25 11L34 15L16 33Z" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
            <path d="M25 11L29 7L38 11L34 15" strokeWidth="1.5" strokeLinejoin="round" />
          </>
        )}
        {resolvedProfile === 'conformal' && (
          <>
            <path d="M5 27C13 15 27 15 35 27" strokeWidth="5" strokeLinecap="round" opacity="0.16" />
            <path d="M5 27C13 15 27 15 35 27" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4 31H36" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3" opacity="0.55" />
          </>
        )}
        {showPattern && (
          <>
            <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
            <circle cx="19" cy="9" r="1" fill="currentColor" stroke="none" />
            <circle cx="27" cy="12" r="1.25" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    </div>
  );
};
