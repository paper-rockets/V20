import { StudioEngine } from '../../core/studioEngine';

/**
 * How many screen pixels one world unit covers at the point you are drawing.
 *
 * The size buttons used to draw a dot at `size * 110` and the size sheet drew
 * one at `size * 200` — two different arbitrary scales, so neither matched the
 * stroke you actually got, and they did not even match each other. "Thick" and
 * "Chunky" looked nearly identical while producing very different marks.
 *
 * A perspective camera covers `2 * d * tan(fov/2)` world units of height at
 * distance `d`, so the pixels-per-unit is just the viewport height over that.
 * Feeding the real camera distance in means the preview tracks zoom: pinch in
 * and the dots grow, exactly as the stroke does.
 */
export function pixelsPerWorldUnit(engine: StudioEngine | null, viewportHeightPx: number): number {
  if (!engine) return 900; // Sane default before the engine reports in.
  try {
    const camera = engine.getCamera();
    const fovRad = (camera.fov * Math.PI) / 180;
    // Distance to what is being drawn on. The orbit radius is the honest proxy:
    // the camera orbits the origin, which is where models are centred.
    const distance = Math.max(0.15, engine.getCameraSpherical().radius);
    const worldHeightAtDistance = 2 * distance * Math.tan(fovRad / 2);
    if (!Number.isFinite(worldHeightAtDistance) || worldHeightAtDistance <= 0) return 900;
    return viewportHeightPx / worldHeightAtDistance;
  } catch {
    return 900;
  }
}

/**
 * The on-screen diameter of a stroke, in CSS pixels.
 *
 * `brushWidthMultiplier` is what the Pro panel calls "Line Width Multiplier",
 * and a wide line really is that many times wider — so a preview that ignores
 * it is wrong for every wide brush.
 */
export function strokeDiameterPx(
  engine: StudioEngine | null,
  worldSize: number,
  widthMultiplier: number | undefined,
  viewportHeightPx: number
): number {
  const ppu = pixelsPerWorldUnit(engine, viewportHeightPx);
  return worldSize * (widthMultiplier ?? 1) * ppu;
}
