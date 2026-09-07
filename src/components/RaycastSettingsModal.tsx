import React, { useState } from 'react';
import { BrushSettings } from '../types';
import {
  Crosshair,
  X,
  RefreshCw,
  Check,
  Shield,
  Layers,
  Sparkles,
  Cpu,
  Sliders,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface RaycastSettingsModalProps {
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  onClose: () => void;
  onRecalculateNormals?: () => number | void;
  theme?: 'light' | 'dark';
}

export const RaycastSettingsModal: React.FC<RaycastSettingsModalProps> = ({
  brushSettings,
  setBrushSettings,
  onClose,
  onRecalculateNormals,
  theme = 'light',
}) => {
  const [recalcFeedback, setRecalcFeedback] = useState<string | null>(null);

  const isLight = theme === 'light';

  const updateSetting = <K extends keyof BrushSettings>(key: K, value: BrushSettings[K]) => {
    setBrushSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleManualRecalculate = () => {
    if (onRecalculateNormals) {
      const count = onRecalculateNormals();
      setRecalcFeedback(
        typeof count === 'number'
          ? `Smooth normals updated (${count} meshes)`
          : 'Normals recalculated & smoothed'
      );
      setTimeout(() => setRecalcFeedback(null), 2500);
    }
  };

  return (
    <div
      id="raycast-settings-modal"
      className="paperrocket-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        className={`pr-surface w-full max-w-lg max-h-[90vh] flex flex-col p-6 rounded-3xl shadow-2xl border text-xs leading-relaxed overflow-hidden ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-800 shadow-neutral-300/60'
            : 'bg-[#18191d] border-neutral-800 text-neutral-100 shadow-black/80'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Surface Snapping & Alignment</h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Precision snapping, step sampling, and normal alignment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="py-4 space-y-4 overflow-y-auto pr-1">
          {/* 1. Raycast Sub-Step Sampling Density */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-neutral-900 dark:text-neutral-100">
                <Cpu className="w-4 h-4" />
                <span>Raycast Sub-Step Sampling Density</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
                {brushSettings.raycastSampleDensity === 'ultra'
                  ? 'Ultra (48 Sub-steps)'
                  : brushSettings.raycastSampleDensity === 'standard'
                  ? 'Standard (16 Sub-steps)'
                  : 'High (32 Sub-steps)'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Higher raycast density calculates dense surface contact points on rapid brush sweeps, eliminating missing spots or skipped sections across complex geometry.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: 'standard', label: 'Standard', sub: '16 Steps' },
                { id: 'high', label: 'High (Default)', sub: '32 Steps' },
                { id: 'ultra', label: 'Ultra Dense', sub: '48 Steps' },
              ].map((lvl) => {
                const isSel = (brushSettings.raycastSampleDensity || 'high') === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    onClick={() => updateSetting('raycastSampleDensity', lvl.id as any)}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                      isSel
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm border-neutral-900 dark:border-white'
                        : isLight
                        ? 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="text-xs">{lvl.label}</div>
                    <div className={`text-[10px] opacity-80 ${isSel ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                      {lvl.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Micro-Seam Raycast Bridging & Double Sided */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col pr-2">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Geometry Seam & Gap Bridging
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Sub-pixel multi-sample fallback that bridges micro-gaps between multi-mesh model parts
                </span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.raycastSeamBridging !== false}
                onChange={(e) => updateSetting('raycastSeamBridging', e.target.checked)}
                className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col pr-2">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Double-Sided Polygon Raycasting
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Ensures thin leaves, cloth, and single-sided faces accept paint from any angle
                </span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.doubleSidedRaycast !== false}
                onChange={(e) => updateSetting('doubleSidedRaycast', e.target.checked)}
                className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col pr-2">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Barycentric Normal Interpolation
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Computes weighted smooth surface normals across triangle vertices for crease-free decals
                </span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.barycentricNormals !== false}
                onChange={(e) => updateSetting('barycentricNormals', e.target.checked)}
                className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer shrink-0"
              />
            </div>
          </div>

          {/* 3. Distance & Bias Sliders */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 space-y-3.5">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Base Surface Offset (Elevation Bias)
                </span>
                <span className="font-mono text-neutral-600 dark:text-neutral-300">
                  {((brushSettings.surfaceOffset ?? 0.0015) * 1000).toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.010"
                step="0.0005"
                value={brushSettings.surfaceOffset ?? 0.0015}
                onChange={(e) => updateSetting('surfaceOffset', parseFloat(e.target.value))}
                className="w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded cursor-pointer"
              />
              <p className="text-[10px] text-neutral-500">
                Elevates stroke decals infinitesimally above 3D mesh faces to eradicate coplanar z-fighting.
              </p>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Air-Gap Discontinuity Distance Threshold
                </span>
                <span className="font-mono text-neutral-600 dark:text-neutral-300">
                  {((brushSettings.airGapTolerance ?? 0.5) * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={brushSettings.airGapTolerance ?? 0.5}
                onChange={(e) => updateSetting('airGapTolerance', parseFloat(e.target.value))}
                className="w-full accent-neutral-900 dark:accent-neutral-100 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded cursor-pointer"
              />
              <p className="text-[10px] text-neutral-500">
                Maximum 3D spatial jump permitted before the engine commits the segment, preventing cross-model jumps.
              </p>
            </div>
          </div>

          {/* 4. Silhouette & Stencil Occlusion */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col pr-2">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Silhouette Contour Clamping
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Clamps overhanging ribbon edges at mesh perimeter contours
                </span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.silhouetteClamping}
                onChange={(e) => updateSetting('silhouetteClamping', e.target.checked)}
                className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col pr-2">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Stencil Buffer Pixel Occlusion
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Masks paint strokes strictly within the rasterized model silhouette
                </span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.stencilMasking}
                onChange={(e) => updateSetting('stencilMasking', e.target.checked)}
                className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer shrink-0"
              />
            </div>
          </div>

          {/* 5. Auto Recalculate Normals */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col pr-2">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Auto Recalculate Mesh Normals
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Dynamically smooths vertex normals after strokes to eliminate shading creases
                </span>
              </div>
              <input
                type="checkbox"
                checked={brushSettings.autoRecalculateNormals !== false}
                onChange={(e) => updateSetting('autoRecalculateNormals', e.target.checked)}
                className="accent-neutral-900 dark:accent-neutral-100 w-4 h-4 rounded cursor-pointer shrink-0"
              />
            </div>

            {onRecalculateNormals && (
              <button
                id="btn-modal-recalculate-normals"
                type="button"
                onClick={handleManualRecalculate}
                className="w-full mt-1 py-2 px-3 rounded-xl bg-neutral-200/80 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                {recalcFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
                    <span className="text-neutral-900 dark:text-zinc-300 font-semibold">{recalcFeedback}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                    <span>Recalculate & Smooth All Normals Now</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
