import * as THREE from 'three';
import { BrushSettings, MaterialType, PatternType, LayerBlendMode } from '../types';
import {
  AnimatedShaderEffect,
  EFFECT_SPEEDS,
  STANDARD_VERTEX_SHADER,
  getEffectFragmentShader,
  globalShaderRegistry,
} from './animatedShaders';
import { getQualityProfile } from '../utils/deviceProfile';

/**
 * Normalizes any hex or color string to valid lowercase 6-digit #rrggbb
 */
export function normalizeHexColor(hex: string | undefined | null, fallback: string = '#38bdf8'): string {
  if (!hex || typeof hex !== 'string') return fallback;
  let clean = hex.trim().toLowerCase();
  if (!clean.startsWith('#')) {
    clean = '#' + clean;
  }
  // Expand 3-character shorthand #rgb to #rrggbb
  if (/^#[0-9a-f]{3}$/.test(clean)) {
    clean = '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
  }
  if (/^#[0-9a-f]{6}$/.test(clean)) {
    return clean;
  }
  return fallback;
}

/**
 * Material Cache & Shader Pipeline Engine
 *
 * Implements strict key isolation and contracts for:
 * - Shadeless / Flat Paint: Unlit MeshBasicMaterial immune to scene lighting with negative polygon offset
 * - Shaded / Lit PBR: MeshStandardMaterial responding dynamically to lights, roughness & metalness
 * - Glow / Bloom: Emissive MeshBasicMaterial with HDR boost (2.5x) for bloom passes
 * - Cutout Mask: Spatial negative-space depth mask punching holes through overlapping 3D curves
 * - Animated FX Shaders: 27 animated GLSL shaders with Oklab perceptual color space blending
 * - Model Canvas Materials: Sculptor clay (0xcdd3dc) and textured mesh with positive depth bias (+2.0)
 */
export class MaterialCache {
  private static fallbackWhiteTexture: THREE.CanvasTexture | null = null;
  private cache: Map<string, THREE.Material> = new Map();

  /**
   * Get or create a compliant stroke material with aggressive depth bias and stencil testing
   */
  public getStrokeMaterial(
    settings: BrushSettings,
    isOnModel: boolean = true,
    layerOpacity: number = 1.0,
    layerBlendMode: LayerBlendMode = 'normal'
  ): THREE.Material {
    const effectiveOpacity = Math.max(0.01, Math.min(1.0, (settings.opacity ?? 1.0) * layerOpacity));
    const modeKey = isOnModel ? 'm1' : 'm0';
    const stencilKey = settings.stencilMasking && isOnModel ? 's1' : 's0';
    const matType: MaterialType = settings.materialType || 'shaded';
    const patType: PatternType = settings.patternType || 'none';
    const patScale = settings.patternScale ?? 4.0;
    const patInt = settings.patternIntensity ?? 0.8;
    const patAng = settings.patternAngle ?? 45;
    const patContr = settings.patternContrast ?? 1.0;
    const effect: AnimatedShaderEffect = settings.shaderEffect || 'fire';

    const validColor = normalizeHexColor(settings.color, '#38bdf8');
    const shaderKey = settings.customShader?.id || settings.customShader?.name || effect;
    const matcapKey = settings.matcapUrl ? settings.matcapUrl.slice(0, 32) : (settings.matcapTexture ? 'has_tex' : 'no_matcap');

    // Strict isolation key
    const key = `${matType}|${shaderKey}|${matcapKey}|${validColor}|o${effectiveOpacity.toFixed(3)}|r${(settings.roughness ?? 0.35).toFixed(2)}|m${(settings.metalness ?? 0.15).toFixed(2)}|e${(settings.emissiveIntensity ?? 0).toFixed(2)}|${modeKey}|${stencilKey}|p_${patType}_${patScale}_${patInt}_${patAng}_${patContr}|b_${layerBlendMode}`;

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const color = new THREE.Color(validColor);
    const isOpaque = effectiveOpacity >= 0.99 && layerBlendMode === 'normal';

    let material: THREE.Material;

    if (matType === 'cutout') {
      // 1. Cutout: Spatial negative-space material punching through overlapping 3D curves & depth
      material = new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4.0,
        polygonOffsetUnits: -4.0,
      });
    } else if (matType === 'glow') {
      // 2. Emissive (Glow): Self-illuminated HDR emission for bloom post-processing passes
      const glowIntensity = Math.max(1.5, (settings.emissiveIntensity || 1.0) * 2.5);
      const glowColor = color.clone().multiplyScalar(glowIntensity);
      material = new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: !isOpaque,
        opacity: effectiveOpacity,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: isOpaque,
        polygonOffset: true,
        polygonOffsetFactor: -3.0,
        polygonOffsetUnits: -3.0,
        toneMapped: false,
      });
    } else if (matType === 'matcap') {
      // 3. MatCap Material: Dynamic sphere-mapped texture lighting
      let matcapTex = settings.matcapTexture;
      if (!matcapTex && settings.matcapUrl) {
        try {
          const loader = new THREE.TextureLoader();
          matcapTex = loader.load(settings.matcapUrl);
        } catch (_) {}
      }
      material = new THREE.MeshMatcapMaterial({
        color: color,
        matcap: matcapTex || null,
        transparent: !isOpaque,
        opacity: effectiveOpacity,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: isOpaque,
        polygonOffset: true,
        polygonOffsetFactor: -3.0,
        polygonOffsetUnits: -3.0,
      });
    } else if (matType === 'animated_fx') {
      // 4. Animated FX Shader Material (Custom GLSL or standard 27 presets)
      if (settings.customShader && settings.customShader.fragmentShader) {
        let boundTex = settings.matcapTexture || null;
        if (!boundTex && settings.matcapUrl) {
          try {
            const loader = new THREE.TextureLoader();
            boundTex = loader.load(settings.matcapUrl);
          } catch (_) {}
        }
        
        // Use a static 2x2 white canvas texture fallback if no texture is provided to safely satisfy sampler2D uniforms
        if (!boundTex) {
          if (!MaterialCache.fallbackWhiteTexture) {
            const canvas = document.createElement('canvas');
            canvas.width = 2;
            canvas.height = 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, 2, 2);
            }
            MaterialCache.fallbackWhiteTexture = new THREE.CanvasTexture(canvas);
          }
          boundTex = MaterialCache.fallbackWhiteTexture;
        }

        const customUniforms: Record<string, any> = {
          uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
          u_color: { value: new THREE.Vector3(color.r, color.g, color.b) },
          u_tint: { value: new THREE.Vector3(color.r, color.g, color.b) },
          uOpacity: { value: effectiveOpacity },
          u_opacity: { value: effectiveOpacity },
          uTime: { value: performance.now() * 0.001 },
          u_time: { value: performance.now() * 0.001 },
          time: { value: performance.now() * 0.001 },
          iTime: { value: performance.now() * 0.001 },
          uSpeed: { value: 1.0 },
          uScale: { value: 3.5 },
          u_steps: { value: 4.0 },
          u_rim_power: { value: 3.0 },
          u_roughness: { value: settings.roughness ?? 0.5 },
          u_light_dir: { value: new THREE.Vector3(1, 2, 1).normalize() },
          uLightDirection: { value: new THREE.Vector3(1, 2, 1).normalize() },
          uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
          u_mouse: { value: new THREE.Vector2(0, 0) },
          iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
          u_matcap: { value: boundTex },
          tBackground: { value: boundTex },
          u_texture: { value: boundTex },
          iChannel0: { value: boundTex },
          tDiffuse: { value: boundTex },
        };
        const shaderMat = new THREE.ShaderMaterial({
          uniforms: customUniforms,
          vertexShader: settings.customShader.vertexShader || STANDARD_VERTEX_SHADER,
          fragmentShader: settings.customShader.fragmentShader,
          transparent: !isOpaque || effectiveOpacity < 1.0,
          depthWrite: isOpaque,
          depthTest: true,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -3.0,
          polygonOffsetUnits: -3.0,
        });
        globalShaderRegistry.register(shaderMat);
        material = shaderMat;
      } else {
        const speed = EFFECT_SPEEDS[effect] || 1.0;
        const uniforms = {
          uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
          uOpacity: { value: effectiveOpacity },
          uTime: { value: performance.now() * 0.001 },
          uSpeed: { value: speed },
          uScale: { value: 3.5 },
          uLightDirection: { value: new THREE.Vector3(1, 2, 1).normalize() },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        };

        const shaderMat = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: STANDARD_VERTEX_SHADER,
          fragmentShader: getEffectFragmentShader(effect),
          defines: {
            [`EFFECT_${effect}`]: '',
          },
          transparent: !isOpaque || effectiveOpacity < 1.0,
          depthWrite: isOpaque,
          depthTest: true,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -3.0,
          polygonOffsetUnits: -3.0,
          toneMapped: true,
        });

        globalShaderRegistry.register(shaderMat);
        material = shaderMat;
      }
    } else if (matType === 'shaded') {
      // 4. Lit / Shaded material responding to scene lighting.
      //
      // MeshStandardMaterial runs a full Cook-Torrance BRDF per fragment. On an
      // entry-tier mobile GPU that is a meaningful share of the frame for strokes
      // that cover large parts of the screen, so the low-power profile substitutes
      // MeshLambertMaterial: same lit look from the same lights, Gouraud-cheap.
      const profile = getQualityProfile();
      if (profile.materialTier === 'simple') {
        material = new THREE.MeshLambertMaterial({
          color: color,
          transparent: !isOpaque,
          opacity: effectiveOpacity,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: isOpaque,
          polygonOffset: true,
          polygonOffsetFactor: -3.0,
          polygonOffsetUnits: -3.0,
        });
      } else {
        material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: Math.max(0.05, Math.min(1.0, settings.roughness ?? 0.35)),
          metalness: Math.max(0.0, Math.min(1.0, settings.metalness ?? 0.15)),
          transparent: !isOpaque,
          opacity: effectiveOpacity,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: isOpaque,
          polygonOffset: true,
          polygonOffsetFactor: -3.0,
          polygonOffsetUnits: -3.0,
          envMapIntensity: 1.0,
        });
      }
    } else {
      // 5. Flat (Shadeless / Unlit): Pure solid color unaffected by scene lighting for clean graphic illustration
      material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: !isOpaque,
        opacity: effectiveOpacity,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: isOpaque,
        polygonOffset: true,
        polygonOffsetFactor: -3.0,
        polygonOffsetUnits: -3.0,
        toneMapped: true,
      });
    }

    // Apply WebGL Blending Modes based on layer setting
    if (matType !== 'cutout') {
      if (layerBlendMode === 'multiply') {
        material.blending = THREE.CustomBlending;
        material.blendSrc = THREE.DstColorFactor;
        material.blendDst = THREE.ZeroFactor;
        material.blendEquation = THREE.AddEquation;
        material.transparent = true;
      } else if (layerBlendMode === 'screen') {
        material.blending = THREE.CustomBlending;
        material.blendSrc = THREE.OneFactor;
        material.blendDst = THREE.OneMinusSrcColorFactor;
        material.blendEquation = THREE.AddEquation;
        material.transparent = true;
      } else if (layerBlendMode === 'overlay') {
        material.blending = THREE.CustomBlending;
        material.blendSrc = THREE.DstColorFactor;
        material.blendDst = THREE.SrcColorFactor;
        material.blendEquation = THREE.AddEquation;
        material.transparent = true;
      } else if (layerBlendMode === 'add') {
        material.blending = THREE.AdditiveBlending;
        material.transparent = true;
      } else if (layerBlendMode === 'subtract') {
        material.blending = THREE.SubtractiveBlending;
        material.transparent = true;
      } else {
        material.blending = THREE.NormalBlending;
      }
    }

    if (isOnModel && settings.stencilMasking) {
      material.stencilWrite = false;
      material.stencilRef = 1;
      material.stencilFunc = THREE.EqualStencilFunc; // Only render fragments where model exists
    } else {
      material.stencilFunc = THREE.AlwaysStencilFunc;
    }

    // Apply procedural decal texture map if patternType is set
    if (patType !== 'none') {
      const patternTex = MaterialCache.getPatternTexture(patType, color, patScale, patInt, patAng, patContr);
      if (patternTex && 'map' in material) {
        (material as any).map = patternTex;
        if ('color' in material) {
          (material as any).color.setHex(0xffffff);
        }
        material.needsUpdate = true;
      }
    }

    this.cache.set(key, material);
    return material;
  }

  private static patternTextureCache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Procedurally generates dynamic pattern textures for stipple, terrazzo, dot matrix, line, & cross decals
   */
  public static getPatternTexture(
    patType: PatternType,
    baseColor: THREE.Color,
    scale: number = 4.0,
    intensity: number = 0.8,
    angle: number = 45,
    contrast: number = 1.0
  ): THREE.Texture | null {
    if (patType === 'none') return null;

    const cacheKey = `${patType}_${baseColor.getHexString()}_${scale}_${intensity}_${angle}_${contrast}`;
    if (MaterialCache.patternTextureCache.has(cacheKey)) {
      return MaterialCache.patternTextureCache.get(cacheKey)!;
    }

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const hex = '#' + baseColor.getHexString();
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, size, size);

    if (patType === 'stipple') {
      // High-density procedural stipple / spray noise dots
      const numDots = Math.round(2200 * intensity);
      for (let i = 0; i < numDots; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 0.8 + Math.random() * 2.4;
        const alpha = Math.min(1.0, (0.35 + Math.random() * 0.65) * intensity * contrast);
        const isDark = Math.random() > 0.45;
        ctx.fillStyle = isDark ? `rgba(0, 0, 0, ${alpha})` : `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (patType === 'terrazzo') {
      // Multi-tone mosaic stone flecks
      const chips = [
        '#ffffff',
        '#f87171', // coral/terracotta
        '#38bdf8', // sky cyan
        '#fbbf24', // warm amber
        '#1e293b', // deep charcoal
        '#34d399', // soft jade
      ];
      const count = Math.round(160 * intensity);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const s = 3 + Math.random() * 8.5;
        const chipColor = chips[Math.floor(Math.random() * chips.length)];
        ctx.fillStyle = chipColor;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.random() * Math.PI);
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.4);
        ctx.lineTo(s * 0.6, -s * 0.3);
        ctx.lineTo(s * 0.4, s * 0.5);
        ctx.lineTo(-s * 0.5, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (patType === 'dot') {
      // Architectural dot matrix grid
      const spacing = Math.max(12, Math.round(32 / (scale / 4.0)));
      const dotRadius = Math.max(2, Math.round(spacing * 0.22 * intensity));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      for (let x = spacing / 2; x < size; x += spacing) {
        for (let y = spacing / 2; y < size; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (patType === 'line') {
      // Directional hatching lines
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.translate(-size, -size);
      const spacing = Math.max(8, Math.round(24 / (scale / 4.0)));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = Math.max(1.5, Math.round(3 * intensity));
      for (let y = 0; y < size * 2; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size * 2, y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (patType === 'cross') {
      // Cross-hatch grid
      const spacing = Math.max(10, Math.round(24 / (scale / 4.0)));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = Math.max(1, Math.round(2 * intensity));
      for (let x = 0; x < size; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      for (let y = 0; y < size; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    const repeatFactor = Math.max(1, Math.round(scale * 1.5));
    tex.repeat.set(repeatFactor, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    MaterialCache.patternTextureCache.set(cacheKey, tex);
    return tex;
  }

  /**
   * Generates Sculptor Clay / Flat White canvas material with positive depth bias
   */
  public static createSculptorClayMaterial(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcdd3dc,
      roughness: 0.55,
      metalness: 0.08,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2.0,
      polygonOffsetUnits: 2.0,
    });
    MaterialCache.configureModelMaterial(mat);
    return mat;
  }

  /**
   * Configures textured model material with positive depth bias
   */
  public static createModelDisplayMaterial(
    originalTexture?: THREE.Texture | null,
    hasVertexColors: boolean = false
  ): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      map: originalTexture || null,
      vertexColors: hasVertexColors,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2.0,
      polygonOffsetUnits: 2.0,
    });
    MaterialCache.configureModelMaterial(mat);
    return mat;
  }

  /**
   * Configure model material for stencil writing and depth bias
   */
  public static configureModelMaterial(material: THREE.Material): void {
    material.stencilWrite = true;
    material.stencilRef = 1;
    material.stencilZPass = THREE.ReplaceStencilOp;
    material.stencilWriteMask = 0xff;
    material.polygonOffset = true;
    material.polygonOffsetFactor = 2.0;
    material.polygonOffsetUnits = 2.0;
    material.needsUpdate = true;
  }

  /**
   * Clear cached materials
   */
  public clear(): void {
    this.cache.forEach((mat) => {
      if (mat instanceof THREE.ShaderMaterial) {
        globalShaderRegistry.unregister(mat);
      }
      mat.dispose();
    });
    this.cache.clear();
  }
}


