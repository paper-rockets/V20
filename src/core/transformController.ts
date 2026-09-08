import * as THREE from 'three';
import { TransformTargetScope, PerfectViewType, StrokeDescriptor } from '../types';

export interface TransformUndoItem {
  scope: TransformTargetScope;
  inverseMatrix: THREE.Matrix4;
  layerId?: string;
}

export interface TransformRedoItem {
  scope: TransformTargetScope;
  forwardMatrix: THREE.Matrix4;
  layerId?: string;
}

export interface TransformContext {
  modelRoot: THREE.Group;
  strokeRoot: THREE.Group;
  getTargetMeshes: () => THREE.Mesh[];
  getStrokes: () => Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>;
  getActiveLayerId: () => string;
  getActiveSelectedModelId: () => string | null;
  getDrawingPlaneMesh: () => THREE.Mesh | null;
  getCamera: () => THREE.PerspectiveCamera;
  getCameraTarget: () => THREE.Vector3;
  getContainer: () => HTMLElement | null;
  getNavigatorSensitivity: () => number;
  markDirty: () => void;
  notifyHistory: () => void;
  pushHistoryUndo: (entry: {
    kind: 'transform';
    scope: TransformTargetScope;
    inverseMatrix: THREE.Matrix4;
    forwardMatrix: THREE.Matrix4;
    layerId?: string;
    timestamp: number;
  }) => void;
  clearHistoryRedo: () => void;
}

export class TransformController {
  private ctx: TransformContext;

  public transformActiveScope: TransformTargetScope = 'all';
  public currentTransformTotalMatrix: THREE.Matrix4 = new THREE.Matrix4();
  public transformUndoStack: TransformUndoItem[] = [];
  public transformRedoStack: TransformRedoItem[] = [];

  constructor(ctx: TransformContext) {
    this.ctx = ctx;
  }

  public clearHistory(): void {
    this.transformUndoStack.length = 0;
    this.transformRedoStack.length = 0;
  }

  /**
   * Calculates the geometric bounding center of the targeted selection (model, strokes, or active layer)
   */
  public getSelectionCenter(scope: TransformTargetScope = 'all'): THREE.Vector3 {
    const box = new THREE.Box3();
    let hasContent = false;

    const targetMeshes = this.ctx.getTargetMeshes();
    const activeSelectedModelId = this.ctx.getActiveSelectedModelId();
    const strokes = this.ctx.getStrokes();
    const activeLayerId = this.ctx.getActiveLayerId();

    if (scope === 'model' || scope === 'all') {
      if (scope === 'model' && activeSelectedModelId) {
        const targetModel = this.ctx.modelRoot.children.find((c) => c.uuid === activeSelectedModelId);
        if (targetModel) {
          box.setFromObject(targetModel);
          if (!box.isEmpty()) hasContent = true;
        }
      } else if (targetMeshes.length > 0) {
        if (scope === 'model') {
          for (const mesh of targetMeshes) {
            box.expandByObject(mesh);
            hasContent = true;
          }
        } else {
          box.setFromObject(this.ctx.modelRoot);
          if (!box.isEmpty()) hasContent = true;
        }
      }
    }

    if (scope === 'strokes' || scope === 'all') {
      if (strokes.size > 0) {
        const strokeBox = new THREE.Box3().setFromObject(this.ctx.strokeRoot);
        if (!strokeBox.isEmpty()) {
          if (hasContent) {
            box.union(strokeBox);
          } else {
            box.copy(strokeBox);
            hasContent = true;
          }
        }
      }
    }

    if (scope === 'active_layer') {
      const layerBox = new THREE.Box3();
      let layerFound = false;
      strokes.forEach(({ descriptor, meshes }) => {
        if (descriptor.layerId === activeLayerId) {
          meshes.forEach((m) => {
            layerBox.expandByObject(m);
            layerFound = true;
          });
        }
      });
      if (layerFound && !layerBox.isEmpty()) {
        box.copy(layerBox);
        hasContent = true;
      }
    }

    if (!hasContent || box.isEmpty()) {
      return this.ctx.getCameraTarget().clone();
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
  }

  /**
   * Computes the 3D world anchor that corresponds precisely to the exact screen center crosshair
   */
  public getScreenCenterWorldAnchor(targetCenter?: THREE.Vector3): THREE.Vector3 {
    const center = targetCenter || this.getSelectionCenter(this.transformActiveScope);
    const camera = this.ctx.getCamera();
    const camDir = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, center);
    const ray = new THREE.Ray(camera.position, camDir);
    const anchor = new THREE.Vector3();
    const hit = ray.intersectPlane(plane, anchor);
    return hit ? anchor : center.clone();
  }

  /**
   * Begins a continuous transformation gesture, tracking undo state
   */
  public beginTransform(scope: TransformTargetScope = 'all'): void {
    this.transformActiveScope = scope;
    this.currentTransformTotalMatrix.identity();
  }

  /**
   * Concludes a transformation gesture and commits undo state
   */
  public endTransform(): void {
    if (!this.currentTransformTotalMatrix.equals(new THREE.Matrix4())) {
      // Never pollute undo history with camera navigation / orbit / pan movements!
      if ((this.transformActiveScope as string) !== 'camera') {
        const inv = this.currentTransformTotalMatrix.clone().invert();
        const fwd = this.currentTransformTotalMatrix.clone();
        const activeLayerId = this.ctx.getActiveLayerId();
        this.transformUndoStack.push({
          scope: this.transformActiveScope,
          inverseMatrix: inv,
          layerId: activeLayerId,
        });
        this.ctx.pushHistoryUndo({
          kind: 'transform',
          scope: this.transformActiveScope,
          inverseMatrix: inv,
          forwardMatrix: fwd,
          layerId: activeLayerId,
          timestamp: Date.now(),
        });
        this.transformRedoStack = [];
        this.ctx.clearHistoryRedo();
        this.ctx.notifyHistory();
      }
    }
  }

  /**
   * Applies an arbitrary 4x4 matrix transformation across target meshes, strokes, and descriptors
   */
  public applyTransformMatrix(matrix: THREE.Matrix4, scope: TransformTargetScope = 'all'): void {
    this.currentTransformTotalMatrix.premultiply(matrix);

    const targetMeshes = this.ctx.getTargetMeshes();
    const activeSelectedModelId = this.ctx.getActiveSelectedModelId();
    const strokes = this.ctx.getStrokes();
    const activeLayerId = this.ctx.getActiveLayerId();

    if (scope === 'model') {
      if (activeSelectedModelId) {
        const targetModel = this.ctx.modelRoot.children.find((c) => c.uuid === activeSelectedModelId);
        if (targetModel) {
          targetModel.applyMatrix4(matrix);
          targetModel.updateMatrixWorld(true);
          targetModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              child.geometry.computeBoundingSphere();
              child.geometry.computeBoundingBox();
            }
          });
        }
      } else {
        const modelChildren = this.ctx.modelRoot.children.filter((c) => c !== this.ctx.strokeRoot);
        if (modelChildren.length > 0) {
          modelChildren.forEach((child) => {
            child.applyMatrix4(matrix);
            child.updateMatrixWorld(true);
            child.traverse((c) => {
              if (c instanceof THREE.Mesh && c.geometry) {
                c.geometry.computeBoundingSphere();
                c.geometry.computeBoundingBox();
              }
            });
          });
        } else {
          targetMeshes.forEach((mesh) => {
            mesh.applyMatrix4(matrix);
            mesh.updateMatrixWorld(true);
            if (mesh.geometry) {
              mesh.geometry.computeBoundingSphere();
              mesh.geometry.computeBoundingBox();
            }
          });
        }
      }
    } else if (scope === 'all') {
      this.ctx.modelRoot.applyMatrix4(matrix);
      this.ctx.modelRoot.updateMatrixWorld(true);
      targetMeshes.forEach((mesh) => {
        if (mesh.geometry) {
          mesh.geometry.computeBoundingSphere();
          mesh.geometry.computeBoundingBox();
        }
      });
      // strokeRoot is already a child of modelRoot, so child meshes transform together.
      // Update descriptor points for geometry export / raycasting synchronization
      strokes.forEach(({ descriptor }) => {
        descriptor.points.forEach((p) => {
          p.position.applyMatrix4(matrix);
          p.normal.transformDirection(matrix).normalize();
        });
      });
    } else if (scope === 'strokes') {
      this.ctx.strokeRoot.applyMatrix4(matrix);
      this.ctx.strokeRoot.updateMatrixWorld(true);
      strokes.forEach(({ descriptor }) => {
        descriptor.points.forEach((p) => {
          p.position.applyMatrix4(matrix);
          p.normal.transformDirection(matrix).normalize();
        });
      });
    } else if (scope === 'active_layer') {
      let transformedAny = false;
      strokes.forEach(({ descriptor, meshes }) => {
        if (descriptor.layerId === activeLayerId) {
          transformedAny = true;
          meshes.forEach((mesh) => {
            mesh.applyMatrix4(matrix);
            mesh.updateMatrixWorld(true);
          });
          descriptor.points.forEach((p) => {
            p.position.applyMatrix4(matrix);
            p.normal.transformDirection(matrix).normalize();
          });
        }
      });
      // Fallback: If no strokes exist in the active layer, transform modelRoot so navigator remains fully functional
      if (!transformedAny) {
        this.ctx.modelRoot.applyMatrix4(matrix);
        this.ctx.modelRoot.updateMatrixWorld(true);
        targetMeshes.forEach((mesh) => {
          if (mesh.geometry) {
            mesh.geometry.computeBoundingSphere();
            mesh.geometry.computeBoundingBox();
          }
        });
      }
    }
    this.ctx.markDirty();
  }

  /**
   * 2D Screen-Space Planar Translation:
   * Moves selection parallel to the current camera view plane with 1:1 screen-to-world mapping.
   */
  public translateScreenSpace(
    deltaScreenX: number,
    deltaScreenY: number,
    scope: TransformTargetScope = 'all',
    isLocked: boolean = false
  ): void {
    let dx = deltaScreenX;
    let dy = deltaScreenY;

    // Locked Constraints: Enforce strict orthogonal 4-way vector movement
    if (isLocked) {
      if (Math.abs(dx) > Math.abs(dy)) {
        dy = 0;
      } else {
        dx = 0;
      }
    }

    const camera = this.ctx.getCamera();
    const targetCenter = this.getSelectionCenter(scope);
    const dist = Math.max(0.5, camera.position.distanceTo(targetCenter));
    const vHeight = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const container = this.ctx.getContainer();
    const factor = (vHeight / (container?.clientHeight || 800)) * this.ctx.getNavigatorSensitivity();

    const forward = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const worldDelta = new THREE.Vector3()
      .addScaledVector(right, dx * factor)
      .addScaledVector(up, -dy * factor);

    const transMatrix = new THREE.Matrix4().makeTranslation(worldDelta.x, worldDelta.y, worldDelta.z);
    this.applyTransformMatrix(transMatrix, scope);
  }

  /**
   * 2D Screen-Space Scaling:
   * Anchored precisely to the exact center of the screen (crosshair).
   */
  public scaleScreenSpace(
    scaleFactorX: number,
    scaleFactorY: number,
    scope: TransformTargetScope = 'all',
    isLocked: boolean = false
  ): void {
    let sx = scaleFactorX;
    let sy = scaleFactorY;

    // Locked Constraints: Uniform proportions
    if (isLocked) {
      const avg = (sx + sy) / 2;
      sx = avg;
      sy = avg;
    }

    // If both axes are scaling or if locked, scale depth proportionally; otherwise keep depth at 1.0
    const isUniform = isLocked || (Math.abs(sx - 1.0) > 0.0001 && Math.abs(sy - 1.0) > 0.0001);
    const sz = isUniform ? (sx + sy) / 2 : 1.0;
    const anchor = this.getScreenCenterWorldAnchor(this.getSelectionCenter(scope));

    const camera = this.ctx.getCamera();
    const forward = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(right, up, forward.clone().negate());
    const rotInv = rotMatrix.clone().invert();

    const toAnchor = new THREE.Matrix4().makeTranslation(-anchor.x, -anchor.y, -anchor.z);
    const fromAnchor = new THREE.Matrix4().makeTranslation(anchor.x, anchor.y, anchor.z);
    const scaleMatrix = new THREE.Matrix4().makeScale(sx, sy, sz);

    const finalMat = new THREE.Matrix4()
      .multiply(fromAnchor)
      .multiply(rotMatrix)
      .multiply(scaleMatrix)
      .multiply(rotInv)
      .multiply(toAnchor);

    this.applyTransformMatrix(finalMat, scope);
  }

  /**
   * 2D Screen-Center Rotation:
   * Spins selection around the screen's center crosshair along the view axis.
   */
  public rotateScreenSpace(
    deltaAngleRad: number,
    scope: TransformTargetScope = 'all',
    isLocked: boolean = false
  ): void {
    let angle = deltaAngleRad * this.ctx.getNavigatorSensitivity();

    // Locked Constraints: Quantize into exact 15-degree increments (PI / 12)
    if (isLocked) {
      const step = Math.PI / 12;
      angle = Math.round(angle / step) * step;
      if (Math.abs(angle) < 0.0001) return;
    }

    const anchor = this.getScreenCenterWorldAnchor();
    const camera = this.ctx.getCamera();
    const camDir = camera.getWorldDirection(new THREE.Vector3()).normalize();

    const toAnchor = new THREE.Matrix4().makeTranslation(-anchor.x, -anchor.y, -anchor.z);
    const fromAnchor = new THREE.Matrix4().makeTranslation(anchor.x, anchor.y, anchor.z);
    const rotMat = new THREE.Matrix4().makeRotationAxis(camDir, -angle);

    const finalMat = new THREE.Matrix4()
      .multiply(fromAnchor)
      .multiply(rotMat)
      .multiply(toAnchor);

    this.applyTransformMatrix(finalMat, scope);
  }

  /**
   * 3D Global Absolute Translation:
   * Dragging Red (X), Green (Y), or Blue (Z) moves object strictly along global axis.
   */
  public translateWorldAxis(
    axis: 'x' | 'y' | 'z',
    deltaWorld: number,
    scope: TransformTargetScope = 'all'
  ): void {
    const sens = this.ctx.getNavigatorSensitivity();
    const vec = new THREE.Vector3(
      axis === 'x' ? deltaWorld * sens : 0,
      axis === 'y' ? deltaWorld * sens : 0,
      axis === 'z' ? deltaWorld * sens : 0
    );
    const transMat = new THREE.Matrix4().makeTranslation(vec.x, vec.y, vec.z);
    this.applyTransformMatrix(transMat, scope);
  }

  /**
   * 3D Global Axis Rotation:
   * Rotating Red (X), Green (Y), or Blue (Z) arcs spins around the object's geometric center.
   */
  public rotateWorldAxis(
    axis: 'x' | 'y' | 'z',
    deltaAngleRad: number,
    scope: TransformTargetScope = 'all',
    isLocked: boolean = false
  ): void {
    let angle = deltaAngleRad * this.ctx.getNavigatorSensitivity();
    if (isLocked) {
      const step = Math.PI / 12; // 15 degrees
      angle = Math.round(angle / step) * step;
      if (Math.abs(angle) < 0.0001) return;
    }

    const center = this.getSelectionCenter(scope);
    const axisVec = new THREE.Vector3(
      axis === 'x' ? 1 : 0,
      axis === 'y' ? 1 : 0,
      axis === 'z' ? 1 : 0
    );

    const toCenter = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    const fromCenter = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z);
    const rotMat = new THREE.Matrix4().makeRotationAxis(axisVec, angle);

    const finalMat = new THREE.Matrix4()
      .multiply(fromCenter)
      .multiply(rotMat)
      .multiply(toCenter);

    this.applyTransformMatrix(finalMat, scope);
  }

  /**
   * 3D Trackball Rotation:
   * Dragging central sphere enables freeform, non-linear rotation around object geometric center.
   */
  public rotateTrackball(
    deltaX: number,
    deltaY: number,
    scope: TransformTargetScope = 'all'
  ): void {
    const center = this.getSelectionCenter(scope);
    const rotSpeed = 0.005 * this.ctx.getNavigatorSensitivity();
    const camera = this.ctx.getCamera();

    const forward = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const qX = new THREE.Quaternion().setFromAxisAngle(up, deltaX * rotSpeed);
    const qY = new THREE.Quaternion().setFromAxisAngle(right, deltaY * rotSpeed);
    const deltaQ = qX.multiply(qY);

    const toCenter = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    const fromCenter = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z);
    const rotMat = new THREE.Matrix4().makeRotationFromQuaternion(deltaQ);

    const finalMat = new THREE.Matrix4()
      .multiply(fromCenter)
      .multiply(rotMat)
      .multiply(toCenter);

    this.applyTransformMatrix(finalMat, scope);
    this.ctx.markDirty();
  }

  /**
   * 2D Translation on the Existing Plane Surface:
   * Moves targeted plane or selection strictly along its local surface axes
   * (Up/Down along local Y, Left/Right along local X).
   */
  public translateOnPlane(
    deltaX: number,
    deltaY: number,
    scope: TransformTargetScope = 'all'
  ): void {
    let right = new THREE.Vector3(1, 0, 0);
    let up = new THREE.Vector3(0, 1, 0);

    const drawingPlaneMesh = this.ctx.getDrawingPlaneMesh();
    const plane = drawingPlaneMesh || (this.ctx.modelRoot.getObjectByName('DrawingPlaneCanvas') as THREE.Mesh);
    if (plane) {
      const planeQuat = new THREE.Quaternion();
      plane.getWorldQuaternion(planeQuat);
      right = new THREE.Vector3(1, 0, 0).applyQuaternion(planeQuat).normalize();
      up = new THREE.Vector3(0, 1, 0).applyQuaternion(planeQuat).normalize();
    } else {
      const camera = this.ctx.getCamera();
      const forward = camera.getWorldDirection(new THREE.Vector3()).normalize();
      right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      up = new THREE.Vector3().crossVectors(right, forward).normalize();
    }

    const step = 0.08 * this.ctx.getNavigatorSensitivity();
    const worldDelta = new THREE.Vector3()
      .addScaledVector(right, deltaX * step)
      .addScaledVector(up, deltaY * step);

    const transMatrix = new THREE.Matrix4().makeTranslation(worldDelta.x, worldDelta.y, worldDelta.z);
    this.applyTransformMatrix(transMatrix, scope);
    this.ctx.markDirty();
  }

  /**
   * 2D Rotation on the Existing Plane Surface:
   * Rotates targeted plane or selection around its face normal (in-plane spin).
   */
  public rotateOnPlane(
    deltaAngleRad: number,
    scope: TransformTargetScope = 'all',
    isLocked: boolean = false
  ): void {
    let angle = deltaAngleRad * this.ctx.getNavigatorSensitivity();
    if (isLocked) {
      const step = Math.PI / 12; // 15 degrees
      angle = Math.round(angle / step) * step;
      if (Math.abs(angle) < 0.0001) return;
    }

    const center = this.getSelectionCenter(scope);
    let normal = new THREE.Vector3(0, 0, 1);

    const drawingPlaneMesh = this.ctx.getDrawingPlaneMesh();
    const plane = drawingPlaneMesh || (this.ctx.modelRoot.getObjectByName('DrawingPlaneCanvas') as THREE.Mesh);
    if (plane) {
      const planeQuat = new THREE.Quaternion();
      plane.getWorldQuaternion(planeQuat);
      normal = new THREE.Vector3(0, 0, 1).applyQuaternion(planeQuat).normalize();
    } else {
      normal = this.ctx.getCamera().getWorldDirection(new THREE.Vector3()).normalize().negate();
    }

    const toCenter = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    const fromCenter = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z);
    const rotMat = new THREE.Matrix4().makeRotationAxis(normal, angle);

    const finalMat = new THREE.Matrix4()
      .multiply(fromCenter)
      .multiply(rotMat)
      .multiply(toCenter);

    this.applyTransformMatrix(finalMat, scope);
    this.ctx.markDirty();
  }

  /**
   * Aligns targeted drawing plane surface directly facing the current camera
   */
  public alignSurfaceToCamera(scope: TransformTargetScope = 'all'): void {
    const camQuat = this.ctx.getCamera().quaternion.clone();
    const drawingPlaneMesh = this.ctx.getDrawingPlaneMesh();
    const plane = drawingPlaneMesh || (this.ctx.modelRoot.getObjectByName('DrawingPlaneCanvas') as THREE.Mesh);
    if (plane) {
      plane.quaternion.copy(camQuat);
      plane.updateMatrixWorld(true);
    } else {
      this.ctx.modelRoot.quaternion.copy(camQuat);
      this.ctx.modelRoot.updateMatrixWorld(true);
    }
    this.ctx.markDirty();
  }

  /**
   * Sets exact surface orientation (pitch and roll angles in degrees)
   */
  public setSurfaceOrientation(pitchDeg: number, rollDeg: number, scope: TransformTargetScope = 'all'): void {
    const DEG = Math.PI / 180;
    const drawingPlaneMesh = this.ctx.getDrawingPlaneMesh();
    const plane = drawingPlaneMesh || (this.ctx.modelRoot.getObjectByName('DrawingPlaneCanvas') as THREE.Mesh);
    const target = (plane && (scope === 'all' || (scope as string) === 'plane')) ? plane : this.ctx.modelRoot;
    if (target) {
      this.beginTransform(scope);
      const e = new THREE.Euler().setFromQuaternion(target.quaternion, 'YXZ');
      target.quaternion.setFromEuler(new THREE.Euler(pitchDeg * DEG, e.y, rollDeg * DEG, 'YXZ'));
      target.updateMatrixWorld(true);
      this.endTransform();
      this.ctx.markDirty();
    }
  }

  /**
   * Translates targeted objects along a specific 3D axis (wrapper for translateWorldAxis)
   */
  public translateAxis3D(
    axis: 'x' | 'y' | 'z',
    deltaWorld: number,
    scope: TransformTargetScope = 'all'
  ): void {
    this.translateWorldAxis(axis, deltaWorld, scope);
  }

  /**
   * Rotates targeted objects along a specific 3D axis (wrapper for rotateWorldAxis)
   */
  public rotateAxis3D(
    axis: 'x' | 'y' | 'z',
    deltaAngleRad: number,
    scope: TransformTargetScope = 'all',
    isLocked: boolean = false
  ): void {
    this.rotateWorldAxis(axis, deltaAngleRad, scope, isLocked);
  }

  /**
   * Scales targeted objects along a specific axis ('x', 'y', 'z') or 'uniform'
   * around the selection centroid.
   * If isLocked is true, enforces uniform proportions.
   */
  public scaleAxis(
    axis: 'x' | 'y' | 'z' | 'uniform',
    factor: number,
    scope: TransformTargetScope = 'all',
    isLocked: boolean = false
  ): void {
    const center = this.getSelectionCenter(scope);
    const toCenter = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    const fromCenter = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z);

    let sx = 1.0;
    let sy = 1.0;
    let sz = 1.0;

    if (isLocked || axis === 'uniform') {
      sx = factor;
      sy = factor;
      sz = factor;
    } else if (axis === 'y') {
      sy = factor;
    } else if (axis === 'x') {
      sx = factor;
    } else if (axis === 'z') {
      sz = factor;
    }

    const scaleMat = new THREE.Matrix4().makeScale(sx, sy, sz);
    const finalMat = new THREE.Matrix4().multiply(fromCenter).multiply(scaleMat).multiply(toCenter);
    this.applyTransformMatrix(finalMat, scope);
  }

  /**
   * Scales targeted objects uniformly or along an axis around selection center
   */
  public scaleAxis3D(
    factor: number,
    scope: TransformTargetScope = 'all'
  ): void {
    this.scaleAxis('uniform', factor, scope, false);
  }

  /**
   * Snaps model bottom bounding box to ground plane (Y = 0)
   */
  public snapModelToGround(): void {
    const box = new THREE.Box3().setFromObject(this.ctx.modelRoot);
    if (!box.isEmpty()) {
      const minY = box.min.y;
      this.ctx.modelRoot.position.y -= minY;
      this.ctx.modelRoot.updateMatrixWorld(true);
    }
  }

  /**
   * Snaps the active 3D model or primitive to rest flush on the ground grid (y = -1.2)
   */
  public snapActiveToGround(targetScope: TransformTargetScope = 'model'): void {
    const groundY = -1.2;
    let targetObj: THREE.Object3D | null = null;

    const activeSelectedModelId = this.ctx.getActiveSelectedModelId();
    if (activeSelectedModelId) {
      targetObj = this.ctx.modelRoot.children.find((c) => c.uuid === activeSelectedModelId) || null;
    }
    if (!targetObj) {
      targetObj = this.ctx.modelRoot.children.find((c) => c !== this.ctx.strokeRoot) || this.ctx.modelRoot;
    }

    const box = new THREE.Box3().setFromObject(targetObj);
    if (box.isEmpty()) return;

    const deltaY = groundY - box.min.y;
    if (Math.abs(deltaY) > 0.0005) {
      this.beginTransform(targetScope);
      const matrix = new THREE.Matrix4().makeTranslation(0, deltaY, 0);
      this.applyTransformMatrix(matrix, targetScope);
      this.endTransform();
      this.ctx.markDirty();
    }
  }

  /**
   * Smoothly orients the actual 3D model or drawing canvas plane directly (WITHOUT moving camera)
   */
  public orientModelOrSurface(view: PerfectViewType, scope: TransformTargetScope = 'all'): void {
    switch (view) {
      case 'front':
        this.ctx.modelRoot.rotation.set(0, 0, 0);
        break;
      case 'back':
        this.ctx.modelRoot.rotation.set(0, Math.PI, 0);
        break;
      case 'top':
        this.ctx.modelRoot.rotation.set(Math.PI / 2, 0, 0);
        break;
      case 'bottom':
        this.ctx.modelRoot.rotation.set(-Math.PI / 2, 0, 0);
        break;
      case 'right':
        this.ctx.modelRoot.rotation.set(0, -Math.PI / 2, 0);
        break;
      case 'left':
        this.ctx.modelRoot.rotation.set(0, Math.PI / 2, 0);
        break;
      case 'isometric':
        this.ctx.modelRoot.rotation.set(-Math.PI * 0.15, Math.PI * 0.25, 0);
        break;
    }
    this.ctx.modelRoot.updateMatrixWorld(true);
  }

  /**
   * Rotates the 3D model or drawing surface smoothly (WITHOUT moving camera)
   */
  public rotateModelOrSurface(deltaX: number, deltaY: number, scope: TransformTargetScope = 'all'): void {
    this.rotateTrackball(deltaX, deltaY, scope);
  }

  /**
   * Scales the 3D model or drawing surface (WITHOUT moving camera)
   */
  public scaleModelOrSurface(scaleFactor: number, scope: TransformTargetScope = 'all'): void {
    const factor = Math.max(0.5, Math.min(2.0, scaleFactor));
    this.ctx.modelRoot.scale.multiplyScalar(factor);
    this.ctx.modelRoot.updateMatrixWorld(true);
  }

  /**
   * Resets model/surface and stroke transforms without affecting camera
   */
  public resetTransform(scope: TransformTargetScope = 'all'): void {
    if (scope === 'all' || scope === 'model') {
      this.ctx.modelRoot.position.set(0, 0, 0);
      this.ctx.modelRoot.rotation.set(0, 0, 0);
      this.ctx.modelRoot.scale.set(1, 1, 1);
      this.ctx.modelRoot.updateMatrixWorld(true);

      const modelChildren = this.ctx.modelRoot.children.filter((c) => c !== this.ctx.strokeRoot);
      modelChildren.forEach((child) => {
        if (child.userData && child.userData.initialPosition) {
          child.position.copy(child.userData.initialPosition);
        } else {
          child.position.set(0, 0, 0);
        }
        if (child.userData && child.userData.initialRotation) {
          child.rotation.copy(child.userData.initialRotation);
        } else {
          child.rotation.set(0, 0, 0);
        }
        if (child.userData && child.userData.initialScale) {
          child.scale.copy(child.userData.initialScale);
        } else {
          child.scale.set(1, 1, 1);
        }
        child.updateMatrixWorld(true);
      });
    }
    if (scope === 'all' || scope === 'strokes' || scope === 'active_layer') {
      this.ctx.strokeRoot.position.set(0, 0, 0);
      this.ctx.strokeRoot.rotation.set(0, 0, 0);
      this.ctx.strokeRoot.scale.set(1, 1, 1);
      this.ctx.strokeRoot.updateMatrixWorld(true);

      this.ctx.getStrokes().forEach(({ meshes }) => {
        meshes.forEach((m) => {
          m.position.set(0, 0, 0);
          m.rotation.set(0, 0, 0);
          m.scale.set(1, 1, 1);
          m.updateMatrixWorld(true);
        });
      });
    }
  }

  /**
   * Resets model/surface transform without affecting camera
   */
  public resetModelOrSurface(scope: TransformTargetScope = 'all'): void {
    this.resetTransform(scope);
  }
}
