import { oklchToHex } from '../core/colorMath';

/**
 * Colour moods.
 *
 * A flat row of sixteen fixed swatches is a paint box with no ideas in it: the
 * colours have no relationship, so anything you pick next fights what you picked
 * before. The app already carries a perceptual colour engine — the one that
 * knows a yellow at 70% brightness looks as bright as a blue at 70%, which plain
 * RGB gets badly wrong — and it was only being used to power a wheel nobody
 * should have to operate.
 *
 * So the palettes are generated from it instead. Each mood is a hue range walked
 * in even perceptual steps, which is why every colour inside one belongs with
 * the others and none of them jumps out as muddy or blinding. You pick a feeling
 * and get eight colours that already agree with each other.
 *
 * No harmony wheels, no gradient editors, no toggles. Those are the machinery,
 * and machinery is what this is hiding.
 */

export interface Mood {
  id: string;
  name: string;
  /** Eight hex colours, ordered light to deep. */
  colors: string[];
  /** One colour that represents the mood on its button. */
  swatch: string;
}

interface MoodSpec {
  id: string;
  name: string;
  /** Hue in degrees where the run starts. */
  hue: number;
  /** How far round the wheel it travels. Small = tight family, large = varied. */
  spread: number;
  /** Lightness at the start and end of the run, 0..1. */
  light: [number, number];
  /** Colourfulness at the start and end. Higher is more vivid. */
  chroma: [number, number];
}

const SPECS: MoodSpec[] = [
  // Lightness is kept high wherever a run passes through yellow (roughly 60-110
  // degrees). Yellow is the one hue that turns to olive and mud the moment you
  // darken it, so a ramp that dims through it ends in colours nobody wants.
  { id: 'candy',   name: 'Candy',   hue: 330, spread: 95,  light: [0.88, 0.74], chroma: [0.14, 0.19] },
  { id: 'neon',    name: 'Neon',    hue: 190, spread: 165, light: [0.80, 0.70], chroma: [0.22, 0.28] },
  { id: 'sunset',  name: 'Sunset',  hue: 20,  spread: 55,  light: [0.86, 0.62], chroma: [0.14, 0.19] },
  { id: 'ocean',   name: 'Ocean',   hue: 215, spread: 65,  light: [0.88, 0.44], chroma: [0.08, 0.16] },
  { id: 'forest',  name: 'Forest',  hue: 145, spread: 55,  light: [0.84, 0.46], chroma: [0.10, 0.15] },
  { id: 'berry',   name: 'Berry',   hue: 320, spread: 55,  light: [0.80, 0.42], chroma: [0.13, 0.19] },
  { id: 'ice',     name: 'Ice',     hue: 225, spread: 55,  light: [0.95, 0.70], chroma: [0.03, 0.09] },
  { id: 'earth',   name: 'Earth',   hue: 45,  spread: 40,  light: [0.82, 0.52], chroma: [0.06, 0.10] },
  { id: 'rainbow', name: 'Rainbow', hue: 25,  spread: 315, light: [0.74, 0.74], chroma: [0.18, 0.18] },
  { id: 'ink',     name: 'Ink',     hue: 260, spread: 20,  light: [0.94, 0.24], chroma: [0.02, 0.03] },
];


const STEPS = 8;

function buildMood(spec: MoodSpec): Mood {
  const colors: string[] = [];
  for (let i = 0; i < STEPS; i++) {
    const t = i / (STEPS - 1);
    const h = (spec.hue + spec.spread * t + 360) % 360;
    const L = spec.light[0] + (spec.light[1] - spec.light[0]) * t;
    const C = spec.chroma[0] + (spec.chroma[1] - spec.chroma[0]) * t;
    colors.push(oklchToHex({ L, C, h }));
  }
  return {
    id: spec.id,
    name: spec.name,
    colors,
    // The middle of the run reads as the mood better than either end, which are
    // its palest and deepest extremes.
    swatch: colors[Math.floor(STEPS / 2)],
  };
}

export const MOODS: Mood[] = SPECS.map(buildMood);

export const DEFAULT_MOOD_ID = 'candy';

export function findMood(id: string): Mood {
  return MOODS.find((m) => m.id === id) ?? MOODS[0];
}
