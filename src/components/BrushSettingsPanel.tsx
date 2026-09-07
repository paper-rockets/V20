import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { BrushSettings, MaterialType, StrokeProfile, SmoothingAlgorithm } from '../types';
import { normalizeHexColor } from '../core/materialCache';
import {
  Sliders,
  Zap,
  X,
  Cpu,
  Palette,
  Shapes,
  Flame,
  Scissors,
  Activity,
  RefreshCw,
  Check,
  Paintbrush,
  Sparkles,
  Crosshair,
  Compass,
  Layers,
} from 'lucide-react';

interface BrushSettingsPanelProps {
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  onClose: () => void;
  onRecalculateNormals?: () => number | void;
  onOpenRaycastSettings?: () => void;
  onOpenColorStudio?: () => void;
  theme?: 'light' | 'dark';
}

const QUICK_COLORS = [
  '#38bdf8', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#22c55e', '#10b981', '#ffffff', '#0f172a'
];

export const BrushSettingsPanelComponent: React.FC<BrushSettingsPanelProps> = ({
  brushSettings,
  setBrushSettings,
  onClose,
  onRecalculateNormals,
  onOpenRaycastSettings,
  onOpenColorStudio,
  theme = 'dark',
}) => {
  const [recalcFeedback, setRecalcFeedback] = useState<string | null>(null);

  const updateSetting = <K extends keyof BrushSettings>(key: K, value: BrushSettings[K]) => {
    setBrushSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (hex: string) => {
    const valid = normalizeHexColor(hex, '#38bdf8');
    setBrushSettings((prev) => ({ ...prev, color: valid }));
  };

  const handleManualRecalculate = () => {
    if (onRecalculateNormals) {
      const count = onRecalculateNormals();
      setRecalcFeedback(typeof count === 'number' ? `Smooth normals updated (${count} meshes)` : 'Normals smoothed');
      setTimeout(() => setRecalcFeedback(null), 2500);
    }
  };

  const smoothingAlgorithms: { id: SmoothingAlgorithm; label: string; desc: string; badge: string }[] = [
    {
      id: 'streamline',
      label: 'Streamline Lead String',
      desc: 'Pull-string smoothing for buttery calligraphic strokes',
      badge: 'Smooth',
    },
    {
      id: 'exponential',
      label: 'Adaptive EWMA',
      desc: 'Velocity-weighted moving average for fluid responsiveness',
      badge: 'Responsive',
    },
    {
      id: 'none',
      label: 'Raw Direct',
      desc: 'Direct unfiltered coordinates with zero latency',
      badge: 'Raw',
    },
  ];

  const materialTypes: { id: MaterialType; label: string; desc: string; icon: any }[] = [
    { id: 'shadeless', label: 'Flat Paint', desc: 'Unlit solid color unaffected by 3D lighting', icon: Palette },
    { id: 'shaded', label: 'PBR Lit', desc: 'Physically-based surface reacting to lighting & roughness', icon: Zap },
    { id: 'glow', label: 'Flat Glow', desc: 'Self-illuminated emissive tone for vibrant highlights', icon: Flame },
    { id: 'cutout', label: 'Cutout Mask', desc: 'Negative space mask punching through paint', icon: Scissors },
  ];

  const strokeProfiles: { id: StrokeProfile; label: string; desc: string }[] = [
    { id: 'ribbon', label: 'Flat Ribbon', desc: 'Flat ribbon strip aligned with surface' },
    { id: 'conformal', label: 'Flat Conformal', desc: 'Surface-conforming decal hugging mesh contours' },
    { id: 'marker', label: 'Chisel Marker', desc: 'Calligraphic chisel-angled rectangular profile' },
    { id: 'tube', label: '3D Spatial Tube', desc: 'Volumetric cylinder for 3D air curves' },
  ];

  return createPortal(
    <div
      id="brush-settings-panel"
      className={`pr-surface paperrocket-context-panel fixed left-[76px] sm:left-[88px] top-1/2 -translate-y-1/2 z-50 w-[300px] max-w-[calc(100vw-6rem)] max-h-[72vh] flex flex-col rounded-2xl shadow-2xl select-none overflow-hidden font-sans border transition-all animate-in fade-in slide-in-from-left-2 duration-150 ${
        theme === 'light'
          ? 'bg-white text-neutral-800 border-neutral-200 shadow-neutral-400/30'
          : 'bg-[#18191d] text-zinc-200 border-zinc-800 shadow-black/80'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        theme === 'light' ? 'border-neutral-200 bg-neutral-50' : 'border-zinc-800 bg-[#101115]'
      }`}>
        <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
          <Sliders className={`w-4 h-4 ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`} />
          <span>Brush Dynamics & Surface</span>
        </div>
        <button
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors ${
            theme === 'light' ? 'hover:bg-neutral-200 text-neutral-500' : 'hover:bg-white/10 text-zinc-400 hover:text-white'
          }`}
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {/* SECTION 1: Drawing Space & Attachment (High Priority) */}
          <div className={`p-3.5 rounded-2xl border space-y-2.5 ${
            theme === 'light' ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-[#18191f] border-zinc-800/90'
          }`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 font-semibold ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>
                <Compass className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`} />
                <span>Drawing Space & Attachment</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                theme === 'light' ? 'bg-neutral-200 border-neutral-300 text-neutral-800' : 'bg-zinc-900 border-zinc-700 text-zinc-300'
              }`}>
                {brushSettings.drawingMode === 'spatial_3d' ? '3D Mid-Air' : 'Surface Snapping'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSetting('drawingMode', 'surface')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  brushSettings.drawingMode !== 'spatial_3d'
                    ? theme === 'light'
                      ? 'bg-neutral-900 text-white font-bold border-neutral-900 shadow-sm'
                      : 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                    : theme === 'light'
                    ? 'bg-white border-black/10 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <div className="text-xs font-semibold">Surface Conformal</div>
                <div className={`text-[10px] mt-0.5 ${
                  brushSettings.drawingMode !== 'spatial_3d'
                    ? theme === 'light' ? 'text-neutral-300' : 'text-zinc-700'
                    : theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'
                }`}>
                  Snaps to 3D geometry polygons
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateSetting('drawingMode', 'spatial_3d')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  brushSettings.drawingMode === 'spatial_3d'
                    ? theme === 'light'
                      ? 'bg-neutral-900 text-white font-bold border-neutral-900 shadow-sm'
                      : 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                    : theme === 'light'
                    ? 'bg-white border-black/10 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <div className="text-xs font-semibold">Free 3D Spatial</div>
                <div className={`text-[10px] mt-0.5 ${
                  brushSettings.drawingMode === 'spatial_3d'
                    ? theme === 'light' ? 'text-neutral-300' : 'text-zinc-700'
                    : theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'
                }`}>
                  Draws in mid-air independently
                </div>
              </button>
            </div>

            {brushSettings.drawingMode === 'spatial_3d' && (
              <div className={`space-y-1.5 pt-2 border-t ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
                <div className={`flex justify-between text-[11px] ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`}>
                  <span>Spatial Depth Plane</span>
                  <span className={`font-mono ${theme === 'light' ? 'text-neutral-900 font-bold' : 'text-zinc-200'}`}>{(brushSettings.spatialDepth || 0).toFixed(2)}m</span>
                </div>
                <input
                  type="range"
                  min="-2.0"
                  max="2.0"
                  step="0.05"
                  value={brushSettings.spatialDepth || 0}
                  onChange={(e) => updateSetting('spatialDepth', parseFloat(e.target.value))}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                    theme === 'light' ? 'bg-neutral-300 accent-neutral-900' : 'bg-zinc-800 accent-white'
                  }`}
                />
              </div>
            )}
          </div>

          {/* SECTION 2: Material Shader Pipeline */}
          <div className={`p-3.5 rounded-2xl border space-y-3 ${
            theme === 'light' ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-[#18191f] border-zinc-800/90'
          }`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 font-semibold ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>
                <Palette className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`} />
                <span>Material Shader Pipeline</span>
              </div>
              <span className={`text-[10px] font-mono capitalize ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`}>
                {brushSettings.materialType || 'shadeless'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {materialTypes.map((mat) => {
                const Icon = mat.icon;
                const isSelected = (brushSettings.materialType || 'shadeless') === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => updateSetting('materialType', mat.id)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? theme === 'light'
                          ? 'bg-neutral-900 text-white font-bold border-neutral-900 shadow-sm'
                          : 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                        : theme === 'light'
                        ? 'bg-white border-black/10 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? (theme === 'light' ? 'text-white' : 'text-zinc-950') : (theme === 'light' ? 'text-neutral-600' : 'text-zinc-400')}`} />
                      <span>{mat.label}</span>
                    </div>
                    <span className={`text-[10px] line-clamp-2 mt-0.5 leading-tight ${
                      isSelected
                        ? theme === 'light' ? 'text-neutral-300 font-normal' : 'text-zinc-700 font-normal'
                        : theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'
                    }`}>
                      {mat.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Shader FX */}
            <div className={`pt-2.5 border-t space-y-1.5 ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
              <div className="flex items-center justify-between text-[11px]">
                <span className={`font-medium flex items-center gap-1 ${theme === 'light' ? 'text-neutral-700' : 'text-zinc-300'}`}>
                  <Sparkles className={`w-3 h-3 ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-400'}`} />
                  <span>Dynamic Shader FX</span>
                </span>
                <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-400'}`}>
                  {brushSettings.animatedEffect && brushSettings.animatedEffect !== 'none' ? 'Active' : 'Off'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'none', label: 'None' },
                  { id: 'electric', label: 'Plasma' },
                  { id: 'pulse', label: 'Pulse' },
                  { id: 'scanline', label: 'Scanline' },
                  { id: 'hologram', label: 'Holo' },
                  { id: 'neon_wire', label: 'Neon' },
                ].map((fx) => {
                  const isSel = (brushSettings.animatedEffect || 'none') === fx.id;
                  return (
                    <button
                      key={fx.id}
                      type="button"
                      onClick={() => updateSetting('animatedEffect', fx.id as any)}
                      className={`py-1 px-1.5 rounded-lg text-center font-medium text-[10px] transition-all border ${
                        isSel
                          ? theme === 'light'
                            ? 'bg-neutral-900 text-white font-bold border-neutral-900 shadow-sm'
                            : 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                          : theme === 'light'
                          ? 'bg-white border-black/10 text-neutral-600 hover:text-neutral-900'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {fx.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PBR Parameters (shown when PBR Lit is selected) */}
            {brushSettings.materialType === 'shaded' && (
              <div className={`pt-2.5 border-t space-y-2 ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
                <div className="space-y-1">
                  <div className={`flex justify-between text-[11px] ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`}>
                    <span>PBR Roughness</span>
                    <span className={`font-mono ${theme === 'light' ? 'text-neutral-900 font-bold' : 'text-zinc-200'}`}>{(brushSettings.roughness ?? 0.35).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={brushSettings.roughness ?? 0.35}
                    onChange={(e) => updateSetting('roughness', parseFloat(e.target.value))}
                    className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                      theme === 'light' ? 'bg-neutral-300 accent-neutral-900' : 'bg-zinc-800 accent-white'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <div className={`flex justify-between text-[11px] ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`}>
                    <span>PBR Metalness</span>
                    <span className={`font-mono ${theme === 'light' ? 'text-neutral-900 font-bold' : 'text-zinc-200'}`}>{(brushSettings.metalness ?? 0.15).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={brushSettings.metalness ?? 0.15}
                    onChange={(e) => updateSetting('metalness', parseFloat(e.target.value))}
                    className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
                      theme === 'light' ? 'bg-neutral-300 accent-neutral-900' : 'bg-zinc-800 accent-white'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Brush Tip & 3D Geometry Profile */}
          <div className={`p-3.5 rounded-2xl border space-y-3 ${
            theme === 'light' ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-[#18191f] border-zinc-800/90'
          }`}>
            <div className={`flex items-center gap-1.5 font-semibold ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>
              <Shapes className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`} />
              <span>Brush Shape & 3D Profile</span>
            </div>

            {/* Tip Shape */}
            <div className="space-y-1">
              <span className={`text-[11px] ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`}>Brush Tip Shape</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'round', label: 'Round Dot' },
                  { id: 'wide_flat', label: 'Wide Line' },
                  { id: 'square', label: 'Square' },
                ].map((sh) => {
                  const isSelected = (brushSettings.brushShape || 'round') === sh.id;
                  return (
                    <button
                      key={sh.id}
                      type="button"
                      onClick={() => updateSetting('brushShape', sh.id as any)}
                      className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? theme === 'light'
                            ? 'bg-neutral-900 text-white font-bold border-neutral-900 shadow-sm'
                            : 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                          : theme === 'light'
                          ? 'bg-white border-black/10 text-neutral-600 hover:text-neutral-900'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="font-semibold text-xs">{sh.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Width Multiplier */}
            {brushSettings.brushShape === 'wide_flat' && (
              <div className={`space-y-1 pt-1.5 border-t ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
                <div className={`flex justify-between ${theme === 'light' ? 'text-neutral-700' : 'text-zinc-300'}`}>
                  <span>Line Width Multiplier</span>
                  <span className={`font-mono font-bold ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>{(brushSettings.brushWidthMultiplier || 3.0).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="8.0"
                  step="0.5"
                  value={brushSettings.brushWidthMultiplier || 3.0}
                  onChange={(e) => updateSetting('brushWidthMultiplier', parseFloat(e.target.value))}
                  className={`w-full h-1.5 rounded cursor-pointer ${
                    theme === 'light' ? 'bg-neutral-300 accent-neutral-900' : 'bg-zinc-800 accent-white'
                  }`}
                />
              </div>
            )}

            {/* Straight Line Snapping */}
            <div className={`flex items-center justify-between pt-1.5 border-t ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
              <div className="flex flex-col">
                <span className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>Straight Line Snapping</span>
                <span className={`text-[10px] ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'}`}>Locks stroke to straight line segment</span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.straightLineMode || false}
                onChange={(e) => updateSetting('straightLineMode', e.target.checked)}
                className={`w-4 h-4 rounded cursor-pointer ${theme === 'light' ? 'accent-neutral-900' : 'accent-white'}`}
              />
            </div>

            {/* 3D Geometry Profile */}
            <div className={`space-y-1 pt-1.5 border-t ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
              <span className={`text-[11px] ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`}>3D Geometry Mesh Profile</span>
              <div className="grid grid-cols-2 gap-1.5">
                {strokeProfiles.map((prof) => {
                  const isSelected = (brushSettings.profile || 'ribbon') === prof.id;
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => updateSetting('profile', prof.id)}
                      className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? theme === 'light'
                            ? 'bg-neutral-900 text-white font-bold border-neutral-900 shadow-sm'
                            : 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                          : theme === 'light'
                          ? 'bg-white border-black/10 text-neutral-600 hover:text-neutral-900'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold text-xs">{prof.label}</span>
                      <span className={`text-[10px] line-clamp-2 mt-0.5 leading-tight ${
                        isSelected
                          ? theme === 'light' ? 'text-neutral-300 font-normal' : 'text-zinc-700 font-normal'
                          : theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'
                      }`}>
                        {prof.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 4: Surface Snapping & Precision Dynamics */}
          <div className={`p-3.5 rounded-2xl border space-y-3 ${
            theme === 'light' ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-[#18191f] border-zinc-800/90'
          }`}>
            <div className={`flex items-center gap-1.5 font-semibold ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>
              <Cpu className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`} />
              <span>Surface Snapping & Precision Dynamics</span>
            </div>

            {/* Silhouette Clamping Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>Silhouette Contour Clamping</span>
                <span className={`text-[10px] ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'}`}>Clamps overhanging fins at mesh boundaries</span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.silhouetteClamping}
                onChange={(e) => updateSetting('silhouetteClamping', e.target.checked)}
                className={`w-4 h-4 rounded cursor-pointer ${theme === 'light' ? 'accent-neutral-900' : 'accent-white'}`}
              />
            </div>

            {/* Stencil Buffer Occlusion */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>Stencil Buffer Occlusion</span>
                <span className={`text-[10px] ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'}`}>Masks strokes strictly to model pixels</span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.stencilMasking}
                onChange={(e) => updateSetting('stencilMasking', e.target.checked)}
                className={`w-4 h-4 rounded cursor-pointer ${theme === 'light' ? 'accent-neutral-900' : 'accent-white'}`}
              />
            </div>

            {/* Surface Offset */}
            <div className="space-y-1">
              <div className={`flex justify-between ${theme === 'light' ? 'text-neutral-700' : 'text-zinc-300'}`}>
                <span>Base Surface Offset</span>
                <span className={`font-mono ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-400'}`}>{(brushSettings.surfaceOffset * 1000).toFixed(1)} mm</span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.010"
                step="0.0005"
                value={brushSettings.surfaceOffset}
                onChange={(e) => updateSetting('surfaceOffset', parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded cursor-pointer ${
                  theme === 'light' ? 'bg-neutral-300 accent-neutral-900' : 'bg-zinc-800 accent-white'
                }`}
              />
            </div>

            {/* Smoothing Filter */}
            <div className={`space-y-1 pt-1.5 border-t ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
              <div className={`flex justify-between ${theme === 'light' ? 'text-neutral-700' : 'text-zinc-300'}`}>
                <span>Stroke Smoothing</span>
                <span className={`font-mono ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-400'}`}>
                  {((brushSettings.smoothingStrength ?? 0.55) * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={brushSettings.smoothingStrength ?? 0.55}
                onChange={(e) => updateSetting('smoothingStrength', parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded cursor-pointer ${
                  theme === 'light' ? 'bg-neutral-300 accent-neutral-900' : 'bg-zinc-800 accent-white'
                }`}
              />
            </div>

            {/* Pressure Sensitivity */}
            <div className={`flex items-center justify-between pt-1.5 border-t ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
              <div className="flex flex-col">
                <span className={`font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-200'}`}>Stylus Pressure Sensitivity</span>
                <span className={`text-[10px] ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'}`}>Dynamic width with stylus pressure</span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.pressureSensitivity}
                onChange={(e) => updateSetting('pressureSensitivity', e.target.checked)}
                className={`w-4 h-4 rounded cursor-pointer ${theme === 'light' ? 'accent-neutral-900' : 'accent-white'}`}
              />
            </div>

            {/* Auto Recalculate Mesh Normals */}
            <div className={`pt-2 border-t space-y-2 ${theme === 'light' ? 'border-black/10' : 'border-zinc-800/80'}`}>
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-2">
                  <div className={`flex items-center gap-1.5 font-medium ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-100'}`}>
                    <RefreshCw className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`} />
                    <span>Auto Recalculate Normals</span>
                  </div>
                  <span className={`text-[10px] mt-0.5 ${theme === 'light' ? 'text-neutral-500' : 'text-zinc-500'}`}>
                    Smooths vertex normals after drawing to eliminate creases
                  </span>
                </div>
                <input
                  id="toggle-auto-recalculate-normals"
                  type="checkbox"
                  checked={brushSettings.autoRecalculateNormals !== false}
                  onChange={(e) => updateSetting('autoRecalculateNormals', e.target.checked)}
                  className={`w-4 h-4 rounded cursor-pointer shrink-0 ${theme === 'light' ? 'accent-neutral-900' : 'accent-white'}`}
                />
              </div>

              {onRecalculateNormals && (
                <button
                  id="btn-manual-recalculate-normals"
                  type="button"
                  onClick={handleManualRecalculate}
                  className={`w-full py-1.5 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                    theme === 'light'
                      ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                  }`}
                >
                  {recalcFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
                      <span className={theme === 'light' ? 'text-neutral-900 dark:text-neutral-200 font-semibold' : 'text-neutral-800 dark:text-zinc-300'}>{recalcFeedback}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`} />
                      <span>Recalculate & Smooth Normals Now</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Swatches & Quick Color */}
        <div className={`p-3 border-t flex flex-col gap-2 ${
          theme === 'light' ? 'border-neutral-200 bg-neutral-50' : 'border-zinc-800 bg-[#101115]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full border border-black/40 shadow-inner"
                style={{ backgroundColor: brushSettings.color }}
              />
              <span className={`font-mono text-xs font-semibold ${theme === 'light' ? 'text-neutral-900' : 'text-zinc-300'}`}>
                {(brushSettings.color || '#38bdf8').toUpperCase()}
              </span>
            </div>

            {onOpenColorStudio && (
              <button
                type="button"
                onClick={onOpenColorStudio}
                className={`py-1 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                  theme === 'light'
                    ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                }`}
              >
                <Palette className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-neutral-600' : 'text-zinc-400'}`} />
                <span>Color Studio...</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-12 gap-1">
            {QUICK_COLORS.map((hex) => {
              const isSelected = (brushSettings.color || '').toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => handleColorChange(hex)}
                  className={`h-5 rounded-md border transition-transform active:scale-90 ${
                    isSelected ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-400 dark:ring-neutral-500 scale-110' : 'border-black/30 hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              );
            })}
          </div>
        </div>
      </div>,
      document.body
    );
};

export const BrushSettingsPanel = React.memo(BrushSettingsPanelComponent);
