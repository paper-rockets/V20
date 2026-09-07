import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  IcPointer as MousePointer2,
  IcLasso as CircleDashed,
  IcOrigin as Crosshair,
  IcReset as RotateCcw,
  IcSnapGround as ArrowDownToLine,
  IcCopy as Copy,
  IcDelete as Trash2,
  IcLock as Lock,
  IcUnlock as Unlock,
  IcEye as Eye,
  IcEyeOff as EyeOff,
  IcSparkle as Sparkles,
  IcRefresh as RefreshCw,
  IcCheck as Check,
  IcCompass as Compass,
} from './StudioIcons';
import { StudioEngine } from '../../core/studioEngine';
import {
  ToolType,
  BrushSettings,
  TransformTargetScope,
  NumpadTarget,
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
  onOpenNumpad?: (target: NumpadTarget) => void;
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
  onOpenNumpad,
  targetScope,
  onSelectTargetScope,
  onGizmoReset,
  theme = 'dark',
}) => {
  const [selectionMode, setSelectionMode] = useState<'pointer' | 'lasso'>('pointer');
  const [softSelection, setSoftSelection] = useState<boolean>(false);
  const [showTransformDetails, setShowTransformDetails] = useState<boolean>(false);
  const [showAdvancedSnapping, setShowAdvancedSnapping] = useState<boolean>(false);
  const [recalcFeedback, setRecalcFeedback] = useState<string | null>(null);

  // Track relative transform values for display & numeric input
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

  const updateBrushSetting = <K extends keyof BrushSettings>(key: K, value: BrushSettings[K]) => {
    setBrushSettings((prev) => ({ ...prev, [key]: value }));
  };

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

  const handleOpenNumpadValue = (
    field: 'posX' | 'posY' | 'posZ' | 'rotX' | 'rotY' | 'rotZ' | 'scale',
    title: string,
    unit: string,
    min: number,
    max: number,
    step: number
  ) => {
    if (!onOpenNumpad) return;
    haptics.trigger('light');

    const currentValue = transformValues[field];
    onOpenNumpad({
      id: `transform-${field}`,
      title,
      value: currentValue,
      min,
      max,
      step,
      unit,
      onConfirm: (val: number) => {
        if (!engine) return;
        if (field === 'posX') {
          engine.translateAxis3D('x', val - currentValue, targetScope);
          setTransformValues((prev) => ({ ...prev, posX: val }));
        } else if (field === 'posY') {
          engine.translateAxis3D('y', val - currentValue, targetScope);
          setTransformValues((prev) => ({ ...prev, posY: val }));
        } else if (field === 'posZ') {
          engine.translateAxis3D('z', val - currentValue, targetScope);
          setTransformValues((prev) => ({ ...prev, posZ: val }));
        } else if (field === 'rotX') {
          engine.rotateAxis3D('x', ((val - currentValue) * Math.PI) / 180, targetScope, isGizmoLocked);
          setTransformValues((prev) => ({ ...prev, rotX: val }));
        } else if (field === 'rotY') {
          engine.rotateAxis3D('y', ((val - currentValue) * Math.PI) / 180, targetScope, isGizmoLocked);
          setTransformValues((prev) => ({ ...prev, rotY: val }));
        } else if (field === 'rotZ') {
          engine.rotateAxis3D('z', ((val - currentValue) * Math.PI) / 180, targetScope, isGizmoLocked);
          setTransformValues((prev) => ({ ...prev, rotZ: val }));
        } else if (field === 'scale') {
          const factor = val / (currentValue || 1.0);
          engine.scaleAxis('uniform', factor, targetScope, isGizmoLocked);
          setTransformValues((prev) => ({ ...prev, scale: val }));
        }
      },
    });
  };

  const handleManualRecalculate = () => {
    if (engine) {
      const count = engine.recalculateMeshNormals();
      setRecalcFeedback(typeof count === 'number' ? `Updated ${count} meshes` : 'Normals smoothed');
      setTimeout(() => setRecalcFeedback(null), 2500);
    }
  };

  const cardClass = isLight
    ? 'p-2.5 rounded-xl bg-neutral-100/50 border border-black/5 space-y-1.5'
    : 'p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5';

  const subHeadingClass = `text-[10px] font-bold uppercase tracking-wider ${
    isLight ? 'text-neutral-500' : 'text-neutral-400'
  }`;

  return (
    <div className="space-y-2 text-xs select-none">
      {/* 1. SELECTION MODE: Pointer / Lasso toggle */}
      <div className={cardClass}>
        <div className={subHeadingClass}>Selection Mode</div>
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

      {/* 4. TRANSFORM DETAILS (Expandable Accordion) */}
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
            {/* Position Row */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-medium">
                <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Position (m)</span>
                <span className="text-[9px] opacity-60">Tap to edit</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { axis: 'posX' as const, label: 'X', val: transformValues.posX },
                  { axis: 'posY' as const, label: 'Y', val: transformValues.posY },
                  { axis: 'posZ' as const, label: 'Z', val: transformValues.posZ },
                ].map(({ axis, label, val }) => (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => handleOpenNumpadValue(axis, `Position ${label}`, 'm', -100, 100, 0.1)}
                    className={`h-8 min-h-[32px] px-2 py-1 rounded-lg border flex items-center justify-between font-mono text-xs transition-colors ${
                      isLight
                        ? 'bg-white border-black/10 hover:border-black/30 text-neutral-900'
                        : 'bg-black/30 border-white/10 hover:border-white/30 text-white'
                    }`}
                  >
                    <span className="font-sans text-[10px] font-bold opacity-60">{label}</span>
                    <span>{val.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation Row */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-[10px] font-medium">
                <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Rotation (°)</span>
                <span className="text-[9px] opacity-60">Tap to edit</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { axis: 'rotX' as const, label: 'X', val: transformValues.rotX },
                  { axis: 'rotY' as const, label: 'Y', val: transformValues.rotY },
                  { axis: 'rotZ' as const, label: 'Z', val: transformValues.rotZ },
                ].map(({ axis, label, val }) => (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => handleOpenNumpadValue(axis, `Rotation ${label}`, '°', -360, 360, 15)}
                    className={`h-8 min-h-[32px] px-2 py-1 rounded-lg border flex items-center justify-between font-mono text-xs transition-colors ${
                      isLight
                        ? 'bg-white border-black/10 hover:border-black/30 text-neutral-900'
                        : 'bg-black/30 border-white/10 hover:border-white/30 text-white'
                    }`}
                  >
                    <span className="font-sans text-[10px] font-bold opacity-60">{label}</span>
                    <span>{Math.round(val)}°</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scale Row */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-[10px] font-medium">
                <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Uniform Scale</span>
                <span className="text-[9px] opacity-60">Tap to edit</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenNumpadValue('scale', 'Uniform Scale', '×', 0.05, 20, 0.1)}
                className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-between font-mono text-xs transition-colors ${
                  isLight
                    ? 'bg-white border-black/10 hover:border-black/30 text-neutral-900'
                    : 'bg-black/30 border-white/10 hover:border-white/30 text-white'
                }`}
              >
                <span className="font-sans text-[10px] font-bold opacity-60">Scale Factor</span>
                <span>{transformValues.scale.toFixed(2)}×</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. ADVANCED SNAPPING (Expandable Accordion) */}
      <div className={cardClass}>
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            setShowAdvancedSnapping((prev) => !prev);
          }}
          className="w-full flex items-center justify-between min-h-[28px] py-0.5 text-left"
        >
          <div className={subHeadingClass}>Advanced Snapping</div>
          <div className="flex items-center gap-1.5 opacity-70">
            <span className="text-[10px] font-mono">
              {showAdvancedSnapping ? 'Hide' : 'Surface / Normals'}
            </span>
            {showAdvancedSnapping ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </button>

        {showAdvancedSnapping && (
          <div className="space-y-2 pt-1 border-t border-black/5 dark:border-white/5">
            {/* Sampling Density */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-semibold text-current">Alignment Detail</span>
                <span className="font-mono text-[10px] opacity-70">
                  {brushSettings.raycastSampleDensity === 'ultra'
                    ? 'Ultra (48 steps)'
                    : brushSettings.raycastSampleDensity === 'standard'
                    ? 'Standard (16 steps)'
                    : 'High (32 steps)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'standard' as const, label: 'Standard' },
                  { id: 'high' as const, label: 'High' },
                  { id: 'ultra' as const, label: 'Ultra' },
                ].map((lvl) => {
                  const isSel = (brushSettings.raycastSampleDensity || 'high') === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        haptics.trigger('light');
                        updateBrushSetting('raycastSampleDensity', lvl.id);
                      }}
                      className={`h-8 min-h-[32px] py-1 px-2 rounded-lg border text-center font-medium transition-all text-xs ${
                        isSel
                          ? isLight
                            ? 'bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs'
                            : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
                          : isLight
                          ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                          : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Surface Offset Slider */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-medium text-current">Surface Offset (Elevation)</span>
                <span className="font-mono text-[10px] font-semibold">
                  {((brushSettings.surfaceOffset ?? 0.0015) * 1000).toFixed(1)} mm
                </span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.010"
                step="0.0005"
                value={brushSettings.surfaceOffset ?? 0.0015}
                onChange={(e) => updateBrushSetting('surfaceOffset', parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded cursor-pointer ${
                  isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
                }`}
              />
            </div>

            {/* Toggles */}
            <div className="space-y-1 pt-1 border-t border-black/5 dark:border-white/5">
              <label className="flex items-center justify-between min-h-[32px] py-0.5 cursor-pointer">
                <span className="text-[11px] font-medium">Gap & Seam Bridging</span>
                <input
                  type="checkbox"
                  checked={brushSettings.raycastSeamBridging !== false}
                  onChange={(e) => updateBrushSetting('raycastSeamBridging', e.target.checked)}
                  className="w-4 h-4 rounded accent-neutral-900 dark:accent-white cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between min-h-[32px] py-0.5 cursor-pointer">
                <span className="text-[11px] font-medium">Double-Sided Surfaces</span>
                <input
                  type="checkbox"
                  checked={brushSettings.doubleSidedRaycast !== false}
                  onChange={(e) => updateBrushSetting('doubleSidedRaycast', e.target.checked)}
                  className="w-4 h-4 rounded accent-neutral-900 dark:accent-white cursor-pointer"
                />
              </label>
            </div>

            {/* Smooth Normals Action */}
            <button
              type="button"
              onClick={handleManualRecalculate}
              className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-center gap-1.5 font-semibold text-xs transition-all active:scale-98 ${
                isLight
                  ? 'bg-white border-black/10 hover:bg-neutral-200/50 text-neutral-800'
                  : 'bg-black/30 border-white/10 hover:bg-white/10 text-neutral-200'
              }`}
            >
              {recalcFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{recalcFeedback}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Smooth Surface Normals Now</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
