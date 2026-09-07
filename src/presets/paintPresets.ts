// src/presets/paintPresets.ts
import { PaintPreset, MaterialType, BrushSettings } from '../types';

export interface PaintPalette {
  id: string;
  name: string;
  colors: string[];
}

export const CURATED_PAINT_PALETTES: PaintPalette[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    colors: ['#06b6d4', '#ec4899', '#8b5cf6', '#10b981', '#f43f5e', '#a855f7', '#3b82f6', '#facc15'],
  },
  {
    id: 'drafting_studio',
    name: 'Drafting Studio',
    colors: ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#34d399', '#fde047', '#94a3b8'],
  },
  {
    id: 'clay_terracotta',
    name: 'Clay & Terracotta',
    colors: ['#b45309', '#d97706', '#f59e0b', '#78350f', '#92400e', '#ea580c', '#c2410c', '#fed7aa'],
  },
  {
    id: 'nordic_arch',
    name: 'Nordic Architectural',
    colors: ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f8fafc'],
  },
  {
    id: 'monochrome_ink',
    name: 'Monochrome & Ink',
    colors: ['#000000', '#18181b', '#27272a', '#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#ffffff'],
  },
  {
    id: 'vibrant_anime',
    name: 'Anime Cel & Toon',
    colors: ['#ff4081', '#7c4dff', '#536dfe', '#40c4ff', '#18ffff', '#64ffda', '#ffd740', '#ff6e40'],
  },
];

export const PAINT_FINISH_PRESETS: PaintPreset[] = [
  {
    id: 'glossy_ceramic',
    name: 'Glossy Ceramic',
    color: '#38bdf8',
    materialType: 'shaded',
    roughness: 0.1,
    metalness: 0.05,
    emissiveIntensity: 0,
    opacity: 1.0,
    category: 'PBR Shaded',
  },
  {
    id: 'satin_plastic',
    name: 'Satin Plastic',
    color: '#ec4899',
    materialType: 'shaded',
    roughness: 0.45,
    metalness: 0.02,
    emissiveIntensity: 0,
    opacity: 1.0,
    category: 'PBR Shaded',
  },
  {
    id: 'matte_clay',
    name: 'Matte Clay',
    color: '#f59e0b',
    materialType: 'shaded',
    roughness: 0.95,
    metalness: 0.0,
    emissiveIntensity: 0,
    opacity: 1.0,
    category: 'PBR Shaded',
  },
  {
    id: 'brushed_chrome',
    name: 'Brushed Chrome',
    color: '#e2e8f0',
    materialType: 'shaded',
    roughness: 0.2,
    metalness: 0.95,
    emissiveIntensity: 0,
    opacity: 1.0,
    category: 'PBR Shaded',
  },
  {
    id: 'polished_gold',
    name: 'Polished Gold',
    color: '#eab308',
    materialType: 'shaded',
    roughness: 0.15,
    metalness: 0.9,
    emissiveIntensity: 0,
    opacity: 1.0,
    category: 'PBR Shaded',
  },
  {
    id: 'flat_gouache',
    name: 'Flat Gouache',
    color: '#10b981',
    materialType: 'shadeless',
    roughness: 0.5,
    metalness: 0.0,
    emissiveIntensity: 0,
    opacity: 1.0,
    category: 'Flat Paint',
  },
  {
    id: 'neon_sign',
    name: 'Luminous Neon',
    color: '#06b6d4',
    materialType: 'glow',
    roughness: 0.1,
    metalness: 0.0,
    emissiveIntensity: 2.2,
    opacity: 1.0,
    category: 'Emissive Glow',
  },
  {
    id: 'translucent_glass',
    name: 'Translucent Frosted',
    color: '#bae6fd',
    materialType: 'shaded',
    roughness: 0.3,
    metalness: 0.1,
    emissiveIntensity: 0,
    opacity: 0.6,
    category: 'Translucent',
  },
  {
    id: 'animated_plasma',
    name: 'Plasma Energy FX',
    color: '#8b5cf6',
    materialType: 'animated_fx',
    shaderEffect: 'plasma',
    roughness: 0.1,
    metalness: 0.0,
    emissiveIntensity: 2.0,
    opacity: 1.0,
    category: 'Shader FX',
  },
  {
    id: 'animated_fire',
    name: 'Inferno Flame FX',
    color: '#ea580c',
    materialType: 'animated_fx',
    shaderEffect: 'fire',
    roughness: 0.2,
    metalness: 0.0,
    emissiveIntensity: 2.5,
    opacity: 1.0,
    category: 'Shader FX',
  },
];

const RECENT_COLORS_STORAGE_KEY = 'mody_recent_paint_colors_v14';

export function getRecentPaintColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_STORAGE_KEY);
    if (!raw) return ['#38bdf8', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#18181b', '#ffffff'];
    return JSON.parse(raw);
  } catch {
    return ['#38bdf8', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#18181b', '#ffffff'];
  }
}

export function addRecentPaintColor(hex: string): string[] {
  try {
    const current = getRecentPaintColors().filter((c) => c.toLowerCase() !== hex.toLowerCase());
    const updated = [hex, ...current].slice(0, 14);
    localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function applyPaintPresetToSettings(
  preset: PaintPreset,
  current: BrushSettings
): BrushSettings {
  return {
    ...current,
    color: preset.color,
    materialType: preset.materialType,
    roughness: preset.roughness,
    metalness: preset.metalness,
    emissiveIntensity: preset.emissiveIntensity,
    opacity: preset.opacity,
    shaderEffect: preset.shaderEffect ?? current.shaderEffect,
  };
}
