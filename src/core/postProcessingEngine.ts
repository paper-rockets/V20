import * as THREE from 'three';
import { PostProcessSettings } from '../types';
import { OKLAB_FULL_PIPELINE_GLSL } from './colorMath';
import { WBOITPipeline } from './wboitPipeline';
import { getQualityProfile, QualityProfile } from '../utils/deviceProfile';

/**
 * Post-Processing & Render Modifiers Engine
 *
 * Implements high-performance Paper Rocket-style render modes:
 * - Draft Mode: Direct zero-latency hardware rasterization
 * - Render Mode: Multi-effect compositing pass with:
 *   - 2-Pass Downsampled Separable Gaussian Bloom (1/4 resolution, ~95% fillrate reduction)
 *   - Toon / Cel-shading luminance quantization (hard-banded light steps in OKLab)
 *   - Optimized Depth of Field (DoF) focal blur tethered to camera orbit fulcrum
 *   - Film Grain & Retro Pixelation Grid
 *   - WBOIT Weighted Blended Order-Independent Transparency
 *   - Locked sRGB swapchains and Linear RGB post-processing calculations
 */

// 1. Bright-pass & Downsample Shader (Extracts HDR / emissive glow fragments)
const BRIGHT_PASS_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_PASS_FRAGMENT = `
  ${OKLAB_FULL_PIPELINE_GLSL}
  uniform sampler2D tDiffuse;
  uniform float uBloomThreshold;
  varying vec2 vUv;

  void main() {
    vec4 col = texture2D(tDiffuse, vUv);
    vec3 linear = srgb_to_linear(col.rgb);
    float brightness = dot(linear, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > uBloomThreshold || max(linear.r, max(linear.g, linear.b)) > 1.0) {
      gl_FragColor = vec4(linear, 1.0);
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
  }
`;

// 2. 1D Separable 9-Tap Gaussian Blur Shader
const BLUR_1D_FRAGMENT = `
  uniform sampler2D tInput;
  uniform vec2 uDirection; // (1/w, 0) for H blur, (0, 1/h) for V blur
  varying vec2 vUv;

  void main() {
    vec3 sum = vec3(0.0);
    // 9-Tap discrete Gaussian kernel weights (sigma ~ 2.5)
    sum += texture2D(tInput, vUv - uDirection * 4.0).rgb * 0.0162162162;
    sum += texture2D(tInput, vUv - uDirection * 3.0).rgb * 0.0540540541;
    sum += texture2D(tInput, vUv - uDirection * 2.0).rgb * 0.1216216216;
    sum += texture2D(tInput, vUv - uDirection * 1.0).rgb * 0.1945945946;
    sum += texture2D(tInput, vUv).rgb * 0.2270270270;
    sum += texture2D(tInput, vUv + uDirection * 1.0).rgb * 0.1945945946;
    sum += texture2D(tInput, vUv + uDirection * 2.0).rgb * 0.1216216216;
    sum += texture2D(tInput, vUv + uDirection * 3.0).rgb * 0.0540540541;
    sum += texture2D(tInput, vUv + uDirection * 4.0).rgb * 0.0162162162;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

export class PostProcessingEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Render targets for multi-pass compositing.
  // Allocated lazily: in draft mode (the default, and the only mode on low-power
  // hardware) nothing here is needed, and at DPR 2 on a 1200x2000 panel a single
  // full-resolution HalfFloat target is ~77 MB of VRAM.
  private renderTargetA: THREE.WebGLRenderTarget | null = null;
  private bloomTargetDown: THREE.WebGLRenderTarget | null = null;
  private bloomTargetH: THREE.WebGLRenderTarget | null = null;
  private bloomTargetV: THREE.WebGLRenderTarget | null = null;

  // WBOIT Transparency Pipeline (also lazily created).
  private wboitPipeline: WBOITPipeline | null = null;

  private profile: QualityProfile;
  private width: number;
  private height: number;

  // Fullscreen Quad & Cameras
  private quadScene: THREE.Scene;
  private quadCamera: THREE.OrthographicCamera;
  private quadMesh: THREE.Mesh;

  // Pass materials
  private brightPassMaterial: THREE.ShaderMaterial;
  private blurHMaterial: THREE.ShaderMaterial;
  private blurVMaterial: THREE.ShaderMaterial;
  private postMaterial: THREE.ShaderMaterial;

  private settings: PostProcessSettings = {
    renderMode: 'draft',
    toonShading: false,
    toonSteps: 3,
    bloom: true,
    bloomIntensity: 1.2,
    bloomRadius: 0.8,
    bloomThreshold: 0.85,
    dof: false,
    dofFocusDistance: 2.5,
    dofAperture: 0.015,
    grain: false,
    grainIntensity: 0.08,
    pixelation: false,
    pixelSize: 4,
  };

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.profile = getQualityProfile();
    this.width = width;
    this.height = height;

    const bw = this.bloomWidth();
    const bh = this.bloomHeight();

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 1. Bright Pass Material
    this.brightPassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uBloomThreshold: { value: 0.85 },
      },
      vertexShader: BRIGHT_PASS_VERTEX,
      fragmentShader: BRIGHT_PASS_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });

    // 2. Horizontal Blur Material
    this.blurHMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: null },
        uDirection: { value: new THREE.Vector2(1.0 / bw, 0.0) },
      },
      vertexShader: BRIGHT_PASS_VERTEX,
      fragmentShader: BLUR_1D_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });

    // 3. Vertical Blur Material
    this.blurVMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: null },
        uDirection: { value: new THREE.Vector2(0.0, 1.0 / bh) },
      },
      vertexShader: BRIGHT_PASS_VERTEX,
      fragmentShader: BLUR_1D_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });

    // 4. Main Compositing Material
    this.postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        uResolution: { value: new THREE.Vector2(this.targetWidth(), this.targetHeight()) },
        uTime: { value: 0.0 },
        uRenderMode: { value: 0 },
        uToonShading: { value: false },
        uToonSteps: { value: 3.0 },
        uBloom: { value: true },
        uBloomIntensity: { value: 1.2 },
        uDoF: { value: false },
        uFocusDistance: { value: 2.5 },
        uAperture: { value: 0.015 },
        uGrain: { value: false },
        uGrainIntensity: { value: 0.08 },
        uPixelation: { value: false },
        uPixelSize: { value: 4.0 },
      },
      vertexShader: BRIGHT_PASS_VERTEX,
      fragmentShader: `
        ${OKLAB_FULL_PIPELINE_GLSL}

        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        uniform vec2 uResolution;
        uniform float uTime;
        uniform int uRenderMode;
        uniform bool uToonShading;
        uniform float uToonSteps;
        uniform bool uBloom;
        uniform float uBloomIntensity;
        uniform bool uDoF;
        uniform float uFocusDistance;
        uniform float uAperture;
        uniform bool uGrain;
        uniform float uGrainIntensity;
        uniform bool uPixelation;
        uniform float uPixelSize;

        varying vec2 vUv;

        float rand(vec2 co) {
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        void main() {
          vec2 uv = vUv;

          // 1. Retro Pixelation
          if (uPixelation && uPixelSize > 1.0) {
            vec2 dxy = uPixelSize / uResolution;
            uv = dxy * floor(uv / dxy);
          }

          vec4 baseColor = texture2D(tDiffuse, uv);

          // If Draft Mode, pass through directly
          if (uRenderMode == 0) {
            gl_FragColor = baseColor;
            return;
          }

          // Convert to Linear RGB for physical post-processing calculations
          vec3 linearColor = srgb_to_linear(baseColor.rgb);

          // 2. Depth of Field (DoF) / Bokeh Blur (Fast 4-Tap Radial Jitter)
          if (uDoF) {
            vec2 blurDir = (uv - vec2(0.5));
            float distFromCenter = length(blurDir);
            float blurAmount = clamp(abs(distFromCenter - 0.3) * uAperture * 20.0, 0.0, 0.01);
            if (blurAmount > 0.0005) {
              vec3 blurred = linearColor * 0.4;
              blurred += srgb_to_linear(texture2D(tDiffuse, uv + vec2(blurAmount, blurAmount)).rgb) * 0.15;
              blurred += srgb_to_linear(texture2D(tDiffuse, uv + vec2(-blurAmount, blurAmount)).rgb) * 0.15;
              blurred += srgb_to_linear(texture2D(tDiffuse, uv + vec2(blurAmount, -blurAmount)).rgb) * 0.15;
              blurred += srgb_to_linear(texture2D(tDiffuse, uv + vec2(-blurAmount, -blurAmount)).rgb) * 0.15;
              linearColor = blurred;
            }
          }

          // 3. Bloom Additive Composite (from 2-pass separable 1/4 res target)
          if (uBloom) {
            vec3 bloomSample = texture2D(tBloom, uv).rgb;
            linearColor += bloomSample * uBloomIntensity;
          }

          // 4. Toon / Cel Shading Quantization in OKLab
          if (uToonShading) {
            vec3 oklab = linear_srgb_to_oklab(linearColor);
            float steppedL = floor(oklab.x * uToonSteps + 0.5) / uToonSteps;
            oklab.x = mix(oklab.x, steppedL, 0.85);
            linearColor = oklab_to_linear_srgb(oklab);
          }

          // 5. Film Grain Noise
          if (uGrain) {
            float noise = (rand(uv + fract(uTime * 0.05)) - 0.5) * uGrainIntensity;
            linearColor += vec3(noise);
          }

          gl_FragColor = vec4(linear_to_srgb(clamp(linearColor, 0.0, 1.0)), baseColor.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.quadScene.add(this.quadMesh);
  }

  // --- Target sizing helpers -------------------------------------------
  private targetWidth(): number {
    return Math.max(1, Math.floor(this.width * this.renderer.getPixelRatio()));
  }

  private targetHeight(): number {
    return Math.max(1, Math.floor(this.height * this.renderer.getPixelRatio()));
  }

  private bloomWidth(): number {
    return Math.max(1, Math.floor(this.targetWidth() / this.profile.bloomDivisor));
  }

  private bloomHeight(): number {
    return Math.max(1, Math.floor(this.targetHeight() / this.profile.bloomDivisor));
  }

  /**
   * Allocates the offscreen targets on first use.
   *
   * Nothing here is touched in draft mode, so a device that never leaves draft
   * (every low-power device, and most sessions on any device) never pays the
   * VRAM cost at all. HalfFloat is downgraded to UnsignedByte where the profile
   * asks for it, halving the bandwidth of every full-screen read and write.
   */
  private ensureTargets(): boolean {
    if (this.renderTargetA) return true;

    const w = this.targetWidth();
    const h = this.targetHeight();
    const bw = this.bloomWidth();
    const bh = this.bloomHeight();
    const hdrType = this.profile.halfFloatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType;

    this.renderTargetA = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: hdrType,
      stencilBuffer: true,
      depthBuffer: true,
      colorSpace: THREE.SRGBColorSpace,
    });

    const bloomOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: hdrType,
      stencilBuffer: false,
      depthBuffer: false,
    };

    this.bloomTargetDown = new THREE.WebGLRenderTarget(bw, bh, bloomOptions);
    this.bloomTargetH = new THREE.WebGLRenderTarget(bw, bh, bloomOptions);
    this.bloomTargetV = new THREE.WebGLRenderTarget(bw, bh, bloomOptions);

    this.blurHMaterial.uniforms.uDirection.value.set(1.0 / bw, 0.0);
    this.blurVMaterial.uniforms.uDirection.value.set(0.0, 1.0 / bh);
    this.postMaterial.uniforms.uResolution.value.set(w, h);

    return true;
  }

  /**
   * Weighted-blended OIT pipeline. Created on first access only - it owns three
   * more full-resolution targets and is not part of the default draft path.
   */
  public get wboit(): WBOITPipeline | null {
    if (!this.wboitPipeline && this.profile.wboit) {
      this.wboitPipeline = new WBOITPipeline(this.renderer, this.width, this.height);
    }
    return this.wboitPipeline;
  }

  /** Releases the offscreen targets without tearing down the engine. */
  private releaseTargets(): void {
    this.renderTargetA?.dispose();
    this.bloomTargetDown?.dispose();
    this.bloomTargetH?.dispose();
    this.bloomTargetV?.dispose();
    this.renderTargetA = null;
    this.bloomTargetDown = null;
    this.bloomTargetH = null;
    this.bloomTargetV = null;
  }

  public setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    const w = this.targetWidth();
    const h = this.targetHeight();
    const bw = this.bloomWidth();
    const bh = this.bloomHeight();

    // Only resize what actually exists; allocation still happens on demand.
    this.renderTargetA?.setSize(w, h);
    this.bloomTargetDown?.setSize(bw, bh);
    this.bloomTargetH?.setSize(bw, bh);
    this.bloomTargetV?.setSize(bw, bh);
    this.wboitPipeline?.setSize(width, height);

    this.blurHMaterial.uniforms.uDirection.value.set(1.0 / bw, 0.0);
    this.blurVMaterial.uniforms.uDirection.value.set(0.0, 1.0 / bh);
    this.postMaterial.uniforms.uResolution.value.set(w, h);
  }

  public updateSettings(newSettings: Partial<PostProcessSettings>): void {
    const wasRenderMode = this.settings.renderMode === 'render';
    this.settings = { ...this.settings, ...newSettings };

    // Low-power hardware stays in draft: the compositor's full-screen passes are
    // pure fill-rate on a GPU that is already the bottleneck.
    if (!this.profile.postProcessing) {
      this.settings.renderMode = 'draft';
    }

    // Leaving render mode frees several megabytes of VRAM immediately rather than
    // holding the targets for a mode the user may never return to.
    if (wasRenderMode && this.settings.renderMode !== 'render') {
      this.releaseTargets();
    }

    const u = this.postMaterial.uniforms;
    u.uRenderMode.value = this.settings.renderMode === 'render' ? 1 : 0;
    u.uToonShading.value = this.settings.toonShading;
    u.uToonSteps.value = this.settings.toonSteps;
    u.uBloom.value = this.settings.bloom;
    u.uBloomIntensity.value = this.settings.bloomIntensity;
    this.brightPassMaterial.uniforms.uBloomThreshold.value = this.settings.bloomThreshold;

    u.uDoF.value = this.settings.dof;
    u.uFocusDistance.value = this.settings.dofFocusDistance;
    u.uAperture.value = this.settings.dofAperture;
    u.uGrain.value = this.settings.grain;
    u.uGrainIntensity.value = this.settings.grainIntensity;
    u.uPixelation.value = this.settings.pixelation;
    u.uPixelSize.value = this.settings.pixelSize;
  }

  public getSettings(): PostProcessSettings {
    return { ...this.settings };
  }

  /**
   * Main render loop call:
   * 1. If Draft Mode, renders scene directly to default framebuffer.
   * 2. If Render Mode:
   *    a. Renders scene to full-resolution renderTargetA.
   *    b. If Bloom is enabled:
   *       - Extracts bright pass to 1/4 resolution bloomTargetDown.
   *       - Horizontal Gaussian blur to bloomTargetH.
   *       - Vertical Gaussian blur to bloomTargetV.
   *    c. Composites all passes onto the screen quad in a single final shader step.
   */
  public render(time: number = 0): void {
    // Draft mode (and every low-power session) renders straight to the swapchain:
    // no offscreen target, no extra full-screen passes, no extra bandwidth.
    if (this.settings.renderMode === 'draft' || !this.profile.postProcessing) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.ensureTargets();

    const targetA = this.renderTargetA;
    const down = this.bloomTargetDown;
    const blurH = this.bloomTargetH;
    const blurV = this.bloomTargetV;

    if (!targetA) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const bloomEnabled = this.settings.bloom && this.profile.bloom && !!down && !!blurH && !!blurV;

    // Pass 1: Render 3D scene to full-res target A
    this.renderer.setRenderTarget(targetA);
    this.renderer.render(this.scene, this.camera);

    // Pass 2: Bloom downsample & 2-pass separable blur (downsampled)
    if (bloomEnabled) {
      // 2a. Bright Pass & Downsample (TargetA -> bloomTargetDown)
      this.quadMesh.material = this.brightPassMaterial;
      this.brightPassMaterial.uniforms.tDiffuse.value = targetA.texture;
      this.renderer.setRenderTarget(down);
      this.renderer.render(this.quadScene, this.quadCamera);

      // 2b. Horizontal Blur (bloomTargetDown -> bloomTargetH)
      this.quadMesh.material = this.blurHMaterial;
      this.blurHMaterial.uniforms.tInput.value = down!.texture;
      this.renderer.setRenderTarget(blurH);
      this.renderer.render(this.quadScene, this.quadCamera);

      // 2c. Vertical Blur (bloomTargetH -> bloomTargetV)
      this.quadMesh.material = this.blurVMaterial;
      this.blurVMaterial.uniforms.tInput.value = blurH!.texture;
      this.renderer.setRenderTarget(blurV);
      this.renderer.render(this.quadScene, this.quadCamera);
    }

    // Pass 3: Final Composite to Screen
    this.quadMesh.material = this.postMaterial;
    this.postMaterial.uniforms.tDiffuse.value = targetA.texture;
    this.postMaterial.uniforms.uBloom.value = bloomEnabled;
    this.postMaterial.uniforms.tBloom.value = bloomEnabled ? blurV!.texture : null;
    this.postMaterial.uniforms.uTime.value = time;

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  public dispose(): void {
    this.releaseTargets();
    // The WBOIT pipeline owns three more full-resolution targets; it was
    // previously constructed here but never released.
    this.wboitPipeline?.dispose();
    this.wboitPipeline = null;
    this.brightPassMaterial.dispose();
    this.blurHMaterial.dispose();
    this.blurVMaterial.dispose();
    this.postMaterial.dispose();
    this.quadMesh.geometry.dispose();
    this.quadScene.clear();
  }
}

