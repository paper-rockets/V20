import * as THREE from 'three';
import { BrushSettings, Layer, LayerBlendMode } from '../types';
import { normalizeHexColor } from './materialCache';
import { GPULayerCompositor, LayerTextureSource } from './layerCompositor';

export interface LayerCanvasEntry {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

/**
 * Dynamic UV Texture Painting & Layer Compositing Engine
 *
 * Implements direct multi-layer GPU texture painting and real-time shader compositing
 * supporting Multiply, Screen, Overlay, Add, Subtract, and Normal blend modes.
 */
export class UVPaintingEngine {
  private width: number = 2048;
  private height: number = 2048;

  // Per-layer offscreen canvas textures
  private layerCanvases: Map<string, LayerCanvasEntry> = new Map();
  private layerHistory: Map<string, { stack: ImageData[]; index: number }> = new Map();
  /**
   * Undo depth per layer. Each entry is a full-canvas ImageData, so at 2048^2 a
   * single snapshot is 16 MB of JS heap - the profile trims both the resolution
   * and the depth on memory-constrained devices.
   */
  private maxHistory: number = 8;

  // GPU Compositing Engine
  private gpuCompositor: GPULayerCompositor;
  private activeLayerId: string = 'layer_base_1';
  private currentLayers: Layer[] = [];
  private activeRenderer: THREE.WebGLRenderer | null = null;

  // Drawing runtime state
  private lastUV: THREE.Vector2 | null = null;
  private isDrawing: boolean = false;
  private activeMeshes: THREE.Mesh[] = [];
  private overlayMeshes: THREE.Mesh[] = [];

  constructor(resolution: number = 2048, historyDepth: number = 8) {
    this.width = resolution;
    this.height = resolution;
    this.maxHistory = Math.max(1, historyDepth);
    this.gpuCompositor = new GPULayerCompositor(this.width);

    // Initialize default base layer canvas
    this.getOrCreateLayerEntry('layer_base_1');
  }

  public setRenderer(renderer: THREE.WebGLRenderer): void {
    this.activeRenderer = renderer;
    this.gpuCompositor.setRenderer(renderer);
  }

  public setActiveLayer(layerId: string): void {
    this.activeLayerId = layerId;
    this.getOrCreateLayerEntry(layerId);
  }

  private getOrCreateLayerEntry(layerId: string): LayerCanvasEntry {
    let entry = this.layerCanvases.get(layerId);
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, this.width, this.height);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      entry = { id: layerId, canvas, ctx, texture };
      this.layerCanvases.set(layerId, entry);

      // Initialize history for layer
      const initData = ctx.getImageData(0, 0, this.width, this.height);
      this.layerHistory.set(layerId, { stack: [initData], index: 0 });
    }
    return entry;
  }

  public getCompositeTexture(): THREE.Texture {
    return this.gpuCompositor.getCompositeTexture();
  }

  public getActiveCanvas(): HTMLCanvasElement {
    return this.getOrCreateLayerEntry(this.activeLayerId).canvas;
  }

  public getLayerCanvas(layerId: string): HTMLCanvasElement | null {
    return this.layerCanvases.get(layerId)?.canvas || null;
  }

  public clearActiveCanvas(): void {
    this.clearLayer(this.activeLayerId);
  }

  public clearLayer(layerId: string): void {
    const entry = this.layerCanvases.get(layerId);
    if (entry) {
      entry.ctx.clearRect(0, 0, this.width, this.height);
      entry.texture.needsUpdate = true;
      this.saveLayerState(layerId);
      this.compositeLayers(this.currentLayers);
    }
  }

  public deleteLayer(layerId: string): void {
    const entry = this.layerCanvases.get(layerId);
    if (entry) {
      entry.texture.dispose();
      this.layerCanvases.delete(layerId);
      this.layerHistory.delete(layerId);
      this.compositeLayers(this.currentLayers.filter((l) => l.id !== layerId));
    }
  }

  public clearAllLayers(): void {
    this.layerCanvases.forEach((entry) => {
      entry.ctx.clearRect(0, 0, this.width, this.height);
      entry.texture.needsUpdate = true;
    });
    this.layerHistory.clear();
    this.compositeLayers(this.currentLayers);
  }

  public clearCanvas(): void {
    this.clearAllLayers();
  }

  public resetHistory(): void {
    this.layerHistory.clear();
    this.layerCanvases.forEach((entry) => {
      const data = entry.ctx.getImageData(0, 0, this.width, this.height);
      this.layerHistory.set(entry.id, { stack: [data], index: 0 });
    });
  }

  /**
   * Runs the GPU Layer Compositor to composite all visible layers
   * with their blend modes (Multiply, Screen, Overlay, Add, Subtract, Normal) and opacities.
   */
  public compositeLayers(layers?: Layer[]): THREE.Texture {
    if (layers && layers.length > 0) {
      this.currentLayers = [...layers];
    }

    // Prepare layer sources ordered from bottom to top
    // Note: layers array in UI is typically top-to-bottom, so we reverse it for bottom-to-top rendering
    const orderedLayers = [...this.currentLayers].reverse();
    const sources: LayerTextureSource[] = [];

    for (const layer of orderedLayers) {
      const entry = this.getOrCreateLayerEntry(layer.id);
      sources.push({
        id: layer.id,
        texture: entry.texture,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode || 'normal',
      });
    }

    const composited = this.gpuCompositor.composite(sources, this.activeRenderer || undefined);

    // Update overlay meshes to use the newly composited texture
    for (const mesh of this.overlayMeshes) {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.map = composited;
        mesh.material.needsUpdate = true;
      }
    }

    return composited;
  }

  /**
   * Merges a top layer into the layer below it, baking the GPU blend mode and opacity into pixels
   */
  public mergeLayerDown(topLayerId: string, bottomLayerId: string, topOpacity: number, topBlendMode: LayerBlendMode): void {
    const topEntry = this.getOrCreateLayerEntry(topLayerId);
    const bottomEntry = this.getOrCreateLayerEntry(bottomLayerId);

    const topImg = topEntry.ctx.getImageData(0, 0, this.width, this.height);
    const bottomImg = bottomEntry.ctx.getImageData(0, 0, this.width, this.height);
    const tData = topImg.data;
    const bData = bottomImg.data;

    const op = Math.max(0, Math.min(1, topOpacity));

    for (let i = 0; i < bData.length; i += 4) {
      const sA = (tData[i + 3] / 255) * op;
      if (sA <= 0.001) continue;

      const dR = bData[i] / 255;
      const dG = bData[i + 1] / 255;
      const dB = bData[i + 2] / 255;
      const dA = bData[i + 3] / 255;

      const sR = tData[i] / 255;
      const sG = tData[i + 1] / 255;
      const sB = tData[i + 2] / 255;

      let r = sR;
      let g = sG;
      let b = sB;

      if (dA > 0.001) {
        if (topBlendMode === 'multiply') {
          r = dR * sR;
          g = dG * sG;
          b = dB * sB;
        } else if (topBlendMode === 'screen') {
          r = 1.0 - (1.0 - dR) * (1.0 - sR);
          g = 1.0 - (1.0 - dG) * (1.0 - sG);
          b = 1.0 - (1.0 - dB) * (1.0 - sB);
        } else if (topBlendMode === 'overlay') {
          r = dR < 0.5 ? 2.0 * dR * sR : 1.0 - 2.0 * (1.0 - dR) * (1.0 - sR);
          g = dG < 0.5 ? 2.0 * dG * sG : 1.0 - 2.0 * (1.0 - dG) * (1.0 - sG);
          b = dB < 0.5 ? 2.0 * dB * sB : 1.0 - 2.0 * (1.0 - dB) * (1.0 - sB);
        } else if (topBlendMode === 'add') {
          r = Math.min(1.0, dR + sR);
          g = Math.min(1.0, dG + sG);
          b = Math.min(1.0, dB + sB);
        } else if (topBlendMode === 'subtract') {
          r = Math.max(0.0, dR - sR);
          g = Math.max(0.0, dG - sG);
          b = Math.max(0.0, dB - sB);
        }
      }

      // Alpha compositing
      const outA = dA + sA * (1.0 - dA);
      const outR = outA > 0 ? (dR * dA * (1 - sA) + r * sA) / outA : 0;
      const outG = outA > 0 ? (dG * dA * (1 - sA) + g * sA) / outA : 0;
      const outB = outA > 0 ? (dB * dA * (1 - sA) + b * sA) / outA : 0;

      bData[i] = Math.round(outR * 255);
      bData[i + 1] = Math.round(outG * 255);
      bData[i + 2] = Math.round(outB * 255);
      bData[i + 3] = Math.round(outA * 255);
    }

    bottomEntry.ctx.putImageData(bottomImg, 0, 0);
    bottomEntry.texture.needsUpdate = true;

    // Delete top layer from canvas cache
    this.deleteLayer(topLayerId);
    this.saveLayerState(bottomLayerId);
  }

  /**
   * Bind the dynamic canvas texture to the target model meshes via overlay meshes
   */
  public attachToModel(root: THREE.Object3D): void {
    this.activeMeshes = [];
    this.overlayMeshes = [];

    root.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry && child.name !== 'UV_Overlay') {
        // Do not attach UV texture overlays to drawing reference / guide canvas planes
        if (child.userData?.isDrawingPlane || child.name === 'DrawingPlaneCanvas' || child.name === 'DrawingCanvasPlane') {
          // If a UV_Overlay child was previously added to the drawing plane, remove it
          const strayOverlay = child.getObjectByName('UV_Overlay');
          if (strayOverlay) child.remove(strayOverlay);
          return;
        }

        this.activeMeshes.push(child);

        // Ensure geometry has UV coordinates
        if (!child.geometry.attributes.uv) {
          this.generateFallbackUVs(child.geometry);
        }

        // Check if an overlay already exists
        let existingOverlay: THREE.Mesh | null = null;
        for (const c of child.children) {
          if (c.name === 'UV_Overlay') {
            existingOverlay = c as THREE.Mesh;
            break;
          }
        }

        if (!existingOverlay) {
          const overlayMat = new THREE.MeshBasicMaterial({
            map: this.gpuCompositor.getCompositeTexture(),
            transparent: true,
            opacity: 1.0,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1.0,
            polygonOffsetUnits: -2.0,
            side: THREE.DoubleSide,
          });
          const overlayMesh = new THREE.Mesh(child.geometry, overlayMat);
          overlayMesh.name = 'UV_Overlay';
          overlayMesh.renderOrder = 4;
          child.add(overlayMesh);
          this.overlayMeshes.push(overlayMesh);
        } else {
          this.overlayMeshes.push(existingOverlay);
        }
      }
    });

    this.compositeLayers(this.currentLayers);
  }

  private generateFallbackUVs(geometry: THREE.BufferGeometry): void {
    const pos = geometry.attributes.position;
    if (!pos) return;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
      const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  private isCompositeScheduled: boolean = false;

  private requestComposite(): void {
    if (this.isCompositeScheduled) return;
    this.isCompositeScheduled = true;
    requestAnimationFrame(() => {
      this.isCompositeScheduled = false;
      const activeEntry = this.layerCanvases.get(this.activeLayerId);
      if (activeEntry) {
        activeEntry.texture.needsUpdate = true;
      }
      this.compositeLayers();
    });
  }

  /**
   * Start a stroke on UV coordinate
   */
  public beginStroke(uv: THREE.Vector2, settings: BrushSettings, layerId?: string): void {
    if (layerId) {
      this.activeLayerId = layerId;
    }
    this.isDrawing = true;
    this.lastUV = uv.clone();
    this.paintStamp(uv, settings, 1.0);
  }

  /**
   * Interpolate paint along UV coordinates with rAF-batched GPU uploads
   */
  public paintTo(uv: THREE.Vector2, settings: BrushSettings, pressure: number = 1.0): void {
    if (!this.isDrawing) {
      this.beginStroke(uv, settings);
      return;
    }

    if (!this.lastUV) {
      this.lastUV = uv.clone();
      this.paintStamp(uv, settings, pressure);
      return;
    }

    const p1x = this.lastUV.x * this.width;
    const p1y = (1.0 - this.lastUV.y) * this.height; // Flip Y for WebGL UV convention
    const p2x = uv.x * this.width;
    const p2y = (1.0 - uv.y) * this.height;

    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Dynamic brush radius in pixel units
    const baseRadius = settings.size * (this.width * 0.25);
    const radius = Math.max(2, baseRadius * (settings.pressureSensitivity ? pressure : 1.0));
    const step = Math.max(1.5, radius * 0.25);
    const count = Math.ceil(dist / step);

    const activeEntry = this.getOrCreateLayerEntry(this.activeLayerId);

    for (let i = 1; i <= count; i++) {
      const t = i / count;
      const x = p1x + dx * t;
      const y = p1y + dy * t;
      this.renderBrushAtPixel(activeEntry.ctx, x, y, radius, settings);
    }

    this.lastUV.copy(uv);
    this.requestComposite();
  }

  /**
   * Paint a single stamp at UV coordinate with rAF-batched GPU uploads
   */
  public paintStamp(uv: THREE.Vector2, settings: BrushSettings, pressure: number = 1.0): void {
    const px = uv.x * this.width;
    const py = (1.0 - uv.y) * this.height;
    const baseRadius = settings.size * (this.width * 0.25);
    const radius = Math.max(2, baseRadius * (settings.pressureSensitivity ? pressure : 1.0));

    const activeEntry = this.getOrCreateLayerEntry(this.activeLayerId);
    this.renderBrushAtPixel(activeEntry.ctx, px, py, radius, settings);
    this.requestComposite();
  }

  /**
   * Sample pixel color from composited UV canvas or active layer at given UV coordinate (0..1)
   */
  public sampleColorAtUV(uv: THREE.Vector2): string | null {
    if (!uv || typeof uv.x !== 'number' || typeof uv.y !== 'number') return null;
    const px = Math.floor(Math.max(0, Math.min(this.width - 1, uv.x * this.width)));
    const py = Math.floor(Math.max(0, Math.min(this.height - 1, (1.0 - uv.y) * this.height)));

    try {
      const activeEntry = this.getOrCreateLayerEntry(this.activeLayerId);
      const pixel = activeEntry.ctx.getImageData(px, py, 1, 1).data;
      if (pixel[3] < 10) return null; // Transparent/unpainted UV area
      const r = pixel[0].toString(16).padStart(2, '0');
      const g = pixel[1].toString(16).padStart(2, '0');
      const b = pixel[2].toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    } catch (_) {
      return null;
    }
  }

  private renderBrushAtPixel(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, settings: BrushSettings): void {
    ctx.save();

    const hex = normalizeHexColor(settings.color, '#38bdf8');
    const alpha = Math.max(0.01, Math.min(1.0, settings.opacity ?? 1.0));
    const c = new THREE.Color(hex);
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);

    const shape = settings.brushShape || (settings.profile === 'marker' ? 'chisel' : settings.profile === 'ribbon' ? 'wide_flat' : 'round');
    const widthMult = Math.max(0.5, Math.min(10.0, settings.brushWidthMultiplier ?? (shape === 'wide_flat' ? 3.0 : 1.0)));
    const angleRad = ((settings.brushAngle ?? settings.chiselAngle ?? 0) * Math.PI) / 180;

    ctx.translate(x, y);
    if (angleRad !== 0) {
      ctx.rotate(angleRad);
    }

    const rx = radius * widthMult;
    const ry = radius;

    if (shape === 'wide_flat' || shape === 'chisel' || shape === 'line') {
      // Oriented Ellipse / Rounded Wide Stamp for wide straight lines
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'square') {
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    } else {
      // Standard round feathered stamp
      const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      radGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      radGrad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${alpha * 0.85})`);
      radGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  public endStroke(): void {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.lastUV = null;
      const activeEntry = this.layerCanvases.get(this.activeLayerId);
      if (activeEntry) {
        activeEntry.texture.needsUpdate = true;
      }
      this.compositeLayers();
      this.saveLayerState(this.activeLayerId);
    }
  }

  public saveLayerState(layerId: string): void {
    const entry = this.layerCanvases.get(layerId);
    if (!entry) return;

    let hist = this.layerHistory.get(layerId);
    if (!hist) {
      hist = { stack: [], index: -1 };
      this.layerHistory.set(layerId, hist);
    }

    const data = entry.ctx.getImageData(0, 0, this.width, this.height);
    if (hist.index < hist.stack.length - 1) {
      hist.stack = hist.stack.slice(0, hist.index + 1);
    }
    hist.stack.push(data);
    if (hist.stack.length > this.maxHistory) {
      hist.stack.shift();
    } else {
      hist.index++;
    }
  }

  public undo(layerId: string = this.activeLayerId): boolean {
    const entry = this.layerCanvases.get(layerId);
    const hist = this.layerHistory.get(layerId);
    if (entry && hist && hist.index > 0) {
      hist.index--;
      entry.ctx.putImageData(hist.stack[hist.index], 0, 0);
      entry.texture.needsUpdate = true;
      this.compositeLayers();
      return true;
    }
    return false;
  }

  public redo(layerId: string = this.activeLayerId): boolean {
    const entry = this.layerCanvases.get(layerId);
    const hist = this.layerHistory.get(layerId);
    if (entry && hist && hist.index < hist.stack.length - 1) {
      hist.index++;
      entry.ctx.putImageData(hist.stack[hist.index], 0, 0);
      entry.texture.needsUpdate = true;
      this.compositeLayers();
      return true;
    }
    return false;
  }

  public exportPNG(): string {
    const activeEntry = this.getOrCreateLayerEntry(this.activeLayerId);
    return activeEntry.canvas.toDataURL('image/png');
  }

  public exportAllCanvases(): Record<string, string> {
    const result: Record<string, string> = {};
    this.layerCanvases.forEach((entry, layerId) => {
      try {
        result[layerId] = entry.canvas.toDataURL('image/png');
      } catch (err) {
        console.warn(`Failed to export canvas for layer ${layerId}:`, err);
      }
    });
    return result;
  }

  public async importCanvases(canvases: Record<string, string>): Promise<void> {
    if (!canvases) return;
    const entries = Object.entries(canvases);
    for (const [layerId, dataUrl] of entries) {
      if (!dataUrl) continue;
      const entry = this.getOrCreateLayerEntry(layerId);
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          entry.ctx.clearRect(0, 0, this.width, this.height);
          entry.ctx.drawImage(img, 0, 0, this.width, this.height);
          entry.texture.needsUpdate = true;
          this.saveLayerState(layerId);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
    }
    this.compositeLayers();
  }

  public dispose(): void {
    this.gpuCompositor.dispose();
    this.layerCanvases.forEach((entry) => entry.texture.dispose());
    this.layerCanvases.clear();
    this.layerHistory.clear();
  }
}
