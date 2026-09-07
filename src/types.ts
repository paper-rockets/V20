import * as THREE from 'three';
import { AnimatedShaderEffect } from './core/animatedShaders';
import { SkyPresetName, SkySettings } from './core/proceduralSky';

export type { SkyPresetName, SkySettings };

export type ToolType = 'brush' | 'uv_brush' | 'eraser' | 'eyedropper' | 'brush_picker' | 'paint_picker' | 'free_brush' | 'spatial_brush' | 'liquify' | 'pointer' | 'select';

export interface BrushPreset {
  id: string;
  name: string;
  description: string;
  category: 'ink' | 'tubes' | 'pbr' | 'glow_fx' | 'decals' | 'custom';
  profile: StrokeProfile;
  materialType: MaterialType;
  shaderEffect?: AnimatedShaderEffect;
  size: number;
  opacity: number;
  roughness: number;
  metalness: number;
  emissiveIntensity?: number;
  patternType: PatternType;
  patternScale?: number;
  patternIntensity?: number;
  smoothingAlgorithm: SmoothingAlgorithm;
  smoothingStrength: number;
  spatialJitterEnabled?: boolean;
  jitterStrength?: number;
  straightLineMode?: boolean;
  color?: string;
  archSegments?: number;
  domeFactor?: number;
  isCustom?: boolean;
}

export interface PaintPreset {
  id: string;
  name: string;
  color: string;
  materialType: MaterialType;
  roughness: number;
  metalness: number;
  emissiveIntensity: number;
  opacity: number;
  shaderEffect?: AnimatedShaderEffect;
  category?: string;
}

export type EraserMode = 'cutout' | 'vacuum';

export interface HolisticStrokeDNA {
  colorHex: string;
  colorLinear: [number, number, number];
  size: number;
  opacity: number;
  materialType: MaterialType;
  shaderEffect?: AnimatedShaderEffect;
  roughness: number;
  metalness: number;
  emissiveIntensity: number;
  profile: StrokeProfile;
  patternType: PatternType;
  patternScale: number;
  patternIntensity: number;
  pressure?: number;
  strokeId?: string;
  layerId?: string;
  sourceType: 'stroke' | 'model_mesh' | 'pixel_framebuffer';
  timestamp: number;
}

export type SymmetryMode = 'none' | 'mirror_x' | 'mirror_y' | 'mirror_z' | 'custom_plane' | 'radial_4x' | 'radial_8x';

export type LiquifyMode = 'push' | 'pinch' | 'inflate' | 'comb';

export interface LiquifySettings {
  mode: LiquifyMode;
  brushRadius: number; // 0.05 to 1.5
  falloffRadius?: number; // 0.05 to 2.0
  influenceStrength: number; // 0.05 to 2.0
  iterations?: number;
}

export interface CustomMirrorConfig {
  planeOrigin: [number, number, number];
  planeNormal: [number, number, number];
  visible: boolean;
}

export interface CustomMirrorPlane {
  enabled: boolean;
  origin: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // degrees Euler
  visible: boolean;
  opacity: number;
}

export interface BentGuideConfig {
  id: string;
  name: string;
  points: THREE.Vector3[];
  width: number;
  opacity: number;
  visible: boolean;
  manifoldMesh?: THREE.Mesh;
  tension?: number; // 0.0 (uniform) to 1.0 (chordal/tight) Catmull-Rom tension
  divisions?: number; // Catmull-Rom curve sample resolution (8 to 128)
  twist?: number; // Swept bank twist angle in degrees (-180 to 180)
  profileCurve?: 'ribbon' | 'arc' | 'uchannel' | 'pipe';
}

export interface ReferenceImageItem {
  id: string;
  name: string;
  url?: string;
  dataUrl?: string;
  opacity: number;
  scale: number;
  rotation?: number; // Degrees Euler
  position?: { x: number; y: number };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  locked?: boolean;
  clickThrough?: boolean; // Tracing mode - pointer events pass directly to 3D canvas
  blendMode?: 'normal' | 'multiply' | 'screen' | 'difference';
  pinnedToScreen?: boolean;
  pinned?: boolean;
  visible?: boolean;
  grayscale?: boolean;
  invert?: boolean;
  flipH?: boolean;
  flipV?: boolean;
}

export type ScaffoldRenderMode = 'ghost' | 'wireframe' | 'solid' | 'invisible';
export type ScaffoldProxyType = 'mannequin_torso' | 'head_sphere' | 'car_chassis' | 'cylinder_limb' | 'dome_column' | 'capsule';

export interface CollisionGuideMeshConfig {
  id: string;
  name: string;
  mesh?: THREE.Object3D;
  visible: boolean;
  renderMode: ScaffoldRenderMode;
  opacity: number;
  colorHex: string;
  locked: boolean;
  isCollisionOnly: boolean;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number]; // degrees
    scale: [number, number, number];
  };
  source: 'imported' | 'primitive_proxy';
  proxyType?: ScaffoldProxyType;
  vertexCount?: number;
  triangleCount?: number;
}

export interface PrimitiveTopologyConfig {
  type: 'sphere' | 'cylinder' | 'torus' | 'cone' | 'capsule' | 'box' | 'plane';
  radialSegments: number;
  heightSegments: number;
  tubularSegments?: number;
  radius: number;
  height: number;
  width?: number;
  depth?: number;
  tubeRadius?: number;
  wireframeOverlay: boolean;
}

export interface NumpadTarget {
  id: string;
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onConfirm: (val: number) => void;
}

export interface ARSessionState {
  isSupported: boolean;
  isActive: boolean;
  hasHitTest: boolean;
  elevation: number;
  scale: number;
}

export type LightingPreset = 'studio' | 'daylight' | 'neon' | 'sunset' | 'clay_neutral';

export type MaterialType = 'shaded' | 'shadeless' | 'glow' | 'cutout' | 'animated_fx' | 'matcap';

export type StrokeProfile = 'tube' | 'ribbon' | 'marker' | 'conformal';

export type PatternType = 'none' | 'dot' | 'line' | 'cross' | 'terrazzo' | 'stipple';

export type SmoothingAlgorithm = 'none' | 'streamline' | 'exponential';

export type RenderMode = 'draft' | 'render';

export type ModelDisplayMode = 'clay' | 'texture';

export type AppTheme = 'light' | 'slate' | 'charcoal' | 'oled' | 'sand';

export type GizmoMode = 'Standard' | 'Compact' | 'Minimal' | 'Hidden' | 'tabbed' | 'dual' | 'trackball' | 'lexical' | 'off';

export interface Guide3D {
  id?: string;
  type?: 'plane' | 'cylinder' | 'sphere';
  rotation?: { x: number; y: number; z: number };
  originPoint?: { x: number; y: number; z: number; pressure?: number };
  opacity: number;
}

export interface StrokePoint {
  position: THREE.Vector3;     // 3D world hit position (with elevation bias applied)
  normal: THREE.Vector3;       // Smooth surface or camera-facing normal
  surfaceOffset: number;       // Base offset applied (0.002 or 0.004)
  pressure: number;            // Stylus pressure (0.0 to 1.0, default 0.5 for mouse)
  tangent?: THREE.Vector3;     // Direction of stroke motion
  binormal?: THREE.Vector3;    // Cross product of tangent and normal (Bishop frame)
  jitter?: THREE.Vector3;      // Spatial jitter deformation vector
  jitterFactor?: number;       // Per-point jitter scale
  colorLinear?: [number, number, number]; // Linear RGB vertex color
  uv?: THREE.Vector2;          // UV coordinate on underlying 3D model (if UV painting)
  hitMeshId?: string;          // Identifier of intersected mesh
  isSurfaceHit: boolean;       // True if snapped to mesh, false if drawn in air
  time: number;                // Timestamp (performance.now())
}

export interface BrushSettings {
  size: number; // in world or screen relative units (0.01 to 0.5)
  opacity: number; // 0.05 to 1.0
  color: string; // hex
  roughness: number;
  metalness: number;
  emissiveIntensity: number;
  pressureSensitivity: boolean;
  archSegments: number; // default 5 (conformal arched cross-section)
  domeFactor: number; // dome height multiplier (e.g. 0.2)
  surfaceOffset: number; // base offset to prevent coplanar z-fighting (e.g. 0.002)
  taperLength: number; // fraction 0.05
  silhouetteClamping: boolean;
  stencilMasking: boolean;
  autoRecalculateNormals?: boolean; // Toggle automatic mesh normal recalculation after drawing
  // Spatial Jitter & Ribbon Vertex Deformation
  spatialJitterEnabled?: boolean;
  jitterStrength?: number; // 0.0 to 1.0
  jitterFrequency?: number; // 1 to 20
  jitterAxis?: 'normal' | 'binormal' | 'omnidirectional';
  // Color Math & Pipeline
  oklabBlending?: boolean; // Perceptually uniform OKLab Cartesian color mixing
  wboitEnabled?: boolean; // Weighted Blended Order-Independent Transparency
  // Smoothing & Latency Optimization
  smoothingAlgorithm: SmoothingAlgorithm;
  smoothingStrength: number; // 0.0 to 1.0
  predictiveTracking?: boolean; // Optional legacy tracking flag
  predictionFactor?: number;
  // Core Material Type & Profile
  materialType: MaterialType;
  shaderEffect?: AnimatedShaderEffect; // 27 animated GLSL shader effects
  animatedEffect?: AnimatedShaderEffect; // alias for shaderEffect
  matcapUrl?: string; // Data URL or asset path for MatCap
  matcapTexture?: THREE.Texture; // Cached CanvasTexture / Texture instance
  customShader?: {
    id?: string;
    name?: string;
    vertexShader?: string;
    fragmentShader?: string;
    uniforms?: Record<string, any>;
  };
  profile: StrokeProfile;
  // Procedural Surface Pattern
  patternType: PatternType;
  patternScale: number; // 1 to 20
  patternIntensity: number; // 0 to 1
  patternAngle: number; // 0 to 360
  patternContrast: number; // 0.5 to 3.0
  // Marker / Chisel & Brush Shape parameters
  chiselAngle: number; // 0 to 180 degrees
  aspectRatio: number; // width to thickness ratio (e.g. 3.5)
  brushShape?: 'round' | 'wide_flat' | 'chisel' | 'square' | 'line';
  brushWidthMultiplier?: number; // 1.0 to 10.0 for wide straight lines & thick ribbon strokes
  brushAngle?: number; // 0 to 180 degrees stamp rotation
  straightLineMode?: boolean; // locks stroke to straight line from start to current point
  brushPresetId?: string; // Identifier of equipped preset (e.g. 'spatial_pipe', 'streamline_ink', etc.)
  // Raycasting & Surface Snapping Parameters
  raycastSampleDensity?: 'standard' | 'high' | 'ultra'; // Sub-step raycast resolution (16, 32, 48)
  doubleSidedRaycast?: boolean; // Ensure single-sided & back-facing polygons do not skip
  airGapTolerance?: number; // Distance threshold before stroke splits across occlusions
  barycentricNormals?: boolean; // Smooth barycentric normal interpolation
  raycastSeamBridging?: boolean; // Micro-jitter raycast fallback across geometry seams
  // Eraser & Drafting Snapping Extensions (Phase 3)
  eraserMode?: EraserMode; // 'cutout' (negative-space mask) vs 'vacuum' (whole-stroke continuous purge)
  shapeSnapping?: boolean; // Algorithmic geometric shape snapping (line, circle, arc, polygon)
  shapeSnapTolerance?: number; // Geometric fitting confidence threshold (0.1 to 0.5)
  // Spatial Independence vs Surface Snapping
  drawingMode?: 'surface' | 'spatial_3d'; // 'surface' = snaps to 3D model, 'spatial_3d' = free 3D air drawing
  spatialDepth?: number; // Distance plane for free 3D drawing
}

export interface PostProcessSettings {
  renderMode: RenderMode;
  toonShading: boolean;
  toonSteps: number; // 2 to 6
  bloom: boolean;
  bloomIntensity: number; // 0.1 to 3.0
  bloomRadius: number; // 0.1 to 1.5
  bloomThreshold: number; // 0.0 to 1.0
  dof: boolean;
  dofFocusDistance: number; // 0.5 to 10.0
  dofAperture: number; // 0.001 to 0.05
  grain: boolean;
  grainIntensity: number; // 0.02 to 0.4
  pixelation: boolean;
  pixelSize: number; // 2 to 16
}

export interface StrokeDescriptor {
  id: string;
  layerId: string;
  tool: ToolType;
  points: StrokePoint[];
  settings: BrushSettings;
  symmetryIndex?: number;
  isUVStroke?: boolean;
  createdAt: number;
}

export type LayerBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode?: LayerBlendMode;
  strokeIds: string[];
  type?: 'layer' | 'group';
  parentId?: string | null;
  children?: string[]; // IDs of child items if type === 'group'
  collapsed?: boolean;
  colorTag?: string; // Optional UI color indicator for layer organization
}

export interface ModelMetadata {
  name: string;
  vertexCount: number;
  triangleCount: number;
  meshCount: number;
  dimensions: THREE.Vector3;
  hasUVs: boolean;
}

export interface ViewportState {
  isPainting: boolean;
  isPanningOrOrbiting: boolean;
  fps: number;
  zoomLevel: number;
  activeModelName: string;
  showWireframe: boolean;
  showNormals: boolean;
  showGrid: boolean;
  lightingPreset: LightingPreset;
  renderMode: RenderMode;
}

export type TransformJoystickMode = '2d' | '3d';

export type TransformTargetScope = 'all' | 'strokes' | 'active_layer' | 'model';

export type PerfectViewType = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'isometric' | null;

export interface PerfectViewInfo {
  isPerfect: boolean;
  view: PerfectViewType;
  depthAxis: 'x' | 'y' | 'z' | null;
}

export interface GPUInfo {
  backend: 'webgl' | 'webgl2' | 'webgpu';
  adapterName: string;
  vendor: string;
  architecture: string;
  isWebGPUSupported: boolean;
  maxTextureDimension2D: number;
  computeSupport: boolean;
  powerPreference: string;
  driverVersion?: string;
  msaaTier?: number;
}

export type SupportedModelFormat =
  | 'glb'
  | 'gltf'
  | 'obj'
  | 'fbx'
  | '3ds'
  | 'stl'
  | 'ply'
  | 'dae';

export interface Saved3DModel {
  id: string;
  name: string;
  originalName: string;
  originalFormat: string;
  originalSize: number;
  compressedSize: number;
  savedDate: number;
  thumbnail: string;
  blob: ArrayBuffer;
  triangleCount: number;
  vertexCount: number;
  meshCount: number;
  materialCount: number;
  dimensions: { x: number; y: number; z: number };
  dracoCompressed: boolean;
  isBaked: boolean;
  quantizationBits?: {
    position: number;
    normal: number;
    uv: number;
  };
}

export interface ModelTransformConfig {
  rotation: { x: number; y: number; z: number }; // degrees
  scale: { x: number; y: number; z: number };
  uniformScale: boolean;
  upAxis: 'y' | 'z';
  centerOrigin: boolean;
  snapFloor: boolean;
  bakeTransforms: boolean;
}

export interface DracoCompressionConfig {
  enabled: boolean;
  compressionLevel: number; // 1 - 10
  positionQuantization: number; // 8 - 16
  normalQuantization: number; // 6 - 12
  uvQuantization: number; // 6 - 12
  colorQuantization: number; // 6 - 10
}

export interface SubmeshInfo {
  id: string;
  name: string;
  triangles: number;
  vertices: number;
  materialName: string;
  visible: boolean;
}

export interface ModelInspectionData {
  name: string;
  format: string;
  originalBytes: number;
  triangleCount: number;
  vertexCount: number;
  meshCount: number;
  materialCount: number;
  dimensions: { x: number; y: number; z: number };
  submeshes: SubmeshInfo[];
}

export interface ConversionResult {
  id: string;
  name: string;
  originalBytes: number;
  convertedBytes: number;
  reductionPercentage: number;
  durationMs: number;
  glbBlob: Blob;
  glbArrayBuffer: ArrayBuffer;
  thumbnail: string;
  inspection: ModelInspectionData;
  savedModel: Saved3DModel;
}

export type TransformMode = '2d' | '3d' | 'tactile';

export type AccessibilityMode = 'standard' | 'finger-pen' | 'touch-boost';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Rotation3D {
  rx: number; // Pitch in degrees
  ry: number; // Yaw in degrees
  rz: number; // Roll in degrees
}

export interface Scale3D {
  sx: number;
  sy: number;
  sz: number;
  uniform: number;
}

export interface TranslationEventPayload {
  x: number;
  y: number;
  z: number;
  normalizedX: number;
  normalizedY: number;
  normalizedZ: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  source: string;
  timestamp: number;
}

export interface RotationEventPayload {
  rx: number;
  ry: number;
  rz: number;
  deltaAngle: number;
  axis: 'x' | 'y' | 'z' | 'trackball' | '2d-plane';
  source: string;
  timestamp: number;
}

export interface ScaleEventPayload {
  sx: number;
  sy: number;
  sz: number;
  uniform: number;
  deltaScale: number;
  handle: 'scale-x' | 'scale-y' | 'scale-uniform';
  source: string;
  timestamp: number;
}

export interface LoadedModelInfo {
  id: string;
  name: string;
  meshCount: number;
  visible: boolean;
  isDrawingPlane: boolean;
}

export interface TransformNavigatorProps {
  initialMode?: TransformMode;
  isLocked?: boolean;
  onLockChange?: (locked: boolean) => void;
  onModeChange?: (mode: TransformMode) => void;
  onTranslate?: (data: TranslationEventPayload) => void;
  onRotate?: (data: RotationEventPayload) => void;
  onScale?: (data: ScaleEventPayload) => void;
  onInteractionStart?: (handleName: string) => void;
  onInteractionEnd?: (handleName: string) => void;
  onReset?: () => void;
  onClose?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  clipboardCount?: number;
  activeTargetName?: string;
  layers?: Layer[];
  activeLayerId?: string;
  onSelectLayer?: (layerId: string) => void;
  models?: LoadedModelInfo[];
  activeModelId?: string | null;
  onSelectModel?: (modelId: string | null) => void;
  targetScope?: TransformTargetScope;
  onSelectTargetScope?: (scope: TransformTargetScope) => void;
  accessibilityMode?: AccessibilityMode;
  onAccessibilityModeChange?: (mode: AccessibilityMode) => void;
  className?: string;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  dockPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'floating';
  uiScale?: number;
  engine?: any;
  sensitivity?: number;
  onSensitivityChange?: (s: number) => void;
  theme?: 'light' | 'dark';
}

export interface TelemetryLogEntry {
  id: string;
  type: 'translate' | 'rotate' | 'scale' | 'mode' | 'lock' | 'reset';
  label: string;
  data: Record<string, number | string | boolean>;
  timestamp: string;
}

export type ActiveControllerType = 'navigator' | 'tactile' | 'both' | 'hidden';

export type SpatialMode = '2d' | '3d' | 'tactile_ball';

export type SubWheelMode = 'joystick' | 'ball' | 'dial';

export interface SpatialState {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
  scale: number;
  brushSize: number;
}

export interface ProjectSaveData {
  version: string;
  name: string;
  timestamp: number;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    spherical?: { radius: number; theta: number; phi: number };
  };
  layers: Layer[];
  strokes: StrokeDescriptor[];
  activeModelName?: string;
  activeModelId?: string;
  lightingPreset?: LightingPreset;
  brushSettings?: Partial<BrushSettings>;
  skySettings?: Partial<SkySettings>;
  showGrid?: boolean;
  showWireframe?: boolean;
  // Non-destructive history and texture state
  undoStack?: Array<{ type: 'create' | 'erase'; strokes: StrokeDescriptor[] }>;
  historyUndoStack?: any[];
  historyRedoStack?: any[];
  uvCanvases?: Record<string, string>; // layerId -> base64 PNG dataUrl
}

export interface SavedProjectSession {
  id: string;
  name: string;
  timestamp: number;
  thumbnail?: string;
  strokeCount: number;
  layerCount: number;
  activeModelName?: string;
  projectData: ProjectSaveData;
}




