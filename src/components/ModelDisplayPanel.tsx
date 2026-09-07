import React, { useState } from 'react';
import { StudioEngine } from '../core/studioEngine';
import { ModelDisplayMode, ModelMetadata } from '../types';
import {
  Layers,
  Eye,
  EyeOff,
  Crosshair,
  Maximize2,
  Box,
  Palette,
  X,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface ModelDisplayPanelProps {
  engine: StudioEngine | null;
  activeModelName: string;
  metadata: ModelMetadata | null;
  displayMode: ModelDisplayMode;
  onDisplayModeChange: (mode: ModelDisplayMode) => void;
  onOpenLibrary: () => void;
  onClose?: () => void;
  theme?: 'light' | 'dark';
}

export const ModelDisplayPanel: React.FC<ModelDisplayPanelProps> = ({
  engine,
  activeModelName,
  metadata,
  displayMode,
  onDisplayModeChange,
  onOpenLibrary,
  onClose,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [modelOpacity, setModelOpacityState] = useState(1.0);
  const [wireframeOpacity, setWireframeOpacityState] = useState(0.0);
  const [isVisible, setIsVisible] = useState(true);

  const [cloneStatus, setCloneStatus] = useState<string | null>(null);

  const handleClone = () => {
    if (!engine) return;
    const cloned = engine.cloneModel();
    if (cloned) {
      setCloneStatus('Cloned!');
      setTimeout(() => setCloneStatus(null), 1500);
    }
  };

  const handleOpacityChange = (val: number) => {
    setModelOpacityState(val);
    engine?.setModelOpacity(val);
  };

  const handleWireframeChange = (val: number) => {
    setWireframeOpacityState(val);
    engine?.setModelWireframeOpacity(val);
  };

  const handleToggleVisibility = () => {
    const next = engine ? engine.toggleModelVisibility() : !isVisible;
    setIsVisible(next);
  };

  const handleCenter = () => {
    engine?.centerModelToOrigin();
  };

  const handleResetCamera = () => {
    engine?.snapToView('isometric');
  };

  return (
    <div
      id="model-display-panel"
      className={`pr-surface w-80 rounded-2xl border shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 ${
        isLight
          ? 'bg-white border-black/10 text-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
          : 'bg-[#18191d] border-neutral-800 text-neutral-200'
      }`}
    >
      {/* Panel Header */}
      <div className={`flex items-center justify-between pb-2.5 border-b ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-neutral-900 dark:text-zinc-300" />
          <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>
            3D Model & Display Mode
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
              isLight ? 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Active Model Info & Switcher */}
      <div className={`p-3 rounded-xl border flex items-center justify-between ${
        isLight
          ? 'bg-[#f4f0e9]/80 border-black/10'
          : 'bg-neutral-950/60 border-neutral-800/80'
      }`}>
        <div className="min-w-0 pr-2">
          <div className={`text-xs font-semibold truncate ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>{activeModelName}</div>
          <div className={`text-[10px] mt-0.5 flex gap-2 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            <span>{metadata ? `${(metadata.triangleCount / 1000).toFixed(1)}k tris` : '3D Mesh'}</span>
            <span>•</span>
            <span>{metadata ? `${(metadata.vertexCount / 1000).toFixed(1)}k verts` : 'Draco'}</span>
          </div>
        </div>
        <button
          onClick={onOpenLibrary}
          className={`px-3 py-1.5 rounded-lg ${isLight ? 'bg-neutral-900 text-white hover:bg-black' : 'bg-white text-zinc-950 hover:bg-neutral-100'} text-xs font-medium transition-colors whitespace-nowrap shadow-sm`}
        >
          Change Model
        </button>
      </div>

      {/* Display Mode (Texture vs Clay White) */}
      <div className="space-y-1.5">
        <label className={`text-[11px] font-medium uppercase tracking-wider ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
          Surface Rendering Shading
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onDisplayModeChange('texture')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
              displayMode === 'texture'
                ? isLight
                  ? 'bg-neutral-100 dark:bg-white/10 border-neutral-300 dark:border-white/20 text-neutral-900 dark:text-white font-bold shadow-sm'
                  : 'bg-neutral-900 dark:bg-white/10 border-neutral-700 dark:border-white/20 text-white shadow-sm'
                : isLight
                ? 'bg-neutral-100 border-black/5 text-neutral-600 hover:text-neutral-900'
                : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-neutral-900 dark:text-zinc-300" />
            <span>Texture (Original)</span>
          </button>

          <button
            onClick={() => onDisplayModeChange('clay')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
              displayMode === 'clay'
                ? isLight
                  ? 'bg-neutral-100 dark:bg-white/10 border-neutral-300 dark:border-white/20 text-neutral-900 dark:text-white font-bold shadow-sm'
                  : 'bg-neutral-900 dark:bg-white/10 border-neutral-700 dark:border-white/20 text-white shadow-sm'
                : isLight
                ? 'bg-neutral-100 border-black/5 text-neutral-600 hover:text-neutral-900'
                : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
            <span>Plain White Canvas</span>
          </button>
        </div>
      </div>

      {/* Sliders: Model Opacity & Wireframe */}
      <div className="space-y-2 text-[11px] pt-1">
        <div>
          <div className={`flex justify-between mb-1 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            <span>Model Surface Opacity</span>
            <span className={`font-mono font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>{Math.round(modelOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.02"
            value={modelOpacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
          />
        </div>

        <div>
          <div className={`flex justify-between mb-1 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            <span>Wireframe Polygon Overlay</span>
            <span className={`font-mono font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>{Math.round(wireframeOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={wireframeOpacity}
            onChange={(e) => handleWireframeChange(parseFloat(e.target.value))}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
          />
        </div>
      </div>

      {/* Action Buttons: Clone, Hide/Show, Center, Reset Camera */}
      <div className={`pt-2 border-t grid grid-cols-4 gap-1.5 text-xs ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        <button
          onClick={handleClone}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-center transition-all ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-800'
              : 'bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800 text-neutral-300'
          }`}
          title="Clone 3D Model with offset"
        >
          <Layers className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
          <span className="text-[10px]">{cloneStatus || 'Clone'}</span>
        </button>

        <button
          onClick={handleToggleVisibility}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-center transition-all ${
            isVisible
              ? isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-800'
                : 'bg-neutral-950/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              : isLight
              ? 'bg-neutral-100 dark:bg-white/10 border-neutral-300 dark:border-white/20 text-neutral-900 dark:text-white'
              : 'bg-white/10 border-white/20 text-neutral-300'
          }`}
          title={isVisible ? 'Hide Model' : 'Show Model'}
        >
          {isVisible ? <Eye className="w-4 h-4 text-neutral-900 dark:text-zinc-300" /> : <EyeOff className="w-4 h-4" />}
          <span className="text-[10px]">{isVisible ? 'Hide' : 'Show'}</span>
        </button>

        <button
          onClick={handleCenter}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-center transition-all ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-800'
              : 'bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800 text-neutral-300'
          }`}
          title="Recenter Camera & Model"
        >
          <Crosshair className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
          <span className="text-[10px]">Center</span>
        </button>

        <button
          onClick={handleResetCamera}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-center transition-all ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-800'
              : 'bg-neutral-950/40 border-neutral-800 hover:bg-neutral-800 text-neutral-300'
          }`}
          title="Reset Isometric Camera"
        >
          <RotateCcw className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
          <span className="text-[10px]">Reset Cam</span>
        </button>
      </div>
    </div>
  );
};
