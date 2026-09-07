import React, { useState } from 'react';
import { PostProcessSettings, RenderMode, GPUInfo } from '../types';
import {
  Sparkles,
  Sun,
  Flame,
  Camera,
  Film,
  Grid,
  X,
  Layers,
  Wand2,
  Tv,
  RefreshCw,
  Check,
  Cpu,
  Zap,
} from 'lucide-react';

interface RenderSettingsPanelProps {
  settings: PostProcessSettings;
  setSettings: React.Dispatch<React.SetStateAction<PostProcessSettings>>;
  onClose: () => void;
  onRecalculateNormals?: () => number | void;
  gpuInfo?: GPUInfo;
  theme?: 'light' | 'dark';
}

export const RenderSettingsPanelComponent: React.FC<RenderSettingsPanelProps> = ({
  settings,
  setSettings,
  onClose,
  onRecalculateNormals,
  gpuInfo,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [recalcFeedback, setRecalcFeedback] = useState<string | null>(null);

  const isWebGPU = gpuInfo?.backend === 'webgpu';

  const update = <K extends keyof PostProcessSettings>(key: K, val: PostProcessSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleManualRecalculate = () => {
    if (onRecalculateNormals) {
      const count = onRecalculateNormals();
      setRecalcFeedback(typeof count === 'number' ? `Normals smoothed (${count} meshes)` : 'Normals recalculated & smoothed');
      setTimeout(() => setRecalcFeedback(null), 2500);
    }
  };

  return (
    <div
      id="render-settings-panel"
      className={`pr-surface paperrocket-context-panel fixed left-[76px] sm:left-[88px] top-1/2 -translate-y-1/2 w-[300px] max-w-[calc(100vw-6rem)] max-h-[72vh] flex flex-col p-4 rounded-2xl border shadow-2xl z-50 select-none animate-in fade-in slide-in-from-left-2 duration-150 overflow-y-auto ${
        isLight
          ? 'bg-white border-black/10 text-neutral-800 shadow-2xl'
          : 'bg-[#18191d] border-neutral-800 text-neutral-200 shadow-2xl'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        <div className={`flex items-center gap-2 font-semibold text-sm ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
          <Wand2 className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
          <span>Picture Quality</span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg transition-colors ${
            isLight ? 'hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900' : 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 my-3 pr-1 text-xs">
        {/* Render Mode Segmented Switch */}
        <div className={`p-3 rounded-xl border space-y-2.5 ${
          isLight ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-neutral-950/60 border-neutral-800/80'
        }`}>
          <div className={`flex justify-between items-center font-semibold text-xs ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
            <span>Viewport Render Mode</span>
            <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full ${
              isLight ? 'bg-neutral-200 text-neutral-700' : 'bg-neutral-800 text-neutral-300'
            }`}>
              {settings.renderMode === 'draft' ? 'Draft (Fast)' : 'Render (Composited)'}
            </span>
          </div>

          <div className={`grid grid-cols-2 p-1 rounded-xl border gap-1 ${
            isLight ? 'bg-neutral-100 border-black/5' : 'bg-neutral-900 border-neutral-800'
          }`}>
            <button
              onClick={() => update('renderMode', 'draft')}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                settings.renderMode === 'draft'
                  ? isLight
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'bg-neutral-800 text-white shadow-sm'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Draft Mode
            </button>
            <button
              onClick={() => update('renderMode', 'render')}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                settings.renderMode === 'render'
                  ? 'bg-neutral-900 dark:bg-white text-white shadow-md shadow-emerald-600/30'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Render Mode
            </button>
          </div>
        </div>

        {/* GPU Pipeline & WebGPU Acceleration Card */}
        <div className={`p-3 rounded-xl border space-y-2 font-mono text-[11px] ${
          isLight ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-neutral-950/60 border-neutral-800/80'
        }`}>
          <div className={`flex items-center justify-between font-sans font-semibold text-xs pb-1 border-b ${
            isLight ? 'text-neutral-900 border-black/10' : 'text-neutral-200 border-neutral-800/80'
          }`}>
            <div className="flex items-center gap-1.5">
              <Cpu className={`w-3.5 h-3.5 ${isWebGPU ? 'text-neutral-700 dark:text-zinc-300' : 'text-neutral-700 dark:text-zinc-300'}`} />
              <span>GPU Pipeline & WebGPU</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              isWebGPU
                ? isLight ? 'bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white border border-black/10 dark:border-white/10' : 'bg-neutral-900 dark:bg-white/20 text-neutral-800 dark:text-zinc-300 border border-neutral-900 dark:border-white/40'
                : isLight ? 'bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white border border-black/10 dark:border-white/10' : 'bg-neutral-900 dark:bg-white/20 text-neutral-800 dark:text-zinc-300 border border-neutral-900 dark:border-white/40'
            }`}>
              {isWebGPU ? 'WebGPU Active' : 'WebGL2 Direct'}
            </span>
          </div>

          <div className={`space-y-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
            <div className="flex justify-between">
              <span>Adapter:</span>
              <span className={`text-right truncate max-w-[170px] ${isLight ? 'text-neutral-900 font-semibold' : 'text-neutral-200'}`} title={gpuInfo?.adapterName}>
                {gpuInfo?.adapterName || 'Hardware GPU Device'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Max Texture:</span>
              <span className={isLight ? 'text-neutral-900 font-semibold' : 'text-neutral-200'}>{gpuInfo?.maxTextureDimension2D || 4096}px</span>
            </div>
            <div className="flex justify-between">
              <span>Compute Support:</span>
              <span className={gpuInfo?.computeSupport ? (isLight ? 'text-neutral-900 dark:text-neutral-200 font-semibold' : 'text-neutral-700 dark:text-zinc-300') : (isLight ? 'text-neutral-700' : 'text-neutral-300')}>
                {gpuInfo?.computeSupport ? 'Enabled (Direct)' : 'Raster Stencil'}
              </span>
            </div>
          </div>
        </div>

        {/* 1. Bloom & Neon Glow Halo */}
        <div className={`p-3 rounded-xl border space-y-3 ${
          isLight ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-neutral-950/60 border-neutral-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-zinc-300">
              <Flame className="w-3.5 h-3.5" />
              <span>Glow & Bloom Halo</span>
            </div>
            <input
              type="checkbox"
              checked={settings.bloom}
              onChange={(e) => update('bloom', e.target.checked)}
              className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {settings.bloom && (
            <div className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <div className={`flex justify-between ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  <span>Bloom Intensity</span>
                  <span className={`font-mono ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{(settings.bloomIntensity).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={settings.bloomIntensity}
                  onChange={(e) => update('bloomIntensity', parseFloat(e.target.value))}
                  className={`w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 rounded cursor-pointer ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
                />
              </div>

              <div className="space-y-1">
                <div className={`flex justify-between ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  <span>Bloom Radius</span>
                  <span className={`font-mono ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{(settings.bloomRadius).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={settings.bloomRadius}
                  onChange={(e) => update('bloomRadius', parseFloat(e.target.value))}
                  className={`w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 rounded cursor-pointer ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Toon / Cel Shading */}
        <div className={`p-3 rounded-xl border space-y-3 ${
          isLight ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-neutral-950/60 border-neutral-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-zinc-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Toon / Cel Shading</span>
            </div>
            <input
              type="checkbox"
              checked={settings.toonShading}
              onChange={(e) => update('toonShading', e.target.checked)}
              className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {settings.toonShading && (
            <div className="space-y-1 pt-1">
              <div className={`flex justify-between ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                <span>Luminance Steps</span>
                <span className={`font-mono ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{settings.toonSteps} bands</span>
              </div>
              <input
                type="range"
                min="2"
                max="6"
                step="1"
                value={settings.toonSteps}
                onChange={(e) => update('toonSteps', parseInt(e.target.value))}
                className={`w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 rounded cursor-pointer ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
              />
            </div>
          )}
        </div>

        {/* 3. Depth of Field (DoF) */}
        <div className={`p-3 rounded-xl border space-y-3 ${
          isLight ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-neutral-950/60 border-neutral-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-zinc-300">
              <Camera className="w-3.5 h-3.5" />
              <span>Depth of Field (DoF)</span>
            </div>
            <input
              type="checkbox"
              checked={settings.dof}
              onChange={(e) => update('dof', e.target.checked)}
              className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {settings.dof && (
            <div className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <div className={`flex justify-between ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  <span>Aperture Blur Radius</span>
                  <span className={`font-mono ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{(settings.dofAperture * 100).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.005"
                  max="0.040"
                  step="0.005"
                  value={settings.dofAperture}
                  onChange={(e) => update('dofAperture', parseFloat(e.target.value))}
                  className={`w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 rounded cursor-pointer ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. Film Grain Noise */}
        <div className={`p-3 rounded-xl border space-y-3 ${
          isLight ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-neutral-950/60 border-neutral-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-zinc-300">
              <Film className="w-3.5 h-3.5" />
              <span>Cinematic Film Grain</span>
            </div>
            <input
              type="checkbox"
              checked={settings.grain}
              onChange={(e) => update('grain', e.target.checked)}
              className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {settings.grain && (
            <div className="space-y-1 pt-1">
              <div className={`flex justify-between ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                <span>Grain Intensity</span>
                <span className={`font-mono ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{((settings.grainIntensity) * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.30"
                step="0.02"
                value={settings.grainIntensity}
                onChange={(e) => update('grainIntensity', parseFloat(e.target.value))}
                className={`w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 rounded cursor-pointer ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
              />
            </div>
          )}
        </div>

        {/* 5. Retro Pixelation */}
        <div className={`p-3 rounded-xl border space-y-3 ${
          isLight ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-neutral-950/60 border-neutral-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-zinc-300">
              <Tv className="w-3.5 h-3.5" />
              <span>Retro Pixelation Grid</span>
            </div>
            <input
              type="checkbox"
              checked={settings.pixelation}
              onChange={(e) => update('pixelation', e.target.checked)}
              className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer"
            />
          </div>

          {settings.pixelation && (
            <div className="space-y-1 pt-1">
              <div className={`flex justify-between ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                <span>Pixel Size</span>
                <span className={`font-mono ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{settings.pixelSize} px</span>
              </div>
              <input
                type="range"
                min="2"
                max="16"
                step="1"
                value={settings.pixelSize}
                onChange={(e) => update('pixelSize', parseInt(e.target.value))}
                className={`w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 rounded cursor-pointer ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
              />
            </div>
          )}
        </div>

        {/* 6. Mesh Normals & Shading Smoothness */}
        {onRecalculateNormals && (
          <div className={`p-3 rounded-xl border space-y-2 ${
            isLight ? 'bg-[#f4f0e9]/80 border-black/10' : 'bg-neutral-950/60 border-neutral-800/80'
          }`}>
            <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-zinc-300">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Mesh Normals & Smooth Shading</span>
            </div>
            <p className={`text-[10px] leading-tight ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Recalculates vertex normal vectors across accumulated strokes & model meshes to eliminate faceting and restore smooth PBR lighting.
            </p>
            <button
              id="btn-render-recalculate-normals"
              type="button"
              onClick={handleManualRecalculate}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm cursor-pointer ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-900'
                  : 'bg-black/30 dark:bg-white/5/50 hover:bg-neutral-800 dark:bg-white/10/60 border-neutral-700 dark:border-neutral-300/60 text-neutral-800 dark:text-zinc-200'
              }`}
            >
              {recalcFeedback ? (
                <>
                  <Check className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
                  <span className={isLight ? 'text-neutral-900 dark:text-neutral-200' : 'text-neutral-800 dark:text-zinc-300'}>{recalcFeedback}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
                  <span>Recalculate & Smooth All Normals Now</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const RenderSettingsPanel = React.memo(RenderSettingsPanelComponent);
