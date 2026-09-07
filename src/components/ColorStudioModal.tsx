import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getThemeClasses } from '../utils/themeStyles';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import {
  hsvToRgb,
  rgbToHsv,
  rgbToHex,
  hexToRgb,
  hexToOklch,
  oklchToHex,
  generateOKLCHGradient,
  generateHarmonies,
  posterizeOKLCH,
  oklchMix,
} from '../core/colorMath';
import { normalizeHexColor } from '../core/materialCache';
import { parseOBJ } from '../utils/objLoader';
import { resolveAssetUrl } from '../utils/assetUrl';
import { ALL_MATERIAL_PRESETS } from '../presets/materialPresets';
import { SHADER_PRESETS } from '../presets/shaderPresets';
import {
  Palette,
  Pipette,
  Sliders,
  Sparkles,
  Layers,
  SunMedium,
  Check,
  Copy,
  X,
  Shuffle,
  Eye,
  Zap,
} from 'lucide-react';

import { BrushSettings } from '../types';
import { getQualityProfile, resolvePixelRatio } from '../utils/deviceProfile';

interface ColorStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onChangeColor: (hex: string) => void;
  onApplyBrushSettings?: (settings: Partial<BrushSettings>) => void;
  onApplyToModel?: (material: THREE.Material) => void;
  onSampleFromScreen?: () => void;
  theme?: 'light' | 'dark';
}

type TabType = 'shaders' | 'wheel' | 'oklch' | 'harmonies' | 'gradients' | 'presets';

const CURATED_PALETTES = {
  'Drafting Neon': ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#34d399', '#facc15'],
  'Clay & Terracotta': ['#b45309', '#d97706', '#f59e0b', '#78350f', '#92400e', '#ea580c', '#c2410c'],
  'Nordic Architecture': ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#f8fafc'],
  'Cyberpunk Synth': ['#06b6d4', '#ec4899', '#8b5cf6', '#10b981', '#f43f5e', '#a855f7', '#3b82f6'],
  'Monochrome & Ink': ['#000000', '#18181b', '#27272a', '#52525b', '#71717a', '#a1a1aa', '#ffffff'],
};

// ── 1-Click Shaders & MatCaps Tab View ──
function MatCapShaderTabContent({
  currentColor,
  onChangeColor,
  onApplyBrushSettings,
  onApplyToModel,
  onClose,
  theme
}: {
  currentColor: string;
  onChangeColor: (hex: string) => void;
  onApplyBrushSettings?: (settings: Partial<BrushSettings>) => void;
  onApplyToModel?: (material: THREE.Material) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.Material | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const mousePosRef = useRef(new THREE.Vector2(0, 0));
  const objCacheRef = useRef<Record<string, THREE.BufferGeometry>>({});

  const [activeCategory, setActiveCategory] = useState<string>('Toon & Anime');
  const [materialMode, setMaterialMode] = useState<'matcap' | 'shader'>('matcap');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [activeShader, setActiveShader] = useState<any>(SHADER_PRESETS[0]);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>('#15171e');

  // Initialize Three.js Viewport
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.5);

    const profile = getQualityProfile();
    const renderer = new THREE.WebGLRenderer({
      antialias: profile.antialias,
      preserveDrawingBuffer: true,
      precision: profile.precision,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(resolvePixelRatio(profile));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const defaultGeo = new THREE.SphereGeometry(1, 64, 64);
    const defaultMat = new THREE.MeshMatcapMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(defaultGeo, defaultMat);
    scene.add(mesh);
    meshRef.current = mesh;
    materialRef.current = defaultMat;

    // Load initial preset — pick the first one matching the default category
    const initialPreset = ALL_MATERIAL_PRESETS.find((p) =>
      p.category === 'Toon Shaders' || p.category === 'Flat Colors'
    ) || ALL_MATERIAL_PRESETS[0];
    if (initialPreset) {
      setSelectedPresetId(initialPreset.id);
      if (initialPreset.type === 'shader') {
        setMaterialMode('shader');
        setActiveShader(initialPreset);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 512, 512);
            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            setTexture(tex);
          }
        };
        img.src = initialPreset.url;
      }
    }

    // Orbit Drag Controls
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    const spherical = { radius: 3.5, theta: 0, phi: Math.PI / 2 };

    const updateCameraPos = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mousePosRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;

      spherical.theta -= dx * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * 0.01));
      prevMouse = { x: e.clientX, y: e.clientY };
      updateCameraPos();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(1.2, Math.min(10, spherical.radius + e.deltaY * 0.003));
      updateCameraPos();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clockRef.current.getElapsedTime();

      if (autoRotate && meshRef.current && !isDragging) {
        meshRef.current.rotation.y += 0.008;
      }

      if (materialRef.current && (materialRef.current as any).uniforms) {
        const u = (materialRef.current as any).uniforms;
        if (u.u_time) u.u_time.value = elapsedTime;
        if (u.time) u.time.value = elapsedTime;
        if (u.iTime) u.iTime.value = elapsedTime;
        if (u.uTime) u.uTime.value = elapsedTime;
        if (u.u_mouse) u.u_mouse.value.set(mousePosRef.current.x, mousePosRef.current.y);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Load Suzanne OBJ
    const loadSuzanne = async () => {
      if (objCacheRef.current['suzanne']) {
        if (meshRef.current) {
          meshRef.current.geometry.dispose();
          meshRef.current.geometry = objCacheRef.current['suzanne'];
        }
        return;
      }
      try {
        const res = await fetch(resolveAssetUrl('assets/models/suzanne.obj'));
        const text = await res.text();
        const geo = parseOBJ(text);
        geo.scale(1.2, 1.2, 1.2);
        objCacheRef.current['suzanne'] = geo;
        if (meshRef.current) {
          meshRef.current.geometry.dispose();
          meshRef.current.geometry = geo;
        }
      } catch (err) {
        console.error('Error loading suzanne.obj', err);
      }
    };
    loadSuzanne();

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, []);

  // Update Background Color
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(bgColor);
    }
  }, [bgColor]);

  // Update Material
  useEffect(() => {
    if (!meshRef.current) return;

    if (materialMode === 'matcap' && texture) {
      const mat = new THREE.MeshMatcapMaterial({
        matcap: texture,
        wireframe: wireframe
      });
      meshRef.current.material.dispose();
      meshRef.current.material = mat;
      materialRef.current = mat;
    } else if (materialMode === 'shader' && activeShader) {
      const container = mountRef.current;
      const w = container ? container.clientWidth || 512 : 512;
      const h = container ? container.clientHeight || 512 : 512;

      const uniforms: Record<string, any> = {
        u_time: { value: 0 },
        time: { value: 0 },
        iTime: { value: 0 },
        uTime: { value: 0 },
        u_resolution: { value: new THREE.Vector2(w, h) },
        resolution: { value: new THREE.Vector2(w, h) },
        iResolution: { value: new THREE.Vector3(w, h, 1.0) },
        u_mouse: { value: new THREE.Vector2(0, 0) },
        iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
        u_matcap: { value: texture },
        tBackground: { value: texture },
        u_texture: { value: texture },
        iChannel0: { value: texture },
        tDiffuse: { value: texture },
        uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() }
      };

      try {
        const mat = new THREE.ShaderMaterial({
          vertexShader:
            activeShader.vertexShader ||
            `precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
          fragmentShader: activeShader.fragmentShader,
          uniforms: uniforms,
          wireframe: wireframe,
          transparent: true,
          side: THREE.DoubleSide
        });
        meshRef.current.material.dispose();
        meshRef.current.material = mat;
        materialRef.current = mat;
      } catch (err) {
        console.error('Failed to compile ShaderMaterial in ColorStudioModal', err);
      }
    }
  }, [materialMode, texture, activeShader, wireframe]);

  const handleSelectPreset = (preset: any) => {
    setSelectedPresetId(preset.id);

    if (preset.type === 'shader') {
      setMaterialMode('shader');
      setActiveShader({
        id: preset.id,
        name: preset.name,
        category: preset.category,
        vertexShader: preset.vertexShader,
        fragmentShader: preset.fragmentShader,
        uniforms: {}
      });
    } else {
      setMaterialMode('matcap');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 512, 512);
          const tex = new THREE.CanvasTexture(canvas);
          tex.needsUpdate = true;
          setTexture(tex);

          // Sample center pixel to synchronize color picker
          try {
            const pixel = ctx.getImageData(256, 256, 1, 1).data;
            const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
            onChangeColor(hex);
          } catch (_) {}
        }
      };
      img.src = preset.url;
    }
  };

  const handleApplyToBrushDirect = () => {
    const preset = ALL_MATERIAL_PRESETS.find((p) => p.id === selectedPresetId);
    if (preset) {
      if (preset.type === 'shader') {
        onApplyBrushSettings?.({
          materialType: 'animated_fx',
          shaderEffect: 'anime_cel',
          customShader: {
            id: preset.id,
            name: preset.name,
            vertexShader: preset.vertexShader,
            fragmentShader: preset.fragmentShader,
          },
          matcapUrl: preset.url,
          matcapTexture: texture || undefined,
          color: currentColor,
        });
      } else {
        onApplyBrushSettings?.({
          materialType: 'matcap',
          matcapUrl: preset.url,
          matcapTexture: texture || undefined,
          color: currentColor,
        });
      }
    } else if (materialMode === 'shader' && activeShader) {
      onApplyBrushSettings?.({
        materialType: 'animated_fx',
        shaderEffect: 'anime_cel',
        customShader: {
          id: activeShader.id,
          name: activeShader.name,
          vertexShader: activeShader.vertexShader,
          fragmentShader: activeShader.fragmentShader,
        },
        color: currentColor,
      });
    } else if (materialMode === 'matcap' && texture) {
      onApplyBrushSettings?.({
        materialType: 'matcap',
        matcapTexture: texture,
        color: currentColor,
      });
    }
    onClose();
  };

  const handleApplyToModelDirect = () => {
    if (materialRef.current && onApplyToModel) {
      onApplyToModel(materialRef.current.clone());
    }
  };

  const filteredPresets = ALL_MATERIAL_PRESETS.filter((preset) => {
    if (activeCategory === 'Toon & Anime') {
      return (
        preset.category === 'Toon Shaders' ||
        preset.category === 'Flat Colors' ||
        preset.id === 'wonderlust_beach_shoreline'
      );
    }
    if (activeCategory === 'Fun & Magic') {
      return preset.category === '✨ Fun & Magic';
    }
    if (activeCategory === 'Wonderlust') {
      return preset.category === '🌍 Wonderlust';
    }
    if (activeCategory === 'Bright & Glass') {
      return (
        preset.category === 'Glass & Crystal' ||
        preset.category === 'Bright Colors' ||
        preset.category === 'Gems & Organics'
      );
    }
    return true;
  });

  const isLight = theme === 'light';
  const t = getThemeClasses(theme);

  return (
    <div className="space-y-3.5">
      {/* 3D MatCap / Shader Interactive Preview Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-neutral-950">
        <div ref={mountRef} className="w-full h-44 cursor-grab active:cursor-grabbing" />

        {/* Floating Preset Name Pill */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/90 px-2.5 py-1 rounded-full border border-white/10 text-xs font-semibold text-white">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{activeShader?.name || selectedPresetId || 'MatCap Preview'}</span>
        </div>

        {/* Viewport Toolbar */}
        <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 ${isLight ? 'bg-neutral-100 border-t border-black/10' : 'bg-neutral-900 border-t border-white/10'} text-[11px]`}>
          {/* Mode Toggle */}
          <div className={`flex items-center gap-1 p-0.5 rounded-lg border ${isLight ? 'bg-neutral-200 border-black/10' : 'bg-black/40 border-white/10'}`}>
            <button
              onClick={() => setMaterialMode('matcap')}
              className={
                'px-2.5 py-0.5 rounded-md font-medium transition-all ' +
                (materialMode === 'matcap' ? (isLight ? 'bg-neutral-900 text-white shadow-sm font-bold' : 'bg-white text-zinc-950 shadow-sm font-bold') : (isLight ? 'text-neutral-600 hover:text-neutral-900' : 'text-neutral-400 hover:text-white'))
              }
            >
              MatCap Paint
            </button>
            <button
              onClick={() => setMaterialMode('shader')}
              className={
                'px-2.5 py-0.5 rounded-md font-medium transition-all ' +
                (materialMode === 'shader' ? (isLight ? 'bg-neutral-900 text-white shadow-sm font-bold' : 'bg-white text-zinc-950 shadow-sm font-bold') : (isLight ? 'text-neutral-600 hover:text-neutral-900' : 'text-neutral-400 hover:text-white'))
              }
            >
              Live Shader
            </button>
          </div>

          <div className="flex items-center gap-3 text-neutral-400">
            <label className="flex items-center gap-1 cursor-pointer hover:text-white select-none">
              <input
                type="checkbox"
                checked={autoRotate}
                onChange={(e) => setAutoRotate(e.target.checked)}
                className={`rounded border text-neutral-900 dark:text-zinc-300 focus:ring-0 w-3 h-3 ${isLight ? 'bg-white border-neutral-300' : 'bg-neutral-800 border-neutral-700'}`}
              />
              <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Rotate</span>
            </label>

            <label className="flex items-center gap-1 cursor-pointer hover:text-white select-none">
              <input
                type="checkbox"
                checked={wireframe}
                onChange={(e) => setWireframe(e.target.checked)}
                className={`rounded border text-neutral-900 dark:text-zinc-300 focus:ring-0 w-3 h-3 ${isLight ? 'bg-white border-neutral-300' : 'bg-neutral-800 border-neutral-700'}`}
              />
              <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Wireframe</span>
            </label>

            <div className={`flex items-center gap-1 ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
              <span>BG:</span>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Curated Categories */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {['Toon & Anime', 'Fun & Magic', 'Wonderlust', 'Bright & Glass'].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={
              'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ' +
              (activeCategory === cat
                ? (isLight ? 'bg-neutral-900 text-white shadow-sm font-bold' : 'bg-white text-zinc-950 shadow-sm font-bold')
                : (isLight ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'))
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-44 overflow-y-auto pr-1">
        {filteredPresets.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          return (
            <div
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className={
                'group flex flex-col items-center gap-1 p-1.5 rounded-xl border cursor-pointer transition-all select-none ' +
                (isSelected
                  ? (isLight ? 'bg-neutral-100 border-neutral-900 ring-2 ring-neutral-900 shadow-sm' : 'bg-white/10 border-white ring-2 ring-white shadow-md')
                  : (isLight ? 'bg-neutral-50 border-black/10 hover:bg-neutral-100' : 'bg-neutral-900/60 border-white/5 hover:bg-neutral-800 hover:border-white/10'))
              }
              title={preset.name}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden relative border border-white/10 shadow-sm bg-black/40 flex items-center justify-center group-hover:scale-105 transition-transform">
                <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                {preset.type === 'shader' && (
                  <span
                    className={`absolute bottom-0 right-0 text-[8px] ${isLight ? 'bg-neutral-900 text-white' : 'bg-white text-zinc-950'} px-0.5 rounded-tl font-bold`}
                    title="Live Shader"
                  >
                    ⚡
                  </span>
                )}
              </div>
              <span className={`text-[9.5px] font-medium text-center ${isLight ? 'text-neutral-700 group-hover:text-neutral-900' : 'text-neutral-300 group-hover:text-white'} line-clamp-1 leading-tight w-full truncate`}>
                {preset.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* 1-Click Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleApplyToBrushDirect}
          className={`flex-1 py-2 px-3 rounded-xl ${isLight ? 'bg-neutral-900 text-white hover:bg-black' : 'bg-white text-zinc-950 hover:bg-neutral-100'} font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-98 cursor-pointer`}
          title="Set brush to this Shader or MatCap"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Apply to Brush</span>
        </button>

        <button
          type="button"
          onClick={handleApplyToModelDirect}
          className={`flex-1 py-2 px-3 rounded-xl ${isLight ? 'bg-neutral-900 text-white hover:bg-black' : 'bg-white text-zinc-950 hover:bg-neutral-100'} font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-98 cursor-pointer`}
          title="Skin entire 3D model with this Shader or MatCap"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Apply to 3D Model</span>
        </button>
      </div>
    </div>
  );
}

export const ColorStudioModal: React.FC<ColorStudioModalProps> = ({
  isOpen,
  onClose,
  currentColor,
  onChangeColor,
  onApplyBrushSettings,
  onApplyToModel,
  onSampleFromScreen,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const t = getThemeClasses(theme);
  const [activeTab, setActiveTab] = useState<TabType>('shaders');
  const [copiedHex, setCopiedHex] = useState<boolean>(false);
  const [secondaryColor, setSecondaryColor] = useState<string>('#f43f5e');

  // HSV representation state
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>({ h: 200, s: 0.8, v: 0.9 });

  // OKLCh state
  const [oklch, setOklch] = useState<{ L: number; C: number; h: number }>({ L: 0.7, C: 0.15, h: 220 });

  // Posterization steps
  const [posterizeSteps, setPosterizeSteps] = useState<number>(4);

  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingWheel = useRef<boolean>(false);
  const isDraggingSquare = useRef<boolean>(false);

  // Sync internal HSV and OKLCh state when currentColor prop changes
  useEffect(() => {
    const validHex = normalizeHexColor(currentColor, '#38bdf8');
    const rgb = hexToRgb(validHex);
    const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setHsv(newHsv);

    const rawOklch = hexToOklch(validHex);
    setOklch({
      L: rawOklch.L,
      C: rawOklch.C,
      h: Math.round((rawOklch.h * 180) / Math.PI),
    });
  }, [currentColor]);

  // Dimension helpers for the HSV wheel
  const wheelSize = 240;
  const radius = wheelSize / 2;
  const ringWidth = 24;
  const innerRadius = radius - ringWidth;
  const squareSize = innerRadius * Math.SQRT2 - 12;

  // Render HSV Polar Wheel & Sat/Val Square on canvas
  const renderWheel = useCallback(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = wheelSize * dpr;
    canvas.height = wheelSize * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, wheelSize, wheelSize);

    // 1. Draw Outer Hue Wheel (Polar Hue Gradient)
    const centerX = wheelSize / 2;
    const centerY = wheelSize / 2;

    const segments = 360;
    for (let i = 0; i < segments; i++) {
      const angle1 = ((i - 0.5) * Math.PI) / 180;
      const angle2 = ((i + 0.5) * Math.PI) / 180;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 2, angle1, angle2);
      ctx.arc(centerX, centerY, innerRadius + 2, angle2, angle1, true);
      ctx.closePath();

      const rgb = hsvToRgb(i, 1.0, 1.0);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fill();
    }

    // Outer and inner border ring for polish
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Draw Hue Handle on the Outer Ring
    const handleAngle = (hsv.h * Math.PI) / 180;
    const handleRadius = (radius + innerRadius) / 2;
    const handleX = centerX + Math.cos(handleAngle) * handleRadius;
    const handleY = centerY + Math.sin(handleAngle) * handleRadius;

    ctx.beginPath();
    ctx.arc(handleX, handleY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // 3. Draw Inner Saturation/Value Square
    const sqX = centerX - squareSize / 2;
    const sqY = centerY - squareSize / 2;

    // Base pure hue fill
    const pureHueRgb = hsvToRgb(hsv.h, 1.0, 1.0);
    ctx.fillStyle = `rgb(${pureHueRgb.r}, ${pureHueRgb.g}, ${pureHueRgb.b})`;
    ctx.fillRect(sqX, sqY, squareSize, squareSize);

    // Horizontal White Gradient (Saturation 0 -> 1)
    const whiteGrad = ctx.createLinearGradient(sqX, sqY, sqX + squareSize, sqY);
    whiteGrad.addColorStop(0, '#ffffff');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(sqX, sqY, squareSize, squareSize);

    // Vertical Black Gradient (Value 1 -> 0)
    const blackGrad = ctx.createLinearGradient(sqX, sqY, sqX, sqY + squareSize);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, '#000000');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(sqX, sqY, squareSize, squareSize);

    // Square Border
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sqX, sqY, squareSize, squareSize);

    // 4. Draw Saturation/Value Handle in the Square
    const satValHandleX = sqX + hsv.s * squareSize;
    const satValHandleY = sqY + (1 - hsv.v) * squareSize;

    ctx.beginPath();
    ctx.arc(satValHandleX, satValHandleY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
  }, [hsv, theme, radius, innerRadius, squareSize]);

  useEffect(() => {
    if (activeTab === 'wheel') {
      renderWheel();
    }
  }, [activeTab, renderWheel]);

  // Pointer tracking for Hue Ring
  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - wheelSize / 2;
    const y = e.clientY - rect.top - wheelSize / 2;
    const dist = Math.sqrt(x * x + y * y);

    if (dist >= innerRadius - 4 && dist <= radius + 4) {
      isDraggingWheel.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateHueFromCoords(x, y);
    } else if (
      Math.abs(x) <= squareSize / 2 + 4 &&
      Math.abs(y) <= squareSize / 2 + 4
    ) {
      isDraggingSquare.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateSatValFromCoords(x, y);
    }
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - wheelSize / 2;
    const y = e.clientY - rect.top - wheelSize / 2;

    if (isDraggingWheel.current) {
      updateHueFromCoords(x, y);
    } else if (isDraggingSquare.current) {
      updateSatValFromCoords(x, y);
    }
  };

  const handlePointerUpCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingWheel.current || isDraggingSquare.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      isDraggingWheel.current = false;
      isDraggingSquare.current = false;
    }
  };

  const updateHueFromCoords = (x: number, y: number) => {
    let angle = (Math.atan2(y, x) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const nextHsv = { ...hsv, h: angle };
    setHsv(nextHsv);
    const rgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    onChangeColor(hex);
    onApplyBrushSettings?.({ color: hex });
  };

  const updateSatValFromCoords = (x: number, y: number) => {
    const s = Math.max(0, Math.min(1, (x + squareSize / 2) / squareSize));
    const v = Math.max(0, Math.min(1, 1 - (y + squareSize / 2) / squareSize));
    const nextHsv = { ...hsv, s, v };
    setHsv(nextHsv);
    const rgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    onChangeColor(hex);
    onApplyBrushSettings?.({ color: hex });
  };

  // OKLCh Slider Handler
  const handleOklchChange = (channel: 'L' | 'C' | 'h', val: number) => {
    const next = { ...oklch, [channel]: val };
    setOklch(next);
    const hex = oklchToHex({
      L: next.L,
      C: next.C,
      h: (next.h * Math.PI) / 180,
    });
    onChangeColor(hex);
    onApplyBrushSettings?.({ color: hex });
  };

  const harmonies = useMemo(() => {
    const valid = normalizeHexColor(currentColor, '#38bdf8');
    return generateHarmonies(valid);
  }, [currentColor]);

  const oklchGradientSteps = useMemo(() => {
    const valid1 = normalizeHexColor(currentColor, '#38bdf8');
    const valid2 = normalizeHexColor(secondaryColor, '#f43f5e');
    return generateOKLCHGradient(valid1, valid2, 9);
  }, [currentColor, secondaryColor]);

  const posterizedColor = useMemo(() => {
    return posterizeOKLCH(currentColor, posterizeSteps);
  }, [currentColor, posterizeSteps]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="paperrocket-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="mody-color-studio-modal"
        onClick={(e) => e.stopPropagation()}
        className={`pr-surface w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden select-none animate-in zoom-in-95 duration-150 ${
          theme === 'light'
            ? 'bg-white border-neutral-200 text-neutral-900'
            : 'bg-[#18191d] border-[#2a2d38] text-neutral-100'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            theme === 'light' ? 'border-neutral-200 bg-neutral-50' : 'border-[#252832] bg-[#111216]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-md border border-white/30 shadow-inner"
              style={{ backgroundColor: currentColor }}
            />
            <div>
              <h2 className="text-sm font-semibold tracking-wide">Color Studio (HSV & OKLCh)</h2>
              <p className="text-[11px] text-neutral-400 font-mono">{currentColor.toUpperCase()}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onSampleFromScreen && (
              <button
                onClick={onSampleFromScreen}
                className={`p-1.5 rounded-lg border transition-colors ${
                  theme === 'light'
                    ? 'border-neutral-200 hover:bg-neutral-100 text-neutral-600'
                    : 'border-[#2c2f3a] hover:bg-white/10 text-neutral-400 hover:text-white'
                }`}
                title="Sample Color from Viewport"
              >
                <Pipette className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                navigator.clipboard.writeText(currentColor);
                setCopiedHex(true);
                setTimeout(() => setCopiedHex(false), 1200);
              }}
              className={`p-1.5 rounded-lg border transition-colors ${
                theme === 'light'
                  ? 'border-neutral-200 hover:bg-neutral-100 text-neutral-600'
                  : 'border-[#2c2f3a] hover:bg-white/10 text-neutral-400 hover:text-white'
              }`}
              title="Copy Hex"
            >
              {copiedHex ? <Check className="w-4 h-4 text-neutral-700 dark:text-zinc-300" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-colors ${
                theme === 'light'
                  ? 'border-neutral-200 hover:bg-neutral-100 text-neutral-600'
                  : 'border-[#2c2f3a] hover:bg-white/10 text-neutral-400 hover:text-white'
              }`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className={`flex items-center px-4 py-2 border-b gap-1 overflow-x-auto scrollbar-none ${
            theme === 'light' ? 'border-neutral-200 bg-neutral-100' : 'border-[#252832] bg-[#111216]'
          }`}
        >
          {[
            { id: 'shaders', label: '1-Click Shaders', icon: Sparkles },
            { id: 'wheel', label: 'HSV Wheel', icon: Palette },
            { id: 'oklch', label: 'OKLCh Polar', icon: Sliders },
            { id: 'harmonies', label: 'Harmonies', icon: SunMedium },
            { id: 'gradients', label: 'Gradients', icon: Zap },
            { id: 'presets', label: 'Presets', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? theme === 'light' ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-zinc-950 shadow-sm font-bold'
                    : theme === 'light'
                    ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0 space-y-4">
          {/* TAB 0: 1-Click Shaders & MatCaps */}
          {activeTab === 'shaders' && (
            <MatCapShaderTabContent
              currentColor={currentColor}
              onChangeColor={onChangeColor}
              onApplyBrushSettings={onApplyBrushSettings}
              onApplyToModel={onApplyToModel}
              onClose={onClose}
              theme={(theme === 'light' ? 'light' : 'dark')}
            />
          )}

          {/* TAB 1: HSV Color Wheel */}
          {activeTab === 'wheel' && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center p-2 rounded-2xl bg-neutral-950/40 border border-white/5">
                <canvas
                  ref={wheelCanvasRef}
                  style={{ width: wheelSize, height: wheelSize }}
                  onPointerDown={handlePointerDownCanvas}
                  onPointerMove={handlePointerMoveCanvas}
                  onPointerUp={handlePointerUpCanvas}
                  className="cursor-crosshair touch-none"
                />
              </div>

              {/* Slider Readouts for Hue, Saturation, Value */}
              <div className={`w-full space-y-3 p-4 rounded-xl border text-xs shadow-inner ${
                isLight ? 'bg-neutral-100 border-black/10 text-neutral-900' : 'bg-[#101218] border-white/10 text-white'
              }`}>
                <div className={`flex items-center justify-between font-medium ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                  <span>Hue Angle (0°–360°)</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${isLight ? 'bg-black/5 text-neutral-900' : 'bg-white/10 text-white'}`}>{Math.round(hsv.h)}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={hsv.h}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    const nextHsv = { ...hsv, h };
                    setHsv(nextHsv);
                    const rgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
                    onChangeColor(rgbToHex(rgb.r, rgb.g, rgb.b));
                  }}
                  className="w-full accent-neutral-900 dark:accent-white h-1.5 rounded bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                />

                <div className={`flex items-center justify-between font-medium ${t.textPrimary}`}>
                  <span>Saturation (0%–100%)</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${isLight ? 'bg-black/5 text-neutral-900' : 'bg-white/10 text-white'}`}>{Math.round(hsv.s * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(hsv.s * 100)}
                  onChange={(e) => {
                    const s = Number(e.target.value) / 100;
                    const nextHsv = { ...hsv, s };
                    setHsv(nextHsv);
                    const rgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
                    onChangeColor(rgbToHex(rgb.r, rgb.g, rgb.b));
                  }}
                  className="w-full accent-neutral-900 dark:accent-white h-1.5 rounded bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                />

                <div className={`flex items-center justify-between font-medium ${t.textPrimary}`}>
                  <span>Value / Brightness (0%–100%)</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${isLight ? 'bg-black/5 text-neutral-900' : 'bg-white/10 text-white'}`}>{Math.round(hsv.v * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(hsv.v * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    const nextHsv = { ...hsv, v };
                    setHsv(nextHsv);
                    const rgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
                    onChangeColor(rgbToHex(rgb.r, rgb.g, rgb.b));
                  }}
                  className="w-full accent-neutral-900 dark:accent-white h-1.5 rounded bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 2: OKLCh Perceptual Engine */}
          {activeTab === 'oklch' && (
            <div className="space-y-4">
              <div className={`p-3.5 rounded-xl border space-y-3 ${t.innerCard}`}>
                <div className={`text-xs leading-relaxed ${t.textSecondary}`}>
                  OKLCh is a perceptually uniform polar color space that preserves uniform lightness and vivid chroma across all hue angles without gamut distortion.
                </div>

                {/* Lightness Slider */}
                <div className="space-y-1">
                  <div className={`flex justify-between text-xs ${t.textSecondary}`}>
                    <span>Perceived Lightness (L)</span>
                    <span className={`font-mono font-semibold ${t.textPrimary}`}>{(oklch.L * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={oklch.L * 100}
                    onChange={(e) => handleOklchChange('L', Number(e.target.value) / 100)}
                    className="w-full accent-neutral-900 dark:accent-white h-1.5 rounded bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                  />
                </div>

                {/* Chroma Slider */}
                <div className="space-y-1">
                  <div className={`flex justify-between text-xs ${t.textSecondary}`}>
                    <span>Chroma / Purity (C)</span>
                    <span className={`font-mono font-semibold ${t.textPrimary}`}>{oklch.C.toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.38"
                    step="0.005"
                    value={oklch.C}
                    onChange={(e) => handleOklchChange('C', Number(e.target.value))}
                    className="w-full accent-neutral-900 dark:accent-white h-1.5 rounded bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                  />
                </div>

                {/* Hue Angle Slider */}
                <div className="space-y-1">
                  <div className={`flex justify-between text-xs ${t.textSecondary}`}>
                    <span>Polar Hue Angle (h)</span>
                    <span className={`font-mono font-semibold ${t.textPrimary}`}>{Math.round(oklch.h)}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={oklch.h}
                    onChange={(e) => handleOklchChange('h', Number(e.target.value))}
                    className="w-full accent-neutral-900 dark:accent-white h-1.5 rounded bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* OKLCh Posterization Shader Preview */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${t.innerCard}`}>
                <div className="flex items-center justify-between text-xs">
                  <div className={`font-semibold ${t.textPrimary}`}>OKLCh Posterization Quantizer</div>
                  <span className={`font-mono ${t.textMuted}`}>{posterizeSteps} quantization levels</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="12"
                  value={posterizeSteps}
                  onChange={(e) => setPosterizeSteps(Number(e.target.value))}
                  className="w-full accent-neutral-900 dark:accent-white h-1.5 rounded bg-neutral-200 dark:bg-neutral-800 cursor-pointer"
                />

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 text-center">
                    <div
                      className="h-10 rounded-lg border border-white/10 shadow-inner"
                      style={{ backgroundColor: currentColor }}
                    />
                    <span className="text-[10px] text-neutral-400 font-mono mt-1 block">Continuous</span>
                  </div>

                  <div className="text-neutral-500 font-mono text-xs">➔</div>

                  <div className="flex-1 text-center">
                    <div
                      className="h-10 rounded-lg border border-white/10 shadow-inner cursor-pointer hover:ring-2 hover:ring-neutral-400 dark:ring-neutral-500 transition-all"
                      style={{ backgroundColor: posterizedColor }}
                      onClick={() => {
                        onChangeColor(posterizedColor);
                        onApplyBrushSettings?.({ color: posterizedColor });
                      }}
                      title="Click to apply posterized color"
                    />
                    <span className="text-[10px] text-neutral-700 dark:text-zinc-300 font-mono mt-1 block">
                      {posterizedColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OKLCh Color Harmonies */}
          {activeTab === 'harmonies' && (
            <div className="space-y-4">
              {Object.entries(harmonies).map(([schemeName, colors]) => {
                if (schemeName === 'base' || !Array.isArray(colors)) return null;
                const colorList = colors as string[];
                return (
                  <div key={schemeName} className="p-3 rounded-xl bg-neutral-950/40 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-200 capitalize">{schemeName}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">OKLCh Polar Balanced</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {colorList.map((c, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            onChangeColor(c);
                            onApplyBrushSettings?.({ color: c });
                          }}
                          className={`h-10 rounded-lg border transition-all active:scale-95 hover:scale-105 ${
                            c.toLowerCase() === currentColor.toLowerCase()
                              ? 'ring-2 ring-neutral-400 dark:ring-neutral-500 border-white'
                              : 'border-white/10'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: OKLCh Gradients vs sRGB Comparison */}
          {activeTab === 'gradients' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-neutral-950/40 border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-300">
                  <span>Blend Target Secondary Color:</span>
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-neutral-200">OKLCh Perceptual Gradient (No Mid-Gray Dead Zone)</div>
                  <div className="grid grid-cols-9 gap-1 h-9">
                    {oklchGradientSteps.map((c, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onChangeColor(c);
                          onApplyBrushSettings?.({ color: c });
                        }}
                        className="rounded-md border border-white/10 hover:scale-105 transition-transform cursor-pointer"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Curated Architectural & Digital Palettes */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              {Object.entries(CURATED_PALETTES).map(([paletteName, colors]) => (
                <div key={paletteName} className="p-3.5 rounded-xl bg-neutral-950/40 border border-white/5 space-y-2">
                  <div className="text-xs font-semibold text-neutral-200">{paletteName}</div>
                  <div className="grid grid-cols-7 gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          onChangeColor(c);
                          onApplyBrushSettings?.({ color: c });
                        }}
                        className={`h-8 rounded-lg border transition-all active:scale-95 hover:scale-105 cursor-pointer ${
                          c.toLowerCase() === currentColor.toLowerCase()
                            ? 'ring-2 ring-neutral-400 dark:ring-neutral-500 border-white'
                            : 'border-white/10'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Swatches & Hex Input */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-t text-xs ${
            theme === 'light' ? 'border-neutral-200 bg-neutral-50' : 'border-[#252832] bg-[#12141a]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-mono">Hex:</span>
            <input
              type="text"
              value={currentColor}
              onChange={(e) => {
                if (e.target.value.startsWith('#')) {
                  onChangeColor(e.target.value);
                  onApplyBrushSettings?.({ color: e.target.value });
                }
              }}
              className={`w-24 px-2 py-1 rounded-lg font-mono text-center border ${
                theme === 'light'
                  ? 'bg-white border-neutral-300 text-neutral-900'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-100'
              }`}
            />
          </div>

          <button
            onClick={() => {
              if (activeTab === 'shaders') {
                // Shader tab already applied shader to brush via callbacks; synchronize color and close
                onChangeColor(currentColor);
                onClose();
              } else {
                onChangeColor(currentColor);
                onApplyBrushSettings?.({ color: currentColor });
                onClose();
              }
            }}
            className={`px-4 py-1.5 rounded-xl ${isLight ? 'bg-neutral-900 text-white hover:bg-black' : 'bg-white text-zinc-950 hover:bg-neutral-100'} font-semibold transition-colors shadow-sm cursor-pointer`}
          >
            {activeTab === 'shaders' ? 'Done' : 'Apply Color'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
