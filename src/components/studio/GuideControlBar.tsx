import React from 'react';
import { Spline, Shield, Move, Sliders, Check, Trash2, X, Eye } from 'lucide-react';
import { ActiveGuideReference, TransformTargetScope, ToolType } from '../../types';
import { StudioEngine } from '../../core/studioEngine';
import { haptics } from '../../utils/haptics';

export interface GuideControlBarProps {
  activeGuide: ActiveGuideReference | null;
  engine: StudioEngine | null;
  targetScope: TransformTargetScope;
  onSelectTargetScope: (scope: TransformTargetScope) => void;
  isGizmoActive: boolean;
  onToggleGizmo: () => void;
  onOpenBentGuide: () => void;
  onOpenScaffolding: () => void;
  setTool: (tool: ToolType) => void;
  onGuideDone?: () => void;
  theme?: 'light' | 'dark';
}

export const GuideControlBar: React.FC<GuideControlBarProps> = ({
  activeGuide,
  engine,
  targetScope,
  onSelectTargetScope,
  isGizmoActive,
  onToggleGizmo,
  onOpenBentGuide,
  onOpenScaffolding,
  setTool,
  onGuideDone,
  theme = 'dark',
}) => {
  if (!activeGuide) return null;

  const isLight = theme === 'light';
  const isGuideScopeActive = targetScope === 'guide';

  const handleToggleMoveStretch = () => {
    haptics.trigger('light');
    if (!isGuideScopeActive) {
      onSelectTargetScope('guide');
      if (!isGizmoActive) {
        onToggleGizmo();
      }
    } else {
      onToggleGizmo();
    }
  };

  const handleOpenSettings = () => {
    haptics.trigger('light');
    if (activeGuide.type === 'bent') {
      onOpenBentGuide();
    } else {
      onOpenScaffolding();
    }
  };

  const handleDoneDrawOnGuide = () => {
    haptics.trigger('success');
    if (engine) {
      engine.currentDrawingMode = 'surface';
    }
    setTool('brush');
    if (isGizmoActive && isGuideScopeActive) {
      onToggleGizmo();
    }
    onGuideDone?.();
  };

  const handleDelete = () => {
    haptics.trigger('medium');
    if (!engine) return;
    engine.removeActiveGuide();
  };

  const handleDismissBar = () => {
    haptics.trigger('light');
    if (engine) {
      engine.setActiveGuide(null);
    }
  };

  return (
    <div
      id="paperrocket-guide-control-bar"
      data-guide-control-bar="true"
      className={`fixed left-1/2 -translate-x-1/2 bottom-[82px] z-40 max-w-[calc(100vw-24px)] flex items-center gap-1.5 p-1.5 rounded-2xl border shadow-xl backdrop-blur-md select-none animate-in fade-in slide-in-from-bottom-2 duration-150 ${
        isLight
          ? 'bg-white/95 border-black/10 text-neutral-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)]'
          : 'bg-[#181a1f]/95 border-white/15 text-neutral-100 shadow-[0_12px_36px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* Guide Identity Badge */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
        {activeGuide.type === 'bent' ? (
          <Spline className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Shield className="w-3.5 h-3.5 shrink-0" />
        )}
        <div className="flex flex-col leading-tight max-w-[110px] sm:max-w-[160px] truncate">
          <span className="text-[10.5px] font-bold truncate text-current">
            {activeGuide.name}
          </span>
          <span className="text-[8.5px] opacity-75 font-mono uppercase tracking-wider">
            3D Guide
          </span>
        </div>
      </div>

      {/* Move & Stretch Button */}
      <button
        type="button"
        data-guide-action="move-stretch"
        onClick={handleToggleMoveStretch}
        className={`h-9 min-h-[36px] px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
          isGuideScopeActive && isGizmoActive
            ? isLight
              ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
              : 'bg-white border-white text-neutral-950 shadow-xs'
            : isLight
            ? 'bg-neutral-100 border-black/10 text-neutral-700 hover:bg-neutral-200/60'
            : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
        }`}
        title="Move, rotate, and stretch this guide using 3D handles"
      >
        <Move className="w-3.5 h-3.5" />
        <span className="hidden xs:inline text-[11px]">Move & Stretch</span>
      </button>

      {/* Shape Settings Button */}
      <button
        type="button"
        data-guide-action="shape-settings"
        onClick={handleOpenSettings}
        className={`h-9 min-h-[36px] px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
          isLight
            ? 'bg-neutral-100 border-black/10 text-neutral-700 hover:bg-neutral-200/60'
            : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
        }`}
        title="Tweak guide shape, width, twist, or tension"
      >
        <Sliders className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-[11px]">Shape</span>
      </button>

      {/* Done: Draw on Guide Button */}
      <button
        type="button"
        data-guide-action="draw-on-guide"
        onClick={handleDoneDrawOnGuide}
        className="h-9 min-h-[36px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-transform active:scale-95 border border-emerald-400/30"
        title="Lock guide and start drawing directly on its surface"
      >
        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="text-[11px]">Draw on Guide</span>
      </button>

      {/* Delete Guide Button */}
      <button
        type="button"
        data-guide-action="delete-guide"
        onClick={handleDelete}
        className={`h-9 w-9 min-h-[36px] min-w-[36px] p-0 rounded-xl border flex items-center justify-center transition-colors active:scale-95 ${
          isLight
            ? 'border-black/10 text-neutral-400 hover:text-red-600 hover:bg-red-50'
            : 'border-white/10 text-neutral-400 hover:text-red-400 hover:bg-red-950/30'
        }`}
        title="Delete this 3D guide"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Dismiss HUD */}
      <button
        type="button"
        data-guide-action="dismiss-guide"
        onClick={handleDismissBar}
        className={`h-9 w-8 min-h-[36px] p-0 rounded-xl flex items-center justify-center transition-colors opacity-60 hover:opacity-100 ${
          isLight ? 'text-neutral-700' : 'text-neutral-300'
        }`}
        title="Hide guide controls"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
