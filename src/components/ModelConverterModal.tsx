import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Upload,
  Box,
  RotateCw,
  Maximize2,
  Minimize2,
  FileCode,
  Zap,
  HardDrive,
  CheckCircle2,
  Trash2,
  Download,
  Eye,
  Sliders,
  Layers,
  Sparkles,
  Info,
  Play,
  Pause,
  Sun,
  Grid,
  RefreshCw,
  X,
  Loader2,
  Edit2,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  ModelTransformConfig,
  DracoCompressionConfig,
  ModelInspectionData,
  Saved3DModel,
  SupportedModelFormat,
  ConversionResult,
  AppTheme,
} from '../types';
import {
  ModelConverterEngine,
  DEFAULT_TRANSFORM_CONFIG,
  DEFAULT_DRACO_CONFIG,
} from '../core/modelConverter';
import { ModelStorage } from '../core/modelStorage';
import { StudioEngine } from '../core/studioEngine';
import { getQualityProfile, resolvePixelRatio } from '../utils/deviceProfile';
import { getThemeClasses } from '../utils/themeStyles';
import { StudioCloseButton } from './common/StudioCloseButton';

interface ModelConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: StudioEngine | null;
  initialFiles?: FileList | File[] | null;
  theme?: AppTheme;
  onModelLoadedToCanvas?: (name: string) => void;
}

type ConverterTab = 'preview_transform' | 'compression_export' | 'inspector' | 'saved_storage';

export const ModelConverterModal: React.FC<ModelConverterModalProps> = ({
  isOpen,
  onClose,
  engine,
  initialFiles,
  theme = 'light',
  onModelLoadedToCanvas,
}) => {
  const themeClasses = getThemeClasses(theme);
  const isDark = theme === 'dark';
  const isLight = theme === 'light';
  // Navigation & States
  const [activeTab, setActiveTab] = useState<ConverterTab>('preview_transform');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Model Source & Objects
  const [rawScene, setRawScene] = useState<THREE.Group | null>(null);
  const [modelName, setModelName] = useState<string>('Custom_Model');
  const [modelFormat, setModelFormat] = useState<string>('glb');
  const [originalBytes, setOriginalBytes] = useState<number>(0);

  // Transform & Draco Configurations
  const [transformConfig, setTransformConfig] = useState<ModelTransformConfig>(DEFAULT_TRANSFORM_CONFIG);
  const [dracoConfig, setDracoConfig] = useState<DracoCompressionConfig>(DEFAULT_DRACO_CONFIG);

  // Inspection Data
  const [inspection, setInspection] = useState<ModelInspectionData | null>(null);

  // Saved In-App Models
  const [savedModels, setSavedModels] = useState<Saved3DModel[]>([]);
  const [storageUsage, setStorageUsage] = useState({ usedBytes: 0, quotaBytes: 500 * 1024 * 1024, modelCount: 0 });
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState('');

  // 3D Viewport Controls & Environment
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const threeStateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    modelContainer: THREE.Group;
    originalContainer: THREE.Group;
    gridHelper: THREE.GridHelper;
    axesHelper: THREE.AxesHelper;
    animFrameId: number;
  } | null>(null);

  const [viewOriginalAB, setViewOriginalAB] = useState(false);
  const [turntableActive, setTurntableActive] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [lightingPreset, setLightingPreset] = useState<'studio' | 'sunset' | 'cyber' | 'white' | 'dark'>('studio');

  // Drag & Drop highlight state
  const [isDragOver, setIsDragOver] = useState(false);

  // Load Saved Models on mount or open
  const refreshSavedModels = async () => {
    try {
      const list = await ModelStorage.getAllModels();
      setSavedModels(list);
      const usage = await ModelStorage.getStorageUsage();
      setStorageUsage(usage);
    } catch (e) {
      console.warn('Failed to load saved models from storage:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshSavedModels();
    }
  }, [isOpen]);

  // Handle Initial Files passed into Modal
  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      handleParseFiles(initialFiles);
    }
  }, [isOpen, initialFiles]);

  // Initialize Viewport 3D Canvas
  useEffect(() => {
    if (!isOpen || !canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'dark' ? 0x0f172a : 0xf8fafc);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 500);
    camera.position.set(2.5, 2, 3.5);

    const profile = getQualityProfile();
    const renderer = new THREE.WebGLRenderer({
      antialias: profile.antialias,
      alpha: true,
      powerPreference: profile.powerPreference,
      precision: profile.precision,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(resolvePixelRatio(profile));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = profile.shadows;
    renderer.shadowMap.type = profile.shadowMapType;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 50;
    controls.minDistance = 0.2;

    // Grid & Axes
    const gridHelper = new THREE.GridHelper(10, 20, 0x94a3b8, 0xe2e8f0);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(1.2);
    axesHelper.position.y = 0.001;
    scene.add(axesHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    ambientLight.name = 'ambientLight';
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(5, 10, 5);
    dirLight1.castShadow = true;
    dirLight1.name = 'dirLight1';
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90cdf4, 0.8);
    dirLight2.position.set(-5, -2, -5);
    dirLight2.name = 'dirLight2';
    scene.add(dirLight2);

    // Containers
    const modelContainer = new THREE.Group();
    modelContainer.name = 'modelContainer';
    scene.add(modelContainer);

    const originalContainer = new THREE.Group();
    originalContainer.name = 'originalContainer';
    originalContainer.visible = false;
    scene.add(originalContainer);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controls) controls.update();
      if (threeStateRef.current?.modelContainer && turntableActive) {
        threeStateRef.current.modelContainer.rotation.y += 0.01;
      }
      renderer.render(scene, camera);
    };
    animate();

    threeStateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      modelContainer,
      originalContainer,
      gridHelper,
      axesHelper,
      animFrameId: animId,
    };

    // Resize Observer
    const resizeObs = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObs.observe(container);

    return () => {
      resizeObs.disconnect();
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      threeStateRef.current = null;
      if (container) container.innerHTML = '';
    };
  }, [isOpen, theme]);

  // Sync Lighting Preset
  useEffect(() => {
    if (!threeStateRef.current) return;
    const { scene } = threeStateRef.current;
    const amb = scene.getObjectByName('ambientLight') as THREE.AmbientLight;
    const dir1 = scene.getObjectByName('dirLight1') as THREE.DirectionalLight;
    const dir2 = scene.getObjectByName('dirLight2') as THREE.DirectionalLight;

    if (!amb || !dir1 || !dir2) return;

    if (lightingPreset === 'studio') {
      amb.intensity = 1.2;
      amb.color.setHex(0xffffff);
      dir1.intensity = 1.8;
      dir1.color.setHex(0xffffff);
      dir2.intensity = 0.8;
      dir2.color.setHex(0x90cdf4);
      scene.background = new THREE.Color(theme === 'dark' ? 0x0f172a : 0xf8fafc);
    } else if (lightingPreset === 'sunset') {
      amb.intensity = 0.9;
      amb.color.setHex(0xfeb2b2);
      dir1.intensity = 2.4;
      dir1.color.setHex(0xf6ad55);
      dir2.intensity = 1.2;
      dir2.color.setHex(0x805ad5);
      scene.background = new THREE.Color(0x2d1b4e);
    } else if (lightingPreset === 'cyber') {
      amb.intensity = 0.6;
      amb.color.setHex(0x319795);
      dir1.intensity = 2.2;
      dir1.color.setHex(0x00f5d4);
      dir2.intensity = 2.0;
      dir2.color.setHex(0x7928ca);
      scene.background = new THREE.Color(0x0b0f19);
    } else if (lightingPreset === 'white') {
      amb.intensity = 1.6;
      amb.color.setHex(0xffffff);
      dir1.intensity = 2.0;
      dir1.color.setHex(0xffffff);
      dir2.intensity = 1.0;
      dir2.color.setHex(0xffffff);
      scene.background = new THREE.Color(0xffffff);
    } else if (lightingPreset === 'dark') {
      amb.intensity = 0.5;
      amb.color.setHex(0xffffff);
      dir1.intensity = 1.4;
      dir1.color.setHex(0xffffff);
      dir2.intensity = 0.5;
      dir2.color.setHex(0x4a5568);
      scene.background = new THREE.Color(0x0a0a0c);
    }
  }, [lightingPreset, theme]);

  // Sync Grid & Axes & Wireframe
  useEffect(() => {
    if (!threeStateRef.current) return;
    threeStateRef.current.gridHelper.visible = showGrid;
    threeStateRef.current.axesHelper.visible = showAxes;

    // Wireframe toggle on meshes
    if (threeStateRef.current.modelContainer) {
      threeStateRef.current.modelContainer.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = showWireframe));
          } else {
            child.material.wireframe = showWireframe;
          }
        }
      });
    }
  }, [showGrid, showAxes, showWireframe]);

  // Re-apply transforms whenever rawScene or transformConfig changes
  useEffect(() => {
    if (!rawScene || !threeStateRef.current) return;

    const { modelContainer, originalContainer, camera, controls } = threeStateRef.current;
    modelContainer.clear();
    originalContainer.clear();

    // 1. Mount original un-transformed clone for A/B comparison
    const origClone = rawScene.clone(true);
    originalContainer.add(origClone);

    // 2. Apply transformations
    const transformed = ModelConverterEngine.applyTransforms(rawScene, transformConfig);
    modelContainer.add(transformed);

    // Wireframe
    if (showWireframe) {
      transformed.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = true));
          } else {
            child.material.wireframe = true;
          }
        }
      });
    }

    // 3. Inspect geometry
    const insp = ModelConverterEngine.inspect(transformed, modelName, modelFormat, originalBytes);
    setInspection(insp);

    // 4. Auto-frame camera
    const box = new THREE.Box3().setFromObject(transformed);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);

    controls.target.copy(center);
    camera.position.set(center.x + maxDim * 1.5, center.y + maxDim * 1.2, center.z + maxDim * 1.8);
    controls.update();
  }, [rawScene, transformConfig, showWireframe]);

  // Sync A/B View Toggling
  useEffect(() => {
    if (!threeStateRef.current) return;
    const { modelContainer, originalContainer } = threeStateRef.current;
    if (viewOriginalAB) {
      modelContainer.visible = false;
      originalContainer.visible = true;
    } else {
      modelContainer.visible = true;
      originalContainer.visible = false;
    }
  }, [viewOriginalAB]);

  // Parse Files Handler
  const handleParseFiles = async (files: FileList | File[]) => {
    setIsLoading(true);
    setLoadingStatus('Ingesting & parsing 3D geometry...');
    setErrorMessage(null);

    try {
      const parsed = await ModelConverterEngine.parseFiles(files);
      setRawScene(parsed.scene);
      setModelName(parsed.name);
      setModelFormat(parsed.format);
      setOriginalBytes(parsed.originalBytes);
      setTransformConfig(DEFAULT_TRANSFORM_CONFIG);
      setActiveTab('preview_transform');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to parse 3D file.');
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  // 1-Click Sample Model Ingestion
  const handleLoadSample = async (sampleName: string, url: string, format: SupportedModelFormat) => {
    setIsLoading(true);
    setLoadingStatus(`Loading ${sampleName} sample asset...`);
    setErrorMessage(null);

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `${sampleName}.${format}`, { type: blob.type });
      await handleParseFiles([file]);
    } catch (err: any) {
      setErrorMessage(`Failed to fetch ${sampleName} sample: ${err?.message}`);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  // Convert & Save to In-App Local Storage
  const handleConvertAndSave = async (andLoadToCanvas = false) => {
    if (!rawScene) {
      setErrorMessage('Please upload or load a 3D model first.');
      return;
    }

    setIsLoading(true);
    setLoadingStatus('Compressing geometry with Draco & saving to in-app storage...');
    setErrorMessage(null);

    try {
      // 1. Transform & Bake
      const transformed = ModelConverterEngine.applyTransforms(rawScene, transformConfig);

      // 2. Inspect
      const insp = ModelConverterEngine.inspect(transformed, modelName, modelFormat, originalBytes);

      // 3. Export GLB with Draco
      const { blob, arrayBuffer } = await ModelConverterEngine.exportToGLB(transformed, dracoConfig);

      // 4. Generate thumbnail
      const thumbnail = await ModelConverterEngine.generateThumbnail(transformed);

      const convertedBytes = arrayBuffer.byteLength;
      const reductionPercentage =
        originalBytes > 0
          ? Math.max(0, Number((((originalBytes - convertedBytes) / originalBytes) * 100).toFixed(1)))
          : 0;

      const id = `model_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const savedModel: Saved3DModel = {
        id,
        name: modelName.trim() || 'Optimized_Model',
        originalName: modelName,
        originalFormat: modelFormat,
        originalSize: originalBytes,
        compressedSize: convertedBytes,
        savedDate: Date.now(),
        thumbnail,
        blob: arrayBuffer,
        triangleCount: insp.triangleCount,
        vertexCount: insp.vertexCount,
        meshCount: insp.meshCount,
        materialCount: insp.materialCount,
        dimensions: insp.dimensions,
        dracoCompressed: dracoConfig.enabled,
        isBaked: transformConfig.bakeTransforms,
        quantizationBits: {
          position: dracoConfig.positionQuantization,
          normal: dracoConfig.normalQuantization,
          uv: dracoConfig.uvQuantization,
        },
      };

      await ModelStorage.saveModel(savedModel);
      await refreshSavedModels();

      setSuccessToast(
        `Model saved! Compressed to ${(convertedBytes / (1024 * 1024)).toFixed(2)} MB (${reductionPercentage}% reduction)`
      );
      setTimeout(() => setSuccessToast(null), 4000);

      if (andLoadToCanvas && engine) {
        await engine.loadGLTF(arrayBuffer, savedModel.name);
        if (onModelLoadedToCanvas) onModelLoadedToCanvas(savedModel.name);
        onClose();
      } else {
        setActiveTab('saved_storage');
      }
    } catch (err: any) {
      setErrorMessage(`Conversion failed: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  // Download converted GLB file
  const handleDownloadGLB = async () => {
    if (!rawScene) return;
    setIsLoading(true);
    setLoadingStatus('Generating downloadable .GLB package...');
    try {
      const transformed = ModelConverterEngine.applyTransforms(rawScene, transformConfig);
      const { blob } = await ModelConverterEngine.exportToGLB(transformed, dracoConfig);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${modelName.replace(/\s+/g, '_')}_optimized.glb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(`Failed to export GLB: ${err?.message}`);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  // Load Saved Model to Studio Canvas
  const handleLoadSavedModelToCanvas = async (model: Saved3DModel) => {
    if (!engine) return;
    setIsLoading(true);
    setLoadingStatus(`Loading ${model.name} onto painting canvas...`);
    try {
      await engine.loadGLTF(model.blob, model.name);
      if (onModelLoadedToCanvas) onModelLoadedToCanvas(model.name);
      onClose();
    } catch (err: any) {
      setErrorMessage(`Failed to load saved model: ${err?.message}`);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  // Delete Saved Model
  const handleDeleteSavedModel = async (id: string, name: string) => {
    if (confirm(`Delete "${name}" from in-app storage?`)) {
      await ModelStorage.deleteModel(id);
      await refreshSavedModels();
    }
  };

  // Rename Saved Model
  const handleSaveRename = async (id: string) => {
    if (editNameInput.trim()) {
      await ModelStorage.renameModel(id, editNameInput.trim());
      setEditingModelId(null);
      setEditNameInput('');
      await refreshSavedModels();
    }
  };

  // Download Saved Model Blob
  const handleDownloadSavedBlob = (model: Saved3DModel) => {
    const blob = new Blob([model.blob], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name.replace(/\s+/g, '_')}.glb`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="paperrocket-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        className={`pr-surface w-full max-w-3xl h-[85vh] max-h-[780px] flex flex-col rounded-2xl shadow-2xl overflow-hidden border font-sans ${themeClasses.shell}`}
      >
        {/* MODAL HEADER */}
        <div
          className={`flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-3 border-b select-none ${themeClasses.header}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl font-bold ${isLight ? 'bg-black/5 border border-black/10 text-neutral-900' : 'bg-white/10 text-white'}`}>
                <Zap className="w-4 sm:w-5 h-4 sm:h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeClasses.textPrimary}`}>3D Model Studio & Draco Converter</h2>
                  <span className={`px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full border ${isLight ? 'bg-neutral-100 text-neutral-800 border-black/10' : 'bg-white/10 text-zinc-300 border-white/10'}`}>
                    Universal Loader
                  </span>
                </div>
                <p className={`text-[11px] sm:text-xs ${themeClasses.textSecondary} line-clamp-1`}>
                  Import, re-orient, scale, bake, and compress models with Google Draco into lightweight GLB
                </p>
              </div>
            </div>

            <div className="md:hidden">
              <StudioCloseButton onClick={onClose} theme={isLight ? 'light' : 'dark'} ariaLabel="Close Model Converter" />
            </div>
          </div>

          {/* TAB NAVIGATOR */}
          <div className={`flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl border overflow-x-auto max-w-full ${isLight ? 'bg-neutral-100 border-black/10' : 'bg-zinc-950 border-zinc-800'}`}>
            <button
              onClick={() => setActiveTab('preview_transform')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'preview_transform'
                  ? isLight ? 'bg-white text-neutral-950 shadow-sm font-bold' : 'bg-white text-zinc-950 font-bold shadow-sm'
                  : themeClasses.textSecondary
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Viewport & Transform</span>
            </button>
            <button
              onClick={() => setActiveTab('compression_export')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'compression_export'
                  ? isLight ? 'bg-white text-neutral-950 shadow-sm font-bold' : 'bg-white text-zinc-950 font-bold shadow-sm'
                  : themeClasses.textSecondary
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Draco Compression</span>
            </button>
            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'inspector'
                  ? isLight ? 'bg-white text-neutral-950 shadow-sm font-bold' : 'bg-white text-zinc-950 font-bold shadow-sm'
                  : themeClasses.textSecondary
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Hierarchy & Metrics</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('saved_storage');
                refreshSavedModels();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap relative cursor-pointer ${
                activeTab === 'saved_storage'
                  ? isLight ? 'bg-white text-neutral-950 shadow-sm font-bold' : 'bg-white text-zinc-950 font-bold shadow-sm'
                  : themeClasses.textSecondary
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>In-App Storage ({savedModels.length})</span>
              {savedModels.length > 0 && (
                <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-neutral-900' : 'bg-white'}`} />
              )}
            </button>
          </div>

          <div className="hidden md:flex">
            <StudioCloseButton onClick={onClose} theme={isLight ? 'light' : 'dark'} ariaLabel="Close Model Converter" />
          </div>
        </div>

        {/* TOAST NOTIFICATION */}
        {successToast && (
          <div className="bg-zinc-800 border-b border-zinc-700 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-zinc-300" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ERROR NOTIFICATION */}
        {errorMessage && (
          <div className="bg-zinc-800 border-b border-zinc-700 text-zinc-200 text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-zinc-400" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MODAL BODY CONTAINER */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative">
          {/* LEFT 3D VIEWPORT (Columns 7 or full) */}
          <div
            className="lg:col-span-7 h-full flex flex-col relative border-r border-zinc-800 bg-[#090a0c] overflow-hidden"
          >
            {/* Viewport Overlay Controls */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
              {/* Environment / Lighting Selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 shadow-md pointer-events-auto border border-zinc-800">
                {(['studio', 'sunset', 'cyber', 'white', 'dark'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setLightingPreset(preset)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                      lightingPreset === preset
                        ? 'bg-white text-zinc-950 font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Viewport Toggles */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 shadow-md pointer-events-auto border border-zinc-800">
                <button
                  onClick={() => setViewOriginalAB(!viewOriginalAB)}
                  title="Toggle Original vs Converted A/B view"
                  className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    viewOriginalAB
                      ? 'bg-white text-zinc-950 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {viewOriginalAB ? 'Showing Original (A)' : 'Transformed (B)'}
                </button>
                <button
                  onClick={() => setTurntableActive(!turntableActive)}
                  title="360° Turntable Auto-Rotate"
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    turntableActive
                      ? 'bg-white text-zinc-950 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {turntableActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setShowWireframe(!showWireframe)}
                  title="Toggle Wireframe"
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    showWireframe
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-zinc-950'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas Container */}
            <div ref={canvasContainerRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Viewport Bottom Live Metrics Strip */}
            <div
              className={`px-4 py-2.5 border-t text-xs flex items-center justify-between select-none ${
                isDark ? 'border-slate-800 bg-slate-900/90 text-slate-300' : 'border-slate-200 bg-white/90 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {modelName} ({modelFormat.toUpperCase()})
                </span>
                {inspection && (
                  <>
                    <span>
                      <b>{(inspection.triangleCount || 0).toLocaleString()}</b> Tris
                    </span>
                    <span>
                      <b>{(inspection.vertexCount || 0).toLocaleString()}</b> Verts
                    </span>
                    <span>
                      <b>{inspection.meshCount}</b> Meshes
                    </span>
                    <span>
                      Dim: {inspection.dimensions.x}m × {inspection.dimensions.y}m × {inspection.dimensions.z}m
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Left Drag: Rotate • Right Drag: Pan • Scroll: Zoom
              </div>
            </div>

            {/* DRAG & DROP OVERLAY */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleParseFiles(e.dataTransfer.files);
                }
              }}
              className={`absolute inset-0 pointer-events-none transition-all ${
                isDragOver ? 'bg-neutral-900 dark:bg-white/20 border-4 border-dashed border-neutral-900 dark:border-white' : ''
              }`}
            />
          </div>

          {/* RIGHT SIDE PANEL (Columns 5) */}
          <div
            className={`lg:col-span-5 h-full flex flex-col overflow-hidden ${
              isDark ? 'bg-slate-900/50' : 'bg-slate-50/50'
            }`}
          >
            {/* TAB 1: PREVIEW & TRANSFORM */}
            {activeTab === 'preview_transform' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* 1. FILE INGESTION DROPZONE */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleParseFiles(e.dataTransfer.files);
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 border-dashed text-center transition-all ${
                    isDark
                      ? 'border-slate-700 hover:border-neutral-900 dark:border-white bg-slate-800/40'
                      : 'border-slate-300 hover:border-neutral-900 dark:border-white bg-white'
                  }`}
                >
                  <input
                    type="file"
                    id="converter-file-input"
                    multiple
                    accept=".glb,.gltf,.obj,.mtl,.fbx,.3ds,.stl,.ply,.dae,image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleParseFiles(e.target.files);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="converter-file-input"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <div className="p-3 rounded-full bg-white/10 text-white">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-zinc-100">
                        Choose 3D Files
                      </span>{' '}
                      <span className="text-xs text-zinc-500">or drop here</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Supports .glb, .gltf, .obj (+.mtl/textures), .fbx, .3ds, .stl, .ply, .dae
                    </div>
                  </label>

                  {/* 1-Click Sample Models */}
                  <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      Quick Samples:
                    </span>
                    <button
                      onClick={() =>
                        handleLoadSample(
                          'DamagedHelmet',
                          'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
                          'glb'
                        )
                      }
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      Helmet
                    </button>
                    <button
                      onClick={() =>
                        handleLoadSample(
                          'Duck',
                          'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
                          'glb'
                        )
                      }
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      Duck
                    </button>
                    <button
                      onClick={() =>
                        handleLoadSample(
                          'CesiumMilkTruck',
                          'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
                          'glb'
                        )
                      }
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      Truck
                    </button>
                  </div>
                </div>

                {/* 2. MODEL ORIENTATION & UP-AXIS */}
                <div
                  className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-zinc-200">
                      <RotateCw className="w-4 h-4 text-zinc-400" />
                      Up-Axis & Orientation
                    </div>
                    <span className="text-[11px] text-zinc-400">Blender / 3ds Max</span>
                  </div>

                  {/* Up-Axis Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTransformConfig((prev) => ({ ...prev, upAxis: 'y' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        transformConfig.upAxis === 'y'
                          ? 'bg-white text-zinc-950 border-white shadow-sm font-bold'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      Y-Up (Standard / Three.js)
                    </button>
                    <button
                      onClick={() => setTransformConfig((prev) => ({ ...prev, upAxis: 'z' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        transformConfig.upAxis === 'z'
                          ? 'bg-white text-zinc-950 border-white shadow-sm font-bold'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      Z-Up (Blender / CAD / 3ds Max)
                    </button>
                  </div>

                  {/* 3-Axis Rotation Step Buttons & Sliders */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        Manual Degrees
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTransformConfig((prev) => ({
                            ...prev,
                            rotation: { x: 0, y: 0, z: 0 },
                          }))
                        }
                        className="text-[11px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" /> Reset Tilt
                      </button>
                    </div>

                    {(['x', 'y', 'z'] as const).map((axis) => (
                      <div key={axis} className="flex items-center gap-3">
                        <span className="w-6 font-bold text-xs uppercase text-zinc-400">
                          {axis}:
                        </span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="5"
                          value={transformConfig.rotation[axis]}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTransformConfig((prev) => ({
                              ...prev,
                              rotation: { ...prev.rotation, [axis]: val },
                            }));
                          }}
                          className="flex-1 accent-white h-2 bg-zinc-800 rounded-lg cursor-pointer"
                        />
                        <span className="w-12 text-right text-xs font-mono font-semibold text-zinc-200">
                          {transformConfig.rotation[axis]}°
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setTransformConfig((prev) => ({
                                ...prev,
                                rotation: {
                                  ...prev.rotation,
                                  [axis]: (prev.rotation[axis] - 90 + 360) % 360,
                                },
                              }))
                            }
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer active:scale-95 transition-all"
                          >
                            -90°
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setTransformConfig((prev) => ({
                                ...prev,
                                rotation: {
                                  ...prev.rotation,
                                  [axis]: (prev.rotation[axis] + 90) % 360,
                                },
                              }))
                            }
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer active:scale-95 transition-all"
                          >
                            +90°
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. SCALING & ALIGNMENT TOOLS */}
                <div
                  className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-zinc-200">
                      <Maximize2 className="w-4 h-4 text-zinc-400" />
                      Scale & Alignment
                    </div>
                    <button
                      onClick={() => {
                        if (rawScene) {
                          const factor = ModelConverterEngine.fitTo1Meter(rawScene);
                          setTransformConfig((prev) => ({
                            ...prev,
                            scale: { x: factor, y: factor, z: factor },
                          }));
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
                    >
                      Normalize "Fit 1m"
                    </button>
                  </div>

                  {/* Uniform Scale Slider */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-zinc-400 w-16">Scale:</span>
                    <input
                      type="range"
                      min="0.05"
                      max="10"
                      step="0.05"
                      value={transformConfig.scale.x}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTransformConfig((prev) => ({
                          ...prev,
                          scale: { x: val, y: val, z: val },
                        }));
                      }}
                      className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-lg"
                    />
                    <span className="w-12 text-right text-xs font-mono font-semibold text-zinc-200">
                      {transformConfig.scale.x.toFixed(2)}x
                    </span>
                  </div>

                  {/* Origin & Floor Snapping Toggles */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none text-xs font-semibold border-zinc-700 bg-zinc-800/50 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={transformConfig.centerOrigin}
                        onChange={(e) =>
                          setTransformConfig((prev) => ({ ...prev, centerOrigin: e.target.checked }))
                        }
                        className="accent-white w-4 h-4 rounded"
                      />
                      Auto-Center Origin (0,0,0)
                    </label>
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none text-xs font-semibold border-zinc-700 bg-zinc-800/50 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={transformConfig.snapFloor}
                        onChange={(e) =>
                          setTransformConfig((prev) => ({ ...prev, snapFloor: e.target.checked }))
                        }
                        className="accent-white w-4 h-4 rounded"
                      />
                      Snap Base to Floor (Y=0)
                    </label>
                  </div>

                  {/* Direct Geometry Baking Option */}
                  <label className="flex items-center justify-between p-3 rounded-xl border border-zinc-700 bg-zinc-800/40 cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-zinc-300" />
                      <div>
                        <div className="text-xs font-bold text-zinc-200">
                          Bake Transforms into Vertex Buffers
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Bakes rotation, scale & offsets directly into vertex positions
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={transformConfig.bakeTransforms}
                      onChange={(e) =>
                        setTransformConfig((prev) => ({ ...prev, bakeTransforms: e.target.checked }))
                      }
                      className="accent-white w-4 h-4 rounded"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: DRACO COMPRESSION & EXPORT */}
            {activeTab === 'compression_export' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div
                  className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-zinc-200">
                      <Zap className="w-4 h-4 text-zinc-400" />
                      Google Draco Compression Engine
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-white/10 text-zinc-300">
                      Lossless Geometry
                    </span>
                  </div>

                  {/* Enable Draco Switch */}
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-700 bg-zinc-800/50 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-zinc-200">Enable Draco Mesh Compression</div>
                      <div className="text-[11px] text-zinc-400">
                        Compresses vertex attributes, normals, and UVs for 80-95% smaller file size
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={dracoConfig.enabled}
                      onChange={(e) =>
                        setDracoConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                      className="accent-white w-5 h-5 rounded"
                    />
                  </label>

                  {/* Compression Level Slider (1 - 10) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-300">Compression Level:</span>
                      <span className="font-mono text-zinc-200 font-bold">
                        Level {dracoConfig.compressionLevel} / 10
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={dracoConfig.compressionLevel}
                      onChange={(e) =>
                        setDracoConfig((prev) => ({
                          ...prev,
                          compressionLevel: parseInt(e.target.value),
                        }))
                      }
                      className="w-full accent-white h-1.5 bg-zinc-800 rounded-lg"
                    />
                  </div>

                  {/* Quantization Bitrate Controls */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Quantization Bit Depths
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-28 text-xs font-medium text-zinc-300">Position Bits:</span>
                      <input
                        type="range"
                        min="10"
                        max="16"
                        step="1"
                        value={dracoConfig.positionQuantization}
                        onChange={(e) =>
                          setDracoConfig((prev) => ({
                            ...prev,
                            positionQuantization: parseInt(e.target.value),
                          }))
                        }
                        className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-lg"
                      />
                      <span className="w-12 text-right text-xs font-mono font-bold text-zinc-200">
                        {dracoConfig.positionQuantization} bit
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-28 text-xs font-medium text-zinc-300">Normal Bits:</span>
                      <input
                        type="range"
                        min="6"
                        max="12"
                        step="1"
                        value={dracoConfig.normalQuantization}
                        onChange={(e) =>
                          setDracoConfig((prev) => ({
                            ...prev,
                            normalQuantization: parseInt(e.target.value),
                          }))
                        }
                        className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-lg"
                      />
                      <span className="w-12 text-right text-xs font-mono font-bold text-zinc-200">
                        {dracoConfig.normalQuantization} bit
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-28 text-xs font-medium text-zinc-300">UV TexCoord Bits:</span>
                      <input
                        type="range"
                        min="6"
                        max="12"
                        step="1"
                        value={dracoConfig.uvQuantization}
                        onChange={(e) =>
                          setDracoConfig((prev) => ({
                            ...prev,
                            uvQuantization: parseInt(e.target.value),
                          }))
                        }
                        className="flex-1 accent-white h-1.5 bg-zinc-800 rounded-lg"
                      />
                      <span className="w-12 text-right text-xs font-mono font-bold text-zinc-200">
                        {dracoConfig.uvQuantization} bit
                      </span>
                    </div>
                  </div>
                </div>

                {/* Estimated Savings Report Card */}
                <div
                  className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs text-zinc-400 font-semibold">Original Size</div>
                    <div className="text-base font-bold text-zinc-200">
                      {originalBytes > 0
                        ? `${(originalBytes / (1024 * 1024)).toFixed(2)} MB`
                        : 'Uncompressed'}
                    </div>
                  </div>

                  <ArrowRight className="w-5 h-5 text-zinc-500" />

                  <div>
                    <div className="text-xs text-zinc-400 font-semibold">Estimated Compressed</div>
                    <div className="text-base font-bold text-white">
                      {originalBytes > 0
                        ? `~${(originalBytes * 0.15 / (1024 * 1024)).toFixed(2)} MB`
                        : '~0.5 MB'}
                    </div>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 font-bold text-xs">
                    ~85% Reduction
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: HIERARCHY & METRICS */}
            {activeTab === 'inspector' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {inspection ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60"
                      >
                        <div className="text-[11px] text-zinc-400 font-semibold">Total Triangles</div>
                        <div className="text-lg font-bold font-mono text-white">
                          {inspection.triangleCount.toLocaleString()}
                        </div>
                      </div>
                      <div
                        className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60"
                      >
                        <div className="text-[11px] text-zinc-400 font-semibold">Total Vertices</div>
                        <div className="text-lg font-bold font-mono text-white">
                          {inspection.vertexCount.toLocaleString()}
                        </div>
                      </div>
                      <div
                        className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60"
                      >
                        <div className="text-[11px] text-zinc-400 font-semibold">Sub-Meshes</div>
                        <div className="text-lg font-bold font-mono text-white">{inspection.meshCount}</div>
                      </div>
                      <div
                        className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60"
                      >
                        <div className="text-[11px] text-zinc-400 font-semibold">Materials</div>
                        <div className="text-lg font-bold font-mono text-white">{inspection.materialCount}</div>
                      </div>
                    </div>

                    {/* Submesh Hierarchy List */}
                    <div
                      className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-3"
                    >
                      <div className="font-bold text-xs text-zinc-400 uppercase tracking-wider">
                        Submesh Hierarchy ({inspection.submeshes.length})
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                        {inspection.submeshes.map((sub, idx) => (
                          <div
                            key={sub.id || idx}
                            className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-zinc-200">
                                {sub.name}
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                {sub.triangles.toLocaleString()} tris • {sub.materialName}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                              Mesh #{idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-zinc-400">
                    No 3D model currently loaded for inspection.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: SAVED IN-APP STORAGE */}
            {activeTab === 'saved_storage' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Storage Quota Bar */}
                <div
                  className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-zinc-200">
                      <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                      In-App Local Storage
                    </span>
                    <span className="font-mono text-zinc-400">
                      {(storageUsage.usedBytes / (1024 * 1024)).toFixed(2)} MB /{' '}
                      {(storageUsage.quotaBytes / (1024 * 1024)).toFixed(0)} MB
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (storageUsage.usedBytes / storageUsage.quotaBytes) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Saved Models List */}
                <div className="space-y-3">
                  {savedModels.length === 0 ? (
                    <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
                      <HardDrive className="w-8 h-8 mx-auto text-zinc-600" />
                      <div>No models saved in local storage yet.</div>
                      <div className="text-[11px] text-zinc-500">
                        Convert or upload a model to store it persistently in-app!
                      </div>
                    </div>
                  ) : (
                    savedModels.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 flex items-center gap-3 transition-all"
                      >
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Box className="w-6 h-6 text-zinc-400" />
                          )}
                        </div>

                        {/* Info & Rename */}
                        <div className="flex-1 min-w-0">
                          {editingModelId === item.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editNameInput}
                                onChange={(e) => setEditNameInput(e.target.value)}
                                className="px-2 py-1 text-xs rounded border border-zinc-600 bg-zinc-950 text-zinc-100"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveRename(item.id)}
                                className="p-1 text-zinc-200 hover:bg-zinc-800 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm truncate text-zinc-100">{item.name}</span>
                              <button
                                onClick={() => {
                                  setEditingModelId(item.id);
                                  setEditNameInput(item.name);
                                }}
                                className="text-zinc-400 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                            <span>{(item.compressedSize / (1024 * 1024)).toFixed(2)} MB</span>
                            <span>•</span>
                            <span>{item.triangleCount?.toLocaleString()} tris</span>
                            <span>•</span>
                            <span>{new Date(item.savedDate).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleLoadSavedModelToCanvas(item)}
                            title="Load onto Studio Painting Canvas"
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Load Canvas
                          </button>
                          <button
                            onClick={() => handleDownloadSavedBlob(item)}
                            title="Download .GLB File"
                            className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSavedModel(item.id, item.name)}
                            title="Delete from In-App Storage"
                            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MODAL FOOTER BAR */}
            <div
              className="p-4 border-t border-zinc-800 bg-[#0e0f12] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="Model Name"
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 focus:outline-none focus:border-zinc-500 w-44"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadGLB}
                  disabled={!rawScene || isLoading}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-zinc-700 hover:bg-zinc-800 text-zinc-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .GLB
                </button>

                <button
                  onClick={() => handleConvertAndSave(false)}
                  disabled={!rawScene || isLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  Save In-App
                </button>

                <button
                  onClick={() => handleConvertAndSave(true)}
                  disabled={!rawScene || isLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-zinc-200 text-zinc-950 shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {loadingStatus || 'Processing...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Convert & Load to Canvas
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
