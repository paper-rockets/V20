/**
 * Adaptive Device Capability Detection & Quality Profile
 *
 * Detects low-power tablets and phones (Galaxy Tab S6 Lite class hardware:
 * Mali-G72 MP3 / Adreno 618, 4 GB RAM, 1200x2000 panel) and produces a single
 * quality profile that every renderer, engine and material path reads from.
 *
 * The S6 Lite pairs a high-resolution panel with a bandwidth- and fill-rate-limited
 * GPU. Rendering at native DPR (2.0 -> 2400x4000 backbuffer) saturates the fragment
 * pipeline before any shading work happens, so the single largest win is a strict
 * pixel-ratio clamp, followed by cutting full-resolution offscreen render targets.
 *
 * Detection is intentionally cheap and synchronous-after-first-call: the GPU probe
 * runs once against a throwaway 1x1 context and the result is memoized.
 */

export type PerformanceTier = 'low' | 'medium' | 'high';
export type MaterialTier = 'simple' | 'standard' | 'full';

export interface QualityProfile {
  /** Resolved hardware tier. */
  tier: PerformanceTier;
  /** True when the low-power tablet/phone path is active. */
  isLowPower: boolean;
  /** True when this specifically looks like Galaxy Tab S6 Lite class hardware. */
  isS6LiteClass: boolean;
  /** Human readable reason the tier was chosen (surfaced in the GPU telemetry panel). */
  reason: string;

  // --- Renderer ---------------------------------------------------------
  /** Hard ceiling passed to renderer.setPixelRatio(). */
  maxPixelRatio: number;
  /** Additional render-buffer scale applied on top of DPR (CSS upscales the result). */
  renderScale: number;
  /** MSAA on the default framebuffer. */
  antialias: boolean;
  /** Shader precision hint for the WebGL context. */
  precision: 'highp' | 'mediump';
  powerPreference: 'high-performance' | 'default' | 'low-power';

  // --- Lighting & shadows ----------------------------------------------
  shadows: boolean;
  shadowMapSize: number;
  /**
   * THREE shadow map constant (BasicShadowMap 0 | PCFShadowMap 1).
   * Typed as a literal union so it assigns to THREE.ShadowMapType without a cast,
   * while keeping this module free of a three import.
   */
  shadowMapType: 0 | 1;
  /** Max simultaneous shadow-casting directional lights. */
  maxShadowCasters: number;

  // --- Materials & textures --------------------------------------------
  materialTier: MaterialTier;
  maxAnisotropy: number;
  /** Generate a PMREM environment map for PBR reflections. */
  environmentMap: boolean;
  /** Max texture edge length; larger uploads are downscaled. */
  maxTextureSize: number;

  // --- Post-processing --------------------------------------------------
  /** Allow the multi-pass compositor at all. */
  postProcessing: boolean;
  bloom: boolean;
  /** Bloom target downsample divisor (higher = cheaper). */
  bloomDivisor: number;
  /** Use HalfFloat render targets; false falls back to UnsignedByte (half the bandwidth). */
  halfFloatTargets: boolean;
  /** Weighted-blended OIT transparency pipeline. */
  wboit: boolean;

  // --- Painting / UV ----------------------------------------------------
  uvPaintResolution: number;
  uvHistoryDepth: number;

  // --- Raycasting -------------------------------------------------------
  /** Max sub-samples interpolated between two pointer positions in a stroke. */
  maxStrokeSubSteps: number;
  /** Micro-jitter cross pattern retried when a ray misses (6 extra raycasts). */
  seamBridging: boolean;

  // --- Frame pacing -----------------------------------------------------
  /** Target frame rate while the user is interacting. 0 = uncapped. */
  targetFps: number;
  /** Frame rate the loop drops to once the scene has been static. */
  idleFps: number;
  /** Milliseconds of no scene change before idle pacing engages. */
  idleAfterMs: number;
}

/** Entry-level / bandwidth-limited mobile GPUs that need the low-power path. */
const LOW_POWER_GPU_PATTERNS: RegExp[] = [
  /mali-?g7[12]\b/i, // Mali-G71, Mali-G72 (Tab S6 Lite, Exynos 9611)
  /mali-?g5[27]\b/i, // Mali-G52, Mali-G57
  /mali-?g3[16]\b/i, // Mali-G31, Mali-G36
  /mali-?t\d/i, // Legacy Midgard
  /adreno.*\b6(0[589]|1[02358]|2[0])\b/i, // Adreno 605/608/609/610/612/613/615/618/620
  /adreno.*\b5(0[3-9]|1[0-9])\b/i, // Adreno 50x/51x
  /powervr.*(ge8|gm9)/i, // PowerVR entry tier
  /videocore/i, // Raspberry Pi
  /swiftshader|llvmpipe|software|basic render/i, // Software rasterizers
];

/** Flagship modern mobile GPUs (e.g. Snapdragon 8 series, Dimensity 9000, Apple A/M series). */
const FLAGSHIP_GPU_PATTERNS: RegExp[] = [
  /adreno.*\b(7\d\d|8\d\d)\b/i, // Adreno 730/740/750/830 (S22/S23/S24/S25 Ultra, Snapdragon 8 Gen 1-3 / Elite)
  /apple\s*(gpu|m\d|a1[4-9])/i, // Apple Silicon A14-A18, M1-M4
  /mali-?g7[1-9]\d|immortalis/i, // Mali-G710, G715, G720, Immortalis-G715/G720/G925
  /nvidia|geforce|rtx|gtx|radeon|intel.*(arc|iris|xe)/i, // Desktop / high-performance laptop GPUs
];

/** Specifically Galaxy Tab S6 Lite models & silicon (Exynos 9611 / Snapdragon 720G). */
const S6_LITE_PATTERNS: RegExp[] = [
  /SM-P61[0-9]/i, // SM-P610, SM-P613, SM-P615, SM-P619 (Galaxy Tab S6 Lite)
  /mali-?g72/i,
];

let cachedProfile: QualityProfile | null = null;
let cachedRendererString: string | null = null;

/**
 * One-shot unmasked GPU renderer probe. Uses a throwaway 1x1 context so it never
 * competes with the live renderer, and never runs more than once per session.
 */
export function probeGPURenderer(): string {
  if (cachedRendererString !== null) return cachedRendererString;
  cachedRendererString = '';

  if (typeof document === 'undefined') return cachedRendererString;

  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const gl = (canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;

    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const unmasked = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if (typeof unmasked === 'string') cachedRendererString = unmasked;
      }
      if (!cachedRendererString) {
        const fallback = gl.getParameter(gl.RENDERER);
        if (typeof fallback === 'string') cachedRendererString = fallback;
      }
      // Release the probe context immediately so it does not count against the
      // browser's per-page WebGL context budget (mobile Chrome allows ~8-16).
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    }
  } catch (_) {
    /* Probe failure is non-fatal; heuristics below still apply. */
  } finally {
    canvas = null;
  }

  return cachedRendererString;
}

/** Reads an explicit tier override from ?perf=, localStorage, or a global. */
function readOverride(): PerformanceTier | 's6lite' | null {
  if (typeof window === 'undefined') return null;

  const normalize = (raw: string | null | undefined): PerformanceTier | 's6lite' | null => {
    if (!raw) return null;
    const v = raw.toLowerCase().trim();
    if (v === 's6lite' || v === 'low' || v === 'medium' || v === 'high') {
      return v as PerformanceTier | 's6lite';
    }
    return null;
  };

  const globalOverride = normalize((window as any).__PERF_PROFILE__);
  if (globalOverride) return globalOverride;

  try {
    const params = new URLSearchParams(window.location.search);
    // The device simulator already uses ?device=s6lite; honour it as a perf hint too.
    const fromQuery = normalize(params.get('perf')) || normalize(params.get('quality'));
    if (fromQuery) return fromQuery;
    if (params.get('device') === 's6lite') return 's6lite';
  } catch (_) {
    /* Malformed URL; fall through. */
  }

  try {
    return normalize(window.localStorage?.getItem('remix.perfProfile'));
  } catch (_) {
    return null;
  }
}

interface DetectionSignals {
  renderer: string;
  cores: number;
  memoryGB: number;
  isTouch: boolean;
  isMobileUA: boolean;
  ua: string;
  screenPixels: number;
  dpr: number;
}

function gatherSignals(): DetectionSignals {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const ua = nav.userAgent || '';
  const screenW = typeof window !== 'undefined' ? window.screen?.width || 0 : 0;
  const screenH = typeof window !== 'undefined' ? window.screen?.height || 0 : 0;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  return {
    renderer: probeGPURenderer(),
    cores: nav.hardwareConcurrency || 4,
    memoryGB: (nav as any).deviceMemory || 0,
    isTouch: (nav.maxTouchPoints || 0) > 0 || (typeof window !== 'undefined' && 'ontouchstart' in window),
    isMobileUA: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Silk/i.test(ua),
    ua,
    // Physical pixels the GPU has to fill at native DPR.
    screenPixels: screenW * screenH * dpr * dpr,
    dpr,
  };
}

function classify(signals: DetectionSignals): { tier: PerformanceTier; isS6Lite: boolean; reason: string } {
  const { renderer, cores, memoryGB, isTouch, isMobileUA, ua, screenPixels } = signals;

  // 1. Check specifically for Galaxy Tab S6 Lite (SM-P610/P613/P615/P619 or Mali-G72)
  const isS6Lite = S6_LITE_PATTERNS.some((re) => re.test(ua) || re.test(renderer));
  if (isS6Lite) {
    return {
      tier: 'low',
      isS6Lite: true,
      reason: `Galaxy Tab S6 Lite detected (${renderer || ua.slice(0, 30)})`,
    };
  }

  // 2. Check for known Flagship mobile/desktop GPUs (e.g. S25 Ultra Adreno 830, S24 Adreno 750, Apple Silicon)
  const isFlagshipGPU = FLAGSHIP_GPU_PATTERNS.some((re) => re.test(renderer));
  const isFlagshipModel = /SM-S9[0-9]{2}/i.test(ua); // Samsung Galaxy S22/S23/S24/S25 series flagships
  if (isFlagshipGPU || isFlagshipModel) {
    return {
      tier: 'high',
      isS6Lite: false,
      reason: `Flagship hardware detected (${renderer || 'Galaxy S-Series Flagship'})`,
    };
  }

  // 3. Known budget / constrained mobile GPUs
  if (LOW_POWER_GPU_PATTERNS.some((re) => re.test(renderer))) {
    return { tier: 'low', isS6Lite: false, reason: `Low-power GPU detected (${renderer})` };
  }

  // 4. Explicit memory signal: devices with <= 4GB RAM on mobile are entry tier
  if (memoryGB > 0 && memoryGB <= 4 && (isMobileUA || isTouch)) {
    return { tier: 'low', isS6Lite: false, reason: `Constrained device memory (${memoryGB} GB)` };
  }

  // 5. Very low core count mobile CPUs (<= 4 cores)
  if (isMobileUA && cores <= 4) {
    return { tier: 'low', isS6Lite: false, reason: `Mobile CPU with ${cores} cores` };
  }

  // 6. High-end devices with >= 6GB RAM or >= 8 cores on modern mobile
  if ((memoryGB >= 6 || cores >= 8) && (isMobileUA || isTouch)) {
    return {
      tier: 'high',
      isS6Lite: false,
      reason: `High-end mobile device (${cores} cores, ${memoryGB ? memoryGB + 'GB RAM' : 'Fast SoC'})`,
    };
  }

  // 7. Modest desktop or tablet hardware
  if (cores <= 4 || (memoryGB > 0 && memoryGB <= 4)) {
    return { tier: 'medium', isS6Lite: false, reason: `Modest hardware (${cores} cores)` };
  }

  return { tier: 'high', isS6Lite: false, reason: `Standard high-performance hardware (${cores} cores)` };
}

/**
 * Shadow map type constants mirrored from three so this module stays dependency-free
 * and tree-shakeable (THREE.BasicShadowMap = 0, PCFShadowMap = 1).
 */
const BASIC_SHADOW_MAP = 0;
const PCF_SHADOW_MAP = 1;

function buildProfile(tier: PerformanceTier, isS6Lite: boolean, reason: string, dpr: number): QualityProfile {
  if (tier === 'low') {
    return {
      tier,
      isLowPower: true,
      isS6LiteClass: isS6Lite,
      reason,

      // Enable MSAA antialiasing even on low-tier: WebGL default framebuffer hardware MSAA
      // operates in tile cache on Mali/Adreno and eliminates jagged pixelated edges at zero cost.
      // Clamp DPR to 1.25 on S6 Lite so text and lines are crisp without fill-rate saturation.
      maxPixelRatio: isS6Lite ? Math.min(dpr, 1.25) : Math.min(dpr, 1.33),
      renderScale: 1.0,
      antialias: true,
      precision: 'mediump',
      powerPreference: 'high-performance',

      shadows: false,
      shadowMapSize: 512,
      shadowMapType: BASIC_SHADOW_MAP,
      maxShadowCasters: 1,

      materialTier: 'simple',
      maxAnisotropy: 1,
      environmentMap: false,
      maxTextureSize: 1024,

      postProcessing: false,
      bloom: false,
      bloomDivisor: 8,
      halfFloatTargets: false,
      wboit: false,

      uvPaintResolution: 1024,
      uvHistoryDepth: 3,

      maxStrokeSubSteps: 8,
      seamBridging: false,

      targetFps: 60,
      idleFps: 24,
      idleAfterMs: 3500,
    };
  }

  if (tier === 'medium') {
    return {
      tier,
      isLowPower: false,
      isS6LiteClass: false,
      reason,

      maxPixelRatio: Math.min(dpr, 1.5),
      renderScale: 1.0,
      antialias: true,
      precision: 'mediump',
      powerPreference: 'high-performance',

      shadows: true,
      shadowMapSize: 1024,
      shadowMapType: PCF_SHADOW_MAP,
      maxShadowCasters: 1,

      materialTier: 'standard',
      maxAnisotropy: 2,
      environmentMap: true,
      maxTextureSize: 2048,

      postProcessing: true,
      bloom: true,
      bloomDivisor: 4,
      halfFloatTargets: true,
      wboit: true,

      uvPaintResolution: 1024,
      uvHistoryDepth: 5,

      maxStrokeSubSteps: 24,
      seamBridging: true,

      targetFps: 60,
      idleFps: 30,
      idleAfterMs: 1500,
    };
  }

  return {
    tier,
    isLowPower: false,
    isS6LiteClass: false,
    reason,

    maxPixelRatio: Math.min(dpr, 2),
    renderScale: 1.0,
    antialias: true,
    precision: 'highp',
    powerPreference: 'high-performance',

    shadows: true,
    shadowMapSize: 2048,
    shadowMapType: PCF_SHADOW_MAP,
    maxShadowCasters: 2,

    materialTier: 'full',
    maxAnisotropy: 8,
    environmentMap: true,
    maxTextureSize: 4096,

    postProcessing: true,
    bloom: true,
    bloomDivisor: 4,
    halfFloatTargets: true,
    wboit: true,

    uvPaintResolution: 2048,
    uvHistoryDepth: 8,

    maxStrokeSubSteps: 48,
    seamBridging: true,

    targetFps: 0,
    idleFps: 30,
    idleAfterMs: 2000,
  };
}

/**
 * Returns the active quality profile, detecting hardware on first call and
 * memoizing thereafter. Safe to call from any hot path.
 */
export function getQualityProfile(): QualityProfile {
  if (cachedProfile) return cachedProfile;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const override = readOverride();

  if (override) {
    const tier: PerformanceTier = override === 's6lite' ? 'low' : override;
    cachedProfile = buildProfile(
      tier,
      override === 's6lite',
      override === 's6lite' ? 'Galaxy Tab S6 Lite preset (explicit)' : `Explicit "${override}" quality override`,
      dpr
    );
  } else {
    const signals = gatherSignals();
    const { tier, isS6Lite, reason } = classify(signals);
    cachedProfile = buildProfile(tier, isS6Lite, reason, signals.dpr);
  }

  if (typeof window !== 'undefined') {
    // Expose for the GPU telemetry panel and for manual tuning from devtools.
    (window as any).__QUALITY_PROFILE__ = cachedProfile;
  }

  return cachedProfile;
}

/**
 * Forces a tier at runtime (devtools / settings UI). Persists the choice and
 * returns the new profile. Callers must re-apply it to live engines.
 */
export function setQualityTier(tier: PerformanceTier | 's6lite'): QualityProfile {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const resolved: PerformanceTier = tier === 's6lite' ? 'low' : tier;
  cachedProfile = buildProfile(
    resolved,
    tier === 's6lite',
    tier === 's6lite' ? 'Galaxy Tab S6 Lite preset (manual)' : `Manual "${tier}" quality tier`,
    dpr
  );

  if (typeof window !== 'undefined') {
    (window as any).__QUALITY_PROFILE__ = cachedProfile;
    try {
      window.localStorage?.setItem('remix.perfProfile', tier);
    } catch (_) {
      /* Storage disabled; the in-memory profile still applies. */
    }
  }

  return cachedProfile;
}

/** Convenience predicate for the low-power branch. */
export function isLowPowerDevice(): boolean {
  return getQualityProfile().isLowPower;
}

/** Effective pixel ratio for a renderer, honouring both the clamp and render scale. */
export function resolvePixelRatio(profile: QualityProfile = getQualityProfile()): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.max(0.5, Math.min(dpr, profile.maxPixelRatio) * profile.renderScale);
}
