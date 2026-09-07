import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as WebGLTextureUtils from 'three/examples/jsm/utils/WebGLTextureUtils.js';
import JSZip from 'jszip';
import {
  ConversionResult,
  DracoCompressionConfig,
  ModelInspectionData,
  ModelTransformConfig,
  Saved3DModel,
  SubmeshInfo,
  SupportedModelFormat,
} from '../types';
import { modelLoader } from './modelLoader';
import { modelExporter } from './modelExporter';
import { modelNormalization } from './modelNormalization';
import { ModelStorage } from './modelStorage';
import { DRACOExporter } from 'three/examples/jsm/exporters/DRACOExporter.js';

export const DEFAULT_TRANSFORM_CONFIG: ModelTransformConfig = {
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  uniformScale: true,
  upAxis: 'y',
  centerOrigin: true,
  snapFloor: true,
  bakeTransforms: true,
};

export const DEFAULT_DRACO_CONFIG: DracoCompressionConfig = {
  enabled: true,
  compressionLevel: 7,
  positionQuantization: 14,
  normalQuantization: 10,
  uvQuantization: 10,
  colorQuantization: 8,
};

export class ModelConverterEngine {
  private static dracoLoader: DRACOLoader | null = null;

  public static getDRACOLoader(): DRACOLoader {
    if (!this.dracoLoader) {
      this.dracoLoader = new DRACOLoader();
      this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      this.dracoLoader.setDecoderConfig({ type: 'js' });
      this.dracoLoader.preload();
    }
    return this.dracoLoader;
  }

  /**
   * Determine file extension and format type
   */
  public static getFormatFromFilename(filename: string): SupportedModelFormat | 'zip' | 'unknown' {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'glb') return 'glb';
    if (ext === 'gltf') return 'gltf';
    if (ext === 'obj') return 'obj';
    if (ext === 'fbx') return 'fbx';
    if (ext === '3ds') return '3ds';
    if (ext === 'stl') return 'stl';
    if (ext === 'ply') return 'ply';
    if (ext === 'dae') return 'dae';
    if (ext === 'zip') return 'zip';
    return 'unknown';
  }

  /**
   * Universal 3D File Parser: Ingests single or multi-files (e.g. .zip, .obj + .mtl + textures, gltf + bin)
   */
  public static async parseFiles(
    files: FileList | File[]
  ): Promise<{ scene: THREE.Group; name: string; format: SupportedModelFormat; originalBytes: number }> {
    try {
      const loadRes = await modelLoader.loadFromFiles(files);
      const fmt = loadRes.metadata.format === 'unknown' ? 'glb' : (loadRes.metadata.format as SupportedModelFormat);
      return {
        scene: loadRes.scene,
        name: loadRes.metadata.name,
        format: fmt,
        originalBytes: loadRes.metadata.originalSize,
      };
    } catch (primaryErr) {
      console.warn('modelLoader fallback triggered:', primaryErr);
      let fileArray = Array.from(files);
      if (fileArray.length === 0) {
        throw new Error('No files provided.');
      }

      // 1. If any ZIP file is present, extract all contents into memory
      const zipFile = fileArray.find((f) => f.name.toLowerCase().endsWith('.zip'));
      if (zipFile) {
        try {
          const zip = await JSZip.loadAsync(zipFile);
          const extracted: File[] = [];
          const entries = Object.keys(zip.files);
          for (const entryName of entries) {
            const entry = zip.files[entryName];
            if (!entry.dir) {
              const blob = await entry.async('blob');
              const cleanFileName = entryName.split('/').pop() || entryName;
              extracted.push(new File([blob], cleanFileName, { type: blob.type }));
            }
          }
          if (extracted.length > 0) {
            fileArray = [...fileArray.filter((f) => f !== zipFile), ...extracted];
          }
        } catch (e: any) {
          console.warn('Failed to parse ZIP archive:', e);
        }
      }

      let totalBytes = 0;
      for (const f of fileArray) {
        totalBytes += f.size;
      }

      const primaryFile = fileArray.find((f) => {
        const fmt = this.getFormatFromFilename(f.name);
        return fmt !== 'unknown' && fmt !== 'zip';
      });

      if (!primaryFile) {
        throw new Error(
          'No supported 3D model file found (.glb, .gltf, .obj, .fbx, .3ds, .stl, .ply, .dae, .zip).'
        );
      }

      const format = this.getFormatFromFilename(primaryFile.name) as SupportedModelFormat;
      const baseName = primaryFile.name.replace(/\.[^/.]+$/, '');
      const blobUrls: Map<string, string> = new Map();
      for (const f of fileArray) {
        const url = URL.createObjectURL(f);
        const clean = f.name.toLowerCase();
        blobUrls.set(clean, url);
      }

      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => {
        const clean = url.split('/').pop()?.toLowerCase() || '';
        return blobUrls.get(clean) || url;
      });

      let loadedScene: THREE.Group = new THREE.Group();
      if (format === 'glb' || format === 'gltf') {
        const loader = new GLTFLoader(manager);
        loader.setDRACOLoader(this.getDRACOLoader());
        const primaryUrl = blobUrls.get(primaryFile.name.toLowerCase())!;
        const gltf = await loader.loadAsync(primaryUrl);
        loadedScene = gltf.scene || gltf.scenes[0];
      } else if (format === 'obj') {
        const objLoader = new OBJLoader(manager);
        const mtlFile = fileArray.find((f) => f.name.toLowerCase().endsWith('.mtl'));
        if (mtlFile) {
          try {
            const mtlLoader = new MTLLoader(manager);
            const mtlUrl = blobUrls.get(mtlFile.name.toLowerCase())!;
            const materials = await mtlLoader.loadAsync(mtlUrl);
            materials.preload();
            objLoader.setMaterials(materials);
          } catch (e) {
            console.warn('MTL loading failed:', e);
          }
        }
        const objUrl = blobUrls.get(primaryFile.name.toLowerCase())!;
        const obj = await objLoader.loadAsync(objUrl);
        loadedScene = obj as THREE.Group;
      } else {
        const fallbackGeom = new THREE.BoxGeometry(1, 1, 1);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
        loadedScene.add(new THREE.Mesh(fallbackGeom, fallbackMat));
      }

      return {
        scene: loadedScene,
        name: baseName,
        format,
        originalBytes: totalBytes,
      };
    }
  }

  /**
   * Internal format dispatcher
   */
  private static async loadByFormat(
    file: File,
    format: SupportedModelFormat,
    manager: THREE.LoadingManager,
    allFiles: File[],
    blobUrls: Map<string, string>
  ): Promise<THREE.Object3D> {
    switch (format) {
      case 'glb':
      case 'gltf': {
        const loader = new GLTFLoader(manager);
        loader.setDRACOLoader(this.getDRACOLoader());
        const buffer = await file.arrayBuffer();
        return new Promise((resolve, reject) => {
          loader.parse(
            buffer,
            '',
            (gltf) => {
              const obj = gltf.scene || gltf.scenes[0];
              this.normalizeMeshMaterials(obj);
              resolve(obj);
            },
            reject
          );
        });
      }

      case 'obj': {
        // Check for accompanying MTL file
        const mtlFile = allFiles.find((f) => f.name.toLowerCase().endsWith('.mtl'));
        if (mtlFile) {
          const mtlText = await mtlFile.text();
          const mtlLoader = new MTLLoader(manager);
          const materials = mtlLoader.parse(mtlText, '');
          materials.preload();

          const objLoader = new OBJLoader(manager);
          objLoader.setMaterials(materials);
          const objText = await file.text();
          const obj = objLoader.parse(objText);
          this.normalizeMeshMaterials(obj);
          return obj;
        } else {
          const objLoader = new OBJLoader(manager);
          const text = await file.text();
          const obj = objLoader.parse(text);
          this.normalizeMeshMaterials(obj);
          return obj;
        }
      }

      case 'fbx': {
        const loader = new FBXLoader(manager);
        const buffer = await file.arrayBuffer();
        const obj = loader.parse(buffer, '');
        this.normalizeMeshMaterials(obj);
        return obj;
      }

      case '3ds': {
        const loader = new TDSLoader(manager);
        const buffer = await file.arrayBuffer();
        const obj = loader.parse(buffer, '');
        this.normalizeMeshMaterials(obj);
        return obj;
      }

      case 'stl': {
        const loader = new STLLoader(manager);
        const buffer = await file.arrayBuffer();
        const geometry = loader.parse(buffer);
        geometry.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.45,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.name = file.name.replace(/\.stl$/i, '');
        return mesh;
      }

      case 'ply': {
        const loader = new PLYLoader(manager);
        const buffer = await file.arrayBuffer();
        const geometry = loader.parse(buffer);
        geometry.computeVertexNormals();
        const hasColors = !!geometry.attributes.color;
        const mat = new THREE.MeshStandardMaterial({
          color: hasColors ? 0xffffff : 0x94a3b8,
          vertexColors: hasColors,
          roughness: 0.45,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.name = file.name.replace(/\.ply$/i, '');
        return mesh;
      }

      case 'dae': {
        const loader = new ColladaLoader(manager);
        const text = await file.text();
        return new Promise((resolve, reject) => {
          try {
            const collada = loader.parse(text, '');
            const obj = collada.scene;
            this.normalizeMeshMaterials(obj);
            resolve(obj);
          } catch (e) {
            reject(e);
          }
        });
      }

      default:
        throw new Error(`Unsupported 3D format: ${format}`);
    }
  }

  /**
   * Fix standard material encodings, double-siding, PBR metalness, and alpha cutout
   */
  public static normalizeMeshMaterials(
    root: THREE.Object3D,
    options: {
      fixAlpha?: boolean;
      brightenMetals?: boolean;
      doubleSided?: boolean;
    } = { fixAlpha: true, brightenMetals: true, doubleSided: true }
  ): void {
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const handleMat = (mat: any) => {
          if (!mat) return;
          if (options.doubleSided !== false) {
            mat.side = THREE.DoubleSide;
            mat.shadowSide = THREE.DoubleSide;
          }
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            // CRITICAL FIX: If material has a diffuse texture map but color is 0x000000,
            // Three.js multiplies texture * color = pitch black! Reset color to pure white 0xffffff!
            if (mat.color && mat.color.getHex() === 0x000000) {
              mat.color.setHex(0xffffff);
            }
          }
          if (mat.emissiveMap) {
            mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          }
          if (child.geometry?.attributes?.color) {
            mat.vertexColors = true;
          }

          // CRITICAL FIX: Alpha Transparency & Cutout
          // Fix transparent cards / white boxes around hair, candy, stars, clouds, decals
          if (
            options.fixAlpha !== false &&
            (mat.transparent || (mat.opacity !== undefined && mat.opacity < 0.999) || mat.map)
          ) {
            if (mat.alphaTest === 0 || mat.alphaTest === undefined) {
              mat.alphaTest = 0.05;
            }
            mat.depthWrite = true;
          }

          // CRITICAL FIX: PBR Metalness & Roughness brightening
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            if (options.brightenMetals !== false) {
              if (mat.metalness > 0.4 && !mat.metalnessMap) {
                mat.metalness = 0.08;
              }
              if (mat.roughness === undefined || mat.roughness < 0.1) {
                mat.roughness = 0.45;
              }
              // If base color is dark with texture, reset to white
              if (mat.map && mat.color && (mat.color.r < 0.6 || mat.color.g < 0.6 || mat.color.b < 0.6)) {
                mat.color.setHex(0xffffff);
              } else if (!mat.map && !mat.vertexColors && mat.color && (mat.color.r < 0.25 && mat.color.g < 0.25 && mat.color.b < 0.25)) {
                mat.color.setHex(0xd8dee9);
              }
            }
          } else {
            // Upgrade basic/phong/lambert to standard PBR material
            const hasTex = !!mat.map;
            const rawColor = mat.color ? mat.color.getHex() : 0xd8dee9;
            const safeColor = hasTex ? 0xffffff : (rawColor === 0x000000 ? 0xd8dee9 : rawColor);
            const newMat = new THREE.MeshStandardMaterial({
              color: safeColor,
              map: mat.map || null,
              roughness: 0.45,
              metalness: 0.08,
              side: options.doubleSided !== false ? THREE.DoubleSide : THREE.FrontSide,
              vertexColors: !!child.geometry?.attributes?.color,
              transparent: mat.transparent || (mat.opacity !== undefined && mat.opacity < 0.999),
              opacity: mat.opacity !== undefined ? mat.opacity : 1.0,
              alphaTest: mat.alphaTest || 0.05,
              depthWrite: true,
            });
            child.material = newMat;
          }

          mat.needsUpdate = true;
        };

        if (Array.isArray(child.material)) {
          child.material.forEach(handleMat);
        } else if (child.material) {
          handleMat(child.material);
        } else {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.45,
            metalness: 0.1,
            side: THREE.DoubleSide,
          });
        }
      }
    });
  }

  /**
   * Inspect scene geometry metrics, triangles, vertex counts, materials, and bounding box dimensions in meters
   */
  public static inspect(
    object: THREE.Object3D,
    name: string,
    format: string,
    originalBytes: number
  ): ModelInspectionData {
    let triangleCount = 0;
    let vertexCount = 0;
    let meshCount = 0;
    const materialSet = new Set<string>();
    const submeshes: SubmeshInfo[] = [];

    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        meshCount++;
        const geom = child.geometry;
        const verts = geom.attributes.position ? geom.attributes.position.count : 0;
        const tris = geom.index
          ? geom.index.count / 3
          : geom.attributes.position
          ? geom.attributes.position.count / 3
          : 0;

        vertexCount += verts;
        triangleCount += tris;

        let matName = 'Default Material';
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => materialSet.add(m.name || m.uuid));
          matName = child.material.map((m) => m.name || 'Material').join(', ');
        } else if (child.material) {
          materialSet.add(child.material.name || child.material.uuid);
          matName = child.material.name || 'Standard Material';
        }

        submeshes.push({
          id: child.uuid,
          name: child.name || `Mesh_${meshCount}`,
          triangles: Math.round(tris),
          vertices: verts,
          materialName: matName,
          visible: child.visible,
        });
      }
    });

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    return {
      name,
      format,
      originalBytes,
      triangleCount: Math.round(triangleCount),
      vertexCount: Math.round(vertexCount),
      meshCount,
      materialCount: materialSet.size || 1,
      dimensions: {
        x: Number(size.x.toFixed(3)),
        y: Number(size.y.toFixed(3)),
        z: Number(size.z.toFixed(3)),
      },
      submeshes,
    };
  }

  /**
   * Apply user transformation configuration (Up-Axis, 3-Axis Rotation, Scale, Origin, Floor Snap, Baking)
   * Uses safe deep-cloning of geometries to avoid mutating the original source object.
   */
  public static applyTransforms(
    sourceObject: THREE.Object3D,
    config: ModelTransformConfig,
    isFinalBake = false
  ): THREE.Group {
    const container = new THREE.Group();
    // Deep clone scene AND geometries to ensure sourceObject is never mutated
    const cloned = sourceObject.clone(true);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.geometry = child.geometry.clone();
      }
    });
    container.add(cloned);

    // 1. Up-Axis compensation
    if (config.upAxis === 'z') {
      cloned.rotation.x = -Math.PI / 2;
    } else {
      cloned.rotation.x = 0;
    }

    // 2. Custom 3-axis rotation (degrees to radians)
    cloned.rotation.x += THREE.MathUtils.degToRad(config.rotation.x);
    cloned.rotation.y += THREE.MathUtils.degToRad(config.rotation.y);
    cloned.rotation.z += THREE.MathUtils.degToRad(config.rotation.z);

    // 3. Scaling
    if (config.uniformScale) {
      cloned.scale.setScalar(config.scale.x);
    } else {
      cloned.scale.set(config.scale.x, config.scale.y, config.scale.z);
    }

    cloned.updateMatrixWorld(true);

    // 4. Center to origin (0, 0, 0)
    if (config.centerOrigin) {
      const box = new THREE.Box3().setFromObject(cloned);
      const center = new THREE.Vector3();
      box.getCenter(center);
      cloned.position.sub(center);
      cloned.updateMatrixWorld(true);
    }

    // 5. Snap to floor (Y = 0)
    if (config.snapFloor) {
      const box = new THREE.Box3().setFromObject(cloned);
      cloned.position.y -= box.min.y;
      cloned.updateMatrixWorld(true);
    }

    // 6. Direct Geometry Baking only if explicitly requested for final export/save
    if (isFinalBake && config.bakeTransforms) {
      this.bakeGeometryMatrices(cloned);
    }

    return container;
  }

  /**
   * Direct Geometry Baking: Bakes all matrix transformations down into the mesh vertex buffers
   */
  public static bakeGeometryMatrices(object: THREE.Object3D): void {
    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.geometry.applyMatrix4(child.matrixWorld);
        child.position.set(0, 0, 0);
        child.rotation.set(0, 0, 0);
        child.scale.set(1, 1, 1);
        child.updateMatrix();
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
      }
    });
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    object.updateMatrixWorld(true);
  }

  /**
   * Fit Model to Target Height/Dimension in Meters (Default: 2.0m)
   */
  public static fitToTarget(object: THREE.Object3D, targetMeters = 2.0): number {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
    const factor = targetMeters / maxDim;
    return Number(factor.toFixed(5));
  }

  /**
   * Fit Model to 1 Meter Bounding Box
   */
  public static fitTo1Meter(object: THREE.Object3D): number {
    return this.fitToTarget(object, 1.0);
  }

  /**
   * Auto-detect if raw dimensions are exported in mm, cm, or inches
   */
  public static detectUnitScale(object: THREE.Object3D): { scale: number; unitName: string } {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);

    if (maxDim > 300) {
      // Millimeters (e.g. 1712mm -> 1.712m)
      return { scale: 0.001, unitName: 'Millimeters (mm → m, 0.001x)' };
    }
    if (maxDim > 25) {
      // Centimeters (e.g. 170cm -> 1.7m)
      return { scale: 0.01, unitName: 'Centimeters (cm → m, 0.01x)' };
    }
    if (maxDim < 0.08) {
      // Very small / micro model (e.g. 0.02m -> magnify)
      const factor = Number((2.0 / maxDim).toFixed(4));
      return { scale: factor, unitName: `Magnify to 2m (${factor}x)` };
    }
    return { scale: 1.0, unitName: 'Standard Meters (1x)' };
  }

  /**
   * Auto-detect if model is lying on its back (Z-up height)
   */
  public static autoDetectOrientation(
    object: THREE.Object3D
  ): { rotation: { x: number; y: number; z: number }; upAxis: 'y' | 'z'; description: string } {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    if (size.z > size.y * 1.8 && size.z > size.x * 1.2) {
      return { rotation: { x: 90, y: 0, z: 0 }, upAxis: 'y', description: 'Stand Up (+90° X)' };
    }
    return { rotation: { x: 0, y: 0, z: 0 }, upAxis: 'y', description: 'Standard Y-Up' };
  }

  /**
   * Compress and Export to GLB container with Draco Compression / Binary Quantization
   */
  public static async exportToGLB(
    object: THREE.Object3D,
    dracoConfig: DracoCompressionConfig = DEFAULT_DRACO_CONFIG
  ): Promise<{ blob: Blob; arrayBuffer: ArrayBuffer }> {
    try {
      (window as any).DRACOExporter = DRACOExporter;
      const transformSettings = {
        scale: { uniform: true, x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 },
        centerOrigin: false,
        groundToFloor: false,
        upAxis: 'Y' as const,
        simpleGrayMode: false,
        materialOverrideEnabled: false,
        customBaseColor: '#808080',
        invertedNormals: false,
      };
      const exportSettings = {
        bakeTransforms: false,
        draco: {
          enabled: dracoConfig.enabled,
          compressionLevel: dracoConfig.compressionLevel,
          quantizationPosition: dracoConfig.positionQuantization,
          quantizationNormal: dracoConfig.normalQuantization,
          quantizationTexcoord: dracoConfig.uvQuantization,
          quantizationColor: dracoConfig.colorQuantization,
          quantizationGeneric: 8,
        },
        texture: {
          resizeMax: 2048 as const,
          quality: 0.85,
          convertToWebP: false,
        },
        removeUnusedMaterials: true,
        outputFormat: 'glb' as const,
        filename: 'model.glb',
      };
      const res = await modelExporter.exportModel(object, transformSettings, exportSettings, 0);
      const arrayBuffer = await res.blob.arrayBuffer();
      return { blob: res.blob, arrayBuffer };
    } catch {
      const exporter = new GLTFExporter();
      // Same reason as ModelExporterService: without this, compressed textures
      // abort the export and the save looks like a no-op.
      try {
        (exporter as any).setTextureUtils?.(WebGLTextureUtils);
      } catch {}
      const options: any = {
        binary: true,
        onlyVisible: true,
        truncateDrawRange: true,
        embedImages: true,
        animations: [],
      };

      return new Promise((resolve, reject) => {
        exporter.parse(
          object,
          (result: any) => {
            if (result instanceof ArrayBuffer) {
              const blob = new Blob([result], { type: 'model/gltf-binary' });
              resolve({ blob, arrayBuffer: result });
            } else {
              const json = JSON.stringify(result, null, 2);
              const blob = new Blob([json], { type: 'model/gltf+json' });
              const reader = new FileReader();
              reader.onload = () => {
                resolve({
                  blob,
                  arrayBuffer: reader.result as ArrayBuffer,
                });
              };
              reader.onerror = reject;
              reader.readAsArrayBuffer(blob);
            }
          },
          (error) => reject(error),
          options
        );
      });
    }
  }

  /**
   * Render a clean offscreen 2D thumbnail preview of the 3D model
   */
  public static async generateThumbnail(
    object: THREE.Object3D,
    width = 256,
    height = 256
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 10000);

    // Studio Lighting
    const amb = new THREE.AmbientLight(0xffffff, 1.4);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x475569, 1.2);
    const dir1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dir1.position.set(3, 4, 3);
    const dir2 = new THREE.DirectionalLight(0x90cdf4, 1.0);
    dir2.position.set(-3, -2, -3);

    scene.add(amb, hemi, dir1, dir2);

    const previewModel = object.clone(true);
    scene.add(previewModel);

    // Frame camera comfortably
    const box = new THREE.Box3().setFromObject(previewModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    cameraZ = Math.max(cameraZ, 2);

    camera.position.set(center.x + cameraZ * 0.7, center.y + cameraZ * 0.5, center.z + cameraZ * 0.7);
    camera.lookAt(center);

    renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL('image/png');

    renderer.dispose();
    return dataUrl;
  }

  /**
   * 1-Click High-Speed Automatic Conversion & Storage Pipeline
   */
  public static async autoConvertAndSave(
    files: FileList | File[],
    customName?: string,
    transformConfig?: Partial<ModelTransformConfig>,
    dracoConfig?: Partial<DracoCompressionConfig>
  ): Promise<ConversionResult> {
    const startTime = performance.now();

    // 1. Universal Parse
    const { scene, name, format, originalBytes } = await this.parseFiles(files);
    const finalName = customName?.trim() || name || 'Converted_Model';

    // 2. Auto-detect unit scale & orientation if not provided
    const rawBox = new THREE.Box3().setFromObject(scene);
    const rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);
    const maxRawDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);

    let initialScale = 1.0;
    if (!transformConfig?.scale) {
      if (maxRawDim > 4.0 || maxRawDim < 0.15) {
        initialScale = this.fitToTarget(scene, 2.0);
      }
    }

    // 3. Configure transforms
    const fullTransform: ModelTransformConfig = {
      ...DEFAULT_TRANSFORM_CONFIG,
      scale: { x: initialScale, y: initialScale, z: initialScale },
      ...transformConfig,
    };

    // 4. Apply Transformations & Final Baking
    const transformed = this.applyTransforms(scene, fullTransform, true);

    // 5. Inspect Model
    const inspection = this.inspect(transformed, finalName, format, originalBytes);

    // 6. Compress & Export to lightweight GLB
    const fullDraco: DracoCompressionConfig = {
      ...DEFAULT_DRACO_CONFIG,
      ...dracoConfig,
    };
    const { blob, arrayBuffer } = await this.exportToGLB(transformed, fullDraco);

    // 7. Generate crisp thumbnail
    const thumbnail = await this.generateThumbnail(transformed);

    const convertedBytes = arrayBuffer.byteLength;
    const durationMs = Math.round(performance.now() - startTime);
    const reductionPercentage =
      originalBytes > 0
        ? Math.max(0, Number((((originalBytes - convertedBytes) / originalBytes) * 100).toFixed(1)))
        : 0;

    const id = `model_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const savedModel: Saved3DModel = {
      id,
      name: finalName,
      originalName: name,
      originalFormat: format,
      originalSize: originalBytes,
      compressedSize: convertedBytes,
      savedDate: Date.now(),
      thumbnail,
      blob: arrayBuffer,
      triangleCount: inspection.triangleCount,
      vertexCount: inspection.vertexCount,
      meshCount: inspection.meshCount,
      materialCount: inspection.materialCount,
      dimensions: inspection.dimensions,
      dracoCompressed: fullDraco.enabled,
      isBaked: fullTransform.bakeTransforms,
      quantizationBits: {
        position: fullDraco.positionQuantization,
        normal: fullDraco.normalQuantization,
        uv: fullDraco.uvQuantization,
      },
    };

    // 8. Save into In-App IndexedDB local storage
    await ModelStorage.saveModel(savedModel);

    return {
      id,
      name: finalName,
      originalBytes,
      convertedBytes,
      reductionPercentage,
      durationMs,
      glbBlob: blob,
      glbArrayBuffer: arrayBuffer,
      thumbnail,
      inspection,
      savedModel,
    };
  }
}

