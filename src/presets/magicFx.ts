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
    id: 'neon-glow',
    label: 'Neon Glow',
    shaderEffect: 'rim_light',
    materialType: 'glow',
    emissiveIntensity: 1.2,
    suggestColor: '#00ffff',
  },
  {
    id: 'lava',
    label: 'Lava',
    shaderEffect: 'lava',
    materialType: 'animated_fx',
    emissiveIntensity: 1.0,
    suggestColor: '#ff6600',
  },
  {
    id: 'slime',
    label: 'Slime',
    shaderEffect: 'slime',
    materialType: 'animated_fx',
    emissiveIntensity: 1.0,
    suggestColor: '#00ff00',
  },
  {
    id: 'cartoon',
    label: 'Cartoon',
    shaderEffect: 'anime_cel',
    materialType: 'shaded',
    emissiveIntensity: 0,
    suggestColor: '#000000',
  },
  {
    id: 'rainbow',
    label: 'Rainbow',
    shaderEffect: 'rainbow',
    materialType: 'animated_fx',
    emissiveIntensity: 1.0,
    suggestColor: '#ff00ff',
  },
  {
    id: 'sparkle',
    label: 'Sparkle',
    shaderEffect: 'glitter',
    materialType: 'animated_fx',
    emissiveIntensity: 1.0,
    suggestColor: '#ffff00',
  },
  {
    id: 'none',
    label: 'None',
    shaderEffect: undefined,
    materialType: 'shadeless',
    emissiveIntensity: 0,
    suggestColor: '#cccccc',
  },
];
