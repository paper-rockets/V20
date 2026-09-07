// src/presets/brushPresets.ts
import { BrushPreset, BrushSettings } from '../types';

export const DEFAULT_BRUSH_PRESETS: BrushPreset[] = [
  // ── Calligraphy & Pen ──
  {
    id: 'streamline_ink',
    name: 'Streamline Ink Ribbon',
    description: 'Silky smooth calligraphic ribbon with streamline curve tracking and Bishop frames',
    category: 'ink',
    profile: 'ribbon',
    materialType: 'shaded',
    size: 0.035,
    opacity: 1.0,
    roughness: 0.3,
    metalness: 0.05,
    patternType: 'none',
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.85,
    archSegments: 5,
    domeFactor: 0.2,
    color: '#18181b',
  },
  {
    id: 'chisel_marker',
    name: 'Chisel Marker',
    description: 'Flat calligraphic marker with angled cross-section and flat cel shading',
    category: 'ink',
    profile: 'marker',
    materialType: 'shadeless',
    size: 0.045,
    opacity: 0.95,
    roughness: 0.6,
    metalness: 0.0,
    patternType: 'none',
    smoothingAlgorithm: 'exponential',
    smoothingStrength: 0.65,
    color: '#ef4444',
  },
  {
    id: 'drafting_wire',
    name: 'Drafting Precision Wire',
    description: 'Ultra-thin architectural wire for fine detailing, hatching, and drafts',
    category: 'ink',
    profile: 'tube',
    materialType: 'shadeless',
    size: 0.012,
    opacity: 1.0,
    roughness: 0.2,
    metalness: 0.1,
    patternType: 'none',
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.9,
    color: '#38bdf8',
  },

  // ── Volumetric 3D Tubes ──
  {
    id: 'spatial_pipe',
    name: 'Volumetric 3D Tube',
    description: 'Full 3D cylindrical volumetric tube ideal for free air drawing',
    category: 'tubes',
    profile: 'tube',
    materialType: 'shaded',
    size: 0.04,
    opacity: 1.0,
    roughness: 0.35,
    metalness: 0.25,
    patternType: 'none',
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.75,
    color: '#06b6d4',
  },
  {
    id: 'neon_cable',
    name: 'Glowing Neon Cable',
    description: 'Luminous cylindrical wire with vibrant self-illumination and bloom',
    category: 'tubes',
    profile: 'tube',
    materialType: 'glow',
    size: 0.03,
    opacity: 1.0,
    roughness: 0.1,
    metalness: 0.0,
    emissiveIntensity: 1.8,
    patternType: 'none',
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.8,
    color: '#ec4899',
  },

  // ── PBR & Metallic ──
  {
    id: 'brushed_chrome',
    name: 'Brushed Chrome Ribbon',
    description: 'High-metalness reflective surface reacting dynamically to lights',
    category: 'pbr',
    profile: 'ribbon',
    materialType: 'shaded',
    size: 0.038,
    opacity: 1.0,
    roughness: 0.15,
    metalness: 0.95,
    patternType: 'none',
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.8,
    color: '#e2e8f0',
  },
  {
    id: 'matte_clay',
    name: 'Matte Clay Bead',
    description: 'Tactile surface-hugging bead with soft cel diffuse shading',
    category: 'pbr',
    profile: 'conformal',
    materialType: 'shaded',
    size: 0.045,
    opacity: 1.0,
    roughness: 0.9,
    metalness: 0.02,
    patternType: 'none',
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.7,
    color: '#d97706',
  },

  // ── Procedural Manga Screentones & Decals ──
  {
    id: 'conformal_bead',
    name: 'Conformal Decal',
    description: 'Surface-conforming orthogonal decal hugging 3D geometry contours',
    category: 'decals',
    profile: 'conformal',
    materialType: 'shaded',
    size: 0.04,
    opacity: 1.0,
    roughness: 0.4,
    metalness: 0.1,
    patternType: 'none',
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.8,
    archSegments: 7,
    domeFactor: 0.35,
    color: '#f43f5e',
  },
  {
    id: 'halftone_dot',
    name: 'Halftone Screentone Dot',
    description: 'Procedural halftone dot matrix screentone for manga and comic shading',
    category: 'decals',
    profile: 'ribbon',
    materialType: 'shaded',
    size: 0.055,
    opacity: 1.0,
    roughness: 0.5,
    metalness: 0.0,
    patternType: 'dot',
    patternScale: 5.0,
    patternIntensity: 1.0,
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.85,
    color: '#18181b',
  },
  {
    id: 'stipple_texture',
    name: 'Stippled Shading Decal',
    description: 'Fine procedural stipple spray pattern for hand-drawn textures',
    category: 'decals',
    profile: 'ribbon',
    materialType: 'shaded',
    size: 0.05,
    opacity: 0.95,
    roughness: 0.7,
    metalness: 0.0,
    patternType: 'stipple',
    patternScale: 6.0,
    patternIntensity: 0.8,
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.75,
    color: '#3f3f46',
  },
  {
    id: 'line_hatch',
    name: 'Line Hatching Ribbon',
    description: 'Directional parallel line hatching for graphic anime shadows',
    category: 'decals',
    profile: 'ribbon',
    materialType: 'shaded',
    size: 0.05,
    opacity: 1.0,
    roughness: 0.6,
    metalness: 0.0,
    patternType: 'line',
    patternScale: 6.0,
    patternIntensity: 0.9,
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.8,
    color: '#27272a',
  },
  {
    id: 'crosshatch',
    name: 'Crosshatch Screentone',
    description: 'Dense procedural crosshatching for manga cel shading',
    category: 'decals',
    profile: 'ribbon',
    materialType: 'shaded',
    size: 0.05,
    opacity: 1.0,
    roughness: 0.6,
    metalness: 0.0,
    patternType: 'cross',
    patternScale: 6.0,
    patternIntensity: 0.9,
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.8,
    color: '#18181b',
  },
  {
    id: 'terrazzo_strip',
    name: 'Terrazzo Mosaic Ribbon',
    description: 'Procedural multi-tone terrazzo stone texture pattern',
    category: 'decals',
    profile: 'conformal',
    materialType: 'shaded',
    size: 0.055,
    opacity: 1.0,
    roughness: 0.5,
    metalness: 0.05,
    patternType: 'terrazzo',
    patternScale: 8.0,
    patternIntensity: 0.9,
    smoothingAlgorithm: 'streamline',
    smoothingStrength: 0.8,
    color: '#94a3b8',
  },
];

const CUSTOM_PRESETS_STORAGE_KEY = 'mody_custom_brush_presets_v14';

export function getCustomBrushPresets(): BrushPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load custom brush presets', err);
    return [];
  }
}

export function saveCustomBrushPreset(preset: BrushPreset): BrushPreset[] {
  try {
    const current = getCustomBrushPresets();
    const filtered = current.filter((p) => p.id !== preset.id);
    const updated = [preset, ...filtered];
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save custom brush preset', err);
    return [];
  }
}

export function deleteCustomBrushPreset(id: string): BrushPreset[] {
  try {
    const current = getCustomBrushPresets();
    const updated = current.filter((p) => p.id !== id);
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete custom brush preset', err);
    return [];
  }
}

export function applyBrushPresetToSettings(
  preset: BrushPreset,
  current: BrushSettings
): BrushSettings {
  return {
    ...current,
    profile: preset.profile,
    materialType: preset.materialType,
    shaderEffect: preset.shaderEffect,
    size: preset.size,
    opacity: preset.opacity,
    roughness: preset.roughness,
    metalness: preset.metalness,
    emissiveIntensity: preset.emissiveIntensity ?? current.emissiveIntensity ?? 0,
    patternType: preset.patternType,
    patternScale: preset.patternScale ?? current.patternScale,
    patternIntensity: preset.patternIntensity ?? current.patternIntensity,
    smoothingAlgorithm: preset.smoothingAlgorithm,
    smoothingStrength: preset.smoothingStrength,
    straightLineMode: preset.straightLineMode ?? current.straightLineMode,
    color: preset.color || current.color,
    archSegments: preset.archSegments ?? current.archSegments,
    domeFactor: preset.domeFactor ?? current.domeFactor,
    brushPresetId: preset.id,
  };
}

export function createPresetFromCurrentSettings(
  name: string,
  settings: BrushSettings,
  description = 'Custom user brush preset'
): BrushPreset {
  return {
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim() || 'Custom Brush',
    description,
    category: 'custom',
    profile: settings.profile,
    materialType: settings.materialType,
    shaderEffect: settings.shaderEffect,
    size: settings.size,
    opacity: settings.opacity,
    roughness: settings.roughness,
    metalness: settings.metalness,
    emissiveIntensity: settings.emissiveIntensity,
    patternType: settings.patternType,
    patternScale: settings.patternScale,
    patternIntensity: settings.patternIntensity,
    smoothingAlgorithm: settings.smoothingAlgorithm,
    smoothingStrength: settings.smoothingStrength,
    straightLineMode: settings.straightLineMode,
    color: settings.color,
    archSegments: settings.archSegments,
    domeFactor: settings.domeFactor,
    isCustom: true,
  };
}
