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
import { StudioPathTracer } from './StudioPathTracer';
import { PathTracingProgressInfo } from '../types';
import { SampleModelFactory } from './sampleModels';
import { StrokeSmoother } from './strokeSmoother';
import { globalShaderRegistry } from './animatedShaders';
import { ProceduralSkyEngine, SkyPresetName, SkySettings } from './proceduralSky';
import { ModelConverterEngine } from './modelConverter';
import { haptics } from '../utils/haptics';
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
import { projectSerializer, ProjectSerializationState } from './projectSerializer';
import { CameraController } from './cameraController';
import { LightingController, StudioLightingState } from './lightingController';
import { TransformController } from './transformController';
import { StrokePipeline } from './strokePipeline';
import { modelNormalization } from './modelNormalization';
import { resolveAssetUrl } from '../utils/assetUrl';
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

export type { StudioLightingState };

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
  public cameraController!: CameraController;
  private get camera(): THREE.PerspectiveCamera { return this.cameraController.camera; }
  private set camera(c: THREE.PerspectiveCamera) { this.cameraController.camera = c; }
  private raycaster: THREE.Raycaster;
  public fastRaycaster: FastSurfaceRaycaster;
  private beadGenerator: ConformalBeadGenerator;
  private materialCache: MaterialCache;
  private strokeSmoother: StrokeSmoother = new StrokeSmoother();
  private strokeSequenceIndex: number = 0;
  private lastHitMesh: THREE.Mesh | null = null;
  public uvEngine: UVPaintingEngine;
  public postEngine: PostProcessingEngine;
  public postProcessing?: PostProcessingEngine;
  public pathTracer?: StudioPathTracer;
  public onPathTracingProgress?: (info: PathTracingProgressInfo) => void;
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
  private get cameraTarget(): THREE.Vector3 { return this.cameraController.cameraTarget; }
  private get cameraSpherical(): THREE.Spherical { return this.cameraController.cameraSpherical; }
  private get targetSpherical(): THREE.Spherical { return this.cameraController.targetSpherical; }
  private get targetPosition(): THREE.Vector3 { return this.cameraController.targetPosition; }

  // Active Stroke State & Pipeline
  public strokePipeline!: StrokePipeline;
  private isDrawing: boolean = false;
  private get activePoints(): StrokePoint[] { return this.strokePipeline.activePoints; }
  private set activePoints(pts: StrokePoint[]) { this.strokePipeline.activePoints = pts; }
  private get activeStrokeMeshes(): THREE.Mesh[] { return this.strokePipeline.activeStrokeMeshes; }
  private set activeStrokeMeshes(m: THREE.Mesh[]) { this.strokePipeline.activeStrokeMeshes = m; }
  private activeLayerId: string = 'layer_base_1';
  private activeLayerOpacity: number = 1.0;
  private strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }> = new Map();
  private undoStack: Array<{ type: 'create' | 'erase'; strokes: StrokeDescriptor[] }> = [];
  private redoStack: Array<{ type: 'create' | 'erase'; strokes: StrokeDescriptor[] }> = [];
  private historyUndoStack: UnifiedHistoryEntry[] = [];
  private historyRedoStack: UnifiedHistoryEntry[] = [];
  private get activeStrokeBatch(): StrokeDescriptor[] { return this.strokePipeline.activeStrokeBatch; }
  private set activeStrokeBatch(b: StrokeDescriptor[]) { this.strokePipeline.activeStrokeBatch = b; }
  private get activeVacuumPurgedBatch(): StrokeDescriptor[] { return this.strokePipeline.activeVacuumPurgedBatch; }
  private set activeVacuumPurgedBatch(b: StrokeDescriptor[]) { this.strokePipeline.activeVacuumPurgedBatch = b; }
  private lastScreenCoords: { x: number; y: number } | null = null;
  private lastCapturePoint: StrokePoint | null = null;
  private isOverAir: boolean = false;
  public get selectedStrokeId(): string | null { return this.strokePipeline.selectedStrokeId; }
  public set selectedStrokeId(id: string | null) { this.strokePipeline.selectedStrokeId = id; }
  public get clipboardStrokes(): StrokeDescriptor[] { return this.strokePipeline.clipboardStrokes; }
  public set clipboardStrokes(c: StrokeDescriptor[]) { this.strokePipeline.clipboardStrokes = c; }

  // QuickShape / Hold-to-Snap Interactive Gesture State
  private holdToSnapTimer: any = null;
  private quickShapeActive: boolean = false;
  private quickShapeResult: ShapeSnapResult | null = null;
  private quickShapeBasePoints: StrokePoint[] | null = null;
  private quickShapeCenter: THREE.Vector3 | null = null;
  private quickShapeAnchorScreen: { x: number; y: number } | null = null;
  private quickShapeInitialDist: number = 0.05;
  private quickShapeInitialAngle: number = 0.0;

  // Brush Visual Projection Decal
  private cursorDecal: THREE.Mesh;

  // Lighting Controller
  public lightingController!: LightingController;
  public get gridHelper(): THREE.GridHelper | null { return this.lightingController.gridHelper; }
  public get hemiLight(): THREE.HemisphereLight { return this.lightingController.hemiLight; }
  public get dirLight1(): THREE.DirectionalLight { return this.lightingController.dirLight1; }
  public get dirLight2(): THREE.DirectionalLight { return this.lightingController.dirLight2; }
  public get ambientLight(): THREE.AmbientLight { return this.lightingController.ambientLight; }
  public get studioGroundMesh(): THREE.Mesh | null { return this.lightingController.studioGroundMesh; }
  public get studioBackdropTexture(): THREE.CanvasTexture | null { return this.lightingController.studioBackdropTexture; }
  public get currentStudioTheme(): 'light' | 'dark' { return this.lightingController.currentStudioTheme; }
  public get studioLightingState(): StudioLightingState { return this.lightingController.studioLightingState; }

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

  // Transform Controller
  public transformController!: TransformController;
  public get transformActiveScope(): TransformTargetScope { return this.transformController.transformActiveScope; }
  public set transformActiveScope(s: TransformTargetScope) { this.transformController.transformActiveScope = s; }
  public get currentTransformTotalMatrix(): THREE.Matrix4 { return this.transformController.currentTransformTotalMatrix; }
  public get transformUndoStack() { return this.transformController.transformUndoStack; }
  public get transformRedoStack() { return this.transformController.transformRedoStack; }
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


  private get navigatorSensitivity(): number { return this.cameraController.navigatorSensitivity; }
  private currentLayers: Layer[] = [];

  private activeSelectedModelId: string | null = null;
  private guideHelperMesh: THREE.Mesh | null = null;
  private cachedRect: DOMRect | null = null;
  private drawingPlaneMesh: THREE.Mesh | null = null;
  public get generatedEnvTexture(): THREE.Texture | null { return this.lightingController.generatedEnvTexture; }
  public set generatedEnvTexture(t: THREE.Texture | null) { this.lightingController.generatedEnvTexture = t; }
  /**
   * Whether the procedural sky dome may be shown. Low-power devices start with it
   * off - it is a full-screen procedural shader pass - but the user can re-enable
   * it explicitly from the Skybox panel via setSkyPreset().
   */
  private skyEnabled: boolean = true;

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

    // 3. Camera Controller
    this.cameraController = new CameraController({
      width: container.clientWidth,
      height: container.clientHeight,
      onDirty: () => this.markDirty(),
      onCameraChange: (spherical) => {
        this.cameraChangePayload.radius = spherical.radius;
        this.cameraChangePayload.theta = spherical.theta;
        this.cameraChangePayload.phi = spherical.phi;
        this.onCameraChange?.(this.cameraChangePayload);
      },
      onProjectionChange: (mode, fov) => this.onProjectionChange?.(mode, fov),
    });
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

    // 6. Lighting and Studio Stage Controller
    this.lightingController = new LightingController({
      scene: this.scene,
      helperRoot: this.helperRoot,
      renderer: this.renderer,
      profile: this.profile,
      onDirty: () => this.markDirty(),
      onSetModelDisplayMode: (mode) => this.setModelDisplayMode(mode),
      onApplySkyPresetIfEnabled: (preset) => this.applySkyPresetIfEnabled(preset),
      getSkyEngine: () => this.skyEngine,
    });
 
    // 7. Transform Controller
    this.transformController = new TransformController({
      modelRoot: this.modelRoot,
      strokeRoot: this.strokeRoot,
      getTargetMeshes: () => this.targetMeshes,
      getStrokes: () => this.strokes,
      getActiveLayerId: () => this.activeLayerId,
      getActiveSelectedModelId: () => this.activeSelectedModelId,
      getDrawingPlaneMesh: () => this.drawingPlaneMesh,
      getCamera: () => this.camera,
      getCameraTarget: () => this.cameraTarget,
      getContainer: () => this.container,
      getNavigatorSensitivity: () => this.navigatorSensitivity,
      markDirty: () => this.markDirty(),
      notifyHistory: () => this.notifyHistory(),
      pushHistoryUndo: (entry) => this.historyUndoStack.push(entry),
      clearHistoryRedo: () => { this.historyRedoStack = []; },
    });

    // 8. Stroke Pipeline
    this.strokePipeline = new StrokePipeline({
      strokes: this.strokes,
      strokeRoot: this.strokeRoot,
      worldStrokeRoot: this.worldStrokeRoot,
      helperRoot: this.helperRoot,
      getCamera: () => this.camera,
      getRaycaster: () => this.raycaster,
      getTargetMeshes: () => this.targetMeshes,
      getActiveLayerId: () => this.activeLayerId,
      getActiveLayerOpacity: () => this.activeLayerOpacity,
      materialCache: this.materialCache,
      beadGenerator: this.beadGenerator,
      getCustomMirrorOrigin: () => this.customMirrorOrigin,
      getCustomMirrorNormal: () => this.customMirrorNormal,
      sampleColorAtScreen: (screenX, screenY, clientX, clientY) => this.sampleColorAtScreen(screenX, screenY, clientX, clientY),
      raycastModel: (screenX, screenY, settings) => this.raycastModel(screenX, screenY, settings),
      onStrokeSelected: (stroke) => this.onStrokeSelected?.(stroke),
      onDNAInjected: (dna) => this.onDNAInjected?.(dna),
      onAutoSaveTrigger: (reason) => this.onAutoSaveTrigger?.(reason),
      notifyHistory: () => this.notifyHistory(),
      markDirty: () => this.markDirty(),
      pushUndoAction: (action) => {
        this.undoStack.push(action);
        this.historyUndoStack.push({
          kind: 'stroke',
          action,
          timestamp: Date.now(),
        });
      },
      clearRedoStacks: () => {
        this.redoStack = [];
        this.historyRedoStack = [];
      },
      resetActiveDrawingState: () => {
        this.isDrawing = false;
        this.lastScreenCoords = null;
        this.lastCapturePoint = null;
        this.isOverAir = false;
        this.lastHitMesh = null;
        this.strokeSmoother.reset();
      },
      filterHistoryForLayer: (layerId) => {
        this.undoStack = this.undoStack.filter((batch) => !batch.strokes.some((s) => s.layerId === layerId));
        this.redoStack = this.redoStack.filter((batch) => !batch.strokes.some((s) => s.layerId === layerId));
      },
    });

    // Sky engine initialized with off by default for clean white studio background
    this.skyEngine = new ProceduralSkyEngine(this.scene);
    this.skyEngine.setLights(
      this.lightingController.dirLight1,
      this.lightingController.ambientLight,
      this.lightingController.dirLight2
    );
    this.skyEnabled = false;
    this.skyEngine.applyPreset('off');

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
    this.transformController.snapActiveToGround(targetScope);
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

    // Reset Hold-to-Snap QuickShape state
    if (this.holdToSnapTimer) {
      clearTimeout(this.holdToSnapTimer);
      this.holdToSnapTimer = null;
    }
    this.quickShapeActive = false;
    this.quickShapeResult = null;
    this.quickShapeBasePoints = null;
    this.quickShapeCenter = null;
    this.quickShapeAnchorScreen = null;

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

    this.lastHitMesh = rayResult.mesh || null;

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
      mesh.renderOrder = 10 + (this.strokeSequenceIndex % 20000);
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

    // QuickShape / Hold-to-Snap Active Manipulation
    if (this.quickShapeActive && this.quickShapeBasePoints && this.quickShapeCenter && this.quickShapeAnchorScreen) {
      const curDx = targetX - this.quickShapeAnchorScreen.x;
      const curDy = targetY - this.quickShapeAnchorScreen.y;
      const curDist = Math.hypot(curDx, curDy);
      const scale = 1.0 + curDist * 4.0 * (curDx >= 0 ? 1 : -0.5);
      const rotAngle = Math.atan2(curDy, curDx);

      const avgNorm = this.quickShapeBasePoints[0]?.normal || new THREE.Vector3(0, 1, 0);
      this.activePoints = ShapeSnappingEngine.transformSnappedPoints(
        this.quickShapeBasePoints,
        this.quickShapeCenter,
        scale,
        rotAngle,
        avgNorm
      );
      this.updateActiveStrokeGeometry(settings, symmetry);
      return;
    }

    // QuickShape Hold-to-Snap Detection Timer
    if (settings.shapeSnapping && !this.quickShapeActive && this.activePoints.length >= 5) {
      if (this.holdToSnapTimer) {
        clearTimeout(this.holdToSnapTimer);
      }
      const anchorX = targetX;
      const anchorY = targetY;
      this.holdToSnapTimer = setTimeout(() => {
        if (this.isDrawing && this.activePoints.length >= 5 && !this.quickShapeActive) {
          const snapRes = ShapeSnappingEngine.snapStroke(
            this.activePoints,
            settings.shapeSnapTolerance ?? 0.18
          );
          if (snapRes.detectedShape !== 'none' && snapRes.confidence >= 0.55) {
            this.quickShapeActive = true;
            this.quickShapeResult = snapRes;
            this.quickShapeBasePoints = snapRes.snappedPoints.map((p) => ({
              ...p,
              position: p.position.clone(),
              normal: p.normal.clone(),
            }));
            this.quickShapeCenter = snapRes.center || snapRes.snappedPoints[0].position.clone();
            this.quickShapeAnchorScreen = { x: anchorX, y: anchorY };
            this.activePoints = snapRes.snappedPoints;
            this.updateActiveStrokeGeometry(settings, symmetry);
            this.onShapeSnapped?.(snapRes);
            haptics.trigger('snap');
          }
        }
      }, 450);
    }

    if (!this.lastScreenCoords) {
      this.lastScreenCoords = { x: targetX, y: targetY };
    }

    const dx = targetX - this.lastScreenCoords.x;
    const dy = targetY - this.lastScreenCoords.y;
    const screenDist = Math.hypot(dx, dy);

    const isSpatial = settings.drawingMode === 'spatial_3d' || tool === 'free_brush';
    const isDrawingPlane = isSpatial || (this.lastHitMesh !== null && (this.lastHitMesh === this.drawingPlaneMesh || this.lastHitMesh.name === 'DrawingPlaneCanvas'));

    // Sub-sample screen movements so fast sweeps calculate surface contact points smoothly.
    // When processing hardware coalesced points (S-Pen at 120-240Hz), or when drawing on a flat
    // canvas / spatial plane, we evaluate exactly 1 raycast per point: this prevents straight-line
    // chord pinning and lets the 3D Catmull-Rom spline construct smooth, jitter-free curves.
    const sampleDensity = settings.raycastSampleDensity || 'high';
    const requestedMaxSteps = sampleDensity === 'ultra' ? 8 : sampleDensity === 'standard' ? 4 : 6;
    const densityMaxSteps = Math.min(requestedMaxSteps, this.profile.maxStrokeSubSteps);
    const maxStepDist = sampleDensity === 'ultra' ? 0.003 : 0.005;
    const steps = (isCoalescedPoint || isDrawingPlane) ? 1 : Math.min(densityMaxSteps, Math.max(1, Math.ceil(screenDist / maxStepDist)));

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

      if (rayResult.mesh) {
        this.lastHitMesh = rayResult.mesh;
      }

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
          mesh.renderOrder = 10 + (this.strokeSequenceIndex % 20000);
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
    this.strokeSequenceIndex = (this.strokeSequenceIndex + 1) % 20000;
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

    // Clear any pending hold-to-snap timer
    if (this.holdToSnapTimer) {
      clearTimeout(this.holdToSnapTimer);
      this.holdToSnapTimer = null;
    }

    if (this.quickShapeActive) {
      // Shape was interactively adjusted during hold; commit the adjusted geometry
      this.quickShapeActive = false;
      this.quickShapeBasePoints = null;
      this.quickShapeCenter = null;
      this.quickShapeAnchorScreen = null;
    } else if (settings.shapeSnapping && this.activePoints.length >= 5) {
      // Algorithmic Geometric Shape Snapping fallback for fast draw & release
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
    return this.strokePipeline.purgeStrokesIntersecting(screenX, screenY, radiusWorld);
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
    return this.strokePipeline.sampleHolisticDNA(screenX, screenY, clientX, clientY);
  }

  /**
   * Cancel active stroke without committing to history (useful for multi-touch gesture handoff)
   */
  public cancelStroke(): void {
    this.strokePipeline.cancelStroke();
  }

  /**
   * Updates the geometry of all active symmetry stroke meshes in real-time
   */
  private updateActiveStrokeGeometry(settings: BrushSettings, symmetry: SymmetryMode): void {
    settings.strokeSequenceIndex = this.strokeSequenceIndex;
    this.strokePipeline.updateActiveStrokeGeometry(settings, symmetry);
  }

  /**
   * Recomputes points according to symmetry mode with zero allocations
   */
  private applySymmetry(points: StrokePoint[], symmetry: SymmetryMode, index: number): StrokePoint[] {
    return this.strokePipeline.applySymmetry(points, symmetry, index);
  }

  private getSymmetryCount(symmetry: SymmetryMode): number {
    return this.strokePipeline.getSymmetryCount(symmetry);
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
          mesh.renderOrder = 10 + ((strokeDesc.settings.strokeSequenceIndex ?? this.strokes.size) % 20000);
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
          mesh.renderOrder = 10 + ((strokeDesc.settings.strokeSequenceIndex ?? this.strokes.size) % 20000);
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
    this.strokePipeline.clearAllStrokes();

    // Reset history stacks
    this.undoStack = [];
    this.redoStack = [];
    this.transformController.clearHistory();
    this.historyUndoStack = [];
    this.historyRedoStack = [];

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
    this.strokePipeline.deleteLayerStrokes(layerId);
  }

  /**
   * Recalculates and smooths mesh normals across stroke geometries and 3D model meshes
   */
  public recalculateMeshNormals(layerId?: string): number {
    return this.strokePipeline.recalculateMeshNormals(layerId);
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
    return this.strokePipeline.copyStrokes(layerId);
  }

  /**
   * Pastes copied curves with a subtle spatial offset into the scene and registers into Undo history
   */
  public pasteStrokes(
    targetLayerId?: string,
    offset: THREE.Vector3 = new THREE.Vector3(0.08, 0.08, 0.02)
  ): number {
    return this.strokePipeline.pasteStrokes(targetLayerId, offset);
  }

  public getClipboardCount(): number {
    return this.strokePipeline.getClipboardCount();
  }

  public setNavigatorSensitivity(s: number): void {
    this.cameraController.setNavigatorSensitivity(s);
  }

  public getNavigatorSensitivity(): number {
    return this.cameraController.getNavigatorSensitivity();
  }

  /**
   * Raycast against stroke meshes to select a stroke by pointer
   */
  public raycastStroke(screenX: number, screenY: number): string | null {
    return this.strokePipeline.raycastStroke(screenX, screenY);
  }

  /**
   * Set currently selected stroke and highlight it
   */
  public selectStroke(strokeId: string | null): StrokeDescriptor | null {
    return this.strokePipeline.selectStroke(strokeId);
  }

  public getSelectedStrokeId(): string | null {
    return this.strokePipeline.getSelectedStrokeId();
  }

  public getSelectedStroke(): StrokeDescriptor | null {
    return this.strokePipeline.getSelectedStroke();
  }

  public deleteSelectedStroke(): boolean {
    return this.strokePipeline.deleteSelectedStroke();
  }

  public getLayersSnapshot(): Layer[] {
    return this.currentLayers;
  }

  /**
   * Recreates a stroke mesh from its descriptor and registers it
   */
  public recreateStrokeFromDescriptor(desc: StrokeDescriptor): void {
    this.strokePipeline.recreateStrokeFromDescriptor(desc);
  }

  private getSerializationState(): ProjectSerializationState {
    return {
      strokes: this.strokes,
      undoStack: this.undoStack,
      redoStack: this.redoStack,
      historyUndoStack: this.historyUndoStack,
      historyRedoStack: this.historyRedoStack,
      camera: this.camera,
      cameraTarget: this.cameraTarget,
      cameraSpherical: this.cameraSpherical,
      targetSpherical: this.targetSpherical,
      activeModelName: this.activeModelName,
      activeModelId: this.activeModelId,
      gridHelper: this.gridHelper,
      modelWireframeOpacity: this.modelWireframeOpacity,
      uvEngine: this.uvEngine,
      getLayersSnapshot: () => this.getLayersSnapshot(),
      selectStroke: (id: string | null) => this.selectStroke(id),
      recreateStrokeFromDescriptor: (desc: StrokeDescriptor) => this.recreateStrokeFromDescriptor(desc),
      markDirty: () => this.markDirty(),
      notifyHistory: () => this.notifyHistory(),
      onAutoSaveTrigger: this.onAutoSaveTrigger,
    };
  }

  /**
   * Export all strokes, layers, scene environment and camera data as ProjectSaveData
   */
  public exportProjectData(projectName: string = 'Remix 3D Project', explicitLayers?: Layer[]): ProjectSaveData {
    return projectSerializer.exportProjectData(this.getSerializationState(), projectName, explicitLayers);
  }

  /**
   * Export project to downloadable .remix3d JSON file
   */
  public exportProjectFile(filename: string = 'project.remix3d'): void {
    projectSerializer.exportProjectFile(this.getSerializationState(), filename);
  }

  /**
   * Import project from ProjectSaveData and recreate all strokes & layers
   */
  public async importProjectData(project: ProjectSaveData): Promise<void> {
    await projectSerializer.importProjectData(this.getSerializationState(), project);
  }

  /**
   * Spherical Orbit Controls
   */
  public orbit(deltaX: number, deltaY: number): void {
    this.cameraController.orbit(deltaX, deltaY);
  }

  /** Direct gimbal input in logical pixels, matching the reference navigator. */
  public orbitNavigator(deltaX: number, deltaY: number): void {
    this.cameraController.orbitNavigator(deltaX, deltaY);
  }

  public pan(deltaX: number, deltaY: number): void {
    this.cameraController.pan(deltaX, deltaY);
  }

  public zoom(deltaDistance: number): void {
    this.cameraController.zoom(deltaDistance);
  }

  public getCameraSpherical(): { radius: number; theta: number; phi: number } {
    return this.cameraController.getCameraSpherical();
  }

  public orbitCamera(deltaTheta: number, deltaPhi: number): void {
    this.cameraController.orbitCamera(deltaTheta, deltaPhi);
  }

  public setCameraView(theta: number, phi: number, radius?: number, instant: boolean = false): void {
    this.cameraController.setCameraView(theta, phi, radius, instant);
  }

  public zoomCamera(deltaRadius: number): void {
    this.cameraController.zoomCamera(deltaRadius);
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
    this.cameraController.resetView(
      this.modelMetadata?.dimensions,
      this.activeModelName === 'Drawing Canvas' || !!this.drawingPlaneMesh
    );
  }

  public setTargetPosition(x: number, y: number, z: number): void {
    this.cameraController.setTargetPosition(x, y, z);
  }

  // ==========================================
  // TRANSFORM JOYSTICK & SPATIAL ENGINE
  // ==========================================

  /**
   * Calculates the geometric bounding center of the targeted selection (model, strokes, or active layer)
   */
  public getSelectionCenter(scope: TransformTargetScope = 'all'): THREE.Vector3 {
    return this.transformController.getSelectionCenter(scope);
  }

  /**
   * Computes the 3D world anchor that corresponds precisely to the exact screen center crosshair
   */
  public getScreenCenterWorldAnchor(targetCenter?: THREE.Vector3): THREE.Vector3 {
    return this.transformController.getScreenCenterWorldAnchor(targetCenter);
  }

  /**
   * Begins a continuous transformation gesture, tracking undo state
   */
  public beginTransform(scope: TransformTargetScope = 'all'): void {
    this.transformController.beginTransform(scope);
  }

  /**
   * Concludes a transformation gesture and commits undo state
   */
  public endTransform(): void {
    this.transformController.endTransform();
  }

  /**
   * Applies an arbitrary 4x4 matrix transformation across target meshes, strokes, and descriptors
   */
  public applyTransformMatrix(matrix: THREE.Matrix4, scope: TransformTargetScope = 'all'): void {
    this.transformController.applyTransformMatrix(matrix, scope);
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
    this.transformController.translateScreenSpace(deltaScreenX, deltaScreenY, scope, isLocked);
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
    this.transformController.scaleScreenSpace(scaleFactorX, scaleFactorY, scope, isLocked);
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
    this.transformController.rotateScreenSpace(deltaAngleRad, scope, isLocked);
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
    this.transformController.translateWorldAxis(axis, deltaWorld, scope);
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
    this.transformController.rotateWorldAxis(axis, deltaAngleRad, scope, isLocked);
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
    this.transformController.rotateTrackball(deltaX, deltaY, scope);
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
    this.transformController.translateOnPlane(deltaX, deltaY, scope);
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
    this.transformController.rotateOnPlane(deltaAngleRad, scope, isLocked);
  }

  /**
   * Aligns targeted drawing plane surface directly facing the current camera
   */
  public alignSurfaceToCamera(scope: TransformTargetScope = 'all'): void {
    this.transformController.alignSurfaceToCamera(scope);
  }

  /**
   * Sets exact surface orientation (pitch and roll angles in degrees)
   */
  public setSurfaceOrientation(pitchDeg: number, rollDeg: number, scope: TransformTargetScope = 'all'): void {
    this.transformController.setSurfaceOrientation(pitchDeg, rollDeg, scope);
  }

  /**
   * Translates targeted objects along a specific 3D axis (wrapper for translateWorldAxis)
   */
  public translateAxis3D(
    axis: 'x' | 'y' | 'z',
    deltaWorld: number,
    scope: TransformTargetScope = 'all'
  ): void {
    this.transformController.translateAxis3D(axis, deltaWorld, scope);
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
    this.transformController.rotateAxis3D(axis, deltaAngleRad, scope, isLocked);
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
    this.transformController.scaleAxis(axis, factor, scope, isLocked);
  }

  /**
   * Scales targeted objects uniformly or along an axis around selection center
   */
  public scaleAxis3D(
    factor: number,
    scope: TransformTargetScope = 'all'
  ): void {
    this.transformController.scaleAxis3D(factor, scope);
  }

  /**
   * Snaps model bottom bounding box to ground plane (Y = 0)
   */
  public snapModelToGround(): void {
    this.transformController.snapModelToGround();
  }

  /**
   * Detects if the current camera view has snapped to a "Perfect View" (orthographic elevation).
   * Identifies the depth axis to allow automatic UI collapse and prevent Z plotting errors.
   */
  public getPerfectView(): PerfectViewInfo {
    return this.cameraController.getPerfectView();
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.cameraController.getCamera();
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public get onProjectionChange(): ((mode: 'perspective' | 'orthographic', fov: number) => void) | undefined {
    return this.cameraController.onProjectionChange;
  }
  public set onProjectionChange(cb: ((mode: 'perspective' | 'orthographic', fov: number) => void) | undefined) {
    this.cameraController.onProjectionChange = cb;
  }

  public getFov(): number {
    return this.cameraController.getFov();
  }

  public setFov(fov: number): void {
    this.cameraController.setFov(fov);
  }

  public adjustFov(delta: number): number {
    return this.cameraController.adjustFov(delta);
  }

  public getProjectionMode(): 'perspective' | 'orthographic' {
    return this.cameraController.getProjectionMode();
  }

  public setProjectionMode(mode: 'perspective' | 'orthographic'): void {
    this.cameraController.setProjectionMode(mode);
  }

  public toggleProjectionMode(): 'perspective' | 'orthographic' {
    return this.cameraController.toggleProjectionMode();
  }

  public resetCamera(): void {
    this.cameraController.resetCamera();
  }

  /**
   * Snaps camera perspective smoothly to an exact orthographic elevation or isometric angle
   */
  public snapToView(view: PerfectViewType): void {
    this.cameraController.snapToView(view);
  }

  /**
   * Smoothly orients the actual 3D model or drawing canvas plane directly (WITHOUT moving camera)
   */
  public orientModelOrSurface(view: PerfectViewType, scope: TransformTargetScope = 'all'): void {
    this.transformController.orientModelOrSurface(view, scope);
  }

  /**
   * Rotates the 3D model or drawing surface smoothly (WITHOUT moving camera)
   */
  public rotateModelOrSurface(deltaX: number, deltaY: number, scope: TransformTargetScope = 'all'): void {
    this.transformController.rotateModelOrSurface(deltaX, deltaY, scope);
  }

  /**
   * Scales the 3D model or drawing surface (WITHOUT moving camera)
   */
  public scaleModelOrSurface(scaleFactor: number, scope: TransformTargetScope = 'all'): void {
    this.transformController.scaleModelOrSurface(scaleFactor, scope);
  }

  /**
   * Resets model/surface and stroke transforms without affecting camera
   */
  public resetTransform(scope: TransformTargetScope = 'all'): void {
    this.transformController.resetTransform(scope);
  }

  /**
   * Resets model/surface transform without affecting camera
   */
  public resetModelOrSurface(scope: TransformTargetScope = 'all'): void {
    this.transformController.resetModelOrSurface(scope);
  }

  /**
   * Switch Lighting & Environment Presets
   */
  public setLightingPreset(preset: LightingPreset): void {
    this.lightingController.setLightingPreset(preset);
  }

  public getStudioLightingState(): Readonly<StudioLightingState> {
    return this.lightingController.getStudioLightingState();
  }

  public setStudioLightingMode(mode: 'studio' | 'north' | 'softbox' | 'silhouette'): void {
    this.lightingController.setStudioLightingMode(mode);
  }

  public setStudioSoftness(softness?: number): void {
    this.lightingController.setStudioSoftness(softness);
  }

  public setStudioLightDirection(dir?: { x: number; y: number; z: number }): void {
    this.lightingController.setStudioLightDirection(dir);
  }

  public setStudioLightIntensity(intensity?: number): void {
    this.lightingController.setStudioLightIntensity(intensity);
  }

  public setStudioLightColor(colorHex?: string): void {
    this.lightingController.setStudioLightColor(colorHex);
  }

  public setStudioFloorShadow(visible: boolean): void {
    this.lightingController.setStudioFloorShadow(visible);
  }

  public setStudioGridVisible(visible: boolean): void {
    this.lightingController.setStudioGridVisible(visible);
  }


  public applyStudioBackdrop(theme: 'light' | 'dark'): void {
    this.lightingController.applyStudioBackdrop(theme);
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.lightingController.setTheme(theme);
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
    this.lightingController.toggleGrid(show);
  }

  public setGrid(show: boolean): void {
    this.lightingController.setGrid(show);
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

  public ensureBaselineLighting(): void {
    this.lightingController.ensureBaselineLighting();
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

  private ensurePathTracer(): StudioPathTracer {
    if (!this.pathTracer) {
      const postSettings = this.postEngine?.getSettings();
      this.pathTracer = new StudioPathTracer(this.renderer, {
        bounces: postSettings?.rayTracingBounces ?? 3,
        maxSamples: postSettings?.rayTracingSamples ?? 48,
        onProgress: (info) => {
          this.onPathTracingProgress?.(info);
        },
      });
    }
    return this.pathTracer;
  }

  public setPostProcessSettings(settings: Partial<PostProcessSettings>): void {
    if (this.postEngine) {
      this.postEngine.updateSettings(settings);
    }
    if (settings.rayTracing !== undefined || this.pathTracer) {
      const tracer = this.ensurePathTracer();
      if (settings.rayTracing !== undefined) {
        tracer.enable(settings.rayTracing);
      }
      if (settings.rayTracingSamples !== undefined) {
        tracer.setMaxSamples(settings.rayTracingSamples);
      }
      if (settings.rayTracingBounces !== undefined) {
        tracer.setBounces(settings.rayTracingBounces);
      }
      tracer.reset();
    }
    this.markDirty();
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
      rayTracing: false,
      contactShadowSharpness: 1.5,
      denoiser: true,
      rayTracingBounces: 3,
      rayTracingSamples: 48,
    };
  }

  private updateCameraPosition(): void {
    this.cameraController.updateCameraPosition();
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

      const postSettings = this.postEngine?.getSettings();
      const useRayTracing = postSettings?.renderMode === 'render' && postSettings?.rayTracing;

      if (useRayTracing) {
        const tracer = this.ensurePathTracer();
        const isInteracting = this.isDrawing || this.isCameraSettling();
        const handledByPathTracer = tracer.step(this.renderer, this.scene, this.camera, isInteracting);
        if (!handledByPathTracer) {
          if (this.postEngine) {
            this.postEngine.render(time * 0.001);
          } else {
            this.renderer.render(this.scene, this.camera);
          }
        }
      } else if (this.postEngine) {
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
    return this.cameraController.isCameraSettling();
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
    this.pathTracer?.markSceneDirty();
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
    try { this.pathTracer?.dispose(); } catch (_) {}
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
