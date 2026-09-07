/**
 * Magic FX preset tier for Play mode.
 *
 * Maps shader effects to their material type and emissive settings.
 * Includes an "off" switch to reset to plain paint.
 */

import { AnimatedShaderEffect } from '../core/animatedShaders';
import { MaterialType } from '../types';

export interface MagicFxTile {
  id: string;
  label: string;
  shaderEffect: AnimatedShaderEffect | undefined;
  materialType: MaterialType;
  emissiveIntensity: number;
  suggestColor?: string; // Optional: a colour hint for the preview swatch
}

export const MAGIC_FX_TILES: MagicFxTile[] = [
  {
    id: 'cartoon',
    label: 'Cartoon Cel',
    shaderEffect: 'anime_cel',
    materialType: 'shaded',
    emissiveIntensity: 0,
    suggestColor: '#000000',
  },
  {
    id: 'neon-glow',
    label: 'Neon Rim',
    shaderEffect: 'rim_light',
    materialType: 'glow',
    emissiveIntensity: 1.5,
    suggestColor: '#00ffff',
  },
  {
    id: 'fire',
    label: 'Inferno Fire',
    shaderEffect: 'fire',
    materialType: 'animated_fx',
    emissiveIntensity: 1.8,
    suggestColor: '#ff4500',
  },
  {
    id: 'lava',
    label: 'Lava',
    shaderEffect: 'lava',
    materialType: 'animated_fx',
    emissiveIntensity: 1.4,
    suggestColor: '#ff6600',
  },
  {
    id: 'ocean_wave',
    label: 'Ocean Waves',
    shaderEffect: 'ocean_wave',
    materialType: 'animated_fx',
    emissiveIntensity: 0.2,
    suggestColor: '#0ea5e9',
  },
  {
    id: 'waterfall',
    label: 'Waterfall',
    shaderEffect: 'waterfall',
    materialType: 'animated_fx',
    emissiveIntensity: 0.3,
    suggestColor: '#38bdf8',
  },
  {
    id: 'caustic',
    label: 'Caustics',
    shaderEffect: 'caustic',
    materialType: 'animated_fx',
    emissiveIntensity: 0.5,
    suggestColor: '#67e8f9',
  },
  {
    id: 'foam',
    label: 'Sea Foam',
    shaderEffect: 'foam',
    materialType: 'animated_fx',
    emissiveIntensity: 0.2,
    suggestColor: '#e0f2fe',
  },
  {
    id: 'ripple',
    label: 'Water Ripple',
    shaderEffect: 'ripple',
    materialType: 'animated_fx',
    emissiveIntensity: 0.3,
    suggestColor: '#0284c7',
  },
  {
    id: 'galaxy',
    label: 'Galaxy',
    shaderEffect: 'galaxy',
    materialType: 'animated_fx',
    emissiveIntensity: 1.2,
    suggestColor: '#818cf8',
  },
  {
    id: 'rainbow',
    label: 'Rainbow',
    shaderEffect: 'rainbow',
    materialType: 'animated_fx',
    emissiveIntensity: 1.0,
    suggestColor: '#f43f5e',
  },
  {
    id: 'lightning',
    label: 'Lightning',
    shaderEffect: 'lightning',
    materialType: 'animated_fx',
    emissiveIntensity: 2.0,
    suggestColor: '#a855f7',
  },
  {
    id: 'sparkle',
    label: 'Sparkle Glitter',
    shaderEffect: 'glitter',
    materialType: 'animated_fx',
    emissiveIntensity: 1.3,
    suggestColor: '#facc15',
  },
  {
    id: 'candy',
    label: 'Candy Swirl',
    shaderEffect: 'candy',
    materialType: 'animated_fx',
    emissiveIntensity: 0.4,
    suggestColor: '#ec4899',
  },
  {
    id: 'slime',
    label: 'Toxic Slime',
    shaderEffect: 'slime',
    materialType: 'animated_fx',
    emissiveIntensity: 1.1,
    suggestColor: '#22c55e',
  },
  {
    id: 'sparkler',
    label: 'Sparkler',
    shaderEffect: 'sparkler',
    materialType: 'animated_fx',
    emissiveIntensity: 2.2,
    suggestColor: '#fbbf24',
  },
  {
    id: 'foliage_leaf',
    label: 'Leaf Foliage',
    shaderEffect: 'foliage_leaf',
    materialType: 'animated_fx',
    emissiveIntensity: 0.2,
    suggestColor: '#16a34a',
  },
  {
    id: 'foliage_fir',
    label: 'Fir Foliage',
    shaderEffect: 'foliage_fir',
    materialType: 'animated_fx',
    emissiveIntensity: 0.2,
    suggestColor: '#15803d',
  },
  {
    id: 'cloud',
    label: 'Fluffy Cloud',
    shaderEffect: 'cloud',
    materialType: 'animated_fx',
    emissiveIntensity: 0.3,
    suggestColor: '#f8fafc',
  },
  {
    id: 'jelly',
    label: 'Wobbly Jelly',
    shaderEffect: 'jelly',
    materialType: 'animated_fx',
    emissiveIntensity: 0.6,
    suggestColor: '#f472b6',
  },
  {
    id: 'plasma',
    label: 'Plasma Energy',
    shaderEffect: 'plasma',
    materialType: 'animated_fx',
    emissiveIntensity: 1.8,
    suggestColor: '#8b5cf6',
  },
  {
    id: 'volumetric_plasma',
    label: 'Volumetric Plasma',
    shaderEffect: 'volumetric_plasma',
    materialType: 'animated_fx',
    emissiveIntensity: 2.0,
    suggestColor: '#9333ea',
  },
  {
    id: 'jelly_warp',
    label: 'Jelly Warp',
    shaderEffect: 'jelly_warp',
    materialType: 'animated_fx',
    emissiveIntensity: 0.8,
    suggestColor: '#c084fc',
  },
  {
    id: 'posterize_ink',
    label: 'Posterize Ink',
    shaderEffect: 'posterize_ink',
    materialType: 'animated_fx',
    emissiveIntensity: 0.1,
    suggestColor: '#27272a',
  },
  {
    id: 'aurora',
    label: 'Aurora Borealis',
    shaderEffect: 'aurora',
    materialType: 'animated_fx',
    emissiveIntensity: 1.5,
    suggestColor: '#34d399',
  },
  {
    id: 'hologram',
    label: 'Hologram',
    shaderEffect: 'hologram',
    materialType: 'animated_fx',
    emissiveIntensity: 1.6,
    suggestColor: '#06b6d4',
  },
  {
    id: 'electric_arc',
    label: 'Electric Arc',
    shaderEffect: 'electric_arc',
    materialType: 'animated_fx',
    emissiveIntensity: 2.5,
    suggestColor: '#60a5fa',
  },
  {
    id: 'none',
    label: 'Plain Paint',
    shaderEffect: undefined,
    materialType: 'shaded',
    emissiveIntensity: 0,
    suggestColor: '#cccccc',
  },
];
