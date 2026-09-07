/**
 * ProgressiveRayTracer.ts
 *
 * Progressive screen-space ray tracer engine designed for real-time graphics on tablets & desktops.
 *
 * Technical Specifications:
 * - R2 Quasi-Monte Carlo sequence sampling combined with Interleaved Gradient Noise (IGN) for stratified low-discrepancy integration.
 * - Screen Space Directional Occlusion (SSDO): micro-scale directional contact shadows for ribbons draping over clay.
 * - Automatic GPU sleep state: once 64 frames converge while stationary, bypasses ray-marching compute passes and directly blits the cached buffer.
 * - Hardware format capability detection: THREE.HalfFloatType HDR accumulation with automatic fallback to THREE.UnsignedByteType for legacy chipsets.
 * - Dual-pass downsampled separable Gaussian Bloom post-processing with toggleable state (default: off on mobile).
 * - 5 Lighting Passes: Cosine-weighted Hemisphere AO, SSDO Contact Shadows, Indirect Color Bleeding, Soft Penumbra Area-Light Shadows, and SSS Wrap with ACES Filmic tonemapping.
 */

import * as THREE from 'three';

export interface ProgressiveRayTracerOptions {
  samplesPerFrame?: number;
  maxAccumulatedFrames?: number;
  ambientOcclusionRadius?: number;
  shadowSoftness?: number;
  reflectionStrength?: number;
  bloomEnabled?: boolean;
  bloomIntensity?: number;
}

// ---------------------------------------------------------------------------
// 1. Full-Screen Ray Tracing Shader (AO, SSDO, Soft Shadow, Indirect Bleed, SSS)
// ---------------------------------------------------------------------------
const RayTraceShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;

    uniform vec2 uResolution;
    uniform vec3 uLightDirection;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientColor;
    uniform float uFrameIndex;
    uniform float uTime;
    uniform float uNear;
    uniform float uFar;
    uniform float uAORadius;
    uniform float uShadowSoftness;
    uniform float uReflectionStrength;
    uniform mat4 uProjectionInverse;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uCameraMatrixWorld;

    varying vec2 vUv;

    // R2 Quasi-Monte Carlo 2D low-discrepancy sequence constants
    const float R2_PHI = 1.324717957244746;
    const float R2_A1 = 0.7548776662466927;
    const float R2_A2 = 0.5698402909980532;

    vec2 getR2(float n) {
      return fract(vec2(0.5) + vec2(n * R2_A1, n * R2_A2));
    }

    // Interleaved Gradient Noise for spatial decorrelation
    float interleavedGradientNoise(vec2 coord, float frame) {
      vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
      return fract(magic.z * fract(dot(coord + vec2(frame * 5.588238, frame * 3.1234), magic.xy)));
    }

    // Combined R2 sequence with IGN rotation
    vec2 getR2StratifiedSample(vec2 pixelCoord, float sampleIdx, float frameIdx) {
      vec2 r2 = getR2(sampleIdx + frameIdx * 7.0);
      float ign = interleavedGradientNoise(pixelCoord, frameIdx);
      return fract(r2 + vec2(ign, fract(ign * 1.6180339887)));
    }

    // Reconstruct view-space position from hardware depth texture
    vec3 getViewPos(vec2 coord) {
      float z = texture2D(tDepth, coord).r;
      vec4 clip = vec4(coord * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
      vec4 view = uProjectionInverse * clip;
      return view.xyz / view.w;
    }

    // Cosine-weighted hemisphere sample direction around surface normal
    vec3 getHemisphereSample(vec3 normal, vec2 coord, float sampleIdx, float frameIdx) {
      vec2 xi = getR2StratifiedSample(coord, sampleIdx, frameIdx);

      float r = sqrt(xi.x);
      float theta = 6.28318530718 * xi.y;

      float x = r * cos(theta);
      float y = r * sin(theta);
      float z = sqrt(max(0.0, 1.0 - xi.x));

      vec3 tangent = abs(normal.z) < 0.999 ? normalize(cross(normal, vec3(0.0, 0.0, 1.0))) : normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
      vec3 bitangent = cross(normal, tangent);

      return normalize(tangent * x + bitangent * y + normal * z);
    }

    // Project view position back to screen UV coordinates
    vec2 viewToUv(vec3 viewPoint) {
      vec4 proj = uProjectionMatrix * vec4(viewPoint, 1.0);
      proj.xy /= proj.w;
      return proj.xy * 0.5 + 0.5;
    }

    void main() {
      vec4 albedo = texture2D(tDiffuse, vUv);
      float depthVal = texture2D(tDepth, vUv).r;

      // Background pass-through
      if (depthVal >= 0.9999) {
        gl_FragColor = albedo;
        return;
      }

      vec3 viewNormal = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
      if (dot(viewNormal, viewNormal) < 0.01) {
        viewNormal = vec3(0.0, 0.0, 1.0);
      }
      vec3 viewPos = getViewPos(vUv);
      vec3 viewLightDir = normalize((uViewMatrix * vec4(uLightDirection, 0.0)).xyz);

      float noise = interleavedGradientNoise(gl_FragCoord.xy, uFrameIndex);

      // ---------------------------------------------------------------------
      // Pass 1: Cosine-weighted Hemispherical Ambient Occlusion (Macro AO)
      // ---------------------------------------------------------------------
      float occlusion = 0.0;
      const int AO_SAMPLES = 4;

      for (int i = 0; i < AO_SAMPLES; i++) {
        vec3 sampleDir = getHemisphereSample(viewNormal, gl_FragCoord.xy, float(i), uFrameIndex);
        float stepDist = (float(i + 1) / float(AO_SAMPLES)) * uAORadius * (0.5 + 0.5 * noise);
        vec3 sampleView = viewPos + sampleDir * stepDist;
        vec2 sampleUv = viewToUv(sampleView);

        if (sampleUv.x >= 0.001 && sampleUv.x <= 0.999 && sampleUv.y >= 0.001 && sampleUv.y <= 0.999) {
          float sDepth = texture2D(tDepth, sampleUv).r;
          if (sDepth < 0.9999) {
            vec3 hitViewPos = getViewPos(sampleUv);
            float depthDiff = hitViewPos.z - sampleView.z;
            if (depthDiff > 0.01 && depthDiff < uAORadius * 1.2) {
              float occWeight = max(0.0, dot(viewNormal, sampleDir));
              occlusion += occWeight * (1.0 - smoothstep(0.01, uAORadius * 1.2, depthDiff));
            }
          }
        }
      }

      occlusion = clamp(1.0 - (occlusion / float(AO_SAMPLES)) * 1.25, 0.12, 1.0);

      // ---------------------------------------------------------------------
      // Pass 2: Screen Space Directional Occlusion (SSDO) Contact Shadows
      // Micro-scale directional ray march for ribbon contact shadows on clay
      // ---------------------------------------------------------------------
      float ssdoContactOcclusion = 0.0;
      const int SSDO_STEPS = 5;
      for (int k = 1; k <= SSDO_STEPS; k++) {
        float microDist = (float(k) / float(SSDO_STEPS)) * 0.048 * (0.8 + 0.4 * noise);
        vec3 microView = viewPos + viewLightDir * microDist;
        vec2 microUv = viewToUv(microView);

        if (microUv.x >= 0.001 && microUv.x <= 0.999 && microUv.y >= 0.001 && microUv.y <= 0.999) {
          float mDepth = texture2D(tDepth, microUv).r;
          if (mDepth < 0.9999) {
            vec3 blockerPos = getViewPos(microUv);
            float zDiff = blockerPos.z - microView.z;
            // Detect blockers positioned closely in front of the incident light ray
            if (zDiff > 0.0012 && zDiff < 0.035) {
              float weight = 1.0 - (float(k) / float(SSDO_STEPS + 1));
              ssdoContactOcclusion += weight;
            }
          }
        }
      }
      float ssdoShadowFactor = clamp(1.0 - (ssdoContactOcclusion / float(SSDO_STEPS)) * 1.8, 0.18, 1.0);

      // ---------------------------------------------------------------------
      // Pass 3: Cone-Jittered Soft Penumbra Directional Shadows (Macro Shadows)
      // ---------------------------------------------------------------------
      vec3 lightTangent = normalize(cross(viewLightDir, abs(viewLightDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 lightBitangent = cross(viewLightDir, lightTangent);

      vec2 shadowJitter = getR2StratifiedSample(gl_FragCoord.xy, 11.0, uFrameIndex);
      float angle = shadowJitter.x * 6.28318530718;
      float radius = sqrt(shadowJitter.y) * uShadowSoftness;
      vec3 jitteredLightDir = normalize(viewLightDir + (lightTangent * cos(angle) + lightBitangent * sin(angle)) * radius);

      float nDotL = max(0.0, dot(viewNormal, jitteredLightDir));
      float shadow = 1.0;

      if (nDotL > 0.001) {
        const int SHADOW_STEPS = 5;
        float shadowOccluded = 0.0;
        for (int s = 1; s <= SHADOW_STEPS; s++) {
          float marchDist = (float(s) / float(SHADOW_STEPS)) * 0.55;
          vec3 testView = viewPos + jitteredLightDir * marchDist;
          vec2 testUv = viewToUv(testView);

          if (testUv.x >= 0.001 && testUv.x <= 0.999 && testUv.y >= 0.001 && testUv.y <= 0.999) {
            float bDepth = texture2D(tDepth, testUv).r;
            if (bDepth < 0.9999) {
              vec3 blockerPos = getViewPos(testUv);
              float zDiff = blockerPos.z - testView.z;
              if (zDiff > 0.015 && zDiff < 0.45) {
                shadowOccluded += 1.0;
                break;
              }
            }
          }
        }
        shadow = 1.0 - shadowOccluded * 0.88;
      } else {
        shadow = 0.0;
      }

      // ---------------------------------------------------------------------
      // Pass 4: Indirect Bounce Color Transport
      // ---------------------------------------------------------------------
      vec3 indirectBounce = vec3(0.0);
      const int BOUNCE_SAMPLES = 4;
      for (int b = 0; b < BOUNCE_SAMPLES; b++) {
        vec3 bounceDir = getHemisphereSample(viewNormal, gl_FragCoord.xy, float(b + 7), uFrameIndex);
        float bounceDist = (float(b + 1) / float(BOUNCE_SAMPLES)) * 0.65;
        vec3 bounceView = viewPos + bounceDir * bounceDist;
        vec2 bounceUv = viewToUv(bounceView);

        if (bounceUv.x >= 0.001 && bounceUv.x <= 0.999 && bounceUv.y >= 0.001 && bounceUv.y <= 0.999) {
          float bDepth = texture2D(tDepth, bounceUv).r;
          if (bDepth < 0.9999) {
            vec3 bHit = getViewPos(bounceUv);
            float diff = bHit.z - bounceView.z;
            if (diff > 0.01 && diff < 0.45) {
              vec3 hitColor = texture2D(tDiffuse, bounceUv).rgb;
              indirectBounce += hitColor * max(0.0, dot(viewNormal, bounceDir));
            }
          }
        }
      }
      indirectBounce = (indirectBounce / float(BOUNCE_SAMPLES)) * 0.4;

      // ---------------------------------------------------------------------
      // Pass 5: Subtle Clay/Wax Subsurface Scattering (SSS) Approximation
      // ---------------------------------------------------------------------
      vec3 viewDir = normalize(viewPos);
      vec3 sssLightDir = normalize(viewLightDir + viewNormal * 0.35);
      float sssDot = max(0.0, dot(-viewDir, sssLightDir));
      float sssIntensity = 0.0;

      if (sssDot > 0.001) {
        vec3 sssPos = viewPos - viewNormal * 0.03;
        vec2 sssUv = viewToUv(sssPos);
        if (sssUv.x >= 0.001 && sssUv.x <= 0.999 && sssUv.y >= 0.001 && sssUv.y <= 0.999) {
          float sssDepth = texture2D(tDepth, sssUv).r;
          if (sssDepth < 0.9999) {
            vec3 sssHit = getViewPos(sssUv);
            float thickness = clamp(sssHit.z - sssPos.z, 0.0, 0.18);
            sssIntensity = pow(sssDot, 3.0) * exp(-thickness * 15.0) * 0.3;
          }
        }
      }
      vec3 sssColor = albedo.rgb * vec3(1.15, 0.65, 0.42) * sssIntensity;

      // ---------------------------------------------------------------------
      // Composite Combined Lighting (modulating direct light with SSDO contact shadows)
      // ---------------------------------------------------------------------
      vec3 directLight = uLightColor * nDotL * shadow * ssdoShadowFactor;
      vec3 ambient = uAmbientColor * (occlusion * (ssdoShadowFactor * 0.75 + 0.25)) + indirectBounce;
      vec3 litColor = albedo.rgb * (directLight + ambient) + sssColor;

      gl_FragColor = vec4(litColor, albedo.a);
    }
  `,
};

// ---------------------------------------------------------------------------
// 2. Ping-Pong Temporal Accumulation Shader
// ---------------------------------------------------------------------------
const AccumulationShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;

    uniform sampler2D tAccumPrev;
    uniform sampler2D tSample;
    uniform float uAccumCount;

    varying vec2 vUv;

    void main() {
      vec4 prevColor = texture2D(tAccumPrev, vUv);
      vec4 sampleColor = texture2D(tSample, vUv);

      if (uAccumCount < 1.0) {
        gl_FragColor = sampleColor;
        return;
      }

      float weight = 1.0 / (uAccumCount + 1.0);
      gl_FragColor = mix(prevColor, sampleColor, weight);
    }
  `,
};

// ---------------------------------------------------------------------------
// 3. Bloom Extraction Shader (Downsample + Threshold)
// ---------------------------------------------------------------------------
const BloomExtractShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tSource;
    uniform float uThreshold;
    varying vec2 vUv;

    void main() {
      vec4 col = texture2D(tSource, vUv);
      float brightness = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      float knee = 0.2;
      float soft = clamp((brightness - uThreshold + knee) / (2.0 * knee), 0.0, 1.0);
      vec3 bloom = col.rgb * (soft * soft);
      gl_FragColor = vec4(bloom, 1.0);
    }
  `,
};

// ---------------------------------------------------------------------------
// 4. Separable 9-tap Gaussian Blur Shader for Bloom
// ---------------------------------------------------------------------------
const BloomBlurShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tInput;
    uniform vec2 uDirection;
    varying vec2 vUv;

    void main() {
      vec4 sum = vec4(0.0);
      sum += texture2D(tInput, vUv - uDirection * 4.0) * 0.0162162162;
      sum += texture2D(tInput, vUv - uDirection * 3.0) * 0.0540540541;
      sum += texture2D(tInput, vUv - uDirection * 2.0) * 0.1216216216;
      sum += texture2D(tInput, vUv - uDirection * 1.0) * 0.1945945946;
      sum += texture2D(tInput, vUv)                    * 0.2270270270;
      sum += texture2D(tInput, vUv + uDirection * 1.0) * 0.1945945946;
      sum += texture2D(tInput, vUv + uDirection * 2.0) * 0.1216216216;
      sum += texture2D(tInput, vUv + uDirection * 3.0) * 0.0540540541;
      sum += texture2D(tInput, vUv + uDirection * 4.0) * 0.0162162162;
      gl_FragColor = sum;
    }
  `,
};

// ---------------------------------------------------------------------------
// 5. Output Blit & ACES Filmic Tonemapping Shader (with Bloom Compositing)
// ---------------------------------------------------------------------------
const BlitShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;

    uniform sampler2D tAccum;
    uniform sampler2D tBloom;
    uniform float uBloomEnabled;
    uniform float uBloomIntensity;
    varying vec2 vUv;

    // ACES Filmic tonemapping curve
    vec3 acesFilmic(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec4 color = texture2D(tAccum, vUv);

      if (uBloomEnabled > 0.5) {
        vec3 bloom = texture2D(tBloom, vUv).rgb;
        color.rgb += bloom * uBloomIntensity;
      }

      vec3 mapped = acesFilmic(color.rgb);
      mapped = pow(mapped, vec3(1.0 / 2.2));
      gl_FragColor = vec4(mapped, color.a);
    }
  `,
};

/**
 * High-performance Progressive Ray Tracer with ping-pong accumulation buffers,
 * SSDO contact shadows, toggleable separable bloom, and GPU sleep.
 */
export class ProgressiveRayTracer {
  private _enabled: boolean = true;
  private _samplesPerFrame: number = 1;
  private _maxAccumulatedFrames: number = 64;
  private _accumulatedFrames: number = 0;
  private _isSleeping: boolean = false;

  private _width: number = 1;
  private _height: number = 1;

  // Bloom Configuration
  private _bloomEnabled: boolean = false;
  private _bloomIntensity: number = 0.45;
  private _bloomWidth: number = 1;
  private _bloomHeight: number = 1;

  // Render Targets (HDR HalfFloat with automatic UnsignedByte fallback)
  private _sceneTarget: THREE.WebGLRenderTarget | null = null;
  private _normalTarget: THREE.WebGLRenderTarget | null = null;
  private _sampleTarget: THREE.WebGLRenderTarget | null = null;
  private _accumTargetA: THREE.WebGLRenderTarget | null = null;
  private _accumTargetB: THREE.WebGLRenderTarget | null = null;
  private _bloomTarget1: THREE.WebGLRenderTarget | null = null;
  private _bloomTarget2: THREE.WebGLRenderTarget | null = null;

  // Full-screen Quad Scene
  private readonly _postCamera: THREE.OrthographicCamera;
  private readonly _postScene: THREE.Scene;
  private readonly _quadMesh: THREE.Mesh;

  // Shader Materials
  private readonly _raytraceMaterial: THREE.ShaderMaterial;
  private readonly _accumulateMaterial: THREE.ShaderMaterial;
  private readonly _bloomExtractMaterial: THREE.ShaderMaterial;
  private readonly _bloomBlurMaterial: THREE.ShaderMaterial;
  private readonly _blitMaterial: THREE.ShaderMaterial;
  private readonly _normalMaterial: THREE.MeshNormalMaterial;

  // Camera Motion Tracking
  private readonly _lastCameraMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private _isStationary: boolean = false;
  private _needsClear: boolean = true;

  // Hardware capability negotiation
  private _bufferType: THREE.TextureDataType = THREE.HalfFloatType;
  private _initialized: boolean = false;

  constructor(options: ProgressiveRayTracerOptions = {}) {
    this._samplesPerFrame = options.samplesPerFrame ?? 1;
    this._maxAccumulatedFrames = options.maxAccumulatedFrames ?? 64;
    this._bloomEnabled = options.bloomEnabled ?? false;
    this._bloomIntensity = options.bloomIntensity ?? 0.45;

    this._postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._postScene = new THREE.Scene();

    this._normalMaterial = new THREE.MeshNormalMaterial();

    this._raytraceMaterial = new THREE.ShaderMaterial({
      vertexShader: RayTraceShader.vertexShader,
      fragmentShader: RayTraceShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        tNormal: { value: null },
        tDepth: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uLightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.4).normalize() },
        uLightColor: { value: new THREE.Vector3(1.1, 1.05, 0.98) },
        uAmbientColor: { value: new THREE.Vector3(0.25, 0.28, 0.32) },
        uFrameIndex: { value: 0 },
        uTime: { value: 0 },
        uNear: { value: 0.1 },
        uFar: { value: 100.0 },
        uAORadius: { value: options.ambientOcclusionRadius ?? 0.5 },
        uShadowSoftness: { value: options.shadowSoftness ?? 0.08 },
        uReflectionStrength: { value: options.reflectionStrength ?? 0.25 },
        uProjectionInverse: { value: new THREE.Matrix4() },
        uProjectionMatrix: { value: new THREE.Matrix4() },
        uViewMatrix: { value: new THREE.Matrix4() },
        uCameraMatrixWorld: { value: new THREE.Matrix4() },
      },
      depthWrite: false,
      depthTest: false,
    });

    this._accumulateMaterial = new THREE.ShaderMaterial({
      vertexShader: AccumulationShader.vertexShader,
      fragmentShader: AccumulationShader.fragmentShader,
      uniforms: {
        tAccumPrev: { value: null },
        tSample: { value: null },
        uAccumCount: { value: 0 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this._bloomExtractMaterial = new THREE.ShaderMaterial({
      vertexShader: BloomExtractShader.vertexShader,
      fragmentShader: BloomExtractShader.fragmentShader,
      uniforms: {
        tSource: { value: null },
        uThreshold: { value: 0.75 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this._bloomBlurMaterial = new THREE.ShaderMaterial({
      vertexShader: BloomBlurShader.vertexShader,
      fragmentShader: BloomBlurShader.fragmentShader,
      uniforms: {
        tInput: { value: null },
        uDirection: { value: new THREE.Vector2(0, 0) },
      },
      depthWrite: false,
      depthTest: false,
    });

    this._blitMaterial = new THREE.ShaderMaterial({
      vertexShader: BlitShader.vertexShader,
      fragmentShader: BlitShader.fragmentShader,
      uniforms: {
        tAccum: { value: null },
        tBloom: { value: null },
        uBloomEnabled: { value: this._bloomEnabled ? 1.0 : 0.0 },
        uBloomIntensity: { value: this._bloomIntensity },
      },
      depthWrite: false,
      depthTest: false,
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this._quadMesh = new THREE.Mesh(quadGeo, this._blitMaterial);
    this._postScene.add(this._quadMesh);
  }

  /**
   * Initializes hardware capabilities and negotiates buffer precision.
   */
  private _initCapabilities(renderer: THREE.WebGLRenderer): void {
    if (this._initialized) return;

    const gl = renderer.getContext();
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    let supportsHalfFloat = false;

    if (isWebGL2) {
      supportsHalfFloat = !!gl.getExtension('EXT_color_buffer_float');
    } else {
      supportsHalfFloat =
        !!gl.getExtension('OES_texture_half_float') &&
        !!gl.getExtension('OES_texture_half_float_linear');
    }

    this._bufferType = supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this._initialized = true;

    if (this._width > 1 && this._height > 1) {
      this._createRenderTargets(this._width, this._height);
    }
  }

  /**
   * Enables or disables progressive ray tracing.
   */
  public enable(enabled: boolean): void {
    this._enabled = enabled;
    this.reset();
  }

  public get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Toggles the lightweight bloom post-processing pass.
   */
  public setBloomEnabled(enabled: boolean): void {
    this._bloomEnabled = enabled;
    this._blitMaterial.uniforms.uBloomEnabled.value = enabled ? 1.0 : 0.0;
    this.reset();
  }

  public get isBloomEnabled(): boolean {
    return this._bloomEnabled;
  }

  public setBloomIntensity(intensity: number): void {
    this._bloomIntensity = Math.max(0.0, intensity);
    this._blitMaterial.uniforms.uBloomIntensity.value = this._bloomIntensity;
  }

  /**
   * Resets temporal accumulation and wakes up the GPU.
   */
  public reset(): void {
    this._accumulatedFrames = 0;
    this._isSleeping = false;
    this._needsClear = true;
  }

  /**
   * Adjusts progressive quality parameters.
   */
  public setQuality(samplesPerFrame: number, maxAccumulatedFrames: number): void {
    this._samplesPerFrame = Math.max(1, samplesPerFrame);
    this._maxAccumulatedFrames = Math.max(1, maxAccumulatedFrames);
    this.reset();
  }

  public get accumulatedFrames(): number {
    return this._accumulatedFrames;
  }

  public get maxAccumulatedFrames(): number {
    return this._maxAccumulatedFrames;
  }

  public get isStationary(): boolean {
    return this._isStationary;
  }

  public get isSleeping(): boolean {
    return this._isSleeping;
  }

  /**
   * Configures render target dimensions.
   */
  public setSize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));

    if (this._width === w && this._height === h) {
      return;
    }

    this._width = w;
    this._height = h;

    this._raytraceMaterial.uniforms.uResolution.value.set(w, h);
    this._createRenderTargets(w, h);
    this.reset();
  }

  private _createRenderTargets(w: number, h: number): void {
    this._disposeRenderTargets();

    const targetOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: this._bufferType,
      stencilBuffer: false,
    };

    this._sceneTarget = new THREE.WebGLRenderTarget(w, h, {
      ...targetOptions,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType),
    });

    this._normalTarget = new THREE.WebGLRenderTarget(w, h, targetOptions);
    this._sampleTarget = new THREE.WebGLRenderTarget(w, h, targetOptions);
    this._accumTargetA = new THREE.WebGLRenderTarget(w, h, targetOptions);
    this._accumTargetB = new THREE.WebGLRenderTarget(w, h, targetOptions);

    // Quarter-resolution render targets for ultra-lightweight separable Gaussian bloom
    this._bloomWidth = Math.max(1, Math.floor(w / 4));
    this._bloomHeight = Math.max(1, Math.floor(h / 4));
    this._bloomTarget1 = new THREE.WebGLRenderTarget(this._bloomWidth, this._bloomHeight, targetOptions);
    this._bloomTarget2 = new THREE.WebGLRenderTarget(this._bloomWidth, this._bloomHeight, targetOptions);
  }

  private _disposeRenderTargets(): void {
    this._sceneTarget?.dispose();
    this._normalTarget?.dispose();
    this._sampleTarget?.dispose();
    this._accumTargetA?.dispose();
    this._accumTargetB?.dispose();
    this._bloomTarget1?.dispose();
    this._bloomTarget2?.dispose();

    this._sceneTarget = null;
    this._normalTarget = null;
    this._sampleTarget = null;
    this._accumTargetA = null;
    this._accumTargetB = null;
    this._bloomTarget1 = null;
    this._bloomTarget2 = null;
  }

  private _checkCameraMovement(camera: THREE.Camera): boolean {
    const elements = camera.matrixWorld.elements;
    const lastElements = this._lastCameraMatrix.elements;

    let delta = 0;
    for (let i = 0; i < 16; i++) {
      delta += Math.abs(elements[i] - lastElements[i]);
    }

    if (delta > 0.0001) {
      this._lastCameraMatrix.copy(camera.matrixWorld);
      return true;
    }
    return false;
  }

  /**
   * Executes downsampled separable Gaussian bloom passes.
   */
  private _renderBloom(renderer: THREE.WebGLRenderer, sourceTexture: THREE.Texture): void {
    if (!this._bloomTarget1 || !this._bloomTarget2) return;

    // Step 1: Extract bright highlights into downsampled bloomTarget1
    renderer.setRenderTarget(this._bloomTarget1);
    this._quadMesh.material = this._bloomExtractMaterial;
    this._bloomExtractMaterial.uniforms.tSource.value = sourceTexture;
    renderer.render(this._postScene, this._postCamera);

    // Step 2: Horizontal blur from bloomTarget1 into bloomTarget2
    renderer.setRenderTarget(this._bloomTarget2);
    this._quadMesh.material = this._bloomBlurMaterial;
    this._bloomBlurMaterial.uniforms.tInput.value = this._bloomTarget1.texture;
    this._bloomBlurMaterial.uniforms.uDirection.value.set(1.0 / this._bloomWidth, 0.0);
    renderer.render(this._postScene, this._postCamera);

    // Step 3: Vertical blur from bloomTarget2 back into bloomTarget1
    renderer.setRenderTarget(this._bloomTarget1);
    this._bloomBlurMaterial.uniforms.tInput.value = this._bloomTarget2.texture;
    this._bloomBlurMaterial.uniforms.uDirection.value.set(0.0, 1.0 / this._bloomHeight);
    renderer.render(this._postScene, this._postCamera);
  }

  /**
   * Executes the adaptive progressive rendering pipeline with SSDO contact shadows & bloom.
   */
  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    this._initCapabilities(renderer);

    if (!this._enabled) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }

    const cameraMoved = this._checkCameraMovement(camera);

    if (cameraMoved) {
      this._isStationary = false;
      this.reset();
    } else {
      this._isStationary = true;
    }

    const targetsValid =
      this._sceneTarget &&
      this._normalTarget &&
      this._sampleTarget &&
      this._accumTargetA &&
      this._accumTargetB;

    if (!targetsValid) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }

    // Adaptive interactive branch: Real-time preview with tonemapping & optional bloom
    if (!this._isStationary) {
      this._isSleeping = false;
      renderer.setRenderTarget(this._sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);

      if (this._bloomEnabled && this._bloomTarget1 && this._bloomTarget2) {
        this._renderBloom(renderer, this._sceneTarget.texture);
      }

      renderer.setRenderTarget(null);
      this._quadMesh.material = this._blitMaterial;
      this._blitMaterial.uniforms.tAccum.value = this._sceneTarget.texture;
      this._blitMaterial.uniforms.tBloom.value = this._bloomTarget1?.texture ?? null;
      this._blitMaterial.uniforms.uBloomEnabled.value = this._bloomEnabled ? 1.0 : 0.0;
      this._blitMaterial.uniforms.uBloomIntensity.value = this._bloomIntensity;
      renderer.render(this._postScene, this._postCamera);
      return;
    }

    // GPU Sleep on Convergence:
    // Once 64 frames converge while stationary, bypass ray-marching compute passes
    // and directly blit the cached accumulation buffer to keep GPU cool.
    if (this._accumulatedFrames >= this._maxAccumulatedFrames) {
      this._isSleeping = true;
      renderer.setRenderTarget(null);
      this._quadMesh.material = this._blitMaterial;
      this._blitMaterial.uniforms.tAccum.value = this._accumTargetA.texture;
      this._blitMaterial.uniforms.tBloom.value = this._bloomTarget1?.texture ?? null;
      this._blitMaterial.uniforms.uBloomEnabled.value = this._bloomEnabled ? 1.0 : 0.0;
      this._blitMaterial.uniforms.uBloomIntensity.value = this._bloomIntensity;
      renderer.render(this._postScene, this._postCamera);
      return;
    }

    // Clear accumulation buffers if camera moved or reset was requested
    if (this._needsClear) {
      renderer.setRenderTarget(this._accumTargetA);
      renderer.clear();
      renderer.setRenderTarget(this._accumTargetB);
      renderer.clear();
      this._needsClear = false;
    }

    // 1. G-Buffer / Scene Pass
    renderer.setRenderTarget(this._sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);

    // 2. Normal Pass
    const originalOverrideMaterial = scene.overrideMaterial;
    scene.overrideMaterial = this._normalMaterial;
    renderer.setRenderTarget(this._normalTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = originalOverrideMaterial;

    // 3. Ray Tracing Pass (with SSDO Directional Contact Shadows)
    const perspCamera = camera as THREE.PerspectiveCamera;
    const near = perspCamera.near ?? 0.1;
    const far = perspCamera.far ?? 1000.0;

    this._raytraceMaterial.uniforms.tDiffuse.value = this._sceneTarget.texture;
    this._raytraceMaterial.uniforms.tNormal.value = this._normalTarget.texture;
    this._raytraceMaterial.uniforms.tDepth.value = this._sceneTarget.depthTexture;
    this._raytraceMaterial.uniforms.uFrameIndex.value = this._accumulatedFrames;
    this._raytraceMaterial.uniforms.uTime.value = performance.now() * 0.001;
    this._raytraceMaterial.uniforms.uNear.value = near;
    this._raytraceMaterial.uniforms.uFar.value = far;
    this._raytraceMaterial.uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    this._raytraceMaterial.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
    this._raytraceMaterial.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);
    this._raytraceMaterial.uniforms.uCameraMatrixWorld.value.copy(camera.matrixWorld);

    renderer.setRenderTarget(this._sampleTarget);
    this._quadMesh.material = this._raytraceMaterial;
    renderer.render(this._postScene, this._postCamera);

    // 4. Accumulation Pass: Ping-pong blend sampleTarget into accumTargetB
    this._accumulateMaterial.uniforms.tAccumPrev.value = this._accumTargetA.texture;
    this._accumulateMaterial.uniforms.tSample.value = this._sampleTarget.texture;
    this._accumulateMaterial.uniforms.uAccumCount.value = this._accumulatedFrames;

    renderer.setRenderTarget(this._accumTargetB);
    this._quadMesh.material = this._accumulateMaterial;
    renderer.render(this._postScene, this._postCamera);

    // Swap ping-pong accumulation buffers
    const temp = this._accumTargetA;
    this._accumTargetA = this._accumTargetB;
    this._accumTargetB = temp;

    this._accumulatedFrames++;

    // 5. Optional Bloom Pass on accumulated buffer
    if (this._bloomEnabled && this._bloomTarget1 && this._bloomTarget2) {
      this._renderBloom(renderer, this._accumTargetA.texture);
    }

    // 6. Output Blit Pass: ACES Filmic tonemapping directly to screen canvas
    renderer.setRenderTarget(null);
    this._quadMesh.material = this._blitMaterial;
    this._blitMaterial.uniforms.tAccum.value = this._accumTargetA.texture;
    this._blitMaterial.uniforms.tBloom.value = this._bloomTarget1?.texture ?? null;
    this._blitMaterial.uniforms.uBloomEnabled.value = this._bloomEnabled ? 1.0 : 0.0;
    this._blitMaterial.uniforms.uBloomIntensity.value = this._bloomIntensity;
    renderer.render(this._postScene, this._postCamera);
  }

  /**
   * Free all GPU memory and shader resources.
   */
  public dispose(): void {
    this._disposeRenderTargets();
    this._raytraceMaterial.dispose();
    this._accumulateMaterial.dispose();
    this._bloomExtractMaterial.dispose();
    this._bloomBlurMaterial.dispose();
    this._blitMaterial.dispose();
    this._normalMaterial.dispose();
    this._quadMesh.geometry.dispose();
  }
}
