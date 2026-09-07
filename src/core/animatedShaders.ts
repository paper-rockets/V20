import * as THREE from 'three';

export type AnimatedShaderEffect =
  | 'fire'
  | 'ocean_wave'
  | 'waterfall'
  | 'caustic'
  | 'foam'
  | 'ripple'
  | 'lava'
  | 'galaxy'
  | 'rainbow'
  | 'lightning'
  | 'glitter'
  | 'candy'
  | 'slime'
  | 'sparkler'
  | 'foliage_leaf'
  | 'foliage_fir'
  | 'cloud'
  | 'jelly'
  | 'plasma'
  | 'volumetric_plasma'
  | 'rim_light'
  | 'anime_cel'
  | 'jelly_warp'
  | 'posterize_ink'
  | 'aurora'
  | 'hologram'
  | 'electric_arc';

export const OKLAB_GLSL_CHUNK = `
// Oklab perceptual color space blending helpers
vec3 srgb_to_linear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linear_to_srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 linear_srgb_to_oklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

  float l_ = pow(max(0.0, l), 1.0 / 3.0);
  float m_ = pow(max(0.0, m), 1.0 / 3.0);
  float s_ = pow(max(0.0, s), 1.0 / 3.0);

  return vec3(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}

vec3 oklab_to_linear_srgb(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;

  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;

  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 oklab_mix(vec3 colA, vec3 colB, float t) {
  vec3 oklabA = linear_srgb_to_oklab(srgb_to_linear(colA));
  vec3 oklabB = linear_srgb_to_oklab(srgb_to_linear(colB));
  vec3 mixedOklab = mix(oklabA, oklabB, clamp(t, 0.0, 1.0));
  return linear_to_srgb(clamp(oklab_to_linear_srgb(mixedOklab), 0.0, 1.0));
}
`;

export const STANDARD_VERTEX_SHADER = `
varying vec2 vUv;
varying vec2 v_uv;
varying vec2 v_matcap_uv;
varying vec3 vNormal;
varying vec3 v_normal;
varying vec3 vWorldPosition;
varying vec3 v_world_pos;
varying vec3 vViewPosition;
varying vec3 v_view_pos;
varying vec3 v_position;
varying vec3 vPosition;

void main() {
  vUv = uv;
  v_uv = uv;
  vNormal = normalize(normalMatrix * normal);
  v_normal = vNormal;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  v_world_pos = worldPos.xyz;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  v_view_pos = -mvPosition.xyz;
  v_position = mvPosition.xyz;
  vPosition = position;

  // View-space normal mapped to [0, 1] texture coordinates for MatCap
  vec3 view_normal = normalize(vNormal);
  v_matcap_uv = view_normal.xy * 0.5 + 0.5;

  gl_Position = projectionMatrix * mvPosition;
}
`;

// Speed presets per animated effect
export const EFFECT_SPEEDS: Record<AnimatedShaderEffect, number> = {
  fire: 1.5,
  ocean_wave: 1.0,
  waterfall: 1.8,
  caustic: 0.9,
  foam: 0.7,
  ripple: 1.2,
  lava: 0.45,
  galaxy: 0.3,
  rainbow: 0.8,
  lightning: 2.2,
  glitter: 1.6,
  candy: 0.6,
  slime: 0.5,
  sparkler: 3.0,
  foliage_leaf: 0.4,
  foliage_fir: 0.35,
  cloud: 0.25,
  jelly: 0.85,
  plasma: 1.4,
  volumetric_plasma: 1.2,
  rim_light: 0.6,
  anime_cel: 0.0,
  jelly_warp: 1.1,
  posterize_ink: 0.2,
  aurora: 0.55,
  hologram: 1.7,
  electric_arc: 2.5,
};

export function getEffectFragmentShader(effect: AnimatedShaderEffect): string {
  return `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uSpeed;
uniform float uScale;
uniform vec3 uLightDirection;
uniform vec2 uResolution;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

${OKLAB_GLSL_CHUNK}

// Noise helpers
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 4; ++i) {
    v += a * noise(p);
    p = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  float t = uTime * uSpeed;
  vec2 uv = vUv * vec2(1.0, uScale);
  vec3 finalColor = uColor;
  float alpha = uOpacity;

  // View lighting
  vec3 viewDir = normalize(vViewPosition);
  vec3 lightDir = normalize(uLightDirection);
  float diff = max(dot(vNormal, lightDir), 0.0);
  float rim = 1.0 - max(dot(vNormal, viewDir), 0.0);

  #if defined(EFFECT_fire)
    float n = fbm(uv * 3.0 - vec2(0.0, t * 2.5));
    float flame = smoothstep(0.1, 0.9, n * (1.2 - vUv.x * 0.4));
    vec3 hotColor = vec3(1.0, 0.9, 0.2);
    vec3 midColor = uColor;
    vec3 darkColor = vec3(0.8, 0.1, 0.0);
    finalColor = oklab_mix(darkColor, midColor, flame);
    finalColor = oklab_mix(finalColor, hotColor, pow(flame, 2.5));

  #elif defined(EFFECT_ocean_wave)
    float wave = sin(uv.y * 6.0 - t * 3.0) * cos(uv.x * 4.0 + t);
    float foam = smoothstep(0.4, 0.8, wave + noise(uv * 8.0 + t));
    vec3 deepWater = uColor * 0.5;
    vec3 foamColor = vec3(0.9, 0.98, 1.0);
    finalColor = oklab_mix(deepWater, uColor, wave * 0.5 + 0.5);
    finalColor = oklab_mix(finalColor, foamColor, foam);

  #elif defined(EFFECT_waterfall)
    float flow = fbm(vec2(vUv.x * 4.0, vUv.y * 12.0 - t * 4.0));
    float streak = smoothstep(0.3, 0.8, flow);
    vec3 splash = vec3(0.95, 1.0, 1.0);
    finalColor = oklab_mix(uColor * 0.7, splash, streak);

  #elif defined(EFFECT_caustic)
    vec2 p = uv * 4.0 + vec2(sin(t * 0.8), cos(t * 0.6));
    float c1 = noise(p + t * 0.5);
    float c2 = noise(p * 1.5 - t * 0.7);
    float caust = pow(c1 * c2, 1.8) * 3.0;
    finalColor = uColor + vec3(caust * 0.8);

  #elif defined(EFFECT_lava)
    float crust = fbm(uv * 2.5 + t * 0.1);
    float crack = smoothstep(0.45, 0.6, crust);
    vec3 magma = vec3(1.0, 0.35, 0.05) * 2.0;
    vec3 rock = vec3(0.12, 0.08, 0.08);
    finalColor = oklab_mix(magma, rock, crack);

  #elif defined(EFFECT_galaxy)
    float star = pow(hash(floor(uv * 20.0 + sin(t * 0.2))), 18.0) * 4.0;
    float spiral = fbm(uv * 1.5 + vec2(sin(t * 0.1), cos(t * 0.1)));
    vec3 nebA = uColor;
    vec3 nebB = vec3(0.9, 0.3, 0.8);
    finalColor = oklab_mix(nebA, nebB, spiral) + vec3(star);

  #elif defined(EFFECT_rainbow)
    float hue = fract(vUv.y * 0.5 - t * 0.2 + vUv.x * 0.2);
    vec3 rainbowCol = 0.5 + 0.5 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
    finalColor = oklab_mix(uColor, rainbowCol, 0.75);

  #elif defined(EFFECT_lightning)
    float bolt = abs(sin(uv.y * 8.0 + noise(uv * 12.0) * 4.0 - t * 6.0));
    float glow = 1.0 - smoothstep(0.0, 0.18, bolt);
    vec3 core = vec3(1.0, 1.0, 1.0);
    finalColor = oklab_mix(uColor, core, glow * 2.0);

  #elif defined(EFFECT_glitter)
    vec2 grid = floor(uv * 24.0);
    float sparkle = pow(fract(sin(dot(grid, vec2(12.9898, 78.233)) + t * 3.0) * 43758.5453), 12.0);
    finalColor = uColor + vec3(sparkle * 2.5);

  #elif defined(EFFECT_plasma)
    float p1 = sin(uv.x * 4.0 + t);
    float p2 = sin(uv.y * 4.0 - t * 1.2);
    float p3 = sin((uv.x + uv.y) * 3.0 + t * 0.8);
    float plas = (p1 + p2 + p3) / 3.0;
    vec3 colA = uColor;
    vec3 colB = vec3(0.2, 0.8, 1.0);
    finalColor = oklab_mix(colA, colB, plas * 0.5 + 0.5) * 1.4;

  #elif defined(EFFECT_rim_light)
    float rimEffect = pow(rim, 2.5);
    vec3 rimCol = vec3(1.0, 1.0, 1.0);
    finalColor = oklab_mix(uColor, rimCol, rimEffect * 0.9);

  #elif defined(EFFECT_hologram)
    float scanline = sin(vWorldPosition.y * 60.0 + t * 8.0) * 0.5 + 0.5;
    float glitch = step(0.96, hash(vec2(floor(t * 10.0), floor(vWorldPosition.y * 5.0))));
    finalColor = uColor * (0.7 + scanline * 0.6) + vec3(glitch * 0.5);
    alpha = uOpacity * (0.6 + scanline * 0.3);

  #elif defined(EFFECT_aurora)
    float waveA = sin(uv.y * 3.0 + t * 0.8 + sin(uv.x * 4.0));
    float waveB = cos(uv.y * 5.0 - t * 1.1 + cos(uv.x * 3.0));
    float cur = smoothstep(-0.5, 0.8, waveA * waveB);
    vec3 grn = vec3(0.2, 1.0, 0.6);
    vec3 purp = vec3(0.7, 0.2, 1.0);
    finalColor = oklab_mix(uColor, grn, cur);
    finalColor = oklab_mix(finalColor, purp, waveB * 0.5 + 0.5) * 1.5;

  #else
    // Generic energetic pulse fallback for other effects
    float pulse = sin(uv.y * 4.0 - t * 2.0) * 0.5 + 0.5;
    finalColor = oklab_mix(uColor * 0.8, uColor * 1.3, pulse);
  #endif

  gl_FragColor = vec4(finalColor, alpha);
}
`;
}

/**
 * Registry to track and animate ShaderMaterials per frame
 */
export class AnimatedShaderRegistry {
  private materials: Set<THREE.ShaderMaterial> = new Set();
  private lightDirection: THREE.Vector3 = new THREE.Vector3(1, 2, 1).normalize();
  private resolution: THREE.Vector2 = new THREE.Vector2(window.innerWidth, window.innerHeight);

  public register(material: THREE.ShaderMaterial): void {
    this.materials.add(material);
  }

  public unregister(material: THREE.ShaderMaterial): void {
    this.materials.delete(material);
  }

  public setLightDirection(dir: THREE.Vector3): void {
    this.lightDirection.copy(dir).normalize();
  }

  public setResolution(width: number, height: number): void {
    this.resolution.set(width, height);
  }

  public update(timeInSeconds: number, lightDir?: THREE.Vector3, resolution?: THREE.Vector2): void {
    if (lightDir) {
      this.lightDirection.copy(lightDir).normalize();
    }
    if (resolution) {
      this.resolution.copy(resolution);
    }
    this.materials.forEach((mat) => {
      if (mat.uniforms.uTime) mat.uniforms.uTime.value = timeInSeconds;
      if (mat.uniforms.u_time) mat.uniforms.u_time.value = timeInSeconds;
      if (mat.uniforms.time) mat.uniforms.time.value = timeInSeconds;
      if (mat.uniforms.iTime) mat.uniforms.iTime.value = timeInSeconds;
      if (mat.uniforms.uLightDirection) mat.uniforms.uLightDirection.value.copy(this.lightDirection);
      if (mat.uniforms.u_light_dir) mat.uniforms.u_light_dir.value.copy(this.lightDirection);
      if (mat.uniforms.uSunDir) mat.uniforms.uSunDir.value.copy(this.lightDirection);
      if (mat.uniforms.uResolution) mat.uniforms.uResolution.value.copy(this.resolution);
      if (mat.uniforms.u_resolution) mat.uniforms.u_resolution.value.copy(this.resolution);
      if (mat.uniforms.resolution) mat.uniforms.resolution.value.copy(this.resolution);
      if (mat.uniforms.iResolution) mat.uniforms.iResolution.value.set(this.resolution.x, this.resolution.y, 1.0);
    });
  }

  public clear(): void {
    this.materials.clear();
  }
}

export const globalShaderRegistry = new AnimatedShaderRegistry();
