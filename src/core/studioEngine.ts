import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import {
  BrushSettings,
  Layer,
  LayerBlendMode,
  ModelMetadata,
  StrokeDescriptor,
  StrokePoint,
  SymmetryMode,
  ToolType,
  LightingPreset,
  PostProcessSettings,
  TransformJoystickMode,
  TransformTargetScope,
  PerfectViewInfo,
  PerfectViewType,
  GPUInfo,
  ModelDisplayMode,
  Guide3D,
  LiquifySettings,
  CustomMirrorPlane,
  BentGuideConfig,
  HolisticStrokeDNA,
  EraserMode,
  LoadedModelInfo,
  ProjectSaveData,
} from '../types';
import { ShapeSnappingEngine, ShapeSnapResult } from './shapeSnapping';
import { ConformalBeadGenerator } from './conformalBeadGenerator';
import { MaterialCache, normalizeHexColor } from './materialCache';
import { UVPaintingEngine } from './uvPaintingEngine';
import { PostProcessingEngine } from './postProcessingEngine';
import { SampleModelFactory } from './sampleModels';
import { StrokeSmoother } from './strokeSmoother';
import { globalShaderRegistry } from './animatedShaders';
import { ProceduralSkyEngine, SkyPresetName, SkySettings } from './proceduralSky';
import { ModelConverterEngine } from './modelConverter';
import { VolumetricLiquifyEngine } from './liquifyEngine';
import { LoftGuideEngine } from './loftEngine';
import { ScaffoldingEngine } from './scaffoldingEngine';
import {
  CollisionGuideMeshConfig,
  ScaffoldProxyType,
  ScaffoldRenderMode,
  PrimitiveTopologyConfig,
} from '../types';
import { PrimitiveGenerator } from './primitiveGenerator';
import { modelLoader, LoadResult } from './modelLoader';
import { webgpuPipeline } from './webgpuPipeline';
import { ensureGeometryLinearVertexColors, oklabMix } from './colorMath';
import { modelExporter } from './modelExporter';
import { modelNormalization } from './modelNormalization';
import { resolveAssetUrl } from '../utils/assetUrl';
import { publishCameraPose } from './telemetryStore';
import { getQualityProfile, resolvePixelRatio, QualityProfile } from '../utils/deviceProfile';
import { FastSurfaceRaycaster } from './FastSurfaceRaycaster';

// Patch Three.js geometry and mesh prototypes with BVH accelerated raycasting
try {
  (THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
  (THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
} catch (e) {
  console.warn('BVH raycast acceleration setup notice:', e);
}

// Reusable scratch objects for high-performance zero-allocation raycasting
const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _pC = new THREE.Vector3();
const _nA = new THREE.Vector3();
const _nB = new THREE.Vector3();
const _nC = new THREE.Vector3();
const _localHit = new THREE.Vector3();
const _baryCoord = new THREE.Vector3();
const _interpolatedNorm = new THREE.Vector3();
const _invObjMatrix = new THREE.Matrix4();
const _camDirScratch = new THREE.Vector3();

// Additional scratch objects shared by the per-frame loop and the raycast hot path.
// Every one of these replaces an allocation that previously happened per frame or
// per pointer sample (raycastModel runs up to 48x per pointer move while drawing).
const _ndcScratch = new THREE.Vector2();
const _cameraOffset = new THREE.Vector3();
const _viewDirScratch = new THREE.Vector3();
const _worldNormalScratch = new THREE.Vector3();
const _worldPointScratch = new THREE.Vector3();
const _localPointScratch = new THREE.Vector3();
const _localNormalScratch = new THREE.Vector3();
const _invModelMatrix = new THREE.Matrix4();
const _planeNormalScratch = new THREE.Vector3();
const _planeCenterScratch = new THREE.Vector3();
const _planeScratch = new THREE.Plane();
const _rayHitScratch = new THREE.Vector3();
const _uvScratch = new THREE.Vector2();
const _panForward = new THREE.Vector3();
const _panRight = new THREE.Vector3();
const _panUp = new THREE.Vector3();
const _cursorUp = new THREE.Vector3(0, 0, 1);
const _cursorQuat = new THREE.Quaternion();
const _cursorNormal = new THREE.Vector3();

// Canonical view axes for perfect-view detection (previously reallocated every frame).
const _AXIS_FRONT = new THREE.Vector3(0, 0, -1);
const _AXIS_BACK = new THREE.Vector3(0, 0, 1);
const _AXIS_TOP = new THREE.Vector3(0, -1, 0);
const _AXIS_BOTTOM = new THREE.Vector3(0, 1, 0);
const _AXIS_RIGHT = new THREE.Vector3(-1, 0, 0);
const _AXIS_LEFT = new THREE.Vector3(1, 0, 0);

// Seam-bridging micro-jitter offsets, hoisted out of the raycast miss path.
const _SEAM_JITTER: ReadonlyArray<readonly [number, number]> = [
  [0.0018, 0],
  [-0.0018, 0],
  [0, 0.0018],
  [0, -0.0018],
  [0.00126, 0.00126],
  [-0.00126, -0.00126],
];

/**
 * Result of a surface or spatial-plane raycast.
 *
 * Instances are pooled per engine and mutated in place, so the vectors are only
 * valid until the next raycast. Anything stored beyond that (stroke points,
 * undo history) must clone them first.
 */
export interface RaycastResult {
  hit: boolean;
  point: THREE.Vector3;
  worldPoint: THREE.Vector3;
  normal: THREE.Vector3;
  worldNormal: THREE.Vector3;
  uv?: THREE.Vector2;
  mesh?: THREE.Mesh;
}

export type UnifiedHistoryEntry =
  | {
      kind: 'stroke';
      action: { type: 'create' | 'erase'; strokes: StrokeDescriptor[] };
      timestamp: number;
    }
  | {
      kind: 'transform';
      scope: TransformTargetScope;
      inverseMatrix: THREE.Matrix4;
      forwardMatrix: THREE.Matrix4;
      layerId?: string;
      timestamp: number;
    }
  | {
      kind: 'uv';
      timestamp: number;
    }
  | {
      kind: 'primitive';
      objectId: string;
      object: THREE.Object3D;
      timestamp: number;
    };

export interface StudioLightingState {
  mode: 'studio' | 'north' | 'softbox' | 'silhouette';
  intensity: number;
  softness: number;
  color: string;
  direction: { x: number; y: number; z: number };
  shadowFloor: boolean;
  showGrid: boolean;
}

declare global {
  interface Window {
    RayEngine?: {
      screenToWorld: (clientX: number, clientY: number, isSpatial?: boolean, depth?: number) => StrokePoint | null;
      checkHover: (clientX: number, clientY: number) => boolean;
      refreshRect: () => DOMRect;
      raycastModel: (screenX: number, screenY: number) => any;
      loadGLTF: (url: string, name?: string) => Promise<void>;
    };
  }
}

export class StudioEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  public fastRaycaster: FastSurfaceRaycaster;
  private beadGenerator: ConformalBeadGenerator;
  private materialCache: MaterialCache;
  private strokeSmoother: StrokeSmoother = new StrokeSmoother();
  private lastHitMesh: THREE.Mesh | null = null;
  public uvEngine: UVPaintingEngine;
  public postEngine: PostProcessingEngine;
  public postProcessing?: PostProcessingEngine;
  public skyEngine: ProceduralSkyEngine;
  public liquifyEngine: VolumetricLiquifyEngine;
  public loftEngine: LoftGuideEngine;
  public scaffoldingEngine: ScaffoldingEngine;

  // Visual & Lighting
  private ambientIntensity: number = 0.5;
  private directionalIntensity: number = 1.0;
  private modelColor: string = '#ffffff';
  private modelRoughness: number = 0.5;
  private modelMetalness: number = 0.0;
  private modelOpacity: number = 1.0;
  private modelWireframeOpacity: number = 0.0;
  private isModelVisible: boolean = true;

  // Groups
  private modelRoot: THREE.Group;
  private strokeRoot: THREE.Group;
  private worldStrokeRoot: THREE.Group;
  private helperRoot: THREE.Group;
  private lightsRoot: THREE.Group;
  private customMirrorOrigin: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private customMirrorNormal: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private customMirrorEnabled: boolean = false;
  private guideColliderMeshes: Map<string, THREE.Mesh> = new Map();
  private xrSession: any = null;
  private isSimulatedAR: boolean = false;
  private arFloorGrid: THREE.GridHelper | null = null;
  private dracoLoader: DRACOLoader | null = null;
  private modelDisplayMode: ModelDisplayMode = 'texture';

  // Model & Mesh references
  private targetMeshes: THREE.Mesh[] = [];
  private activeModelName: string = 'Drawing Canvas';
  public activeModelId: string | null = null;
  private modelMetadata: ModelMetadata = {
    name: 'Drawing Canvas',
    vertexCount: 0,
    triangleCount: 0,
    meshCount: 0,
    dimensions: new THREE.Vector3(0, 0, 0),
    hasUVs: false,
  };

  // Camera Orbit State
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(-0.08, 0.42, 0);
  private cameraSpherical: THREE.Spherical = new THREE.Spherical(7.85, 1.5303, -0.0249);
  private targetSpherical: THREE.Spherical = new THREE.Spherical(7.85, 1.5303, -0.0249);
  private targetPosition: THREE.Vector3 = new THREE.Vector3(-0.08, 0.42, 0);

  // Active Stroke State
  private isDrawing: boolean = false;
  private activePoints: StrokePoint[] = [];
  private activeStrokeMeshes: THREE.Mesh[] = [];
  private activeLayerId: string = 'layer_base_1';
  private activeLayerOpacity: number = 1.0;
  private strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }> = new Map();
  private undoStack: Array<{ type: 'create' | 'erase'; strokes: StrokeDescriptor[] }> = [];
  private redoStack: Array<{ type: 'create' | 'erase'; strokes: StrokeDescriptor[] }> = [];
  private historyUndoStack: UnifiedHistoryEntry[] = [];
  private historyRedoStack: UnifiedHistoryEntry[] = [];
  private activeStrokeBatch: StrokeDescriptor[] = [];
  private activeVacuumPurgedBatch: StrokeDescriptor[] = [];
  private lastScreenCoords: { x: number; y: number } | null = null;
  private lastCapturePoint: StrokePoint | null = null;
  private isOverAir: boolean = false;
  private symmetryPointsCache: StrokePoint[][] = [];

  // Brush Visual Projection Decal
  private cursorDecal: THREE.Mesh;

  // Grid & Lights
  private gridHelper: THREE.GridHelper;
  private hemiLight: THREE.HemisphereLight;
  private dirLight1: THREE.DirectionalLight;
  private dirLight2: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  // Animation & Rendering Loop Optimizations
  private animationFrameId: number | null = null;
  private lastTime: number = performance.now();
  private fps: number = 60;
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private isDirty: boolean = true;
  private loopLightDir: THREE.Vector3 = new THREE.Vector3();
  private loopResolution: THREE.Vector2 = new THREE.Vector2();

  // Adaptive quality profile & frame pacing
  private profile: QualityProfile;
  private minFrameIntervalMs: number = 0;
  private idleFrameIntervalMs: number = 0;
  private lastRenderTime: number = 0;
  private lastActivityTime: number = performance.now();
  private hasAnimatedContent: boolean = false;
  private isContextLost: boolean = false;
  private resizeRafId: number | null = null;
  private pendingResize: { width: number; height: number } | null = null;

  // Reused raycast scratch: rebuilt in place instead of reallocated per sample.
  private raycastTargetScratch: THREE.Mesh[] = [];
  private intersectScratch: THREE.Intersection[] = [];
  private raycastResult: RaycastResult = {
    hit: false,
    point: new THREE.Vector3(),
    worldPoint: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    worldNormal: new THREE.Vector3(),
    uv: undefined,
    mesh: undefined,
  };

  // Reused per-frame payloads so the render loop allocates nothing.
  private cameraChangePayload = { radius: 0, theta: 0, phi: 0 };
  private perfectViewScratch: PerfectViewInfo = { isPerfect: false, view: null, depthAxis: null };

  // Bound listeners retained so dispose() can actually remove them.
  private handleWindowResize = (): void => {
    this.refreshRect();
  };
  private handleWindowScroll = (): void => {
    this.refreshRect();
  };
  private handleContextLost = (event: Event): void => {
    // Preventing the default tells the browser we intend to restore the context.
    event.preventDefault();
    this.isContextLost = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.warn('WebGL context lost - rendering paused until restore.');
  };
  private handleContextRestored = (): void => {
    this.isContextLost = false;
    try {
      this.renderer.setPixelRatio(resolvePixelRatio(this.profile));
      this.renderer.shadowMap.enabled = this.profile.shadows;
      this.renderer.shadowMap.type = this.profile.shadowMapType;
      if (this.container) {
        this.resize(this.container.clientWidth, this.container.clientHeight);
      }
      this.materialCache.clear();
      this.scene.environment = null;
      this.ensureBaselineLighting();
    } catch (e) {
      console.warn('WebGL context restore notice:', e);
    }
    this.markDirty();
    if (this.animationFrameId === null) {
      this.startLoop();
    }
    console.info('WebGL context restored - rendering resumed.');
  };

  // Transform Joystick & Spatial State
  private transformActiveScope: TransformTargetScope = 'all';
  private currentTransformTotalMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private transformUndoStack: Array<{
    scope: TransformTargetScope;
    inverseMatrix: THREE.Matrix4;
    layerId?: string;
  }> = [];
  private transformRedoStack: Array<{
    scope: TransformTargetScope;
    forwardMatrix: THREE.Matrix4;
    layerId?: string;
  }> = [];
  private lastPerfectViewInfo: PerfectViewInfo = {
    isPerfect: false,
    view: null,
    depthAxis: null,
  };

  // GPU Hardware & WebGPU Telemetry
  public gpuInfo: GPUInfo = {
    backend: 'webgl2',
    adapterName: 'Hardware Accelerated WebGL2',
    vendor: 'Standard GPU Vendor',
    architecture: 'Universal High-Performance Pipeline',
    isWebGPUSupported: false,
    maxTextureDimension2D: 4096,
    computeSupport: false,
    powerPreference: 'high-performance',
  };

  // Callbacks
  public onFpsUpdate?: (fps: number) => void;
  public onMetadataUpdate?: (meta: ModelMetadata) => void;
  public onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  public onViewChange?: (viewInfo: PerfectViewInfo) => void;
  public onGPUInfoUpdate?: (info: GPUInfo) => void;
  public onCameraChange?: (spherical: { radius: number; theta: number; phi: number }) => void;
  public onAutoSaveTrigger?: (reason?: string) => void;
  public onShapeSnapped?: (result: ShapeSnapResult) => void;
  public onDNAInjected?: (dna: HolisticStrokeDNA) => void;
  public onModelsChanged?: (models: LoadedModelInfo[]) => void;
  public onStrokeSelected?: (stroke: StrokeDescriptor | null) => void;

  private selectedStrokeId: string | null = null;
  private selectionHighlightGroup: THREE.Group | null = null;
  private navigatorSensitivity: number = 0.35;
  private currentLayers: Layer[] = [];

  private activeSelectedModelId: string | null = null;
  private guideHelperMesh: THREE.Mesh | null = null;
  private cachedRect: DOMRect | null = null;
  private drawingPlaneMesh: THREE.Mesh | null = null;
  private studioGroundMesh: THREE.Mesh | null = null;
  private studioBackdropTexture: THREE.CanvasTexture | null = null;
  private currentStudioTheme: 'light' | 'dark' = 'light';
  private studioLightingState: StudioLightingState = {
    mode: 'studio',
    intensity: 1.6,
    softness: 0.65,
    color: '#fff7ec',
    direction: { x: 0.5, y: 0.8, z: 0.55 },
    shadowFloor: true,
    showGrid: false,
  };
  private generatedEnvTexture: THREE.Texture | null = null;
  /**
   * Whether the procedural sky dome may be shown. Low-power devices start with it
   * off - it is a full-screen procedural shader pass - but the user can re-enable
   * it explicitly from the Skybox panel via setSkyPreset().
   */
  private skyEnabled: boolean = true;
  private clipboardStrokes: StrokeDescriptor[] = [];

  constructor(container: HTMLElement) {
    this.container = container;

    // 0. Resolve the adaptive quality profile once. Every renderer, engine and
    // material decision below reads from it so a low-power tablet never pays for
    // desktop-class fill rate, VRAM or shader precision.
    const profile = getQualityProfile();
    this.profile = profile;

    // 1. WebGL Renderer with Stencil Buffer & Depth Preservation
    this.renderer = new THREE.WebGLRenderer({
      antialias: profile.antialias,
      stencil: true, // Required for stencil masking pipeline
      // preserveDrawingBuffer forces the driver to keep a full backbuffer copy every
      // frame. Only pay for it where screenshot/export flows need it.
      preserveDrawingBuffer: !profile.isLowPower,
      powerPreference: profile.powerPreference,
      // highp fragment math stalls the Mali/Adreno ALUs; mediump is ample for
      // the shading this app performs.
      precision: profile.precision,
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(resolvePixelRatio(profile));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = true;
    this.renderer.autoClearStencil = true;
    this.renderer.setClearColor(0x242629, 1.0);

    // Shadow policy: off entirely on low-power hardware (a single depth pass over
    // the model doubles draw calls for a barely visible result at 1.0 DPR).
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.type = profile.shadowMapType;
    this.renderer.shadowMap.autoUpdate = profile.shadows;

    container.appendChild(this.renderer.domElement);

    // Frame pacing derived from the profile.
    this.minFrameIntervalMs = profile.targetFps > 0 ? 1000 / profile.targetFps : 0;
    this.idleFrameIntervalMs = profile.idleFps > 0 ? 1000 / profile.idleFps : 0;

    // Cache viewport bounding rect
    this.refreshRect();
    window.addEventListener('resize', this.handleWindowResize);
    window.addEventListener('scroll', this.handleWindowScroll, true);

    // WebGL context loss recovery (common on memory-pressured Android tablets when
    // the app is backgrounded or another GPU-heavy tab claims the context).
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    // Run asynchronous WebGPU and GPU hardware detection
    this.detectGPUHardware();

    // 2. Scene Hierarchy (Default Dark Slate Studio Theme)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x242629);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.05,
      2000
    );
    this.updateCameraPosition();

    // 4. Groups with explicit render queue
    this.helperRoot = new THREE.Group();
    this.helperRoot.renderOrder = 1;

    this.modelRoot = new THREE.Group();
    this.modelRoot.renderOrder = 2; // Model renders first, writes depth and stencil

    this.strokeRoot = new THREE.Group();
    this.strokeRoot.renderOrder = 5; // Stroke geometry renders with depthTest=true, depthWrite=false

    // Attach strokes directly as child of modelRoot so surface strokes stay locked to the model in 3D space
    this.modelRoot.add(this.strokeRoot);

    // Dedicated world-space stroke root for mid-air drawings (independent of model movements)
    this.worldStrokeRoot = new THREE.Group();
    this.worldStrokeRoot.renderOrder = 5;
    this.scene.add(this.worldStrokeRoot);

    this.lightsRoot = new THREE.Group();

    this.scene.add(this.helperRoot);
    this.scene.add(this.modelRoot);
    this.scene.add(this.lightsRoot);

    // 5. Tooling & Engines
    this.raycaster = new THREE.Raycaster();
    this.fastRaycaster = new FastSurfaceRaycaster(this.camera);
    this.fastRaycaster.setViewport(container.clientWidth || 1, container.clientHeight || 1);
    this.beadGenerator = new ConformalBeadGenerator();
    this.materialCache = new MaterialCache();
    this.uvEngine = new UVPaintingEngine(profile.uvPaintResolution, profile.uvHistoryDepth);
    this.uvEngine.setRenderer(this.renderer);
    this.liquifyEngine = new VolumetricLiquifyEngine(this.beadGenerator);
    this.loftEngine = new LoftGuideEngine();
    this.scene.add(this.loftEngine.getGuideRoot());
    this.scaffoldingEngine = new ScaffoldingEngine();
    this.scene.add(this.scaffoldingEngine.getScaffoldRoot());
    this.postEngine = new PostProcessingEngine(
      this.renderer,
      this.scene,
      this.camera,
      container.clientWidth,
      container.clientHeight
    );

    // 6. Grid Helper (50% lighter grid)
    this.gridHelper = new THREE.GridHelper(10, 20, 0xe2e8f0, 0xf1f5f9);
    this.gridHelper.position.y = -1.2;
    this.helperRoot.add(this.gridHelper);

    // Seamless product-photography stage. The plane and scene background share
    // one colour, so there is no visible horizon, but the model still has a
    // physical matte surface on which to cast its grounding shadow.
    const studioGroundMaterial = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: 0.24,
      transparent: true,
      depthWrite: false,
    });
    this.studioGroundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      studioGroundMaterial
    );
    this.studioGroundMesh.name = 'StudioGroundPlane';
    this.studioGroundMesh.rotation.x = -Math.PI / 2;
    this.studioGroundMesh.position.y = -1.205;
    this.studioGroundMesh.receiveShadow = true;
    this.helperRoot.add(this.studioGroundMesh);
    this.applyStudioBackdrop('light');

    // 7. Lighting System (PBR Baseline)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.7);
    this.hemiLight.position.set(0, 20, 0);
    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight1.position.set(5, 10, 7);
    this.dirLight1.castShadow = true;
    this.dirLight1.shadow.mapSize.width = 2048;
    this.dirLight1.shadow.mapSize.height = 2048;
    this.dirLight1.shadow.camera.left = -6;
    this.dirLight1.shadow.camera.right = 6;
    this.dirLight1.shadow.camera.top = 6;
    this.dirLight1.shadow.camera.bottom = -6;
    this.dirLight1.shadow.camera.near = 0.1;
    this.dirLight1.shadow.camera.far = 30;
    this.dirLight1.shadow.bias = -0.00035;
    this.dirLight1.shadow.normalBias = 0.025;
    this.dirLight1.shadow.radius = 4;
    this.dirLight2 = new THREE.DirectionalLight(0xdbeafe, 0.6);
    this.dirLight2.position.set(-5, -2, -5);

    this.lightsRoot.add(this.ambientLight);
    this.lightsRoot.add(this.hemiLight);
    this.lightsRoot.add(this.dirLight1);
    this.lightsRoot.add(this.dirLight2);

    // Sky engine initialized with off by default for clean white studio background
    this.skyEngine = new ProceduralSkyEngine(this.scene);
    this.skyEngine.setLights(this.dirLight1, this.ambientLight, this.dirLight2);
    this.skyEnabled = false;
    this.skyEngine.applyPreset('off');

    // Ensure baseline lighting and reflection environment are immediately ready
    this.ensureBaselineLighting();

    // 8. 3D Brush Cursor Decal Ring: refined hairline reticle
    const cursorGeom = new THREE.RingGeometry(0.94, 1.0, 48);
    const cursorMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthTest: true,
      depthWrite: false,
    });
    this.cursorDecal = new THREE.Mesh(cursorGeom, cursorMat);
    this.cursorDecal.renderOrder = 10;
    this.cursorDecal.visible = false;
    this.scene.add(this.cursorDecal);

    // 9. Attach global RayEngine interface for 100% interoperability
    if (typeof window !== 'undefined') {
      (window as any).__STUDIO_ENGINE__ = this;
      window.RayEngine = {
        screenToWorld: (clientX: number, clientY: number, isSpatial: boolean = false, depth: number = 6.0) =>
          this.screenToWorld(clientX, clientY, isSpatial, depth),
        checkHover: (clientX: number, clientY: number) => this.checkHover(clientX, clientY),
        refreshRect: () => this.refreshRect(),
        raycastModel: (screenX: number, screenY: number) => this.raycastModel(screenX, screenY),
        loadGLTF: (url: string, name?: string) => this.loadGLTF(url, name || 'Custom Model'),
      };
    }

    // 10. Start with Default Drawing Plane on Canvas Load
    this.setupDefaultDrawingPlane();

    // 11. Start Render Loop
    this.startLoop();
  }

  /**
   * Refreshes and returns the cached viewport DOMRect
   */
  public refreshRect(): DOMRect {
    if (this.container) {
      this.cachedRect = this.container.getBoundingClientRect();
    } else {
      this.cachedRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    }
    return this.cachedRect;
  }

  /**
   * Screen-to-World Raycast Transformation:
   * Maps client mouse/stylus coordinates (px, py) to 3D world hit point and smooth interpolated normal.
   */
  public screenToWorld(
    clientX: number,
    clientY: number,
    isSpatial: boolean = false,
    spatialDepth: number = 6.0
  ): StrokePoint | null {
    const rect = this.cachedRect || this.refreshRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast results are pooled and mutated in place, so every vector that
    // escapes this method is cloned.
    if (isSpatial) {
      const res = this.raycastSpatialPlane(ndcX, ndcY, spatialDepth);
      if (!res) return null;
      return {
        position: res.worldPoint.clone(),
        normal: res.worldNormal.clone(),
        surfaceOffset: 0.002,
        pressure: 0.5,
        isSurfaceHit: false,
        time: performance.now(),
      };
    } else {
      const res = this.raycastModel(ndcX, ndcY);
      if (!res || !res.hit) return null;
      return {
        position: res.worldPoint.clone(),
        normal: res.worldNormal.clone(),
        surfaceOffset: 0.004,
        pressure: 0.5,
        uv: res.uv ? res.uv.clone() : undefined,
        hitMeshId: res.mesh?.uuid,
        isSurfaceHit: true,
        time: performance.now(),
      };
    }
  }

  /**
   * Fast Hover Detection:
   * Returns true if cursor is currently pointing over a valid 3D drawable mesh polygon
   */
  public checkHover(clientX: number, clientY: number): boolean {
    const rect = this.cachedRect || this.refreshRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const res = this.raycastModel(ndcX, ndcY);
    return !!(res && res.hit);
  }

  private getDRACOLoader(): DRACOLoader {
    if (!this.dracoLoader) {
      this.dracoLoader = new DRACOLoader();
      this.dracoLoader.setDecoderPath(resolveAssetUrl('draco/'));
      this.dracoLoader.preload();
    }
    return this.dracoLoader;
  }

  public getModelMetadata(): ModelMetadata {
    return { ...this.modelMetadata };
  }

  /**
   * Loads a preset procedural or remote 3D model
   */
  public async loadPresetModel(
    presetId: string,
    initialDisplayMode?: ModelDisplayMode,
    loadMode: 'add' | 'clear' = 'clear'
  ): Promise<void> {
    const presets = SampleModelFactory.getPresets();
    const found = presets.find((p) => p.id === presetId) || presets[0];

    // Clear current model & drawings only if requested
    if (loadMode === 'clear') {
      this.clearAllStrokes();
      this.clearModel(presetId === 'drawing_plane', false);
      if (this.uvEngine) {
        this.uvEngine.clearCanvas();
        this.uvEngine.resetHistory();
      }
    }

    if (found.file || found.remoteUrl) {
      try {
        const rawUrl = found.file || found.remoteUrl!;
        const fileUrl = resolveAssetUrl(rawUrl);
        if (fileUrl.includes('models/')) {
          const checkRes = await fetch(fileUrl, { method: 'HEAD' }).catch(() => null);
          const contentLength = checkRes ? parseInt(checkRes.headers.get('content-length') || '-1', 10) : -1;
          if (contentLength === 0 || (checkRes && !checkRes.ok)) {
            throw new Error(`File ${fileUrl} is unavailable (HTTP ${checkRes?.status || 'error'}).`);
          }
        }
        await this.loadGLTF(fileUrl, found.name, found, loadMode);
        if (initialDisplayMode) {
          this.setModelDisplayMode(initialDisplayMode);
        }
      } catch (err) {
        console.warn(`Direct model load notice for ${found.name}, switching to procedural generation fallback:`, err);
        const meshObj = found.createMesh ? found.createMesh() : SampleModelFactory.createFallbackModelForPreset(found);
        this.setModelObject(meshObj, found.name, found, loadMode);
        if (initialDisplayMode) {
          this.setModelDisplayMode(initialDisplayMode);
        }
      }
    } else if (found.createMesh) {
      const meshObj = found.createMesh();
      this.setModelObject(meshObj, found.name, found, loadMode);
      if (initialDisplayMode) {
        this.setModelDisplayMode(initialDisplayMode);
      }
    } else {
      const meshObj = SampleModelFactory.createFallbackModelForPreset(found);
      this.setModelObject(meshObj, found.name, found, loadMode);
      if (initialDisplayMode) {
        this.setModelDisplayMode(initialDisplayMode);
      }
    }
  }

  /**
   * Sets the 3D model object, configures stencil writing and auto-frames camera
   */
  public setModelObject(
    obj: THREE.Object3D,
    name: string,
    modelDef?: any,
    loadMode: 'add' | 'clear' = 'clear'
  ): void {
    this.ensureBaselineLighting();
    if (!this.skyEnabled) {
      this.applyStudioBackdrop(this.currentStudioTheme);
    }
    const isDrawingPlane = name === 'Drawing Canvas Plane' || obj.name === 'DrawingCanvasPlane' || obj.name === 'DrawingPlaneCanvas';

    if (loadMode === 'clear') {
      this.clearAllStrokes();
      this.clearModel(false, false);
      if (this.uvEngine) {
        this.uvEngine.clearCanvas();
        this.uvEngine.resetHistory();
      }
    } else {
      this.cancelStroke();
    }
    this.activeModelName = name;

    // The Drawing Canvas preset represents the engine's native paint surface.
    // Previously clearModel(true) restored that surface and the preset mesh was
    // then added on top of it, producing severe coplanar z-fighting and a canvas
    // that framed like two stacked models. Keep exactly one authoritative plane.
    if (isDrawingPlane) {
      const plane = this.setupDefaultDrawingPlane(2.7, 3.6);
      plane.visible = true;
      this.targetMeshes = [plane];
      this.targetSpherical.radius = 7.85;
      this.targetSpherical.phi = 1.5303;
      this.targetSpherical.theta = -0.0249;
      this.targetPosition.set(-0.08, 0.42, 0);
      this.cameraSpherical.copy(this.targetSpherical);
      this.updateCameraPosition();
      const shadowMesh = this.helperRoot.getObjectByName('ModelGroundContactShadow');
      if (shadowMesh) shadowMesh.visible = false;
      this.uvEngine.attachToModel(this.modelRoot);
      this.markDirty();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('MODEL_LOADED', {
          detail: { name, metadata: this.modelMetadata },
        }));
      }
      this.notifyModelsChanged();
      this.onAutoSaveTrigger?.('model_loaded');
      return;
    }

    // Detach drawing plane only if explicitly clearing the scene
    if (loadMode === 'clear') {
      const existingPlane = this.modelRoot.getObjectByName('DrawingPlaneCanvas');
      if (existingPlane) {
        this.modelRoot.remove(existingPlane);
        this.drawingPlaneMesh = null;
      }
    }

    this.modelRoot.add(obj);

    // Apply rotation if defined in model calibration
    if (modelDef && modelDef.rotation) {
      obj.rotation.set(
        THREE.MathUtils.degToRad(modelDef.rotation.x || 0),
        THREE.MathUtils.degToRad(modelDef.rotation.y || 0),
        THREE.MathUtils.degToRad(modelDef.rotation.z || 0)
      );
      obj.updateMatrixWorld(true);
    }

    this.targetMeshes = [];
    let vertexCount = 0;
    let triangleCount = 0;
    let meshCount = 0;

    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        this.targetMeshes.push(child);
        meshCount++;
        const geom = child.geometry;

        // Ensure vertex normals exist for lighting & raycasting
        if (!geom.attributes.normal) {
          geom.computeVertexNormals();
        }
        // Ensure bounding volumes are computed for raycaster intersection tests
        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        // Compute Bounding Volume Hierarchy (BVH) with SAH optimization for fast raycasting
        try {
          this.fastRaycaster.updateMeshBVH(child);
        } catch (e) {
          console.warn('BVH computation notice for mesh:', e);
        }

        vertexCount += geom.attributes.position ? geom.attributes.position.count : 0;
        triangleCount += geom.index
          ? geom.index.count / 3
          : geom.attributes.position
          ? geom.attributes.position.count / 3
          : 0;

        // Verify if valid non-zero vertex colors exist
        let hasValidVertexColors = false;
        if (geom.attributes.color) {
          const colorAttr = geom.attributes.color;
          let maxComponent = 0;
          let sumComponent = 0;
          const sampleCount = Math.min(colorAttr.count, 60);
          for (let i = 0; i < sampleCount; i++) {
            const r = colorAttr.getX(i);
            const g = colorAttr.getY(i);
            const b = colorAttr.getZ(i);
            maxComponent = Math.max(maxComponent, r, g, b);
            sumComponent += r + g + b;
          }
          const avgComponent = sumComponent / (sampleCount * 3);
          if (maxComponent > 0.15 && avgComponent > 0.05) {
            hasValidVertexColors = true;
          }
        }

        const sanitizeMat = (mat: THREE.Material): THREE.Material => {
          let targetMat = mat;
          const isAlphaTransparent =
            mat.transparent ||
            (mat.opacity !== undefined && mat.opacity < 0.999) ||
            (mat as any).alphaTest > 0 ||
            (mat as any).alphaMode === 'BLEND' ||
            (mat as any).alphaMode === 'MASK';

          // Upgrade basic / unlit materials if needed
          if (
            mat instanceof THREE.MeshBasicMaterial ||
            mat instanceof THREE.MeshLambertMaterial ||
            mat instanceof THREE.MeshPhongMaterial
          ) {
            const basicCol = (mat as any).color;
            const hasTex = !!(mat as any).map;
            let resolvedColor = new THREE.Color(0xd8dee9);
            if (basicCol instanceof THREE.Color) {
              if (hasTex) {
                resolvedColor.setHex(0xffffff);
              } else if (basicCol.r > 0.05 || basicCol.g > 0.05 || basicCol.b > 0.05) {
                resolvedColor = basicCol.clone();
              }
            }
            targetMat = new THREE.MeshStandardMaterial({
              color: resolvedColor,
              map: (mat as any).map || null,
              roughness: 0.68,
              metalness: 0.02,
              side: THREE.DoubleSide,
              transparent: isAlphaTransparent,
              opacity: mat.opacity !== undefined ? mat.opacity : 1.0,
              alphaTest: (mat as any).alphaTest || (isAlphaTransparent ? 0.2 : 0),
              depthWrite: true,
            });
          }

          targetMat.side = THREE.DoubleSide;

          if (hasValidVertexColors) {
            targetMat.vertexColors = true;
            if ('color' in targetMat && (targetMat as any).color instanceof THREE.Color) {
              const c = (targetMat as any).color;
              if (c.r < 0.25 && c.g < 0.25 && c.b < 0.25) c.setHex(0xffffff);
            }
          } else {
            targetMat.vertexColors = false;
          }

          if (targetMat instanceof THREE.MeshStandardMaterial || targetMat instanceof THREE.MeshPhysicalMaterial) {
            // Force safe low metalness so models never render as pitch black silhouettes
            targetMat.metalness = 0.05;
            if (targetMat.roughness === undefined || targetMat.roughness < 0.25) {
              targetMat.roughness = 0.55;
            }
            // If base color is dark with a texture map, brighten to pure white so texture is 100% visible
            if (targetMat.map && targetMat.color) {
              if (targetMat.color.r < 0.8 || targetMat.color.g < 0.8 || targetMat.color.b < 0.8) {
                targetMat.color.setHex(0xffffff);
              }
            } else if (!hasValidVertexColors && !targetMat.map && targetMat.color) {
              // Only override if color is pitch black uninitialized (0x000000)
              if (targetMat.color.r === 0 && targetMat.color.g === 0 && targetMat.color.b === 0) {
                targetMat.color.setHex(0xd8dee9);
              }
            }
          }

          if ('map' in targetMat && (targetMat as any).map) {
            (targetMat as any).map.colorSpace = THREE.SRGBColorSpace;
            (targetMat as any).map.needsUpdate = true;
          }
          if ('emissiveMap' in targetMat && (targetMat as any).emissiveMap) {
            (targetMat as any).emissiveMap.colorSpace = THREE.SRGBColorSpace;
            (targetMat as any).emissiveMap.needsUpdate = true;
          }

          // Ensure proper alpha test and depth write for transparent textures & cards (stars, decals, etc.)
          if (
            isAlphaTransparent ||
            targetMat.transparent ||
            (targetMat.opacity !== undefined && targetMat.opacity < 0.999) ||
            ('map' in targetMat && (targetMat as any).map) ||
            (targetMat as any).alphaTest > 0
          ) {
            targetMat.depthWrite = true;
            targetMat.depthTest = true;
            if ((targetMat as any).alphaTest === 0 || (targetMat as any).alphaTest === undefined) {
              (targetMat as any).alphaTest = 0.2;
            }
            if (isAlphaTransparent || (targetMat as any).alphaTest > 0) {
              targetMat.transparent = true;
            }
          }

          MaterialCache.configureModelMaterial(targetMat);
          targetMat.needsUpdate = true;
          return targetMat;
        };

        if (Array.isArray(child.material)) {
          child.material = child.material.map(sanitizeMat);
        } else if (child.material) {
          child.material = sanitizeMat(child.material);
        }
        child.userData.originalMaterial = child.material;
      }
    });

    // Auto-center and normalize bounding box scale
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    // Normalize to standard ~2.6 units studio scale so all brush sizes & offsets align
    const targetScale = 2.6 / maxDim;
    obj.scale.setScalar(targetScale);

    // Ground base on grid (y = -1.2)
    const scaledBox = new THREE.Box3().setFromObject(obj);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    if (loadMode === 'add') {
      const existingBox = new THREE.Box3();
      this.modelRoot.children.forEach((child) => {
        if (child !== this.strokeRoot && child !== obj) {
          existingBox.expandByObject(child);
        }
      });
      if (!existingBox.isEmpty()) {
        const offsetX = existingBox.max.x + (scaledBox.max.x - scaledBox.min.x) * 0.55 + 0.4;
        obj.position.x = offsetX - scaledCenter.x;
        obj.position.z -= scaledCenter.z;
        obj.position.y += (-1.2 - scaledBox.min.y);
      } else {
        obj.position.x -= scaledCenter.x;
        obj.position.z -= scaledCenter.z;
        obj.position.y += (-1.2 - scaledBox.min.y);
      }
    } else {
      obj.position.x -= scaledCenter.x;
      obj.position.z -= scaledCenter.z;
      obj.position.y += (-1.2 - scaledBox.min.y);
    }
    obj.updateMatrixWorld(true);

    // If adding to existing scene, rebuild target meshes so raycasting works across all objects
    if (loadMode === 'add') {
      this.targetMeshes = [];
      this.modelRoot.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.geometry &&
          child.name !== 'UV_Overlay' &&
          child.name !== 'ModelGroundContactShadow' &&
          !child.userData?.isHelper
        ) {
          this.targetMeshes.push(child);
          try {
            this.fastRaycaster.updateMeshBVH(child);
          } catch (_) {}
        }
      });
    }

    // Update metadata
    this.modelMetadata = {
      name,
      vertexCount: Math.round(vertexCount),
      triangleCount: Math.round(triangleCount),
      meshCount,
      dimensions: size,
      hasUVs: true,
    };

    if (this.onMetadataUpdate) {
      this.onMetadataUpdate(this.modelMetadata);
    }

    // Auto-frame camera only when clearing and starting fresh (never jolt view when adding)
    if (loadMode === 'clear') {
      this.targetSpherical.radius = 3.8;
      this.targetSpherical.phi = 1.05; // ~60° pleasant perspective elevation
      this.targetSpherical.theta = 0.65; // ~37° smooth diagonal azimuth
      this.targetPosition.set(0, 0, 0);
      this.updateCameraPosition();
    }

    // Soft circular ground contact shadow beneath model (y = -1.19)
    let shadowMesh = this.helperRoot.getObjectByName('ModelGroundContactShadow') as THREE.Mesh | null;
    if (!isDrawingPlane) {
      const footprintRadius = Math.max(0.9, Math.max(scaledBox.max.x - scaledBox.min.x, scaledBox.max.z - scaledBox.min.z) * 0.68);
      if (!shadowMesh) {
        const shadowGeom = new THREE.CircleGeometry(1.0, 64);
        shadowGeom.rotateX(-Math.PI / 2);
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 512;
        shadowCanvas.height = 512;
        const sCtx = shadowCanvas.getContext('2d');
        if (sCtx) {
          const grad = sCtx.createRadialGradient(256, 256, 0, 256, 256, 256);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
          grad.addColorStop(0.18, 'rgba(0, 0, 0, 0.46)');
          grad.addColorStop(0.48, 'rgba(0, 0, 0, 0.16)');
          grad.addColorStop(0.78, 'rgba(0, 0, 0, 0.03)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          sCtx.fillStyle = grad;
          sCtx.fillRect(0, 0, 512, 512);
        }
        const sTex = new THREE.CanvasTexture(shadowCanvas);
        const shadowMat = new THREE.MeshBasicMaterial({
          map: sTex,
          transparent: true,
          opacity: this.currentStudioTheme === 'light' ? 0.48 : 0.72,
          depthWrite: false,
        });
        shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
        shadowMesh.name = 'ModelGroundContactShadow';
        shadowMesh.position.set(0, -1.198, 0);
        this.helperRoot.add(shadowMesh);
      }
      shadowMesh.scale.set(footprintRadius, footprintRadius, 1);
      shadowMesh.visible = true;
    } else if (shadowMesh) {
      shadowMesh.visible = false;
    }

    // Attach UV Engine to new model
    this.uvEngine.attachToModel(this.modelRoot);

    // Dispatch MODEL_LOADED event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('MODEL_LOADED', {
          detail: {
            name,
            metadata: this.modelMetadata,
          },
        })
      );
    }
    this.notifyModelsChanged();
    this.onAutoSaveTrigger?.('model_loaded');
  }

  /**
   * Direct 3D mesh loader alias for procedural shapes & CAD primitives
   */
  public loadDirectObject3D(obj: THREE.Object3D, name: string): void {
    this.setModelObject(obj, name);
  }

  /**
   * Non-destructive primitive spawner: adds a 3D primitive without clearing
   * existing models or wiping away strokes.
   */
  public addPrimitiveToScene(obj: THREE.Object3D, name: string): void {
    this.ensureBaselineLighting();

    // If only the empty default drawing canvas is in the scene and no strokes exist, detach it
    if (this.drawingPlaneMesh && this.strokes.size === 0) {
      const existingPlane = this.modelRoot.getObjectByName('DrawingPlaneCanvas');
      if (existingPlane) {
        this.modelRoot.remove(existingPlane);
      }
      this.drawingPlaneMesh = null;
    }

    obj.name = name;
    this.modelRoot.add(obj);

    // Compute normals, bounding box, and bounding sphere
    let vertexCount = 0;
    let triangleCount = 0;
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        this.targetMeshes.push(child);
        const geom = child.geometry;
        if (!geom.attributes.normal) geom.computeVertexNormals();
        geom.computeBoundingBox();
        geom.computeBoundingSphere();
        try {
          this.fastRaycaster.updateMeshBVH(child);
        } catch (_) {}
        vertexCount += geom.attributes.position ? geom.attributes.position.count : 0;
        triangleCount += geom.index ? geom.index.count / 3 : (geom.attributes.position?.count || 0) / 3;
      }
    });

    // Auto-snap new primitive so its base rests flush on the ground grid (y = -1.2)
    const box = new THREE.Box3().setFromObject(obj);
    if (!box.isEmpty()) {
      const deltaY = -1.2 - box.min.y;
      obj.position.y += deltaY;
      obj.updateMatrixWorld(true);
    }

    this.activeSelectedModelId = obj.uuid;
    this.activeModelName = name;

    // Record into unified history
    this.historyUndoStack.push({
      kind: 'primitive',
      objectId: obj.uuid,
      object: obj,
      timestamp: Date.now(),
    });
    this.historyRedoStack = [];

    this.notifyModelsChanged();
    this.notifyHistory();
    this.markDirty();
  }

  /**
   * Snaps the active 3D model or primitive to rest flush on the ground grid (y = -1.2)
   */
  public snapActiveToGround(targetScope: TransformTargetScope = 'model'): void {
    const groundY = -1.2;
    let targetObj: THREE.Object3D | null = null;

    if (this.activeSelectedModelId) {
      targetObj = this.modelRoot.children.find((c) => c.uuid === this.activeSelectedModelId) || null;
    }
    if (!targetObj) {
      // Find first non-stroke child in modelRoot
      targetObj = this.modelRoot.children.find((c) => c !== this.strokeRoot) || this.modelRoot;
    }

    const box = new THREE.Box3().setFromObject(targetObj);
    if (box.isEmpty()) return;

    const deltaY = groundY - box.min.y;
    if (Math.abs(deltaY) > 0.0005) {
      this.beginTransform(targetScope);
      const matrix = new THREE.Matrix4().makeTranslation(0, deltaY, 0);
      this.applyTransformMatrix(matrix, targetScope);
      this.endTransform();
      this.markDirty();
    }
  }

  /**
   * Deletes the currently selected stroke or 3D model/primitive
   */
  public deleteActiveSelection(): boolean {
    if (this.selectedStrokeId) {
      const entry = this.strokes.get(this.selectedStrokeId);
      if (entry) {
        this.historyUndoStack.push({
          kind: 'stroke',
          action: { type: 'erase', strokes: [entry.descriptor] },
          timestamp: Date.now(),
        });
        this.historyRedoStack = [];
        entry.meshes.forEach((m) => {
          if (m.parent) m.parent.remove(m);
          m.geometry.dispose();
        });
        this.strokes.delete(this.selectedStrokeId);
        this.selectedStrokeId = null;
        this.markDirty();
        this.notifyHistory();
        return true;
      }
    }

    if (this.activeSelectedModelId) {
      const model = this.modelRoot.children.find((c) => c.uuid === this.activeSelectedModelId);
      if (model && model !== this.strokeRoot) {
        this.historyUndoStack.push({
          kind: 'primitive',
          objectId: model.uuid,
          object: model,
          timestamp: Date.now(),
        });
        this.historyRedoStack = [];
        this.modelRoot.remove(model);
        this.targetMeshes = this.targetMeshes.filter((m) => m !== model && !model.children.includes(m));
        this.activeSelectedModelId = null;
        this.notifyModelsChanged();
        this.markDirty();
        return true;
      }
    }

    return false;
  }

  /**
   * Unified raycast selection: tests 3D stroke curves, and if none hit, raycasts 3D models/primitives
   */
  public raycastSelection(screenX: number, screenY: number): { type: 'stroke' | 'model' | 'none'; id?: string; name?: string } {
    const strokeId = this.raycastStroke(screenX, screenY);
    if (strokeId) {
      this.selectStroke(strokeId);
      return { type: 'stroke', id: strokeId };
    }

    // Raycast model/primitive
    const hit = this.raycastModel(screenX, screenY);
    if (hit && hit.mesh) {
      let curr: THREE.Object3D | null = hit.mesh;
      let topChild: THREE.Object3D | null = null;
      while (curr && curr.parent) {
        if (curr.parent === this.modelRoot) {
          topChild = curr;
          break;
        }
        curr = curr.parent;
      }

      if (topChild && topChild !== this.strokeRoot) {
        this.activeSelectedModelId = topChild.uuid;
        this.notifyModelsChanged();
        this.markDirty();
        return { type: 'model', id: topChild.uuid, name: topChild.name || '3D Object' };
      }
    }

    this.selectStroke(null);
    return { type: 'none' };
  }

  /**
   * Check if user has active drawing strokes on canvas or models
   */
  public hasActiveDrawings(): boolean {
    return this.strokes.size > 0;
  }

  /**
   * Load external GLB/GLTF model from ArrayBuffer or URL (supporting Draco compression)
   */
  public async loadGLTF(
    bufferOrUrl: ArrayBuffer | string,
    name: string,
    modelDef?: any,
    loadMode: 'add' | 'clear' = 'clear'
  ): Promise<void> {
    try {
      let loadRes: LoadResult;
      if (typeof bufferOrUrl === 'string') {
        let url = resolveAssetUrl(bufferOrUrl);
        if (url.includes('github.com') && url.includes('/blob/')) {
          url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        }
        loadRes = await modelLoader.loadFromUrl(url, name);
      } else {
        loadRes = await modelLoader.loadFromArrayBuffer(bufferOrUrl, name);
      }
      this.setModelObject(loadRes.scene, name, modelDef, loadMode);
    } catch (err) {
      console.warn(`modelLoader pipeline fallback for ${name}:`, err);
      // Fallback to standard GLTFLoader if direct load fails
      const loader = new GLTFLoader();
      loader.setDRACOLoader(this.getDRACOLoader());
      return new Promise((resolve, reject) => {
        const onLoad = (gltf: any) => {
          const scene = gltf.scene || gltf.scenes[0];
          ModelConverterEngine.normalizeMeshMaterials(scene, {
            fixAlpha: true,
            brightenMetals: true,
            doubleSided: true,
          });
          scene.traverse((child: any) => {
            if (child.isMesh) {
              child.userData.originalMaterial = child.material;
            }
          });
          this.setModelObject(scene, name, modelDef, loadMode);
          resolve();
        };
        if (typeof bufferOrUrl === 'string') {
          let url = bufferOrUrl;
          if (url.includes('github.com') && url.includes('/blob/')) {
            url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
          }
          loader.load(url, onLoad, undefined, reject);
        } else {
          loader.parse(bufferOrUrl, '', onLoad, reject);
        }
      });
    }
  }

  /**
   * Load external OBJ model
   */
  public async loadOBJ(textOrUrl: string, name: string): Promise<void> {
    const loader = new OBJLoader();
    const handleObj = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (
            !child.material ||
            (child.material instanceof THREE.MeshBasicMaterial && !child.material.map)
          ) {
            // Assign a standard PBR material for untextured OBJ meshes
            child.material = new THREE.MeshStandardMaterial({
              color: 0xe2e8f0,
              roughness: 0.4,
              metalness: 0.1,
              side: THREE.DoubleSide,
              vertexColors: !!child.geometry?.attributes?.color,
            });
          }
        }
      });
      this.setModelObject(obj, name);
    };

    if (textOrUrl.startsWith('http') || textOrUrl.startsWith('blob:')) {
      return new Promise((resolve, reject) => {
        loader.load(
          textOrUrl,
          (obj) => {
            handleObj(obj);
            resolve();
          },
          undefined,
          reject
        );
      });
    } else {
      const obj = loader.parse(textOrUrl);
      handleObj(obj);
    }
  }

  /**
   * Universal 3D Model Converter & Ingestion Pipeline:
   * Supports GLB, GLTF, OBJ (+MTL/textures), FBX, 3DS, STL, PLY, DAE.
   * Converts, optimizes, Draco-compresses, saves into in-app storage, and mounts onto canvas.
   */
  public async loadUniversalFiles(
    files: FileList | File[],
    customName?: string,
    loadMode: 'add' | 'clear' = 'clear'
  ): Promise<{ name: string; bytes: number; reduction: number }> {
    try {
      const loadRes = await modelLoader.loadFromFiles(files);
      this.setModelObject(loadRes.scene, customName || loadRes.metadata.name, undefined, loadMode);
      return {
        name: customName || loadRes.metadata.name,
        bytes: loadRes.metadata.originalSize,
        reduction: 0,
      };
    } catch {
      const result = await ModelConverterEngine.autoConvertAndSave(files, customName);
      await this.loadGLTF(result.glbArrayBuffer, result.name, undefined, loadMode);
      return {
        name: result.name,
        bytes: result.convertedBytes,
        reduction: result.reductionPercentage,
      };
    }
  }

  /**
   * Raycasts onto a free 3D virtual construction plane in space (Air Draw mode)
   */
  /**
   * Raycasts onto the camera-facing spatial drawing plane.
   *
   * Called once per stroke sub-sample (up to 48x per pointer move), so it computes
   * into module scratch and returns a reused result object. Callers that retain the
   * vectors past the current call must clone them - startStroke/addStrokePoint do.
   */
  public raycastSpatialPlane(screenX: number, screenY: number, depthOffset: number = 0): RaycastResult {
    _ndcScratch.set(screenX, screenY);
    this.raycaster.setFromCamera(_ndcScratch, this.camera);

    this.camera.getWorldDirection(_planeNormalScratch);
    _planeNormalScratch.negate().normalize(); // Facing camera
    _planeCenterScratch.copy(this.cameraTarget).addScaledVector(_planeNormalScratch, depthOffset);
    _planeScratch.setFromNormalAndCoplanarPoint(_planeNormalScratch, _planeCenterScratch);

    const hit = this.raycaster.ray.intersectPlane(_planeScratch, _rayHitScratch);
    if (!hit) {
      this.raycaster.ray.at(5.0, _rayHitScratch);
    }

    // Apply +0.002 plane elevation offset
    _worldPointScratch.copy(_rayHitScratch).addScaledVector(_planeNormalScratch, 0.002);

    _invModelMatrix.copy(this.modelRoot.matrixWorld).invert();
    _localPointScratch.copy(_worldPointScratch).applyMatrix4(_invModelMatrix);
    _localNormalScratch.copy(_planeNormalScratch).transformDirection(_invModelMatrix).normalize();

    const out = this.raycastResult;
    out.hit = true;
    out.point = _localPointScratch;
    out.worldPoint = _worldPointScratch;
    out.normal = _localNormalScratch;
    out.worldNormal = _planeNormalScratch;
    out.uv = _uvScratch.set(0.5, 0.5);
    out.mesh = undefined;
    return out;
  }

  /**
   * Raycasts from screen coordinates (normalized -1 to 1) onto front-facing model polygons
   * with BVH acceleration and smooth barycentric normal interpolation.
   */
  /**
   * Rebuilds the reused raycast target list in place.
   *
   * The previous implementation spread three arrays into a fresh array on every
   * call; raycastModel runs up to 48x per pointer move, so that alone produced
   * hundreds of short-lived arrays per second of drawing.
   */
  private collectRaycastTargets(): THREE.Mesh[] {
    const targets = this.raycastTargetScratch;
    targets.length = 0;

    // Ensure targetMeshes has all active visible meshes
    if (!this.targetMeshes || this.targetMeshes.length === 0) {
      this.targetMeshes = [];
      this.modelRoot.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry && child.visible) {
          this.targetMeshes.push(child);
        }
      });
    }

    for (let i = 0; i < this.targetMeshes.length; i++) targets.push(this.targetMeshes[i]);

    // Include active loft guides, scaffolding collision meshes, and guide collider meshes
    if (this.loftEngine) {
      const guides = this.loftEngine.getActiveGuideMeshes();
      for (let i = 0; i < guides.length; i++) targets.push(guides[i]);
    }
    if (this.scaffoldingEngine) {
      const colliders = this.scaffoldingEngine.getActiveColliderMeshes();
      for (let i = 0; i < colliders.length; i++) targets.push(colliders[i]);
    }
    for (const colliderMesh of this.guideColliderMeshes.values()) {
      if (colliderMesh.visible) targets.push(colliderMesh);
    }

    return targets;
  }

  /**
   * Raycasts from screen coordinates (normalized -1 to 1) onto front-facing model
   * polygons with BVH acceleration, seam-bridging fallback, and smooth barycentric normal interpolation.
   *
   * Powered by FastSurfaceRaycaster: evaluates directly in mesh local-space with
   * boundsTree.raycastFirst, dynamic distance pruning, and inlined Cramer's Rule math.
   *
   * Hot path: returns a reused result object backed by module scratch vectors.
   * Callers that retain the geometry must clone it before the next raycast.
   */
  public raycastModel(
    screenX: number,
    screenY: number,
    settings?: BrushSettings
  ): RaycastResult | null {
    const allRaycastTargets = this.collectRaycastTargets();
    if (allRaycastTargets.length === 0) {
      return null;
    }

    const seamBridgingEnabled =
      settings?.raycastSeamBridging !== undefined
        ? settings.raycastSeamBridging
        : this.profile.seamBridging;

    const hit = this.fastRaycaster.intersect(screenX, screenY, allRaycastTargets, {
      seamBridging: seamBridgingEnabled,
      doubleSided: settings?.doubleSidedRaycast !== false,
      barycentricNormals: settings?.barycentricNormals !== false,
    });

    if (!hit) {
      return null;
    }

    const mesh = hit.mesh;
    const worldNormal = _worldNormalScratch.copy(hit.normal);

    // Ensure normal points outward towards camera
    this.camera.getWorldPosition(_camDirScratch);
    _camDirScratch.sub(hit.point).normalize();
    if (worldNormal.dot(_camDirScratch) < 0) {
      worldNormal.negate();
    }

    // Apply surface elevation bias for 3D models to eradicate z-fighting
    const surfaceOffset = settings?.surfaceOffset ?? 0.002;
    _worldPointScratch.copy(hit.point).addScaledVector(worldNormal, surfaceOffset);

    // Transform into local modelRoot coordinate space
    _invModelMatrix.copy(this.modelRoot.matrixWorld).invert();
    _localPointScratch.copy(_worldPointScratch).applyMatrix4(_invModelMatrix);
    _localNormalScratch.copy(worldNormal).transformDirection(_invModelMatrix).normalize();

    let uv = hit.uv;
    if (!uv && hit.point) {
      const u = 0.5 + Math.atan2(_localPointScratch.z, _localPointScratch.x) / (2 * Math.PI);
      const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, _localPointScratch.y / 2.0))) / Math.PI;
      uv = _uvScratch.set(u, v);
    }

    const result = this.raycastResult;
    result.hit = true;
    result.point = _localPointScratch;
    result.worldPoint = _worldPointScratch;
    result.normal = _localNormalScratch;
    result.worldNormal = worldNormal;
    result.uv = uv;
    result.mesh = mesh;

    // Dispatch RAY_HIT event for ecosystem telemetry.
    // Constructing a CustomEvent per hit is pure waste when nobody is listening,
    // so it is gated on an explicit opt-in flag set by whoever subscribes.
    if (typeof window !== 'undefined' && (window as any).__RAY_HIT_TELEMETRY__) {
      window.dispatchEvent(
        new CustomEvent('RAY_HIT', {
          detail: {
            point: _worldPointScratch.clone(),
            normal: worldNormal.clone(),
            uv: uv ? uv.clone() : undefined,
            meshName: mesh.name || mesh.uuid,
          },
        })
      );
    }

    return result;
  }

  /**
   * Updates the 3D Cursor Decal Ring
   */
  public updateCursor(screenX: number, screenY: number, brushSize: number, settings?: BrushSettings, tool?: ToolType): void {
    const isSpatial = settings?.drawingMode === 'spatial_3d' || tool === 'free_brush';
    const result = isSpatial
      ? this.raycastSpatialPlane(screenX, screenY, settings?.spatialDepth ?? 0)
      : this.raycastModel(screenX, screenY);

    if (result && result.worldPoint) {
      this.cursorDecal.visible = true;
      this.cursorDecal.position.copy(result.worldPoint).addScaledVector(result.worldNormal, 0.005);

      // Orient cursor ring along surface/plane normal (scratch objects: this runs
      // on every hover pointer-move event).
      _cursorNormal.copy(result.worldNormal).normalize();
      _cursorQuat.setFromUnitVectors(_cursorUp, _cursorNormal);
      this.cursorDecal.setRotationFromQuaternion(_cursorQuat);

      const radius = settings?.profile === 'tube'
        ? brushSize
        : brushSize * 1.2 * (settings?.brushWidthMultiplier ?? 1.0);
      this.cursorDecal.scale.set(radius, radius, radius);
    } else {
      this.cursorDecal.visible = false;
    }
    this.markDirty();
  }

  public hideCursor(): void {
    if (this.cursorDecal.visible) {
      this.cursorDecal.visible = false;
      this.markDirty();
    }
  }

  /**
   * Start a new paint stroke with smoothing and predictive latency compensation
   */
  public startStroke(
    screenX: number,
    screenY: number,
    settings: BrushSettings,
    tool: ToolType,
    layer: Layer,
    pressure: number = 1.0,
    symmetry: SymmetryMode = 'none'
  ): void {
    if (layer.locked || !layer.visible) return;

    this.isDrawing = true;
    this.activePoints = [];
    this.activeStrokeMeshes = [];
    this.activeStrokeBatch = [];
    this.activeLayerId = layer.id;
    this.activeLayerOpacity = layer.opacity;

    // Reset smoothing filter state for clean stroke start
    this.strokeSmoother.reset();
    const smoothed = this.strokeSmoother.processPoint(
      screenX,
      screenY,
      pressure,
      settings.smoothingAlgorithm || 'streamline',
      settings.smoothingStrength ?? 0.55
    );

    this.lastScreenCoords = { x: smoothed.x, y: smoothed.y };
    this.lastCapturePoint = null;
    this.isOverAir = false;

    // Handle Vacuum Eraser Mode: purges whole continuous strokes upon intersection
    if (tool === 'eraser' && settings.eraserMode === 'vacuum') {
      this.activeVacuumPurgedBatch = [];
      this.purgeStrokesIntersecting(smoothed.x, smoothed.y, (settings.size || 0.035) * 1.5);
      return;
    }

    const isSpatial = settings.drawingMode === 'spatial_3d' || tool === 'free_brush';
    const rayResult = isSpatial
      ? this.raycastSpatialPlane(smoothed.x, smoothed.y, settings.spatialDepth ?? 0)
      : this.raycastModel(smoothed.x, smoothed.y, settings);

    if (!rayResult || !rayResult.hit) {
      this.isOverAir = true;
      return;
    }

    // UV Texture Brush Mode
    if (tool === 'uv_brush' && rayResult.hit && rayResult.uv) {
      this.uvEngine.beginStroke(rayResult.uv, settings);
      this.uvEngine.paintTo(rayResult.uv, settings, smoothed.pressure);
      return;
    }

    const firstPoint: StrokePoint = {
      position: rayResult.point.clone(),
      normal: rayResult.normal.clone(),
      surfaceOffset: settings.surfaceOffset || 0.002,
      pressure: smoothed.pressure,
      isSurfaceHit: !isSpatial,
      uv: rayResult.uv ? rayResult.uv.clone() : undefined,
      time: performance.now(),
    };
    this.activePoints.push(firstPoint);
    this.lastCapturePoint = firstPoint;

    // Instantiate symmetry stroke meshes
    const symmetryCount = this.getSymmetryCount(symmetry);
    for (let s = 0; s < symmetryCount; s++) {
      const mat = this.materialCache.getStrokeMaterial(settings, !isSpatial, layer.opacity, layer.blendMode || 'normal');
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      mesh.renderOrder = 5;
      this.strokeRoot.add(mesh);
      this.activeStrokeMeshes.push(mesh);
    }

    this.updateActiveStrokeGeometry(settings, symmetry);
  }

  /**
   * Continue painting stroke with smoothed screen coordinates, high-frequency raycasting interpolation,
   * predictive mesh contact compensation, & anti-air gap segment splitting
   */
  public addStrokePoint(
    screenX: number,
    screenY: number,
    settings: BrushSettings,
    tool: ToolType,
    pressure: number = 1.0,
    symmetry: SymmetryMode = 'none',
    skipGeometryUpdate: boolean = false,
    isCoalescedPoint: boolean = false
  ): void {
    if (!this.isDrawing) return;

    // Apply real-time smoothing for smooth surface drawing
    const smoothed = this.strokeSmoother.processPoint(
      screenX,
      screenY,
      pressure,
      settings.smoothingAlgorithm || 'streamline',
      settings.smoothingStrength ?? 0.55
    );

    // Vacuum Eraser continuous sweep
    if (tool === 'eraser' && settings.eraserMode === 'vacuum') {
      this.purgeStrokesIntersecting(smoothed.x, smoothed.y, (settings.size || 0.035) * 1.5);
      return;
    }

    const targetX = smoothed.x;
    const targetY = smoothed.y;
    const targetPressure = smoothed.pressure;

    if (!this.lastScreenCoords) {
      this.lastScreenCoords = { x: targetX, y: targetY };
    }

    const dx = targetX - this.lastScreenCoords.x;
    const dy = targetY - this.lastScreenCoords.y;
    const screenDist = Math.hypot(dx, dy);

    // Sub-sample screen movements so fast sweeps calculate surface contact points smoothly.
    // When processing hardware coalesced points (S-Pen at 120-240Hz), points are already
    // tightly spaced sub-millimeter samples, so we evaluate exactly 1 raycast per coalesced
    // point to prevent exponential raycast overhead and eliminate tablet input lag.
    const sampleDensity = settings.raycastSampleDensity || 'high';
    const requestedMaxSteps = sampleDensity === 'ultra' ? 48 : sampleDensity === 'standard' ? 16 : 32;
    const densityMaxSteps = Math.min(requestedMaxSteps, this.profile.maxStrokeSubSteps);
    const maxStepDist = sampleDensity === 'ultra' ? 0.003 : 0.005;
    const steps = isCoalescedPoint ? 1 : Math.min(densityMaxSteps, Math.max(1, Math.ceil(screenDist / maxStepDist)));
    const isSpatial = settings.drawingMode === 'spatial_3d' || tool === 'free_brush';

    let missStreak = 0;

    for (let step = 1; step <= steps; step++) {
      const alpha = step / steps;
      const currX = this.lastScreenCoords.x + dx * alpha;
      const currY = this.lastScreenCoords.y + dy * alpha;
      const currPressure = targetPressure;

      const rayResult = isSpatial
        ? this.raycastSpatialPlane(currX, currY, settings.spatialDepth ?? 0)
        : this.raycastModel(currX, currY, settings);

      // UV Texture Brush Mode
      if (tool === 'uv_brush') {
        if (rayResult && rayResult.hit && rayResult.uv) {
          this.uvEngine.paintTo(rayResult.uv, settings, currPressure);
        }
        continue;
      }

      // AIR GAP DETECTION: Ray missed model in free air (only in surface mode).
      // Use a tolerant streak of 6 misses so rapid stylus sweeps across curved geometry or
      // borders do not fracture the stroke into dozens of broken, disconnected pieces.
      if (!rayResult || !rayResult.hit) {
        missStreak++;
        if (missStreak >= 6) {
          if (this.activePoints.length > 0) {
            // Commit active segment so stroke does NOT bridge through empty air
            this.commitActiveSegment(settings, tool);
          }
          this.isOverAir = true;
          this.lastCapturePoint = null;
        }
        continue;
      }

      missStreak = 0;

      // SURFACE / SPATIAL HIT
      const newPoint: StrokePoint = {
        position: rayResult.point.clone(),
        normal: rayResult.normal.clone(),
        surfaceOffset: settings.surfaceOffset || 0.002,
        pressure: currPressure,
        isSurfaceHit: !isSpatial,
        uv: rayResult.uv ? rayResult.uv.clone() : undefined,
        time: performance.now(),
      };

      // Discontinuity detection:
      // 1. Returning from empty air
      // 2. Large 3D spatial jump across depth occlusion / silhouette
      // 3. Sharp normal flip (> 150° angle, dot < -0.85)
      if (this.lastCapturePoint) {
        const dist3D = this.lastCapturePoint.position.distanceTo(newPoint.position);
        const normalDot = this.lastCapturePoint.normal.dot(newPoint.normal);

        const gapToleranceMultiplier = settings.airGapTolerance ? settings.airGapTolerance * 2 : 1.0;
        const maxJump = Math.max(0.65, (settings.size || 0.035) * 14.0 * gapToleranceMultiplier);
        const isDiscontinuous = this.isOverAir || dist3D > maxJump || normalDot < -0.85;

        if (isDiscontinuous) {
          if (this.activePoints.length > 0) {
            this.commitActiveSegment(settings, tool);
          }
          this.isOverAir = false;
          this.lastCapturePoint = null;
        }
      }

      this.isOverAir = false;

      // Start new segment if currently empty
      if (this.activePoints.length === 0) {
        this.activePoints.push(newPoint);
        this.lastCapturePoint = newPoint;

        const symmetryCount = this.getSymmetryCount(symmetry);
        for (let s = 0; s < symmetryCount; s++) {
          const mat = this.materialCache.getStrokeMaterial(settings, true, this.activeLayerOpacity);
          const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
          mesh.renderOrder = 5;
          this.strokeRoot.add(mesh);
          this.activeStrokeMeshes.push(mesh);
        }
      } else {
        const distFromLast = this.lastCapturePoint!.position.distanceTo(newPoint.position);
        if (distFromLast > 0.0003) {
          this.activePoints.push(newPoint);
          this.lastCapturePoint = newPoint;
        }
      }
    }

    if (this.lastScreenCoords) {
      this.lastScreenCoords.x = targetX;
      this.lastScreenCoords.y = targetY;
    } else {
      this.lastScreenCoords = { x: targetX, y: targetY };
    }

    if (!skipGeometryUpdate) {
      if (this.activePoints.length > 0) {
        this.updateActiveStrokeGeometry(settings, symmetry);
      }
      this.markDirty();
    }
  }

  /**
   * High-performance batch insertion for hardware coalesced events (e.g. S-Pen, stylus).
   * Processes all points directly without redundant sub-sampling and updates geometry once.
   */
  public addStrokePointsBatch(
    points: Array<{ x: number; y: number; pressure: number }>,
    settings: BrushSettings,
    tool: ToolType,
    symmetry: SymmetryMode = 'none'
  ): void {
    if (!this.isDrawing || points.length === 0) return;
    for (let i = 0; i < points.length; i++) {
      const isLast = i === points.length - 1;
      this.addStrokePoint(
        points[i].x,
        points[i].y,
        settings,
        tool,
        points[i].pressure,
        symmetry,
        !isLast,
        true
      );
    }
  }

  /**
   * Commits the current active segment into the permanent stroke list and stroke batch
   */
  private commitActiveSegment(settings: BrushSettings, tool: ToolType): void {
    if (this.activePoints.length === 0 || this.activeStrokeMeshes.length === 0) return;

    const strokeId = 'stroke_' + Math.random().toString(36).substring(2, 9);
    const descriptor: StrokeDescriptor = {
      id: strokeId,
      layerId: this.activeLayerId,
      tool,
      points: [...this.activePoints],
      settings: { ...settings },
      createdAt: Date.now(),
    };

    this.strokes.set(strokeId, {
      descriptor,
      meshes: [...this.activeStrokeMeshes],
    });

    this.activeStrokeBatch.push(descriptor);

    this.activePoints = [];
    this.activeStrokeMeshes = [];
  }

  /**
   * End current stroke and save batch into undo stack
   */
  public endStroke(
    settings: BrushSettings,
    tool: ToolType,
    layerId: string,
    symmetry: SymmetryMode = 'none'
  ): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.lastScreenCoords = null;
    this.lastCapturePoint = null;
    this.isOverAir = false;
    this.lastHitMesh = null;
    this.strokeSmoother.reset();

    // Vacuum Eraser finalize
    if (tool === 'eraser' && settings.eraserMode === 'vacuum') {
      if (this.activeVacuumPurgedBatch.length > 0) {
        const action = {
          type: 'erase' as const,
          strokes: [...this.activeVacuumPurgedBatch],
        };
        this.undoStack.push(action);
        this.historyUndoStack.push({
          kind: 'stroke',
          action,
          timestamp: Date.now(),
        });
        this.redoStack = [];
        this.historyRedoStack = [];
        this.activeVacuumPurgedBatch = [];
        this.notifyHistory();
      }
      return;
    }

    if (tool === 'uv_brush') {
      this.uvEngine.endStroke();
      this.historyUndoStack.push({
        kind: 'uv',
        timestamp: Date.now(),
      });
      this.historyRedoStack = [];
      this.notifyHistory();
      return;
    }

    // Algorithmic Geometric Shape Snapping
    if (settings.shapeSnapping && this.activePoints.length >= 5) {
      const snapResult = ShapeSnappingEngine.snapStroke(
        this.activePoints,
        settings.shapeSnapTolerance ?? 0.18
      );
      if (snapResult.detectedShape !== 'none' && snapResult.confidence >= 0.6) {
        this.activePoints = snapResult.snappedPoints;
        this.updateActiveStrokeGeometry(settings, symmetry);
        this.onShapeSnapped?.(snapResult);
      }
    }

    // Straight Line / Ruler Mode Constraint
    if (settings.straightLineMode && this.activePoints.length >= 2) {
      const pStart = this.activePoints[0];
      const pEnd = this.activePoints[this.activePoints.length - 1];
      const count = Math.max(12, this.activePoints.length);
      const straightPoints: StrokePoint[] = [];
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        straightPoints.push({
          position: new THREE.Vector3().lerpVectors(pStart.position, pEnd.position, t),
          normal: new THREE.Vector3().lerpVectors(pStart.normal, pEnd.normal, t).normalize(),
          surfaceOffset: pStart.surfaceOffset,
          pressure: pStart.pressure * (1 - t) + pEnd.pressure * t,
          isSurfaceHit: pStart.isSurfaceHit,
          time: performance.now(),
        });
      }
      this.activePoints = straightPoints;
      this.updateActiveStrokeGeometry(settings, symmetry);
    }

    this.commitActiveSegment(settings, tool);

    // Auto-recalculate mesh normals once per completed stroke, never mid-stroke
    if (settings.autoRecalculateNormals !== false) {
      this.recalculateMeshNormals(this.activeLayerId);
    }

    if (this.activeStrokeBatch.length > 0) {
      const action = {
        type: 'create' as const,
        strokes: [...this.activeStrokeBatch],
      };
      this.undoStack.push(action);
      this.historyUndoStack.push({
        kind: 'stroke',
        action,
        timestamp: Date.now(),
      });
      this.redoStack = [];
      this.historyRedoStack = [];
      this.activeStrokeBatch = [];
      this.notifyHistory();
    }
  }

  /**
   * On-demand / Hold-to-Snap active drawing curve
   */
  public snapActiveStroke(
    settings: BrushSettings,
    symmetry: SymmetryMode = 'none'
  ): ShapeSnapResult | null {
    if (this.activePoints.length < 5) return null;
    const snapResult = ShapeSnappingEngine.snapStroke(
      this.activePoints,
      settings.shapeSnapTolerance ?? 0.18
    );
    if (snapResult.detectedShape !== 'none') {
      this.activePoints = snapResult.snappedPoints;
      this.updateActiveStrokeGeometry(settings, symmetry);
      this.onShapeSnapped?.(snapResult);
      return snapResult;
    }
    return null;
  }

  /**
   * Continuous Vacuum Stroke Purge
   * Raycasts / tests distance to all existing 3D stroke objects and purges intersected continuous strokes.
   */
  public purgeStrokesIntersecting(screenX: number, screenY: number, radiusWorld: number = 0.05): StrokeDescriptor[] {
    const purged: StrokeDescriptor[] = [];
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(screenX, screenY);
    raycaster.setFromCamera(mouse, this.camera);

    // Collect all stroke meshes
    const meshToStrokeId = new Map<THREE.Mesh, string>();
    const allMeshes: THREE.Mesh[] = [];
    for (const [id, data] of this.strokes.entries()) {
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
    for (const [id, data] of this.strokes.entries()) {
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
      const entry = this.strokes.get(id);
      if (entry) {
        purged.push(entry.descriptor);
        this.activeVacuumPurgedBatch.push(entry.descriptor);
        for (const m of entry.meshes) {
          m.geometry.dispose();
          this.strokeRoot.remove(m);
        }
        this.strokes.delete(id);
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
    raycaster.setFromCamera(new THREE.Vector2(screenX, screenY), this.camera);

    const allStrokeMeshes: THREE.Mesh[] = [];
    const meshToStrokeMap = new Map<THREE.Mesh, StrokeDescriptor>();
    for (const data of this.strokes.values()) {
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
        this.onDNAInjected?.(dna);
        return dna;
      }
    }

    // 2. Read direct pixel from WebGL framebuffer
    const sampledHex = this.sampleColorAtScreen(screenX, screenY, clientX, clientY);
    const colObj = new THREE.Color(sampledHex);

    // 3. Check if 3D model mesh was hit
    const modelHit = this.raycastModel(screenX, screenY);
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

    this.onDNAInjected?.(dna);
    return dna;
  }

  /**
   * Cancel active stroke without committing to history (useful for multi-touch gesture handoff)
   */
  public cancelStroke(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.lastScreenCoords = null;
    this.lastCapturePoint = null;
    this.isOverAir = false;
    this.lastHitMesh = null;
    this.strokeSmoother.reset();

    // Clean up active stroke meshes
    for (const mesh of this.activeStrokeMeshes) {
      mesh.geometry.dispose();
      this.strokeRoot.remove(mesh);
    }
    this.activeStrokeMeshes = [];
    this.activePoints = [];

    // Clean up active batch if any segments were committed in this stroke
    for (const desc of this.activeStrokeBatch) {
      const entry = this.strokes.get(desc.id);
      if (entry) {
        for (const m of entry.meshes) {
          m.geometry.dispose();
          this.strokeRoot.remove(m);
        }
        this.strokes.delete(desc.id);
      }
    }
    this.activeStrokeBatch = [];
  }

  /**
   * Updates the geometry of all active symmetry stroke meshes in real-time
   */
  private updateActiveStrokeGeometry(settings: BrushSettings, symmetry: SymmetryMode): void {
    if (this.activePoints.length === 0 || this.activeStrokeMeshes.length === 0) return;

    const symmetryCount = this.getSymmetryCount(symmetry);
    for (let s = 0; s < symmetryCount; s++) {
      const mirroredPoints = this.applySymmetry(this.activePoints, symmetry, s);
      const mesh = this.activeStrokeMeshes[s];
      if (mesh && mesh.geometry) {
        this.beadGenerator.updateBufferGeometry(mesh.geometry, mirroredPoints, settings, this.targetMeshes);
      }
    }
    this.isDirty = true;
  }

  /**
   * Recomputes points according to symmetry mode with zero allocations
   */
  private applySymmetry(points: StrokePoint[], symmetry: SymmetryMode, index: number): StrokePoint[] {
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
    const yAxis = _pA.set(0, 1, 0);

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
          this.customMirrorOrigin,
          this.customMirrorNormal
        );
        const mirroredNorm = LoftGuideEngine.mirrorNormalAcrossPlane(
          dst.normal,
          this.customMirrorNormal
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

  private getSymmetryCount(symmetry: SymmetryMode): number {
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
   * Undo last stroke, vacuum erase, primitive spawn, or transform operation in exact chronological order
   */
  public undo(): boolean {
    if (this.historyUndoStack.length === 0) {
      if (this.undoStack.length > 0) {
        const lastAction = this.undoStack.pop()!;
        this.redoStack.push(lastAction);
        if (lastAction.type === 'create') {
          for (const desc of lastAction.strokes) {
            const entry = this.strokes.get(desc.id);
            if (entry) {
              entry.meshes.forEach((m) => {
                if (m.parent) m.parent.remove(m);
                m.geometry.dispose();
              });
              this.strokes.delete(desc.id);
            }
          }
        }
        this.notifyHistory();
        return true;
      }
      return this.uvEngine.undo();
    }

    const entry = this.historyUndoStack.pop()!;
    this.historyRedoStack.push(entry);

    if (entry.kind === 'stroke') {
      const action = entry.action;
      if (action.type === 'create') {
        // Undoing a create -> remove the meshes
        for (const desc of action.strokes) {
          const strokeEntry = this.strokes.get(desc.id);
          if (strokeEntry) {
            strokeEntry.meshes.forEach((m) => {
              if (m.parent) m.parent.remove(m);
              m.geometry.dispose();
            });
            this.strokes.delete(desc.id);
          }
        }
      } else if (action.type === 'erase') {
        // Undoing an erase -> restore the purged strokes
        for (const strokeDesc of action.strokes) {
          const meshes: THREE.Mesh[] = [];
          const mat = this.materialCache.getStrokeMaterial(strokeDesc.settings, true, 1.0);
          const geom = this.beadGenerator.generateGeometry(strokeDesc.points, strokeDesc.settings, this.targetMeshes);
          const mesh = new THREE.Mesh(geom, mat);
          mesh.renderOrder = 5;
          const parent = strokeDesc.settings.drawingMode === 'spatial_3d' ? this.worldStrokeRoot : this.strokeRoot;
          parent.add(mesh);
          meshes.push(mesh);
          this.strokes.set(strokeDesc.id, { descriptor: strokeDesc, meshes });
        }
      }
    } else if (entry.kind === 'transform') {
      this.applyTransformMatrix(entry.inverseMatrix, entry.scope);
    } else if (entry.kind === 'uv') {
      this.uvEngine.undo();
    } else if (entry.kind === 'primitive') {
      const obj = this.modelRoot.getObjectByProperty('uuid', entry.objectId);
      if (obj) {
        this.modelRoot.remove(obj);
        this.targetMeshes = this.targetMeshes.filter((m) => m !== obj && !obj.children.includes(m));
        this.notifyModelsChanged();
      }
    }

    this.markDirty();
    this.notifyHistory();
    return true;
  }

  /**
   * Redo undone stroke, vacuum erase, primitive spawn, or transform operation in exact chronological order
   */
  public redo(layers: Layer[]): boolean {
    if (this.historyRedoStack.length === 0) {
      if (this.redoStack.length > 0) {
        const action = this.redoStack.pop()!;
        this.undoStack.push(action);
        this.notifyHistory();
        return true;
      }
      return this.uvEngine.redo();
    }

    const entry = this.historyRedoStack.pop()!;
    this.historyUndoStack.push(entry);

    if (entry.kind === 'stroke') {
      const action = entry.action;
      if (action.type === 'create') {
        // Redoing a create -> reconstruct meshes
        for (const strokeDesc of action.strokes) {
          const layer = layers.find((l) => l.id === strokeDesc.layerId);
          const layerOpacity = layer ? layer.opacity : 1.0;
          const layerVisible = layer ? layer.visible : true;

          const meshes: THREE.Mesh[] = [];
          const layerBlendMode = layer ? layer.blendMode || 'normal' : 'normal';
          const mat = this.materialCache.getStrokeMaterial(strokeDesc.settings, true, layerOpacity, layerBlendMode);
          const geom = this.beadGenerator.generateGeometry(strokeDesc.points, strokeDesc.settings, this.targetMeshes);
          const mesh = new THREE.Mesh(geom, mat);
          mesh.visible = layerVisible;
          mesh.renderOrder = 5;
          const parent = strokeDesc.settings.drawingMode === 'spatial_3d' ? this.worldStrokeRoot : this.strokeRoot;
          parent.add(mesh);
          meshes.push(mesh);

          this.strokes.set(strokeDesc.id, { descriptor: strokeDesc, meshes });
        }
      } else if (action.type === 'erase') {
        // Redoing an erase -> remove meshes again
        for (const desc of action.strokes) {
          const strokeEntry = this.strokes.get(desc.id);
          if (strokeEntry) {
            strokeEntry.meshes.forEach((m) => {
              if (m.parent) m.parent.remove(m);
              m.geometry.dispose();
            });
            this.strokes.delete(desc.id);
          }
        }
      }
    } else if (entry.kind === 'transform') {
      this.applyTransformMatrix(entry.forwardMatrix, entry.scope);
    } else if (entry.kind === 'uv') {
      this.uvEngine.redo();
    } else if (entry.kind === 'primitive') {
      this.modelRoot.add(entry.object);
      this.notifyModelsChanged();
    }

    this.markDirty();
    this.notifyHistory();
    return true;
  }

  /**
   * Sets the active layer for subsequent strokes
   */
  public setActiveLayer(layerId: string, opacity: number = 1.0): void {
    this.activeLayerId = layerId;
    this.activeLayerOpacity = opacity;
    this.uvEngine?.setActiveLayer(layerId);
  }

  public getActiveLayerId(): string {
    return this.activeLayerId;
  }

  /**
   * Re-renders all layers with recursive hierarchy inheritance for opacity, visibility, and GPU blend mode
   */
  public syncLayers(layers: Layer[]): void {
    this.currentLayers = [...layers];
    const layerMap = new Map(layers.map((l) => [l.id, l]));

    // Compute effective hierarchy properties (inheriting visibility and opacity from parent groups)
    const getEffectiveState = (layer: Layer): { visible: boolean; opacity: number; locked: boolean; blendMode: LayerBlendMode } => {
      let curr: Layer | undefined = layer;
      let effVisible = layer.visible;
      let effOpacity = layer.opacity;
      let effLocked = layer.locked;
      const effBlendMode = layer.blendMode || 'normal';

      const visited = new Set<string>();
      while (curr && curr.parentId && !visited.has(curr.parentId)) {
        visited.add(curr.parentId);
        const parent = layerMap.get(curr.parentId);
        if (!parent) break;
        effVisible = effVisible && parent.visible;
        effOpacity = effOpacity * parent.opacity;
        effLocked = effLocked || parent.locked;
        curr = parent;
      }

      return { visible: effVisible, opacity: effOpacity, locked: effLocked, blendMode: effBlendMode };
    };

    this.strokes.forEach(({ descriptor, meshes }) => {
      const layer = layerMap.get(descriptor.layerId);
      if (layer) {
        const state = getEffectiveState(layer);
        const mat = this.materialCache.getStrokeMaterial(
          descriptor.settings,
          true,
          state.opacity,
          state.blendMode
        );
        meshes.forEach((m) => {
          m.visible = state.visible;
          m.material = mat;
        });
      }
    });

    // Run GPU-accelerated layer compositor for UV textures
    if (this.uvEngine) {
      this.uvEngine.compositeLayers(layers);
    }
  }

  /**
   * Merges top layer into the layer below it across 3D strokes and GPU UV canvas
   */
  public mergeLayerDown(topLayerId: string, bottomLayerId: string, topOpacity: number, topBlendMode: LayerBlendMode = 'normal'): void {
    // Re-assign strokes belonging to top layer to bottom layer
    this.strokes.forEach(({ descriptor }) => {
      if (descriptor.layerId === topLayerId) {
        descriptor.layerId = bottomLayerId;
      }
    });

    // Merge UV painting textures
    if (this.uvEngine) {
      this.uvEngine.mergeLayerDown(topLayerId, bottomLayerId, topOpacity, topBlendMode);
    }
  }

  /**
   * Clear all strokes
   */
  public clearAllStrokes(): void {
    // 1. Cancel in-progress strokes & clear active arrays
    this.cancelStroke();
    this.activePoints = [];
    this.activeStrokeMeshes = [];
    this.activeStrokeBatch = [];
    this.isDrawing = false;
    this.lastCapturePoint = null;
    this.lastScreenCoords = null;
    this.lastHitMesh = null;
    this.strokeSmoother.reset();

    // 2. Dispose meshes tracked in strokes map
    this.strokes.forEach(({ meshes }) => {
      meshes.forEach((m) => {
        this.strokeRoot.remove(m);
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
    this.strokes.clear();

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
    purgeGroup(this.strokeRoot);
    if (this.worldStrokeRoot) purgeGroup(this.worldStrokeRoot);

    // 4. Reset history stacks
    this.undoStack = [];
    this.redoStack = [];
    this.transformUndoStack = [];
    this.transformRedoStack = [];
    this.historyUndoStack = [];
    this.historyRedoStack = [];

    // 5. Clear dynamic UV canvas & history
    if (this.uvEngine) {
      this.uvEngine.clearCanvas();
      this.uvEngine.resetHistory();
    }

    this.notifyHistory();
  }

  /**
   * Delete strokes belonging to a specific layer
   */
  public deleteLayerStrokes(layerId: string): void {
    const toDelete: string[] = [];
    this.strokes.forEach(({ descriptor, meshes }, id) => {
      if (descriptor.layerId === layerId) {
        meshes.forEach((m) => {
          this.strokeRoot.remove(m);
          m.geometry.dispose();
        });
        toDelete.push(id);
      }
    });
    toDelete.forEach((id) => this.strokes.delete(id));
    this.undoStack = this.undoStack.filter((batch) => !batch.strokes.some((s) => s.layerId === layerId));
    this.redoStack = this.redoStack.filter((batch) => !batch.strokes.some((s) => s.layerId === layerId));
    this.notifyHistory();
  }

  /**
   * Recalculates and smooths mesh normals across stroke geometries and 3D model meshes,
   * ensuring that shading looks smooth and uncreased even after heavy paint accumulation.
   */
  public recalculateMeshNormals(layerId?: string): number {
    let count = 0;

    // Recalculate and update normals on stroke meshes
    this.strokes.forEach(({ descriptor, meshes }) => {
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
    this.targetMeshes.forEach((mesh) => {
      if (mesh.geometry) {
        mesh.geometry.computeVertexNormals();
        if (mesh.geometry.attributes.normal) {
          mesh.geometry.attributes.normal.needsUpdate = true;
        }
      }
    });

    this.onAutoSaveTrigger?.('normals_recalculated');
    return count;
  }

  /**
   * Clear current 3D Model and all associated strokes, optionally restoring the drawing plane canvas
   */
  public clearModel(restoreDrawingPlane: boolean = false, preserveStrokes: boolean = false): void {
    // 1. Cancel in-progress strokes
    this.cancelStroke();
    if (!preserveStrokes) {
      this.clearAllStrokes();
    }

    // 2. Remove all model children from modelRoot except strokeRoot
    const toRemove: THREE.Object3D[] = [];
    this.modelRoot.children.forEach((child) => {
      if (child !== this.strokeRoot) {
        toRemove.push(child);
      }
    });

    toRemove.forEach((child) => {
      this.modelRoot.remove(child);
      child.traverse((c: any) => {
        if (c.geometry) {
          try { c.geometry.dispose(); } catch (_) {}
        }
        if (c.material) {
          try {
            if (Array.isArray(c.material)) c.material.forEach((m: any) => m.dispose());
            else c.material.dispose();
          } catch (_) {}
        }
      });
    });

    this.drawingPlaneMesh = null;
    this.targetMeshes = [];
    this.modelRoot.position.set(0, 0, 0);
    this.modelRoot.rotation.set(0, 0, 0);
    this.modelRoot.scale.set(1, 1, 1);
    this.modelRoot.updateMatrixWorld(true);

    // 3. Restore clean, well-lit default drawing plane canvas only if requested
    if (restoreDrawingPlane) {
      this.setupDefaultDrawingPlane();
    }

    // Dispatch MODEL_CLEARED event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('MODEL_CLEARED'));
    }
    this.activeSelectedModelId = null;
    this.notifyModelsChanged();
  }

  /**
   * Spawns a sleek, double-sided 3D drawing plane on canvas load,
   * allowing instant sketching and brush stroke adhesion without requiring imported meshes.
   */
  public setupDefaultDrawingPlane(
    width: number = 2.7,
    height: number = 3.6,
    position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  ): THREE.Mesh {
    this.ensureBaselineLighting();

    const existing = this.modelRoot.getObjectByName('DrawingPlaneCanvas');
    if (existing && existing instanceof THREE.Mesh) {
      this.drawingPlaneMesh = existing;
      if (!this.targetMeshes.includes(existing)) {
        this.targetMeshes = [existing];
      }
      this.notifyModelsChanged();
      return existing;
    }

    const planeGeom = new THREE.PlaneGeometry(width, height, 32, 32);
    planeGeom.computeVertexNormals();
    planeGeom.computeBoundingBox();
    planeGeom.computeBoundingSphere();

    // Clean canvas texture with 3:4 vertical aspect ratio matching the plane
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clean, bright white canvas surface
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 768, 1024);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    // 3:4 vertical drawing canvas with 50% opacity - upgraded to lit MeshStandardMaterial
    const planeMat = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    MaterialCache.configureModelMaterial(planeMat);

    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    try {
      this.fastRaycaster.updateMeshBVH(planeMesh);
    } catch (_) {}
    planeMesh.name = 'DrawingPlaneCanvas';
    planeMesh.userData.isDrawingPlane = true;
    planeMesh.userData.isDefaultCanvas = true;
    // Snap base flush on ground grid (y = -1.2)
    planeMesh.position.set(position.x, -1.2 + height / 2, position.z);
    planeMesh.rotation.x = 0; // Vertical upright pane
    planeMesh.userData.initialPosition = planeMesh.position.clone();
    planeMesh.userData.initialRotation = planeMesh.rotation.clone();
    planeMesh.userData.initialScale = planeMesh.scale.clone();
    planeMesh.castShadow = false;
    planeMesh.receiveShadow = true;

    // Edge highlight border vignette (neutral crisp outline, 40% opacity)
    const edges = new THREE.EdgesGeometry(planeGeom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xa1a1aa, linewidth: 2, transparent: true, opacity: 0.4 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.name = 'DrawingPlaneWireframe';
    planeMesh.add(wireframe);

    this.modelRoot.add(planeMesh);
    this.drawingPlaneMesh = planeMesh;
    this.targetMeshes = [planeMesh];

    const stats = PrimitiveGenerator.calculateStats(planeGeom);
    this.modelMetadata = {
      name: 'Drawing Canvas',
      vertexCount: stats.vertices,
      triangleCount: stats.triangles,
      meshCount: 1,
      dimensions: new THREE.Vector3(width, height, 0.01),
      hasUVs: true,
    };

    if (this.onMetadataUpdate) {
      this.onMetadataUpdate(this.modelMetadata);
    }

    this.notifyModelsChanged();
    return planeMesh;
  }

  public notifyModelsChanged(): void {
    const list = this.getLoadedModels();
    if (this.onModelsChanged) {
      this.onModelsChanged(list);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('MODELS_CHANGED', { detail: list }));
    }
  }

  public getLoadedModels(): LoadedModelInfo[] {
    const models: LoadedModelInfo[] = [];
    this.modelRoot.children.forEach((child, index) => {
      if (child === this.strokeRoot) return;
      let meshCount = 0;
      child.traverse((c) => {
        if (c instanceof THREE.Mesh) meshCount++;
      });
      const isDrawingPlane = child === this.drawingPlaneMesh || child.name === 'DrawingPlaneCanvas';
      const name = child.name || (isDrawingPlane ? 'Drawing Canvas' : `3D Model ${index + 1}`);
      models.push({
        id: child.uuid,
        name,
        meshCount: Math.max(1, meshCount),
        visible: child.visible,
        isDrawingPlane,
      });
    });
    return models;
  }

  public setActiveSelectedModel(modelId: string | null): void {
    this.activeSelectedModelId = modelId;
  }

  public getActiveSelectedModelId(): string | null {
    return this.activeSelectedModelId;
  }

  public getDrawingPlane(): THREE.Mesh | null {
    return this.drawingPlaneMesh;
  }

  public getModelRoot(): THREE.Group {
    return this.modelRoot;
  }

  public getStrokeRoot(): THREE.Group {
    return this.strokeRoot;
  }

  public toggleDrawingPlane(visible?: boolean): boolean {
    if (!this.drawingPlaneMesh) {
      this.setupDefaultDrawingPlane();
      return true;
    }
    const nextVis = visible !== undefined ? visible : !this.drawingPlaneMesh.visible;
    this.drawingPlaneMesh.visible = nextVis;
    if (nextVis && !this.targetMeshes.includes(this.drawingPlaneMesh)) {
      this.targetMeshes.push(this.drawingPlaneMesh);
    } else if (!nextVis) {
      this.targetMeshes = this.targetMeshes.filter((m) => m !== this.drawingPlaneMesh);
    }
    return nextVis;
  }

  /**
   * Copies stroke curves belonging to the target layer (or all curves) to memory clipboard
   */
  public copyStrokes(layerId?: string): number {
    const targetId = layerId || this.activeLayerId;
    const copied: StrokeDescriptor[] = [];

    this.strokes.forEach(({ descriptor }) => {
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
    const layerId = targetLayerId || this.activeLayerId;
    const newBatch: StrokeDescriptor[] = [];

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

      const mat = this.materialCache.getStrokeMaterial(desc.settings, true, this.activeLayerOpacity);
      const geom = this.beadGenerator.generateGeometry(newPoints, desc.settings, this.targetMeshes);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 5;
      this.strokeRoot.add(mesh);

      this.strokes.set(newId, { descriptor: desc, meshes: [mesh] });
      newBatch.push(desc);
    }

    if (newBatch.length > 0) {
      this.undoStack.push({
        type: 'create',
        strokes: newBatch,
      });
      this.redoStack = [];
      this.notifyHistory();
    }

    return newBatch.length;
  }

  public getClipboardCount(): number {
    return this.clipboardStrokes.length;
  }

  public setNavigatorSensitivity(s: number): void {
    this.navigatorSensitivity = Math.max(0.1, Math.min(3.0, s));
  }

  public getNavigatorSensitivity(): number {
    return this.navigatorSensitivity;
  }

  /**
   * Raycast against stroke meshes to select a stroke by pointer
   */
  public raycastStroke(screenX: number, screenY: number): string | null {
    const coords = new THREE.Vector2(screenX, screenY);
    this.raycaster.setFromCamera(coords, this.camera);

    const strokeMeshes: THREE.Mesh[] = [];
    const meshToStrokeId = new Map<THREE.Mesh, string>();

    this.strokes.forEach(({ meshes }, strokeId) => {
      for (const m of meshes) {
        strokeMeshes.push(m);
        meshToStrokeId.set(m, strokeId);
      }
    });

    if (strokeMeshes.length === 0) return null;

    const intersects = this.raycaster.intersectObjects(strokeMeshes, true);
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
      this.helperRoot.remove(this.selectionHighlightGroup);
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
      this.onStrokeSelected?.(null);
      return null;
    }

    const stroke = this.strokes.get(strokeId);
    if (!stroke) {
      this.selectedStrokeId = null;
      this.onStrokeSelected?.(null);
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
      this.helperRoot.add(group);
    }

    this.onStrokeSelected?.(stroke.descriptor);
    return stroke.descriptor;
  }

  public getSelectedStrokeId(): string | null {
    return this.selectedStrokeId;
  }

  public getSelectedStroke(): StrokeDescriptor | null {
    if (!this.selectedStrokeId) return null;
    const entry = this.strokes.get(this.selectedStrokeId);
    return entry ? entry.descriptor : null;
  }

  public deleteSelectedStroke(): boolean {
    if (!this.selectedStrokeId) return false;
    const stroke = this.strokes.get(this.selectedStrokeId);
    if (!stroke) return false;

    for (const m of stroke.meshes) {
      if (m.parent) m.parent.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach((mat: any) => mat.dispose());
        else m.material.dispose();
      }
    }

    this.undoStack.push({
      type: 'erase',
      strokes: [stroke.descriptor],
    });
    this.redoStack = [];

    this.strokes.delete(this.selectedStrokeId);
    this.selectStroke(null);
    this.notifyHistory();
    return true;
  }

  public getLayersSnapshot(): Layer[] {
    return this.currentLayers;
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

    const mat = this.materialCache.getStrokeMaterial(desc.settings, true, this.activeLayerOpacity);
    const geom = this.beadGenerator.generateGeometry(parsedPoints, desc.settings, this.targetMeshes);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 5;
    this.strokeRoot.add(mesh);

    this.strokes.set(desc.id, {
      descriptor: {
        ...desc,
        points: parsedPoints,
      },
      meshes: [mesh],
    });
  }

  /**
   * Export all strokes, layers, scene environment and camera data as ProjectSaveData
   */
  public exportProjectData(projectName: string = 'Remix 3D Project', explicitLayers?: Layer[]): ProjectSaveData {
    const serializeStroke = (desc: StrokeDescriptor): StrokeDescriptor => ({
      ...desc,
      points: desc.points.map((p) => ({
        ...p,
        position: { x: p.position.x, y: p.position.y, z: p.position.z } as any,
        normal: { x: p.normal.x, y: p.normal.y, z: p.normal.z } as any,
        tangent: p.tangent ? ({ x: p.tangent.x, y: p.tangent.y, z: p.tangent.z } as any) : undefined,
      })),
    });

    const allStrokes: StrokeDescriptor[] = [];
    this.strokes.forEach(({ descriptor }) => {
      allStrokes.push(serializeStroke(descriptor));
    });

    // Serialize undo stacks non-destructively
    const serializedUndoStack = this.undoStack.map((action) => ({
      type: action.type,
      strokes: action.strokes.map(serializeStroke),
    }));

    const serializedHistoryUndoStack = this.historyUndoStack.map((entry) => {
      if (entry.kind === 'stroke') {
        return {
          kind: 'stroke',
          action: {
            type: entry.action.type,
            strokes: entry.action.strokes.map(serializeStroke),
          },
          timestamp: entry.timestamp,
        };
      } else if (entry.kind === 'transform') {
        return {
          kind: 'transform',
          scope: entry.scope,
          inverseMatrix: entry.inverseMatrix.toArray(),
          forwardMatrix: entry.forwardMatrix.toArray(),
          layerId: entry.layerId,
          timestamp: entry.timestamp,
        };
      }
      return entry;
    });

    const serializedHistoryRedoStack = this.historyRedoStack.map((entry) => {
      if (entry.kind === 'stroke') {
        return {
          kind: 'stroke',
          action: {
            type: entry.action.type,
            strokes: entry.action.strokes.map(serializeStroke),
          },
          timestamp: entry.timestamp,
        };
      } else if (entry.kind === 'transform') {
        return {
          kind: 'transform',
          scope: entry.scope,
          inverseMatrix: entry.inverseMatrix.toArray(),
          forwardMatrix: entry.forwardMatrix.toArray(),
          layerId: entry.layerId,
          timestamp: entry.timestamp,
        };
      }
      return entry;
    });

    const uvCanvases = this.uvEngine ? this.uvEngine.exportAllCanvases() : undefined;

    const project: ProjectSaveData = {
      version: '15.0.0',
      name: projectName,
      timestamp: Date.now(),
      camera: {
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        target: [this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z],
        fov: this.camera.fov,
        spherical: {
          radius: this.cameraSpherical.radius,
          theta: this.cameraSpherical.theta,
          phi: this.cameraSpherical.phi,
        },
      },
      layers: explicitLayers && explicitLayers.length > 0 ? explicitLayers : this.getLayersSnapshot(),
      strokes: allStrokes,
      activeModelName: this.activeModelName,
      activeModelId: this.activeModelId,
      showGrid: this.gridHelper?.visible ?? true,
      showWireframe: this.modelWireframeOpacity > 0,
      undoStack: serializedUndoStack,
      historyUndoStack: serializedHistoryUndoStack,
      historyRedoStack: serializedHistoryRedoStack,
      uvCanvases,
    };
    return project;
  }

  /**
   * Export project to downloadable .remix3d JSON file
   */
  public exportProjectFile(filename: string = 'project.remix3d'): void {
    const data = this.exportProjectData(filename.replace('.remix3d', ''));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.remix3d') ? filename : `${filename}.remix3d`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import project from ProjectSaveData and recreate all strokes & layers
   */
  public async importProjectData(project: ProjectSaveData): Promise<void> {
    if (!project) return;

    // 1. Clear existing strokes
    this.strokes.forEach(({ meshes }) => {
      meshes.forEach((m) => {
        if (m.parent) m.parent.remove(m);
        m.geometry.dispose();
      });
    });
    this.strokes.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.historyUndoStack = [];
    this.historyRedoStack = [];
    this.selectStroke(null);

    // 2. Restore camera if available
    if (project.camera) {
      if (project.camera.target) {
        this.cameraTarget.set(project.camera.target[0], project.camera.target[1], project.camera.target[2]);
      }
      if (project.camera.position) {
        this.camera.position.set(project.camera.position[0], project.camera.position[1], project.camera.position[2]);
        this.camera.lookAt(this.cameraTarget);
      }
      if (project.camera.fov) {
        this.camera.fov = project.camera.fov;
        this.camera.updateProjectionMatrix();
      }
      if (project.camera.spherical) {
        this.cameraSpherical.set(
          project.camera.spherical.radius,
          project.camera.spherical.phi,
          project.camera.spherical.theta
        );
        this.targetSpherical.copy(this.cameraSpherical);
      }
    }

    // 3. Rebuild strokes
    if (Array.isArray(project.strokes)) {
      for (const desc of project.strokes) {
        this.recreateStrokeFromDescriptor(desc);
      }
    }

    // 4. Restore UV canvases if available
    if (project.uvCanvases && this.uvEngine) {
      await this.uvEngine.importCanvases(project.uvCanvases);
    }

    // 5. Restore full undo/redo history
    if (Array.isArray(project.historyUndoStack) && project.historyUndoStack.length > 0) {
      this.historyUndoStack = project.historyUndoStack.map((entry: any) => {
        if (entry.kind === 'transform') {
          return {
            ...entry,
            inverseMatrix: Array.isArray(entry.inverseMatrix)
              ? new THREE.Matrix4().fromArray(entry.inverseMatrix)
              : entry.inverseMatrix,
            forwardMatrix: Array.isArray(entry.forwardMatrix)
              ? new THREE.Matrix4().fromArray(entry.forwardMatrix)
              : entry.forwardMatrix,
          };
        }
        return entry;
      });
      if (Array.isArray(project.undoStack)) {
        this.undoStack = [...project.undoStack];
      }
      if (Array.isArray(project.historyRedoStack)) {
        this.historyRedoStack = project.historyRedoStack.map((entry: any) => {
          if (entry.kind === 'transform') {
            return {
              ...entry,
              inverseMatrix: Array.isArray(entry.inverseMatrix)
                ? new THREE.Matrix4().fromArray(entry.inverseMatrix)
                : entry.inverseMatrix,
              forwardMatrix: Array.isArray(entry.forwardMatrix)
                ? new THREE.Matrix4().fromArray(entry.forwardMatrix)
                : entry.forwardMatrix,
            };
          }
          return entry;
        });
      }
    } else if (Array.isArray(project.strokes) && project.strokes.length > 0) {
      // Synthesize undo stack for older projects so every loaded stroke can still be undone!
      for (const strokeDesc of project.strokes) {
        const action = {
          type: 'create' as const,
          strokes: [strokeDesc],
        };
        this.undoStack.push(action);
        this.historyUndoStack.push({
          kind: 'stroke',
          action,
          timestamp: (strokeDesc as any).timestamp || Date.now(),
        });
      }
    }

    this.markDirty();
    this.notifyHistory();
    this.onAutoSaveTrigger?.('project_loaded');
  }

  /**
   * Spherical Orbit Controls
   */
  public orbit(deltaX: number, deltaY: number): void {
    const rotSpeed = 0.006 * this.navigatorSensitivity;
    this.targetSpherical.theta -= deltaX * rotSpeed;
    this.targetSpherical.phi -= deltaY * rotSpeed;

    // Restrict polar angle to avoid flipping
    const eps = 0.01;
    this.targetSpherical.phi = Math.max(eps, Math.min(Math.PI - eps, this.targetSpherical.phi));
    this.markDirty();
  }

  /** Direct gimbal input in logical pixels, matching the reference navigator. */
  public orbitNavigator(deltaX: number, deltaY: number): void {
    const speed = 0.02 * this.navigatorSensitivity;
    // Start at the displayed pose so grabbing a settling view never jumps ahead.
    this.cameraSpherical.theta -= deltaX * speed;
    this.cameraSpherical.phi = Math.max(
      0.01, Math.min(Math.PI - 0.01, this.cameraSpherical.phi - deltaY * speed)
    );
    this.targetSpherical.theta = this.cameraSpherical.theta;
    this.targetSpherical.phi = this.cameraSpherical.phi;
    // The render loop draws the camera and publishes its matching gimbal pose.
    this.markDirty();
  }

  public pan(deltaX: number, deltaY: number): void {
    const panSpeed = 0.0025 * (this.cameraSpherical.radius / 3.0);
    // Scratch vectors: pan runs on every pointer-move during a camera drag.
    const forward = this.camera.getWorldDirection(_panForward);
    const right = _panRight.crossVectors(forward, this.camera.up).normalize();
    const up = _panUp.crossVectors(right, forward).normalize();

    this.targetPosition.addScaledVector(right, -deltaX * panSpeed);
    this.targetPosition.addScaledVector(up, deltaY * panSpeed);
    this.markDirty();
  }

  public zoom(deltaDistance: number): void {
    const zoomSpeed = 0.0015;
    this.targetSpherical.radius += deltaDistance * zoomSpeed * this.targetSpherical.radius;
    this.targetSpherical.radius = Math.max(0.4, Math.min(25.0, this.targetSpherical.radius));
    this.markDirty();
  }

  public getCameraSpherical(): { radius: number; theta: number; phi: number } {
    return {
      radius: this.cameraSpherical.radius,
      theta: this.cameraSpherical.theta,
      phi: this.cameraSpherical.phi,
    };
  }

  public orbitCamera(deltaTheta: number, deltaPhi: number): void {
    this.targetSpherical.theta += deltaTheta;
    this.targetSpherical.phi += deltaPhi;
    const eps = 0.001;
    this.targetSpherical.phi = Math.max(eps, Math.min(Math.PI - eps, this.targetSpherical.phi));
    this.markDirty();
  }

  public setCameraView(theta: number, phi: number, radius?: number, instant: boolean = false): void {
    this.targetSpherical.theta = theta;
    this.targetSpherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, phi));
    if (radius !== undefined) {
      this.targetSpherical.radius = radius;
    }
    if (instant) {
      this.cameraSpherical.theta = this.targetSpherical.theta;
      this.cameraSpherical.phi = this.targetSpherical.phi;
      if (radius !== undefined) this.cameraSpherical.radius = radius;
      this.updateCameraPosition();
    }
    this.markDirty();
  }

  public zoomCamera(deltaRadius: number): void {
    this.targetSpherical.radius = Math.max(0.4, Math.min(25.0, this.targetSpherical.radius + deltaRadius));
    this.markDirty();
  }

  public updateGuide(guide: Guide3D | null): void {
    if (!guide || guide.opacity <= 0) {
      if (this.guideHelperMesh) {
        this.guideHelperMesh.visible = false;
      }
      return;
    }

    if (!this.guideHelperMesh) {
      const geom = new THREE.PlaneGeometry(3, 3, 10, 10);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xa1a1aa,
        wireframe: true,
        transparent: true,
        opacity: guide.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.guideHelperMesh = new THREE.Mesh(geom, mat);
      this.helperRoot.add(this.guideHelperMesh);
    }

    this.guideHelperMesh.visible = guide.opacity > 0;
    (this.guideHelperMesh.material as THREE.MeshBasicMaterial).opacity = guide.opacity;

    if (guide.originPoint) {
      this.guideHelperMesh.position.set(guide.originPoint.x, guide.originPoint.y, guide.originPoint.z);
    }
    if (guide.rotation) {
      this.guideHelperMesh.rotation.set(guide.rotation.x, guide.rotation.y, guide.rotation.z);
    }
  }

  public resetView(): void {
    if (this.activeModelName === 'Drawing Canvas' || this.drawingPlaneMesh) {
      this.targetSpherical.radius = 7.85;
      this.targetSpherical.phi = 1.5303;
      this.targetSpherical.theta = -0.0249;
      this.targetPosition.set(-0.08, 0.42, 0);
    } else {
      const maxDim = Math.max(this.modelMetadata.dimensions.x, this.modelMetadata.dimensions.y, this.modelMetadata.dimensions.z, 1.0);
      this.targetSpherical.radius = maxDim * 2.2;
      this.targetSpherical.theta = Math.PI / 4;
      this.targetSpherical.phi = Math.PI / 2.3;
      this.targetPosition.set(0, 0, 0);
    }
    this.markDirty();
  }

  public setTargetPosition(x: number, y: number, z: number): void {
    this.targetPosition.set(x, y, z);
    this.markDirty();
  }

  // ==========================================
  // TRANSFORM JOYSTICK & SPATIAL ENGINE
  // ==========================================

  /**
   * Calculates the geometric bounding center of the targeted selection (model, strokes, or active layer)
   */
  public getSelectionCenter(scope: TransformTargetScope = 'all'): THREE.Vector3 {
    const box = new THREE.Box3();
    let hasContent = false;

    if (scope === 'model' || scope === 'all') {
      if (scope === 'model' && this.activeSelectedModelId) {
        const targetModel = this.modelRoot.children.find((c) => c.uuid === this.activeSelectedModelId);
        if (targetModel) {
          box.setFromObject(targetModel);
          if (!box.isEmpty()) hasContent = true;
        }
      } else if (this.targetMeshes.length > 0) {
        if (scope === 'model') {
          for (const mesh of this.targetMeshes) {
            box.expandByObject(mesh);
            hasContent = true;
          }
        } else {
          box.setFromObject(this.modelRoot);
          if (!box.isEmpty()) hasContent = true;
        }
      }
    }

    if (scope === 'strokes' || scope === 'all') {
      if (this.strokes.size > 0) {
        const strokeBox = new THREE.Box3().setFromObject(this.strokeRoot);
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
      this.strokes.forEach(({ descriptor, meshes }) => {
        if (descriptor.layerId === this.activeLayerId) {
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
      return this.cameraTarget.clone();
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
    const camDir = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, center);
    const ray = new THREE.Ray(this.camera.position, camDir);
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
        this.transformUndoStack.push({
          scope: this.transformActiveScope,
          inverseMatrix: inv,
          layerId: this.activeLayerId,
        });
        this.historyUndoStack.push({
          kind: 'transform',
          scope: this.transformActiveScope,
          inverseMatrix: inv,
          forwardMatrix: fwd,
          layerId: this.activeLayerId,
          timestamp: Date.now(),
        });
        this.transformRedoStack = [];
        this.historyRedoStack = [];
        this.notifyHistory();
      }
    }
  }

  /**
   * Applies an arbitrary 4x4 matrix transformation across target meshes, strokes, and descriptors
   */
  public applyTransformMatrix(matrix: THREE.Matrix4, scope: TransformTargetScope = 'all'): void {
    this.currentTransformTotalMatrix.premultiply(matrix);

    if (scope === 'model') {
      if (this.activeSelectedModelId) {
        const targetModel = this.modelRoot.children.find((c) => c.uuid === this.activeSelectedModelId);
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
        const modelChildren = this.modelRoot.children.filter((c) => c !== this.strokeRoot);
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
          this.targetMeshes.forEach((mesh) => {
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
      this.modelRoot.applyMatrix4(matrix);
      this.modelRoot.updateMatrixWorld(true);
      this.targetMeshes.forEach((mesh) => {
        if (mesh.geometry) {
          mesh.geometry.computeBoundingSphere();
          mesh.geometry.computeBoundingBox();
        }
      });
      // strokeRoot is already a child of modelRoot, so child meshes transform together.
      // Update descriptor points for geometry export / raycasting synchronization
      this.strokes.forEach(({ descriptor }) => {
        descriptor.points.forEach((p) => {
          p.position.applyMatrix4(matrix);
          p.normal.transformDirection(matrix).normalize();
        });
      });
    } else if (scope === 'strokes') {
      this.strokeRoot.applyMatrix4(matrix);
      this.strokeRoot.updateMatrixWorld(true);
      this.strokes.forEach(({ descriptor }) => {
        descriptor.points.forEach((p) => {
          p.position.applyMatrix4(matrix);
          p.normal.transformDirection(matrix).normalize();
        });
      });
    } else if (scope === 'active_layer') {
      let transformedAny = false;
      this.strokes.forEach(({ descriptor, meshes }) => {
        if (descriptor.layerId === this.activeLayerId) {
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
        this.modelRoot.applyMatrix4(matrix);
        this.modelRoot.updateMatrixWorld(true);
        this.targetMeshes.forEach((mesh) => {
          if (mesh.geometry) {
            mesh.geometry.computeBoundingSphere();
            mesh.geometry.computeBoundingBox();
          }
        });
      }
    }
    // Navigator gestures often occur while the renderer is in its low-power
    // idle cadence. Wake it immediately so every pointer step is visible.
    this.markDirty();
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

    const targetCenter = this.getSelectionCenter(scope);
    const dist = Math.max(0.5, this.camera.position.distanceTo(targetCenter));
    const vHeight = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const factor = (vHeight / (this.container?.clientHeight || 800)) * this.navigatorSensitivity;

    const forward = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
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

    const forward = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
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
    let angle = deltaAngleRad * this.navigatorSensitivity;

    // Locked Constraints: Quantize into exact 15-degree increments (PI / 12)
    if (isLocked) {
      const step = Math.PI / 12;
      angle = Math.round(angle / step) * step;
      if (Math.abs(angle) < 0.0001) return;
    }

    const anchor = this.getScreenCenterWorldAnchor();
    const camDir = this.camera.getWorldDirection(new THREE.Vector3()).normalize();

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
    const vec = new THREE.Vector3(
      axis === 'x' ? deltaWorld * this.navigatorSensitivity : 0,
      axis === 'y' ? deltaWorld * this.navigatorSensitivity : 0,
      axis === 'z' ? deltaWorld * this.navigatorSensitivity : 0
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
    let angle = deltaAngleRad * this.navigatorSensitivity;
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
    const rotSpeed = 0.005 * this.navigatorSensitivity;

    const forward = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
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
    this.markDirty();
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

    const plane = this.drawingPlaneMesh || (this.modelRoot.getObjectByName('DrawingPlaneCanvas') as THREE.Mesh);
    if (plane) {
      const planeQuat = new THREE.Quaternion();
      plane.getWorldQuaternion(planeQuat);
      right = new THREE.Vector3(1, 0, 0).applyQuaternion(planeQuat).normalize();
      up = new THREE.Vector3(0, 1, 0).applyQuaternion(planeQuat).normalize();
    } else {
      const forward = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
      right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
      up = new THREE.Vector3().crossVectors(right, forward).normalize();
    }

    const step = 0.08 * this.navigatorSensitivity;
    const worldDelta = new THREE.Vector3()
      .addScaledVector(right, deltaX * step)
      .addScaledVector(up, deltaY * step);

    const transMatrix = new THREE.Matrix4().makeTranslation(worldDelta.x, worldDelta.y, worldDelta.z);
    this.applyTransformMatrix(transMatrix, scope);
    this.markDirty();
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
    let angle = deltaAngleRad * this.navigatorSensitivity;
    if (isLocked) {
      const step = Math.PI / 12; // 15 degrees
      angle = Math.round(angle / step) * step;
      if (Math.abs(angle) < 0.0001) return;
    }

    const center = this.getSelectionCenter(scope);
    let normal = new THREE.Vector3(0, 0, 1);

    const plane = this.drawingPlaneMesh || (this.modelRoot.getObjectByName('DrawingPlaneCanvas') as THREE.Mesh);
    if (plane) {
      const planeQuat = new THREE.Quaternion();
      plane.getWorldQuaternion(planeQuat);
      normal = new THREE.Vector3(0, 0, 1).applyQuaternion(planeQuat).normalize();
    } else {
      normal = this.camera.getWorldDirection(new THREE.Vector3()).normalize().negate();
    }

    const toCenter = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    const fromCenter = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z);
    const rotMat = new THREE.Matrix4().makeRotationAxis(normal, angle);

    const finalMat = new THREE.Matrix4()
      .multiply(fromCenter)
      .multiply(rotMat)
      .multiply(toCenter);

    this.applyTransformMatrix(finalMat, scope);
    this.markDirty();
  }

  /**
   * Aligns targeted drawing plane surface directly facing the current camera
   */
  public alignSurfaceToCamera(scope: TransformTargetScope = 'all'): void {
    const camQuat = this.camera.quaternion.clone();
    const plane = this.drawingPlaneMesh || (this.modelRoot.getObjectByName('DrawingPlaneCanvas') as THREE.Mesh);
    if (plane) {
      plane.quaternion.copy(camQuat);
      plane.updateMatrixWorld(true);
    } else {
      this.modelRoot.quaternion.copy(camQuat);
      this.modelRoot.updateMatrixWorld(true);
    }
    this.markDirty();
  }

  /**
   * Sets exact surface orientation (pitch and roll angles in degrees)
   */
  public setSurfaceOrientation(pitchDeg: number, rollDeg: number, scope: TransformTargetScope = 'all'): void {
    const DEG = Math.PI / 180;
    const plane = this.drawingPlaneMesh || (this.modelRoot.getObjectByName('DrawingPlaneCanvas') as THREE.Mesh);
    const target = (plane && (scope === 'all' || (scope as string) === 'plane')) ? plane : this.modelRoot;
    if (target) {
      this.beginTransform(scope);
      const e = new THREE.Euler().setFromQuaternion(target.quaternion, 'YXZ');
      target.quaternion.setFromEuler(new THREE.Euler(pitchDeg * DEG, e.y, rollDeg * DEG, 'YXZ'));
      target.updateMatrixWorld(true);
      this.endTransform();
      this.markDirty();
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
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    if (!box.isEmpty()) {
      const minY = box.min.y;
      this.modelRoot.position.y -= minY;
      this.modelRoot.updateMatrixWorld(true);
    }
  }

  /**
   * Detects if the current camera view has snapped to a "Perfect View" (orthographic elevation).
   * Identifies the depth axis to allow automatic UI collapse and prevent Z plotting errors.
   */
  /**
   * Detects an axis-aligned "perfect" camera view.
   *
   * Runs every frame, so it writes into a reused result object and compares against
   * module-level axis constants instead of allocating eight objects per call.
   * The returned object is owned by the engine - copy fields out before retaining it.
   */
  public getPerfectView(): PerfectViewInfo {
    const dir = this.camera.getWorldDirection(_viewDirScratch).normalize();
    const threshold = 0.985; // ~10 degrees tolerance
    const out = this.perfectViewScratch;

    if (dir.dot(_AXIS_FRONT) > threshold) {
      out.isPerfect = true;
      out.view = 'front';
      out.depthAxis = 'z';
    } else if (dir.dot(_AXIS_BACK) > threshold) {
      out.isPerfect = true;
      out.view = 'back';
      out.depthAxis = 'z';
    } else if (dir.dot(_AXIS_TOP) > threshold) {
      out.isPerfect = true;
      out.view = 'top';
      out.depthAxis = 'y';
    } else if (dir.dot(_AXIS_BOTTOM) > threshold) {
      out.isPerfect = true;
      out.view = 'bottom';
      out.depthAxis = 'y';
    } else if (dir.dot(_AXIS_RIGHT) > threshold) {
      out.isPerfect = true;
      out.view = 'right';
      out.depthAxis = 'x';
    } else if (dir.dot(_AXIS_LEFT) > threshold) {
      out.isPerfect = true;
      out.view = 'left';
      out.depthAxis = 'x';
    } else {
      out.isPerfect = false;
      out.view = null;
      out.depthAxis = null;
    }

    return out;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  private projectionMode: 'perspective' | 'orthographic' = 'perspective';
  private savedPerspectiveFov: number = 45;
  public onProjectionChange?: (mode: 'perspective' | 'orthographic', fov: number) => void;

  public getFov(): number {
    return this.camera.fov;
  }

  public setFov(fov: number): void {
    const clamped = Math.max(12, Math.min(105, fov));
    this.camera.fov = clamped;
    this.camera.updateProjectionMatrix();
    if (this.projectionMode === 'orthographic' && clamped > 22) {
      this.projectionMode = 'perspective';
    }
    this.onProjectionChange?.(this.projectionMode, clamped);
  }

  public adjustFov(delta: number): number {
    this.setFov(this.camera.fov + delta);
    return this.camera.fov;
  }

  public getProjectionMode(): 'perspective' | 'orthographic' {
    return this.projectionMode;
  }

  public setProjectionMode(mode: 'perspective' | 'orthographic'): void {
    this.projectionMode = mode;
    if (mode === 'orthographic') {
      this.savedPerspectiveFov = this.camera.fov;
      this.camera.fov = 15; // Low distortion isometric telephoto
    } else {
      this.camera.fov = this.savedPerspectiveFov || 45;
    }
    this.camera.updateProjectionMatrix();
    this.onProjectionChange?.(this.projectionMode, this.camera.fov);
  }

  public toggleProjectionMode(): 'perspective' | 'orthographic' {
    const nextMode = this.projectionMode === 'perspective' ? 'orthographic' : 'perspective';
    this.setProjectionMode(nextMode);
    return nextMode;
  }

  public resetCamera(): void {
    this.resetView();
  }

  /**
   * Snaps camera perspective smoothly to an exact orthographic elevation or isometric angle
   */
  public snapToView(view: PerfectViewType): void {
    const radius = Math.max(this.targetSpherical.radius, 2.0);
    switch (view) {
      case 'front':
        this.targetSpherical.set(radius, Math.PI / 2, 0);
        break;
      case 'back':
        this.targetSpherical.set(radius, Math.PI / 2, Math.PI);
        break;
      case 'top':
        this.targetSpherical.set(radius, 0.001, 0);
        break;
      case 'bottom':
        this.targetSpherical.set(radius, Math.PI - 0.001, 0);
        break;
      case 'right':
        this.targetSpherical.set(radius, Math.PI / 2, Math.PI / 2);
        break;
      case 'left':
        this.targetSpherical.set(radius, Math.PI / 2, -Math.PI / 2);
        break;
      case 'isometric':
        this.targetSpherical.set(radius, Math.PI / 2.3, Math.PI / 4);
        break;
    }
    this.markDirty();
  }

  /**
   * Smoothly orients the actual 3D model or drawing canvas plane directly (WITHOUT moving camera)
   */
  public orientModelOrSurface(view: PerfectViewType, scope: TransformTargetScope = 'all'): void {
    switch (view) {
      case 'front':
        this.modelRoot.rotation.set(0, 0, 0);
        break;
      case 'back':
        this.modelRoot.rotation.set(0, Math.PI, 0);
        break;
      case 'top':
        this.modelRoot.rotation.set(Math.PI / 2, 0, 0);
        break;
      case 'bottom':
        this.modelRoot.rotation.set(-Math.PI / 2, 0, 0);
        break;
      case 'right':
        this.modelRoot.rotation.set(0, -Math.PI / 2, 0);
        break;
      case 'left':
        this.modelRoot.rotation.set(0, Math.PI / 2, 0);
        break;
      case 'isometric':
        this.modelRoot.rotation.set(-Math.PI * 0.15, Math.PI * 0.25, 0);
        break;
    }
    this.modelRoot.updateMatrixWorld(true);
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
    this.modelRoot.scale.multiplyScalar(factor);
    this.modelRoot.updateMatrixWorld(true);
  }

  /**
   * Resets model/surface and stroke transforms without affecting camera
   */
  public resetTransform(scope: TransformTargetScope = 'all'): void {
    if (scope === 'all' || scope === 'model') {
      this.modelRoot.position.set(0, 0, 0);
      this.modelRoot.rotation.set(0, 0, 0);
      this.modelRoot.scale.set(1, 1, 1);
      this.modelRoot.updateMatrixWorld(true);

      const modelChildren = this.modelRoot.children.filter((c) => c !== this.strokeRoot);
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
      this.strokeRoot.position.set(0, 0, 0);
      this.strokeRoot.rotation.set(0, 0, 0);
      this.strokeRoot.scale.set(1, 1, 1);
      this.strokeRoot.updateMatrixWorld(true);

      this.strokes.forEach(({ meshes }) => {
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

  /**
   * Switch Lighting & Environment Presets
   */
  public setLightingPreset(preset: LightingPreset): void {
    this.ensureBaselineLighting();
    switch (preset) {
      case 'studio':
        this.setStudioLightingMode('studio');
        break;
      case 'daylight':
        this.applySkyPresetIfEnabled('clear-day');
        break;
      case 'neon':
        this.applySkyPresetIfEnabled('cyberpunk-neon');
        break;
      case 'sunset':
        this.applySkyPresetIfEnabled('sunset-dusk');
        break;
      case 'clay_neutral':
        this.setStudioLightingMode('studio');
        this.setModelDisplayMode('clay');
        break;
    }
  }

  public getStudioLightingState(): Readonly<StudioLightingState> {
    return {
      ...this.studioLightingState,
      direction: { ...this.studioLightingState.direction },
    };
  }

  public setStudioLightingMode(mode: 'studio' | 'north' | 'softbox' | 'silhouette'): void {
    this.ensureBaselineLighting();
    this.studioLightingState.mode = mode;
    if (this.skyEngine) {
      this.skyEngine.setCustomOffBackground(this.studioBackdropTexture);
      this.skyEngine.applyPreset('off');
    }
    if (this.studioBackdropTexture) {
      this.scene.background = this.studioBackdropTexture;
    }

    const isLight = this.currentStudioTheme === 'light';

    switch (mode) {
      case 'studio':
        // Signature warm directional key + balanced fill + subtle contour rim
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.32;
        this.hemiLight.color.setHex(0xfff7ee);
        this.hemiLight.groundColor.setHex(isLight ? 0xb5ab9f : 0x1a1b1d);
        this.hemiLight.intensity = 0.52;
        this.dirLight1.color.setHex(0xfff7ec);
        this.dirLight1.position.set(4.5, 7.5, 5.0);
        this.dirLight1.intensity = 1.6;
        this.dirLight1.shadow.radius = 7;
        this.dirLight2.color.setHex(0xe2e8f0);
        this.dirLight2.position.set(-4.5, 3.2, -4.0);
        this.dirLight2.intensity = 0.38;
        this.studioLightingState.color = '#fff7ec';
        this.studioLightingState.intensity = 1.6;
        break;

      case 'north':
        // High-angle diffuse window light, calm cool-neutral tone
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.38;
        this.hemiLight.color.setHex(0xecf2fa);
        this.hemiLight.groundColor.setHex(isLight ? 0xb2abb5 : 0x181a1d);
        this.hemiLight.intensity = 0.65;
        this.dirLight1.color.setHex(0xf0f4fc);
        this.dirLight1.position.set(0.8, 9.5, 3.0);
        this.dirLight1.intensity = 1.45;
        this.dirLight1.shadow.radius = 10;
        this.dirLight2.color.setHex(0xdbeafe);
        this.dirLight2.position.set(-1.0, 2.0, -4.5);
        this.dirLight2.intensity = 0.25;
        this.studioLightingState.color = '#f0f4fc';
        this.studioLightingState.intensity = 1.45;
        break;

      case 'softbox':
        // Broad wrap-around diffused studio lighting with very soft shadows
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.44;
        this.hemiLight.color.setHex(0xfffcf5);
        this.hemiLight.groundColor.setHex(isLight ? 0xbaaead : 0x222428);
        this.hemiLight.intensity = 0.7;
        this.dirLight1.color.setHex(0xfff9f2);
        this.dirLight1.position.set(3.8, 6.2, 4.5);
        this.dirLight1.intensity = 1.5;
        this.dirLight1.shadow.radius = 12;
        this.dirLight2.color.setHex(0xf1f5f9);
        this.dirLight2.position.set(-3.8, 4.5, 2.5);
        this.dirLight2.intensity = 0.48;
        this.studioLightingState.color = '#fff9f2';
        this.studioLightingState.intensity = 1.5;
        break;

      case 'silhouette':
        // Dramatic sculpture photography with intense rim kicker and deep contrast
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.16;
        this.hemiLight.color.setHex(0xe2e8f0);
        this.hemiLight.groundColor.setHex(isLight ? 0x908a82 : 0x0f1011);
        this.hemiLight.intensity = 0.28;
        this.dirLight1.color.setHex(0xfffaed);
        this.dirLight1.position.set(-3.5, 4.5, -5.5);
        this.dirLight1.intensity = 2.4;
        this.dirLight1.shadow.radius = 5;
        this.dirLight2.color.setHex(0xdbeafe);
        this.dirLight2.position.set(3.5, 2.8, -4.5);
        this.dirLight2.intensity = 1.4;
        this.studioLightingState.color = '#fffaed';
        this.studioLightingState.intensity = 2.4;
        break;
    }
    this.markDirty();
  }

  public setStudioSoftness(softness?: number): void {
    const safeSoftness = typeof softness === 'number' && !isNaN(softness) ? softness : 0.65;
    const s = Math.max(0.1, Math.min(1.0, safeSoftness));
    this.studioLightingState.softness = s;
    if (this.dirLight1 && this.dirLight1.shadow) {
      this.dirLight1.shadow.radius = 2 + s * 12;
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = 0.35 + s * 0.45;
    }
    this.markDirty();
  }

  public setStudioLightDirection(dir?: { x: number; y: number; z: number }): void {
    if (!dir || typeof dir.x !== 'number' || typeof dir.y !== 'number' || typeof dir.z !== 'number') return;
    this.studioLightingState.direction = { x: dir.x, y: dir.y, z: dir.z };
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dist = 9.5;
    if (this.dirLight1) {
      this.dirLight1.position.set(
        (dir.x / len) * dist,
        Math.max(1.8, (dir.y / len) * dist),
        (dir.z / len) * dist
      );
      this.dirLight1.updateMatrixWorld();
    }
    if (this.dirLight2) {
      const fillDist = 6.5;
      this.dirLight2.position.set(
        (-dir.x / len) * fillDist,
        Math.max(1.5, Math.abs(dir.y / len) * 0.5 * fillDist + 1.2),
        (-dir.z / len) * fillDist
      );
      this.dirLight2.updateMatrixWorld();
    }
    this.markDirty();
  }

  public setStudioLightIntensity(intensity?: number): void {
    const safeIntensity = typeof intensity === 'number' && !isNaN(intensity) ? intensity : 1.6;
    this.studioLightingState.intensity = safeIntensity;
    if (this.dirLight1) {
      this.dirLight1.intensity = Math.max(0.2, safeIntensity);
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = Math.max(0.15, safeIntensity * 0.35);
    }
    this.markDirty();
  }

  public setStudioLightColor(colorHex?: string): void {
    if (!colorHex) return;
    this.studioLightingState.color = colorHex;
    if (this.dirLight1) {
      this.dirLight1.color.set(colorHex);
    }
    if (this.hemiLight) {
      this.hemiLight.color.set(colorHex);
    }
    this.markDirty();
  }

  public setStudioFloorShadow(visible: boolean): void {
    this.studioLightingState.shadowFloor = visible;
    if (this.studioGroundMesh) {
      this.studioGroundMesh.visible = visible;
    }
    const contactShadow = this.helperRoot.getObjectByName('ModelGroundContactShadow') as THREE.Mesh | null;
    if (contactShadow) {
      contactShadow.visible = visible;
    }
    this.markDirty();
  }

  public setStudioGridVisible(visible: boolean): void {
    this.studioLightingState.showGrid = visible;
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
    this.markDirty();
  }

  private applyStudioBackdrop(theme: 'light' | 'dark'): void {
    this.studioBackdropTexture?.dispose();
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const light = theme === 'light';
    // A seamless cyclorama: brighter around the subject with a quiet falloff
    // toward the edges. The off-centre glow makes the light feel directional
    // without drawing a visible floor or horizon into the scene.
    const glow = ctx.createRadialGradient(480, 420, 24, 512, 512, 780);
    glow.addColorStop(0, light ? '#ede7de' : '#303235');
    glow.addColorStop(0.45, light ? '#dfd7cc' : '#232527');
    glow.addColorStop(1, light ? '#c6beb2' : '#141516');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Directional tonal wash: warm limestone in Light and graphite suede in
    // Dark. It keeps the centre calm and adds depth without a visible horizon.
    const studioWash = ctx.createLinearGradient(60, 20, 960, 980);
    studioWash.addColorStop(0, light ? 'rgba(255,250,242,0.18)' : 'rgba(255,255,255,0.035)');
    studioWash.addColorStop(0.46, light ? 'rgba(225,215,202,0.015)' : 'rgba(0,0,0,0.01)');
    studioWash.addColorStop(1, light ? 'rgba(125,110,95,0.08)' : 'rgba(0,0,0,0.22)');
    ctx.fillStyle = studioWash;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Broad irregular tonal blooms create the character of hand-finished
    // plaster/cloth. Deterministic noise avoids flicker when themes change.
    let seed = light ? 1847 : 4861;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 72; i += 1) {
      const x = random() * 1024;
      const y = random() * 1024;
      const radius = 38 + random() * 170;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const pale = random() > 0.5;
      const alpha = light ? 0.022 + random() * 0.018 : 0.018 + random() * 0.022;
      const tone = light
        ? (pale ? `rgba(255,250,240,${alpha})` : `rgba(103,88,72,${alpha * 0.7})`)
        : (pale ? `rgba(212,216,216,${alpha})` : `rgba(0,0,0,${alpha})`);
      cloud.addColorStop(0, tone);
      cloud.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cloud;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    // Sparse, hairline fibres stop the surface reading as computer-generated
    // noise. They remain invisible as individual lines at normal scale.
    ctx.lineCap = 'round';
    for (let i = 0; i < 280; i += 1) {
      const x = random() * 1024;
      const y = random() * 1024;
      const length = 7 + random() * 34;
      const rise = (random() - 0.5) * 5;
      ctx.strokeStyle = light
        ? `rgba(${random() > 0.5 ? '255,252,246' : '105,92,77'},${0.018 + random() * 0.018})`
        : `rgba(${random() > 0.5 ? '220,224,224' : '0,0,0'},${0.018 + random() * 0.02})`;
      ctx.lineWidth = 0.45 + random() * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + length * 0.5, y + rise, x + length, y + rise * 0.35);
      ctx.stroke();
    }

    // A tiny irregular matte grain prevents the synthetic, flat-color look.
    // It is intentionally below "visible noise" level and reads as paper/studio fabric.
    let grainSeed = light ? 7319 : 9323;
    const grainRandom = () => {
      grainSeed = (grainSeed * 1664525 + 1013904223) >>> 0;
      return grainSeed / 4294967296;
    };
    for (let i = 0; i < 12500; i += 1) {
      const alpha = light ? 0.012 + grainRandom() * 0.018 : 0.014 + grainRandom() * 0.024;
      const value = light ? (grainRandom() > 0.5 ? 255 : 95) : (grainRandom() > 0.5 ? 255 : 0);
      ctx.fillStyle = `rgba(${value},${value},${value},${alpha})`;
      const size = grainRandom() > 0.94 ? 2 : 1;
      ctx.fillRect(grainRandom() * 1024, grainRandom() * 1024, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    this.studioBackdropTexture = texture;
    this.scene.background = texture;
    if (this.skyEngine) {
      this.skyEngine.setCustomOffBackground(texture);
    }
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.currentStudioTheme = theme;
    const gridWasVisible = this.gridHelper?.visible ?? false;
    if (theme === 'light') {
      this.applyStudioBackdrop('light');
      this.renderer.toneMappingExposure = 0.92;
      if (this.gridHelper) {
        this.helperRoot.remove(this.gridHelper);
        this.gridHelper.geometry.dispose();
        this.gridHelper = new THREE.GridHelper(10, 20, 0xcfd8dc, 0xe2e8f0);
        this.gridHelper.position.y = -1.2;
        this.gridHelper.visible = gridWasVisible;
        this.helperRoot.add(this.gridHelper);
      }
      // Product-studio lighting: restrained ambience preserves form while a
      // broad warm key from above-left produces the premium reference look.
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.28;
      this.hemiLight.color.setHex(0xfff8ee);
      this.hemiLight.groundColor.setHex(0xb5ab9f);
      this.hemiLight.intensity = 0.52;
      this.dirLight1.color.setHex(0xfff6ea);
      this.dirLight1.position.set(4.5, 7.5, 5.0);
      this.dirLight1.intensity = 1.6;
      this.dirLight1.shadow.radius = 7;
      this.dirLight2.color.setHex(0xdce7ee);
      this.dirLight2.position.set(-4.5, 3.0, -4.0);
      this.dirLight2.intensity = 0.32;

      const groundMaterial = this.studioGroundMesh?.material as THREE.ShadowMaterial | undefined;
      if (groundMaterial) groundMaterial.opacity = 0.18;
      const contactShadow = this.helperRoot.getObjectByName('ModelGroundContactShadow') as THREE.Mesh | null;
      const contactMaterial = contactShadow?.material as THREE.MeshBasicMaterial | undefined;
      if (contactMaterial) contactMaterial.opacity = 0.48;
    } else {
      // Comfortable dark slate theme
      this.applyStudioBackdrop('dark');
      this.renderer.toneMappingExposure = 1.0;
      if (this.gridHelper) {
        this.helperRoot.remove(this.gridHelper);
        this.gridHelper.geometry.dispose();
        this.gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
        this.gridHelper.position.y = -1.2;
        this.gridHelper.visible = gridWasVisible;
        this.helperRoot.add(this.gridHelper);
      }
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.32;
      this.hemiLight.color.setHex(0xe4e7eb);
      this.hemiLight.groundColor.setHex(0x191a1c);
      this.hemiLight.intensity = 0.5;
      this.dirLight1.color.setHex(0xfff8f0);
      this.dirLight1.position.set(4.5, 7.5, 5.0);
      this.dirLight1.intensity = 1.6;
      this.dirLight1.shadow.radius = 7;
      this.dirLight2.color.setHex(0xb5c0cc);
      this.dirLight2.position.set(-4.5, 3.0, -4.0);
      this.dirLight2.intensity = 0.35;

      const groundMaterial = this.studioGroundMesh?.material as THREE.ShadowMaterial | undefined;
      if (groundMaterial) groundMaterial.opacity = 0.28;
      const contactShadow = this.helperRoot.getObjectByName('ModelGroundContactShadow') as THREE.Mesh | null;
      const contactMaterial = contactShadow?.material as THREE.MeshBasicMaterial | undefined;
      if (contactMaterial) contactMaterial.opacity = 0.72;
    }
  }

  public toggleWireframe(show: boolean): void {
    this.targetMeshes.forEach((mesh) => {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          if ('wireframe' in m) {
            (m as THREE.MeshStandardMaterial).wireframe = show;
          }
        });
      } else if (mesh.material && 'wireframe' in mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).wireframe = show;
      }
    });
  }

  public setWireframe(show: boolean): void {
    this.toggleWireframe(show);
  }

  public toggleGrid(show: boolean): void {
    this.gridHelper.visible = show;
  }

  public setGrid(show: boolean): void {
    this.toggleGrid(show);
  }

  public setModelDisplayMode(mode: ModelDisplayMode): void {
    if (!mode) return;
    this.modelDisplayMode = mode;
    const isLight = this.currentStudioTheme === 'light';
    this.targetMeshes.forEach((mesh) => {
      if (mode === 'clay') {
        if (!mesh.userData.originalMaterial) {
          mesh.userData.originalMaterial = mesh.material;
        }
        const clayMat = new THREE.MeshStandardMaterial({
          color: isLight ? 0xdedad2 : 0xd0c9be,
          roughness: 0.78,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        MaterialCache.configureModelMaterial(clayMat);
        mesh.material = clayMat;
      } else {
        if (mesh.userData.originalMaterial) {
          mesh.material = mesh.userData.originalMaterial;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if (m) MaterialCache.configureModelMaterial(m);
          });
        }
      }
    });
    this.markDirty();
  }

  /**
   * Directly skins the loaded 3D model with a custom ShaderMaterial or MatCap material
   */
  public setModelCustomMaterial(material: THREE.Material): void {
    this.targetMeshes.forEach((mesh) => {
      if (!mesh.userData.originalMaterial) {
        mesh.userData.originalMaterial = mesh.material;
      }
      MaterialCache.configureModelMaterial(material);
      mesh.material = material;
      mesh.material.needsUpdate = true;
    });
  }

  public setModelOpacity(opacity: number): void {
    this.modelOpacity = opacity;
    this.targetMeshes.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m) {
          m.transparent = opacity < 0.999;
          m.opacity = opacity;
          m.needsUpdate = true;
        }
      });
    });
  }

  public setModelWireframeOpacity(opacity: number): void {
    this.modelWireframeOpacity = opacity;
    this.targetMeshes.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m && 'wireframe' in m) {
          (m as any).wireframe = opacity > 0.05;
          m.needsUpdate = true;
        }
      });
    });
  }

  public getModelDisplayMode(): ModelDisplayMode {
    return this.modelDisplayMode;
  }

  public getIsModelVisible(): boolean {
    return this.isModelVisible;
  }

  public toggleModelVisibility(visible?: boolean): boolean {
    this.isModelVisible = visible !== undefined ? visible : !this.isModelVisible;
    this.modelRoot.children.forEach((child) => {
      if (child.name !== 'DrawingPlaneCanvas' && child !== this.strokeRoot) {
        child.visible = this.isModelVisible;
      }
    });
    this.targetMeshes.forEach((mesh) => {
      if (mesh.name !== 'DrawingPlaneCanvas') {
        mesh.visible = this.isModelVisible;
      }
    });
    return this.isModelVisible;
  }

  /**
   * Clones the currently active 3D model with an offset in the scene,
   * cloning its materials and computing raycast acceleration trees.
   */
  public cloneModel(offset: THREE.Vector3 = new THREE.Vector3(1.5, 0, 0)): THREE.Object3D | null {
    // Find either selected model or first loaded model in modelRoot
    let activeModel = this.activeSelectedModelId
      ? this.modelRoot.children.find((c) => c.uuid === this.activeSelectedModelId && c !== this.strokeRoot)
      : null;
    if (!activeModel) {
      activeModel = this.modelRoot.children.find(
        (c) => c !== this.strokeRoot && c.name !== 'DrawingPlaneCanvas'
      ) || this.modelRoot.children.find((c) => c !== this.strokeRoot);
    }
    if (!activeModel) return null;

    const cloned = activeModel.clone(true);
    const existingModelsCount = this.modelRoot.children.filter(
      (c) => c !== this.strokeRoot && c.name !== 'DrawingPlaneCanvas'
    ).length;
    cloned.name = `${activeModel.name || '3D Model'} (Copy ${existingModelsCount + 1})`;
    cloned.position.add(offset);
    this.modelRoot.add(cloned);

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        this.targetMeshes.push(child);
        if (child.material) {
          child.material = Array.isArray(child.material)
            ? child.material.map((m) => m.clone())
            : child.material.clone();
          child.userData.originalMaterial = child.material;
        }
        try {
          this.fastRaycaster.updateMeshBVH(child);
        } catch (_) {}
      }
    });

    this.modelMetadata.meshCount = this.targetMeshes.length;
    if (this.onMetadataUpdate) {
      this.onMetadataUpdate(this.modelMetadata);
    }
    this.notifyModelsChanged();
    return cloned;
  }

  public centerModelToOrigin(): void {
    this.targetPosition.set(0, 0, 0);
    this.targetSpherical.radius = 5.2;
  }

  /**
    * Explicit sky selection from the Skybox panel. This is a deliberate user
    * action, so it re-enables the dome even on a low-power device.
    */
  public setSkyPreset(preset: SkyPresetName): void {
    this.skyEnabled = preset !== 'off';
    this.skyEngine.applyPreset(preset);
    this.markDirty();
  }

  /** Applies a sky preset only when the dome is currently permitted. */
  private applySkyPresetIfEnabled(preset: string): void {
    if (!this.skyEngine || !this.skyEnabled) return;
    this.skyEngine.applyPreset(preset);
  }

  public setSunAngles(azimuthDeg: number, elevationDeg: number): void {
    this.skyEngine.setSunAngles(azimuthDeg, elevationDeg);
  }

  public setSunPositionVector(x: number, y: number, z: number): void {
    this.skyEngine.setSunPositionVector(x, y, z);
  }

  public setTimeOfDay(hours: number): void {
    this.skyEngine.setTimeOfDay(hours);
  }

  public getTimeOfDay(): number {
    return this.skyEngine.getTimeOfDay();
  }

  public setSunIntensity(intensity: number): void {
    this.skyEngine.setSunIntensity(intensity);
  }

  public setSunColor(colorHex: string): void {
    this.skyEngine.setSunColor(colorHex);
  }

  public setAmbientIntensity(intensity: number): void {
    this.skyEngine.setAmbientIntensity(intensity);
  }

  public setSunCoronaIntensity(val: number): void {
    this.skyEngine.setSunCoronaIntensity(val);
  }

  public getIlluminationState() {
    return this.skyEngine.getIlluminationState();
  }

  public setCloudCoverage(coverage: number): void {
    this.skyEngine.setCloudCoverage(coverage);
  }

  public setCloudDensity(density: number): void {
    this.skyEngine.setCloudDensity(density);
  }

  public setCloudSpeed(speed: number): void {
    this.skyEngine.setCloudSpeed(speed);
  }

  public setCloudWindAngle(degrees: number): void {
    this.skyEngine.setCloudWindAngle(degrees);
  }

  public setCloudScale(scale: number): void {
    this.skyEngine.setCloudScale(scale);
  }

  public setCloudTurbulence(turb: number): void {
    this.skyEngine.setCloudTurbulence(turb);
  }

  public setCloudOpacity(opacity: number): void {
    this.skyEngine.setCloudOpacity(opacity);
  }

  public setCloudColor(hex: string): void {
    this.skyEngine.setCloudColor(hex);
  }

  public setCloudShadow(hex: string): void {
    this.skyEngine.setCloudShadow(hex);
  }

  public setEnableClouds(enabled: boolean): void {
    this.skyEngine.setEnableClouds(enabled);
  }

  public setEnableGodRays(enabled: boolean): void {
    this.skyEngine.setEnableGodRays(enabled);
  }

  public setGodRaysIntensity(intensity: number): void {
    this.skyEngine.setGodRaysIntensity(intensity);
  }

  public setGodRaysDensity(density: number): void {
    this.skyEngine.setGodRaysDensity(density);
  }

  public setGodRaysDecay(decay: number): void {
    this.skyEngine.setGodRaysDecay(decay);
  }

  public setGodRaysColor(hex: string): void {
    this.skyEngine.setGodRaysColor(hex);
  }

  public getSkySettings(): SkySettings {
    return this.skyEngine.getSettings();
  }

  /**
   * Guarantees active environmental illumination and PBR reflection map,
   * preventing 3D imported models from rendering solid black.
   */
  public ensureBaselineLighting(): void {
    if (!this.lightsRoot) {
      this.lightsRoot = new THREE.Group();
      this.scene.add(this.lightsRoot);
    }

    if (!this.ambientLight || !this.ambientLight.parent) {
      if (!this.ambientLight) {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
      }
      this.lightsRoot.add(this.ambientLight);
    }
    if (this.ambientLight.intensity <= 0) {
      this.ambientLight.intensity = 0.35;
    }

    if (!this.hemiLight || !this.hemiLight.parent) {
      if (!this.hemiLight) {
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.55);
      }
      this.lightsRoot.add(this.hemiLight);
    }

    if (!this.dirLight1 || !this.dirLight1.parent) {
      if (!this.dirLight1) {
        this.dirLight1 = new THREE.DirectionalLight(0xfff7ec, 1.6);
        this.dirLight1.position.set(4.5, 7.5, 5.0);
      }
      this.lightsRoot.add(this.dirLight1);
    }
    if (this.dirLight1.intensity <= 0) {
      this.dirLight1.intensity = 1.6;
    }

    if (!this.dirLight2 || !this.dirLight2.parent) {
      if (!this.dirLight2) {
        this.dirLight2 = new THREE.DirectionalLight(0xe0f2fe, 0.9);
        this.dirLight2.position.set(-6, -2, -6);
      }
      this.lightsRoot.add(this.dirLight2);
    }

    if (this.skyEngine) {
      this.skyEngine.setLights(this.dirLight1, this.ambientLight, this.dirLight2, this.hemiLight);
    }

    // Ensure environment map exists for MeshStandardMaterial PBR reflections.
    // Skipped on low-power hardware: the PMREM convolution is a multi-pass GPU job
    // and the resulting cubemap adds a sampler to every lit fragment.
    if (!this.scene.environment && this.renderer && this.profile.environmentMap) {
      try {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        const roomEnv = new RoomEnvironment();
        const envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
        this.scene.environment = envTexture;
        this.generatedEnvTexture = envTexture;
        pmremGenerator.dispose();
        roomEnv.dispose?.();
      } catch (e) {
        console.warn('PMREM environment generation notice:', e);
      }
    }
  }

  /**
   * Export Combined Scene to GLB
   */
  public async exportGLB(): Promise<Blob> {
    const exportScene = new THREE.Scene();

    // Clone model
    const modelClone = this.modelRoot.clone(true);
    exportScene.add(modelClone);

    // Clone strokes
    const strokeClone = this.strokeRoot.clone(true);
    exportScene.add(strokeClone);

    const exporter = new GLTFExporter();
    return new Promise((resolve, reject) => {
      exporter.parse(
        exportScene,
        (gltf) => {
          const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
          resolve(blob);
        },
        reject,
        { binary: true }
      );
    });
  }

  /**
   * Export Combined Scene to OBJ
   */
  public exportOBJ(): string {
    const exportScene = new THREE.Scene();
    exportScene.add(this.modelRoot.clone(true));
    exportScene.add(this.strokeRoot.clone(true));

    const exporter = new OBJExporter();
    return exporter.parse(exportScene);
  }

  /**
   * Capture high-res screenshot
   */
  public captureSnapshot(): string {
    this.cursorDecal.visible = false;
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    this.cursorDecal.visible = true;
    return dataUrl;
  }

  /**
   * Resizes the swapchain and dependent render targets.
   *
   * ResizeObserver can fire many times per frame during an orientation change or
   * on-screen-keyboard animation, and each reallocation of the offscreen targets
   * is a multi-megabyte GPU allocation. Requests are coalesced into a single
   * apply on the next animation frame.
   */
  public resize(width: number, height: number): void {
    if (!width || !height) return;
    if (this.pendingResize) {
      this.pendingResize.width = width;
      this.pendingResize.height = height;
    } else {
      this.pendingResize = { width, height };
    }
    if (this.resizeRafId !== null) return;

    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      const pending = this.pendingResize;
      this.pendingResize = null;
      if (!pending) return;
      this.applyResize(pending.width, pending.height);
    });
  }

  private applyResize(width: number, height: number): void {
    if (!width || !height || this.isContextLost) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.fastRaycaster) {
      this.fastRaycaster.setViewport(width, height);
    }
    // Re-clamp the pixel ratio: browser zoom and multi-display moves change DPR.
    this.renderer.setPixelRatio(resolvePixelRatio(this.profile));
    this.renderer.setSize(width, height);
    if (this.postEngine) {
      this.postEngine.setSize(width, height);
    }
    this.refreshRect();
    this.markDirty();
  }

  public setPostProcessSettings(settings: Partial<PostProcessSettings>): void {
    if (this.postEngine) {
      this.postEngine.updateSettings(settings);
    }
  }

  public getPostProcessSettings(): PostProcessSettings {
    return this.postEngine ? this.postEngine.getSettings() : {
      renderMode: 'draft',
      toonShading: false,
      toonSteps: 3,
      bloom: true,
      bloomIntensity: 1.2,
      bloomRadius: 0.8,
      bloomThreshold: 0.85,
      dof: false,
      dofFocusDistance: 2.5,
      dofAperture: 0.015,
      grain: false,
      grainIntensity: 0.08,
      pixelation: false,
      pixelSize: 4,
    };
  }

  private updateCameraPosition(): void {
    // Smooth camera damping
    this.cameraSpherical.theta += (this.targetSpherical.theta - this.cameraSpherical.theta) * 0.15;
    this.cameraSpherical.phi += (this.targetSpherical.phi - this.cameraSpherical.phi) * 0.15;
    this.cameraSpherical.radius += (this.targetSpherical.radius - this.cameraSpherical.radius) * 0.15;

    this.cameraTarget.lerp(this.targetPosition, 0.15);

    // Reused scratch vector: this runs once per frame.
    _cameraOffset.setFromSpherical(this.cameraSpherical);
    this.camera.position.copy(this.cameraTarget).add(_cameraOffset);
    this.camera.lookAt(this.cameraTarget);

    publishCameraPose(this.cameraSpherical.radius, this.cameraSpherical.theta, this.cameraSpherical.phi);
  }

  private notifyHistory(): void {
    if (this.onHistoryChange) {
      const canUndo = this.historyUndoStack.length > 0 || this.undoStack.length > 0 || this.transformUndoStack.length > 0;
      const canRedo = this.historyRedoStack.length > 0 || this.redoStack.length > 0 || this.transformRedoStack.length > 0;
      this.onHistoryChange(canUndo, canRedo);
    }
    this.onAutoSaveTrigger?.('history');
  }

  private startLoop(): void {
    const loop = (time: number) => {
      this.animationFrameId = requestAnimationFrame(loop);
      if (this.isContextLost) return;

      // FPS tracking. The counter is advanced where the frame is actually
      // rendered (below), not here, so the readout reflects drawn frames rather
      // than rAF callbacks - with frame pacing the two are no longer the same.
      const dt = time - this.lastTime;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 500) {
        this.fps = Math.round((this.frameCount * 1000) / this.fpsTimer);
        this.frameCount = 0;
        this.fpsTimer = 0;
        if (this.onFpsUpdate) {
          this.onFpsUpdate(this.fps);
        }
      }
      this.lastTime = time;

      // --- Frame pacing -------------------------------------------------
      // Camera damping settles asymptotically, so also treat "camera still
      // converging" as activity. Once the scene has been fully static for
      // idleAfterMs the loop drops to idleFps, which is what keeps a fanless
      // tablet out of thermal throttling during long idle periods.
      const cameraSettling = this.isCameraSettling();
      if (cameraSettling || this.isDirty || this.isDrawing) {
        this.lastActivityTime = time;
        this.isDirty = false;
      }
      const isIdle =
        !this.hasAnimatedContent && this.idleFrameIntervalMs > 0 && time - this.lastActivityTime > this.profile.idleAfterMs;
      const interval = isIdle ? this.idleFrameIntervalMs : this.minFrameIntervalMs;
      if (!this.isDrawing && interval > 0 && time - this.lastRenderTime < interval - 0.5) {
        return;
      }
      this.lastRenderTime = time;
      this.frameCount++;

      this.updateCameraPosition();

      if (this.onCameraChange) {
        // Reused payload: the loop must not allocate.
        this.cameraChangePayload.radius = this.cameraSpherical.radius;
        this.cameraChangePayload.theta = this.cameraSpherical.theta;
        this.cameraChangePayload.phi = this.cameraSpherical.phi;
        this.onCameraChange(this.cameraChangePayload);
      }

      // Check for Perfect View changes and notify subscribers
      const pvInfo = this.getPerfectView();
      if (
        pvInfo.isPerfect !== this.lastPerfectViewInfo.isPerfect ||
        pvInfo.view !== this.lastPerfectViewInfo.view ||
        pvInfo.depthAxis !== this.lastPerfectViewInfo.depthAxis
      ) {
        this.lastPerfectViewInfo.isPerfect = pvInfo.isPerfect;
        this.lastPerfectViewInfo.view = pvInfo.view;
        this.lastPerfectViewInfo.depthAxis = pvInfo.depthAxis;
        if (this.onViewChange) {
          // Copy on the change edge only: subscribers store this in React state,
          // which compares by reference and would ignore a mutated scratch object.
          this.onViewChange({
            isPerfect: pvInfo.isPerfect,
            view: pvInfo.view,
            depthAxis: pvInfo.depthAxis,
          });
        }
      }

      // Update animated shader effect uniforms (uTime, uLightDirection, uResolution) without per-frame allocations
      let lightDir: THREE.Vector3 | undefined;
      if (this.dirLight1) {
        this.loopLightDir.copy(this.dirLight1.position).normalize();
        lightDir = this.loopLightDir;
      }
      let res: THREE.Vector2 | undefined;
      if (this.container) {
        this.loopResolution.set(this.container.clientWidth, this.container.clientHeight);
        res = this.loopResolution;
      }
      globalShaderRegistry.update(time * 0.001, lightDir, res);

      // Update procedural sky dome
      if (this.skyEngine) {
        this.skyEngine.update(dt * 0.001, this.camera);
      }

      if (this.postEngine) {
        this.postEngine.render(time * 0.001);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * True while the damped camera has not yet converged on its target pose.
   * Used by the frame pacer so easing motion is never throttled mid-flight.
   */
  private isCameraSettling(): boolean {
    const EPS_ANGLE = 0.0004;
    const EPS_DIST = 0.0008;
    return (
      Math.abs(this.targetSpherical.theta - this.cameraSpherical.theta) > EPS_ANGLE ||
      Math.abs(this.targetSpherical.phi - this.cameraSpherical.phi) > EPS_ANGLE ||
      Math.abs(this.targetSpherical.radius - this.cameraSpherical.radius) > EPS_DIST ||
      this.cameraTarget.distanceToSquared(this.targetPosition) > EPS_DIST * EPS_DIST
    );
  }

  /**
   * Declares that the scene contains continuously animating content (animated
   * shaders, procedural sky motion). While true the idle pacer stays disengaged.
   */
  public setHasAnimatedContent(active: boolean): void {
    this.hasAnimatedContent = active;
    this.markDirty();
  }

  public markDirty(): void {
    this.isDirty = true;
  }

  /** The active adaptive quality profile. */
  public getQualityProfile(): QualityProfile {
    return this.profile;
  }

  /**
   * Sample precise hex color from stroke, UV canvas texture, or screen framebuffer
   */
  public sampleColorAtScreen(screenX: number, screenY: number, clientX?: number, clientY?: number): string {
    // 1. Check direct 3D raycast hit
    const hit = this.raycastModel(screenX, screenY);
    if (hit && hit.hit) {
      if (hit.mesh) {
        // Match against recorded strokes
        for (const strokeData of this.strokes.values()) {
          if (strokeData.meshes.includes(hit.mesh)) {
            return normalizeHexColor(strokeData.descriptor.settings.color, '#38bdf8');
          }
        }
      }
      // Sample painted UV map
      if (hit.uv) {
        const uvSample = this.uvEngine.sampleColorAtUV(hit.uv);
        if (uvSample) return normalizeHexColor(uvSample, '#38bdf8');
      }
    }

    // 2. Read direct pixel from WebGL/WebGPU canvas framebuffer
    try {
      const gl = this.renderer.getContext();
      const dom = this.renderer.domElement;
      const rect = dom.getBoundingClientRect();
      const pixelRatio = this.renderer.getPixelRatio() || 1;

      let px = 0;
      let py = 0;

      if (typeof clientX === 'number' && typeof clientY === 'number') {
        px = Math.floor((clientX - rect.left) * pixelRatio);
        py = Math.floor((rect.height - (clientY - rect.top)) * pixelRatio); // Invert Y for WebGL
      } else {
        px = Math.floor(((screenX + 1) * 0.5) * dom.width);
        py = Math.floor(((screenY + 1) * 0.5) * dom.height);
      }

      px = Math.max(0, Math.min(dom.width - 1, px));
      py = Math.max(0, Math.min(dom.height - 1, py));

      const pixel = new Uint8Array(4);
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

      if (pixel[3] > 0) {
        const r = pixel[0].toString(16).padStart(2, '0');
        const g = pixel[1].toString(16).padStart(2, '0');
        const b = pixel[2].toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    } catch (_) {}

    return '#38bdf8';
  }

  /**
   * Hardware WebGPU & WebGL2 Graphics Pipeline Inspection
   */
  public async detectGPUHardware(): Promise<GPUInfo> {
    try {
      // First probe next-gen WebGPU hardware adapter & compute capabilities
      const webgpuInfo = await webgpuPipeline.getReadyInfo();
      if (webgpuInfo && webgpuInfo.isWebGPUSupported) {
        this.gpuInfo = { ...webgpuInfo };
        this.onGPUInfoUpdate?.(this.gpuInfo);
        return this.gpuInfo;
      }

      // Fallback: WebGL2 Driver & Capability Inspection
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const unmaskedRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      const unmaskedVendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

      this.gpuInfo = {
        backend: isWebGL2 ? 'webgl2' : 'webgl',
        adapterName: unmaskedRenderer || 'High-Performance WebGL Hardware Accelerator',
        vendor: unmaskedVendor || 'GPU Device',
        architecture: isWebGL2 ? 'OpenGL ES 3.0 / WebGL 2.0 Pipeline' : 'OpenGL ES 2.0 / WebGL 1.0 Pipeline',
        isWebGPUSupported: false,
        maxTextureDimension2D: maxTex,
        computeSupport: false,
        powerPreference: 'high-performance',
        driverVersion: 'WebGL Hardware Driver',
        msaaTier: 4,
      };
      this.onGPUInfoUpdate?.(this.gpuInfo);
    } catch (e) {
      console.warn('GPU hardware detection fallback:', e);
    }

    return this.gpuInfo;
  }

  public getGPUInfo(): GPUInfo {
    return this.gpuInfo;
  }

  // ==========================================
  // SPRINT 2: VOLUMETRIC LIQUIFY & CURVE DECIMATION
  // ==========================================

  /**
   * Initializes non-destructive Liquify editing session on active layer strokes
   */
  public startLiquifySession(): void {
    this.liquifyEngine.beginSession(this.strokes, this.activeLayerId);
  }

  /**
   * Applies real-time 3D volumetric vertex deformation
   */
  public applyLiquifyAtScreen(
    screenX: number,
    screenY: number,
    deltaScreenX: number,
    deltaScreenY: number,
    settings: LiquifySettings
  ): void {
    this.liquifyEngine.applyDeformation(
      screenX,
      screenY,
      deltaScreenX,
      deltaScreenY,
      this.camera,
      this.strokes,
      settings,
      this.activeLayerId
    );
  }

  /**
   * Toggles Hold-to-Compare A/B view
   */
  public setLiquifyCompare(active: boolean): void {
    this.liquifyEngine.toggleCompare(active, this.strokes);
  }

  /**
   * Commits current deformed mesh geometry into permanent stroke points and history
   */
  public commitLiquify(): void {
    this.liquifyEngine.commit(this.strokes);
    this.notifyHistory();
  }

  /**
   * Discards live deformations and restores original base state
   */
  public discardLiquify(): void {
    this.liquifyEngine.discard(this.strokes);
  }

  /**
   * Simplifies dense stroke vertices using RDP 3D curve decimation & smooth Bishop frame spline recalculation
   */
  public decimateCurves(
    tolerance: number = 0.006,
    scope: 'layer' | 'all' = 'layer'
  ): { before: number; after: number } {
    const stats = this.liquifyEngine.decimateStrokes(
      this.strokes,
      tolerance,
      scope === 'layer' ? this.activeLayerId : undefined
    );
    this.notifyHistory();
    return stats;
  }

  // ==========================================
  // SPRINT 3: BENT 3D GUIDES & CUSTOM MIRROR PLANE
  // ==========================================

  /**
   * Updates arbitrary 3D mirror plane equation P' = P - 2((P - P0) . n)n
   */
  public setCustomMirrorPlane(
    origin: { x: number; y: number; z: number },
    normal: { x: number; y: number; z: number },
    enabled: boolean
  ): void {
    this.customMirrorOrigin.set(origin.x, origin.y, origin.z);
    this.customMirrorNormal.set(normal.x, normal.y, normal.z).normalize();
    this.customMirrorEnabled = enabled;

    this.loftEngine.createOrUpdateMirrorPlaneMesh(
      this.customMirrorOrigin,
      this.customMirrorNormal,
      enabled,
      0.4
    );
  }

  public toggleCustomMirrorPlane(enabled: boolean): void {
    this.customMirrorEnabled = enabled;
    this.loftEngine.createOrUpdateMirrorPlaneMesh(
      this.customMirrorOrigin,
      this.customMirrorNormal,
      enabled,
      0.4
    );
  }

  /**
   * Returns camera normal and target for mirror alignment
   */
  public getCameraOrientationForMirror(): {
    target: { x: number; y: number; z: number };
    normal: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  } {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward).negate(); // View normal facing camera
    return {
      target: { x: this.cameraTarget.x, y: this.cameraTarget.y, z: this.cameraTarget.z },
      normal: { x: forward.x, y: forward.y, z: forward.z },
      rotation: { x: this.camera.rotation.x, y: this.camera.rotation.y, z: this.camera.rotation.z },
    };
  }

  /**
   * Creates preset curved manifold scaffold guide
   */
  public createPresetBentGuide(
    preset: 'wave' | 'arch' | 'spiral' | 'saddle',
    width: number = 0.35,
    opacity: number = 0.5
  ): BentGuideConfig {
    return this.loftEngine.createPresetGuide(preset, width, opacity);
  }

  /**
   * Creates swept manifold guide from the last drawn curve in the active layer
   */
  public createBentGuideFromSelectedStroke(
    width: number = 0.35,
    opacity: number = 0.5
  ): BentGuideConfig | null {
    // Find the latest stroke in active layer
    let latestStroke: StrokeDescriptor | null = null;
    for (const entry of this.strokes.values()) {
      if (entry.descriptor.layerId === this.activeLayerId) {
        if (!latestStroke || entry.descriptor.createdAt > latestStroke.createdAt) {
          latestStroke = entry.descriptor;
        }
      }
    }

    if (!latestStroke || latestStroke.points.length < 2) return null;
    const curvePoints = latestStroke.points.map((p) => p.position);
    return this.loftEngine.createBentGuideFromPoints(
      curvePoints,
      `Scaffold from ${latestStroke.id}`,
      width,
      opacity
    );
  }

  public removeBentGuide(id: string): void {
    this.loftEngine.removeBentGuide(id);
  }

  public updateBentGuideParameters(id: string, params: Partial<BentGuideConfig>): BentGuideConfig | null {
    return this.loftEngine.updateBentGuideParameters(id, params);
  }

  public toggleBentGuideVisibility(id: string, visible: boolean): void {
    this.loftEngine.toggleGuideVisibility(id, visible);
  }

  public getBentGuides(): BentGuideConfig[] {
    return this.loftEngine.getGuides();
  }

  // ==========================================
  // SCAFFOLDING & COLLISION MESH ENGINE
  // ==========================================

  public getScaffoldingEngine(): ScaffoldingEngine {
    return this.scaffoldingEngine;
  }

  public createProxyScaffold(type: ScaffoldProxyType, name?: string): CollisionGuideMeshConfig {
    return this.scaffoldingEngine.createProxyScaffold(type, name);
  }

  public loadCollisionMeshFromObject(object: THREE.Object3D, name: string = 'Collision Guide'): CollisionGuideMeshConfig {
    return this.scaffoldingEngine.loadCollisionMeshFromObject(object, name);
  }

  public removeScaffold(id: string): void {
    this.scaffoldingEngine.removeScaffold(id);
  }

  public updateScaffold(id: string, updates: Partial<CollisionGuideMeshConfig>): CollisionGuideMeshConfig | null {
    return this.scaffoldingEngine.updateScaffold(id, updates);
  }

  public getScaffolds(): CollisionGuideMeshConfig[] {
    return this.scaffoldingEngine.getScaffolds();
  }

  // ==========================================
  // SPRINT 4: REFERENCE BILLBOARD & MESH GUIDE COLLIDERS
  // ==========================================

  /**
   * Imports a reference 2D image into 3D stage space as a billboard plane
   */
  public importImageBillboardToStage(imageUrl: string, name: string = 'Reference Image'): void {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const aspect = texture.image.width / Math.max(1, texture.image.height);
      const height = 1.6;
      const width = height * aspect;

      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });

      const planeMesh = new THREE.Mesh(geometry, material);
      planeMesh.name = name;
      planeMesh.renderOrder = 2;

      // Position in front of camera at target distance
      const camPos = new THREE.Vector3();
      this.camera.getWorldPosition(camPos);
      const lookDir = new THREE.Vector3();
      this.camera.getWorldDirection(lookDir);

      planeMesh.position.copy(this.cameraTarget).addScaledVector(lookDir, -0.2);
      planeMesh.quaternion.copy(this.camera.quaternion);

      this.modelRoot.add(planeMesh);
      this.targetMeshes.push(planeMesh);

      // Compute BVH for raycasting contact
      try {
        this.fastRaycaster.updateMeshBVH(planeMesh);
      } catch (_) {}
    });
  }

  /**
   * Toggles mesh collider guide state for shrink-wrap projection
   */
  public toggleMeshGuideCollider(meshId: string, isCollider: boolean): void {
    this.modelRoot.traverse((child) => {
      if (child instanceof THREE.Mesh && (child.uuid === meshId || child.name === meshId)) {
        if (isCollider) {
          this.guideColliderMeshes.set(meshId, child);
          try {
            this.fastRaycaster.updateMeshBVH(child);
          } catch (_) {}
        } else {
          this.guideColliderMeshes.delete(meshId);
        }
      }
    });
  }

  // ==========================================
  // SPRINT 5: WEBXR AR BINDING & HIT-TESTING
  // ==========================================

  /**
   * Initializes WebXR immersive AR session with real-world hit-testing
   */
  public async startWebXRSession(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('xr' in navigator) || !(navigator as any).xr) {
      return false;
    }

    try {
      const isSupported = await (navigator as any).xr.isSessionSupported('immersive-ar');
      if (!isSupported) return false;

      const session = await (navigator as any).xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'light-estimation'],
      });

      this.xrSession = session;
      this.renderer.xr.enabled = true;
      await this.renderer.xr.setSession(session);

      session.addEventListener('end', () => {
        this.stopWebXRSession();
      });

      return true;
    } catch (e) {
      console.warn('WebXR start error:', e);
      return false;
    }
  }

  public stopWebXRSession(): void {
    if (this.xrSession) {
      try {
        this.xrSession.end();
      } catch (_) {}
      this.xrSession = null;
    }
    this.renderer.xr.enabled = false;
  }

  /**
   * Activates Realistic Simulated AR Floor Mode on Desktop / non-XR devices
   */
  public enableSimulatedARMode(enabled: boolean): void {
    this.isSimulatedAR = enabled;
    if (enabled) {
      if (!this.arFloorGrid) {
        this.arFloorGrid = new THREE.GridHelper(12, 24, 0x6366f1, 0x312e81);
        this.arFloorGrid.position.y = -1.2;
        this.helperRoot.add(this.arFloorGrid);
      }
      this.arFloorGrid.visible = true;
    } else if (this.arFloorGrid) {
      this.arFloorGrid.visible = false;
    }
  }

  /**
   * Adjusts Y-Axis Levitation (Floor Elevation Offset)
   */
  public setARSceneElevation(elevation: number): void {
    this.modelRoot.position.y = elevation;
  }

  /**
   * Full teardown. Releases every GPU resource, listener and global this engine
   * installed so a remount (or a React StrictMode double-mount in development)
   * cannot leak a WebGL context, render targets or scene graph memory.
   */
  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }

    // 1. Listeners
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('scroll', this.handleWindowScroll, true);
    if (this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    // 2. Callbacks - drop React references so a stale engine cannot call setState.
    this.onFpsUpdate = undefined;
    this.onMetadataUpdate = undefined;
    this.onHistoryChange = undefined;
    this.onViewChange = undefined;
    this.onGPUInfoUpdate = undefined;
    this.onCameraChange = undefined;
    this.onAutoSaveTrigger = undefined;
    this.onShapeSnapped = undefined;
    this.onDNAInjected = undefined;
    this.onModelsChanged = undefined;
    this.onStrokeSelected = undefined;
    this.onProjectionChange = undefined;

    // 3. Sub-engines
    try { this.postEngine?.dispose(); } catch (_) {}
    try { this.uvEngine.dispose(); } catch (_) {}
    try { (this.skyEngine as any)?.dispose?.(); } catch (_) {}
    try { (this.loftEngine as any)?.dispose?.(); } catch (_) {}
    try { (this.scaffoldingEngine as any)?.dispose?.(); } catch (_) {}
    try { this.dracoLoader?.dispose(); } catch (_) {}
    this.dracoLoader = null;

    // 4. Scene graph geometry, materials and textures
    this.disposeSceneGraph();

    if (this.generatedEnvTexture) {
      this.generatedEnvTexture.dispose();
      this.generatedEnvTexture = null;
    }
    this.scene.environment = null;

    this.materialCache.clear();

    // 5. Bookkeeping collections
    this.strokes.clear();
    this.guideColliderMeshes.clear();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.transformUndoStack.length = 0;
    this.transformRedoStack.length = 0;
    this.activePoints.length = 0;
    this.activeStrokeMeshes.length = 0;
    this.targetMeshes.length = 0;
    this.raycastTargetScratch.length = 0;
    this.intersectScratch.length = 0;

    // 6. Renderer & DOM
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    if (this.container && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }

    // 7. Globals installed by the constructor. Only reclaim them if this engine
    // still owns them - during a StrictMode remount a newer engine may already
    // have taken over, and clearing its bindings would break the live viewport.
    if (typeof window !== 'undefined' && (window as any).__STUDIO_ENGINE__ === this) {
      delete (window as any).__STUDIO_ENGINE__;
      delete window.RayEngine;
    }
  }

  /**
   * Walks the whole scene and releases every geometry, material and texture.
   * Textures are tracked in a set so shared maps are only disposed once.
   */
  private disposeSceneGraph(): void {
    const seenTextures = new Set<THREE.Texture>();

    const disposeMaterial = (mat: THREE.Material): void => {
      const anyMat = mat as any;
      for (const key of Object.keys(anyMat)) {
        const value = anyMat[key];
        if (value && (value as THREE.Texture).isTexture && !seenTextures.has(value)) {
          seenTextures.add(value);
          try { value.dispose(); } catch (_) {}
        }
      }
      try { mat.dispose(); } catch (_) {}
    };

    this.scene.traverse((obj) => {
      const anyObj = obj as any;
      if (anyObj.geometry) {
        try { anyObj.geometry.disposeBoundsTree?.(); } catch (_) {}
        try { anyObj.geometry.dispose(); } catch (_) {}
      }
      if (anyObj.material) {
        if (Array.isArray(anyObj.material)) {
          anyObj.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(anyObj.material);
        }
      }
    });

    this.scene.clear();
  }
}
