import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react';
import {
  IcPointer as MousePointer2,
  IcLasso as CircleDashed,
  IcReset as RotateCcw,
  IcSnapGround as ArrowDownToLine,
  IcCopy as Copy,
  IcDelete as Trash2,
  IcLock as Lock,
  IcUnlock as Unlock,
  IcEye as Eye,
  IcEyeOff as EyeOff,
  IcSparkle as Sparkles,
  IcCompass as Compass,
} from './StudioIcons';
import { StudioEngine } from '../../core/studioEngine';
import {
  ToolType,
  BrushSettings,
  TransformTargetScope,
} from '../../types';
import { haptics } from '../../utils/haptics';

interface SelectPanelProps {
  engine: StudioEngine | null;
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  isGizmoActive: boolean;
  onToggleGizmo: () => void;
  isGizmoLocked: boolean;
  onToggleLock: () => void;
  onOpenNumpad?: any;
  targetScope: TransformTargetScope;
  onSelectTargetScope: (scope: TransformTargetScope) => void;
  onGizmoReset?: () => void;
  theme?: 'light' | 'dark';
}

export const SelectPanel: React.FC<SelectPanelProps> = ({
  engine,
  tool,
  setTool,
  brushSettings,
  setBrushSettings,
  isGizmoActive,
  onToggleGizmo,
  isGizmoLocked,
  onToggleLock,
  targetScope,
  onSelectTargetScope,
  onGizmoReset,
  theme = 'dark',
}) => {
  const [selectionMode, setSelectionMode] = useState<'pointer' | 'lasso'>('pointer');
  const [softSelection, setSoftSelection] = useState<boolean>(false);
  const [showTransformDetails, setShowTransformDetails] = useState<boolean>(false);

  // Track relative transform values for display
  const [transformValues, setTransformValues] = useState({
    posX: 0,
    posY: 0,
    posZ: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    scale: 1.0,
  });

  const isLight = theme === 'light';

  const handlePointerSelect = () => {
    haptics.trigger('light');
    setSelectionMode('pointer');
    setTool('pointer');
  };

  const handleLassoSelect = () => {
    haptics.trigger('light');
    setSelectionMode('lasso');
    setTool('pointer');
  };

  const handleResetTransform = () => {
    haptics.trigger('medium');
    if (engine) {
      engine.resetTransform(targetScope);
      engine.snapToView('isometric');
    }
    onGizmoReset?.();
    setTransformValues({
      posX: 0,
      posY: 0,
      posZ: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      scale: 1.0,
    });
  };

  const handleNudgePos = (axis: 'posX' | 'posY' | 'posZ', delta: number) => {
    haptics.trigger('light');
    if (!engine) return;
    const ax = axis === 'posX' ? 'x' : axis === 'posY' ? 'y' : 'z';
    engine.translateAxis3D(ax, delta, targetScope);
    setTransformValues((prev) => ({ ...prev, [axis]: Math.round((prev[axis] + delta) * 100) / 100 }));
  };

  const handleNudgeRot = (axis: 'rotX' | 'rotY' | 'rotZ', deltaDeg: number) => {
    haptics.trigger('light');
    if (!engine) return;
    const ax = axis === 'rotX' ? 'x' : axis === 'rotY' ? 'y' : 'z';
    engine.rotateAxis3D(ax, (deltaDeg * Math.PI) / 180, targetScope, isGizmoLocked);
    setTransformValues((prev) => ({ ...prev, [axis]: (prev[axis] + deltaDeg + 360) % 360 }));
  };

  const handleNudgeScale = (multiplier: number) => {
    haptics.trigger('light');
    if (!engine) return;
    engine.scaleAxis('uniform', multiplier, targetScope, isGizmoLocked);
    setTransformValues((prev) => ({ ...prev, scale: Math.max(0.05, Math.round(prev.scale * multiplier * 100) / 100) }));
  };

  const cardClass = isLight
    ? 'p-2.5 rounded-xl bg-neutral-100/50 border border-black/5 space-y-1.5'
    : 'p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5';

  const subHeadingClass = `text-[10px] font-bold uppercase tracking-wider ${
    isLight ? 'text-neutral-500' : 'text-neutral-400'
  }`;

  return (
    <div className="space-y-2 text-xs select-none">
      {/* 1. SELECTION TOOLS: Pointer vs Lasso */}
      <div className={cardClass}>
        <div className={subHeadingClass}>Selection Tool</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handlePointerSelect}
            className={`h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-center gap-1.5 font-semibold transition-all ${
              (tool === 'pointer' || tool === 'select') && selectionMode === 'pointer'
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                  : 'bg-white border-white text-neutral-950 shadow-sm'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>Pointer</span>
          </button>

          <button
            type="button"
            onClick={handleLassoSelect}
            className={`h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-center gap-1.5 font-semibold transition-all ${
              (tool === 'pointer' || tool === 'select') && selectionMode === 'lasso'
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                  : 'bg-white border-white text-neutral-950 shadow-sm'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <CircleDashed className="w-3.5 h-3.5" />
            <span>Lasso</span>
          </button>
        </div>
      </div>

      {/* 2. TARGET SCOPE */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className={subHeadingClass}>Target Scope</div>
          <button
            type="button"
            onClick={handleResetTransform}
            className={`h-6 px-1.5 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors ${
              isLight
                ? 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-200/60'
                : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
            title="Reset position, rotation, and scale"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'active_layer' as const, label: 'Active Layer' },
            { id: 'model' as const, label: 'Model' },
            { id: 'strokes' as const, label: 'All Curves' },
            { id: 'guide' as const, label: '3D Guide' },
            { id: 'all' as const, label: 'All Objects' },
          ].map((scope) => (
            <button
              key={scope.id}
              type="button"
              onClick={() => {
                haptics.trigger('light');
                onSelectTargetScope(scope.id);
              }}
              className={`h-8 min-h-[32px] px-2 py-1 rounded-lg border text-center font-medium transition-all text-xs ${
                scope.id === 'all' ? 'col-span-2' : ''
              } ${
                targetScope === scope.id
                  ? isLight
                    ? 'bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs'
                    : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
                  : isLight
                  ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/40'
                  : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. OPTIONS & ACTIONS */}
      <div className={cardClass}>
        <div className={subHeadingClass}>Options & Actions</div>

        <div className="space-y-1.5">
          {/* Show Gizmo Toggle */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onToggleGizmo();
            }}
            className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-between font-medium text-xs transition-colors ${
              isGizmoActive
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white'
                  : 'bg-white border-white text-neutral-950 font-bold'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/40'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>Show Transform Gizmo</span>
            </div>
            {isGizmoActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-50" />}
          </button>

          {/* Lock Selection Toggle */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onToggleLock();
            }}
            className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-between font-medium text-xs transition-colors ${
              isGizmoLocked
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white'
                  : 'bg-white border-white text-neutral-950 font-bold'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/40'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {isGizmoLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>Lock Proportions & Movement</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">{isGizmoLocked ? 'Locked' : 'Free'}</span>
          </button>

          {/* Soft Selection Toggle */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              setSoftSelection((prev) => !prev);
            }}
            className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-between font-medium text-xs transition-colors ${
              softSelection
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white'
                  : 'bg-white border-white text-neutral-950 font-bold'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/40'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Soft Selection Falloff</span>
            </div>
            <span className="text-[10px] font-mono opacity-80">{softSelection ? 'On' : 'Off'}</span>
          </button>
        </div>

        {/* Action Buttons: Snap to ground, Clone, Delete */}
        <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
          <button
            type="button"
            onClick={() => {
              haptics.trigger('medium');
              engine?.snapActiveToGround(targetScope);
            }}
            className={`h-11 min-h-[40px] p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 font-semibold text-[10px] transition-all active:scale-95 ${
              isLight
                ? 'bg-white border-black/10 hover:bg-neutral-200/50 text-neutral-800'
                : 'bg-black/30 border-white/10 hover:bg-white/10 text-white'
            }`}
            title="Auto-snap model to ground plane"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>To Ground</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.trigger('medium');
              engine?.cloneModel();
            }}
            className={`h-11 min-h-[40px] p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 font-semibold text-[10px] transition-all active:scale-95 ${
              isLight
                ? 'bg-white border-black/10 hover:bg-neutral-200/50 text-neutral-800'
                : 'bg-black/30 border-white/10 hover:bg-white/10 text-white'
            }`}
            title="Clone active model"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Clone</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.trigger('medium');
              engine?.deleteActiveSelection();
            }}
            className={`h-11 min-h-[40px] p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 font-semibold text-[10px] transition-all active:scale-95 ${
              isLight
                ? 'bg-red-50 border-red-200 hover:bg-red-100 text-red-700'
                : 'bg-red-950/40 border-red-900/60 hover:bg-red-900/40 text-red-300'
            }`}
            title="Delete selected item (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* 4. TRANSFORM DETAILS */}
      <div className={cardClass}>
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            setShowTransformDetails((prev) => !prev);
          }}
          className="w-full flex items-center justify-between min-h-[28px] py-0.5 text-left"
        >
          <div className={subHeadingClass}>Transform Details</div>
          <div className="flex items-center gap-1.5 opacity-70">
            <span className="text-[10px] font-mono">
              {showTransformDetails ? 'Hide' : 'X / Y / Z'}
            </span>
            {showTransformDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </button>

        {showTransformDetails && (
          <div className="space-y-2 pt-1 border-t border-black/5 dark:border-white/5">
            {/* Position Row with Direct Stepper */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-medium">
                <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Position (m)</span>
                <span className="text-[9px] opacity-60">±0.1m nudge</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { axis: 'posX' as const, label: 'X', val: transformValues.posX },
                  { axis: 'posY' as const, label: 'Y', val: transformValues.posY },
                  { axis: 'posZ' as const, label: 'Z', val: transformValues.posZ },
                ].map(({ axis, label, val }) => (
                  <div
                    key={axis}
                    className={`h-8 min-h-[32px] px-1 rounded-lg border flex items-center justify-between font-mono text-xs ${
                      isLight ? 'bg-white border-black/10 text-neutral-900' : 'bg-black/30 border-white/10 text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleNudgePos(axis, -0.1)}
                      className="w-5 h-6 flex items-center justify-center opacity-60 hover:opacity-100 active:scale-90"
                      title={`Decrease ${label}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-bold font-mono">{label}: {val.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleNudgePos(axis, 0.1)}
                      className="w-5 h-6 flex items-center justify-center opacity-60 hover:opacity-100 active:scale-90"
                      title={`Increase ${label}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Rotation Row with Direct 15° Stepper */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-[10px] font-medium">
                <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Rotation (°)</span>
                <span className="text-[9px] opacity-60">±15° nudge</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { axis: 'rotX' as const, label: 'X', val: transformValues.rotX },
                  { axis: 'rotY' as const, label: 'Y', val: transformValues.rotY },
                  { axis: 'rotZ' as const, label: 'Z', val: transformValues.rotZ },
                ].map(({ axis, label, val }) => (
                  <div
                    key={axis}
                    className={`h-8 min-h-[32px] px-1 rounded-lg border flex items-center justify-between font-mono text-xs ${
                      isLight ? 'bg-white border-black/10 text-neutral-900' : 'bg-black/30 border-white/10 text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleNudgeRot(axis, -15)}
                      className="w-5 h-6 flex items-center justify-center opacity-60 hover:opacity-100 active:scale-90"
                      title={`Rotate -15° on ${label}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] font-bold font-mono">{label}: {Math.round(val)}°</span>
                    <button
                      type="button"
                      onClick={() => handleNudgeRot(axis, 15)}
                      className="w-5 h-6 flex items-center justify-center opacity-60 hover:opacity-100 active:scale-90"
                      title={`Rotate +15° on ${label}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Scale Row */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-[10px] font-medium">
                <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Uniform Scale</span>
                <span className="text-[9px] opacity-60">Scale factor</span>
              </div>
              <div
                className={`w-full h-8 min-h-[32px] px-2 rounded-lg border flex items-center justify-between font-mono text-xs ${
                  isLight ? 'bg-white border-black/10 text-neutral-900' : 'bg-black/30 border-white/10 text-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleNudgeScale(0.9)}
                  className="px-2 h-6 flex items-center justify-center opacity-70 hover:opacity-100 active:scale-90 font-bold"
                  title="Scale down (0.9x)"
                >
                  <Minus className="w-3.5 h-3.5 mr-1" /> Smaller
                </button>
                <span className="font-bold text-xs">{transformValues.scale.toFixed(2)}×</span>
                <button
                  type="button"
                  onClick={() => handleNudgeScale(1.1)}
                  className="px-2 h-6 flex items-center justify-center opacity-70 hover:opacity-100 active:scale-90 font-bold"
                  title="Scale up (1.1x)"
                >
                  Larger <Plus className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
