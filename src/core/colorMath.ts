/**
 * @license
 * Mathematical Color Core & Perceptual Color Space Pipeline
 *
 * Implements:
 * 1. sRGB <-> Linear RGB (un-gamma-corrected space for 3D illumination & glTF 2.0 vertex colors)
 * 2. Linear RGB <-> LMS Cone Space (Intermediate physiological cone excitation space)
 * 3. LMS Cone Space <-> OKLab Cartesian Space (Perceptually uniform L, a, b coordinates)
 * 4. OKLab Cartesian Brush Blending (prevents muddy dead zones in complementary transitions)
 * 5. PBR Lighting & Specular reflection formulas in pure Linear RGB
 * 6. glTF 2.0 Vertex Color export transformers (Linear RGB with standard sRGB UI preservation)
 */

import * as THREE from 'three';

export interface LinearRGB {
  r: number;
  g: number;
  b: number;
}

export interface LMSColor {
  l: number;
  m: number;
  s: number;
}

export interface OKLabColor {
  L: number; // Perceived Lightness [0, 1]
  a: number; // Green (-) to Red (+) [-0.4, 0.4]
  b: number; // Blue (-) to Yellow (+) [-0.4, 0.4]
}

export interface OKLCHColor {
  L: number; // Lightness [0, 1]
  C: number; // Chroma [0, 0.4]
  h: number; // Hue in radians [0, 2*PI)
}

// =========================================================================
// 1. sRGB <-> Linear RGB Conversions (IEC 61966-2-1 Transfer Function)
// =========================================================================

/**
 * Converts a non-linear sRGB channel [0..1] to Linear RGB
 */
export function srgbChannelToLinear(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  if (clamped <= 0.04045) {
    return clamped / 12.92;
  }
  return Math.pow((clamped + 0.055) / 1.055, 2.4);
}

/**
 * Converts a Linear RGB channel [0..1] to non-linear sRGB
 */
export function linearChannelToSRGB(c: number): number {
  const clamped = Math.max(0, c);
  if (clamped <= 0.0031308) {
    return clamped * 12.92;
  }
  return 1.055 * Math.pow(clamped, 1.0 / 2.4) - 0.055;
}

/**
 * Converts non-linear sRGB (0..1) to Linear RGB
 */
export function srgbToLinearRGB(r: number, g: number, b: number): LinearRGB {
  return {
    r: srgbChannelToLinear(r),
    g: srgbChannelToLinear(g),
    b: srgbChannelToLinear(b),
  };
}

/**
 * Converts Linear RGB to non-linear sRGB (0..1)
 */
export function linearRGBToSRGB(r: number, g: number, b: number): { r: number; g: number; b: number } {
  return {
    r: Math.max(0, Math.min(1, linearChannelToSRGB(r))),
    g: Math.max(0, Math.min(1, linearChannelToSRGB(g))),
    b: Math.max(0, Math.min(1, linearChannelToSRGB(b))),
  };
}

// =========================================================================
// 2. Linear RGB <-> LMS Cone Space (Björn Ottosson Matrix)
// =========================================================================

/**
 * Converts Linear RGB to intermediate physiological LMS Cone Space
 * Matrix M1 for OKLab:
 *   L = 0.4122214708*R + 0.5363325363*G + 0.0514459929*B
 *   M = 0.2119034982*R + 0.6806995451*G + 0.1073969566*B
 *   S = 0.0883024619*R + 0.2817188376*G + 0.6299787005*B
 */
export function linearRGBToLMS(r: number, g: number, b: number): LMSColor {
  return {
    l: 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    m: 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    s: 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  };
}

/**
 * Converts LMS Cone Space back to Linear RGB
 * Inverse Matrix M1^-1:
 *   R = +4.0767416621*L - 3.3077115913*M + 0.2309699292*S
 *   G = -1.2684380046*L + 2.6097574011*M - 0.3413193965*S
 *   B = -0.0041960863*L - 0.7034186147*M + 1.7076147010*S
 */
export function lmsToLinearRGB(l: number, m: number, s: number): LinearRGB {
  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

// =========================================================================
// 3. LMS Cone Space <-> OKLab Cartesian Space (L, a, b)
// =========================================================================

/**
 * Converts LMS Cone Space to Cartesian OKLab (L, a, b)
 * Uses cube-root non-linear response followed by Matrix M2 projection.
 */
export function lmsToOKLab(l: number, m: number, s: number): OKLabColor {
  const l_ = Math.cbrt(Math.max(0, l));
  const m_ = Math.cbrt(Math.max(0, m));
  const s_ = Math.cbrt(Math.max(0, s));

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

/**
 * Converts Cartesian OKLab (L, a, b) back to LMS Cone Space
 */
export function oklabToLMS(L: number, a: number, b: number): LMSColor {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  return {
    l: l_ * l_ * l_,
    m: m_ * m_ * m_,
    s: s_ * s_ * s_,
  };
}

// =========================================================================
// 4. Direct Full Pipeline Projections (Linear RGB <-> OKLab)
// =========================================================================

/**
 * Converts Linear RGB to Cartesian OKLab via intermediate LMS Cone Space
 */
export function linearRGBToOKLab(r: number, g: number, b: number): OKLabColor {
  const lms = linearRGBToLMS(r, g, b);
  return lmsToOKLab(lms.l, lms.m, lms.s);
}

/**
 * Converts Cartesian OKLab back to Linear RGB via intermediate LMS Cone Space
 */
export function oklabToLinearRGB(L: number, a: number, b: number): LinearRGB {
  const lms = oklabToLMS(L, a, b);
  return lmsToLinearRGB(lms.l, lms.m, lms.s);
}

/**
 * Converts Hex string (#rrggbb) to Cartesian OKLab
 */
export function hexToOKLab(hex: string): OKLabColor {
  const color = new THREE.Color(hex);
  // Three.js Color r, g, b are sRGB float components when created from Hex
  const linear = srgbToLinearRGB(color.r, color.g, color.b);
  return linearRGBToOKLab(linear.r, linear.g, linear.b);
}

/**
 * Converts Cartesian OKLab to Hex string (#rrggbb)
 */
export function oklabToHex(L: number, a: number, b: number): string {
  const linear = oklabToLinearRGB(L, a, b);
  const srgb = linearRGBToSRGB(linear.r, linear.g, linear.b);
  const r = Math.max(0, Math.min(255, Math.round((Number.isFinite(srgb.r) ? srgb.r : 0) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((Number.isFinite(srgb.g) ? srgb.g : 0) * 255)));
  const b_ = Math.max(0, Math.min(255, Math.round((Number.isFinite(srgb.b) ? srgb.b : 0) * 255)));
  const hexR = r.toString(16).padStart(2, '0');
  const hexG = g.toString(16).padStart(2, '0');
  const hexB = b_.toString(16).padStart(2, '0');
  return '#' + hexR + hexG + hexB;
}

/**
 * Converts Cartesian OKLab to cylindrical OKLCH (Lightness, Chroma, Hue)
 */
export function oklabToOKLCH(lab: OKLabColor): OKLCHColor {
  const C = Math.hypot(lab.a, lab.b);
  let h = Math.atan2(lab.b, lab.a);
  if (h < 0) h += Math.PI * 2;
  return { L: lab.L, C, h };
}

/**
 * Converts cylindrical OKLCH back to Cartesian OKLab
 */
export function oklchToOKLab(lch: OKLCHColor): OKLabColor {
  const hRad = lch.h > Math.PI * 2 ? (lch.h * Math.PI) / 180 : lch.h;
  return {
    L: Math.max(0, Math.min(1, lch.L)),
    a: lch.C * Math.cos(hRad),
    b: lch.C * Math.sin(hRad),
  };
}

// =========================================================================
// 5. Perceptually Uniform OKLab Cartesian Blending (No Muddy Dead Zones)
// =========================================================================

/**
 * Converts Hex string (#rrggbb) to cylindrical OKLCH (Lightness 0..1, Chroma 0..0.4, Hue in radians 0..2*PI)
 */
export function hexToOKLCH(hex: string): OKLCHColor {
  const lab = hexToOKLab(hex);
  return oklabToOKLCH(lab);
}

/**
 * Converts cylindrical OKLCH (Lightness 0..1, Chroma 0..0.4, Hue in radians or degrees) to Hex string (#rrggbb)
 */
export function oklchToHex(lch: OKLCHColor): string {
  const lab = oklchToOKLab(lch);
  return oklabToHex(lab.L, lab.a, lab.b);
}

// =========================================================================
// 5. HSV <-> RGB <-> Hex Conversions
// =========================================================================

export interface HSVColor {
  h: number; // 0..360 degrees
  s: number; // 0..1 (or 0..100%)
  v: number; // 0..1 (or 0..100%)
}

/**
 * Converts HSV to RGB (0..255)
 */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const normalizedH = ((h % 360) + 360) % 360;
  const clampedS = Math.max(0, Math.min(1, s));
  const clampedV = Math.max(0, Math.min(1, v));

  const c = clampedV * clampedS;
  const x = c * (1 - Math.abs(((normalizedH / 60) % 2) - 1));
  const m = clampedV - c;

  let r1 = 0, g1 = 0, b1 = 0;
  if (normalizedH < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (normalizedH < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (normalizedH < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (normalizedH < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (normalizedH < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Converts RGB (0..255) to HSV
 */
export function rgbToHsv(r: number, g: number, b: number): HSVColor {
  const rNorm = Math.max(0, Math.min(255, r)) / 255;
  const gNorm = Math.max(0, Math.min(255, g)) / 255;
  const bNorm = Math.max(0, Math.min(255, b)) / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta === 0) {
    h = 0;
  } else if (max === rNorm) {
    h = ((gNorm - bNorm) / delta) % 6;
  } else if (max === gNorm) {
    h = (bNorm - rNorm) / delta + 2;
  } else {
    h = (rNorm - gNorm) / delta + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

/**
 * Converts Hex string to HSV
 */
export function hexToHsv(hex: string): HSVColor {
  const col = new THREE.Color(hex);
  return rgbToHsv(col.r * 255, col.g * 255, col.b * 255);
}

/**
 * Converts HSV to Hex string
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  const rHex = rgb.r.toString(16).padStart(2, '0');
  const gHex = rgb.g.toString(16).padStart(2, '0');
  const bHex = rgb.b.toString(16).padStart(2, '0');
  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Converts Hex string (#rrggbb) to RGB (0..255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const color = new THREE.Color(hex);
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
  };
}

/**
 * Converts RGB (0..255) to Hex string (#rrggbb)
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const rHex = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
  const gHex = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
  const bHex = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Alias for hexToOKLCH
 */
export const hexToOklch = hexToOKLCH;

// =========================================================================
// 6. Perceptually Uniform OKLab Cartesian & OKLCh Polar Blending
// =========================================================================

/**
 * Mixes two colors in Cartesian OKLab space (L, a, b).
 * This eliminates the muddy gray/brown dead zones that occur in naive sRGB/RGB mixing
 * when transitioning between complementary hues (e.g. Blue <-> Yellow, Red <-> Cyan).
 *
 * @param hexA Start color in hex (#rrggbb)
 * @param hexB End color in hex (#rrggbb)
 * @param t Interpolation factor [0..1]
 * @returns Blended color in hex (#rrggbb)
 */
export function oklabMix(hexA: string, hexB: string, t: number): string {
  const labA = hexToOKLab(hexA);
  const labB = hexToOKLab(hexB);

  const clampedT = Math.max(0, Math.min(1, t));

  // Cartesian linear interpolation in perceptually uniform space
  const mixedL = labA.L + (labB.L - labA.L) * clampedT;
  const mixedA = labA.a + (labB.a - labA.a) * clampedT;
  const mixedB = labA.b + (labB.b - labA.b) * clampedT;

  return oklabToHex(mixedL, mixedA, mixedB);
}

/**
 * Mixes two colors in Polar OKLCh space (Lightness, Chroma, Hue Angle).
 * Preserves pure vivid hue saturation along the cylindrical polar arc,
 * allowing vibrant rainbow or complementary sweeps without desaturation dip.
 *
 * @param hexA Start color in hex (#rrggbb)
 * @param hexB End color in hex (#rrggbb)
 * @param t Interpolation factor [0..1]
 * @param hueDirection 'shorter' (default) or 'longer' path around the hue circle
 * @returns Blended color in hex (#rrggbb)
 */
export function oklchMix(
  hexA: string,
  hexB: string,
  t: number,
  hueDirection: 'shorter' | 'longer' = 'shorter'
): string {
  const lchA = hexToOKLCH(hexA);
  const lchB = hexToOKLCH(hexB);

  const clampedT = Math.max(0, Math.min(1, t));

  // Interpolate Lightness and Chroma linearly
  const mixedL = lchA.L + (lchB.L - lchA.L) * clampedT;
  const mixedC = lchA.C + (lchB.C - lchA.C) * clampedT;

  // Polar Hue Interpolation
  let hA = lchA.h;
  let hB = lchB.h;

  let deltaH = hB - hA;
  const twoPi = Math.PI * 2;

  if (hueDirection === 'shorter') {
    if (deltaH > Math.PI) {
      deltaH -= twoPi;
    } else if (deltaH < -Math.PI) {
      deltaH += twoPi;
    }
  } else {
    if (deltaH > 0 && deltaH < Math.PI) {
      deltaH -= twoPi;
    } else if (deltaH < 0 && deltaH > -Math.PI) {
      deltaH += twoPi;
    }
  }

  let mixedH = (hA + deltaH * clampedT) % twoPi;
  if (mixedH < 0) mixedH += twoPi;

  return oklchToHex({ L: mixedL, C: mixedC, h: mixedH });
}

/**
 * Generates an N-step perceptually uniform gradient palette between two colors using OKLab Cartesian interpolation
 */
export function generateOKLabGradient(hexA: string, hexB: string, steps: number = 8): string[] {
  if (steps <= 1) return [hexA];
  const results: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    results.push(oklabMix(hexA, hexB, t));
  }
  return results;
}

/**
 * Generates an N-step hue-preserving gradient palette between two colors using Polar OKLCh interpolation
 */
export function generateOKLCHGradient(
  hexA: string,
  hexB: string,
  steps: number = 8,
  hueDirection: 'shorter' | 'longer' = 'shorter'
): string[] {
  if (steps <= 1) return [hexA];
  const results: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    results.push(oklchMix(hexA, hexB, t, hueDirection));
  }
  return results;
}

// =========================================================================
// 7. Harmonious Palette Generation & OKLCh Posterization
// =========================================================================

export interface ColorHarmonies {
  base: string;
  complementary: string[];
  analogous: string[];
  triadic: string[];
  tetradic: string[];
  splitComplementary: string[];
  monochromaticRamp: string[];
  tonalChromaRamp: string[];
}

/**
 * Generates perceptually uniform harmonious color sets in Polar OKLCh space
 */
export function generateHarmonies(hex: string): ColorHarmonies {
  const lch = hexToOKLCH(hex);
  const radToDeg = 180 / Math.PI;
  const degToRad = Math.PI / 180;
  const currentHueDeg = lch.h * radToDeg;

  const makeColorAtHue = (degOffset: number, lFactor: number = 1.0, cFactor: number = 1.0) => {
    const newHueRad = (((currentHueDeg + degOffset) % 360 + 360) % 360) * degToRad;
    const newL = Math.max(0.05, Math.min(0.98, lch.L * lFactor));
    const newC = Math.max(0.01, Math.min(0.35, lch.C * cFactor));
    return oklchToHex({ L: newL, C: newC, h: newHueRad });
  };

  // 1. Complementary (180 deg)
  const complementary = [
    hex,
    makeColorAtHue(180),
  ];

  // 2. Analogous (-30, -15, 0, +15, +30 deg)
  const analogous = [
    makeColorAtHue(-35),
    makeColorAtHue(-18),
    hex,
    makeColorAtHue(18),
    makeColorAtHue(35),
  ];

  // 3. Triadic (0, 120, 240 deg)
  const triadic = [
    hex,
    makeColorAtHue(120),
    makeColorAtHue(240),
  ];

  // 4. Tetradic / Square (0, 90, 180, 270 deg)
  const tetradic = [
    hex,
    makeColorAtHue(90),
    makeColorAtHue(180),
    makeColorAtHue(270),
  ];

  // 5. Split-Complementary (0, 150, 210 deg)
  const splitComplementary = [
    hex,
    makeColorAtHue(150),
    makeColorAtHue(210),
  ];

  // 6. Monochromatic 9-step Lightness Ramp (L from 0.15 to 0.95 with smooth chroma tapering)
  const monochromaticRamp: string[] = [];
  for (let i = 0; i < 9; i++) {
    const lVal = 0.15 + (i / 8) * 0.80;
    // Scale chroma so extreme dark/light shades don't clip out of sRGB gamut
    const cScale = Math.sin((i / 8) * Math.PI) * 0.9 + 0.1;
    monochromaticRamp.push(oklchToHex({
      L: lVal,
      C: Math.max(0.01, Math.min(0.35, lch.C * cScale)),
      h: lch.h,
    }));
  }

  // 7. Tonal Chroma Ramp (C from 0.0 to 0.32 at constant Lightness & Hue)
  const tonalChromaRamp: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cVal = (i / 6) * 0.32;
    tonalChromaRamp.push(oklchToHex({
      L: lch.L,
      C: cVal,
      h: lch.h,
    }));
  }

  return {
    base: hex,
    complementary,
    analogous,
    triadic,
    tetradic,
    splitComplementary,
    monochromaticRamp,
    tonalChromaRamp,
  };
}

/**
 * Posterizes / quantizes color in OKLCh polar space into stepped discrete bands
 */
export function posterizeOKLCH(hex: string, levels: number = 4): string {
  const lch = hexToOKLCH(hex);
  const safeLevels = Math.max(2, Math.min(16, levels));
  const step = 1.0 / (safeLevels - 1);
  const quantL = Math.round(lch.L / step) * step;
  const quantC = Math.round(lch.C / (0.35 / (safeLevels - 1))) * (0.35 / (safeLevels - 1));
  const hueSteps = safeLevels * 2;
  const hueStepRad = (Math.PI * 2) / hueSteps;
  const quantH = Math.round(lch.h / hueStepRad) * hueStepRad;

  return oklchToHex({
    L: Math.max(0.05, Math.min(0.95, quantL)),
    C: Math.max(0.0, Math.min(0.35, quantC)),
    h: quantH % (Math.PI * 2),
  });
}

// =========================================================================
// 6. 3D Illumination & PBR Lighting in Pure Linear RGB Space
// =========================================================================

/**
 * Computes physically-based diffuse & specular illumination in un-gamma-corrected Linear RGB space
 */
export function computeLinearIllumination(
  surfaceLinearRGB: LinearRGB,
  lightLinearRGB: LinearRGB,
  normal: THREE.Vector3,
  lightDir: THREE.Vector3,
  viewDir: THREE.Vector3,
  roughness: number = 0.35,
  metalness: number = 0.15
): LinearRGB {
  const N = normal.clone().normalize();
  const L = lightDir.clone().normalize();
  const V = viewDir.clone().normalize();
  const H = L.clone().add(V).normalize();

  const NdotL = Math.max(0.0, N.dot(L));
  const NdotH = Math.max(0.0, N.dot(H));
  const NdotV = Math.max(0.001, N.dot(V));

  // Diffuse: Lambertian in Linear RGB
  const diffuseFactor = NdotL;

  // Specular: GGX / Blinn-Phong approximation in Linear RGB
  const alpha = Math.max(0.04, roughness * roughness);
  const specPower = 2.0 / (alpha * alpha) - 2.0;
  const specularFactor = Math.pow(NdotH, specPower) * (NdotL / Math.max(0.001, NdotL + NdotV));

  // Fresnel Schlick approximation (F0 dielectric 0.04, metalness interpolates towards albedo)
  const F0_r = 0.04 * (1 - metalness) + surfaceLinearRGB.r * metalness;
  const F0_g = 0.04 * (1 - metalness) + surfaceLinearRGB.g * metalness;
  const F0_b = 0.04 * (1 - metalness) + surfaceLinearRGB.b * metalness;

  const fresnel = Math.pow(1.0 - Math.max(0, V.dot(H)), 5.0);

  const spec_r = (F0_r + (1 - F0_r) * fresnel) * specularFactor;
  const spec_g = (F0_g + (1 - F0_g) * fresnel) * specularFactor;
  const spec_b = (F0_b + (1 - F0_b) * fresnel) * specularFactor;

  // Combine in Linear RGB
  return {
    r: surfaceLinearRGB.r * (1 - metalness) * lightLinearRGB.r * diffuseFactor + lightLinearRGB.r * spec_r,
    g: surfaceLinearRGB.g * (1 - metalness) * lightLinearRGB.g * diffuseFactor + lightLinearRGB.g * spec_g,
    b: surfaceLinearRGB.b * (1 - metalness) * lightLinearRGB.b * diffuseFactor + lightLinearRGB.b * spec_b,
  };
}

// =========================================================================
// 7. glTF 2.0 Spec Vertex Color Exporter Transformer
// =========================================================================

/**
 * Converts sRGB color array (e.g. from UI input / canvas) into glTF 2.0 compliant
 * Linear RGB vertex color Float32Array (normalized 0.0 - 1.0).
 *
 * According to the glTF 2.0 specification (Section 3.7.2.1):
 * "COLOR_0 values are linear colors, not sRGB."
 */
export function convertColorArrayToLinearGLTF(srgbColors: Float32Array | number[]): Float32Array {
  const len = srgbColors.length;
  const linearColors = new Float32Array(len);

  // Checks if array is RGB (stride 3) or RGBA (stride 4)
  const isRGBA = len % 4 === 0 && len > 0;
  const stride = isRGBA ? 4 : 3;

  for (let i = 0; i < len; i += stride) {
    linearColors[i] = srgbChannelToLinear(srgbColors[i]);
    linearColors[i + 1] = srgbChannelToLinear(srgbColors[i + 1]);
    linearColors[i + 2] = srgbChannelToLinear(srgbColors[i + 2]);
    if (stride === 4) {
      linearColors[i + 3] = srgbColors[i + 3]; // Alpha is always linear in glTF
    }
  }

  return linearColors;
}

/**
 * Applies Linear RGB transformation to geometry's 'color' attribute for glTF export
 */
export function ensureGeometryLinearVertexColors(geometry: THREE.BufferGeometry): void {
  const colorAttr = geometry.getAttribute('color');
  if (!colorAttr) return;

  const array = colorAttr.array as Float32Array;
  const linear = convertColorArrayToLinearGLTF(array);
  geometry.setAttribute('color', new THREE.BufferAttribute(linear, colorAttr.itemSize));
}

// =========================================================================
// 8. GLSL & TSL Shader Chunks for Linear RGB <-> LMS <-> OKLab
// =========================================================================

export const OKLAB_FULL_PIPELINE_GLSL = `
// =========================================================================
// Linear RGB <-> LMS Cone Space <-> OKLab Cartesian Space (GLSL Pipeline)
// =========================================================================

vec3 srgb_to_linear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linear_to_srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Linear RGB to LMS Cone Space (Björn Ottosson Matrix M1)
vec3 linear_to_lms(vec3 c) {
  return vec3(
    0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b,
    0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b,
    0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b
  );
}

// LMS Cone Space to Linear RGB (Inverse Matrix M1^-1)
vec3 lms_to_linear(vec3 lms) {
  return vec3(
    +4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
    -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
    -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z
  );
}

// LMS to Cartesian OKLab (L, a, b)
vec3 lms_to_oklab(vec3 lms) {
  vec3 lms_ = pow(max(lms, vec3(0.0)), vec3(1.0 / 3.0));
  return vec3(
    0.2104542553 * lms_.x + 0.7936177850 * lms_.y - 0.0040720468 * lms_.z,
    1.9779984951 * lms_.x - 2.4285922050 * lms_.y + 0.4505937099 * lms_.z,
    0.0259040371 * lms_.x + 0.7827717662 * lms_.y - 0.8086757660 * lms_.z
  );
}

// Cartesian OKLab (L, a, b) to LMS
vec3 oklab_to_lms(vec3 lab) {
  vec3 lms_ = vec3(
    lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z,
    lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z,
    lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z
  );
  return lms_ * lms_ * lms_;
}

// Direct Linear RGB <-> OKLab
vec3 linear_srgb_to_oklab(vec3 c) {
  return lms_to_oklab(linear_to_lms(c));
}

vec3 oklab_to_linear_srgb(vec3 lab) {
  return lms_to_linear(oklab_to_lms(lab));
}

// Perceptually Uniform Cartesian OKLab Mixing
vec3 oklab_mix(vec3 colA, vec3 colB, float t) {
  vec3 labA = linear_srgb_to_oklab(srgb_to_linear(colA));
  vec3 labB = linear_srgb_to_oklab(srgb_to_linear(colB));
  vec3 mixedLab = mix(labA, labB, clamp(t, 0.0, 1.0));
  return linear_to_srgb(clamp(oklab_to_linear_srgb(mixedLab), 0.0, 1.0));
}

// Linear RGB mixing in OKLab space (returns un-gamma-corrected Linear RGB)
vec3 oklab_mix_linear(vec3 linearColA, vec3 linearColB, float t) {
  vec3 labA = linear_srgb_to_oklab(linearColA);
  vec3 labB = linear_srgb_to_oklab(linearColB);
  vec3 mixedLab = mix(labA, labB, clamp(t, 0.0, 1.0));
  return clamp(oklab_to_linear_srgb(mixedLab), 0.0, 1.0);
}
`;
