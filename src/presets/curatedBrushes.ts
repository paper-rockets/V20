import { BrushSettings, StrokeProfile, MaterialType } from '../types';
import { DEFAULT_BRUSH_PRESETS, applyBrushPresetToSettings } from './brushPresets';

export interface CuratedBrush {
  id: string;
  name: string;
  category: 'Sculpt' | 'Surface' | 'Polish' | 'Favorites';
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

export const SCULPT_BRUSHES: CuratedBrush[] = [
  {
    id: 'clay',
    name: 'Soft Clay',
    category: 'Sculpt',
    description: 'Smooth sculptural clay stroke',
    profile: 'ribbon',
    materialType: 'shaded',
    defaultSize: 0.04,
    iconUrl: '/assets/brushes/clay.png',
    roughness: 0.7,
    domeFactor: 0.35,
    smoothingStrength: 0.8,
  },
  {
    id: 'build',
    name: 'Add Volume',
    category: 'Sculpt',
    description: 'Layered volumetric clay buildup',
    profile: 'tube',
    materialType: 'shaded',
    defaultSize: 0.045,
    iconUrl: '/assets/brushes/build.png',
    roughness: 0.65,
    smoothingStrength: 0.75,
  },
  {
    id: 'move',
    name: 'Drag Surface',
    category: 'Sculpt',
    description: 'Dynamic sweeping combed stroke',
    profile: 'ribbon',
    materialType: 'shaded',
    defaultSize: 0.05,
    iconUrl: '/assets/brushes/move.png',
    roughness: 0.5,
    smoothingStrength: 0.9,
  },
  {
    id: 'inflate',
    name: 'Inflate',
    category: 'Sculpt',
    description: 'Expanding bulbous volume',
    profile: 'tube',
    materialType: 'shaded',
    defaultSize: 0.06,
    iconUrl: '/assets/brushes/inflate.png',
    domeFactor: 0.5,
    roughness: 0.6,
  },
  {
    id: 'pinch',
    name: 'Pinch',
    category: 'Sculpt',
    description: 'Sharp crest and ridge profile',
    profile: 'marker',
    materialType: 'shaded',
    defaultSize: 0.035,
    iconUrl: '/assets/brushes/pinch.png',
    chiselAngle: 45,
    roughness: 0.45,
  },
  {
    id: 'crease',
    name: 'Crease',
    category: 'Sculpt',
    description: 'Carved fine shadow groove',
    profile: 'tube',
    materialType: 'shadeless',
    defaultSize: 0.015,
    iconUrl: '/assets/brushes/crease.png',
    roughness: 0.9,
  },
  {
    id: 'flatten',
    name: 'Flatten',
    category: 'Sculpt',
    description: 'Planar beveled flat surface',
    profile: 'conformal',
    materialType: 'shaded',
    defaultSize: 0.045,
    iconUrl: '/assets/brushes/flatten.png',
    roughness: 0.4,
  },
  {
    id: 'smooth',
    name: 'Smooth',
    category: 'Sculpt',
    description: 'Polishing surface blend',
    profile: 'conformal',
    materialType: 'shaded',
    defaultSize: 0.05,
    iconUrl: '/assets/brushes/smooth.png',
    roughness: 0.25,
    smoothingStrength: 0.95,
  },
];

export const SURFACE_BRUSHES: CuratedBrush[] = [
  {
    id: 'streamline_ink',
    name: 'Ribbon',
    category: 'Surface',
    description: 'Silky smooth flat band',
    profile: 'ribbon',
    materialType: 'shaded',
    defaultSize: 0.035,
    iconUrl: '/assets/brushes/clay.png',
  },
  {
    id: 'spatial_pipe',
    name: 'Tube',
    category: 'Surface',
    description: 'Free-space 3D tube',
    profile: 'tube',
    materialType: 'shaded',
    defaultSize: 0.04,
    iconUrl: '/assets/brushes/build.png',
  },
  {
    id: 'chisel_marker',
    name: 'Marker',
    category: 'Surface',
    description: 'Calligraphic chisel marker',
    profile: 'marker',
    materialType: 'shadeless',
    defaultSize: 0.045,
    iconUrl: '/assets/brushes/pinch.png',
  },
  {
    id: 'drafting_wire',
    name: 'Wire',
    category: 'Surface',
    description: 'Architectural detail wire',
    profile: 'tube',
    materialType: 'shadeless',
    defaultSize: 0.012,
    iconUrl: '/assets/brushes/crease.png',
  },
  {
    id: 'neon_cable',
    name: 'Neon',
    category: 'Surface',
    description: 'Self-luminous light beam',
    profile: 'tube',
    materialType: 'glow',
    defaultSize: 0.035,
    iconUrl: '/assets/brushes/inflate.png',
  },
  {
    id: 'stipple_texture',
    name: 'Stipple',
    category: 'Surface',
    description: 'Sparkling particle spray',
    profile: 'ribbon',
    materialType: 'shaded',
    patternType: 'stipple',
    defaultSize: 0.055,
    iconUrl: '/assets/brushes/smooth.png',
  },
];

export const CURATED_BRUSHES: CuratedBrush[] = SCULPT_BRUSHES;

export type BrushCategoryTab = 'Favorites' | 'Sculpt' | 'Surface' | 'Polish';

export function getBrushesForTab(tab: BrushCategoryTab): CuratedBrush[] {
  switch (tab) {
    case 'Favorites':
      return [SCULPT_BRUSHES[0], SCULPT_BRUSHES[1], SCULPT_BRUSHES[5], SCULPT_BRUSHES[7]];
    case 'Sculpt':
      return SCULPT_BRUSHES;
    case 'Surface':
      return SURFACE_BRUSHES;
    case 'Polish':
      return [SCULPT_BRUSHES[7], SCULPT_BRUSHES[6], SCULPT_BRUSHES[0]];
    default:
      return SCULPT_BRUSHES;
  }
}

/**
 * Detects which curated brush is currently in hand.
 */
export function getActiveCuratedBrush(settings: BrushSettings): CuratedBrush {
  if (settings.brushPresetId) {
    const all = [...SCULPT_BRUSHES, ...SURFACE_BRUSHES];
    const found = all.find((b) => b.id === settings.brushPresetId);
    if (found) return found;
  }

  // Deduce from settings
  if (settings.materialType === 'glow') {
    return SURFACE_BRUSHES.find((b) => b.id === 'neon_cable') || SCULPT_BRUSHES[0];
  }
  if (settings.patternType === 'stipple') {
    return SURFACE_BRUSHES.find((b) => b.id === 'stipple_texture') || SCULPT_BRUSHES[7];
  }
  if (settings.profile === 'marker') {
    return SCULPT_BRUSHES.find((b) => b.id === 'pinch')!;
  }
  if (settings.profile === 'conformal') {
    return SCULPT_BRUSHES.find((b) => b.id === 'flatten')!;
  }
  if (settings.profile === 'tube') {
    if ((settings.size ?? 0.035) <= 0.018) {
      return SCULPT_BRUSHES.find((b) => b.id === 'crease')!;
    }
    return SCULPT_BRUSHES.find((b) => b.id === 'build')!;
  }
  if (settings.profile === 'ribbon') {
    return SCULPT_BRUSHES.find((b) => b.id === 'clay')!;
  }

  return SCULPT_BRUSHES[0];
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
