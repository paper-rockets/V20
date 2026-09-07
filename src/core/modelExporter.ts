import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as WebGLTextureUtils from 'three/examples/jsm/utils/WebGLTextureUtils.js';
import { DRACOExporter } from 'three/examples/jsm/exporters/DRACOExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { modelNormalization } from './modelNormalization';
import { ensureGeometryLinearVertexColors } from './colorMath';

export interface DracoCompressionSettings {
  enabled: boolean;
  compressionLevel: number; // 0 - 10
  quantizationPosition: number; // 10 - 16 bits
  quantizationNormal: number; // 8 - 12 bits
  quantizationTexcoord: number; // 8 - 12 bits
  quantizationColor: number; // 8 - 10 bits
  quantizationGeneric: number; // 8 - 12 bits
}

export interface TextureOptimizationSettings {
  resizeMax: 0 | 512 | 1024 | 2048 | 4096;
  quality: number;
  convertToWebP: boolean;
}

export interface ModelTransformSettings {
  scale: {
    uniform: boolean;
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
  };
  position: {
    x: number;
    y: number;
    z: number;
  };
  centerOrigin: boolean;
  groundToFloor: boolean;
  upAxis: 'Y' | 'Z';
  simpleGrayMode: boolean;
  materialOverrideEnabled: boolean;
  customBaseColor: string;
  invertedNormals: boolean;
}

export interface ModelExportSettings {
  bakeTransforms: boolean;
  draco: DracoCompressionSettings;
  texture: TextureOptimizationSettings;
  removeUnusedMaterials: boolean;
  outputFormat: 'glb' | 'gltf' | 'obj' | 'stl';
  filename: string;
  applyMaterialOverride?: boolean;
}

export interface ModelExportResult {
  blob: Blob;
  url: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  durationMs: number;
}

export class ModelExporterService {
  private gltfExporter: GLTFExporter;
  private dracoExporter: DRACOExporter;
  private objExporter: OBJExporter;
  private stlExporter: STLExporter;


/**
 * Compressed-texture support for export.
 *
 * A GLB with KTX2/BasisU textures loads fine but cannot be re-exported:
 * GLTFExporter throws "setTextureUtils() must be called to process compressed
 * textures". In the converter that meant a model imported, previewed correctly,
 * and then silently failed to save — "Save In-App" appeared to do nothing and
 * storage stayed empty.
 *
 * WebGLTextureUtils.decompress ships inside the three package we already use.
 */
  constructor() {
    this.gltfExporter = new GLTFExporter();
    try {
      (this.gltfExporter as any).setTextureUtils?.(WebGLTextureUtils);
    } catch (err) {
      console.warn('[ModelExporter] compressed-texture export unavailable:', err);
    }
    this.dracoExporter = new DRACOExporter();
    this.objExporter = new OBJExporter();
    this.stlExporter = new STLExporter();
  }

  /**
   * Clones model, applies baked user transformations (Scale, Orientation, Center/Ground),
   * optionally applies material basecoat overrides or Draco compression, and exports to standard GLB, OBJ, or STL.
   */
  public async exportModel(
    sourceScene: THREE.Object3D,
    transforms: ModelTransformSettings,
    settings: ModelExportSettings,
    originalSize: number
  ): Promise<ModelExportResult> {
    const startTime = performance.now();

    // 1. Deep clone the hierarchy so original uploaded model is never mutated
    const clonedScene = sourceScene.clone(true);

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry = mesh.geometry.clone();
          // Ensure vertex colors follow strict glTF 2.0 Linear-sRGB specification
          ensureGeometryLinearVertexColors(mesh.geometry);
        }
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
    });

    // 2. Apply Material Override if Simple Gray Mode or Custom Base Color is active
    if (transforms.simpleGrayMode || transforms.materialOverrideEnabled || settings.applyMaterialOverride) {
      const overrideColor = transforms.simpleGrayMode ? '#808080' : transforms.customBaseColor || '#808080';
      const solidMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(overrideColor),
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });

      clonedScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.material = solidMat.clone();
        }
      });
    }

    // 3. Invert Normals if requested
    if (transforms.invertedNormals) {
      modelNormalization.invertNormalsAndWinding(clonedScene);
    }

    // 4. Prepare container group for user transforms
    const wrapper = new THREE.Group();
    wrapper.name = settings.filename || 'ExportedModel';
    wrapper.add(clonedScene);

    // Apply Up-Axis conversion if needed
    if (transforms.upAxis === 'Z') {
      clonedScene.rotation.x = -Math.PI / 2;
    }

    // Apply Scale
    clonedScene.scale.set(
      transforms.scale.x,
      transforms.scale.y,
      transforms.scale.z
    );

    // Apply Rotation (degrees to radians)
    clonedScene.rotation.x += THREE.MathUtils.degToRad(transforms.rotation.x);
    clonedScene.rotation.y += THREE.MathUtils.degToRad(transforms.rotation.y);
    clonedScene.rotation.z += THREE.MathUtils.degToRad(transforms.rotation.z);

    // Apply Position
    clonedScene.position.set(
      transforms.position.x,
      transforms.position.y,
      transforms.position.z
    );

    // Compute bounding box and handle centering / grounding
    clonedScene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = new THREE.Vector3();
    box.getCenter(center);

    if (transforms.centerOrigin) {
      clonedScene.position.x -= center.x;
      clonedScene.position.z -= center.z;
    }

    if (transforms.groundToFloor) {
      clonedScene.position.y -= box.min.y;
    }

    clonedScene.updateMatrixWorld(true);

    // 5. Bake transforms directly into geometry if requested
    if (settings.bakeTransforms) {
      modelNormalization.bakeTransforms(wrapper);
    }

    // 6. Handle Non-GLTF Formats (OBJ and STL)
    if (settings.outputFormat === 'obj') {
      const objString = this.objExporter.parse(wrapper);
      const blob = new Blob([objString], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const durationMs = Math.round(performance.now() - startTime);
      return {
        blob,
        url,
        originalSizeBytes: originalSize,
        compressedSizeBytes: blob.size,
        compressionRatio: originalSize > 0 ? Math.max(0, (originalSize - blob.size) / originalSize) : 0,
        durationMs,
      };
    }

    if (settings.outputFormat === 'stl') {
      const stlResult = this.stlExporter.parse(wrapper, { binary: true });
      const buffer = (stlResult as any).buffer ? (stlResult as any).buffer : (stlResult as any);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const durationMs = Math.round(performance.now() - startTime);
      return {
        blob,
        url,
        originalSizeBytes: originalSize,
        compressedSizeBytes: blob.size,
        compressionRatio: originalSize > 0 ? Math.max(0, (originalSize - blob.size) / originalSize) : 0,
        durationMs,
      };
    }

    // 7. Texture optimization for GLB/GLTF
    if (settings.texture.resizeMax > 0) {
      await this.optimizeTextures(clonedScene, settings.texture.resizeMax, settings.texture.quality);
    }

    // 8. Build GLTF Exporter options
    const exporterOptions: any = {
      binary: settings.outputFormat === 'glb',
      embedImages: true,
      onlyVisible: true,
      truncateDrawRange: true,
    };

    // Configure Draco compression if enabled
    if (settings.draco.enabled) {
      try {
        (window as any).DRACOExporter = DRACOExporter;
        exporterOptions.dracoOptions = {
          compressionLevel: settings.draco.compressionLevel,
          method: 1, // Edgebreaker
          quantization: [
            settings.draco.quantizationPosition,
            settings.draco.quantizationNormal,
            settings.draco.quantizationTexcoord,
            settings.draco.quantizationColor,
            settings.draco.quantizationGeneric,
          ],
        };
      } catch (e) {
        console.warn('Draco exporter registration notice, continuing with standard GLB packing:', e);
      }
    }

    // 9. Perform GLB/GLTF export
    return new Promise<ModelExportResult>((resolve, reject) => {
      this.gltfExporter.parse(
        wrapper,
        (result) => {
          try {
            let blob: Blob;
            if (result instanceof ArrayBuffer) {
              blob = new Blob([result], { type: 'model/gltf-binary' });
            } else {
              const jsonString = JSON.stringify(result, null, 2);
              blob = new Blob([jsonString], { type: 'model/gltf+json' });
            }

            const url = URL.createObjectURL(blob);
            const compressedSizeBytes = blob.size;
            const savings = originalSize > 0 ? (originalSize - compressedSizeBytes) / originalSize : 0;
            const durationMs = Math.round(performance.now() - startTime);

            resolve({
              blob,
              url,
              originalSizeBytes: originalSize,
              compressedSizeBytes,
              compressionRatio: Math.max(0, savings),
              durationMs,
            });
          } catch (err) {
            reject(err);
          }
        },
        (error) => {
          console.error('GLTF Export error:', error);
          reject(new Error(error?.message || 'Failed to export model to GLB'));
        },
        exporterOptions
      );
    });
  }

  private async optimizeTextures(scene: THREE.Object3D, maxSize: number, quality: number): Promise<void> {
    const texturesToProcess = new Set<THREE.Texture>();

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const checkMap = (t?: THREE.Texture | null) => {
          if (t && t.image) texturesToProcess.add(t);
        };

        const processMat = (mat: THREE.Material) => {
          if ('map' in mat) checkMap((mat as any).map);
          if ('normalMap' in mat) checkMap((mat as any).normalMap);
          if ('roughnessMap' in mat) checkMap((mat as any).roughnessMap);
          if ('metalnessMap' in mat) checkMap((mat as any).metalnessMap);
          if ('emissiveMap' in mat) checkMap((mat as any).emissiveMap);
        };

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(processMat);
        } else if (mesh.material) {
          processMat(mesh.material);
        }
      }
    });

    for (const tex of texturesToProcess) {
      try {
        const img = tex.image;
        if (!img || !(img instanceof Image || img instanceof HTMLCanvasElement || img instanceof ImageBitmap)) continue;

        const canvas = document.createElement('canvas');
        let width = img.width || 512;
        let height = img.height || 512;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img as any, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const newImg = new Image();
          newImg.src = dataUrl;
          tex.image = newImg;
          tex.needsUpdate = true;
        }
      } catch {
        // Ignore canvas CORS texture processing failures
      }
    }
  }
}

export const modelExporter = new ModelExporterService();
