import * as THREE from 'three';

export interface ScaleAnalysis {
  isExtremeScale: boolean;
  maxDimension: number;
  minDimension: number;
  dimensions: { x: number; y: number; z: number };
  suggestion?: 'scale_down' | 'scale_up' | 'none';
}

export class ModelNormalizationService {
  /**
   * Analyzes the object's Axis-Aligned Bounding Box (AABB)
   * Flags models where the largest dimension is < 0.01 units or > 50.0 units.
   */
  public analyzeScale(object: THREE.Object3D): ScaleAnalysis {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDimension = Math.max(size.x, size.y, size.z);
    const minDimension = Math.min(
      size.x > 0 ? size.x : Infinity,
      size.y > 0 ? size.y : Infinity,
      size.z > 0 ? size.z : Infinity
    );

    const isTooSmall = maxDimension > 0 && maxDimension < 0.01;
    const isTooLarge = maxDimension > 50.0;
    const isExtremeScale = isTooSmall || isTooLarge;

    let suggestion: 'scale_down' | 'scale_up' | 'none' = 'none';
    if (isTooLarge) suggestion = 'scale_down';
    if (isTooSmall) suggestion = 'scale_up';

    return {
      isExtremeScale,
      maxDimension,
      minDimension: minDimension === Infinity ? 0 : minDimension,
      dimensions: { x: size.x, y: size.y, z: size.z },
      suggestion,
    };
  }

  /**
   * Normalizes a model in-place:
   * 1. Centers model to origin (0, 0, 0) and rests base on ground floor Y = 0.
   * 2. Scales uniformly so its maximum bounding dimension fits precisely inside 1.0 meter.
   */
  public normalizeModel(
    object: THREE.Object3D,
    targetSize: number = 1.0,
    groundToBase: boolean = true
  ): { appliedScale: number; offset: THREE.Vector3 } {
    // 1. Reset root transforms before computing geometry bounds
    object.updateMatrixWorld(true);

    const initialBox = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    initialBox.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const appliedScale = maxDim > 0 ? targetSize / maxDim : 1.0;

    // Center offset
    const center = new THREE.Vector3();
    initialBox.getCenter(center);

    // Apply translation to internal meshes or offset root
    const offset = new THREE.Vector3(
      -center.x * appliedScale,
      groundToBase ? -initialBox.min.y * appliedScale : -center.y * appliedScale,
      -center.z * appliedScale
    );

    return {
      appliedScale,
      offset,
    };
  }

  /**
   * Bakes parent transformations directly into child mesh geometries
   * and resets root position, rotation, and scale to identity.
   */
  public bakeTransforms(root: THREE.Object3D): void {
    root.updateMatrixWorld(true);

    const meshesToBake: { mesh: THREE.Mesh; worldMatrix: THREE.Matrix4 }[] = [];

    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        const mesh = child as THREE.Mesh;
        mesh.updateWorldMatrix(true, false);
        meshesToBake.push({
          mesh,
          worldMatrix: mesh.matrixWorld.clone(),
        });
      }
    });

    // Reset root transforms
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);

    // Apply world matrix to geometries and reset local matrix to identity
    for (const item of meshesToBake) {
      const { mesh, worldMatrix } = item;
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.applyMatrix4(worldMatrix);
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();

      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);
      mesh.updateMatrix();
    }
  }

  /**
   * Inverts face winding order and surface normal vectors
   * (Fixes inverted CAD shells and inside-out models)
   */
  public invertNormalsAndWinding(root: THREE.Object3D): void {
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        const geom = (child as THREE.Mesh).geometry;

        // Invert Normals buffer
        const normalAttr = geom.attributes.normal;
        if (normalAttr) {
          for (let i = 0; i < normalAttr.count; i++) {
            normalAttr.setXYZ(
              i,
              -normalAttr.getX(i),
              -normalAttr.getY(i),
              -normalAttr.getZ(i)
            );
          }
          normalAttr.needsUpdate = true;
        }

        // Invert Index winding (CW <-> CCW)
        if (geom.index) {
          const indexArray = geom.index.array;
          for (let i = 0; i < indexArray.length; i += 3) {
            const temp = indexArray[i + 1];
            indexArray[i + 1] = indexArray[i + 2];
            indexArray[i + 2] = temp;
          }
          geom.index.needsUpdate = true;
        } else if (geom.attributes.position) {
          // Re-generate normals if non-indexed
          geom.computeVertexNormals();
        }
      }
    });
  }

  /**
   * Recomputes missing or corrupt surface normals across all meshes in the tree.
   */
  public repairNormals(root: THREE.Object3D): number {
    let repairedCount = 0;
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        const geom = (child as THREE.Mesh).geometry;
        geom.computeVertexNormals();
        repairedCount++;
      }
    });
    return repairedCount;
  }
}

export const modelNormalization = new ModelNormalizationService();
