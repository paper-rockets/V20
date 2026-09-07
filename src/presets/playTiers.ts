/**
 * Play mode brush tier markers.
 *
 * This is NOT a second preset list — the only source of truth is brushPresets.ts.
 * playTiers marks which presets appear in Play mode, with kid-friendly labels and blurbs.
 */

export const PLAY_BRUSHES = ['spatial_pipe', 'conformal_bead', 'stipple_texture'] as const;

export const PLAY_BRUSH_LABELS: Record<(typeof PLAY_BRUSHES)[number], { label: string; blurb: string }> = {
  spatial_pipe: {
    label: 'Tube',
    blurb: 'Fat round line you can fly through the air',
  },
  conformal_bead: {
    label: 'Ribbon',
    blurb: 'Flat band that hugs whatever it lands on',
  },
  stipple_texture: {
    label: 'Star Dust',
    blurb: 'Sparkly scatter for glow and fur',
  },
};
