import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import {
  Box,
  Check,
  ChevronDown,
  Copy,
  Layers,
  Paintbrush,
  Palette,
  Pipette,
  Sliders,
  Sparkles,
  SunMedium,
  X,
  Zap,
} from 'lucide-react';
import {
  generateHarmonies,
  generateOKLCHGradient,
  hexToOklch,
  hexToRgb,
  hsvToRgb,
  oklchToHex,
  posterizeOKLCH,
  rgbToHex,
  rgbToHsv,
} from '../core/colorMath';
import { normalizeHexColor } from '../core/materialCache';
import { ALL_MATERIAL_PRESETS, PRESET_CATEGORIES } from '../presets/materialPresets';
import { BrushSettings } from '../types';
import { MenuSegmentedToggle, getMenuSurfaceClasses } from './ui/MenuPrimitives';

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

type TabType = 'wheel' | 'oklch' | 'harmonies' | 'shaders' | 'gradients';
type HarmonyMode =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'tetradic'
  | 'splitComplementary'
  | 'monochromaticRamp'
  | 'tonalChromaRamp';

const WHEEL_SIZE = 176;
const RING_WIDTH = 18;
const CURATED_PALETTES = {
  'Drafting Neon': ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#34d399', '#facc15'],
  'Clay & Terracotta': ['#b45309', '#d97706', '#f59e0b', '#78350f', '#92400e', '#ea580c', '#c2410c'],
  'Nordic Architecture': ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#f8fafc'],
  'Cyberpunk Synth': ['#06b6d4', '#ec4899', '#8b5cf6', '#10b981', '#f43f5e', '#a855f7', '#3b82f6'],
  'Monochrome & Ink': ['#000000', '#18181b', '#27272a', '#52525b', '#71717a', '#a1a1aa', '#ffffff'],
};
const QUICK_SHADER_NAMES = [
  'Flat Graphic White',
  'Toon Classic 2-Tone',
  'Crystal Clear Glass',
  'Prism Rainbow Glass',
  'Summer Ocean Water',
  'Polished Gold Ingot',
  'Burnished Copper',
  'Electric Neon Cyan',
  'Hot Molten Lava',
  'Toon Manga Ink & White',
];
const QUICK_SHADER_LABELS = ['Clay', 'Toon', 'Gloss', 'Prism', 'Water', 'Metal', 'Copper', 'Glow', 'Lava', 'Ink'];
const DEFAULT_VERTEX_SHADER = `
precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;
void main() {
  v_normal = normalize(normalMatrix * normal);
  v_uv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

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
  const [activeTab, setActiveTab] = useState<TabType>('wheel');
  const [copiedHex, setCopiedHex] = useState(false);
  const [secondaryColor, setSecondaryColor] = useState('#f43f5e');
  const [hsv, setHsv] = useState({ h: 200, s: 0.8, v: 0.9 });
  const [oklch, setOklch] = useState({ L: 0.7, C: 0.15, h: 220 });
  const [posterizeSteps, setPosterizeSteps] = useState(4);
  const [showPosterize, setShowPosterize] = useState(false);
  const [showPalettes, setShowPalettes] = useState(false);
  const [paletteName, setPaletteName] = useState<keyof typeof CURATED_PALETTES>('Drafting Neon');
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('analogous');
  const [showAllShaders, setShowAllShaders] = useState(false);
  const [shaderTarget, setShaderTarget] = useState<'brush' | 'model'>('brush');
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingWheel = useRef(false);
  const draggingSquare = useRef(false);

  const quickPresets = useMemo(() => {
    const named = QUICK_SHADER_NAMES.map((name) =>
      ALL_MATERIAL_PRESETS.find((preset) => preset.name === name),
    ).filter(Boolean) as any[];
    return named.length === QUICK_SHADER_NAMES.length ? named : ALL_MATERIAL_PRESETS.slice(0, 10);
  }, []);
  const [selectedPresetId, setSelectedPresetId] = useState(() => quickPresets[0]?.id ?? '');
  const [shaderCategory, setShaderCategory] = useState<string>('All');
  const [shaderSearch, setShaderSearch] = useState<string>('');
  const [shaderRoughness, setShaderRoughness] = useState<number>(0.5);
  const [shaderMetalness, setShaderMetalness] = useState<number>(0.1);
  const [shaderRimPower, setShaderRimPower] = useState<number>(0.8);

  const filteredPresets = useMemo(() => {
    return (ALL_MATERIAL_PRESETS as any[]).filter((preset: any) => {
      const matchCategory = shaderCategory === 'All' || preset.category === shaderCategory;
      const matchSearch = !shaderSearch.trim() || preset.name?.toLowerCase().includes(shaderSearch.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [shaderCategory, shaderSearch]);

  const handleUniformChange = (type: 'roughness' | 'metalness' | 'rim', value: number) => {
    if (type === 'roughness') {
      setShaderRoughness(value);
      onApplyBrushSettings?.({ roughness: value });
    } else if (type === 'metalness') {
      setShaderMetalness(value);
      onApplyBrushSettings?.({ metalness: value });
    } else if (type === 'rim') {
      setShaderRimPower(value);
      onApplyBrushSettings?.({ emissiveIntensity: value });
    }
  };

  useEffect(() => {
    const validHex = normalizeHexColor(currentColor, '#38bdf8');
    const rgb = hexToRgb(validHex);
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    const rawOklch = hexToOklch(validHex);
    setOklch({ L: rawOklch.L, C: rawOklch.C, h: Math.round((rawOklch.h * 180) / Math.PI) });
  }, [currentColor]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const applyColor = useCallback((hex: string) => {
    onChangeColor(hex);
    onApplyBrushSettings?.({ color: hex });
  }, [onApplyBrushSettings, onChangeColor]);

  const applyHsv = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const rgb = hsvToRgb(next.h, next.s, next.v);
    applyColor(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  const radius = WHEEL_SIZE / 2;
  const innerRadius = radius - RING_WIDTH;
  const squareSize = innerRadius * Math.SQRT2 - 12;
  const renderWheel = useCallback(() => {
    const canvas = wheelCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WHEEL_SIZE * dpr;
    canvas.height = WHEEL_SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE);
    const center = WHEEL_SIZE / 2;
    for (let i = 0; i < 360; i += 1) {
      const angle1 = ((i - 0.5) * Math.PI) / 180;
      const angle2 = ((i + 0.5) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(center, center, radius - 2, angle1, angle2);
      ctx.arc(center, center, innerRadius + 2, angle2, angle1, true);
      ctx.closePath();
      const rgb = hsvToRgb(i, 1, 1);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fill();
    }
    const hueAngle = (hsv.h * Math.PI) / 180;
    const handleRadius = (radius + innerRadius) / 2;
    ctx.beginPath();
    ctx.arc(center + Math.cos(hueAngle) * handleRadius, center + Math.sin(hueAngle) * handleRadius, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#08090b';
    ctx.stroke();
    const sqX = center - squareSize / 2;
    const sqY = center - squareSize / 2;
    const pureHue = hsvToRgb(hsv.h, 1, 1);
    ctx.fillStyle = `rgb(${pureHue.r}, ${pureHue.g}, ${pureHue.b})`;
    ctx.fillRect(sqX, sqY, squareSize, squareSize);
    const white = ctx.createLinearGradient(sqX, sqY, sqX + squareSize, sqY);
    white.addColorStop(0, '#fff');
    white.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = white;
    ctx.fillRect(sqX, sqY, squareSize, squareSize);
    const black = ctx.createLinearGradient(sqX, sqY, sqX, sqY + squareSize);
    black.addColorStop(0, 'rgba(0,0,0,0)');
    black.addColorStop(1, '#000');
    ctx.fillStyle = black;
    ctx.fillRect(sqX, sqY, squareSize, squareSize);
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.22)';
    ctx.strokeRect(sqX, sqY, squareSize, squareSize);
    ctx.beginPath();
    ctx.arc(sqX + hsv.s * squareSize, sqY + (1 - hsv.v) * squareSize, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#08090b';
    ctx.stroke();
  }, [hsv, innerRadius, isLight, radius, squareSize]);

  useEffect(() => {
    if (isOpen && activeTab === 'wheel') renderWheel();
  }, [activeTab, isOpen, renderWheel]);

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * WHEEL_SIZE) / rect.width - WHEEL_SIZE / 2,
      y: ((event.clientY - rect.top) * WHEEL_SIZE) / rect.height - WHEEL_SIZE / 2,
    };
  };
  const updateHue = (x: number, y: number) => {
    let angle = (Math.atan2(y, x) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    applyHsv({ ...hsv, h: angle });
  };
  const updateSatVal = (x: number, y: number) => applyHsv({
    ...hsv,
    s: Math.max(0, Math.min(1, (x + squareSize / 2) / squareSize)),
    v: Math.max(0, Math.min(1, 1 - (y + squareSize / 2) / squareSize)),
  });
  const handleWheelPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pointerPosition(event);
    const distance = Math.hypot(x, y);
    if (distance >= innerRadius - 4 && distance <= radius + 4) {
      draggingWheel.current = true;
      updateHue(x, y);
    } else if (Math.abs(x) <= squareSize / 2 + 4 && Math.abs(y) <= squareSize / 2 + 4) {
      draggingSquare.current = true;
      updateSatVal(x, y);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleWheelPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingWheel.current && !draggingSquare.current) return;
    const { x, y } = pointerPosition(event);
    if (draggingWheel.current) updateHue(x, y);
    if (draggingSquare.current) updateSatVal(x, y);
  };
  const handleWheelPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    draggingWheel.current = false;
    draggingSquare.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleOklchChange = (channel: 'L' | 'C' | 'h', value: number) => {
    const next = { ...oklch, [channel]: value };
    setOklch(next);
    applyColor(oklchToHex({ L: next.L, C: next.C, h: (next.h * Math.PI) / 180 }));
  };

  const harmonies = useMemo(() => generateHarmonies(normalizeHexColor(currentColor, '#38bdf8')), [currentColor]);
  const harmonyColors = harmonies[harmonyMode];
  const gradient = useMemo(() => generateOKLCHGradient(
    normalizeHexColor(currentColor, '#38bdf8'),
    normalizeHexColor(secondaryColor, '#f43f5e'),
    9,
  ), [currentColor, secondaryColor]);
  const posterizedColor = useMemo(() => posterizeOKLCH(currentColor, posterizeSteps), [currentColor, posterizeSteps]);
  const recentColors = useMemo(() => Array.from(new Set([
    normalizeHexColor(currentColor, '#38bdf8'),
    ...CURATED_PALETTES['Drafting Neon'],
  ])).slice(0, 6), [currentColor]);

  const applyPreset = (preset: any) => {
    if (!preset) return;
    setSelectedPresetId(preset.id);
    if (preset.type === 'shader') {
      if (shaderTarget === 'brush') {
        onApplyBrushSettings?.({
          materialType: 'animated_fx',
          shaderEffect: 'anime_cel',
          customShader: { id: preset.id, name: preset.name, vertexShader: preset.vertexShader, fragmentShader: preset.fragmentShader },
          color: currentColor,
        });
      } else if (onApplyToModel) {
        onApplyToModel(new THREE.ShaderMaterial({
          vertexShader: preset.vertexShader || DEFAULT_VERTEX_SHADER,
          fragmentShader: preset.fragmentShader,
          uniforms: {
            u_time: { value: 0 }, time: { value: 0 }, iTime: { value: 0 }, uTime: { value: 0 },
            u_resolution: { value: new THREE.Vector2(512, 512) },
            resolution: { value: new THREE.Vector2(512, 512) },
            iResolution: { value: new THREE.Vector3(512, 512, 1) },
            u_mouse: { value: new THREE.Vector2(0, 0) }, iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
            uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
          },
          transparent: true,
          side: THREE.DoubleSide,
        }));
      }
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0, 512, 512);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      try {
        const pixel = context.getImageData(256, 256, 1, 1).data;
        applyColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
      } catch {
        // The material still applies when a remote image does not allow sampling.
      }
      if (shaderTarget === 'brush') {
        onApplyBrushSettings?.({ materialType: 'matcap', matcapUrl: preset.url, matcapTexture: texture, color: currentColor });
      } else {
        onApplyToModel?.(new THREE.MeshMatcapMaterial({ matcap: texture, color: 0xffffff }));
      }
    };
    image.src = preset.url;
  };

  if (!isOpen) return null;

  const tabs: Array<{ id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'wheel', label: 'Color', icon: Palette },
    { id: 'oklch', label: 'OKLCh', icon: Sliders },
    { id: 'harmonies', label: 'Harmony', icon: SunMedium },
    { id: 'shaders', label: 'Shader', icon: Sparkles },
    { id: 'gradients', label: 'Gradient', icon: Zap },
  ];
  const activeTitle = tabs.find((tab) => tab.id === activeTab)?.label ?? 'Color';
  const shell = isLight
    ? 'bg-[#FAF9F5] border-black/15 text-neutral-900 shadow-[0_20px_55px_rgba(35,28,20,.18)]'
    : 'bg-[#14161a]/95 border-white/15 text-neutral-100 shadow-[0_24px_70px_rgba(0,0,0,.55)]';
  const quietText = isLight ? 'text-neutral-600' : 'text-neutral-400';
  const divider = isLight ? 'border-black/10' : 'border-white/10';
  const ghostButton = isLight ? 'text-neutral-700 hover:text-neutral-950 hover:bg-black/5' : 'text-neutral-400 hover:text-white hover:bg-white/5';
  const field = isLight ? 'border-black/15 bg-white text-neutral-900 shadow-xs' : 'border-white/15 bg-black/15 text-neutral-100';
  const slider = (label: string, valueLabel: string, input: React.ReactNode) => (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-[11px] font-semibold">
        <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>{label}</span>
        <span className={`font-mono font-bold ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>{valueLabel}</span>
      </span>
      {input}
    </label>
  );

  return createPortal(
    <div className="paperrocket-modal-overlay fixed inset-0 z-50" onPointerDown={onClose}>
      <section
        id="mody-color-studio-modal"
        data-theme={theme}
        aria-label="Color studio"
        onPointerDown={(event) => event.stopPropagation()}
        className={`paperrocket-color-studio fixed bottom-3 left-3 sm:bottom-16 sm:left-[clamp(76px,8vw,136px)] flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[580px] flex-col overflow-hidden rounded-[16px] border select-none ${shell}`}
      >
        <header className={`flex min-h-14 items-center justify-between border-b px-3 ${divider}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`h-9 w-9 shrink-0 rounded-lg border ${isLight ? 'border-black/20' : 'border-white/20'}`} style={{ backgroundColor: currentColor }} />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{activeTitle}</h2>
              <input
                aria-label="Hex color"
                value={currentColor.toUpperCase()}
                onChange={(event) => {
                  const next = event.target.value;
                  if (/^#[0-9a-fA-F]{6}$/.test(next)) applyColor(next);
                  else onChangeColor(next);
                }}
                className={`mt-0.5 w-24 border-0 bg-transparent p-0 font-mono text-[11px] font-bold outline-none ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}
              />
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {onSampleFromScreen && <button type="button" onClick={onSampleFromScreen} className={`grid h-11 w-11 place-items-center rounded-xl ${ghostButton}`} aria-label="Sample color"><Pipette className="h-4 w-4" /></button>}
            <button type="button" onClick={() => { navigator.clipboard.writeText(currentColor); setCopiedHex(true); window.setTimeout(() => setCopiedHex(false), 1200); }} className={`grid h-11 w-11 place-items-center rounded-xl ${ghostButton}`} aria-label="Copy hex">
              {copiedHex ? <Check className="h-4 w-4 text-neutral-900 dark:text-white" /> : <Copy className="h-4 w-4" />}
            </button>
            <button type="button" onClick={onClose} className={`grid h-11 w-11 place-items-center rounded-xl ${ghostButton}`} aria-label="Close color studio"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto studio-scroll px-3 py-3">
          {activeTab === 'wheel' && <div className="grid gap-3 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-start">
            <div className="flex justify-center sm:pt-1"><canvas ref={wheelCanvasRef} style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }} onPointerDown={handleWheelPointerDown} onPointerMove={handleWheelPointerMove} onPointerUp={handleWheelPointerUp} onPointerCancel={handleWheelPointerUp} className="touch-none cursor-crosshair" /></div>
            <div className="space-y-3 min-w-0">
              {slider('Saturation', `${Math.round(hsv.s * 100)}%`, <input type="range" min="0" max="100" value={Math.round(hsv.s * 100)} onChange={(event) => applyHsv({ ...hsv, s: Number(event.target.value) / 100 })} className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`} />)}
              {slider('Lightness', `${Math.round(hsv.v * 100)}%`, <input type="range" min="0" max="100" value={Math.round(hsv.v * 100)} onChange={(event) => applyHsv({ ...hsv, v: Number(event.target.value) / 100 })} className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`} />)}
              <div>
                <div className={`mb-1.5 text-[10px] font-bold uppercase tracking-[.14em] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>Recent</div>
                <div className="grid grid-cols-6 gap-1.5">{recentColors.map((color) => <button key={color} type="button" onClick={() => applyColor(color)} aria-label={`Use ${color}`} className={`aspect-square min-h-0 w-full rounded-lg border ${color.toLowerCase() === currentColor.toLowerCase() ? 'border-neutral-900 ring-2 ring-neutral-900/35 dark:border-white dark:ring-white/35' : isLight ? 'border-black/15' : 'border-white/15'}`} style={{ backgroundColor: color }} />)}</div>
              </div>
              <button type="button" onClick={() => setShowPalettes((shown) => !shown)} className={`flex h-10 w-full items-center justify-between border-t text-xs font-semibold ${divider} ${ghostButton}`}><span className="flex items-center gap-2"><Layers className="h-4 w-4" /> Palettes</span><ChevronDown className={`h-4 w-4 ${showPalettes ? 'rotate-180' : ''}`} /></button>
            </div>
            {showPalettes && <div className="space-y-2 pb-1 sm:col-span-2">
              <select value={paletteName} onChange={(event) => setPaletteName(event.target.value as keyof typeof CURATED_PALETTES)} className={`h-11 w-full rounded-xl border px-3 text-xs outline-none ${field}`}>{Object.keys(CURATED_PALETTES).map((name) => <option key={name}>{name}</option>)}</select>
              <div className="grid grid-cols-7 gap-1.5">{CURATED_PALETTES[paletteName].map((color) => <button key={color} type="button" onClick={() => applyColor(color)} className={`h-10 rounded-lg border ${isLight ? 'border-black/15' : 'border-white/15'}`} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />)}</div>
            </div>}
          </div>}

          {activeTab === 'oklch' && <div className="space-y-5 py-1">
            {slider('Lightness', `${(oklch.L * 100).toFixed(1)}%`, <input type="range" min="0" max="100" step="0.5" value={oklch.L * 100} onChange={(event) => handleOklchChange('L', Number(event.target.value) / 100)} className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`} />)}
            {slider('Chroma', oklch.C.toFixed(3), <input type="range" min="0" max="0.38" step="0.005" value={oklch.C} onChange={(event) => handleOklchChange('C', Number(event.target.value))} className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`} />)}
            {slider('Hue', `${Math.round(oklch.h)}°`, <input type="range" min="0" max="359" value={oklch.h} onChange={(event) => handleOklchChange('h', Number(event.target.value))} className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`} />)}
            <button type="button" onClick={() => setShowPosterize((shown) => !shown)} className={`flex h-11 w-full items-center justify-between border-t text-xs font-semibold ${divider} ${ghostButton}`}><span>Posterize</span><ChevronDown className={`h-4 w-4 ${showPosterize ? 'rotate-180' : ''}`} /></button>
            {showPosterize && <div className="space-y-3">
              {slider('Steps', String(posterizeSteps), <input type="range" min="2" max="12" value={posterizeSteps} onChange={(event) => setPosterizeSteps(Number(event.target.value))} className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`} />)}
              <button type="button" onClick={() => applyColor(posterizedColor)} className={`flex h-11 w-full items-center justify-between rounded-xl border px-3 ${field}`}><span className="text-xs font-semibold">Use posterized color</span><span className="flex items-center gap-2 font-mono text-[10px] font-bold">{posterizedColor.toUpperCase()}<span className={`h-7 w-7 rounded-lg border ${isLight ? 'border-black/15' : 'border-white/15'}`} style={{ backgroundColor: posterizedColor }} /></span></button>
            </div>}
          </div>}

          {activeTab === 'harmonies' && <div className="space-y-4 py-1">
            <div className={`grid grid-cols-3 border-b ${divider}`}>{([['complementary', 'Complement'], ['analogous', 'Analogous'], ['triadic', 'Triad']] as Array<[HarmonyMode, string]>).map(([mode, label]) => <button key={mode} type="button" onClick={() => setHarmonyMode(mode)} className={`h-11 border-b-2 text-[11px] font-semibold ${harmonyMode === mode ? (isLight ? 'border-neutral-900 text-neutral-950 font-bold' : 'border-white text-white font-bold') : `border-transparent ${ghostButton}`}`}>{label}</button>)}</div>
            <div className="grid min-h-20 gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(harmonyColors.length, 7)}, minmax(0, 1fr))` }}>{harmonyColors.slice(0, 7).map((color, index) => <button key={`${color}-${index}`} type="button" onClick={() => applyColor(color)} className={`min-h-20 rounded-xl border ${color.toLowerCase() === currentColor.toLowerCase() ? 'border-neutral-900 ring-2 ring-neutral-900/35 dark:border-white dark:ring-white/35' : isLight ? 'border-black/15' : 'border-white/15'}`} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />)}</div>
            <select value={harmonyMode} onChange={(event) => setHarmonyMode(event.target.value as HarmonyMode)} className={`h-11 w-full rounded-xl border px-3 text-xs outline-none ${field}`} aria-label="Harmony mode"><option value="complementary">Complementary</option><option value="analogous">Analogous</option><option value="triadic">Triadic</option><option value="tetradic">Tetradic</option><option value="splitComplementary">Split complementary</option><option value="monochromaticRamp">Monochromatic ramp</option><option value="tonalChromaRamp">Tonal chroma ramp</option></select>
          </div>}

          {activeTab === 'shaders' && (
            <div className="space-y-3 py-1">
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {quickPresets.map((preset, index) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl p-1.5 border transition-all active:scale-95 ${
                      selectedPresetId === preset.id
                        ? isLight
                          ? 'border-neutral-900 bg-black/10 text-neutral-950 font-bold'
                          : 'border-white bg-white/15 text-white font-bold'
                        : `border-transparent ${ghostButton}`
                    }`}
                    title={preset.name}
                  >
                    <span
                      className={`block h-10 w-10 sm:h-11 sm:w-11 overflow-hidden rounded-full border shadow-sm ${
                        selectedPresetId === preset.id
                          ? 'border-neutral-900 ring-2 ring-neutral-900/25 dark:border-white dark:ring-white/25'
                          : isLight ? 'border-black/15' : 'border-white/15'
                      }`}
                    >
                      <img src={preset.url} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="text-[10px] truncate max-w-full font-medium">{QUICK_SHADER_LABELS[index] ?? preset.name}</span>
                  </button>
                ))}
              </div>

              {/* Unified Segmented Target Selector with Icons */}
              <MenuSegmentedToggle
                theme={isLight ? 'light' : 'dark'}
                value={shaderTarget}
                onChange={(t) => setShaderTarget(t as 'brush' | 'model')}
                options={[
                  { id: 'brush', label: 'Brush', icon: Paintbrush, title: 'Apply to active brush' },
                  { id: 'model', label: 'Model', icon: Box, disabled: !onApplyToModel, title: 'Apply to 3D model' },
                ]}
              />

              <button
                type="button"
                onClick={() => setShowAllShaders((shown) => !shown)}
                className={`flex h-11 w-full items-center justify-between border-t text-xs font-semibold ${divider} ${ghostButton}`}
              >
                <span>{showAllShaders ? 'Hide shader gallery' : 'Visual shader gallery & controls'}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAllShaders ? 'rotate-180' : ''}`} />
              </button>

              {showAllShaders && (
                <div className="space-y-3 pt-1">
                  {/* Category & Search filter */}
                  <div className="flex items-center gap-2">
                    <select
                      value={shaderCategory}
                      onChange={(e) => setShaderCategory(e.target.value)}
                      className={`h-10 flex-1 rounded-xl border px-3 text-xs outline-none ${field}`}
                      aria-label="Shader category"
                    >
                      {PRESET_CATEGORIES.map((cat: string) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Search…"
                      value={shaderSearch}
                      onChange={(e) => setShaderSearch(e.target.value)}
                      className={`h-10 w-28 rounded-xl border px-3 text-xs outline-none ${field}`}
                      aria-label="Search shaders"
                    />
                  </div>

                  {/* Visual Thumbnail Grid */}
                  <div className={`grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto studio-scroll p-1.5 rounded-xl border ${divider}`}>
                    {filteredPresets.map((preset: any) => {
                      const isSelected = selectedPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer text-left ${
                            isSelected
                              ? isLight
                                ? 'border-neutral-900 bg-black/10 text-neutral-950 ring-2 ring-neutral-900/30 font-bold'
                                : 'border-white bg-white/15 text-white ring-2 ring-white/30 font-bold'
                              : isLight
                              ? 'border-transparent hover:border-black/10 hover:bg-black/5 text-neutral-800'
                              : `border-transparent hover:border-white/20 hover:bg-white/5 ${ghostButton}`
                          }`}
                          title={preset.name}
                        >
                          <span
                            className={`block h-12 w-12 shrink-0 overflow-hidden rounded-full border shadow-sm ${
                              isSelected
                                ? 'border-neutral-900 ring-2 ring-neutral-900/40 dark:border-white dark:ring-white/40'
                                : isLight ? 'border-black/15' : 'border-white/20'
                            }`}
                          >
                            <img
                              src={preset.url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </span>
                          <span className="text-[10px] font-medium text-center line-clamp-1 w-full leading-tight">
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                    {filteredPresets.length === 0 && (
                      <div className={`col-span-full py-8 text-center text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        No shaders found matching your criteria.
                      </div>
                    )}
                  </div>

                  {/* Shader Uniform Controls */}
                  <div className={`p-3 rounded-xl border space-y-2.5 ${isLight ? 'bg-black/[0.03] border-black/10' : 'bg-white/[0.02] border-white/10'}`}>
                    <div className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-neutral-700' : 'text-neutral-400'}`}>
                      Shader Uniforms
                    </div>
                    <div className="space-y-2.5">
                      {slider('Roughness', `${Math.round(shaderRoughness * 100)}%`, (
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(shaderRoughness * 100)}
                          onChange={(e) => handleUniformChange('roughness', Number(e.target.value) / 100)}
                          className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`}
                        />
                      ))}
                      {slider('Metalness', `${Math.round(shaderMetalness * 100)}%`, (
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(shaderMetalness * 100)}
                          onChange={(e) => handleUniformChange('metalness', Number(e.target.value) / 100)}
                          className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`}
                        />
                      ))}
                      {slider('Glow / Rim Power', `${shaderRimPower.toFixed(2)}`, (
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={Math.round(shaderRimPower * 100)}
                          onChange={(e) => handleUniformChange('rim', Number(e.target.value) / 100)}
                          className={`h-2 w-full rounded-full cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-black/10' : 'bg-white/15'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'gradients' && <div className="space-y-4 py-1">
            <div className="flex items-center justify-between"><span className={`text-xs font-semibold ${isLight ? 'text-neutral-700' : quietText}`}>Target color</span><label className={`flex h-11 items-center gap-2 rounded-xl border px-2 ${field}`}><input type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} className="h-8 w-8 cursor-pointer border-0 bg-transparent" aria-label="Gradient target color" /><span className="font-mono text-[10px] font-bold">{secondaryColor.toUpperCase()}</span></label></div>
            <div className={`grid h-20 grid-cols-9 overflow-hidden rounded-xl border ${isLight ? 'border-black/15' : 'border-white/15'}`}>{gradient.map((color, index) => <button key={`${color}-${index}`} type="button" onClick={() => applyColor(color)} style={{ backgroundColor: color }} className="h-full" aria-label={`Use gradient color ${color}`} />)}</div>
            <div className="flex items-center justify-between text-[10px] font-mono font-bold"><span>{normalizeHexColor(currentColor, '#38bdf8').toUpperCase()}</span><span className={isLight ? 'text-neutral-600 font-semibold' : quietText}>OKLCh blend</span><span>{secondaryColor.toUpperCase()}</span></div>
          </div>}
        </div>

        <nav className={`grid grid-cols-5 border-t px-1 py-1 ${divider}`} aria-label="Color modes">{tabs.map((tab) => { const Icon = tab.icon; const selected = activeTab === tab.id; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-medium transition-all ${selected ? (isLight ? 'bg-black/10 text-neutral-950 font-bold' : 'bg-white/15 text-white font-bold') : ghostButton}`} aria-current={selected ? 'page' : undefined}><Icon className="h-4 w-4" /><span>{tab.label}</span></button>; })}</nav>
      </section>
    </div>,
    document.body,
  );
};
