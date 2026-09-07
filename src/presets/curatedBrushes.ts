import { BrushSettings, StrokeProfile, MaterialType } from '../types';
import { DEFAULT_BRUSH_PRESETS, applyBrushPresetToSettings } from './brushPresets';
import { resolveAssetUrl } from '../utils/assetUrl';

const brushIcon = (filename: string) => resolveAssetUrl(`assets/brushes/${filename}`);

export interface CuratedBrush {
  id: string;
  name: string;
  category: 'Core' | 'Textures' | 'Surface' | 'Favorites';
  description: string;
  profile: StrokeProfile;
  materialType: MaterialType;
  patternType?: string;
  defaultSize: number;
  iconUrl: string;
  roughness?: number;
  domeFactor?: number;
  chiselAngle?: number;
  smoothingStrength?: number;
}

export const FEATHER_CORE_BRUSHES: CuratedBrush[] = [
  {
    id: 'spatial_pipe',
    name: '3D Tube',
    category: 'Core',
    description: 'Volumetric cylindrical 3D spline tube in free space',
    profile: 'tube',
    materialType: 'shaded',
    defaultSize: 0.04,
    iconUrl: brushIcon('build.png'),
    roughness: 0.35,
    smoothingStrength: 0.75,
  },
  {
    id: 'streamline_ink',
    name: 'Flat Ribbon',
    category: 'Core',
    description: 'Silky smooth spatial ribbon band with Bishop rotation frames',
    profile: 'ribbon',
    materialType: 'shaded',
    defaultSize: 0.035,
    iconUrl: brushIcon('clay.png'),
    roughness: 0.4,
    domeFactor: 0.2,
    smoothingStrength: 0.85,
  },
  {
    id: 'chisel_marker',
    name: 'Chisel Marker',
    category: 'Core',
    description: 'Calligraphic flat marker with sharp angular cross-section',
    profile: 'marker',
    materialType: 'shadeless',
    defaultSize: 0.045,
    iconUrl: brushIcon('pinch.png'),
    chiselAngle: 45,
    roughness: 0.6,
    smoothingStrength: 0.65,
  },
  {
    id: 'drafting_wire',
    name: 'Precision Wire',
    category: 'Core',
    description: 'Ultra-thin architectural wire for fine details and ink work',
    profile: 'tube',
    materialType: 'shadeless',
    defaultSize: 0.012,
    iconUrl: brushIcon('crease.png'),
    roughness: 0.2,
    smoothingStrength: 0.9,
  },
  {
    id: 'conformal_bead',
    name: 'Surface Decal',
    category: 'Surface',
    description: 'Conformal surface-hugging decal conforming to 3D geometry',
    profile: 'conformal',
    materialType: 'shaded',
    defaultSize: 0.04,
    iconUrl: brushIcon('flatten.png'),
    roughness: 0.4,
    smoothingStrength: 0.8,
  },
  {
    id: 'neon_cable',
    name: 'Neon Glow',
    category: 'Core',
    description: 'Self-luminous emissive neon light beam with bloom',
    profile: 'tube',
    materialType: 'glow',
    defaultSize: 0.03,
    iconUrl: brushIcon('inflate.png'),
    roughness: 0.1,
    smoothingStrength: 0.8,
  },
  {
    id: 'mask_cutout',
    name: 'Cutout Mask',
    category: 'Core',
    description: 'Negative-space masking curve for clean stencil cutouts',
    profile: 'ribbon',
    materialType: 'cutout',
    defaultSize: 0.04,
    iconUrl: brushIcon('smooth.png'),
    roughness: 0.5,
    smoothingStrength: 0.85,
  },
];

export const FEATHER_TEXTURE_BRUSHES: CuratedBrush[] = [
  {
    id: 'halftone_dot',
    name: 'Halftone Dot',
    category: 'Textures',
    description: 'Procedural manga screentone dot matrix pattern',
    profile: 'ribbon',
    materialType: 'shaded',
    patternType: 'dot',
    defaultSize: 0.055,
    iconUrl: brushIcon('smooth.png'),
  },
  {
    id: 'stipple_texture',
    name: 'Stipple Spray',
    category: 'Textures',
    description: 'Fine procedural stippling and particle spray pattern',
    profile: 'ribbon',
    materialType: 'shaded',
    patternType: 'stipple',
    defaultSize: 0.055,
    iconUrl: brushIcon('smooth.png'),
  },
  {
    id: 'line_hatch',
    name: 'Line Hatch',
    category: 'Textures',
    description: 'Directional parallel line hatching for comic shadows',
    profile: 'ribbon',
    materialType: 'shaded',
    patternType: 'line',
    defaultSize: 0.05,
    iconUrl: brushIcon('clay.png'),
  },
  {
    id: 'crosshatch',
    name: 'Crosshatch',
    category: 'Textures',
    description: 'Dense architectural and comic crosshatching screentone',
    profile: 'ribbon',
    materialType: 'shaded',
    patternType: 'cross',
    defaultSize: 0.05,
    iconUrl: brushIcon('pinch.png'),
  },
  {
    id: 'terrazzo_fleck',
    name: 'Terrazzo Fleck',
    category: 'Textures',
    description: 'Stylized multi-tone terrazzo stone flecks',
    profile: 'ribbon',
    materialType: 'shaded',
    patternType: 'terrazzo',
    defaultSize: 0.06,
    iconUrl: brushIcon('build.png'),
  },
];

export const ALL_FEATHER_BRUSHES: CuratedBrush[] = [
  ...FEATHER_CORE_BRUSHES,
  ...FEATHER_TEXTURE_BRUSHES,
];

// Compatibility export
export const SCULPT_BRUSHES: CuratedBrush[] = FEATHER_CORE_BRUSHES;
export const SURFACE_BRUSHES: CuratedBrush[] = ALL_FEATHER_BRUSHES;
export const CURATED_BRUSHES: CuratedBrush[] = ALL_FEATHER_BRUSHES;

export type BrushCategoryTab = 'Favorites' | 'Core' | 'Textures' | 'Surface';

export function getBrushesForTab(tab: BrushCategoryTab): CuratedBrush[] {
  switch (tab) {
    case 'Favorites':
      return [FEATHER_CORE_BRUSHES[0], FEATHER_CORE_BRUSHES[1], FEATHER_CORE_BRUSHES[2], FEATHER_TEXTURE_BRUSHES[0]];
    case 'Core':
      return FEATHER_CORE_BRUSHES;
    case 'Textures':
      return FEATHER_TEXTURE_BRUSHES;
    case 'Surface':
      return ALL_FEATHER_BRUSHES;
    default:
      return FEATHER_CORE_BRUSHES;
  }
}

/**
 * Detects which curated brush is currently in hand.
 */
export function getActiveCuratedBrush(settings: BrushSettings): CuratedBrush {
  if (settings.brushPresetId) {
    const found = ALL_FEATHER_BRUSHES.find((b) => b.id === settings.brushPresetId);
    if (found) return found;
  }

  // Deduce from settings
  if (settings.materialType === 'glow') {
    return FEATHER_CORE_BRUSHES.find((b) => b.id === 'neon_cable') || FEATHER_CORE_BRUSHES[0];
  }
  if (settings.materialType === 'cutout') {
    return FEATHER_CORE_BRUSHES.find((b) => b.id === 'mask_cutout') || FEATHER_CORE_BRUSHES[0];
  }
  if (settings.patternType === 'dot') {
    return FEATHER_TEXTURE_BRUSHES.find((b) => b.id === 'halftone_dot') || FEATHER_TEXTURE_BRUSHES[0];
  }
  if (settings.patternType === 'stipple') {
    return FEATHER_TEXTURE_BRUSHES.find((b) => b.id === 'stipple_texture') || FEATHER_TEXTURE_BRUSHES[0];
  }
  if (settings.patternType === 'line') {
    return FEATHER_TEXTURE_BRUSHES.find((b) => b.id === 'line_hatch') || FEATHER_TEXTURE_BRUSHES[0];
  }
  if (settings.patternType === 'cross') {
    return FEATHER_TEXTURE_BRUSHES.find((b) => b.id === 'crosshatch') || FEATHER_TEXTURE_BRUSHES[0];
  }
  if (settings.patternType === 'terrazzo') {
    return FEATHER_TEXTURE_BRUSHES.find((b) => b.id === 'terrazzo_fleck') || FEATHER_TEXTURE_BRUSHES[0];
  }

  if (settings.profile === 'marker') {
    return FEATHER_CORE_BRUSHES.find((b) => b.id === 'chisel_marker')!;
  }
  if (settings.profile === 'conformal') {
    return FEATHER_CORE_BRUSHES.find((b) => b.id === 'conformal_bead')!;
  }
  if (settings.profile === 'tube') {
    if ((settings.size ?? 0.035) <= 0.018) {
      return FEATHER_CORE_BRUSHES.find((b) => b.id === 'drafting_wire')!;
    }
    return FEATHER_CORE_BRUSHES.find((b) => b.id === 'spatial_pipe')!;
  }
  if (settings.profile === 'ribbon') {
    return FEATHER_CORE_BRUSHES.find((b) => b.id === 'streamline_ink')!;
  }

  return FEATHER_CORE_BRUSHES[0];
}

/**
 * Applies a curated brush to existing BrushSettings while preserving color.
 */
export function applyCuratedBrush(
  curated: CuratedBrush,
  current: BrushSettings
): BrushSettings {
  const fullPreset = DEFAULT_BRUSH_PRESETS.find((p) => p.id === curated.id);
  if (fullPreset) {
    const applied = applyBrushPresetToSettings(fullPreset, current);
    return {
      ...applied,
      color: current.color || applied.color,
      brushPresetId: curated.id,
      roughness: curated.roughness ?? applied.roughness,
      domeFactor: curated.domeFactor ?? applied.domeFactor,
      chiselAngle: curated.chiselAngle ?? applied.chiselAngle,
      smoothingStrength: curated.smoothingStrength ?? applied.smoothingStrength,
    };
  }

  return {
    ...current,
    profile: curated.profile,
    materialType: curated.materialType,
    patternType: (curated.patternType as any) || 'none',
    size: curated.defaultSize,
    brushPresetId: curated.id,
    roughness: curated.roughness ?? current.roughness,
    domeFactor: curated.domeFactor ?? current.domeFactor,
    chiselAngle: curated.chiselAngle ?? current.chiselAngle,
    smoothingStrength: curated.smoothingStrength ?? current.smoothingStrength,
  };
}
