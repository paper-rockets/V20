import * as THREE from 'three';
import { Layer, LayerBlendMode } from '../types';

/**
 * GPU Layer Compositor Shader GLSL
 *
 * Implements GPU-accelerated compositing for layer textures with:
 * - Normal: Standard Alpha Over Blending
 * - Multiply: Dst * Src
 * - Screen: 1 - (1 - Dst) * (1 - Src)
 * - Overlay: Dual-slope contrast enhancement (Dst < 0.5 ? 2*Dst*Src : 1 - 2*(1-Dst)*(1-Src))
 * - Add (Linear Dodge): min(1, Dst + Src)
 * - Subtract: max(0, Dst - Src)
 */
export const LAYER_COMPOSITING_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const LAYER_COMPOSITING_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D tDst;      // Destination / Current composite texture
  uniform sampler2D tSrc;      // Source / Active layer texture to blend
  uniform float uOpacity;      // Layer opacity multiplier (0.0 .. 1.0)
  uniform int uBlendMode;      // 0: Normal, 1: Multiply, 2: Screen, 3: Overlay, 4: Add, 5: Subtract
  uniform bool uIsBaseLayer;   // If true, source layer directly seeds the composite

  varying vec2 vUv;

  vec3 blendMultiply(vec3 dst, vec3 src) {
    return dst * src;
  }

  vec3 blendScreen(vec3 dst, vec3 src) {
    return vec3(1.0) - (vec3(1.0) - dst) * (vec3(1.0) - src);
  }

  float overlayChannel(float d, float s) {
    return d < 0.5 ? (2.0 * d * s) : (1.0 - 2.0 * (1.0 - d) * (1.0 - s));
  }

  vec3 blendOverlay(vec3 dst, vec3 src) {
    return vec3(
      overlayChannel(dst.r, src.r),
      overlayChannel(dst.g, src.g),
      overlayChannel(dst.b, src.b)
    );
  }

  vec3 blendAdd(vec3 dst, vec3 src) {
    return min(vec3(1.0), dst + src);
  }

  vec3 blendSubtract(vec3 dst, vec3 src) {
    return max(vec3(0.0), dst - src);
  }

  void main() {
    vec4 src = texture2D(tSrc, vUv);
    float effectiveAlpha = clamp(src.a * uOpacity, 0.0, 1.0);

    if (uIsBaseLayer) {
      if (effectiveAlpha <= 0.0001) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
      }
      gl_FragColor = vec4(src.rgb, effectiveAlpha);
      return;
    }

    vec4 dst = texture2D(tDst, vUv);

    if (effectiveAlpha <= 0.0001) {
      gl_FragColor = dst;
      return;
    }

    if (dst.a <= 0.0001) {
      gl_FragColor = vec4(src.rgb, effectiveAlpha);
      return;
    }

    vec3 blendedRgb = src.rgb;
    if (uBlendMode == 1) {
      blendedRgb = blendMultiply(dst.rgb, src.rgb);
    } else if (uBlendMode == 2) {
      blendedRgb = blendScreen(dst.rgb, src.rgb);
    } else if (uBlendMode == 3) {
      blendedRgb = blendOverlay(dst.rgb, src.rgb);
    } else if (uBlendMode == 4) {
      blendedRgb = blendAdd(dst.rgb, src.rgb);
    } else if (uBlendMode == 5) {
      blendedRgb = blendSubtract(dst.rgb, src.rgb);
    }

    // Standard Porter-Duff source-over composite with blend result
    vec3 outRgb = mix(dst.rgb, blendedRgb, effectiveAlpha);
    float outAlpha = dst.a + effectiveAlpha * (1.0 - dst.a);

    gl_FragColor = vec4(outRgb, clamp(outAlpha, 0.0, 1.0));
  }
`;

export interface LayerTextureSource {
  id: string;
  texture: THREE.Texture;
  visible: boolean;
  opacity: number;
  blendMode: LayerBlendMode;
}

export class GPULayerCompositor {
  private renderer: THREE.WebGLRenderer | null = null;
  private width: number;
  private height: number;

  private targetA: THREE.WebGLRenderTarget;
  private targetB: THREE.WebGLRenderTarget;
  private activeTarget: THREE.WebGLRenderTarget;

  private quadScene: THREE.Scene;
  private quadCamera: THREE.OrthographicCamera;
  private quadMaterial: THREE.ShaderMaterial;
  private quadMesh: THREE.Mesh;

  private clearScene: THREE.Scene;
  private clearMaterial: THREE.MeshBasicMaterial;

  constructor(resolution: number = 2048) {
    this.width = resolution;
    this.height = resolution;

    const options: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      generateMipmaps: false,
      colorSpace: THREE.SRGBColorSpace,
    };

    this.targetA = new THREE.WebGLRenderTarget(this.width, this.height, options);
    this.targetB = new THREE.WebGLRenderTarget(this.width, this.height, options);
    this.activeTarget = this.targetA;

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.quadMaterial = new THREE.ShaderMaterial({
      vertexShader: LAYER_COMPOSITING_VERTEX_SHADER,
      fragmentShader: LAYER_COMPOSITING_FRAGMENT_SHADER,
      uniforms: {
        tDst: { value: null },
        tSrc: { value: null },
        uOpacity: { value: 1.0 },
        uBlendMode: { value: 0 },
        uIsBaseLayer: { value: false },
      },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.NoBlending,
    });

    const geom = new THREE.PlaneGeometry(2, 2);
    this.quadMesh = new THREE.Mesh(geom, this.quadMaterial);
    this.quadScene.add(this.quadMesh);

    // Clear helper
    this.clearScene = new THREE.Scene();
    this.clearMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0 });
    this.clearScene.add(new THREE.Mesh(geom, this.clearMaterial));
  }

  public setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
  }

  public getCompositeTexture(): THREE.Texture {
    return this.activeTarget.texture;
  }

  public static blendModeToEnum(mode?: LayerBlendMode): number {
    switch (mode) {
      case 'multiply':
        return 1;
      case 'screen':
        return 2;
      case 'overlay':
        return 3;
      case 'add':
        return 4;
      case 'subtract':
        return 5;
      case 'normal':
      default:
        return 0;
    }
  }

  /**
   * Composites an ordered list of layer textures (bottom to top) onto the GPU render targets
   */
  public composite(sources: LayerTextureSource[], renderer?: THREE.WebGLRenderer): THREE.Texture {
    const gl = renderer || this.renderer;
    if (!gl) {
      return this.activeTarget.texture;
    }

    const origClearColor = new THREE.Color();
    gl.getClearColor(origClearColor);
    const origClearAlpha = gl.getClearAlpha();

    const visibleSources = sources.filter((s) => s.visible && s.opacity > 0.001);

    if (visibleSources.length === 0) {
      // Clear target to full transparent
      gl.setClearColor(0x000000, 0.0);
      gl.setRenderTarget(this.targetA);
      gl.clear(true, true, true);
      gl.setRenderTarget(null);
      gl.setClearColor(origClearColor, origClearAlpha);
      this.activeTarget = this.targetA;
      return this.activeTarget.texture;
    }

    let readTarget = this.targetA;
    let writeTarget = this.targetB;

    // Reset initial targets to transparent black
    gl.setClearColor(0x000000, 0.0);
    gl.setRenderTarget(readTarget);
    gl.clear(true, true, true);
    gl.setRenderTarget(writeTarget);
    gl.clear(true, true, true);

    for (let i = 0; i < visibleSources.length; i++) {
      const src = visibleSources[i];
      const isBase = i === 0;

      this.quadMaterial.uniforms.tDst.value = isBase ? null : readTarget.texture;
      this.quadMaterial.uniforms.tSrc.value = src.texture;
      this.quadMaterial.uniforms.uOpacity.value = Math.max(0.0, Math.min(1.0, src.opacity));
      this.quadMaterial.uniforms.uBlendMode.value = GPULayerCompositor.blendModeToEnum(src.blendMode);
      this.quadMaterial.uniforms.uIsBaseLayer.value = isBase;

      gl.setRenderTarget(writeTarget);
      gl.render(this.quadScene, this.quadCamera);

      // Swap ping-pong targets
      const temp = readTarget;
      readTarget = writeTarget;
      writeTarget = temp;
    }

    gl.setRenderTarget(null);
    gl.setClearColor(origClearColor, origClearAlpha);
    this.activeTarget = readTarget;
    return this.activeTarget.texture;
  }

  /**
   * Merges two layer textures together on the GPU
   */
  public mergeTwoLayers(
    bottomTexture: THREE.Texture,
    topTexture: THREE.Texture,
    topOpacity: number,
    topBlendMode: LayerBlendMode,
    renderer?: THREE.WebGLRenderer
  ): THREE.Texture {
    const gl = renderer || this.renderer;
    if (!gl) return bottomTexture;

    // Step 1: Write bottom layer as base
    this.quadMaterial.uniforms.tDst.value = null;
    this.quadMaterial.uniforms.tSrc.value = bottomTexture;
    this.quadMaterial.uniforms.uOpacity.value = 1.0;
    this.quadMaterial.uniforms.uBlendMode.value = 0;
    this.quadMaterial.uniforms.uIsBaseLayer.value = true;

    gl.setRenderTarget(this.targetA);
    gl.render(this.quadScene, this.quadCamera);

    // Step 2: Blend top layer over bottom layer
    this.quadMaterial.uniforms.tDst.value = this.targetA.texture;
    this.quadMaterial.uniforms.tSrc.value = topTexture;
    this.quadMaterial.uniforms.uOpacity.value = topOpacity;
    this.quadMaterial.uniforms.uBlendMode.value = GPULayerCompositor.blendModeToEnum(topBlendMode);
    this.quadMaterial.uniforms.uIsBaseLayer.value = false;

    gl.setRenderTarget(this.targetB);
    gl.render(this.quadScene, this.quadCamera);
    gl.setRenderTarget(null);

    this.activeTarget = this.targetB;
    return this.activeTarget.texture;
  }

  public dispose(): void {
    this.targetA.dispose();
    this.targetB.dispose();
    this.quadMaterial.dispose();
    this.quadMesh.geometry.dispose();
  }
}
