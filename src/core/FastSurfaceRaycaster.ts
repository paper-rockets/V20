/**
 * FastSurfaceRaycaster.ts
 *
 * Ultra-fast stylus/pointer surface raycaster optimized for 120 FPS / 240 FPS hit detection
 * on low-power mobile tablets (ARM Mali) up to desktop GPUs.
 *
 * Technical Specifications:
 * - Surface Area Heuristic (SAH) spatial BVH tree building via three-mesh-bvh (maxLeafTris: 5, indirect: true).
 * - Direct local-space ray evaluation using boundsTree.raycastFirst(...).
 * - Multi-mesh dynamic raycaster.far distance pruning.
 * - Inlined Cramer's Rule math for exact barycentric normal & UV interpolation.
 * - Zero GC memory allocation in hot loops (scratch vectors, matrices, and reusable hit result).
 */

import * as THREE from 'three';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  SAH,
  MeshBVH,
} from 'three-mesh-bvh';

// Inject three-mesh-bvh methods into Three.js prototypes if not yet attached
type BufferGeometryWithBVH = THREE.BufferGeometry & {
  boundsTree?: MeshBVH;
  computeBoundsTree?: typeof computeBoundsTree;
  disposeBoundsTree?: typeof disposeBoundsTree;
};

type MeshWithBVH = THREE.Mesh & {
  raycast: typeof acceleratedRaycast;
};

if (!('computeBoundsTree' in THREE.BufferGeometry.prototype)) {
  (THREE.BufferGeometry.prototype as BufferGeometryWithBVH).computeBoundsTree = computeBoundsTree;
  (THREE.BufferGeometry.prototype as BufferGeometryWithBVH).disposeBoundsTree = disposeBoundsTree;
  (THREE.Mesh.prototype as MeshWithBVH).raycast = acceleratedRaycast;
}

/**
 * Options controlling surface raycast execution.
 */
export interface RaycastIntersectOptions {
  seamBridging?: boolean;
  doubleSided?: boolean;
  barycentricNormals?: boolean;
}

/**
 * Micro-jitter offsets used for seam and gap bridging.
 */
const SEAM_JITTER: readonly [number, number][] = [
  [0.0018, 0],
  [-0.0018, 0],
  [0, 0.0018],
  [0, -0.0018],
  [0.00126, 0.00126],
  [-0.00126, -0.00126],
];

/**
 * Result data structure returned when a surface hit occurs.
 * Reused internally to guarantee 0 heap allocations in hot loops.
 */
export interface SurfaceHitResult {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  mesh: THREE.Mesh;
  faceIndex?: number;
  uv?: THREE.Vector2;
}

/**
 * Extended intersection type produced by three-mesh-bvh accelerated raycasting.
 */
interface BVHIntersection extends Omit<THREE.Intersection, 'face'> {
  barycoord?: THREE.Vector3;
  face?: {
    a: number;
    b: number;
    c: number;
    materialIndex?: number;
    normal?: THREE.Vector3;
  };
}

/**
 * Ultra-fast surface raycaster class for real-time pointer/stylus hit queries.
 */
export class FastSurfaceRaycaster {
  private _camera: THREE.Camera;
  private readonly _raycaster: THREE.Raycaster;

  // Viewport dimensions for screen-space to NDC conversion
  private _viewportWidth: number = 1;
  private _viewportHeight: number = 1;

  // Pre-allocated scratch vectors, rays, and matrices to guarantee 0 GC stutter
  private readonly _scratchCoords: THREE.Vector2 = new THREE.Vector2();
  private readonly _scratchLocalRay: THREE.Ray = new THREE.Ray();
  private readonly _scratchInvWorldMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private readonly _scratchNormalMatrix: THREE.Matrix3 = new THREE.Matrix3();
  private readonly _scratchNormal: THREE.Vector3 = new THREE.Vector3();
  private readonly _scratchHitPointWorld: THREE.Vector3 = new THREE.Vector3();

  // Vertex position & normal scratch registers
  private readonly _posA: THREE.Vector3 = new THREE.Vector3();
  private readonly _posB: THREE.Vector3 = new THREE.Vector3();
  private readonly _posC: THREE.Vector3 = new THREE.Vector3();
  private readonly _normA: THREE.Vector3 = new THREE.Vector3();
  private readonly _normB: THREE.Vector3 = new THREE.Vector3();
  private readonly _normC: THREE.Vector3 = new THREE.Vector3();
  private readonly _edgeBA: THREE.Vector3 = new THREE.Vector3();
  private readonly _edgeCA: THREE.Vector3 = new THREE.Vector3();
  private readonly _uvA: THREE.Vector2 = new THREE.Vector2();
  private readonly _uvB: THREE.Vector2 = new THREE.Vector2();
  private readonly _uvC: THREE.Vector2 = new THREE.Vector2();

  // Scratch intersection container for fallback raycasting
  private readonly _scratchIntersects: BVHIntersection[] = [];

  // Scratch local hit cached values
  private _cachedLocalPoint: THREE.Vector3 = new THREE.Vector3();
  private _cachedFaceIndex?: number;
  private _cachedFaceA: number = 0;
  private _cachedFaceB: number = 0;
  private _cachedFaceC: number = 0;
  private _cachedHasFaceIndices: boolean = false;

  // Single persistent result object returned by intersect()
  private readonly _result: SurfaceHitResult = {
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    distance: 0,
    mesh: null as unknown as THREE.Mesh,
    faceIndex: undefined,
    uv: new THREE.Vector2(),
  };

  /**
   * Initializes the fast raycaster with the provided active scene camera.
   * @param camera Active perspective or orthographic camera.
   */
  constructor(camera: THREE.Camera) {
    this._camera = camera;
    this._raycaster = new THREE.Raycaster();

    // Terminate traversal immediately on the closest polygon hit
    (this._raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly = true;

    // Default viewport to window dimensions if available
    if (typeof window !== 'undefined') {
      this._viewportWidth = Math.max(1, window.innerWidth);
      this._viewportHeight = Math.max(1, window.innerHeight);
    }
  }

  /**
   * Updates the active camera for ray generation.
   * @param camera The new camera to set.
   */
  public setCamera(camera: THREE.Camera): void {
    this._camera = camera;
  }

  /**
   * Updates viewport dimensions for converting client pixel coordinates to NDC.
   * @param width Viewport width in pixels.
   * @param height Viewport height in pixels.
   */
  public setViewport(width: number, height: number): void {
    if (width > 0) this._viewportWidth = width;
    if (height > 0) this._viewportHeight = height;
  }

  /**
   * Synchronously builds or updates the spatial BVH tree on the provided mesh geometry
   * using the Surface Area Heuristic (SAH) strategy for maximum ray traversal performance.
   * @param mesh Target mesh whose geometry will receive the BVH bounds tree.
   */
  public updateMeshBVH(mesh: THREE.Mesh): void {
    const geometry = mesh.geometry as BufferGeometryWithBVH;
    if (!geometry) return;

    // Ensure pre-computed bounding boxes and vertex normals
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }

    if (geometry.boundsTree && geometry.disposeBoundsTree) {
      geometry.disposeBoundsTree();
    }

    if (geometry.computeBoundsTree) {
      geometry.computeBoundsTree({
        strategy: SAH,
        targetLeafSize: 5,
        indirect: true,
      });
    } else {
      geometry.boundsTree = new MeshBVH(geometry, {
        strategy: SAH,
        targetLeafSize: 5,
        indirect: true,
      });
    }
  }

  /**
   * Asynchronously generates the BVH tree in a background microtask/yielding loop
   * to prevent frame drops on large high-polygon models during tablet painting.
   * @param mesh Target mesh to update.
   */
  public async updateMeshBVHAsync(mesh: THREE.Mesh): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          window.requestIdleCallback(() => {
            this.updateMeshBVH(mesh);
            resolve();
          });
        } else {
          setTimeout(() => {
            this.updateMeshBVH(mesh);
            resolve();
          }, 0);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Traverses a composite 3D object or model hierarchy and builds BVH trees on all child meshes.
   * @param object Target object or hierarchy to update.
   */
  public updateObjectBVH(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        this.updateMeshBVH(child);
      }
    });
  }

  /**
   * Evaluates a single ray against the target meshes at the specified coordinates.
   */
  private _evaluateAt(
    screenX: number,
    screenY: number,
    targets: THREE.Mesh[],
    doubleSided: boolean,
    interpolateBarycentric: boolean
  ): boolean {
    // Convert pixel coordinates to NDC if values fall outside standard [-1, 1] device range
    if (Math.abs(screenX) <= 1.0 && Math.abs(screenY) <= 1.0) {
      this._scratchCoords.set(screenX, screenY);
    } else {
      this._scratchCoords.set(
        (screenX / this._viewportWidth) * 2 - 1,
        -(screenY / this._viewportHeight) * 2 + 1
      );
    }

    // Configure raycaster from the active camera
    this._raycaster.setFromCamera(this._scratchCoords, this._camera);
    const worldRay = this._raycaster.ray;

    let closestMesh: THREE.Mesh | null = null;
    let minDistance = Infinity;

    // Multi-mesh iteration with dynamic distance pruning
    for (let i = 0; i < targets.length; i++) {
      const mesh = targets[i];
      if (!mesh.visible) continue;

      mesh.updateMatrixWorld();
      const geometry = mesh.geometry as BufferGeometryWithBVH;
      if (!geometry) continue;

      // Invert mesh world matrix into scratch matrix
      this._scratchInvWorldMatrix.copy(mesh.matrixWorld).invert();

      // Transform world ray into mesh local space
      this._scratchLocalRay.origin.copy(worldRay.origin).applyMatrix4(this._scratchInvWorldMatrix);
      this._scratchLocalRay.direction.copy(worldRay.direction).transformDirection(this._scratchInvWorldMatrix);

      // Direct evaluation in mesh local space using boundsTree.raycastFirst
      if (geometry.boundsTree) {
        const matOrSide = doubleSided ? THREE.DoubleSide : mesh.material;
        const localHit = geometry.boundsTree.raycastFirst(this._scratchLocalRay, matOrSide, 0, minDistance);

        if (localHit) {
          // Transform hit point back to world space to compute true world distance
          this._scratchHitPointWorld.copy(localHit.point).applyMatrix4(mesh.matrixWorld);
          const worldDist = worldRay.origin.distanceTo(this._scratchHitPointWorld);

          // Dynamic distance pruning
          if (worldDist < minDistance) {
            minDistance = worldDist;
            closestMesh = mesh;
            this._cachedLocalPoint.copy(localHit.point);
            this._cachedFaceIndex = localHit.faceIndex;

            if (localHit.face) {
              this._cachedFaceA = localHit.face.a;
              this._cachedFaceB = localHit.face.b;
              this._cachedFaceC = localHit.face.c;
              this._cachedHasFaceIndices = true;
            } else {
              this._cachedHasFaceIndices = false;
            }

            // Prune search distance for subsequent targets
            this._raycaster.far = minDistance;
          }
        }
      } else {
        // Fallback for meshes without boundsTree
        this._scratchIntersects.length = 0;
        this._raycaster.far = minDistance;
        mesh.raycast(this._raycaster, this._scratchIntersects as THREE.Intersection[]);

        if (this._scratchIntersects.length > 0) {
          const hit = this._scratchIntersects[0];
          if (hit.distance < minDistance) {
            minDistance = hit.distance;
            closestMesh = mesh;
            this._cachedLocalPoint.copy(hit.point).applyMatrix4(this._scratchInvWorldMatrix);
            this._cachedFaceIndex = hit.faceIndex;
            if (hit.face) {
              this._cachedFaceA = hit.face.a;
              this._cachedFaceB = hit.face.b;
              this._cachedFaceC = hit.face.c;
              this._cachedHasFaceIndices = true;
            } else {
              this._cachedHasFaceIndices = false;
            }
            this._raycaster.far = minDistance;
          }
        }
      }
    }

    // Reset raycaster far distance
    this._raycaster.far = Infinity;

    if (!closestMesh) {
      return false;
    }

    // Inlined Cramer's Rule math for exact barycentric normal and UV interpolation
    this._calculateInterpolatedData(closestMesh, interpolateBarycentric);

    // Populate persistent result object
    this._result.point.copy(this._cachedLocalPoint).applyMatrix4(closestMesh.matrixWorld);
    this._result.normal.copy(this._scratchNormal);
    this._result.distance = minDistance;
    this._result.mesh = closestMesh;
    this._result.faceIndex = this._cachedFaceIndex;

    return true;
  }

  /**
   * Performs an ultra-fast surface hit test against the provided target meshes.
   * Evaluates rays directly in mesh local space using boundsTree.raycastFirst(...)
   * with multi-mesh dynamic distance pruning, seam bridging fallback, and inlined Cramer's Rule math.
   *
   * @param screenX Pointer X in NDC [-1, 1] or viewport pixel coordinates.
   * @param screenY Pointer Y in NDC [-1, 1] or viewport pixel coordinates.
   * @param targets Array of target meshes to test for ray intersections.
   * @param options Optional flags for seam bridging, double-sided polygons, and barycentric normals.
   * @returns Reused SurfaceHitResult reference or null if no hit occurs.
   */
  public intersect(
    screenX: number,
    screenY: number,
    targets: THREE.Mesh[],
    options?: RaycastIntersectOptions
  ): SurfaceHitResult | null {
    if (targets.length === 0) {
      return null;
    }

    const doubleSided = options?.doubleSided ?? false;
    const barycentric = options?.barycentricNormals !== false;

    if (this._evaluateAt(screenX, screenY, targets, doubleSided, barycentric)) {
      return this._result;
    }

    if (options?.seamBridging) {
      for (let i = 0; i < SEAM_JITTER.length; i++) {
        const [ox, oy] = SEAM_JITTER[i];
        if (this._evaluateAt(screenX + ox, screenY + oy, targets, doubleSided, barycentric)) {
          return this._result;
        }
      }
    }

    return null;
  }

  /**
   * Computes accurate smooth normal and UV using inlined Cramer's Rule math
   * across triangle vertices. Allocates 0 bytes on the heap.
   */
  private _calculateInterpolatedData(mesh: THREE.Mesh, interpolateBarycentric: boolean = true): void {
    const geometry = mesh.geometry;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const index = geometry.index;

    if (!posAttr) {
      this._scratchNormal.set(0, 1, 0);
      return;
    }

    let iA = 0;
    let iB = 0;
    let iC = 0;

    if (this._cachedHasFaceIndices) {
      iA = this._cachedFaceA;
      iB = this._cachedFaceB;
      iC = this._cachedFaceC;
    } else if (this._cachedFaceIndex !== undefined) {
      if (index) {
        iA = index.getX(this._cachedFaceIndex * 3);
        iB = index.getX(this._cachedFaceIndex * 3 + 1);
        iC = index.getX(this._cachedFaceIndex * 3 + 2);
      } else {
        iA = this._cachedFaceIndex * 3;
        iB = this._cachedFaceIndex * 3 + 1;
        iC = this._cachedFaceIndex * 3 + 2;
      }
    }

    // Read local vertex coordinates
    this._posA.fromBufferAttribute(posAttr, iA);
    this._posB.fromBufferAttribute(posAttr, iB);
    this._posC.fromBufferAttribute(posAttr, iC);

    // Inlined Cramer's Rule:
    // v0 = B - A, v1 = C - A, v2 = P - A
    const v0x = this._posB.x - this._posA.x;
    const v0y = this._posB.y - this._posA.y;
    const v0z = this._posB.z - this._posA.z;

    const v1x = this._posC.x - this._posA.x;
    const v1y = this._posC.y - this._posA.y;
    const v1z = this._posC.z - this._posA.z;

    const v2x = this._cachedLocalPoint.x - this._posA.x;
    const v2y = this._cachedLocalPoint.y - this._posA.y;
    const v2z = this._cachedLocalPoint.z - this._posA.z;

    const d00 = v0x * v0x + v0y * v0y + v0z * v0z;
    const d01 = v0x * v1x + v0y * v1y + v0z * v1z;
    const d11 = v1x * v1x + v1y * v1y + v1z * v1z;
    const d20 = v2x * v0x + v2y * v0y + v2z * v0z;
    const d21 = v2x * v1x + v2y * v1y + v2z * v1z;

    const denom = d00 * d11 - d01 * d01;
    let u = 0.33333333;
    let v = 0.33333333;
    let w = 0.33333333;

    if (Math.abs(denom) > 1e-12) {
      v = (d11 * d20 - d01 * d21) / denom;
      w = (d00 * d21 - d01 * d20) / denom;
      u = 1.0 - v - w;
    }

    // Normal interpolation
    if (interpolateBarycentric && normAttr) {
      this._normA.fromBufferAttribute(normAttr, iA);
      this._normB.fromBufferAttribute(normAttr, iB);
      this._normC.fromBufferAttribute(normAttr, iC);

      this._scratchNormal.x = u * this._normA.x + v * this._normB.x + w * this._normC.x;
      this._scratchNormal.y = u * this._normA.y + v * this._normB.y + w * this._normC.y;
      this._scratchNormal.z = u * this._normA.z + v * this._normB.z + w * this._normC.z;
      this._scratchNormal.normalize();
    } else {
      // Geometric cross-product normal fallback
      this._scratchNormal.crossVectors(
        this._edgeBA.set(v0x, v0y, v0z),
        this._edgeCA.set(v1x, v1y, v1z)
      ).normalize();
    }

    // Transform local normal to world space
    this._scratchNormalMatrix.getNormalMatrix(mesh.matrixWorld);
    this._scratchNormal.applyMatrix3(this._scratchNormalMatrix).normalize();

    // UV coordinate interpolation
    if (uvAttr) {
      this._uvA.fromBufferAttribute(uvAttr, iA);
      this._uvB.fromBufferAttribute(uvAttr, iB);
      this._uvC.fromBufferAttribute(uvAttr, iC);

      if (!this._result.uv) {
        this._result.uv = new THREE.Vector2();
      }
      this._result.uv.x = u * this._uvA.x + v * this._uvB.x + w * this._uvC.x;
      this._result.uv.y = u * this._uvA.y + v * this._uvB.y + w * this._uvC.y;
    } else {
      this._result.uv = undefined;
    }
  }

  /**
   * Clean up internal references.
   */
  public dispose(): void {
    this._scratchIntersects.length = 0;
  }
}
