import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Play, Pause, RotateCcw, Box, Eye, Layers } from 'lucide-react';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { getQualityProfile, resolvePixelRatio } from '../../utils/deviceProfile';
import { haptics } from '../../utils/haptics';

export interface Model3DStats {
  vertices: number;
  triangles: number;
  dimensions: { x: number; y: number; z: number };
}

export interface Model3DPreviewProps {
  model: THREE.Object3D | ArrayBuffer | string | null;
  theme?: 'light' | 'dark';
  displayMode?: 'texture' | 'clay';
  autoRotate?: boolean;
  showControls?: boolean;
  showGrid?: boolean;
  className?: string;
  rotationOffset?: { x: number; y: number; z: number };
  scaleMultiplier?: number;
  onStatsReady?: (stats: Model3DStats) => void;
  onDisplayModeChange?: (mode: 'texture' | 'clay') => void;
}

export const Model3DPreview: React.FC<Model3DPreviewProps> = ({
  model,
  theme = 'dark',
  displayMode = 'texture',
  autoRotate: initialAutoRotate = true,
  showControls = true,
  showGrid = true,
  className = 'w-full h-full min-h-[220px]',
  rotationOffset,
  scaleMultiplier = 1,
  onStatsReady,
  onDisplayModeChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(initialAutoRotate);
  const [currentMode, setCurrentMode] = useState<'texture' | 'clay'>(displayMode);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<Model3DStats | null>(null);

  const isLight = theme === 'light';

  // Three.js instances ref
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    pivotGroup: THREE.Group;
    modelContainer: THREE.Group;
    gridHelper: THREE.GridHelper;
    originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
    clayMaterial: THREE.MeshStandardMaterial;
    wireframeMaterial: THREE.MeshBasicMaterial;
    animId: number;
    defaultCamPos: THREE.Vector3;
    defaultCamTarget: THREE.Vector3;
  } | null>(null);

  // Sync external displayMode changes
  useEffect(() => {
    setCurrentMode(displayMode);
  }, [displayMode]);

  // Initialize Three.js scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    const scene = new THREE.Scene();
    const bgColor = isLight ? 0xf4f5f7 : 0x0f1117;
    scene.background = new THREE.Color(bgColor);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 500);
    camera.position.set(2.4, 1.8, 3.2);

    const profile = getQualityProfile();
    const renderer = new THREE.WebGLRenderer({
      antialias: profile.antialias,
      alpha: true,
      powerPreference: profile.powerPreference,
      precision: profile.precision,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(resolvePixelRatio(profile), 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 30;
    controls.minDistance = 0.15;

    // Soft Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x90cdf4, 0.9);
    fillLight.position.set(-4, 2, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.6);
    rimLight.position.set(0, -3, 3);
    scene.add(rimLight);

    // Subtle Ground Grid
    const gridColor = isLight ? 0xd1d5db : 0x27272a;
    const gridCenter = isLight ? 0x9ca3af : 0x3f3f46;
    const gridHelper = new THREE.GridHelper(8, 16, gridCenter, gridColor);
    gridHelper.position.y = -0.001;
    gridHelper.visible = showGrid;
    scene.add(gridHelper);

    // Pivot group for centering and rotations
    const pivotGroup = new THREE.Group();
    pivotGroup.name = 'pivotGroup';
    scene.add(pivotGroup);

    const modelContainer = new THREE.Group();
    modelContainer.name = 'modelContainer';
    pivotGroup.add(modelContainer);

    const clayMaterial = new THREE.MeshStandardMaterial({
      color: isLight ? 0xf8fafc : 0xd4d4d8,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: isLight ? 0x374151 : 0x38bdf8,
      wireframe: true,
    });

    const defaultCamPos = camera.position.clone();
    const defaultCamTarget = new THREE.Vector3(0, 0, 0);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      if (sceneRef.current?.pivotGroup && isSpinning) {
        sceneRef.current.pivotGroup.rotation.y += 0.008;
      }

      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      pivotGroup,
      modelContainer,
      gridHelper,
      originalMaterials: new Map(),
      clayMaterial,
      wireframeMaterial,
      animId,
      defaultCamPos,
      defaultCamTarget,
    };

    // Resize observer
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
      cancelAnimationFrame(animId);
      resizeObs.disconnect();
      controls.dispose();
      renderer.dispose();
      clayMaterial.dispose();
      wireframeMaterial.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  // Update theme background and lighting
  useEffect(() => {
    if (!sceneRef.current) return;
    const { scene, gridHelper, clayMaterial } = sceneRef.current;
    const bgColor = isLight ? 0xf4f5f7 : 0x0f1117;
    scene.background = new THREE.Color(bgColor);

    if (gridHelper) {
      gridHelper.visible = showGrid;
    }
    if (clayMaterial) {
      clayMaterial.color.setHex(isLight ? 0xf8fafc : 0xd4d4d8);
    }
  }, [isLight, showGrid]);

  // Load and attach model object
  useEffect(() => {
    if (!sceneRef.current) return;
    const { modelContainer, originalMaterials, camera, controls, gridHelper } = sceneRef.current;

    // Clear previous model children and materials map
    while (modelContainer.children.length > 0) {
      const child = modelContainer.children[0];
      modelContainer.remove(child);
    }
    originalMaterials.clear();

    if (!model) {
      setStats(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const setupLoadedObject = (rootObj: THREE.Object3D) => {
      if (isCancelled || !sceneRef.current) return;

      // Deep clone object so materials/geometries aren't corrupted on other surfaces
      const obj = rootObj.clone(true);

      // Collect materials & compute mesh statistics
      let verts = 0;
      let tris = 0;

      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          child.castShadow = true;
          child.receiveShadow = true;
          originalMaterials.set(child, child.material);

          const geom = child.geometry;
          const v = geom.attributes.position ? geom.attributes.position.count : 0;
          const t = geom.index ? geom.index.count / 3 : v / 3;
          verts += v;
          tris += Math.floor(t);
        }
      });

      // Compute bounding box and center
      const bbox = new THREE.Box3().setFromObject(obj);
      const center = new THREE.Vector3();
      bbox.getCenter(center);
      const size = new THREE.Vector3();
      bbox.getSize(size);

      // Center model around origin
      obj.position.x = -center.x;
      obj.position.y = -bbox.min.y; // Sit directly on ground plane y=0
      obj.position.z = -center.z;

      modelContainer.add(obj);

      // Adjust camera to frame model nicely
      const maxDim = Math.max(size.x, size.y, size.z, 0.5);
      const dist = maxDim * 1.8;
      const camY = Math.max(size.y * 0.9, 0.8);

      camera.position.set(dist * 0.9, camY, dist * 1.1);
      camera.near = Math.max(0.01, dist * 0.01);
      camera.far = Math.max(100, dist * 20);
      camera.updateProjectionMatrix();

      controls.target.set(0, size.y * 0.45, 0);
      controls.update();

      if (gridHelper) {
        gridHelper.position.y = 0;
      }

      sceneRef.current.defaultCamPos = camera.position.clone();
      sceneRef.current.defaultCamTarget = controls.target.clone();

      const calculatedStats: Model3DStats = {
        vertices: verts,
        triangles: tris,
        dimensions: {
          x: parseFloat(size.x.toFixed(2)),
          y: parseFloat(size.y.toFixed(2)),
          z: parseFloat(size.z.toFixed(2)),
        },
      };

      setStats(calculatedStats);
      onStatsReady?.(calculatedStats);
      setLoading(false);
    };

    if (model instanceof THREE.Object3D) {
      setupLoadedObject(model);
    } else if (model instanceof ArrayBuffer) {
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(resolveAssetUrl('draco/'));
      dracoLoader.setDecoderConfig({ type: 'wasm' });
      loader.setDRACOLoader(dracoLoader);

      loader.parse(
        model,
        '',
        (gltf) => {
          setupLoadedObject(gltf.scene || gltf.scenes[0]);
          dracoLoader.dispose();
        },
        (err) => {
          console.error('Failed to parse ArrayBuffer in Model3DPreview:', err);
          dracoLoader.dispose();
          if (!isCancelled) setLoading(false);
        }
      );
    } else if (typeof model === 'string') {
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(resolveAssetUrl('draco/'));
      dracoLoader.setDecoderConfig({ type: 'wasm' });
      loader.setDRACOLoader(dracoLoader);

      loader.load(
        resolveAssetUrl(model),
        (gltf) => {
          setupLoadedObject(gltf.scene || gltf.scenes[0]);
          dracoLoader.dispose();
        },
        undefined,
        (err) => {
          console.error('Failed to load URL model in Model3DPreview:', err);
          dracoLoader.dispose();
          if (!isCancelled) setLoading(false);
        }
      );
    }

    return () => {
      isCancelled = true;
    };
  }, [model]);

  // Apply displayMode (Texture vs Clay) & Wireframe
  useEffect(() => {
    if (!sceneRef.current) return;
    const { modelContainer, originalMaterials, clayMaterial, wireframeMaterial } = sceneRef.current;

    modelContainer.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (wireframe) {
          child.material = wireframeMaterial;
        } else if (currentMode === 'clay') {
          child.material = clayMaterial;
        } else {
          const orig = originalMaterials.get(child);
          if (orig) child.material = orig;
        }
      }
    });
  }, [currentMode, wireframe]);

  // Apply rotation offset & scale multiplier if provided
  useEffect(() => {
    if (!sceneRef.current) return;
    const { modelContainer } = sceneRef.current;
    if (rotationOffset) {
      modelContainer.rotation.set(
        THREE.MathUtils.degToRad(rotationOffset.x || 0),
        THREE.MathUtils.degToRad(rotationOffset.y || 0),
        THREE.MathUtils.degToRad(rotationOffset.z || 0)
      );
    }
    if (typeof scaleMultiplier === 'number' && scaleMultiplier > 0) {
      modelContainer.scale.setScalar(scaleMultiplier);
    }
  }, [rotationOffset, scaleMultiplier]);

  const handleResetCamera = useCallback(() => {
    if (!sceneRef.current) return;
    const { camera, controls, defaultCamPos, defaultCamTarget, pivotGroup } = sceneRef.current;
    camera.position.copy(defaultCamPos);
    controls.target.copy(defaultCamTarget);
    controls.update();
    pivotGroup.rotation.set(0, 0, 0);
    haptics.trigger('light');
  }, []);

  const toggleSpin = useCallback(() => {
    setIsSpinning((prev) => !prev);
    haptics.trigger('light');
  }, []);

  const toggleMode = useCallback(() => {
    const next = currentMode === 'texture' ? 'clay' : 'texture';
    setCurrentMode(next);
    onDisplayModeChange?.(next);
    haptics.trigger('light');
  }, [currentMode, onDisplayModeChange]);

  const toggleWireframe = useCallback(() => {
    setWireframe((prev) => !prev);
    haptics.trigger('light');
  }, []);

  const pillButton = `h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm ${
    isLight
      ? 'bg-white text-neutral-800 hover:bg-neutral-100 border border-neutral-200'
      : 'bg-zinc-900 text-neutral-200 hover:bg-zinc-800 border border-zinc-700'
  }`;

  return (
    <div className={`relative rounded-2xl overflow-hidden select-none ${className}`}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 ${
            isLight ? 'bg-white text-neutral-800' : 'bg-zinc-900 text-white'
          }`}>
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Rendering 3D Model…</span>
          </div>
        </div>
      )}

      {/* Top-Right Floating Controls */}
      {showControls && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={toggleSpin}
            title={isSpinning ? 'Pause rotation' : 'Auto-rotate model'}
            className={pillButton}
            aria-label={isSpinning ? 'Pause turntable' : 'Auto spin'}
          >
            {isSpinning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isSpinning ? 'Pause' : 'Spin'}</span>
          </button>

          <button
            type="button"
            onClick={toggleMode}
            title={`Switch to ${currentMode === 'texture' ? 'White Clay' : 'Textured'}`}
            className={pillButton}
            aria-label="Toggle clay texture"
          >
            <Box className="w-3.5 h-3.5" />
            <span className="capitalize hidden sm:inline">{currentMode}</span>
          </button>

          <button
            type="button"
            onClick={toggleWireframe}
            title="Toggle wireframe topology"
            className={`${pillButton} ${wireframe ? (isLight ? 'bg-neutral-900 text-white' : 'bg-white text-zinc-950') : ''}`}
            aria-label="Toggle wireframe"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetCamera}
            title="Reset camera view"
            className={pillButton}
            aria-label="Reset camera"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom-Left Model Stats Badge */}
      {stats && (
        <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none">
          <div className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border shadow-sm ${
            isLight
              ? 'bg-white text-neutral-700 border-neutral-200'
              : 'bg-[#18191d] text-zinc-300 border-zinc-800'
          }`}>
            <span>{(stats.vertices / 1000).toFixed(1)}k verts</span>
            <span className="mx-1 opacity-40">•</span>
            <span>{(stats.triangles / 1000).toFixed(1)}k tris</span>
            <span className="mx-1 opacity-40">•</span>
            <span>{stats.dimensions.x}×{stats.dimensions.y}×{stats.dimensions.z}m</span>
          </div>
        </div>
      )}
    </div>
  );
};
