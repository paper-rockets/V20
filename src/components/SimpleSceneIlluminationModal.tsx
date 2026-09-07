import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { StudioCloseButton } from './common/StudioCloseButton';
import { StudioEngine } from '../core/studioEngine';
import { haptics } from '../utils/haptics';

interface SimpleSceneIlluminationModalProps {
  engine: StudioEngine | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenSkybox?: () => void;
  theme?: 'light' | 'dark';
}

interface ToneOption {
  name: string;
  color: string;
  bgClass: string;
}

const TONES: ToneOption[] = [
  { name: 'Warm', color: '#ffecd0', bgClass: 'bg-[#ffecd0]' },
  { name: 'White', color: '#ffffff', bgClass: 'bg-[#ffffff]' },
  { name: 'Cool', color: '#7da4d9', bgClass: 'bg-[#7da4d9]' },
  { name: 'Golden', color: '#f59e0b', bgClass: 'bg-[#f59e0b]' },
];

export const SimpleSceneIlluminationModal: React.FC<SimpleSceneIlluminationModalProps> = ({
  engine,
  isOpen,
  onClose,
  onOpenSkybox,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  // Live Light State initialized from persistent engine lighting state
  const initialEngineState = engine?.getStudioLightingState?.();
  const [activePreset, setActivePreset] = useState<'studio' | 'north' | 'softbox' | 'silhouette'>(
    () => initialEngineState?.mode || 'studio'
  );
  const [intensity, setIntensity] = useState<number>(() => initialEngineState?.intensity ?? 1.6);
  const [softness, setSoftness] = useState<number>(() => initialEngineState?.softness ?? 0.65);
  const [lightColor, setLightColor] = useState<string>(() => initialEngineState?.color || '#fff6ea');
  const [modelMode, setModelMode] = useState<'clay' | 'texture'>(() => {
    return (engine?.getModelDisplayMode?.() as 'clay' | 'texture') || 'clay';
  });
  const [shadowFloor, setShadowFloor] = useState<boolean>(() => initialEngineState?.shadowFloor ?? true);
  const [showGrid, setShowGrid] = useState<boolean>(() => initialEngineState?.showGrid ?? false);

  // Floating Panel Drag State
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingHeader = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });

  // Trackball Dome State & Refs
  const domeRef = useRef<HTMLDivElement | null>(null);
  const isDraggingDome = useRef<boolean>(false);
  // Puck position in px relative to dome center (default top-right key light)
  const [puckPos, setPuckPos] = useState<{ x: number; y: number }>(() => {
    const dir = initialEngineState?.direction || { x: 0.5, y: 0.8, z: 0.55 };
    const radius = 54;
    return { x: dir.x * radius * 0.7, y: -dir.y * radius * 0.7 };
  });
  const lightDirRef = useRef<{ x: number; y: number; z: number }>(
    initialEngineState?.direction || { x: 0.5, y: 0.8, z: 0.55 }
  );

  // Apply light adjustments immediately to 3D scene
  const applyLighting = useCallback(
    (opts: {
      preset?: 'studio' | 'north' | 'softbox' | 'silhouette';
      intensity?: number;
      softness?: number;
      color?: string;
      dir?: { x: number; y: number; z: number };
      shadowFloor?: boolean;
      showGrid?: boolean;
      modelMode?: 'clay' | 'texture';
    }) => {
      if (!engine) return;

      if (opts.preset !== undefined) {
        engine.setStudioLightingMode(opts.preset);
      }
      if (opts.intensity !== undefined) {
        engine.setStudioLightIntensity(opts.intensity);
      }
      if (opts.color !== undefined) {
        engine.setStudioLightColor(opts.color);
      }
      if (opts.softness !== undefined) {
        engine.setStudioSoftness(opts.softness);
      }
      if (opts.dir !== undefined) {
        engine.setStudioLightDirection(opts.dir);
      }
      if (opts.shadowFloor !== undefined) {
        engine.setStudioFloorShadow(opts.shadowFloor);
      }
      if (opts.showGrid !== undefined) {
        engine.setStudioGridVisible(opts.showGrid);
      }
      if (opts.modelMode !== undefined) {
        engine.setModelDisplayMode(opts.modelMode);
      }
      engine.markDirty();
    },
    [engine]
  );

  // Sync with persistent engine lighting state when opened
  useEffect(() => {
    if (isOpen && engine) {
      const state = engine.getStudioLightingState?.();
      if (state) {
        setActivePreset(state.mode);
        setIntensity(state.intensity);
        setSoftness(state.softness);
        setLightColor(state.color);
        setShadowFloor(state.shadowFloor);
        setShowGrid(state.showGrid);
        lightDirRef.current = { ...state.direction };
        const radius = 54;
        setPuckPos({ x: state.direction.x * radius * 0.7, y: -state.direction.y * radius * 0.7 });
      }
      const currentModelMode = (engine.getModelDisplayMode?.() as 'clay' | 'texture') || 'clay';
      setModelMode(currentModelMode);
    }
  }, [isOpen, engine]);

  // Trackball pointer calculations
  const updateLightFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!domeRef.current || !engine) return;
      const rect = domeRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = rect.width / 2 - 8;

      const rawDx = (clientX - cx) / radius;
      const rawDy = (clientY - cy) / radius;
      const distSq = rawDx * rawDx + rawDy * rawDy;

      let x = rawDx;
      let z = rawDy;
      let y = 0.2;

      if (distSq <= 1.0) {
        y = Math.sqrt(Math.max(0.04, 1.0 - distSq));
      } else {
        const len = Math.sqrt(distSq);
        x /= len;
        z /= len;
        y = 0.15;
      }

      setPuckPos({ x: x * radius, y: z * radius });
      lightDirRef.current = { x, y, z };

      applyLighting({
        intensity,
        softness,
        color: lightColor,
        dir: { x, y, z },
        shadowFloor,
        showGrid,
        modelMode,
      });
    },
    [engine, intensity, softness, lightColor, shadowFloor, showGrid, modelMode, applyLighting]
  );

  const handleDomePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    isDraggingDome.current = true;
    haptics.trigger('light');
    updateLightFromPointer(e.clientX, e.clientY);
  };

  const handleDomePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingDome.current) return;
    e.preventDefault();
    e.stopPropagation();
    updateLightFromPointer(e.clientX, e.clientY);
  };

  const handleDomePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingDome.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Header Drag Handlers
  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingHeader.current = true;
    const currentX = panelPos?.x ?? 72;
    const currentY = panelPos?.y ?? 64;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentX,
      startY: currentY,
    };
  };

  const handleHeaderPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingHeader.current) return;
    const dx = e.clientX - dragStart.current.mouseX;
    const dy = e.clientY - dragStart.current.mouseY;
    setPanelPos({
      x: Math.max(8, Math.min(window.innerWidth - 270, dragStart.current.startX + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 320, dragStart.current.startY + dy)),
    });
  };

  const handleHeaderPointerUp = (e: React.PointerEvent) => {
    isDraggingHeader.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Studio Preset Selection (Studio, North Light, Softbox, Silhouette)
  const handleSelectPreset = (presetName: 'studio' | 'north' | 'softbox' | 'silhouette') => {
    haptics.trigger('medium');
    setActivePreset(presetName);
    let pIntensity = 1.6;
    let pSoftness = 0.65;
    let pColor = '#fff6ea';
    let pDir = { x: 0.5, y: 0.8, z: 0.55 };

    if (presetName === 'studio') {
      pIntensity = 1.6;
      pSoftness = 0.65;
      pColor = '#fff6ea';
      pDir = { x: 0.48, y: 0.8, z: 0.52 };
    } else if (presetName === 'north') {
      pIntensity = 1.45;
      pSoftness = 0.8;
      pColor = '#e8f0fe';
      pDir = { x: 0.1, y: 0.95, z: 0.3 };
    } else if (presetName === 'softbox') {
      pIntensity = 1.5;
      pSoftness = 0.95;
      pColor = '#fff8f2';
      pDir = { x: 0.4, y: 0.65, z: 0.45 };
    } else if (presetName === 'silhouette') {
      pIntensity = 2.2;
      pSoftness = 0.4;
      pColor = '#fff6eb';
      pDir = { x: -0.4, y: 0.5, z: -0.6 };
    }

    setIntensity(pIntensity);
    setSoftness(pSoftness);
    setLightColor(pColor);

    const radius = 46;
    setPuckPos({ x: pDir.x * radius, y: pDir.z * radius });
    lightDirRef.current = pDir;

    applyLighting({
      preset: presetName,
      intensity: pIntensity,
      softness: pSoftness,
      color: pColor,
      dir: pDir,
      shadowFloor,
      showGrid,
      modelMode,
    });
  };

  const handleToggleModelFinish = () => {
    haptics.trigger('light');
    const nextMode = modelMode === 'clay' ? 'texture' : 'clay';
    setModelMode(nextMode);
    applyLighting({
      intensity,
      softness,
      color: lightColor,
      dir: lightDirRef.current,
      shadowFloor,
      showGrid,
      modelMode: nextMode,
    });
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Studio Illumination Menu"
      style={{
        left: panelPos ? `${panelPos.x}px` : undefined,
        top: panelPos ? `${panelPos.y}px` : undefined,
      }}
      className={`pr-surface fixed z-50 select-none pointer-events-auto w-[270px] rounded-2xl border shadow-2xl transition-shadow ${
        panelPos ? '' : 'left-[76px] sm:left-[84px] top-16 sm:top-20'
      } ${
        isLight
          ? 'bg-white/95 border-neutral-200 text-neutral-900 shadow-neutral-400/25'
          : 'bg-neutral-950/95 border-neutral-800 text-neutral-100 shadow-black/60'
      }`}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className={`flex items-center justify-between px-3 py-1.5 border-b min-h-[32px] cursor-grab active:cursor-grabbing rounded-t-2xl ${
          isLight ? 'border-neutral-200/80 bg-neutral-50/90' : 'border-neutral-800/80 bg-neutral-900/60'
        }`}
      >
        <span className="text-xs font-semibold tracking-wide">Studio Light</span>
        <StudioCloseButton
          onClick={() => {
            haptics.trigger('light');
            onClose();
          }}
          size="sm"
        />
      </div>

      {/* Miniature Interactive Content */}
      <div className="p-2.5 flex flex-col gap-2 text-xs">
        {/* Trackball Dome */}
        <div className="flex flex-col items-center">
          <div
            ref={domeRef}
            onPointerDown={handleDomePointerDown}
            onPointerMove={handleDomePointerMove}
            onPointerUp={handleDomePointerUp}
            className="relative w-28 h-28 rounded-full bg-gradient-to-b from-[#242b3d] to-[#0c0f18] border border-[#3b435a] shadow-inner cursor-crosshair flex items-center justify-center touch-none select-none"
            title="Drag inside dome to rotate light live"
          >
            {/* Guide Rings */}
            <div className="w-20 h-20 rounded-full border border-dashed border-white/10 pointer-events-none" />
            <div className="w-10 h-10 rounded-full border border-white/5 pointer-events-none" />

            {/* Compass Marks */}
            <span className="absolute top-1 text-[7px] font-bold text-neutral-400 pointer-events-none">N</span>
            <span className="absolute bottom-1 text-[7px] font-bold text-neutral-400 pointer-events-none">S</span>
            <span className="absolute left-1 text-[7px] font-bold text-neutral-400 pointer-events-none">W</span>
            <span className="absolute right-1 text-[7px] font-bold text-neutral-400 pointer-events-none">E</span>

            {/* Glowing Sun Puck */}
            <div
              style={{
                transform: `translate(${puckPos.x}px, ${puckPos.y}px)`,
              }}
              className="absolute w-4 h-4 rounded-full bg-amber-300 border border-white shadow-[0_0_10px_#f59e0b] flex items-center justify-center pointer-events-none transition-transform duration-75"
            >
              <div className="w-1 h-1 rounded-full bg-amber-900" />
            </div>
          </div>
          <span className="text-[9px] text-neutral-400 mt-1 font-mono tracking-wide">
            Drag Dome to Move Light
          </span>
        </div>

        {/* 4 Presets - Simple small buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: 'studio', name: 'Studio' },
              { id: 'north', name: 'North Light' },
              { id: 'softbox', name: 'Softbox' },
              { id: 'silhouette', name: 'Silhouette' },
            ] as const
          ).map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`h-8 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                  isActive
                    ? isLight
                      ? 'border-amber-500 bg-amber-500/10 text-amber-900 font-semibold ring-1 ring-amber-500/30'
                      : 'border-amber-400/80 bg-amber-400/15 text-amber-300 font-semibold ring-1 ring-amber-400/30'
                    : isLight
                    ? 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                    : 'border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300'
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        {/* Softness Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400 font-medium">Softness</span>
            <span className="font-mono font-semibold text-neutral-300">{Math.round(softness * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={softness}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setSoftness(val);
              applyLighting({
                intensity,
                softness: val,
                color: lightColor,
                dir: lightDirRef.current,
                shadowFloor,
                showGrid,
                modelMode,
              });
            }}
            className={`w-full h-1.5 rounded cursor-pointer accent-sky-400 ${
              isLight ? 'bg-neutral-200' : 'bg-neutral-700'
            }`}
          />
        </div>

        {/* Intensity / Brightness Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400 font-medium">Intensity</span>
            <span className="font-mono font-semibold text-neutral-300">{intensity.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.05"
            value={intensity}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setIntensity(val);
              applyLighting({
                intensity: val,
                softness,
                color: lightColor,
                dir: lightDirRef.current,
                shadowFloor,
                showGrid,
                modelMode,
              });
            }}
            className={`w-full h-1.5 rounded cursor-pointer accent-amber-500 ${
              isLight ? 'bg-neutral-200' : 'bg-neutral-700'
            }`}
          />
        </div>

        {/* Light Tone Chips */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span className="text-[11px] text-neutral-400 font-medium">Tone</span>
          <div className="flex gap-1.5">
            {TONES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => {
                  haptics.trigger('light');
                  setLightColor(t.color);
                  applyLighting({
                    intensity,
                    softness,
                    color: t.color,
                    dir: lightDirRef.current,
                    shadowFloor,
                    showGrid,
                    modelMode,
                  });
                }}
                className={`w-7 h-7 rounded-lg border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                  lightColor === t.color
                    ? isLight
                      ? 'border-amber-500 bg-amber-100/60 ring-2 ring-amber-400/40'
                      : 'border-amber-400 bg-amber-400/20 ring-2 ring-amber-400/30'
                    : isLight
                    ? 'border-neutral-200 hover:border-neutral-400 bg-neutral-50'
                    : 'border-neutral-700 hover:border-neutral-500 bg-neutral-900/40'
                }`}
                title={t.name}
                aria-label={t.name}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full ${t.bgClass} border ${
                    isLight ? 'border-neutral-300' : 'border-neutral-600'
                  } shadow-sm`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* 3 Quick Toggles: Floor Shadow, Floor Grid, Model Finish */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {/* Shadow Floor */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              const next = !shadowFloor;
              setShadowFloor(next);
              applyLighting({
                intensity,
                softness,
                color: lightColor,
                dir: lightDirRef.current,
                shadowFloor: next,
                showGrid,
                modelMode,
              });
            }}
            className={`h-8 px-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
              shadowFloor
                ? isLight
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold'
                  : 'border-emerald-500/80 bg-emerald-500/15 text-emerald-300 font-semibold'
                : isLight
                ? 'border-neutral-200 bg-neutral-100 text-neutral-500 hover:bg-neutral-200/70'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <span>Shadow</span>
            <span className="text-[9px] opacity-75 font-mono">{shadowFloor ? 'ON' : 'OFF'}</span>
          </button>

          {/* Floor Grid */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              const nextGrid = !showGrid;
              setShowGrid(nextGrid);
              applyLighting({
                intensity,
                softness,
                color: lightColor,
                dir: lightDirRef.current,
                shadowFloor,
                showGrid: nextGrid,
                modelMode,
              });
            }}
            className={`h-8 px-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
              showGrid
                ? isLight
                  ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold'
                  : 'border-sky-500/80 bg-sky-500/15 text-sky-300 font-semibold'
                : isLight
                ? 'border-neutral-200 bg-neutral-100 text-neutral-500 hover:bg-neutral-200/70'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <span>Grid</span>
            <span className="text-[9px] opacity-75 font-mono">{showGrid ? 'ON' : 'OFF'}</span>
          </button>

          {/* Model Clay Finish */}
          <button
            type="button"
            onClick={handleToggleModelFinish}
            className={`h-8 px-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
              modelMode === 'clay'
                ? isLight
                  ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                  : 'border-amber-400/80 bg-amber-400/15 text-amber-300 font-semibold'
                : isLight
                ? 'border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <span>Finish</span>
            <span className="text-[9px] opacity-75 font-mono">{modelMode === 'clay' ? 'Clay' : 'Tex'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
