import * as THREE from 'three';
import JSZip from 'jszip';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { modelNormalization } from './modelNormalization';
import { MaterialCache } from './materialCache';
import { resolveAssetUrl } from '../utils/assetUrl';
import { getQualityProfile } from '../utils/deviceProfile';

export type LoadingTier = 'tier1_full' | 'tier2_safe_geom' | 'tier3_raw_recovery' | 'tier4_point_cloud';

export interface IntegrityWarning {
  id: string;
  type: 'warning' | 'info' | 'error';
  title: string;
  message: string;
  count?: number;
}

export interface DeepModelMetadata {
  name: string;
  originalSize: number;
  format: 'glb' | 'gltf' | 'obj' | 'fbx' | 'stl' | 'ply' | '3mf' | '3ds' | 'dae' | 'zip' | 'unknown';
  triangles: number;
  vertices: number;
  meshes: number;
  materials: number;
  textures: number;
  drawCalls: number;
  textureMemoryMB: number;
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
  fileCount: number;
  hasVertexColors?: boolean;
  hasTextures?: boolean;
  loadingTier: LoadingTier;
  loadingTierName: string;
  integrityWarnings: IntegrityWarning[];
  isExtremeScale: boolean;
  isPointFallback?: boolean;
}

export interface LoadResult {
  scene: THREE.Group;
  metadata: DeepModelMetadata;
  cleanedBlobUrls: () => void;
}

export class ModelLoaderService {
  private dracoLoader: DRACOLoader;
  private ktx2Loader: KTX2Loader | null = null;
  private gltfLoader: GLTFLoader;
  private objLoader: OBJLoader;
  private fbxLoader: FBXLoader;
  private stlLoader: STLLoader;
  private plyLoader: PLYLoader;
  private threeMFLoader: ThreeMFLoader;
  private tdsLoader: TDSLoader;
  private colladaLoader: ColladaLoader;

  constructor() {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(resolveAssetUrl('draco/'));
    this.dracoLoader.setDecoderConfig({ type: 'wasm' });
    this.dracoLoader.preload();

    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    if (MeshoptDecoder) {
      this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    }

    /**
     * KTX2 / Basis Universal textures.
     *
     * Without this, any GLB carrying compressed textures threw
     * "setKTX2Loader must be called before loading KTX2 textures" out of Tier 1
     * AND Tier 2, Tier 3 then died on an allocation error, and the file landed
     * in the Tier 4 point-cloud fallback — which is why an otherwise healthy
     * model imported as 0 meshes and 0 triangles. Nothing was corrupt; the
     * pipeline simply could not read that compression.
     *
     * The transcoder ships inside the three package we already depend on; it is
     * copied to public/basis/ at no cost in new dependencies.
     */
    try {
      const ktx2 = new KTX2Loader();
      ktx2.setTranscoderPath(resolveAssetUrl('basis/'));
      // detectSupport needs a renderer to ask which GPU formats are available.
      // A throwaway one is enough, and it is disposed immediately.
      const probe = new THREE.WebGLRenderer();
      ktx2.detectSupport(probe);
      probe.dispose();
      this.ktx2Loader = ktx2;
      this.gltfLoader.setKTX2Loader(ktx2);
    } catch (err) {
      // No WebGL context available (headless, or a lost context). Compressed
      // textures will still fail, but everything else must keep working.
      console.warn('[ModelLoader] KTX2 support unavailable:', err);
      this.ktx2Loader = null;
    }

    this.objLoader = new OBJLoader();
    this.fbxLoader = new FBXLoader();
    this.stlLoader = new STLLoader();
    this.plyLoader = new PLYLoader();
    this.threeMFLoader = new ThreeMFLoader();
    this.tdsLoader = new TDSLoader();
    this.colladaLoader = new ColladaLoader();
  }

  /**
   * Main entry point: Loads 3D assets from dropped/uploaded files or ZIP bundles
   * using the progressive 4-Tier Safe Load Fallback Pipeline.
   */
  public async loadFromFiles(files: FileList | File[]): Promise<LoadResult> {
    const fileArray = Array.from(files);
    if (!fileArray || fileArray.length === 0) {
      throw new Error('No files provided');
    }

    const createdBlobUrls: string[] = [];
    const fileMap = new Map<string, { file: File; blobUrl: string }>();

    // 1. Process files and detect if any file is a ZIP archive or 3MF bundle
    let allFiles: File[] = [];
    for (const f of fileArray) {
      const magic = await this.detectMagicBytes(f);
      if (magic === 'zip') {
        const extracted = await this.unpackZipArchive(f);
        allFiles.push(...extracted);
      } else {
        allFiles.push(f);
      }
    }

    if (allFiles.length === 0) {
      allFiles = fileArray;
    }

    // 2. Build in-memory URL map for texture and buffer resolution
    for (const file of allFiles) {
      const url = URL.createObjectURL(file);
      createdBlobUrls.push(url);
      const cleanName = file.name.replace(/^.*[\\/]/, '');
      fileMap.set(cleanName.toLowerCase(), { file, blobUrl: url });
      fileMap.set(cleanName, { file, blobUrl: url });
      fileMap.set(file.name.toLowerCase(), { file, blobUrl: url });
    }

    const primaryFile = this.findPrimaryFile(allFiles);
    const totalOriginalSize = allFiles.reduce((acc, f) => acc + f.size, 0);
    const detectedFormat = this.determineFormat(primaryFile);

    const cleanupUrls = () => {
      setTimeout(() => {
        for (const url of createdBlobUrls) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // Ignore revoked errors
          }
        }
      }, 30000);
    };

    const warnings: IntegrityWarning[] = [];

    // 3. Execute Progressive 4-Tier Fallback Pipeline
    let loadedObject: THREE.Object3D | null = null;
    let tierUsed: LoadingTier = 'tier1_full';
    let tierName = 'Tier 1: Full Feature Loader';

    // --- TIER 1: Standard Full Feature Loader ---
    try {
      loadedObject = await this.executeTier1Load(primaryFile, allFiles, fileMap);
      tierUsed = 'tier1_full';
      tierName = 'Tier 1: Full Feature Loader (Textures, PBR & Materials)';
    } catch (tier1Error: any) {
      console.warn('Tier 1 Load Failed, falling back to Tier 2:', tier1Error);
      warnings.push({
        id: 'tier1_fail',
        type: 'warning',
        title: 'Material / Texture Parsing Issue Trapped',
        message: `Standard parsing failed (${tier1Error.message || 'Unknown error'}). Activated Safe Geometry recovery.`,
      });

      // --- TIER 2: Safe Geometry Loader (Strip custom shaders/textures) ---
      try {
        loadedObject = await this.executeTier2SafeLoad(primaryFile, allFiles, fileMap);
        tierUsed = 'tier2_safe_geom';
        tierName = 'Tier 2: Safe Geometry Recovery (Stripped corrupted shaders)';
      } catch (tier2Error: any) {
        console.warn('Tier 2 Load Failed, falling back to Tier 3:', tier2Error);
        warnings.push({
          id: 'tier2_fail',
          type: 'warning',
          title: 'Index Buffer / Face Definition Error',
          message: `Safe geometry parser failed (${tier2Error.message || 'Corrupt topology'}). Recovering raw coordinate buffers.`,
        });

        // --- TIER 3: Raw Vertex Coordinate Data Recovery ---
        try {
          loadedObject = await this.executeTier3VertexRecovery(primaryFile, allFiles);
          tierUsed = 'tier3_raw_recovery';
          tierName = 'Tier 3: Raw Vertex Recovery (Sanitized float coordinates & rebuilt normals)';
        } catch (tier3Error: any) {
          console.warn('Tier 3 Load Failed, falling back to Tier 4:', tier3Error);
          warnings.push({
            id: 'tier3_fail',
            type: 'error',
            title: 'Polygon Topology Unreconstructible',
            message: 'Surface face data was corrupted. Constructed Point Cloud representation.',
          });

          // --- TIER 4: Point Cloud Fallback ---
          loadedObject = await this.executeTier4PointCloudFallback(primaryFile);
          tierUsed = 'tier4_point_cloud';
          tierName = 'Tier 4: Point Cloud Fallback (Preserved geometry point cloud)';
        }
      }
    }

    if (!loadedObject) {
      cleanupUrls();
      throw new Error(`Unable to reconstruct 3D asset from ${primaryFile.name}`);
    }

    // 4. Sanitize and enhance geometry & materials
    this.sanitizeLoadedHierarchy(loadedObject, warnings);

    const rootGroup = new THREE.Group();
    rootGroup.name = primaryFile.name.replace(/\.[^/.]+$/, '');
    rootGroup.add(loadedObject);

    // 5. Compute Deep Statistics & Diagnostic Metadata
    const metadata = this.calculateDeepMetadata(
      rootGroup,
      primaryFile.name,
      totalOriginalSize,
      detectedFormat,
      allFiles.length,
      tierUsed,
      tierName,
      warnings
    );

    return {
      scene: rootGroup,
      metadata,
      cleanedBlobUrls: cleanupUrls,
    };
  }

  /**
   * Loads model from direct URL or buffer
   */
  public async loadFromUrl(url: string, name: string): Promise<LoadResult> {
    const resolvedUrl = resolveAssetUrl(url);
    const res = await fetch(resolvedUrl);
    if (!res.ok) throw new Error(`HTTP error ${res.status} fetching 3D model from ${resolvedUrl}`);
    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error(`Empty model file (0 bytes) received from ${resolvedUrl}`);
    }
    const file = new File([blob], name, { type: blob.type || 'model/gltf-binary' });
    return this.loadFromFiles([file]);
  }

  public async loadFromArrayBuffer(buffer: ArrayBuffer, name: string): Promise<LoadResult> {
    if (buffer.byteLength === 0) {
      throw new Error('Empty array buffer provided');
    }
    const blob = new Blob([buffer], { type: 'model/gltf-binary' });
    const file = new File([blob], name, { type: 'model/gltf-binary' });
    return this.loadFromFiles([file]);
  }

  // ==========================================
  // TIER LOADERS IMPLEMENTATION
  // ==========================================

  private async executeTier1Load(
    mainFile: File,
    allFiles: File[],
    fileMap: Map<string, { file: File; blobUrl: string }>
  ): Promise<THREE.Object3D> {
    const format = this.determineFormat(mainFile);

    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      const cleanUrl = url.replace(/^.*[\\/]/, '');
      const match = fileMap.get(cleanUrl.toLowerCase()) || fileMap.get(cleanUrl) || fileMap.get(url);
      return match ? match.blobUrl : url;
    });

    if (format === 'glb') {
      const buffer = await mainFile.arrayBuffer();
      const gltf = await this.gltfLoader.parseAsync(buffer, '');
      return gltf.scene || gltf.scenes[0];
    }

    if (format === 'gltf') {
      const text = await mainFile.text();
      const customGltfLoader = new GLTFLoader(manager);
      customGltfLoader.setDRACOLoader(this.dracoLoader);
      if (MeshoptDecoder) customGltfLoader.setMeshoptDecoder(MeshoptDecoder);
      if (this.ktx2Loader) customGltfLoader.setKTX2Loader(this.ktx2Loader);
      const gltf = await customGltfLoader.parseAsync(text, '');
      return gltf.scene || gltf.scenes[0];
    }

    if (format === 'obj') {
      const mtlFile = allFiles.find((f) => f.name.toLowerCase().endsWith('.mtl'));
      if (mtlFile) {
        try {
          const mtlText = await mtlFile.text();
          const mtlLoader = new MTLLoader(manager);
          const materials = mtlLoader.parse(mtlText, '');
          materials.preload();
          this.objLoader.setMaterials(materials);
        } catch {
          this.objLoader.materials = null;
        }
      } else {
        this.objLoader.materials = null;
      }
      const objText = await mainFile.text();
      return this.objLoader.parse(objText);
    }

    if (format === 'fbx') {
      const buffer = await mainFile.arrayBuffer();
      return this.fbxLoader.parse(buffer, '');
    }

    if (format === 'stl') {
      const buffer = await mainFile.arrayBuffer();
      const geometry = this.stlLoader.parse(buffer);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.45,
        metalness: 0.15,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(geometry, mat);
    }

    if (format === 'ply') {
      const buffer = await mainFile.arrayBuffer();
      const geometry = this.plyLoader.parse(buffer);
      const hasColors = !!geometry.attributes.color;
      const mat = new THREE.MeshStandardMaterial({
        color: hasColors ? 0xffffff : 0x94a3b8,
        vertexColors: hasColors,
        roughness: 0.45,
        metalness: 0.15,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(geometry, mat);
    }

    if (format === '3mf') {
      const buffer = await mainFile.arrayBuffer();
      return this.threeMFLoader.parse(buffer);
    }

    if (format === '3ds') {
      const buffer = await mainFile.arrayBuffer();
      return this.tdsLoader.parse(buffer, '');
    }

    if (format === 'dae') {
      const text = await mainFile.text();
      const collada = this.colladaLoader.parse(text, '');
      return collada.scene;
    }

    // Attempt generic text or binary GLTF parse as fallback
    const buffer = await mainFile.arrayBuffer();
    const gltf = await this.gltfLoader.parseAsync(buffer, '');
    return gltf.scene || gltf.scenes[0];
  }

  private async executeTier2SafeLoad(
    mainFile: File,
    allFiles: File[],
    fileMap: Map<string, { file: File; blobUrl: string }>
  ): Promise<THREE.Object3D> {
    const rawObj = await this.executeTier1Load(mainFile, allFiles, fileMap);

    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    rawObj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = fallbackMat.clone();
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences = [];
        }
      }
    });

    return rawObj;
  }

  private async executeTier3VertexRecovery(mainFile: File, allFiles: File[]): Promise<THREE.Object3D> {
    const format = this.determineFormat(mainFile);
    let positions: number[] = [];

    if (format === 'obj' || mainFile.name.endsWith('.txt')) {
      const text = await mainFile.text();
      const lines = text.split('\n');
      const rawVerts: number[][] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('v ')) {
          const parts = trimmed.split(/\s+/).slice(1).map(Number);
          if (parts.length >= 3 && !parts.some(isNaN)) {
            rawVerts.push([parts[0], parts[1], parts[2]]);
          }
        } else if (trimmed.startsWith('f ')) {
          const parts = trimmed.split(/\s+/).slice(1);
          const faceIndices: number[] = [];
          for (const p of parts) {
            const idx = parseInt(p.split('/')[0], 10);
            if (!isNaN(idx)) {
              faceIndices.push(idx > 0 ? idx - 1 : rawVerts.length + idx);
            }
          }
          for (let i = 1; i < faceIndices.length - 1; i++) {
            const v0 = rawVerts[faceIndices[0]];
            const v1 = rawVerts[faceIndices[i]];
            const v2 = rawVerts[faceIndices[i + 1]];
            if (v0 && v1 && v2) {
              positions.push(...v0, ...v1, ...v2);
            }
          }
        }
      }
    }

    if (positions.length >= 9) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.5,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(geom, mat);
    }

    const buffer = await mainFile.arrayBuffer();
    const stlGeom = this.stlLoader.parse(buffer);
    if (stlGeom.attributes.position && stlGeom.attributes.position.count > 0) {
      return new THREE.Mesh(
        stlGeom,
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide })
      );
    }

    throw new Error('Raw vertex reconstruction could not assemble triangular faces');
  }

  private async executeTier4PointCloudFallback(mainFile: File): Promise<THREE.Object3D> {
    const format = this.determineFormat(mainFile);
    const positions: number[] = [];

    if (format === 'obj' || mainFile.name.endsWith('.txt')) {
      const text = await mainFile.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('v ')) {
          const parts = trimmed.split(/\s+/).slice(1).map(Number);
          if (parts.length >= 3 && !parts.some((n) => isNaN(n) || !isFinite(n))) {
            positions.push(parts[0], parts[1], parts[2]);
          }
        }
      }
    }

    if (positions.length < 3) {
      positions.push(
        -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
        -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5, 0.5,  0.5, -0.5, 0.5,  0.5
      );
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    const pointsMat = new THREE.PointsMaterial({
      color: 0x6366f1,
      size: 0.03,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geom, pointsMat);
    points.name = 'RecoveredPointCloud';
    return points;
  }

  private async detectMagicBytes(file: File): Promise<'glb' | 'zip' | 'fbx' | 'ply' | 'unknown'> {
    try {
      const slice = await file.slice(0, 16).arrayBuffer();
      const bytes = new Uint8Array(slice);
      const text = new TextDecoder('ascii').decode(bytes);

      if (text.startsWith('glTF') || (bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46)) {
        return 'glb';
      }
      if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
        return 'zip';
      }
      if (text.includes('Kaydara')) {
        return 'fbx';
      }
      if (text.startsWith('ply')) {
        return 'ply';
      }
    } catch {
      // Ignore read errors
    }
    return 'unknown';
  }

  private async unpackZipArchive(zipFile: File): Promise<File[]> {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(zipFile);
    const extractedFiles: File[] = [];

    for (const [relativePath, entry] of Object.entries(zipData.files)) {
      if (entry.dir) continue;
      if (relativePath.includes('__MACOSX') || relativePath.endsWith('.DS_Store')) continue;

      const blob = await entry.async('blob');
      const filename = relativePath.replace(/^.*[\\/]/, '');
      const extractedFile = new File([blob], filename, { type: blob.type });
      extractedFiles.push(extractedFile);
    }

    return extractedFiles;
  }

  private findPrimaryFile(files: File[]): File {
    const priorityFormats = ['glb', 'gltf', 'obj', 'fbx', '3mf', 'stl', 'ply', '3ds', 'dae'];
    for (const ext of priorityFormats) {
      const found = files.find((f) => this.determineFormat(f) === ext);
      if (found) return found;
    }
    return files[0];
  }

  public determineFormat(file: File): DeepModelMetadata['format'] {
    const ext = file.name.slice(((file.name.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
    if (ext === 'glb' || ext === 'gltf' || ext === 'obj' || ext === 'fbx' || ext === 'stl' || ext === 'ply' || ext === '3mf' || ext === '3ds' || ext === 'dae' || ext === 'zip') {
      return ext as DeepModelMetadata['format'];
    }
    return 'unknown';
  }

  private sanitizeLoadedHierarchy(root: THREE.Object3D, warnings: IntegrityWarning[]): void {
    let degenerateTriangleCount = 0;
    let nanCoordinateCount = 0;

    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.Points).isPoints) {
        const mesh = child as THREE.Mesh;
        // Shadow flags follow the device profile: on low-power hardware the extra
        // depth pass is skipped entirely, so flagging every mesh as a caster only
        // grows the shadow frustum work if shadows are ever switched back on.
        const shadowsEnabled = getQualityProfile().shadows;
        mesh.castShadow = shadowsEnabled;
        mesh.receiveShadow = shadowsEnabled;

        const geom = mesh.geometry;
        if (geom) {
          const posAttr = geom.attributes.position;
          if (posAttr) {
            for (let i = 0; i < posAttr.count; i++) {
              const x = posAttr.getX(i);
              const y = posAttr.getY(i);
              const z = posAttr.getZ(i);
              if (isNaN(x) || isNaN(y) || isNaN(z) || !isFinite(x) || !isFinite(y) || !isFinite(z)) {
                nanCoordinateCount++;
                posAttr.setXYZ(i, 0, 0, 0);
              }
            }
            if (nanCoordinateCount > 0) posAttr.needsUpdate = true;
          }

          if (!geom.attributes.normal && posAttr) {
            geom.computeVertexNormals();
          }

          if (geom.index && posAttr) {
            const arr = geom.index.array;
            const pA = new THREE.Vector3();
            const pB = new THREE.Vector3();
            const pC = new THREE.Vector3();
            for (let i = 0; i < arr.length; i += 3) {
              pA.fromBufferAttribute(posAttr, arr[i]);
              pB.fromBufferAttribute(posAttr, arr[i + 1]);
              pC.fromBufferAttribute(posAttr, arr[i + 2]);
              if (pA.distanceToSquared(pB) < 1e-10 || pB.distanceToSquared(pC) < 1e-10 || pC.distanceToSquared(pA) < 1e-10) {
                degenerateTriangleCount++;
              }
            }
          }

          geom.computeBoundingBox();
          geom.computeBoundingSphere();
        }

        let hasValidVertexColors = false;
        if (geom && geom.attributes.color) {
          const colorAttr = geom.attributes.color;
          let maxVal = 0;
          let sumVal = 0;
          const sampleCount = Math.min(colorAttr.count, 60);
          for (let i = 0; i < sampleCount; i++) {
            const r = colorAttr.getX(i);
            const g = colorAttr.getY(i);
            const b = colorAttr.getZ(i);
            maxVal = Math.max(maxVal, r, g, b);
            sumVal += r + g + b;
          }
          const avgVal = sumVal / (sampleCount * 3);
          if (maxVal > 0.15 && avgVal > 0.05) {
            hasValidVertexColors = true;
          }
        }

        const processMaterial = (mat: THREE.Material): THREE.Material => {
          (mesh as any).userData = (mesh as any).userData || {};
          if (!(mesh as any).userData.__originalMaterial) {
            (mesh as any).userData.__originalMaterial = mat;
          }

          mat.side = THREE.DoubleSide;

          if (hasValidVertexColors) {
            mat.vertexColors = true;
            if ('color' in mat && (mat as any).color instanceof THREE.Color) {
              const c = (mat as any).color;
              if (c.r < 0.25 && c.g < 0.25 && c.b < 0.25) c.setHex(0xffffff);
            }
          } else {
            mat.vertexColors = false;
          }

          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            // Prevent unmapped metalness causing total blackness
            if (mat.metalness > 0.4 && !mat.metalnessMap) {
              mat.metalness = 0.08;
            }
            if (mat.roughness === undefined || mat.roughness < 0.1) {
              mat.roughness = 0.45;
            }
            // If base color is dark with a texture map, brighten to white so texture is 100% visible
            if (mat.map && mat.color) {
              if (mat.color.r < 0.6 || mat.color.g < 0.6 || mat.color.b < 0.6) {
                mat.color.setHex(0xffffff);
              }
            } else if (!hasValidVertexColors && !mat.map && mat.color) {
              if (mat.color.r < 0.25 && mat.color.g < 0.25 && mat.color.b < 0.25) {
                mat.color.setHex(0xd8dee9);
              }
            }
          }

          if ('map' in mat && (mat as any).map) {
            (mat as any).map.colorSpace = THREE.SRGBColorSpace;
            (mat as any).map.needsUpdate = true;
          }

          // Anisotropic filtering multiplies texture fetches per fragment. It is a
          // bandwidth tax an entry-tier mobile GPU cannot absorb, so the profile
          // caps it (1x = plain trilinear on low-power devices).
          const maxAniso = getQualityProfile().maxAnisotropy;
          for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
            const tex = (mat as any)[key] as THREE.Texture | undefined;
            if (tex && typeof tex.anisotropy === 'number' && tex.anisotropy > maxAniso) {
              tex.anisotropy = maxAniso;
              tex.needsUpdate = true;
            }
          }
          if ('emissiveMap' in mat && (mat as any).emissiveMap) {
            (mat as any).emissiveMap.colorSpace = THREE.SRGBColorSpace;
            (mat as any).emissiveMap.needsUpdate = true;
          }
          if ('normalMap' in mat && (mat as any).normalMap) {
            (mat as any).normalMap.colorSpace = THREE.NoColorSpace;
          }
          if ('roughnessMap' in mat && (mat as any).roughnessMap) {
            (mat as any).roughnessMap.colorSpace = THREE.NoColorSpace;
          }
          if ('metalnessMap' in mat && (mat as any).metalnessMap) {
            (mat as any).metalnessMap.colorSpace = THREE.NoColorSpace;
          }

          if (mat.transparent || (mat.opacity !== undefined && mat.opacity < 1.0) || ('map' in mat && (mat as any).map)) {
            mat.depthWrite = true;
            mat.depthTest = true;
            if ((mat as any).alphaTest === 0 && mat.transparent) {
              (mat as any).alphaTest = 0.5;
            }
          }

          // Configure Stencil Writing & Depth Bias
          MaterialCache.configureModelMaterial(mat);

          return mat;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(processMaterial);
        } else if (mesh.material) {
          mesh.material = processMaterial(mesh.material);
        }
      }
    });

    if (nanCoordinateCount > 0) {
      warnings.push({
        id: 'nan_coords',
        type: 'warning',
        title: 'Sanitized Corrupt Coordinates',
        message: `Fixed ${nanCoordinateCount} NaN/Infinity vertex coordinates to prevent rendering crashes.`,
        count: nanCoordinateCount,
      });
    }

    if (degenerateTriangleCount > 0) {
      warnings.push({
        id: 'degenerate_triangles',
        type: 'info',
        title: 'Zero-Area Degenerate Faces',
        message: `Model contains ${degenerateTriangleCount} zero-area or colinear triangles from CAD tessellation.`,
        count: degenerateTriangleCount,
      });
    }
  }

  public calculateDeepMetadata(
    root: THREE.Object3D,
    name: string,
    originalSize: number,
    format: DeepModelMetadata['format'] = 'glb',
    fileCount: number = 1,
    loadingTier: LoadingTier = 'tier1_full',
    loadingTierName: string = 'Tier 1 (Full PBR Feature Loader)',
    warnings: IntegrityWarning[] = []
  ): DeepModelMetadata {
    let triangles = 0;
    let vertices = 0;
    let meshes = 0;
    let drawCalls = 0;
    let hasVertexColors = false;
    let hasTextures = false;
    let totalTextureBytes = 0;
    let isPointFallback = false;

    const materialSet = new Set<string>();
    const textureSet = new Set<string>();

    root.traverse((child) => {
      if ((child as THREE.Points).isPoints) {
        isPointFallback = true;
        const pts = child as THREE.Points;
        if (pts.geometry && pts.geometry.attributes.position) {
          vertices += pts.geometry.attributes.position.count;
        }
      }

      if ((child as THREE.Mesh).isMesh) {
        meshes++;
        drawCalls++;
        const mesh = child as THREE.Mesh;
        const geom = mesh.geometry;

        if (geom) {
          if (geom.attributes.color) hasVertexColors = true;
          if (geom.index) {
            triangles += geom.index.count / 3;
          } else if (geom.attributes.position) {
            triangles += geom.attributes.position.count / 3;
          }
          if (geom.attributes.position) {
            vertices += geom.attributes.position.count;
          }
        }

        const measureTexture = (tex?: THREE.Texture | null) => {
          if (tex && tex.uuid && !textureSet.has(tex.uuid)) {
            textureSet.add(tex.uuid);
            hasTextures = true;
            const img = tex.image as any;
            if (img && typeof img.width === 'number' && typeof img.height === 'number') {
              totalTextureBytes += img.width * img.height * 4;
            } else {
              totalTextureBytes += 1024 * 1024 * 4;
            }
          }
        };

        const inspectMat = (m: THREE.Material) => {
          materialSet.add(m.uuid || m.name || 'mat');
          if ('map' in m) measureTexture((m as any).map);
          if ('normalMap' in m) measureTexture((m as any).normalMap);
          if ('roughnessMap' in m) measureTexture((m as any).roughnessMap);
          if ('metalnessMap' in m) measureTexture((m as any).metalnessMap);
          if ('emissiveMap' in m) measureTexture((m as any).emissiveMap);
        };

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(inspectMat);
        } else if (mesh.material) {
          inspectMat(mesh.material);
        }
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const isExtremeScale = maxDim > 0 && (maxDim < 0.01 || maxDim > 50.0);

    if (isExtremeScale) {
      warnings.push({
        id: 'extreme_scale',
        type: 'warning',
        title: maxDim < 0.01 ? 'Extreme Miniature Scale (<0.01m)' : 'Extreme Oversized Scale (>50m)',
        message: `Bounding size is ${maxDim.toFixed(3)} units. Scale normalized bounds.`,
      });
    }

    const textureMemoryMB = Number((totalTextureBytes / (1024 * 1024)).toFixed(2));

    return {
      name,
      originalSize,
      format,
      triangles: Math.round(triangles),
      vertices,
      meshes,
      materials: materialSet.size,
      textures: textureSet.size,
      drawCalls,
      textureMemoryMB,
      hasVertexColors,
      hasTextures,
      dimensions: {
        x: Number(size.x.toFixed(3)),
        y: Number(size.y.toFixed(3)),
        z: Number(size.z.toFixed(3)),
      },
      fileCount,
      loadingTier,
      loadingTierName,
      integrityWarnings: warnings,
      isExtremeScale,
      isPointFallback,
    };
  }
}

export const modelLoader = new ModelLoaderService();
