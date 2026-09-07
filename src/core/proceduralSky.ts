import * as THREE from 'three';
import { EnvironmentPreset, SkyMode, ShadeMode } from '../types/skybox';
import { DEFAULT_PRESETS } from '../constants/presets';
import { hexToRgb, sphericalToCartesian, timeOfDayToSunAngles } from '../engine/colorUtils';

export type SkyPresetName =
  | 'clear-day'
  | 'sunset-dusk'
  | 'desert-mirage'
  | 'overcast-storm'
  | 'misty-dawn'
  | 'ghibli-summer'
  | 'deep-night'
  | 'cyberpunk-neon'
  | 'studio-neutral'
  | 'daylight'
  | 'day'
  | 'dusk'
  | 'noon'
  | 'golden'
  | 'ghibli'
  | 'mist'
  | 'overcast'
  | 'night'
  | 'off';

export interface SkySettings {
  preset: string;
  enableClouds: boolean;
  cloudCoverage: number;
  cloudDensity: number;
  cloudSpeed: number;
  cloudWindAngle: number;
  cloudScale: number;
  cloudTurbulence: number;
  cloudOpacity: number;
  cloudColor: string;
  cloudShadow: string;
  enableGodRays: boolean;
  godRaysIntensity: number;
  godRaysDensity: number;
  godRaysDecay: number;
  godRaysColor: string;
  sunElevation: number;
  sunAzimuth: number;
  sunCoronaIntensity: number;
  sunIntensity: number;
  sunColor: string;
  ambientIntensity: number;
  starDensity: number;
  starBrightness: number;
  starTwinkle: number;
  milkyWay: number;
}

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vLocalDirection;

void main() {
  vLocalDirection = normalize(position);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vec4 clipPos = projectionMatrix * viewMatrix * worldPos;
  gl_Position = clipPos.xyww;
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform vec3 uSunPosition;
uniform vec3 uSkyColorZenith;
uniform vec3 uSkyColorMid;
uniform vec3 uSkyColorHorizon;
uniform vec3 uSunColor;
uniform float uGradientPower;
uniform float uGradientMidOffset;
uniform float uSunCoronaIntensity;
uniform float uSunDiscSize;

// Clouds & Movements
uniform vec3 uCloudColor;
uniform vec3 uCloudShadowColor;
uniform float uCloudCoverage;
uniform float uCloudDensity;
uniform float uCloudEdge;
uniform float uCloudSpeed;
uniform float uCloudWindAngle;
uniform float uCloudScale;
uniform float uCloudTurbulence;
uniform float uCloudOpacity;
uniform float uEnableClouds;

// God Rays
uniform float uEnableGodRays;
uniform float uGodRaysIntensity;
uniform float uGodRaysDensity;
uniform float uGodRaysDecay;
uniform vec3 uGodRaysColor;

// Atmospheric Transitions
uniform float uNightFactor;
uniform float uDuskFactor;
uniform float uHorizonGlow;
uniform float uStarDensity;
uniform float uStarBrightness;
uniform float uStarTwinkle;
uniform float uMilkyWay;
uniform vec3 uNightColor;

varying vec3 vWorldPosition;
varying vec3 vLocalDirection;

// Noise & Hash helper functions
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += vec3(dot(p3, p3.yzx + vec3(33.33)));
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

vec3 getStarsAndMilkyWay(vec3 dir, float nightFactor, float time) {
  if (dir.y < -0.05 || nightFactor < 0.01) return vec3(0.0);

  // 1. REALISTIC MILKY WAY BAND
  // Angled galactic plane normal vector (tilted ~60 degrees from celestial pole)
  vec3 galacticNormal = normalize(vec3(0.55, 0.72, 0.42));
  float galacticDist = abs(dot(dir, galacticNormal));
  
  // Milky Way core bulge (towards galactic center)
  vec3 galacticCenter = normalize(vec3(0.65, 0.35, -0.68));
  float centerProximity = max(0.0, dot(dir, galacticCenter));
  float coreBulge = pow(centerProximity, 3.5) * 0.6;

  // Cosmic clouds and dark dust rifts
  float mwNoise1 = noise(dir.xz * 4.5 + dir.y * 2.0);
  float mwNoise2 = noise(dir.xy * 9.0 + vec2(15.3, 7.1));
  float dustRift = smoothstep(0.02, 0.20, abs(galacticDist - 0.045 * mwNoise1));
  
  // Outer diffuse glow + dense inner river of light
  float nebulaBand = smoothstep(0.55, 0.0, galacticDist);
  float innerBand = smoothstep(0.22, 0.0, galacticDist);
  
  float mwIntensity = (nebulaBand * 0.35 + innerBand * 0.7 + coreBulge) * dustRift * (0.6 + 0.4 * mwNoise2);
  
  // Rich celestial colors: Deep violet-indigo outer haze + warm stellar cream core
  vec3 outerNebula = vec3(0.38, 0.48, 0.88);
  vec3 coreNebula = vec3(0.95, 0.85, 0.72);
  vec3 mwColor = mix(outerNebula, coreNebula, innerBand * 0.8 + coreBulge * 0.5) * mwIntensity * 0.5;

  // 2. ROUND ANTI-ALIASED STARS (2 Distinct Layers)
  vec2 starUv1 = (dir.xz / (abs(dir.y) + 0.35)) * 95.0;
  vec2 starUv2 = (dir.xy / (abs(dir.z) + 0.35)) * 80.0;
  
  // --- Layer A: Fine shimmering background stars ---
  vec2 cell1 = floor(starUv1);
  float h1 = hash(cell1);
  vec3 starColor1 = vec3(0.0);
  if (h1 > 0.972) {
    vec2 offset1 = fract(starUv1) - 0.5;
    float dist1 = length(offset1);
    float tw1 = sin(time * 2.2 + h1 * 77.0) * 0.35 + 0.65;
    float radius1 = 0.07 + (h1 - 0.972) * 2.5;
    float brightness1 = smoothstep(radius1, 0.0, dist1) * tw1;
    // Stellar spectral classification colors
    vec3 tempTint = mix(vec3(0.75, 0.88, 1.0), vec3(1.0, 0.82, 0.65), hash(cell1 + vec2(11.2, 5.7)));
    starColor1 = tempTint * brightness1 * 2.0;
  }

  // --- Layer B: Prominent bright focal stars with soft glow ---
  vec2 cell2 = floor(starUv2);
  float h2 = hash(cell2 + vec2(33.7, 91.1));
  vec3 starColor2 = vec3(0.0);
  if (h2 > 0.988) {
    vec2 offset2 = fract(starUv2) - 0.5;
    float dist2 = length(offset2);
    float tw2 = sin(time * 3.5 + h2 * 123.0) * 0.4 + 0.6;
    float core2 = smoothstep(0.06, 0.0, dist2) * 2.8;
    float halo2 = smoothstep(0.25, 0.0, dist2) * 0.7;
    vec3 tint2 = mix(vec3(0.85, 0.95, 1.0), vec3(1.0, 0.9, 0.7), hash(cell2));
    starColor2 = tint2 * (core2 + halo2) * tw2;
  }

  // --- Star clusters along the Milky Way core ---
  float clusterStars = 0.0;
  if (innerBand > 0.1 && h1 > 0.94) {
    vec2 offsetC = fract(starUv1) - 0.5;
    clusterStars = smoothstep(0.05, 0.0, length(offsetC)) * innerBand * 1.5;
  }

  // Soft atmospheric fade at horizon
  float horizonFade = smoothstep(-0.02, 0.22, dir.y);
  
  vec3 totalNightSky = (starColor1 + starColor2 + vec3(clusterStars) * vec3(0.9, 0.95, 1.0) + mwColor) * horizonFade * nightFactor;
  return totalNightSky;
}

void main() {
  vec3 dir = normalize(vLocalDirection);

  // 1. SKY GRADIENT (Zenith -> Mid -> Horizon -> Below Horizon)
  float h = clamp(dir.y, 0.0, 1.0);
  float gradT = pow(1.0 - h, uGradientPower);

  vec3 upperSky = mix(uSkyColorZenith, uSkyColorMid, clamp(gradT / max(0.01, uGradientMidOffset), 0.0, 1.0));
  vec3 lowerSky = mix(uSkyColorMid, uSkyColorHorizon, clamp((gradT - uGradientMidOffset) / max(0.01, 1.0 - uGradientMidOffset), 0.0, 1.0));
  vec3 baseSky = mix(upperSky, lowerSky, gradT);

  // Horizon warm glow
  float horizonFactor = pow(1.0 - abs(dir.y), 6.0) * uHorizonGlow;
  baseSky = mix(baseSky, uSkyColorHorizon * 1.15, horizonFactor * 0.45);

  // Night / Dusk sky blend
  baseSky = mix(baseSky, uNightColor, clamp(uNightFactor, 0.0, 1.0));

  // Seamless continuation below horizon: NO ARTIFICIAL GROUND PLANE!
  if (dir.y < 0.0) {
    float belowFade = clamp(-dir.y * 1.5, 0.0, 1.0);
    // Smoothly settle into a soft atmospheric horizon haze (seamless transition, no ground)
    vec3 hazeCol = mix(uSkyColorHorizon, uNightColor, clamp(uNightFactor, 0.0, 1.0));
    baseSky = mix(baseSky, hazeCol * 0.95, belowFade * 0.35);
  }

  // 2. STARS & MILKY WAY
  baseSky += getStarsAndMilkyWay(dir, uNightFactor, uTime);

  // 3. CELESTIAL SUN & MOON
  vec3 sunDir = normalize(uSunPosition);
  vec3 celestialLight = vec3(0.0);

  if (uNightFactor < 0.5) {
    // Day Sun
    float sunDot = max(0.0, dot(dir, sunDir));
    float sunDisc = smoothstep(0.9992 - (uSunDiscSize * 0.0004), 0.9998, sunDot);
    float corona = pow(sunDot, 12.0) * uSunCoronaIntensity;
    float broadGlow = pow(sunDot, 3.5) * 0.35 * uSunCoronaIntensity;
    celestialLight = uSunColor * (sunDisc * 3.0 + corona * 1.5 + broadGlow);
  } else {
    // Night Moon
    vec3 moonDir = normalize(vec3(-sunDir.x, max(0.25, abs(sunDir.y)), -sunDir.z));
    float moonDot = dot(dir, moonDir);
    float moonAngle = acos(clamp(moonDot, -1.0, 1.0));
    float moonDiscSize = 0.022 * uSunDiscSize;
    float moonDisc = smoothstep(moonDiscSize, moonDiscSize * 0.88, moonAngle);
    float moonCorona = pow(max(moonDot, 0.0), 24.0) * 0.7;
    float moonGlow = pow(max(moonDot, 0.0), 4.5) * 0.25;
    vec3 moonTint = vec3(0.88, 0.94, 1.0);
    celestialLight = moonTint * (moonDisc * 3.2 + moonCorona + moonGlow);
  }

  vec3 col = baseSky + celestialLight;

  // 4. PROCEDURAL CLOUDS
  if (uEnableClouds > 0.5 && dir.y > 0.02) {
    vec2 windDir = vec2(cos(uCloudWindAngle), sin(uCloudWindAngle));
    vec2 cloudUv = (dir.xz / (dir.y + 0.12)) * (0.85 / max(0.1, uCloudScale));
    cloudUv += windDir * (uTime * uCloudSpeed * 0.08);

    float cloudNoise = fbm(cloudUv * 2.2, 4);
    if (uCloudTurbulence > 0.05) {
      cloudNoise += fbm(cloudUv * 5.0 + vec2(uTime * 0.01), 2) * uCloudTurbulence * 0.4;
    }

    float coverageThreshold = 1.0 - uCloudCoverage;
    float cloudMask = smoothstep(coverageThreshold, coverageThreshold + uCloudEdge + 0.18, cloudNoise);

    // Cloud lighting & self-shadowing based on sun or moon direction
    vec3 activeLightDir = uNightFactor > 0.5 ? normalize(vec3(-sunDir.x, max(0.25, abs(sunDir.y)), -sunDir.z)) : sunDir;
    float lightFacing = max(0.0, dot(dir, activeLightDir));
    vec3 cloudBaseCol = uNightFactor > 0.5 ? uCloudColor * 0.35 : uCloudColor;
    vec3 cloudShadowCol = uNightFactor > 0.5 ? uCloudShadowColor * 0.25 : uCloudShadowColor;
    vec3 litCloud = mix(cloudShadowCol, cloudBaseCol, 0.4 + 0.6 * lightFacing);

    float alpha = clamp(cloudMask * uCloudOpacity * (dir.y / (dir.y + 0.06)), 0.0, 1.0);
    col = mix(col, litCloud, alpha);
  }

  // 5. VOLUMETRIC GOD RAYS (Day only)
  if (uNightFactor < 0.5 && uEnableGodRays > 0.5) {
    float sunDot = max(0.0, dot(dir, sunDir));
    if (sunDot > 0.0) {
      float rayNoise = fbm(dir.xy * 8.0 + vec2(uTime * 0.015, 0.0), 3);
      float rayIntensity = pow(sunDot, 16.0 / max(0.1, uGodRaysDensity)) * rayNoise * uGodRaysIntensity;
      vec3 godRayCol = uGodRaysColor * rayIntensity;
      col += godRayCol;
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

export class ProceduralSkyEngine {
  private scene: THREE.Scene;
  private skyMesh: THREE.Mesh | null = null;
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private currentPreset: EnvironmentPreset;
  private time: number = 0;
  private customOffBackground: THREE.Texture | THREE.Color | null = null;

  // Synced Three.js Lighting References
  public sunLight: THREE.DirectionalLight | null = null;
  public ambientLight: THREE.AmbientLight | null = null;
  public fillLight: THREE.DirectionalLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.currentPreset = DEFAULT_PRESETS[0];
    this.init();
  }

  public setCustomOffBackground(bg: THREE.Texture | THREE.Color | null): void {
    this.customOffBackground = bg;
    if (this.currentPreset.id === 'off') {
      this.scene.background = bg;
    }
  }

  private init(): void {
    const geometry = new THREE.SphereGeometry(500, 32, 24);

    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0.0 },
        uSunPosition: { value: new THREE.Vector3(0.4, 0.75, -0.5).normalize() },
        uSkyColorZenith: { value: new THREE.Color(0x2a5090) },
        uSkyColorMid: { value: new THREE.Color(0x4f8bc9) },
        uSkyColorHorizon: { value: new THREE.Color(0xb8daf2) },
        uSunColor: { value: new THREE.Color(0xfffbf0) },
        uGradientPower: { value: 1.2 },
        uGradientMidOffset: { value: 0.22 },
        uSunCoronaIntensity: { value: 0.85 },
        uSunDiscSize: { value: 1.8 },
        uCloudColor: { value: new THREE.Color(0xfffcf5) },
        uCloudShadowColor: { value: new THREE.Color(0x8ca4c8) },
        uCloudCoverage: { value: 0.45 },
        uCloudDensity: { value: 1.0 },
        uCloudEdge: { value: 0.06 },
        uCloudSpeed: { value: 0.018 },
        uCloudWindAngle: { value: (45 * Math.PI) / 180 },
        uCloudScale: { value: 1.0 },
        uCloudTurbulence: { value: 0.0 },
        uCloudOpacity: { value: 1.0 },
        uEnableClouds: { value: 1.0 },
        uEnableGodRays: { value: 1.0 },
        uGodRaysIntensity: { value: 0.6 },
        uGodRaysDensity: { value: 0.5 },
        uGodRaysDecay: { value: 0.92 },
        uGodRaysColor: { value: new THREE.Color('#fff6d3') },
        uNightFactor: { value: 0.0 },
        uDuskFactor: { value: 0.0 },
        uHorizonGlow: { value: 0.45 },
        uStarDensity: { value: 0.0 },
        uStarBrightness: { value: 1.2 },
        uStarTwinkle: { value: 0.6 },
        uMilkyWay: { value: 0.0 },
        uNightColor: { value: new THREE.Color(0x020409) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      depthFunc: THREE.LessEqualDepth,
    });

    this.skyMesh = new THREE.Mesh(geometry, this.skyMaterial);
    this.skyMesh.name = 'ProceduralSkyDome';
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -1000;
    this.skyMesh.visible = true;
    this.scene.add(this.skyMesh);

    this.applyPreset(this.currentPreset);
  }

  public setLights(
    sunLight: THREE.DirectionalLight,
    ambientLight: THREE.AmbientLight,
    fillLight: THREE.DirectionalLight,
    hemiLight?: THREE.HemisphereLight
  ): void {
    this.sunLight = sunLight;
    this.ambientLight = ambientLight;
    this.fillLight = fillLight;
    if (hemiLight) this.hemiLight = hemiLight;
    this.applyPreset(this.currentPreset);
  }

  public getPresetsList(): EnvironmentPreset[] {
    return DEFAULT_PRESETS;
  }

  public getCurrentPreset(): EnvironmentPreset {
    return this.currentPreset;
  }

  public getSettings(): SkySettings {
    return {
      preset: this.currentPreset.id,
      enableClouds: this.currentPreset.gradient.enableProceduralClouds,
      cloudCoverage: this.currentPreset.clouds.cloudCoverage,
      cloudDensity: 1.0,
      cloudSpeed: this.currentPreset.clouds.cloudSpeed,
      cloudWindAngle: 45,
      cloudScale: 1.0,
      cloudTurbulence: this.currentPreset.clouds.stormTurbulence,
      cloudOpacity: this.currentPreset.clouds.cloudOpacity,
      cloudColor: this.currentPreset.clouds.cloudColor,
      cloudShadow: this.currentPreset.clouds.cloudShadow,
      enableGodRays: this.currentPreset.sunGodRays.godRaysEnable,
      godRaysIntensity: this.currentPreset.sunGodRays.rayIntensity,
      godRaysDensity: this.currentPreset.sunGodRays.rayDensity,
      godRaysDecay: this.currentPreset.sunGodRays.rayDecay,
      godRaysColor: this.currentPreset.sunGodRays.rayColorInner,
      sunElevation: this.currentPreset.sunGodRays.sunHeight,
      sunAzimuth: this.currentPreset.sunGodRays.sunAzimuth,
      sunCoronaIntensity: 0.85,
      sunIntensity: this.currentPreset.atmosphere.sunIntensity,
      sunColor: this.currentPreset.atmosphere.sunLightColor,
      ambientIntensity: this.currentPreset.atmosphere.ambientIntensity,
      starDensity: 0.05,
      starBrightness: 1.2,
      starTwinkle: 0.6,
      milkyWay: 0.5,
    };
  }

  public applyPreset(presetOrId: string | EnvironmentPreset): void {
    let preset: EnvironmentPreset;

    // The "off" state has to be honoured for both call shapes. setLights() re-applies
    // the current preset as an object, so a string-only check let the dome switch
    // itself back on whenever the lighting rig was rebuilt.
    const requestedId = (typeof presetOrId === 'string' ? presetOrId : presetOrId?.id || '').toLowerCase();
    if (requestedId === 'off') {
      if (this.skyMesh) this.skyMesh.visible = false;
      // When sky dome is off, preserve the studio backdrop / scene background
      // Record the off state so getCurrentPreset() reflects reality; callers
      // (theme switching, background selection) test against it.
      this.currentPreset = { ...this.currentPreset, id: 'off' };
      return;
    }

    if (typeof presetOrId === 'string') {
      const id = requestedId;
      const found = DEFAULT_PRESETS.find(
        (p) =>
          p.id.toLowerCase() === id ||
          p.name.toLowerCase().includes(id) ||
          (id === 'daylight' && p.id === 'clear-day') ||
          (id === 'sunset' && p.id === 'sunset-dusk') ||
          (id === 'night' && p.id === 'deep-night')
      );
      preset = found || DEFAULT_PRESETS[0];
    } else {
      preset = presetOrId;
    }

    this.currentPreset = { ...preset };

    if (this.skyMesh) {
      this.skyMesh.visible = true;
    }
    this.scene.background = null;

    if (!this.skyMaterial) return;
    const u = this.skyMaterial.uniforms;

    // Zenith, Mid, Horizon colors
    u.uSkyColorZenith.value.set(preset.gradient.zenithColor);
    u.uSkyColorMid.value.set(preset.gradient.midSkyColor);
    u.uSkyColorHorizon.value.set(preset.gradient.horizonColor);
    u.uSunColor.value.set(preset.atmosphere.sunLightColor);

    const [sx, sy, sz] = sphericalToCartesian(preset.sunGodRays.sunHeight, preset.sunGodRays.sunAzimuth);
    u.uSunPosition.value.set(sx, sy, sz).normalize();

    u.uGradientPower.value = preset.gradient.gradientCurvePower;
    u.uGradientMidOffset.value = preset.gradient.midHeightOffset;
    u.uSunCoronaIntensity.value = preset.gradient.sunFlareGlow;
    u.uSunDiscSize.value = preset.sunGodRays.sunDiscSize;
    u.uHorizonGlow.value = preset.gradient.horizonBandGlow;

    // Clouds
    u.uEnableClouds.value = preset.gradient.enableProceduralClouds ? 1.0 : 0.0;
    u.uCloudCoverage.value = preset.clouds.cloudCoverage;
    u.uCloudEdge.value = preset.clouds.cloudEdge;
    u.uCloudSpeed.value = preset.clouds.cloudSpeed;
    u.uCloudOpacity.value = preset.clouds.cloudOpacity;
    u.uCloudColor.value.set(preset.clouds.cloudColor);
    u.uCloudShadowColor.value.set(preset.clouds.cloudShadow);
    u.uCloudTurbulence.value = preset.clouds.stormTurbulence;

    // God Rays
    u.uEnableGodRays.value = preset.sunGodRays.godRaysEnable ? 1.0 : 0.0;
    u.uGodRaysIntensity.value = preset.sunGodRays.rayIntensity;
    u.uGodRaysDensity.value = preset.sunGodRays.rayDensity;
    u.uGodRaysDecay.value = preset.sunGodRays.rayDecay;
    u.uGodRaysColor.value.set(preset.sunGodRays.rayColorInner);

    // Night detection
    const isNight =
      preset.sunGodRays.sunHeight < 0 ||
      preset.id === 'deep-night' ||
      preset.id === 'midnight-stars' ||
      preset.id === 'cyber-aurora' ||
      preset.timeOfDayHour < 5.5 ||
      preset.timeOfDayHour > 19.5;
    u.uNightFactor.value = isNight ? 1.0 : 0.0;
    u.uStarDensity.value = isNight ? 1.0 : 0.0;

    // Sync Scene Lights
    if (this.sunLight) {
      if (isNight) {
        // Moon directional lighting from opposite direction above the horizon
        this.sunLight.color.setHex(0xa6c8ff);
        this.sunLight.intensity = Math.max(0.45, preset.atmosphere.sunIntensity * 0.65);
        this.sunLight.position.set(-sx * 20, Math.max(8.0, Math.abs(sy) * 20), -sz * 20);
      } else {
        this.sunLight.color.set(preset.atmosphere.sunLightColor);
        this.sunLight.intensity = Math.max(0.2, preset.atmosphere.sunIntensity);
        this.sunLight.position.set(sx * 20, Math.max(0.5, sy * 20), sz * 20);
      }
    }

    if (this.ambientLight) {
      this.ambientLight.color.set(preset.atmosphere.ambientLightColor);
      this.ambientLight.intensity = Math.max(0.3, preset.atmosphere.ambientIntensity);
    }

    if (this.fillLight) {
      this.fillLight.color.set(preset.atmosphere.waterGlintColor || preset.atmosphere.ambientLightColor);
      this.fillLight.intensity = Math.max(0.2, preset.atmosphere.ambientIntensity * 0.45);
      this.fillLight.position.set(-sx * 15, -sy * 5 + 4, -sz * 15);
    }

    if (this.hemiLight) {
      this.hemiLight.color.set(preset.gradient.zenithColor);
      this.hemiLight.groundColor.set(preset.gradient.horizonColor);
      this.hemiLight.intensity = Math.max(0.3, preset.atmosphere.ambientIntensity * 0.7);
    }

    // Sync Fog if enabled
    if (preset.fog.globalFog) {
      const fogCol = new THREE.Color(preset.atmosphere.fogColor);
      this.scene.fog = new THREE.FogExp2(fogCol, 0.0008 * preset.fog.densityMultiplier);
    } else {
      this.scene.fog = null;
    }
  }

  public setTimeOfDay(hour: number): void {
    const { altitude, azimuth } = timeOfDayToSunAngles(hour);
    this.currentPreset.timeOfDayHour = hour;
    this.currentPreset.sunGodRays.sunHeight = Math.round(altitude);
    this.currentPreset.sunGodRays.sunAzimuth = Math.round(azimuth);
    this.applyPreset(this.currentPreset);
  }

  public getTimeOfDay(): number {
    return this.currentPreset.timeOfDayHour;
  }

  public setSunIntensity(intensity: number): void {
    this.updatePresetSettings({ atmosphere: { ...this.currentPreset.atmosphere, sunIntensity: intensity } });
  }

  public setSunColor(colorHex: string): void {
    this.updatePresetSettings({ atmosphere: { ...this.currentPreset.atmosphere, sunLightColor: colorHex } });
  }

  public setAmbientIntensity(intensity: number): void {
    this.updatePresetSettings({ atmosphere: { ...this.currentPreset.atmosphere, ambientIntensity: intensity } });
  }

  public setSunCoronaIntensity(val: number): void {
    this.updatePresetSettings({ gradient: { ...this.currentPreset.gradient, sunFlareGlow: val } });
  }

  public getIlluminationState() {
    return {
      timeOfDay: this.currentPreset.timeOfDayHour,
      sunElevation: this.currentPreset.sunGodRays.sunHeight,
      sunAzimuth: this.currentPreset.sunGodRays.sunAzimuth,
      sunIntensity: this.currentPreset.atmosphere.sunIntensity,
      ambientIntensity: this.currentPreset.atmosphere.ambientIntensity,
      sunColor: this.currentPreset.atmosphere.sunLightColor,
      ambientColor: this.currentPreset.atmosphere.ambientLightColor,
    };
  }

  public setSunAngles(azimuthDeg: number, elevationDeg: number): void {
    this.currentPreset.sunGodRays.sunAzimuth = Math.round(azimuthDeg);
    this.currentPreset.sunGodRays.sunHeight = Math.round(elevationDeg);
    this.applyPreset(this.currentPreset);
  }

  public setSunPositionVector(x: number, y: number, z: number): void {
    const v = new THREE.Vector3(x, y, z).normalize();
    const elevationDeg = (Math.asin(Math.max(-1, Math.min(1, v.y))) * 180) / Math.PI;
    const azimuthDeg = ((Math.atan2(v.x, v.z) * 180) / Math.PI + 360) % 360;
    this.setSunAngles(azimuthDeg, elevationDeg);
  }

  public updatePresetSettings(updated: Partial<EnvironmentPreset>): void {
    this.currentPreset = {
      ...this.currentPreset,
      ...updated,
      atmosphere: { ...this.currentPreset.atmosphere, ...updated.atmosphere },
      gradient: { ...this.currentPreset.gradient, ...updated.gradient },
      clouds: { ...this.currentPreset.clouds, ...updated.clouds },
      sunGodRays: { ...this.currentPreset.sunGodRays, ...updated.sunGodRays },
      fog: { ...this.currentPreset.fog, ...updated.fog },
      rain: { ...this.currentPreset.rain, ...updated.rain },
    };
    this.applyPreset(this.currentPreset);
  }

  // Backward-compatibility setter helpers
  public setCloudCoverage(cov: number): void {
    this.updatePresetSettings({ clouds: { ...this.currentPreset.clouds, cloudCoverage: cov } });
  }

  public setCloudDensity(den: number): void {
    this.updatePresetSettings({ clouds: { ...this.currentPreset.clouds, stormTurbulence: den * 0.2 } });
  }

  public setCloudSpeed(spd: number): void {
    this.updatePresetSettings({ clouds: { ...this.currentPreset.clouds, cloudSpeed: spd } });
  }

  public setCloudWindAngle(deg: number): void {
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.uCloudWindAngle.value = (deg * Math.PI) / 180;
    }
  }

  public setCloudScale(scale: number): void {
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.uCloudScale.value = scale;
    }
  }

  public setCloudTurbulence(turb: number): void {
    this.updatePresetSettings({ clouds: { ...this.currentPreset.clouds, stormTurbulence: turb } });
  }

  public setCloudOpacity(op: number): void {
    this.updatePresetSettings({ clouds: { ...this.currentPreset.clouds, cloudOpacity: op } });
  }

  public setCloudColor(hex: string): void {
    this.updatePresetSettings({ clouds: { ...this.currentPreset.clouds, cloudColor: hex } });
  }

  public setCloudShadow(hex: string): void {
    this.updatePresetSettings({ clouds: { ...this.currentPreset.clouds, cloudShadow: hex } });
  }

  public setEnableClouds(enabled: boolean): void {
    this.updatePresetSettings({ gradient: { ...this.currentPreset.gradient, enableProceduralClouds: enabled } });
  }

  public setEnableGodRays(enabled: boolean): void {
    this.updatePresetSettings({ sunGodRays: { ...this.currentPreset.sunGodRays, godRaysEnable: enabled } });
  }

  public setGodRaysIntensity(intensity: number): void {
    this.updatePresetSettings({ sunGodRays: { ...this.currentPreset.sunGodRays, rayIntensity: intensity } });
  }

  public setGodRaysDensity(density: number): void {
    this.updatePresetSettings({ sunGodRays: { ...this.currentPreset.sunGodRays, rayDensity: density } });
  }

  public setGodRaysDecay(decay: number): void {
    this.updatePresetSettings({ sunGodRays: { ...this.currentPreset.sunGodRays, rayDecay: decay } });
  }

  public setGodRaysColor(hex: string): void {
    this.updatePresetSettings({ sunGodRays: { ...this.currentPreset.sunGodRays, rayColorInner: hex } });
  }

  public update(deltaTime: number, camera: THREE.Camera): void {
    this.time += deltaTime;
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.uTime.value = this.time;
    }
    if (this.skyMesh) {
      this.skyMesh.position.copy(camera.position);
    }
  }
}

export { DEFAULT_PRESETS as SKY_PRESETS };
