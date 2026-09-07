import React from 'react';
import { CustomMirrorPlane, NumpadTarget } from '../types';
import {
  Compass,
  RotateCcw,
  Eye,
  Check,
  X,
  Sliders,
  Move,
  RotateCw,
  Camera,
} from 'lucide-react';
import { StudioEngine } from '../core/studioEngine';
import { getThemeClasses } from '../utils/themeStyles';

interface CustomMirrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mirrorConfig?: CustomMirrorPlane;
  setMirrorConfig?: React.Dispatch<React.SetStateAction<CustomMirrorPlane>>;
  config?: { planeOrigin: [number, number, number]; planeNormal: [number, number, number]; visible: boolean };
  onConfigChange?: (newCfg: { planeOrigin: [number, number, number]; planeNormal: [number, number, number]; visible: boolean }) => void;
  onAlignToCamera?: () => void;
  engine: StudioEngine | null;
  onOpenNumpad?: (target: NumpadTarget) => void;
  theme?: 'light' | 'dark';
}

export const CustomMirrorModal: React.FC<CustomMirrorModalProps> = ({
  isOpen,
  onClose,
  mirrorConfig: propMirrorConfig,
  setMirrorConfig: propSetMirrorConfig,
  config,
  onConfigChange,
  onAlignToCamera: propAlignToCamera,
  engine,
  onOpenNumpad,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  const t = getThemeClasses(theme);
  const isLight = theme === 'light';

  // Support both legacy mirrorConfig and newer config props
  const currentOrigin = config
    ? { x: config.planeOrigin[0], y: config.planeOrigin[1], z: config.planeOrigin[2] }
    : propMirrorConfig?.origin || { x: 0, y: 0, z: 0 };
  const currentNormal = config
    ? { x: config.planeNormal[0], y: config.planeNormal[1], z: config.planeNormal[2] }
    : propMirrorConfig?.normal || { x: 1, y: 0, z: 0 };
  const isEnabled = config ? config.visible : (propMirrorConfig?.enabled ?? true);

  const handleAlignToCamera = () => {
    if (propAlignToCamera) {
      propAlignToCamera();
      return;
    }
    if (!engine) return;
    const camInfo = engine.getCameraOrientationForMirror();
    if (camInfo) {
      if (propSetMirrorConfig) {
        propSetMirrorConfig((prev) => ({
          ...prev,
          origin: { ...camInfo.target },
          normal: { ...camInfo.normal },
          rotation: { ...camInfo.rotation },
          enabled: true,
          visible: true,
        }));
      }
      engine.setCustomMirrorPlane(camInfo.target, camInfo.normal, true);
    }
  };

  const handleResetToCenter = () => {
    if (config && onConfigChange) {
      onConfigChange({
        planeOrigin: [0, 0, 0],
        planeNormal: [1, 0, 0],
        visible: true,
      });
      engine?.updateCustomMirrorPlane([0, 0, 0], [1, 0, 0]);
      return;
    }
    const defaultPlane = {
      enabled: true,
      origin: { x: 0, y: 0, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      visible: true,
      opacity: 0.4,
    };
    propSetMirrorConfig?.(defaultPlane);
    engine?.setCustomMirrorPlane(defaultPlane.origin, defaultPlane.normal, true);
  };

  const handleToggleEnable = () => {
    const nextEnabled = !isEnabled;
    if (config && onConfigChange) {
      onConfigChange({
        ...config,
        visible: nextEnabled,
      });
    } else if (propSetMirrorConfig) {
      propSetMirrorConfig((prev) => ({ ...prev, enabled: nextEnabled, visible: nextEnabled }));
      engine?.toggleCustomMirrorPlane(nextEnabled);
    }
  };

  return (
    <div className={`pr-surface paperrocket-context-panel fixed left-[76px] sm:left-[88px] top-1/2 -translate-y-1/2 z-50 w-[300px] max-w-[calc(100vw-6rem)] max-h-[72vh] overflow-y-auto select-none shadow-2xl rounded-2xl border p-4 space-y-3 font-sans animate-in fade-in slide-in-from-left-2 duration-150 ${isLight ? 'bg-white border-black/10 shadow-black/10' : 'bg-[#18191d] border-neutral-800 shadow-black/50'} ${t.shell}`}>
      {/* Header */}
      <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        <div className="flex items-center gap-2">
          <Compass className={`w-4 h-4 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${t.textPrimary}`}>
            Mirror
          </span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg transition-colors ${t.btnGhost}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Enable Toggle */}
      <div className={`flex items-center justify-between p-2 rounded-xl border ${t.innerCard}`}>
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isEnabled ? 'bg-neutral-900 dark:bg-white animate-pulse' : (isLight ? 'bg-neutral-300' : 'bg-neutral-600')
            }`}
          />
          <span className={`text-xs font-semibold ${t.textPrimary}`}>Mirror Plane Symmetry</span>
        </div>
        <button
          onClick={handleToggleEnable}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            isEnabled
              ? 'bg-neutral-900 dark:bg-white hover:bg-neutral-900 dark:bg-white text-neutral-950 shadow-xs'
              : t.btnSecondary
          }`}
        >
          {isEnabled ? 'Active' : 'Disabled'}
        </button>
      </div>

      {/* Origin Coordinates (P0) */}
      <div className="space-y-1.5">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${t.textSecondary}`}>
          Plane Origin (P₀)
        </span>
        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
          {(['x', 'y', 'z'] as const).map((axis, idx) => {
            const val = axis === 'x' ? currentOrigin.x : axis === 'y' ? currentOrigin.y : currentOrigin.z;
            return (
              <button
                key={axis}
                onClick={() =>
                  onOpenNumpad?.({
                    id: `mirror_origin_${axis}`,
                    title: `Mirror Origin ${axis.toUpperCase()}`,
                    value: val,
                    min: -5.0,
                    max: 5.0,
                    step: 0.05,
                    unit: 'm',
                    onConfirm: (newVal) => {
                      if (config && onConfigChange) {
                        const newOrigin: [number, number, number] = [
                          idx === 0 ? newVal : config.planeOrigin[0],
                          idx === 1 ? newVal : config.planeOrigin[1],
                          idx === 2 ? newVal : config.planeOrigin[2],
                        ];
                        onConfigChange({ ...config, planeOrigin: newOrigin });
                        engine?.updateCustomMirrorPlane(newOrigin, config.planeNormal);
                      } else if (propSetMirrorConfig) {
                        const next = { ...currentOrigin, [axis]: newVal };
                        propSetMirrorConfig((prev) => ({ ...prev, origin: next }));
                        engine?.setCustomMirrorPlane(next, currentNormal, isEnabled);
                      }
                    },
                  })
                }
                className={`p-1.5 rounded-lg border flex items-center justify-between transition-colors ${
                  isLight
                    ? 'bg-neutral-50 hover:bg-neutral-100 border-black/10 text-neutral-800'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                }`}
              >
                <span className={`font-bold uppercase ${t.textMuted}`}>{axis}:</span>
                <span className={`font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>
                  {val.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Normal Direction (n) */}
      <div className="space-y-1.5">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${t.textSecondary}`}>
          Plane Normal Vector (n̂)
        </span>
        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
          {(['x', 'y', 'z'] as const).map((axis, idx) => {
            const val = axis === 'x' ? currentNormal.x : axis === 'y' ? currentNormal.y : currentNormal.z;
            return (
              <button
                key={axis}
                onClick={() =>
                  onOpenNumpad?.({
                    id: `mirror_norm_${axis}`,
                    title: `Mirror Normal ${axis.toUpperCase()}`,
                    value: val,
                    min: -1.0,
                    max: 1.0,
                    step: 0.1,
                    unit: '',
                    onConfirm: (newVal) => {
                      if (config && onConfigChange) {
                        const newNorm: [number, number, number] = [
                          idx === 0 ? newVal : config.planeNormal[0],
                          idx === 1 ? newVal : config.planeNormal[1],
                          idx === 2 ? newVal : config.planeNormal[2],
                        ];
                        onConfigChange({ ...config, planeNormal: newNorm });
                        engine?.updateCustomMirrorPlane(config.planeOrigin, newNorm);
                      } else if (propSetMirrorConfig) {
                        const next = { ...currentNormal, [axis]: newVal };
                        propSetMirrorConfig((prev) => ({ ...prev, normal: next }));
                        engine?.setCustomMirrorPlane(currentOrigin, next, isEnabled);
                      }
                    },
                  })
                }
                className={`p-1.5 rounded-lg border flex items-center justify-between transition-colors ${
                  isLight
                    ? 'bg-neutral-50 hover:bg-neutral-100 border-black/10 text-neutral-800'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                }`}
              >
                <span className={`font-bold uppercase ${t.textMuted}`}>{axis}:</span>
                <span className={`font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>{val.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Orientations */}
      <div className={`pt-2 border-t grid grid-cols-2 gap-2 ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        <button
          onClick={handleAlignToCamera}
          className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            isLight
              ? 'bg-neutral-100 dark:bg-white/5 hover:bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-neutral-200 border border-black/10 dark:border-white/10'
              : 'bg-black/30 dark:bg-white/5/60 hover:bg-neutral-800 dark:bg-white/10/80 border border-neutral-700 dark:border-neutral-300/60 text-neutral-800 dark:text-zinc-200'
          }`}
          title="Align mirror plane perpendicular to current camera view"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Align to View</span>
        </button>
        <button
          onClick={handleResetToCenter}
          className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${t.btnSecondary}`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Center YZ</span>
        </button>
      </div>
    </div>
  );
};
