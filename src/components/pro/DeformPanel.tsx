import React, { useState } from 'react';
import {
  IcMove as Move,
  IcArmature as Shield,
  IcMirror as Compass,
  IcSimplify as Scissors,
  IcCamera as Camera,
  IcSparkle as Sparkles,
  IcBend as Spline,
  IcMirrorSettings,
  IcAlignView,
  IcSimplifySettings,
  IcQuickSimplify,
} from './StudioIcons';
import { StudioEngine } from '../../core/studioEngine';
import { LiquifySettings, NumpadTarget, ToolType } from '../../types';
import { LiquifyPanel } from '../LiquifyPanel';
import { haptics } from '../../utils/haptics';

export interface DeformPanelProps {
  engine?: StudioEngine | null;
  tool?: ToolType;
  setTool?: (tool: ToolType) => void;
  liquifySettings?: LiquifySettings;
  setLiquifySettings?: (settings: LiquifySettings) => void;
  isLiquifyOpen?: boolean;
  onOpenLiquify?: () => void;
  isCompareActive?: boolean;
  onToggleCompare?: (active: boolean) => void;
  onApplyLiquify?: () => void;
  onCancelLiquify?: () => void;
  onOpenScaffolding?: () => void;
  onOpenBentGuide?: () => void;
  onOpenCustomMirror?: () => void;
  onOpenDecimate?: () => void;
  onOpenNumpad?: (target: NumpadTarget) => void;
  theme?: 'light' | 'dark';
}

export const DeformPanel: React.FC<DeformPanelProps> = ({
  engine = null,
  tool = 'brush',
  setTool = (_t: ToolType) => {},
  liquifySettings,
  setLiquifySettings,
  isLiquifyOpen = false,
  onOpenLiquify,
  isCompareActive = false,
  onToggleCompare = () => {},
  onApplyLiquify,
  onCancelLiquify,
  onOpenScaffolding = () => {},
  onOpenBentGuide = () => {},
  onOpenCustomMirror = () => {},
  onOpenDecimate = () => {},
  onOpenNumpad,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const isPushPullActive = tool === 'liquify' || isLiquifyOpen;
  const [mirrorAxis, setMirrorAxis] = useState<'x' | 'y' | 'z' | null>(null);
  const [decimateTolerance, setDecimateTolerance] = useState<number>(0.006);
  const [simplifyFeedback, setSimplifyFeedback] = useState<string | null>(null);

  const handleStartPushPull = () => {
    haptics.trigger('medium');
    if (onOpenLiquify) {
      onOpenLiquify();
    } else {
      setTool('liquify');
      engine?.startLiquifySession();
    }
  };

  const handleApplyPushPull = () => {
    haptics.trigger('medium');
    if (onApplyLiquify) {
      onApplyLiquify();
    } else {
      engine?.commitLiquify();
      setTool('brush');
    }
  };

  const handleCancelPushPull = () => {
    haptics.trigger('light');
    if (onCancelLiquify) {
      onCancelLiquify();
    } else {
      engine?.cancelLiquify();
      setTool('brush');
    }
  };

  const handleToggleAxis = (axis: 'x' | 'y' | 'z') => {
    haptics.trigger('medium');
    if (mirrorAxis === axis) {
      setMirrorAxis(null);
      engine?.toggleCustomMirrorPlane(false);
    } else {
      setMirrorAxis(axis);
      const normal = axis === 'x' ? { x: 1, y: 0, z: 0 } : axis === 'y' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
      engine?.setCustomMirrorPlane({ x: 0, y: 0, z: 0 }, normal, true);
    }
  };

  const handleAlignMirrorToView = () => {
    haptics.trigger('medium');
    if (!engine) return;
    const camInfo = engine.getCameraOrientationForMirror();
    if (camInfo) {
      engine.setCustomMirrorPlane(camInfo.target, camInfo.normal, true);
    }
  };

  const handleRunSimplify = () => {
    haptics.trigger('medium');
    if (!engine) return;
    const stats = engine.decimateCurves(decimateTolerance, 'layer');
    if (stats && stats.before > 0) {
      const pct = Math.round(((stats.before - stats.after) / stats.before) * 100);
      setSimplifyFeedback(`Reduced ${pct}%`);
    } else {
      setSimplifyFeedback('Done');
    }
    setTimeout(() => setSimplifyFeedback(null), 2500);
  };

  const cardClass = isLight
    ? 'p-2.5 rounded-xl bg-neutral-100/50 border border-black/5 space-y-1.5'
    : 'p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5';

  const subHeadingClass = `text-[10px] font-bold uppercase tracking-wider ${
    isLight ? 'text-neutral-500' : 'text-neutral-400'
  }`;

  return (
    <div className="space-y-2 font-sans text-xs select-none">
      {/* 1. Push & Pull (Inflate/Deflate) */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Move className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`} />
            <span className={subHeadingClass}>Push & Pull</span>
          </div>
          {isPushPullActive && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
              Active
            </span>
          )}
        </div>

        {isPushPullActive && liquifySettings ? (
          <div className="pt-0.5">
            <LiquifyPanel
              inline={true}
              settings={liquifySettings}
              onSettingsChange={setLiquifySettings}
              isCompareActive={isCompareActive}
              onToggleCompare={onToggleCompare}
              onApply={handleApplyPushPull}
              onCancel={handleCancelPushPull}
              onReset={() => {
                engine?.cancelLiquify();
                engine?.startLiquifySession();
              }}
              onOpenNumpad={onOpenNumpad}
              theme={theme}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartPushPull}
            className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-98 ${
              isLight
                ? 'bg-neutral-900 hover:bg-neutral-800 text-white'
                : 'bg-white hover:bg-neutral-100 text-neutral-950'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>Start Push & Pull</span>
          </button>
        )}
      </div>

      {/* 2. Symmetry / Mirror */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Compass className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`} />
            <span className={subHeadingClass}>Symmetry & Mirror</span>
          </div>
          <span className="font-mono text-[9px] opacity-70">
            {mirrorAxis ? `${mirrorAxis.toUpperCase()}-Axis` : 'Off'}
          </span>
        </div>

        {/* X, Y, Z axis toggle buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          {(['x', 'y', 'z'] as const).map((axis) => {
            const isSelected = mirrorAxis === axis;
            return (
              <button
                key={axis}
                type="button"
                onClick={() => handleToggleAxis(axis)}
                className={`h-8 min-h-[32px] rounded-lg border font-bold text-xs transition-all active:scale-95 ${
                  isSelected
                    ? isLight
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                      : 'bg-white border-white text-neutral-950 shadow-xs'
                    : isLight
                    ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                    : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
                }`}
              >
                {axis.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={handleAlignMirrorToView}
            className={`h-8 min-h-[32px] px-2 py-1 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-all text-xs ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-black/10 text-neutral-800'
                : 'bg-black/30 hover:bg-white/10 border-white/10 text-neutral-200'
            }`}
            title="Align mirror plane to current camera view"
          >
            <IcAlignView className="w-3.5 h-3.5 shrink-0" />
            <span>Align View</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onOpenCustomMirror();
            }}
            className={`h-8 min-h-[32px] px-2 py-1 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-all text-xs ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-black/10 text-neutral-800'
                : 'bg-black/30 hover:bg-white/10 border-white/10 text-neutral-200'
            }`}
          >
            <IcMirrorSettings className="w-3.5 h-3.5 shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* 3. Guides & Curves */}
      <div className={cardClass}>
        <div className="flex items-center gap-1.5">
          <Shield className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`} />
          <span className={subHeadingClass}>Guides & Curves</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onOpenScaffolding();
            }}
            className={`h-8 min-h-[32px] px-2 py-1 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-all text-xs ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-black/10 text-neutral-800'
                : 'bg-black/30 hover:bg-white/10 border-white/10 text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>Armatures</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onOpenBentGuide();
            }}
            className={`h-8 min-h-[32px] px-2 py-1 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-all text-xs ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-black/10 text-neutral-800'
                : 'bg-black/30 hover:bg-white/10 border-white/10 text-neutral-200'
            }`}
          >
            <Spline className="w-3.5 h-3.5 shrink-0" />
            <span>Bend Path</span>
          </button>
        </div>
      </div>

      {/* 4. Simplify & Decimate */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Scissors className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`} />
            <span className={subHeadingClass}>Simplify & Decimate</span>
          </div>
          <span className="font-mono text-[9px] font-bold">
            {Math.round((decimateTolerance / 0.02) * 100)}%
          </span>
        </div>

        {/* Reduction slider */}
        <div className="space-y-1">
          <input
            type="range"
            min="0.001"
            max="0.02"
            step="0.001"
            value={decimateTolerance}
            onChange={(e) => setDecimateTolerance(parseFloat(e.target.value))}
            className={`w-full h-1.5 rounded cursor-pointer ${
              isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
            }`}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={handleRunSimplify}
            className={`h-8 min-h-[32px] px-2 py-1 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 shadow-xs ${
              isLight
                ? 'bg-neutral-900 hover:bg-neutral-800 text-white'
                : 'bg-white hover:bg-neutral-100 text-neutral-950'
            }`}
          >
            <IcQuickSimplify className="w-3.5 h-3.5 shrink-0" />
            <span>{simplifyFeedback || 'Simplify Now'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onOpenDecimate();
            }}
            className={`h-8 min-h-[32px] px-2 py-1 rounded-lg border font-semibold flex items-center justify-center gap-1.5 transition-all text-xs ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-black/10 text-neutral-800'
                : 'bg-black/30 hover:bg-white/10 border-white/10 text-neutral-200'
            }`}
          >
            <IcSimplifySettings className="w-3.5 h-3.5 shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

