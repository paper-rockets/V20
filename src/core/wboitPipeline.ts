/**
 * @license
 * Weighted Blended Order-Independent Transparency (WBOIT) Pipeline
 *
 * Replaces dual-pass alpha sorting with McGuire & Bavoil WBOIT using Multiple Render Targets (MRTs).
 *
 * Pipeline:
 * 1. Opaque Pass: Render solid geometries & model into opaque framebuffer + depth texture.
 * 2. Transparent Accumulation Pass:
 *    - Render Target 0 (Accumulation Buffer, RGBA16F): vec4(color.rgb * alpha * weight, alpha * weight)
 *    - Render Target 1 (Revealage Buffer, R16F/RGBA16F): product of (1.0 - alpha)
 * 3. Composite Pass: Reconstruct blended color:
 *    C = (accum.rgb / max(accum.a, 1e-5)) * (1.0 - reveal) + opaque.rgb * reveal
 */

import * as THREE from 'three';
import { OKLAB_FULL_PIPELINE_GLSL } from './colorMath';

export const WBOIT_WEIGHT_GLSL_CHUNK = `
// McGuire & Bavoil tuned depth-based transparency weight function
float computeWBOITWeight(float z, float alpha, vec3 color) {
  float linearZ = clamp(abs(z), 0.01, 100.0);
  float a = min(1.0, alpha) * 8.0 + 0.01;
  float b = 1.0 - (gl_FragCoord.z * 0.95);
  // Weight function balancing near/far opacity without color distortion
  float w = clamp(pow(a, 3.0) * 1e4 * pow(max(0.01, b), 3.0), 1e-2, 3e3);
  return w;
}
`;

export const WBOIT_ACCUM_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const WBOIT_ACCUM_FRAGMENT_SHADER = `
${OKLAB_FULL_PIPELINE_GLSL}
${WBOIT_WEIGHT_GLSL_CHUNK}

uniform vec3 uColor;
uniform float uOpacity;
uniform float uRoughness;
uniform float uMetalness;
uniform vec3 uLightDir;
uniform vec3 uLightColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  float alpha = clamp(uOpacity, 0.0, 1.0);
  if (alpha < 0.005) discard;

  // Linear RGB Lighting
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + V);

  float NdotL = max(dot(N, L), 0.0);
  float NdotH = max(dot(N, H), 0.0);

  vec3 linearBase = srgb_to_linear(uColor);
  vec3 diffuse = linearBase * (1.0 - uMetalness) * (0.35 + 0.65 * NdotL);
  vec3 specular = vec3(pow(max(0.0, NdotH), 24.0) * (0.04 + 0.96 * uMetalness));
  vec3 color = diffuse + specular;

  float weight = computeWBOITWeight(vViewPosition.z, alpha, color);

  // gl_FragData[0]: Accumulation = vec4(C * a * w, a * w)
  // gl_FragData[1]: Revealage = vec4(a)
  gl_FragColor = vec4(color * alpha * weight, alpha * weight);
}
`;

export const WBOIT_COMPOSITE_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const WBOIT_COMPOSITE_FRAGMENT_SHADER = `
${OKLAB_FULL_PIPELINE_GLSL}

uniform sampler2D tOpaque;
uniform sampler2D tAccum;
uniform sampler2D tReveal;
varying vec2 vUv;

void main() {
  vec4 opaque = texture2D(tOpaque, vUv);
  vec4 accum = texture2D(tAccum, vUv);
  vec4 revealSample = texture2D(tReveal, vUv);
  float reveal = revealSample.r;

  // If no transparent fragments covered this pixel, pass opaque through directly
  if (reveal >= 0.99999 || accum.a <= 1e-6) {
    gl_FragColor = opaque;
    return;
  }

  // Reconstruct average transparent color from weighted accumulation
  vec3 avgColor = accum.rgb / max(accum.a, 1e-5);

  // Convert opaque background to linear for physically accurate compositing
  vec3 linearOpaque = srgb_to_linear(opaque.rgb);
  vec3 linearTrans = avgColor; // already in linear RGB

  // Composite in linear space
  vec3 finalLinear = linearTrans * (1.0 - reveal) + linearOpaque * reveal;

  // Return to sRGB swapchain
  gl_FragColor = vec4(linear_to_srgb(finalLinear), 1.0);
}
`;

export class WBOITPipeline {
  private renderer: THREE.WebGLRenderer;
  private width: number;
  private height: number;

  // Render Targets
  public opaqueTarget: THREE.WebGLRenderTarget;
  public accumTarget: THREE.WebGLRenderTarget;
  public revealTarget: THREE.WebGLRenderTarget;

  // Composite Scene
  private compositeScene: THREE.Scene;
  private compositeCamera: THREE.OrthographicCamera;
  private compositeMaterial: THREE.ShaderMaterial;
  private compositeQuad: THREE.Mesh;

  private isEnabled: boolean = true;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    const pr = renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));

    const halfFloatOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      stencilBuffer: true,
      depthBuffer: true,
    };

    this.opaqueTarget = new THREE.WebGLRenderTarget(w, h, {
      ...halfFloatOptions,
      colorSpace: THREE.SRGBColorSpace,
    });

    this.accumTarget = new THREE.WebGLRenderTarget(w, h, {
      ...halfFloatOptions,
      type: THREE.HalfFloatType, // Accum requires high dynamic range
      colorSpace: THREE.LinearSRGBColorSpace,
    });

    this.revealTarget = new THREE.WebGLRenderTarget(w, h, {
      ...halfFloatOptions,
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
    });

    // Composite Quad setup
    this.compositeScene = new THREE.Scene();
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tOpaque: { value: this.opaqueTarget.texture },
        tAccum: { value: this.accumTarget.texture },
        tReveal: { value: this.revealTarget.texture },
      },
      vertexShader: WBOIT_COMPOSITE_VERTEX_SHADER,
      fragmentShader: WBOIT_COMPOSITE_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMaterial);
    this.compositeScene.add(this.compositeQuad);
  }

  public setSize(width: number, height: number): void {
    const pr = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));

    this.width = w;
    this.height = h;

    this.opaqueTarget.setSize(w, h);
    this.accumTarget.setSize(w, h);
    this.revealTarget.setSize(w, h);
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Clears WBOIT buffers with correct mathematical initial values
   */
  public clearBuffers(): void {
    // Clear Accum to vec4(0.0)
    this.renderer.setRenderTarget(this.accumTarget);
    this.renderer.setClearColor(0x000000, 0.0);
    this.renderer.clear(true, true, true);

    // Clear Revealage to vec4(1.0)
    this.renderer.setRenderTarget(this.revealTarget);
    this.renderer.setClearColor(0xffffff, 1.0);
    this.renderer.clear(true, true, true);
  }

  /**
   * Executes the full-screen composite pass
   */
  public renderComposite(destinationTarget: THREE.WebGLRenderTarget | null = null): void {
    this.compositeMaterial.uniforms.tOpaque.value = this.opaqueTarget.texture;
    this.compositeMaterial.uniforms.tAccum.value = this.accumTarget.texture;
    this.compositeMaterial.uniforms.tReveal.value = this.revealTarget.texture;

    this.renderer.setRenderTarget(destinationTarget);
    this.renderer.render(this.compositeScene, this.compositeCamera);
  }

  public dispose(): void {
    this.opaqueTarget.dispose();
    this.accumTarget.dispose();
    this.revealTarget.dispose();
    this.compositeMaterial.dispose();
    this.compositeQuad.geometry.dispose();
  }
}
