import * as THREE from 'three';
import {
  StrokeDescriptor,
  StrokePoint,
  BrushSettings,
  SymmetryMode,
  HolisticStrokeDNA,
} from '../types';
import { MaterialCache, normalizeHexColor } from './materialCache';
import { ConformalBeadGenerator } from './conformalBeadGenerator';
import { LoftGuideEngine } from './loftEngine';

const _scratchVec = new THREE.Vector3();

export interface StrokePipelineContext {
  strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>;
  strokeRoot: THREE.Group;
  worldStrokeRoot: THREE.Group;
  helperRoot: THREE.Group;
  getCamera: () => THREE.PerspectiveCamera;
  getRaycaster: () => THREE.Raycaster;
  getTargetMeshes: () => THREE.Mesh[];
  getActiveLayerId: () => string;
  getActiveLayerOpacity: () => number;
  materialCache: MaterialCache;
  beadGenerator: ConformalBeadGenerator;
  getCustomMirrorOrigin: () => THREE.Vector3;
  getCustomMirrorNormal: () => THREE.Vector3;
  sampleColorAtScreen: (screenX: number, screenY: number, clientX?: number, clientY?: number) => string;
  raycastModel: (screenX: number, screenY: number, settings?: BrushSettings) => any;
  onStrokeSelected?: (stroke: StrokeDescriptor | null) => void;
  onDNAInjected?: (dna: HolisticStrokeDNA) => void;
  onAutoSaveTrigger?: (reason: string) => void;
  notifyHistory: () => void;
  markDirty: () => void;
  pushUndoAction: (action: { type: 'create' | 'erase'; strokes: StrokeDescriptor[] }) => void;
  clearRedoStacks: () => void;
  resetActiveDrawingState: () => void;
  filterHistoryForLayer: (layerId: string) => void;
}

export class StrokePipeline {
  private ctx: StrokePipelineContext;

  public activePoints: StrokePoint[] = [];
  public activeStrokeMeshes: THREE.Mesh[] = [];
  public activeStrokeBatch: StrokeDescriptor[] = [];
  public activeVacuumPurgedBatch: StrokeDescriptor[] = [];
  public symmetryPointsCache: StrokePoint[][] = [];
  public selectedStrokeId: string | null = null;
  public selectionHighlightGroup: THREE.Group | null = null;
  public clipboardStrokes: StrokeDescriptor[] = [];

  constructor(ctx: StrokePipelineContext) {
    this.ctx = ctx;
  }

  public getSymmetryCount(symmetry: SymmetryMode): number {
    switch (symmetry) {
      case 'custom_plane':
      case 'mirror_x':
      case 'mirror_y':
      case 'mirror_z':
        return 2;
      case 'radial_4x':
        return 4;
      case 'radial_8x':
        return 8;
      default:
        return 1;
    }
  }

  /**
   * Recomputes points according to symmetry mode with zero allocations
   */
  public applySymmetry(points: StrokePoint[], symmetry: SymmetryMode, index: number): StrokePoint[] {
    if (symmetry === 'none' || index === 0) {
      return points;
    }

    if (!this.symmetryPointsCache[index]) {
      this.symmetryPointsCache[index] = [];
    }
    const cache = this.symmetryPointsCache[index];
    while (cache.length < points.length) {
      cache.push({
        position: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        surfaceOffset: 0.002,
        pressure: 1.0,
        time: 0,
        isSurfaceHit: true,
      });
    }
    cache.length = points.length;

    const total = symmetry === 'radial_4x' ? 4 : symmetry === 'radial_8x' ? 8 : 1;
    const angle = (index * Math.PI * 2) / total;
    const yAxis = _scratchVec.set(0, 1, 0);

    const customMirrorOrigin = this.ctx.getCustomMirrorOrigin();
    const customMirrorNormal = this.ctx.getCustomMirrorNormal();

    for (let i = 0; i < points.length; i++) {
      const src = points[i];
      const dst = cache[i];
      dst.position.copy(src.position);
      dst.normal.copy(src.normal);
      dst.surfaceOffset = src.surfaceOffset;
      dst.pressure = src.pressure;
      dst.uv = src.uv;
      dst.hitMeshId = src.hitMeshId;
      dst.isSurfaceHit = src.isSurfaceHit;
      dst.time = src.time;

      if (symmetry === 'custom_plane' && index === 1) {
        const mirroredPos = LoftGuideEngine.mirrorPointAcrossPlane(
          dst.position,
          customMirrorOrigin,
          customMirrorNormal
        );
        const mirroredNorm = LoftGuideEngine.mirrorNormalAcrossPlane(
          dst.normal,
          customMirrorNormal
        );
        dst.position.copy(mirroredPos);
        dst.normal.copy(mirroredNorm);
      } else if (symmetry === 'mirror_x') {
        dst.position.x = -dst.position.x;
        dst.normal.x = -dst.normal.x;
      } else if (symmetry === 'mirror_y') {
        dst.position.y = -dst.position.y;
        dst.normal.y = -dst.normal.y;
      } else if (symmetry === 'mirror_z') {
        dst.position.z = -dst.position.z;
        dst.normal.z = -dst.normal.z;
      } else if (symmetry === 'radial_4x' || symmetry === 'radial_8x') {
        dst.position.applyAxisAngle(yAxis, angle);
        dst.normal.applyAxisAngle(yAxis, angle);
      }
    }

    return cache;
  }

  /**
   * Updates the geometry of all active symmetry stroke meshes in real-time
   */
  public updateActiveStrokeGeometry(settings: BrushSettings, symmetry: SymmetryMode): void {
    if (this.activePoints.length === 0 || this.activeStrokeMeshes.length === 0) return;

    const symmetryCount = this.getSymmetryCount(symmetry);
    const targetMeshes = this.ctx.getTargetMeshes();
    for (let s = 0; s < symmetryCount; s++) {
      const mirroredPoints = this.applySymmetry(this.activePoints, symmetry, s);
      const mesh = this.activeStrokeMeshes[s];
      if (mesh && mesh.geometry) {
        this.ctx.beadGenerator.updateBufferGeometry(mesh.geometry, mirroredPoints, settings, targetMeshes);
      }
    }
    this.ctx.markDirty();
  }

  /**
   * Continuous Vacuum Stroke Purge
   * Raycasts / tests distance to all existing 3D stroke objects and purges intersected continuous strokes.
   */
  public purgeStrokesIntersecting(screenX: number, screenY: number, radiusWorld: number = 0.05): StrokeDescriptor[] {
    const purged: StrokeDescriptor[] = [];
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(screenX, screenY);
    raycaster.setFromCamera(mouse, this.ctx.getCamera());

    // Collect all stroke meshes
    const meshToStrokeId = new Map<THREE.Mesh, string>();
    const allMeshes: THREE.Mesh[] = [];
    for (const [id, data] of this.ctx.strokes.entries()) {
      for (const m of data.meshes) {
        meshToStrokeId.set(m, id);
        allMeshes.push(m);
      }
    }

    if (allMeshes.length === 0) return purged;

    // Raycast against all stroke meshes
    const intersects = raycaster.intersectObjects(allMeshes, false);
    const hitStrokeIds = new Set<string>();

    for (const hit of intersects) {
      const strokeId = meshToStrokeId.get(hit.object as THREE.Mesh);
      if (strokeId) {
        hitStrokeIds.add(strokeId);
      }
    }

    // Also check distance from ray to stroke points for thin / line strokes
    const ray = raycaster.ray;
    for (const [id, data] of this.ctx.strokes.entries()) {
      if (hitStrokeIds.has(id)) continue;
      for (const pt of data.descriptor.points) {
        const distSq = ray.distanceSqToPoint(pt.position);
        const hitRadius = Math.max(radiusWorld, (data.descriptor.settings.size || 0.03) * 1.5);
        if (distSq <= hitRadius * hitRadius) {
          hitStrokeIds.add(id);
          break;
        }
      }
    }

    // Delete all hit strokes
    for (const id of hitStrokeIds) {
      const entry = this.ctx.strokes.get(id);
      if (entry) {
        purged.push(entry.descriptor);
        this.activeVacuumPurgedBatch.push(entry.descriptor);
        for (const m of entry.meshes) {
          m.geometry.dispose();
          this.ctx.strokeRoot.remove(m);
        }
        this.ctx.strokes.delete(id);
      }
    }

    return purged;
  }

  /**
   * Samples complete holistic DNA (color, size, opacity, material, shader, profile, pattern, physics)
   * from 3D stroke, model surface, or WebGL framebuffer
   */
  public sampleHolisticDNA(
    screenX: number,
    screenY: number,
    clientX?: number,
    clientY?: number
  ): HolisticStrokeDNA {
    // 1. Raycast against strokes in scene
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(screenX, screenY), this.ctx.getCamera());

    const allStrokeMeshes: THREE.Mesh[] = [];
    const meshToStrokeMap = new Map<THREE.Mesh, StrokeDescriptor>();
    for (const data of this.ctx.strokes.values()) {
      for (const m of data.meshes) {
        allStrokeMeshes.push(m);
        meshToStrokeMap.set(m, data.descriptor);
      }
    }

    const strokeHits = raycaster.intersectObjects(allStrokeMeshes, false);
    if (strokeHits.length > 0) {
      const hitMesh = strokeHits[0].object as THREE.Mesh;
      const desc = meshToStrokeMap.get(hitMesh);
      if (desc) {
        const s = desc.settings;
        const colLinear = desc.points[0]?.colorLinear || [0.2, 0.7, 1.0];
        const hex = normalizeHexColor(s.color, '#38bdf8');
        const dna: HolisticStrokeDNA = {
          colorHex: hex,
          colorLinear: colLinear,
          size: s.size || 0.035,
          opacity: s.opacity ?? 1.0,
          materialType: s.materialType || 'shaded',
          shaderEffect: s.shaderEffect,
          roughness: s.roughness ?? 0.35,
          metalness: s.metalness ?? 0.15,
          emissiveIntensity: s.emissiveIntensity ?? 0,
          profile: s.profile || 'ribbon',
          patternType: s.patternType || 'none',
          patternScale: s.patternScale ?? 4.0,
          patternIntensity: s.patternIntensity ?? 1.0,
          pressure: desc.points[0]?.pressure ?? 0.8,
          strokeId: desc.id,
          layerId: desc.layerId,
          sourceType: 'stroke',
          timestamp: Date.now(),
        };
        this.ctx.onDNAInjected?.(dna);
        return dna;
      }
    }

    // 2. Read direct pixel from WebGL framebuffer
    const sampledHex = this.ctx.sampleColorAtScreen(screenX, screenY, clientX, clientY);
    const colObj = new THREE.Color(sampledHex);

    // 3. Check if 3D model mesh was hit
    const modelHit = this.ctx.raycastModel(screenX, screenY);
    let roughness = 0.5;
    let metalness = 0.1;
    let sourceType: 'model_mesh' | 'pixel_framebuffer' = 'pixel_framebuffer';

    if (modelHit && modelHit.hit && modelHit.mesh) {
      sourceType = 'model_mesh';
      const m = modelHit.mesh.material as any;
      if (m) {
        if (typeof m.roughness === 'number') roughness = m.roughness;
        if (typeof m.metalness === 'number') metalness = m.metalness;
      }
    }

    const dna: HolisticStrokeDNA = {
      colorHex: sampledHex,
      colorLinear: [colObj.r, colObj.g, colObj.b],
      size: 0.035,
      opacity: 1.0,
      materialType: sourceType === 'model_mesh' ? 'shaded' : 'shadeless',
      roughness,
      metalness,
      emissiveIntensity: 0,
      profile: 'ribbon',
      patternType: 'none',
      patternScale: 4.0,
      patternIntensity: 1.0,
      sourceType,
      timestamp: Date.now(),
    };

    this.ctx.onDNAInjected?.(dna);
    return dna;
  }

  /**
   * Cancel active stroke without committing to history (useful for multi-touch gesture handoff)
   */
  public cancelStroke(): void {
    this.ctx.resetActiveDrawingState();

    // Clean up active stroke meshes
    for (const mesh of this.activeStrokeMeshes) {
      mesh.geometry.dispose();
      this.ctx.strokeRoot.remove(mesh);
    }
    this.activeStrokeMeshes = [];
    this.activePoints = [];

    // Clean up active batch if any segments were committed in this stroke
    for (const desc of this.activeStrokeBatch) {
      const entry = this.ctx.strokes.get(desc.id);
      if (entry) {
        for (const m of entry.meshes) {
          m.geometry.dispose();
          this.ctx.strokeRoot.remove(m);
        }
        this.ctx.strokes.delete(desc.id);
      }
    }
    this.activeStrokeBatch = [];
  }

  /**
   * Clear all associated strokes completely
   */
  public clearAllStrokes(): void {
    // 1. Cancel in-progress strokes & clear active arrays
    this.cancelStroke();
    this.activePoints = [];
    this.activeStrokeMeshes = [];
    this.activeStrokeBatch = [];

    // 2. Dispose meshes tracked in strokes map
    this.ctx.strokes.forEach(({ meshes }) => {
      meshes.forEach((m) => {
        this.ctx.strokeRoot.remove(m);
        if (m.geometry) {
          try { m.geometry.dispose(); } catch (_) {}
        }
        if (m.material) {
          try {
            if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
            else m.material.dispose();
          } catch (_) {}
        }
      });
    });
    this.ctx.strokes.clear();

    // 3. Purge all child meshes from strokeRoot and worldStrokeRoot completely
    const purgeGroup = (grp: THREE.Group) => {
      while (grp.children.length > 0) {
        const child = grp.children[0];
        grp.remove(child);
        if ((child as any).geometry) {
          try { (child as any).geometry.dispose(); } catch (_) {}
        }
        if ((child as any).material) {
          try {
            if (Array.isArray((child as any).material)) {
              (child as any).material.forEach((mat: any) => mat.dispose());
            } else {
              (child as any).material.dispose();
            }
          } catch (_) {}
        }
      }
    };
    purgeGroup(this.ctx.strokeRoot);
    if (this.ctx.worldStrokeRoot) purgeGroup(this.ctx.worldStrokeRoot);
  }

  /**
   * Delete strokes belonging to a specific layer
   */
  public deleteLayerStrokes(layerId: string): void {
    const toDelete: string[] = [];
    this.ctx.strokes.forEach(({ descriptor, meshes }, id) => {
      if (descriptor.layerId === layerId) {
        meshes.forEach((m) => {
          this.ctx.strokeRoot.remove(m);
          m.geometry.dispose();
        });
        toDelete.push(id);
      }
    });
    toDelete.forEach((id) => this.ctx.strokes.delete(id));
    this.ctx.filterHistoryForLayer(layerId);
    this.ctx.notifyHistory();
  }

  /**
   * Recalculates and smooths mesh normals across stroke geometries and 3D model meshes,
   * ensuring that shading looks smooth and uncreased even after heavy paint accumulation.
   */
  public recalculateMeshNormals(layerId?: string): number {
    let count = 0;

    // Recalculate and update normals on stroke meshes
    this.ctx.strokes.forEach(({ descriptor, meshes }) => {
      if (!layerId || descriptor.layerId === layerId) {
        meshes.forEach((mesh) => {
          if (mesh.geometry) {
            mesh.geometry.computeVertexNormals();
            if (mesh.geometry.attributes.normal) {
              mesh.geometry.attributes.normal.needsUpdate = true;
            }
            count++;
          }
        });
      }
    });

    // Ensure target 3D meshes have computed normals
    this.ctx.getTargetMeshes().forEach((mesh) => {
      if (mesh.geometry) {
        mesh.geometry.computeVertexNormals();
        if (mesh.geometry.attributes.normal) {
          mesh.geometry.attributes.normal.needsUpdate = true;
        }
      }
    });

    this.ctx.onAutoSaveTrigger?.('normals_recalculated');
    return count;
  }

  /**
   * Copies stroke curves belonging to the target layer (or all curves) to memory clipboard
   */
  public copyStrokes(layerId?: string): number {
    const targetId = layerId || this.ctx.getActiveLayerId();
    const copied: StrokeDescriptor[] = [];

    this.ctx.strokes.forEach(({ descriptor }) => {
      if (!targetId || descriptor.layerId === targetId) {
        copied.push({
          ...descriptor,
          points: descriptor.points.map((p) => ({
            position: p.position.clone(),
            normal: p.normal.clone(),
            pressure: p.pressure,
            tangent: p.tangent ? p.tangent.clone() : undefined,
            surfaceOffset: p.surfaceOffset,
            time: p.time,
            isSurfaceHit: p.isSurfaceHit,
            uv: p.uv ? p.uv.clone() : undefined,
            hitMeshId: p.hitMeshId,
          })),
          settings: { ...descriptor.settings },
        });
      }
    });

    this.clipboardStrokes = copied;
    return copied.length;
  }

  /**
   * Pastes copied curves with a subtle spatial offset into the scene and registers into Undo history
   */
  public pasteStrokes(
    targetLayerId?: string,
    offset: THREE.Vector3 = new THREE.Vector3(0.08, 0.08, 0.02)
  ): number {
    if (this.clipboardStrokes.length === 0) return 0;
    const layerId = targetLayerId || this.ctx.getActiveLayerId();
    const newBatch: StrokeDescriptor[] = [];
    const targetMeshes = this.ctx.getTargetMeshes();
    const activeLayerOpacity = this.ctx.getActiveLayerOpacity();

    for (const orig of this.clipboardStrokes) {
      const newId = 'stroke_copy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newPoints = orig.points.map((p) => ({
        position: p.position.clone().add(offset),
        normal: p.normal.clone(),
        pressure: p.pressure,
        tangent: p.tangent ? p.tangent.clone() : undefined,
        surfaceOffset: p.surfaceOffset,
        time: performance.now(),
        isSurfaceHit: p.isSurfaceHit,
        uv: p.uv ? p.uv.clone() : undefined,
        hitMeshId: p.hitMeshId,
      }));

      const desc: StrokeDescriptor = {
        id: newId,
        layerId,
        tool: orig.tool,
        points: newPoints,
        settings: { ...orig.settings },
        createdAt: Date.now(),
      };

      desc.settings.strokeSequenceIndex = this.ctx.strokes.size;
      const mat = this.ctx.materialCache.getStrokeMaterial(desc.settings, true, activeLayerOpacity);
      const geom = this.ctx.beadGenerator.generateGeometry(newPoints, desc.settings, targetMeshes);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 10 + (this.ctx.strokes.size % 20000);
      this.ctx.strokeRoot.add(mesh);

      this.ctx.strokes.set(newId, { descriptor: desc, meshes: [mesh] });
      newBatch.push(desc);
    }

    if (newBatch.length > 0) {
      this.ctx.pushUndoAction({
        type: 'create',
        strokes: newBatch,
      });
      this.ctx.clearRedoStacks();
      this.ctx.notifyHistory();
    }

    return newBatch.length;
  }

  public getClipboardCount(): number {
    return this.clipboardStrokes.length;
  }

  /**
   * Raycast against stroke meshes to select a stroke by pointer
   */
  public raycastStroke(screenX: number, screenY: number): string | null {
    const coords = new THREE.Vector2(screenX, screenY);
    const raycaster = this.ctx.getRaycaster();
    raycaster.setFromCamera(coords, this.ctx.getCamera());

    const strokeMeshes: THREE.Mesh[] = [];
    const meshToStrokeId = new Map<THREE.Mesh, string>();

    this.ctx.strokes.forEach(({ meshes }, strokeId) => {
      for (const m of meshes) {
        strokeMeshes.push(m);
        meshToStrokeId.set(m, strokeId);
      }
    });

    if (strokeMeshes.length === 0) return null;

    const intersects = raycaster.intersectObjects(strokeMeshes, true);
    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      return meshToStrokeId.get(hitMesh) || null;
    }
    return null;
  }

  /**
   * Set currently selected stroke and highlight it
   */
  public selectStroke(strokeId: string | null): StrokeDescriptor | null {
    this.selectedStrokeId = strokeId;

    // Clear old highlight
    if (this.selectionHighlightGroup) {
      this.ctx.helperRoot.remove(this.selectionHighlightGroup);
      this.selectionHighlightGroup.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
          else child.material.dispose();
        }
      });
      this.selectionHighlightGroup = null;
    }

    if (!strokeId) {
      this.ctx.onStrokeSelected?.(null);
      return null;
    }

    const stroke = this.ctx.strokes.get(strokeId);
    if (!stroke) {
      this.selectedStrokeId = null;
      this.ctx.onStrokeSelected?.(null);
      return null;
    }

    // Build bounding highlight box
    const group = new THREE.Group();
    const box = new THREE.Box3();
    for (const m of stroke.meshes) {
      m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox) {
        const meshBox = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
        box.union(meshBox);
      }
    }

    if (!box.isEmpty()) {
      const helper = new THREE.Box3Helper(box, new THREE.Color(0xa1a1aa));
      (helper.material as THREE.LineBasicMaterial).depthTest = false;
      group.add(helper);
      this.selectionHighlightGroup = group;
      this.ctx.helperRoot.add(group);
    }

    this.ctx.onStrokeSelected?.(stroke.descriptor);
    return stroke.descriptor;
  }

  public getSelectedStrokeId(): string | null {
    return this.selectedStrokeId;
  }

  public getSelectedStroke(): StrokeDescriptor | null {
    if (!this.selectedStrokeId) return null;
    const entry = this.ctx.strokes.get(this.selectedStrokeId);
    return entry ? entry.descriptor : null;
  }

  public deleteSelectedStroke(): boolean {
    if (!this.selectedStrokeId) return false;
    const stroke = this.ctx.strokes.get(this.selectedStrokeId);
    if (!stroke) return false;

    for (const m of stroke.meshes) {
      if (m.parent) m.parent.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach((mat: any) => mat.dispose());
        else m.material.dispose();
      }
    }

    this.ctx.pushUndoAction({
      type: 'erase',
      strokes: [stroke.descriptor],
    });
    this.ctx.clearRedoStacks();

    this.ctx.strokes.delete(this.selectedStrokeId);
    this.selectStroke(null);
    this.ctx.notifyHistory();
    return true;
  }

  /**
   * Recreates a stroke mesh from its descriptor and registers it
   */
  public recreateStrokeFromDescriptor(desc: StrokeDescriptor): void {
    if (!desc || !desc.points || desc.points.length === 0) return;

    // Convert raw points to Three.js Vector3 instances if needed
    const parsedPoints: StrokePoint[] = desc.points.map((p) => {
      const pos = (p.position as any) instanceof THREE.Vector3
        ? (p.position as unknown as THREE.Vector3)
        : new THREE.Vector3((p.position as any)?.x ?? 0, (p.position as any)?.y ?? 0, (p.position as any)?.z ?? 0);
      const norm = (p.normal as any) instanceof THREE.Vector3
        ? (p.normal as unknown as THREE.Vector3)
        : new THREE.Vector3((p.normal as any)?.x ?? 0, (p.normal as any)?.y ?? 1, (p.normal as any)?.z ?? 0);
      const tan = p.tangent
        ? ((p.tangent as any) instanceof THREE.Vector3
          ? (p.tangent as unknown as THREE.Vector3)
          : new THREE.Vector3((p.tangent as any)?.x ?? 0, (p.tangent as any)?.y ?? 0, (p.tangent as any)?.z ?? 0))
        : undefined;

      return {
        ...p,
        position: pos,
        normal: norm,
        tangent: tan,
      };
    });

    desc.settings.strokeSequenceIndex = this.ctx.strokes.size;
    const mat = this.ctx.materialCache.getStrokeMaterial(desc.settings, true, this.ctx.getActiveLayerOpacity());
    const geom = this.ctx.beadGenerator.generateGeometry(parsedPoints, desc.settings, this.ctx.getTargetMeshes());
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 10 + (this.ctx.strokes.size % 20000);
    this.ctx.strokeRoot.add(mesh);

    this.ctx.strokes.set(desc.id, {
      descriptor: {
        ...desc,
        points: parsedPoints,
      },
      meshes: [mesh],
    });
  }
}
