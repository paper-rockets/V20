import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import * as THREE from 'three';
import {
  ToolType,
  BrushSettings,
  SymmetryMode,
  Layer,
  LightingPreset,
  PostProcessSettings,
  PerfectViewInfo,
  PerfectViewType,
  GPUInfo,
  SkyPresetName,
  ModelDisplayMode,
  ModelMetadata,
  GizmoMode,
  Guide3D,
  ActiveControllerType,
  ProjectSaveData,
} from './types';
import { StudioEngine } from './core/studioEngine';
import { Viewport } from './components/Viewport';
import { LayerPanel } from './components/LayerPanel';
import { BrushSettingsPanel } from './components/BrushSettingsPanel';
import { ModelDisplayPanel } from './components/ModelDisplayPanel';
import { ScreenCenterCrosshair } from './components/ScreenCenterCrosshair';
import { Option3SphereNavigator } from './components/TransformNavigator/Option3SphereNavigator';
import { FpsCounter } from './components/FpsCounter';
import { DeferredPanel } from './components/DeferredPanel';
import { publishCameraPose, publishFps } from './core/telemetryStore';
import { useUiMode, useHasOnboarded, setUiMode } from './core/uiModeStore';
import { ProShell } from './components/pro/ProShell';
import { useOpenSheet, openSheetId, closeSheet, toggleSheet } from './components/play/sheetStore';
import { PlayTopStrip } from './components/play/PlayTopStrip';
import { PlayDock, PlayToolId, playToolSettings } from './components/play/PlayDock';
import { FirstRunOverlay } from './components/play/FirstRunOverlay';
import { Toybox } from './components/play/Toybox';
import { PlayStats } from './components/play/PlayStats';
import { PlaySettingsSheet } from './components/play/PlaySettingsSheet';
import { PlayImporter } from './components/play/PlayImporter';
import { ShapesSheet } from './components/play/ShapesSheet';
import { MagicFxSheet } from './components/play/MagicFxSheet';
import { Compass } from 'lucide-react';
import { CameraRecoveryPill } from './components/CameraRecoveryPill';
import { AutoSaveToast, AutoSaveStatus } from './components/AutoSaveToast';
import {
  checkStoragePersistence,
  requestStoragePersistence,
  getStorageEstimate,
  saveAutoSaveProject,
  loadAutoSaveProject,
  hasAutoSaveProject,
  clearAutoSaveProject,
  saveProjectSession,
  StorageEstimateInfo,
  AutoSaveMetaInfo,
} from './utils/storagePermission';

const ProjectSessionModal = lazy(() =>
  import('./components/ProjectSessionModal').then((m) => ({ default: m.ProjectSessionModal }))
);

/**
 * Deferred UI.
 *
 * These panels and modals are closed on load, but eagerly importing them pulled
 * their entire dependency graph (extra Three.js scenes, jszip, QR encoding, the
 * shader preset tables) into the initial bundle. Parsing that costs real time on
 * a mobile CPU before the first frame can render. Each now loads the first time
 * the user opens it, and stays cached afterwards.
 */
const RenderSettingsPanel = lazy(() =>
  import('./components/RenderSettingsPanel').then((m) => ({ default: m.RenderSettingsPanel }))
);
const ModelLibraryModal = lazy(() =>
  import('./components/ModelLibraryModal').then((m) => ({ default: m.ModelLibraryModal }))
);
const ExportModal = lazy(() => import('./components/ExportModal').then((m) => ({ default: m.ExportModal })));
const RaycastSettingsModal = lazy(() =>
  import('./components/RaycastSettingsModal').then((m) => ({ default: m.RaycastSettingsModal }))
);
const ModelConverterModal = lazy(() =>
  import('./components/ModelConverterModal').then((m) => ({ default: m.ModelConverterModal }))
);
const SkyEnvironmentPanel = lazy(() =>
  import('./components/SkyEnvironmentPanel').then((m) => ({ default: m.SkyEnvironmentPanel }))
);
const SimpleSceneIlluminationModal = lazy(() =>
  import('./components/SimpleSceneIlluminationModal').then((m) => ({ default: m.SimpleSceneIlluminationModal }))
);
const IlluminationStudioModal = lazy(() =>
  import('./components/IlluminationStudioModal').then((m) => ({ default: m.IlluminationStudioModal }))
);
const CurveDecimateModal = lazy(() =>
  import('./components/CurveDecimateModal').then((m) => ({ default: m.CurveDecimateModal }))
);
const CustomMirrorModal = lazy(() =>
  import('./components/CustomMirrorModal').then((m) => ({ default: m.CustomMirrorModal }))
);
const BentGuideModal = lazy(() => import('./components/BentGuideModal').then((m) => ({ default: m.BentGuideModal })));
const ARViewerModal = lazy(() => import('./components/ARViewerModal').then((m) => ({ default: m.ARViewerModal })));
const NumpadModal = lazy(() => import('./components/NumpadModal').then((m) => ({ default: m.NumpadModal })));
const ColorStudioModal = lazy(() =>
  import('./components/CompactColorStudioModal').then((m) => ({ default: m.ColorStudioModal }))
);
const HolisticDNAInspector = lazy(() =>
  import('./components/HolisticDNAInspector').then((m) => ({ default: m.HolisticDNAInspector }))
);
const FloatingReferenceClipboard = lazy(() =>
  import('./components/FloatingReferenceClipboard').then((m) => ({ default: m.FloatingReferenceClipboard }))
);
const ScaffoldingModal = lazy(() =>
  import('./components/ScaffoldingModal').then((m) => ({ default: m.ScaffoldingModal }))
);
import { haptics } from './utils/haptics';
import { setGlobalSoundEnabled } from './utils/audio';
import { PlatformBridge } from './core/platformBridge';
import {
  LiquifySettings,
  CustomMirrorConfig,
  TranslationEventPayload,
  RotationEventPayload,
  ScaleEventPayload,
  NumpadTarget,
  HolisticStrokeDNA,
  ReferenceImageItem,
  LoadedModelInfo,
  TransformTargetScope,
  SavedProjectSession,
} from './types';

const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  size: 0.035,
  opacity: 1.0,
  color: '#38bdf8',
  roughness: 0.8,
  metalness: 0.0,
  emissiveIntensity: 0.0,
  pressureSensitivity: true,
  archSegments: 3,
  domeFactor: 0.0,
  surfaceOffset: 0.002,
  taperLength: 0.05,
  silhouetteClamping: true,
  stencilMasking: false,
  autoRecalculateNormals: true,
  smoothingAlgorithm: 'streamline',
  smoothingStrength: 0.55,
  materialType: 'shadeless',
  profile: 'ribbon',
  patternType: 'none',
  patternScale: 4.0,
  patternIntensity: 1.0,
  patternAngle: 45,
  patternContrast: 1.0,
  chiselAngle: 45,
  aspectRatio: 3.5,
  shapeSnapping: false,
  shapeSnapTolerance: 0.14,
};

const DEFAULT_POST_SETTINGS: PostProcessSettings = {
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

const DEFAULT_LAYERS: Layer[] = [
  {
    id: 'layer_base_1',
    name: 'Layer 1',
    visible: true,
    locked: false,
    opacity: 1.0,
    blendMode: 'normal',
    strokeIds: [],
  },
];

export function App() {
  const [engine, setEngine] = useState<StudioEngine | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('mody_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('mody_theme', theme);
    } catch (_) {}
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
      document.body.className = theme === 'dark'
        ? 'bg-[#0f1117] text-neutral-100 overflow-hidden select-none dark'
        : 'bg-[#f4f0e9] text-neutral-800 overflow-hidden select-none light';
    }
    if (engine) {
      engine.setTheme(theme);
    }
  }, [theme, engine]);

  const uiMode = useUiMode();
  const openSheet = useOpenSheet();
  const hasOnboarded = useHasOnboarded();
  const [isToyboxOpen, setIsToyboxOpen] = useState<boolean>(false);
  const [showPlayStats, setShowPlayStats] = useState<boolean>(false);
  const [showPlayNavigator, setShowPlayNavigator] = useState<boolean>(true);
  const [isPlayImporterOpen, setIsPlayImporterOpen] = useState<boolean>(false);
  const [tool, setTool] = useState<ToolType>('brush');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>(DEFAULT_BRUSH_SETTINGS);
  const [postSettings, setPostSettings] = useState<PostProcessSettings>(DEFAULT_POST_SETTINGS);
  const [symmetry, setSymmetry] = useState<SymmetryMode>('none');
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState<string>(DEFAULT_LAYERS[0].id);

  // Model & Sky Environment State
  const [activeModelName, setActiveModelName] = useState<string>('Drawing Canvas');
  const [modelMetadata, setModelMetadata] = useState<ModelMetadata | null>(null);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('clay_neutral');
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('Standard');
  const [activeController, setActiveController] = useState<ActiveControllerType>(() => {
    try {
      const saved = localStorage.getItem('mody_active_controller');
      if (saved === 'navigator' || saved === 'tactile' || saved === 'both' || saved === 'hidden') {
        return saved as ActiveControllerType;
      }
    } catch (_) {}
    return 'tactile';
  });

  const handleControllerChange = (ctrl: ActiveControllerType) => {
    setActiveController(ctrl);
    try {
      localStorage.setItem('mody_active_controller', ctrl);
    } catch (_) {}
    if (ctrl === 'hidden') {
      setGizmoMode('Hidden');
    } else {
      setGizmoMode('Standard');
    }
  };

  const [navigatorStyle, setNavigatorStyle] = useState<'opt3' | 'opt1' | 'classic'>(() => {
    try {
      const saved = localStorage.getItem('paperrocket_nav_style');
      if (saved === 'opt3' || saved === 'opt1' || saved === 'classic') return saved;
    } catch (_) {}
    return 'opt3';
  });

  const handleNavigatorStyleChange = (style: 'opt3' | 'opt1' | 'classic') => {
    setNavigatorStyle(style);
    try {
      localStorage.setItem('paperrocket_nav_style', style);
    } catch (_) {}
  };

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    try {
      localStorage.setItem('mody_sound_enabled', 'false');
    } catch (_) {}
    return false;
  });

  const handleToggleSound = () => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('mody_sound_enabled', String(next));
      } catch (_) {}
      haptics.setAudioFeedbackEnabled(next);
      setGlobalSoundEnabled(next);
      return next;
    });
  };

  // Global UI Scale state with persistence
  const [uiScale, setUiScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('mody_global_ui_scale');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.65 && parsed <= 1.8) {
          return parsed;
        }
      }
    } catch (_) {}
    return 1.0;
  });

  const [isNarrowScreen, setIsNarrowScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 840 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < 840);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUiScaleChange = useCallback((newScale: number) => {
    const clamped = Math.max(0.65, Math.min(1.6, Math.round(newScale * 100) / 100));
    setUiScale(clamped);
    try {
      localStorage.setItem('mody_global_ui_scale', clamped.toString());
    } catch (_) {}
  }, []);

  const [perfectView, setPerfectView] = useState<PerfectViewInfo>({
    isPerfect: false,
    view: null,
    depthAxis: null,
  });

  const [crosshairActive, setCrosshairActive] = useState<boolean>(false);
  const [crosshairAction, setCrosshairAction] = useState<string>('');
  const [crosshairValue, setCrosshairValue] = useState<string>('');

  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [cameraInteracting, setCameraInteracting] = useState<boolean>(false);
  const [gpuInfo, setGpuInfo] = useState<GPUInfo>({
    backend: 'webgl2',
    adapterName: 'Universal GPU Device',
    vendor: 'Universal GPU Device',
    architecture: 'Universal Raster Pipeline',
    isWebGPUSupported: false,
    maxTextureDimension2D: 4096,
    computeSupport: false,
    powerPreference: 'high-performance',
  });

  // Modals & Panels
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isRenderSettingsOpen, setIsRenderSettingsOpen] = useState<boolean>(false);
  const [isModelsOpen, setIsModelsOpen] = useState<boolean>(false);
  const [isModelDisplayOpen, setIsModelDisplayOpen] = useState<boolean>(false);
  const [modelDisplayMode, setModelDisplayMode] = useState<ModelDisplayMode>('texture');
  const [isModelVisible, setIsModelVisible] = useState<boolean>(true);
  const [isConverterOpen, setIsConverterOpen] = useState<boolean>(false);
  const [droppedFilesForConverter, setDroppedFilesForConverter] = useState<FileList | File[] | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState<boolean>(false);
  const [isRaycastSettingsOpen, setIsRaycastSettingsOpen] = useState<boolean>(false);
  const [isIlluminationOpen, setIsIlluminationOpen] = useState<boolean>(false);
  const [isSkyEnvironmentOpen, setIsSkyEnvironmentOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [windowDragOver, setWindowDragOver] = useState<boolean>(false);

  // Sprint 1-5 Spatial Editing & Hardware States
  const [fingerPenMode, setFingerPenMode] = useState<boolean>(true);
  const [navigatorSensitivity, setNavigatorSensitivity] = useState<number>(1.0);

  useEffect(() => {
    engine?.setNavigatorSensitivity(navigatorSensitivity);
  }, [engine, navigatorSensitivity]);
  const [projectionMode, setProjectionMode] = useState<'perspective' | 'orthographic'>('perspective');
  const [isStylusDetected, setIsStylusDetected] = useState<boolean>(false);
  const [isLiquifyOpen, setIsLiquifyOpen] = useState<boolean>(false);
  const [isCompareActive, setIsCompareActive] = useState<boolean>(false);
  const [liquifySettings, setLiquifySettings] = useState<LiquifySettings>({
    mode: 'push',
    brushRadius: 0.25,
    influenceStrength: 0.6,
    iterations: 1,
  });
  const [isDecimateOpen, setIsDecimateOpen] = useState<boolean>(false);
  const [isBentGuideOpen, setIsBentGuideOpen] = useState<boolean>(false);
  const [isCustomMirrorOpen, setIsCustomMirrorOpen] = useState<boolean>(false);
  const [customMirrorConfig, setCustomMirrorConfig] = useState<CustomMirrorConfig>({
    planeOrigin: [0, 0, 0],
    planeNormal: [1, 0, 0],
    visible: true,
  });
  const [isARViewerOpen, setIsARViewerOpen] = useState<boolean>(false);
  const [showPlane, setShowPlane] = useState<boolean>(true);
  const [numpadTarget, setNumpadTarget] = useState<NumpadTarget | null>(null);

  // Phase 4 Stage Assets, Scaffolding Hierarchy & Reference Clipboard States
  const [isScaffoldingOpen, setIsScaffoldingOpen] = useState<boolean>(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState<boolean>(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageItem[]>([]);

  // Dev Settings: Disable Right-Click Radial Menu
  const [disableContextMenu, setDisableContextMenu] = useState<boolean>(() => {
    try {
      return localStorage.getItem('remix3d_disable_context_menu') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleDisableContextMenu = useCallback(() => {
    setDisableContextMenu((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('remix3d_disable_context_menu', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleProjection = useCallback(() => {
    if (!engine) return;
    const nextMode = engine.toggleProjectionMode();
    setProjectionMode(nextMode);
  }, [engine]);

  // Phase 3 Color Studio, Holistic DNA & Shape Snapping States
  const [isColorStudioOpen, setIsColorStudioOpen] = useState<boolean>(false);
  const [activeDNA, setActiveDNA] = useState<HolisticStrokeDNA | null>(null);
  const [snappedShapeNotice, setSnappedShapeNotice] = useState<string | null>(null);

  // Global on-screen Numpad event listener
  useEffect(() => {
    const handleOpenNumpad = (e: any) => {
      if (e && e.detail) {
        setNumpadTarget(e.detail);
      }
    };
    window.addEventListener('OPEN_NUMPAD', handleOpenNumpad);
    return () => {
      window.removeEventListener('OPEN_NUMPAD', handleOpenNumpad);
    };
  }, []);

  const [activeGuide, setActiveGuide] = useState<Guide3D | null>(null);

  // Storage Permission & Bulletproof IndexedDB Auto-Save
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [isStoragePersistent, setIsStoragePersistent] = useState<boolean>(false);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateInfo | null>(null);
  const [autoSaveMeta, setAutoSaveMeta] = useState<AutoSaveMetaInfo>({ exists: false });
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = React.useRef<boolean>(true);

  // Initialize Storage Persistence check and query local autosave session
  useEffect(() => {
    checkStoragePersistence().then((persisted) => {
      setIsStoragePersistent(persisted);
      if (!persisted) {
        // Attempt silent browser persistence request on startup
        requestStoragePersistence().then((granted) => {
          setIsStoragePersistent(granted);
        });
      }
    });
    getStorageEstimate().then(setStorageEstimate);
    hasAutoSaveProject().then(setAutoSaveMeta);
  }, []);

  const handleRequestStoragePermission = useCallback(async () => {
    const granted = await requestStoragePersistence();
    setIsStoragePersistent(granted);
    const est = await getStorageEstimate();
    setStorageEstimate(est);
    return granted;
  }, []);

  const handleRestoreAutoSave = useCallback(async () => {
    if (!engine) return;
    try {
      const savedProject = await loadAutoSaveProject();
      if (savedProject) {
        engine.importProjectData(savedProject);
        if (savedProject.layers && savedProject.layers.length > 0) {
          setLayers(savedProject.layers);
          setActiveLayerId(savedProject.layers[0].id);
        }
        if (savedProject.lightingPreset) {
          setLightingPreset(savedProject.lightingPreset);
        }
        if (savedProject.showGrid !== undefined) {
          setShowGrid(savedProject.showGrid);
        }
        if (savedProject.showWireframe !== undefined) {
          setShowWireframe(savedProject.showWireframe);
        }
        haptics.trigger('success');
      }
    } catch (err) {
      console.error('Failed to restore autosaved project:', err);
    }
  }, [engine]);

  const handleClearAutoSave = useCallback(async () => {
    await clearAutoSaveProject();
    setAutoSaveMeta({ exists: false });
    const est = await getStorageEstimate();
    setStorageEstimate(est);
    haptics.trigger('light');
  }, []);

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Debounce save execution smoothly
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!engine) return;
      try {
        setAutoSaveStatus('saving');

        // 1. Export full 3D project representation
        const projectData = engine.exportProjectData('Autosaved Session', layers);

        // 2. Commit full project into IndexedDB (supports unlimited geometric data)
        await saveAutoSaveProject(projectData);

        // 3. Keep lightweight fallback meta in LocalStorage
        const metaState = {
          timestamp: Date.now(),
          layerCount: layers.length,
          modelName: activeModelName,
          lightingPreset,
          brushSettingsSummary: {
            color: brushSettings.color,
            size: brushSettings.size,
            tool,
          },
        };
        try {
          localStorage.setItem('mody_autosave_meta', JSON.stringify(metaState));
        } catch (_) {}

        setAutoSaveStatus('saved');
        setLastSavedTime(new Date());
        setAutoSaveMeta({
          exists: true,
          timestamp: Date.now(),
          strokeCount: projectData.strokes?.length || 0,
          layerCount: layers.length,
          modelName: activeModelName,
          formattedDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        // Update storage estimate
        getStorageEstimate().then(setStorageEstimate);

        // Revert to idle after 2.5s
        setTimeout(() => {
          setAutoSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 2500);
      } catch (err) {
        console.warn('Auto-save storage failed:', err);
        setAutoSaveStatus('error');
        setTimeout(() => {
          setAutoSaveStatus((prev) => (prev === 'error' ? 'idle' : prev));
        }, 3500);
      }
    }, 650);
  }, [engine, layers, activeModelName, lightingPreset, brushSettings, tool]);

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  // Multi-Model & Target Scope State
  const [loadedModels, setLoadedModels] = useState<LoadedModelInfo[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [targetScope, setTargetScope] = useState<TransformTargetScope>('all');

  useEffect(() => {
    const handleModelsChanged = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setLoadedModels(e.detail);
      }
    };
    window.addEventListener('MODELS_CHANGED', handleModelsChanged);
    return () => window.removeEventListener('MODELS_CHANGED', handleModelsChanged);
  }, []);

  const handleSelectModel = useCallback((modelId: string | null) => {
    setActiveModelId(modelId);
    if (engine) {
      engine.setActiveSelectedModel(modelId);
    }
  }, [engine]);

  const handleSelectLayer = useCallback((layerId: string) => {
    setActiveLayerId(layerId);
    if (engine) {
      engine.setActiveLayer(layerId);
    }
  }, [engine]);

  const handleSelectTargetScope = useCallback((scope: TransformTargetScope) => {
    setTargetScope(scope);
  }, []);

  const handleEngineReady = useCallback((inst: StudioEngine) => {
    setEngine(inst);
    inst.setSkyPreset('off');
    inst.setTheme(theme);
    inst.setGrid(showGrid);
    inst.setupDefaultDrawingPlane();
    inst.toggleDrawingPlane(true);
    inst.setPostProcessSettings(DEFAULT_POST_SETTINGS);
    setGpuInfo(inst.getGPUInfo());
    setLoadedModels(inst.getLoadedModels());
    inst.onModelsChanged = (models) => {
      setLoadedModels(models);
      if (models.length > 0 && !activeModelId) {
        setActiveModelId(models[0].id);
      }
    };
    inst.onGPUInfoUpdate = (info) => {
      setGpuInfo(info);
    };
    // FPS and camera pose arrive every frame. They go to the telemetry store, not
    // React state - FpsCounter and any pose consumer subscribe as leaves, so a
    // 60 fps stream never re-renders this component tree.
    inst.onFpsUpdate = (f) => {
      publishFps(f);
    };
    inst.onProjectionChange = (mode) => {
      setProjectionMode(mode);
    };
    inst.onHistoryChange = (u, r) => {
      setCanUndo(u);
      setCanRedo(r);
    };
    inst.onMetadataUpdate = (meta) => {
      setModelMetadata(meta);
      setActiveModelName(meta.name);
    };
    inst.onViewChange = (pv) => {
      setPerfectView(pv);
    };
    inst.onCameraChange = (sph) => {
      // sph is a pooled object owned by the engine; only its numbers are read.
      publishCameraPose(sph.radius, sph.theta, sph.phi);
    };
    inst.onAutoSaveTrigger = (reason) => {
      triggerAutoSave(reason === 'model_loaded' ? 'model' : 'changes');
    };
    inst.onDNAInjected = (dna: HolisticStrokeDNA) => {
      setActiveDNA(dna);
      setBrushSettings((prev) => ({
        ...prev,
        color: dna.colorHex,
        size: dna.size,
        opacity: dna.opacity,
        roughness: dna.roughness,
        metalness: dna.metalness,
        emissiveIntensity: dna.emissiveIntensity,
        materialType: dna.materialType,
        profile: dna.profile,
        patternType: dna.patternType,
        patternScale: dna.patternScale,
        patternIntensity: dna.patternIntensity,
        shaderEffect: dna.shaderEffect,
      }));
    };
    inst.onShapeSnapped = (result) => {
      if (uiMode === 'play') return;
      const typeLabels: Record<string, string> = {
        line: 'Straight Line',
        circle: 'Perfect Circle',
        arc: 'Circular Arc',
        polygon: 'Closed Polygon',
      };
      const shapeType = result.detectedShape;
      const label = typeLabels[shapeType] || shapeType;
      setSnappedShapeNotice(`Snapped to ${label} (${Math.round(result.confidence * 100)}% fit)`);
      setTimeout(() => {
        setSnappedShapeNotice((cur) => (cur?.includes(label) ? null : cur));
      }, 2400);
    };
  }, [triggerAutoSave, activeModelId]);

  // Transform Navigator Gizmo Handlers
  const [isGizmoLocked, setIsGizmoLocked] = useState<boolean>(false);

  const handleGizmoTranslate = useCallback(
    (payload: TranslationEventPayload) => {
      if (!engine) return;
      if (payload.source.startsWith('2d-move-stick')) {
        // Dial emits screen px for this frame already (time-based glide) - do not rescale
        engine.translateScreenSpace(payload.deltaX, payload.deltaY, targetScope, isGizmoLocked);
      } else if (payload.source.startsWith('3d-node')) {
        // Dial emits world units already (time-based glide) - do not rescale here
        if (payload.x !== 0) engine.translateAxis3D('x', payload.x, targetScope);
        if (payload.y !== 0) engine.translateAxis3D('y', payload.y, targetScope);
        if (payload.z !== 0) engine.translateAxis3D('z', payload.z, targetScope);
      }
    },
    [engine, isGizmoLocked, targetScope]
  );

  const handleGizmoRotate = useCallback(
    (payload: RotationEventPayload) => {
      if (!engine) return;
      if (payload.source === '2d-rotate-handle') {
        engine.rotateAxis3D('z', (payload.deltaAngle * Math.PI) / 180, targetScope, isGizmoLocked);
      } else if (payload.source === '3d-trackball-sphere') {
        engine.rotateTrackball(payload.ry, payload.rx, targetScope);
      } else if (payload.axis === 'x' || payload.axis === 'y' || payload.axis === 'z') {
        engine.rotateAxis3D(payload.axis, (payload.deltaAngle * Math.PI) / 180, targetScope, isGizmoLocked);
      }
    },
    [engine, isGizmoLocked, targetScope]
  );

  const handleGizmoScale = useCallback(
    (payload: ScaleEventPayload) => {
      if (!engine) return;
      if (payload.handle === 'scale-y') {
        engine.scaleAxis('y', 1 + payload.deltaScale, targetScope, isGizmoLocked);
      } else if (payload.handle === 'scale-x') {
        engine.scaleAxis('x', 1 + payload.deltaScale, targetScope, isGizmoLocked);
      } else if (payload.handle === 'scale-uniform') {
        engine.scaleAxis('uniform', 1 + payload.deltaScale, targetScope, isGizmoLocked);
      } else if (payload.deltaScale) {
        engine.scaleAxis('uniform', 1 + payload.deltaScale, targetScope, isGizmoLocked);
      }
    },
    [engine, isGizmoLocked, targetScope]
  );

  const handleGizmoReset = useCallback(() => {
    if (!engine) return;
    engine.resetTransform(targetScope);
    engine.snapToView('isometric');
  }, [engine, targetScope]);

  const handleGizmoInteractionStart = useCallback(
    (handleName: string) => {
      if (!engine) return;
      engine.beginTransform(targetScope);
    },
    [engine, targetScope]
  );

  const handleGizmoInteractionEnd = useCallback(
    (handleName: string) => {
      if (!engine) return;
      engine.endTransform();
    },
    [engine]
  );

  // Watch layer modifications for auto-save
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    triggerAutoSave('layers');
  }, [layers, triggerAutoSave]);

  // Sync theme to engine & persist
  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try {
      localStorage.setItem('mody_theme', nextTheme);
    } catch (_) {}
    engine?.setTheme(nextTheme);
  };

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    try {
      localStorage.setItem('mody_theme', newTheme);
    } catch (_) {}
    engine?.setTheme(newTheme);
  };

  // Full Project State Save (.remix3d JSON file)
  const handleSaveProject = useCallback(async () => {
    if (!engine) return;
    const projectData = engine.exportProjectData(activeModelName || 'Remix 3D Project', layers);
    const jsonStr = JSON.stringify(projectData, null, 2);
    const filename = `${(projectData.name || 'Remix3D_Project').replace(/\s+/g, '_')}_${Date.now()}.remix3d`;
    await PlatformBridge.saveModelFile(filename, jsonStr, [
      { name: 'Remix 3D Project', extensions: ['remix3d', 'json'] },
    ]);
    PlatformBridge.triggerHaptic('success');
  }, [engine, layers, activeModelName]);

  // Full Project State Load (.remix3d JSON file)
  const handleLoadProject = useCallback((file: File) => {
    if (!engine) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const projectData: ProjectSaveData = JSON.parse(content);
        await engine.importProjectData(projectData);
        if (projectData.layers && projectData.layers.length > 0) {
          setLayers(projectData.layers);
          setActiveLayerId(projectData.layers[0].id);
        }
        if (projectData.lightingPreset) {
          setLightingPreset(projectData.lightingPreset);
        }
        if (projectData.showGrid !== undefined) {
          setShowGrid(projectData.showGrid);
        }
        if (projectData.showWireframe !== undefined) {
          setShowWireframe(projectData.showWireframe);
        }
        if (projectData.name) {
          setActiveModelName(projectData.name);
        }
        haptics.trigger('success');
      } catch (err) {
        console.error('Failed to parse .remix3d project file:', err);
        alert('Invalid or corrupted .remix3d project file.');
      }
    };
    reader.readAsText(file);
  }, [engine]);

  // Save named project session to local IndexedDB storage
  const handleSaveNamedSession = useCallback(async (name: string) => {
    if (!engine) return;
    const projectData = engine.exportProjectData(name, layers);
    let thumbnail: string | undefined;
    try {
      thumbnail = engine.captureSnapshot();
    } catch (_) {}
    const session: SavedProjectSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name || activeModelName || 'Untitled Session',
      timestamp: Date.now(),
      thumbnail,
      strokeCount: projectData.strokes?.length || 0,
      layerCount: layers.length,
      activeModelName,
      projectData,
    };
    await saveProjectSession(session);
    haptics.trigger('success');
  }, [engine, layers, activeModelName]);

  // Automated Testing / Robot Tester Hook
  useEffect(() => {
    (window as any).__testApp = {
      getEngine: () => engine,
      setTheme: handleSetTheme,
      setUiMode: (mode: 'play' | 'pro') => {
        setUiMode(mode);
        try { localStorage.setItem('remix3d.uiMode', mode); } catch {}
      },
      setTool,
      setBrushSettings,
      openSheet: (sheet: any) => openSheetId(sheet),
      toggleSheet: (sheet: any) => toggleSheet(sheet),
      openModal: (modalName: string) => {
        switch (modalName) {
          case 'settings': toggleSheet('settings'); break;
          case 'sessions': setIsSessionModalOpen(true); break;
          case 'illumination': setIsIlluminationOpen(true); break;
          case 'toybox': setIsToyboxOpen(true); break;
          case 'importer': setIsPlayImporterOpen(true); break;
          case 'colorStudio': setIsColorStudioOpen(true); break;
          case 'skyEnvironment': setIsSkyEnvironmentOpen(true); break;
          case 'renderSettings': setIsRenderSettingsOpen(true); break;
          case 'export': setIsExportOpen(true); break;
          case 'raycast': setIsRaycastSettingsOpen(true); break;
          case 'curveDecimate': setIsDecimateOpen(true); break;
          case 'bentGuide': setIsBentGuideOpen(true); break;
          case 'scaffolding': setIsScaffoldingOpen(true); break;
          case 'customMirror': setIsCustomMirrorOpen(true); break;
          case 'arViewer': setIsARViewerOpen(true); break;
          case 'clipboard': setIsClipboardOpen(true); break;
          case 'numpad': setNumpadTarget({ title: 'Brush Size', value: 25, unit: 'mm', min: 1, max: 100, step: 1, onChange: () => {} }); break;
          case 'dna': setActiveDNA({
            sourceType: 'stroke',
            colorHex: '#38bdf8',
            size: 0.04,
            opacity: 1.0,
            roughness: 0.3,
            metalness: 0.2,
            emissiveIntensity: 0.5,
            materialType: 'shaded',
            profile: 'tube',
            patternType: 'none',
            patternScale: 1.0,
            patternIntensity: 1.0,
            shaderEffect: 'none',
            timestamp: Date.now()
          }); break;
        }
      },
      closeAllModals: () => {
        closeSheet();
        setIsSessionModalOpen(false);
        setIsIlluminationOpen(false);
        setIsToyboxOpen(false);
        setIsPlayImporterOpen(false);
        setIsColorStudioOpen(false);
        setIsSkyEnvironmentOpen(false);
        setIsRenderSettingsOpen(false);
        setIsExportOpen(false);
        setIsRaycastSettingsOpen(false);
        setIsDecimateOpen(false);
        setIsBentGuideOpen(false);
        setIsScaffoldingOpen(false);
        setIsCustomMirrorOpen(false);
        setIsARViewerOpen(false);
        setNumpadTarget(null);
        setActiveDNA(null);
        setIsClipboardOpen(false);
      }
    };
  }, [engine, handleSetTheme, setTool, setBrushSettings]);

  // 1-Tap Quick Save (Ctrl+S / Top Bar Quick Save button)
  const handleQuickSave = useCallback(async () => {
    if (!engine) return;
    const name = activeModelName ? `${activeModelName} Session` : 'Quick Session';
    await handleSaveNamedSession(name);
    setSnappedShapeNotice('Session saved with full undo history!');
    setTimeout(() => {
      setSnappedShapeNotice((cur) => (cur === 'Session saved with full undo history!' ? null : cur));
    }, 2200);
  }, [engine, activeModelName, handleSaveNamedSession]);

  // Load named project session from local IndexedDB storage
  const handleLoadNamedSession = useCallback(async (session: SavedProjectSession) => {
    if (!engine || !session?.projectData) return;
    await engine.importProjectData(session.projectData);
    if (session.projectData.layers && session.projectData.layers.length > 0) {
      setLayers(session.projectData.layers);
      setActiveLayerId(session.projectData.layers[0].id);
    }
    if (session.projectData.lightingPreset) {
      setLightingPreset(session.projectData.lightingPreset);
    }
    if (session.projectData.showGrid !== undefined) {
      setShowGrid(session.projectData.showGrid);
    }
    if (session.projectData.showWireframe !== undefined) {
      setShowWireframe(session.projectData.showWireframe);
    }
    if (session.name) {
      setActiveModelName(session.name);
    }
    haptics.trigger('success');
  }, [engine]);

  // Global Ctrl+S / Cmd+S Quick Save shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleQuickSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleQuickSave]);

  // Sync grid toggle
  const handleToggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    engine?.toggleGrid(next);
  };

  // Sync drawing plane toggle
  const handleTogglePlane = () => {
    if (engine) {
      const next = engine.toggleDrawingPlane();
      setShowPlane(next);
    } else {
      setShowPlane((prev) => !prev);
    }
  };

  // Cycle lighting presets
  const handleCycleLighting = () => {
    const presets: LightingPreset[] = ['studio', 'daylight', 'neon', 'sunset', 'clay_neutral'];
    const idx = presets.indexOf(lightingPreset);
    const next = presets[(idx + 1) % presets.length];
    setLightingPreset(next);
    engine?.setLightingPreset(next);
  };

  /**
   * Play mode's four tools each map to one engine state. The mapping lives in
   * PlayDock so the dock and this handler cannot drift apart.
   */
  const handlePlayToolSelect = useCallback((id: PlayToolId) => {
    const { tool: nextTool, patch } = playToolSettings(id);
    setTool(nextTool);
    setBrushSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleResetCamera = () => {
    engine?.snapToView('isometric');
  };

  const handleUndo = useCallback(() => {
    engine?.undo();
  }, [engine]);

  const handleRedo = useCallback(() => {
    engine?.redo(layers);
  }, [engine, layers]);

  const [clipboardCount, setClipboardCount] = useState(0);

  const handleCopyStrokes = useCallback(() => {
    if (!engine) return;
    const count = engine.copyStrokes(activeLayerId);
    setClipboardCount(count);
    triggerAutoSave('curves_copied');
  }, [engine, activeLayerId, triggerAutoSave]);

  const handlePasteStrokes = useCallback(() => {
    if (!engine) return;
    const pasted = engine.pasteStrokes(activeLayerId);
    if (pasted > 0) {
      triggerAutoSave('curves_pasted');
    }
  }, [engine, activeLayerId, triggerAutoSave]);

  const handleClearLayerStrokes = useCallback(
    (layerId: string) => {
      engine?.deleteLayerStrokes(layerId);
    },
    [engine]
  );

  const handleMergeLayerDown = useCallback(
    (topLayerId: string) => {
      const topIdx = layers.findIndex((l) => l.id === topLayerId);
      if (topIdx < 0 || topIdx >= layers.length - 1) return;
      const bottomLayer = layers[topIdx + 1];
      const topLayer = layers[topIdx];

      engine?.mergeLayerDown(topLayer.id, bottomLayer.id, topLayer.opacity, topLayer.blendMode || 'normal');

      // Remove merged top layer from state
      setLayers((prev) => prev.filter((l) => l.id !== topLayerId));

      if (activeLayerId === topLayerId) {
        setActiveLayerId(bottomLayer.id);
      }
    },
    [engine, layers, activeLayerId]
  );

  // Sync layers state (opacities, visibility, GPU blend modes) to engine
  useEffect(() => {
    if (!engine) return;
    engine.syncLayers(layers);
    const active = layers.find((l) => l.id === activeLayerId);
    if (active) {
      engine.setActiveLayer(activeLayerId, active.opacity);
    }
  }, [engine, layers, activeLayerId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyStrokes();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteStrokes();
      } else if (e.key.toLowerCase() === 'b') {
        setTool('brush');
      } else if (e.key.toLowerCase() === 'u') {
        setTool('spatial_brush');
      } else if (e.key.toLowerCase() === 'i') {
        setTool((prev) => (prev === 'paint_picker' || prev === 'eyedropper' ? 'brush' : 'paint_picker'));
      } else if (e.key.toLowerCase() === 'j') {
        setTool((prev) => (prev === 'brush_picker' ? 'brush' : 'brush_picker'));
      } else if (e.key === '[') {
        setBrushSettings((prev) => ({
          ...prev,
          size: Math.max(0.01, prev.size - 0.005),
        }));
      } else if (e.key === ']') {
        setBrushSettings((prev) => ({
          ...prev,
          size: Math.min(0.25, prev.size + 0.005),
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleCopyStrokes, handlePasteStrokes]);

  // Global Drag & Drop for 3D Models
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setWindowDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      // Check if left window
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setWindowDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setWindowDragOver(false);
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setDroppedFilesForConverter(e.dataTransfer.files);
        setIsConverterOpen(true);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const isAnyModalActive =
    isIlluminationOpen ||
    isColorStudioOpen ||
    isToyboxOpen ||
    isPlayImporterOpen ||
    isModelsOpen ||
    isSessionModalOpen ||
    isConverterOpen ||
    isExportOpen ||
    isRaycastSettingsOpen ||
    isBentGuideOpen ||
    isCustomMirrorOpen ||
    isScaffoldingOpen ||
    isDecimateOpen ||
    isSettingsOpen ||
    isARViewerOpen ||
    isClipboardOpen;

  return (
    <div
      className={`paperrocket-ui relative w-full h-full overflow-hidden select-none transition-colors duration-200 ${
        theme === 'light' ? 'bg-[#ebe5dc] text-neutral-800' : 'bg-[#242629] text-neutral-100'
      }`}
    >
      {/* Main 3D Viewport */}
      <Viewport
        tool={tool}
        onSelectTool={setTool}
        brushSettings={brushSettings}
        onUpdateBrushSettings={(newSettings) =>
          setBrushSettings((prev) => ({ ...prev, ...newSettings }))
        }
        activeLayer={activeLayer}
        layers={layers}
        symmetry={symmetry}
        onSelectSymmetry={setSymmetry}
        lightingPreset={lightingPreset}
        showWireframe={showWireframe}
        showGrid={showGrid}
        onEngineReady={handleEngineReady}
        onColorPick={(hex) => setBrushSettings((prev) => ({ ...prev, color: hex }))}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        cameraInteracting={cameraInteracting}
        setCameraInteracting={setCameraInteracting}
        fingerPenMode={fingerPenMode}
        onToggleFingerPenMode={setFingerPenMode}
        liquifySettings={liquifySettings}
        onOpenColorPanel={() => {
          if (uiMode === 'play') openSheetId('brushes');
          else setIsSettingsOpen(true);
        }}
        onOpenNumpad={(t) => setNumpadTarget(t)}
        disableContextMenu={disableContextMenu}
        onToggleDisableContextMenu={handleToggleDisableContextMenu}
        theme={theme}
        onStylusDetected={setIsStylusDetected}
      />

      {/* Shared Top Strip (Play Mode and Pro 5-Mode Surface) */}
      <PlayTopStrip
        projectName={activeModelName}
        onOpenToybox={uiMode === 'pro' ? () => setIsModelsOpen(true) : () => setIsToyboxOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        theme={theme}
        uiMode={uiMode}
        onOpenIllumination={() => setIsIlluminationOpen(true)}
        onQuickSave={handleQuickSave}
        onOpenSessions={() => setIsSessionModalOpen(true)}
        onSwitchUiMode={() => {
          haptics.trigger('mode-switch');
          setUiMode('play');
        }}
      />

      {/* Omnipresent Safety & Recovery Anchor: "Lost? Tap to return to artwork" */}
      <CameraRecoveryPill engine={engine} theme={theme} />

      {/* ================= PLAY MODE (default surface) ================= */}
      {uiMode === 'play' && (
        <>
          {!isAnyModalActive && (
            <PlayDock
              tool={tool}
              brushSettings={brushSettings}
              setBrushSettings={setBrushSettings}
              shapeSnapping={brushSettings.shapeSnapping ?? false}
              onSelect={handlePlayToolSelect}
              onOpenFullColor={() => setIsColorStudioOpen(true)}
              engine={engine}
              theme={theme}
            />
          )}
          <MagicFxSheet brushSettings={brushSettings} setBrushSettings={setBrushSettings} theme={theme} />
          {showPlayStats && <PlayStats theme={theme} />}
          <FirstRunOverlay onOpenToybox={() => setIsToyboxOpen(true)} theme={theme} />
          <Toybox
            isOpen={isToyboxOpen}
            engine={engine}
            onClose={() => setIsToyboxOpen(false)}
            onSpawned={(name) => setActiveModelName(name)}
            setBrushSettings={setBrushSettings}
            onOpenImporter={() => setIsPlayImporterOpen(true)}
            theme={theme}
          />
        </>
      )}

      {/* Shared 3D Model Importer (usable in both Play and Pro modes) */}
      <PlayImporter
        isOpen={isPlayImporterOpen}
        engine={engine}
        onClose={() => setIsPlayImporterOpen(false)}
        onSaved={(n) => setActiveModelName(n)}
        onOpenFineTuning={() => {
          setDroppedFilesForConverter(null);
          setIsConverterOpen(true);
        }}
        theme={theme}
      />

      {/* ================= PRO MODE (the full studio) ================= */}
      {/* Five-Mode Surface Shell */}
      {uiMode === 'pro' && (
        <>
          <ProShell
            theme={theme}
            engine={engine}
            tool={tool}
            setTool={setTool}
            brushSettings={brushSettings}
            setBrushSettings={setBrushSettings}
            isGizmoActive={gizmoMode !== 'Hidden'}
            onToggleGizmo={() => setGizmoMode(gizmoMode === 'Hidden' ? 'Standard' : 'Hidden')}
            isGizmoLocked={isGizmoLocked}
            onToggleLock={() => setIsGizmoLocked((prev) => !prev)}
            onOpenNumpad={(t) => setNumpadTarget(t)}
            targetScope={targetScope}
            onSelectTargetScope={handleSelectTargetScope}
            onGizmoReset={handleGizmoReset}
            onOpenColorStudio={() => {
              closeSheet();
              setIsColorStudioOpen(true);
            }}
            activeModelName={activeModelName}
            modelDisplayMode={modelDisplayMode}
            onSetModelDisplayMode={(mode) => {
              setModelDisplayMode(mode);
              engine?.setModelDisplayMode(mode);
            }}
            onOpenModelLibrary={() => {
              closeSheet();
              setIsModelsOpen(true);
            }}
            onOpenImporter={() => {
              closeSheet();
              setIsPlayImporterOpen(true);
            }}
            liquifySettings={liquifySettings}
            setLiquifySettings={setLiquifySettings}
            isLiquifyOpen={isLiquifyOpen}
            onOpenLiquify={() => {
              setTool('liquify');
              setIsLiquifyOpen(true);
              engine?.startLiquifySession();
            }}
            isCompareActive={isCompareActive}
            onToggleCompare={(active) => {
              setIsCompareActive(active);
              engine?.toggleLiquifyCompare(active);
            }}
            onApplyLiquify={() => {
              engine?.commitLiquify();
              setIsLiquifyOpen(false);
              setTool('brush');
            }}
            onCancelLiquify={() => {
              engine?.cancelLiquify();
              setIsLiquifyOpen(false);
              setTool('brush');
            }}
            onOpenScaffolding={() => {
              closeSheet();
              setIsScaffoldingOpen(true);
            }}
            onOpenBentGuide={() => {
              closeSheet();
              setIsBentGuideOpen(true);
            }}
            onOpenCustomMirror={() => {
              closeSheet();
              setIsCustomMirrorOpen(true);
            }}
            onOpenDecimate={() => {
              closeSheet();
              setIsDecimateOpen(true);
            }}
            layers={layers}
            setLayers={setLayers}
            activeLayerId={activeLayerId}
            setActiveLayerId={setActiveLayerId}
            onClearLayerStrokes={handleClearLayerStrokes}
            onMergeLayerDown={handleMergeLayerDown}
            onOpenIllumination={() => {
              closeSheet();
              setIsIlluminationOpen(true);
            }}
            isIlluminationOpen={isIlluminationOpen}
          />
        </>
      )}

      {/* FPS & Input Lag Diagnostics Counter (Pro Mode) */}
      {uiMode === 'pro' && (
        <FpsCounter
          uiScale={uiScale}
          theme={theme}
          fullDebug={showPlayStats}
          onToggleFullDebug={() => setShowPlayStats((prev) => !prev)}
        />
      )}

      {/* Dynamic Screen Center Crosshair Reticle */}
      <ScreenCenterCrosshair
        active={crosshairActive}
        mode="3d"
        actionLabel={crosshairAction}
        valueLabel={crosshairValue}
      />


      {/* 3D Navigation Controller: Option 3 Sphere Navigator */}
      {gizmoMode !== 'Hidden' && activeController !== 'hidden' && showPlayNavigator &&
        !isModelsOpen && !isConverterOpen && !isExportOpen && !isRaycastSettingsOpen &&
        !isIlluminationOpen && !isColorStudioOpen && !isARViewerOpen && !isClipboardOpen && (
          <Option3SphereNavigator
            engine={engine}
            theme={theme}
            uiMode={uiMode}
            layers={layers}
            activeLayerId={activeLayerId}
            onSelectLayer={handleSelectLayer}
            models={loadedModels}
            activeModelId={activeModelId}
            onSelectModel={handleSelectModel}
            onClose={() => handleControllerChange('hidden')}
          />
      )}

      {/* Layer Panel */}
      {isLayersOpen && (
        <LayerPanel
          layers={layers}
          setLayers={setLayers}
          activeLayerId={activeLayerId}
          setActiveLayerId={setActiveLayerId}
          onClose={() => setIsLayersOpen(false)}
          onClearLayerStrokes={handleClearLayerStrokes}
          onMergeLayerDown={handleMergeLayerDown}
          theme={theme}
        />
      )}

      {/* 3D Model Display & Material Settings Panel */}
      {isModelDisplayOpen && (
        <div className="fixed top-16 right-4 z-40">
          <ModelDisplayPanel
            engine={engine}
            activeModelName={activeModelName}
            metadata={modelMetadata}
            displayMode={modelDisplayMode}
            onDisplayModeChange={(mode) => {
              setModelDisplayMode(mode);
              engine?.setModelDisplayMode(mode);
            }}
            onOpenLibrary={() => setIsModelsOpen(true)}
            onClose={() => setIsModelDisplayOpen(false)}
            theme={theme}
          />
        </div>
      )}

      {/* Brush Settings / Color Panel */}
      {isSettingsOpen && uiMode === 'pro' && (
        <BrushSettingsPanel
          brushSettings={brushSettings}
          setBrushSettings={setBrushSettings}
          onClose={() => setIsSettingsOpen(false)}
          onRecalculateNormals={() => engine?.recalculateMeshNormals()}
          onOpenRaycastSettings={() => setIsRaycastSettingsOpen(true)}
          onOpenColorStudio={() => setIsColorStudioOpen(true)}
          theme={theme}
        />
      )}

      {/* Render Mode & Post-Processing Shaders Modal */}
      {isRenderSettingsOpen && (
        <Suspense fallback={null}>
          <RenderSettingsPanel
            settings={postSettings}
            setSettings={setPostSettings}
            onClose={() => setIsRenderSettingsOpen(false)}
            onRecalculateNormals={() => engine?.recalculateMeshNormals()}
            gpuInfo={gpuInfo}
            theme={theme}
          />
        </Suspense>
      )}

      {/* 3D Model Ingestion / Presets Modal (37+ Models with Draco compression) */}
      {isModelsOpen && (
        <Suspense fallback={null}>
          <ModelLibraryModal
            engine={engine}
            onClose={() => setIsModelsOpen(false)}
            activeModelName={activeModelName}
            onOpenConverter={() => {
              setIsModelsOpen(false);
              setDroppedFilesForConverter(null);
              setIsConverterOpen(true);
            }}
            theme={theme}
          />
        </Suspense>
      )}

      {/* 3D Model Converter, Draco Compressor & In-App Storage Suite */}
      {isConverterOpen && (
        <Suspense fallback={null}>
          <ModelConverterModal
            isOpen={isConverterOpen}
            onClose={() => {
              setIsConverterOpen(false);
              setDroppedFilesForConverter(null);
            }}
            engine={engine}
            initialFiles={droppedFilesForConverter}
            theme={theme}
            onModelLoadedToCanvas={(name) => {
              setActiveModelName(name);
            }}
          />
        </Suspense>
      )}

      {/* Export 3D / Textures Modal */}
      {isExportOpen && (
        <Suspense fallback={null}>
          <ExportModal
            engine={engine}
            onClose={() => setIsExportOpen(false)}
            activeModelName={activeModelName}
            theme={theme}
          />
        </Suspense>
      )}

      {/* Project Session Management Modal (Non-Destructive & Undo Preserved) */}
      {isSessionModalOpen && (
        <Suspense fallback={null}>
          <ProjectSessionModal
            isOpen={isSessionModalOpen}
            onClose={() => setIsSessionModalOpen(false)}
            onSaveSession={handleSaveNamedSession}
            onLoadSession={handleLoadNamedSession}
            onExportFile={handleSaveProject}
            onImportFile={handleLoadProject}
            theme={theme}
            activeProjectName={activeModelName}
          />
        </Suspense>
      )}

      {/* 3D Surface Raycasting & Snapping Parameters Modal */}
      {isRaycastSettingsOpen && (
        <Suspense fallback={null}>
          <RaycastSettingsModal
            brushSettings={brushSettings}
            setBrushSettings={setBrushSettings}
            onClose={() => setIsRaycastSettingsOpen(false)}
            onRecalculateNormals={() => engine?.recalculateMeshNormals()}
            theme={theme}
          />
        </Suspense>
      )}

      {/* Studio Illumination Modal */}
      <DeferredPanel active={isIlluminationOpen}>
        <SimpleSceneIlluminationModal
          engine={engine}
          isOpen={isIlluminationOpen}
          onClose={() => setIsIlluminationOpen(false)}
          onOpenSkybox={() => setIsSkyEnvironmentOpen(true)}
          theme={theme}
        />
      </DeferredPanel>

      {/* Skybox & Atmosphere Environment Studio (from webgpu-skybox-studio) */}
      <DeferredPanel active={isSkyEnvironmentOpen}>
        <SkyEnvironmentPanel
          engine={engine}
          isOpen={isSkyEnvironmentOpen}
          onClose={() => setIsSkyEnvironmentOpen(false)}
          theme={theme}
        />
      </DeferredPanel>

      {/* RDP Curve Decimation Modal (Sprint 2) */}
      <DeferredPanel active={isDecimateOpen}>
        <CurveDecimateModal
          isOpen={isDecimateOpen}
          onClose={() => setIsDecimateOpen(false)}
          onApplyDecimation={(epsilon, preserveTopology) => {
            if (engine) {
              const count = engine.decimateActiveLayerCurves(epsilon, preserveTopology);
              console.log(`Simplified curves with RDP (epsilon: ${epsilon}), remaining points: ${count}`);
            }
          }}
          theme={theme}
        />
      </DeferredPanel>

      {/* Bent 3D Manifold Guide & Lofting Modal */}
      <DeferredPanel active={isBentGuideOpen}>
        <BentGuideModal
          isOpen={isBentGuideOpen}
          onClose={() => setIsBentGuideOpen(false)}
          engine={engine}
          onOpenNumpad={(t) => setNumpadTarget(t)}
          theme={theme}
        />
      </DeferredPanel>

      {/* 3D Collision Scaffolding & Procedural Armatures Modal (Phase 4) */}
      <DeferredPanel active={isScaffoldingOpen}>
        <ScaffoldingModal
          isOpen={isScaffoldingOpen}
          onClose={() => setIsScaffoldingOpen(false)}
          engine={engine}
          onOpenNumpad={(t) => setNumpadTarget(t)}
          theme={theme}
        />
      </DeferredPanel>

      {/* Floating 2D Blueprint Clipboard & Reference Moodboard (Phase 4) */}
      <DeferredPanel active={isClipboardOpen}>
        <FloatingReferenceClipboard
          isOpen={isClipboardOpen}
          onClose={() => setIsClipboardOpen(false)}
          referenceImages={referenceImages}
          setReferenceImages={setReferenceImages}
          theme={theme}
        />
      </DeferredPanel>

      {/* Arbitrary 3D Mirror Plane Modal (Sprint 4) */}
      <DeferredPanel active={isCustomMirrorOpen}>
        <CustomMirrorModal
          isOpen={isCustomMirrorOpen}
          onClose={() => setIsCustomMirrorOpen(false)}
          config={customMirrorConfig}
          onConfigChange={(newCfg) => {
            setCustomMirrorConfig(newCfg);
            if (engine) {
              engine.updateCustomMirrorPlane(newCfg.planeOrigin, newCfg.planeNormal);
              setSymmetry('custom_plane');
            }
          }}
          onAlignToCamera={() => {
            if (engine) {
              const viewDir = engine.camera.getWorldDirection(new THREE.Vector3()).negate();
              const camPos = engine.camera.position.clone().add(viewDir.clone().multiplyScalar(-1.5));
              const newCfg = {
                planeOrigin: [camPos.x, camPos.y, camPos.z] as [number, number, number],
                planeNormal: [viewDir.x, viewDir.y, viewDir.z] as [number, number, number],
                visible: true,
              };
              setCustomMirrorConfig(newCfg);
              engine.updateCustomMirrorPlane(newCfg.planeOrigin, newCfg.planeNormal);
              setSymmetry('custom_plane');
            }
          }}
          theme={theme}
        />
      </DeferredPanel>

      {/* WebXR AR Viewer Modal (Sprint 5) */}
      <DeferredPanel active={isARViewerOpen}>
        <ARViewerModal
          isOpen={isARViewerOpen}
          onClose={() => setIsARViewerOpen(false)}
          engine={engine}
          theme={theme}
        />
      </DeferredPanel>

      {/* Floating On-Screen Numpad Modal */}
      <DeferredPanel active={numpadTarget !== null}>
        <NumpadModal
          target={numpadTarget}
          onClose={() => setNumpadTarget(null)}
          theme={theme}
        />
      </DeferredPanel>

      {/* Advanced Color Studio Modal (HSV + OKLCh Polar + 1-Click Shaders) */}
      <DeferredPanel active={isColorStudioOpen}>
        <ColorStudioModal
          isOpen={isColorStudioOpen}
          onClose={() => setIsColorStudioOpen(false)}
          currentColor={brushSettings.color || '#38bdf8'}
          onChangeColor={(hex) => setBrushSettings((prev) => ({ ...prev, color: hex }))}
          onApplyBrushSettings={(newSettings) =>
            setBrushSettings((prev) => ({ ...prev, ...newSettings }))
          }
          onApplyToModel={(mat) => engine?.setModelCustomMaterial(mat)}
          onSampleFromScreen={() => {
            setIsColorStudioOpen(false);
            setTool('eyedropper');
          }}
          theme={theme}
        />
      </DeferredPanel>

      {/* Holistic DNA Inspector & Injector Popup */}
      <DeferredPanel active={activeDNA !== null}>
        <HolisticDNAInspector
          dna={activeDNA}
          onClose={() => setActiveDNA(null)}
          onInjectDNA={(dna) => {
            setBrushSettings((prev) => ({
              ...prev,
              color: dna.colorHex,
              size: dna.size,
              opacity: dna.opacity,
              roughness: dna.roughness,
              metalness: dna.metalness,
              emissiveIntensity: dna.emissiveIntensity,
              materialType: dna.materialType,
              profile: dna.profile,
              patternType: dna.patternType,
              patternScale: dna.patternScale,
              patternIntensity: dna.patternIntensity,
              shaderEffect: dna.shaderEffect,
            }));
          }}
          theme={theme}
        />
      </DeferredPanel>

      {/* Snapped Shape Notice Toast (Pro Mode Only) */}
      {snappedShapeNotice && uiMode !== 'play' && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs shadow-xl border ${
            theme === 'light'
              ? 'bg-neutral-900 text-white border-neutral-800'
              : 'bg-[#18191d] text-white border-white/20'
          }`}>
            <span className="w-2 h-2 rounded-full animate-ping bg-white" />
            <span>{snappedShapeNotice}</span>
          </div>
        </div>
      )}

      {/* Drag & Drop Overlay Indicator */}
      {windowDragOver && (
        <div className={`fixed inset-0 z-50 pointer-events-none border-4 border-dashed flex items-center justify-center animate-in fade-in duration-100 ${
          theme === 'light'
            ? 'bg-neutral-900/40 border-neutral-500'
            : 'bg-black/60 border-white/50'
        }`}>
          <div className="px-6 py-4 rounded-3xl bg-white dark:bg-[#18191d] shadow-2xl text-center space-y-2 border border-neutral-200 dark:border-neutral-800">
            <div className="text-base font-bold text-neutral-900 dark:text-white">
              Drop 3D Model to Ingest & Convert
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Supports GLB, GLTF, OBJ (+MTL), FBX, 3DS, STL, PLY, DAE
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Shared Settings Sheet (Preferences) */}
      <PlaySettingsSheet
        theme={theme}
        onSetTheme={handleSetTheme}
        uiScale={uiScale}
        onUiScaleChange={handleUiScaleChange}
        projectionMode={projectionMode}
        onToggleProjection={handleToggleProjection}
        fingerDraw={fingerPenMode}
        onToggleFingerDraw={setFingerPenMode}
        disableContextMenu={disableContextMenu}
        onToggleDisableContextMenu={handleToggleDisableContextMenu}
        soundEnabled={isSoundEnabled}
        onToggleSound={handleToggleSound}
        showGrid={showGrid}
        onToggleGrid={handleToggleGrid}
        showPlane={showPlane}
        onTogglePlane={handleTogglePlane}
        modelDisplayMode={modelDisplayMode}
        onSetModelDisplayMode={(mode) => {
          setModelDisplayMode(mode);
          engine?.setModelDisplayMode(mode);
        }}
        onOpenIllumination={() => setIsIlluminationOpen(true)}
        onOpenSkyEnvironment={() => setIsSkyEnvironmentOpen(true)}
        onOpenRenderSettings={() => setIsRenderSettingsOpen(true)}
        onOpenSessions={() => setIsSessionModalOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenARViewer={() => setIsARViewerOpen(true)}
        onOpenClipboard={() => setIsClipboardOpen(true)}
        isStoragePersistent={isStoragePersistent}
        onRequestStoragePermission={handleRequestStoragePermission}
        storageEstimate={storageEstimate}
        autoSaveMeta={autoSaveMeta}
        onRestoreAutoSave={handleRestoreAutoSave}
        showNavigator={showPlayNavigator}
        onToggleNavigator={setShowPlayNavigator}
        showStats={showPlayStats}
        onToggleStats={setShowPlayStats}
      />

      {/* Shape Snapping (Auto-Shapes) Sheet accessible from top menu */}
      <ShapesSheet brushSettings={brushSettings} setBrushSettings={setBrushSettings} theme={theme} />

      {/* Auto-Save Status Notification Toast */}
      <AutoSaveToast
        status={autoSaveStatus}
        lastSaved={lastSavedTime}
        isPersistent={isStoragePersistent}
        theme={theme}
      />
    </div>
  );
}

export default App;
