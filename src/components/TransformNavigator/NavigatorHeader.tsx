import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  Unlock,
  RotateCcw,
  PenTool,
  Vibrate,
  Copy,
  ClipboardPaste,
  ChevronDown,
  Layers as LayersIcon,
  Box,
  Check,
  Shapes,
} from 'lucide-react';
import { TransformMode, AccessibilityMode, Layer, LoadedModelInfo, TransformTargetScope } from '../../types';
import { haptics } from '../../utils/haptics';

export interface NavigatorTabItem {
  id: string;
  label: string;
}

export interface NavigatorHeaderProps {
  mode: string;
  onModeChange: (mode: any) => void;
  tabs?: NavigatorTabItem[];
  isLocked: boolean;
  onLockToggle: () => void;
  onReset: () => void;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
  onClose?: () => void;
  targetName?: string;
  layers?: Layer[];
  activeLayerId?: string;
  onSelectLayer?: (layerId: string) => void;
  models?: LoadedModelInfo[];
  activeModelId?: string | null;
  onSelectModel?: (modelId: string | null) => void;
  targetScope?: TransformTargetScope;
  onSelectTargetScope?: (scope: TransformTargetScope) => void;
  accessibilityMode: AccessibilityMode;
  onAccessibilityModeToggle: () => void;
  onHeaderDragStart?: (e: React.PointerEvent) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  clipboardCount?: number;
  scaleFactor?: number;
  onScaleCycle?: () => void;
  onScaleSet?: (scale: number) => void;
  /**
   * Play-mode appearance. Collapses the header to the state tabs + Reset:
   * target/layer/model selector, copy, paste, lock, accessibility and haptics
   * buttons are hidden (not removed - their state and handlers still work,
   * there's simply no button to reach them from). Also swaps the tab set to
   * the two-tab Play labels and drops the Tactile Ball tab. Omit or pass
   * false for the unchanged Pro appearance.
   */
  simplified?: boolean;
  theme?: 'light' | 'dark';
}

const DEFAULT_TABS: NavigatorTabItem[] = [
  { id: '2d', label: '2D Dial' },
  { id: '3d', label: '3D Spatial' },
  { id: 'tactile', label: 'Tactile Ball' },
];

/** Play mode only shows the two axes a beginner needs; Tactile Ball stays Pro-only. */
const SIMPLIFIED_TABS: NavigatorTabItem[] = [
  { id: '2d', label: 'Flat Screen' },
  { id: '3d', label: '3D World' },
];

export const NavigatorHeader: React.FC<NavigatorHeaderProps> = ({
  mode,
  onModeChange,
  tabs = DEFAULT_TABS,
  isLocked,
  onLockToggle,
  onReset,
  targetName = 'Main Curves',
  layers = [],
  activeLayerId,
  onSelectLayer,
  models = [],
  activeModelId,
  onSelectModel,
  targetScope = 'active_layer',
  onSelectTargetScope,
  accessibilityMode,
  onAccessibilityModeToggle,
  onCopy,
  onPaste,
  clipboardCount = 0,
  simplified = false,
  theme = 'dark',
  onHeaderDragStart,
}) => {
  const isLight = theme === 'light';
  const [hapticsEnabled, setHapticsEnabled] = useState(haptics.getEnabled());
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showTargetDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setShowTargetDropdown(false);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [showTargetDropdown]);

  const handleModeSwitch = (newMode: string) => {
    if (newMode !== mode) {
      haptics.trigger('mode-switch');
      onModeChange(newMode);
    }
  };

  const handleLockClick = () => {
    haptics.trigger(isLocked ? 'unlock' : 'lock');
    onLockToggle();
  };

  const handleResetClick = () => {
    haptics.trigger('heavy');
    onReset();
  };

  const handleAccessibilityClick = () => {
    haptics.trigger('light');
    onAccessibilityModeToggle();
  };

  const handleHapticsToggle = () => {
    const next = haptics.toggleEnabled();
    setHapticsEnabled(next);
  };

  const handleCopyClick = () => {
    haptics.trigger('light');
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 900);
    onCopy?.();
  };

  const handlePasteClick = () => {
    haptics.trigger('medium');
    setPasteFeedback(true);
    setTimeout(() => setPasteFeedback(false), 900);
    onPaste?.();
  };

  const handleSelectLayerItem = (layer: Layer) => {
    haptics.trigger('light');
    onSelectLayer?.(layer.id);
    onSelectTargetScope?.('active_layer');
    setShowTargetDropdown(false);
  };

  const handleSelectModelItem = (model: LoadedModelInfo) => {
    haptics.trigger('light');
    onSelectModel?.(model.id);
    onSelectTargetScope?.('model');
    setShowTargetDropdown(false);
  };

  const handleSelectScopeItem = (scope: TransformTargetScope) => {
    haptics.trigger('light');
    onSelectTargetScope?.(scope);
    setShowTargetDropdown(false);
  };

  // Determine current display label
  let displayLabel = targetName;
  if (targetScope === 'active_layer') {
    const activeL = layers.find((l) => l.id === activeLayerId);
    if (activeL) displayLabel = activeL.name;
  } else if (targetScope === 'model') {
    if (activeModelId) {
      const activeM = models.find((m) => m.id === activeModelId);
      if (activeM) displayLabel = activeM.name;
    } else if (models.length > 0) {
      displayLabel = models[0].name;
    }
  } else if (targetScope === 'strokes') {
    displayLabel = 'All Curves';
  } else if (targetScope === 'all') {
    displayLabel = 'All Objects';
  }

  const effectiveTabs = simplified ? SIMPLIFIED_TABS : tabs;

  const gridColsClass =
    effectiveTabs.length === 2
      ? 'grid-cols-2'
      : effectiveTabs.length === 3
      ? 'grid-cols-3'
      : effectiveTabs.length === 4
      ? 'grid-cols-4'
      : 'grid-cols-3';

  return (
    <div
      id="transform-navigator-header"
      className={`flex flex-col select-none relative ${
        isLight ? 'border-b border-black/10' : 'border-b border-white/[0.08]'
      }`}
    >
      {/* Main Controls: Segmented pill toggle + actions */}
      <div className="px-2 pt-2 pb-1.5 flex flex-col gap-1.5">
        {/* Segmented Control Pill */}
        <div
          id="navigator-mode-segmented-control"
          className={`w-full grid ${gridColsClass} p-0.5 rounded-full shadow-inner ${
            isLight ? 'bg-neutral-100 border border-black/10' : 'bg-[#101114] border border-white/[0.08]'
          }`}
          role="tablist"
          aria-label="Transform Dimension Mode"
        >
          {effectiveTabs.map((tab) => {
            const isSelected = mode === tab.id;
            return (
              <button
                key={tab.id}
                id={`navigator-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleModeSwitch(tab.id)}
                className={`relative z-10 py-1 text-xs font-semibold rounded-full transition-all duration-150 text-center ${
                  isSelected
                    ? isLight
                      ? 'bg-white text-neutral-950 font-bold shadow-xs border border-black/5'
                      : 'bg-white text-zinc-950 shadow-sm font-bold'
                    : isLight
                    ? 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Action Icons row: Target Selector, Copy, Paste, Lock, Reset, Accessibility, Haptics */}
        <div className="flex items-center justify-between px-1">
          {/* Target Layer / Model Selector Button (Pro only - Play always targets the active layer) */}
          {!simplified && (
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setShowTargetDropdown(!showTargetDropdown)}
              title="Select Active Layer or 3D Model"
              aria-label="Select target layer or 3D model"
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-[10.5px] font-medium transition-all group max-w-[110px] ${
                isLight ? 'hover:bg-black/5 text-neutral-700' : 'hover:bg-white/10 text-zinc-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  targetScope === 'model'
                    ? 'bg-neutral-900 dark:bg-white'
                    : targetScope === 'all'
                    ? 'bg-neutral-900 dark:bg-white'
                    : targetScope === 'strokes'
                    ? 'bg-neutral-900 dark:bg-white'
                    : isLight
                    ? 'bg-neutral-500'
                    : 'bg-zinc-400'
                }`}
              />
              <span className={`font-semibold truncate text-[11px] leading-none ${
                isLight ? 'text-neutral-900' : 'text-zinc-200'
              }`}>
                {displayLabel}
              </span>
              <ChevronDown
                className={`w-3 h-3 shrink-0 transition-transform ${
                  showTargetDropdown ? 'rotate-180' : ''
                } ${isLight ? 'text-neutral-500 group-hover:text-neutral-900' : 'text-zinc-400 group-hover:text-zinc-200'}`}
              />
            </button>

            {/* Interactive Target Selection Popover Dropdown */}
            {showTargetDropdown && (
              <div
                ref={dropdownRef}
                className={`absolute left-0 top-full mt-1.5 w-52 max-h-72 overflow-y-auto rounded-2xl py-1.5 z-50 text-xs divide-y animate-in fade-in zoom-in-95 duration-100 ${
                  isLight
                    ? 'bg-white text-neutral-900 border border-black/10 shadow-[0_20px_45px_rgba(0,0,0,0.15)] divide-black/5'
                    : 'bg-[#18191d] border border-white/15 shadow-[0_20px_45px_rgba(0,0,0,0.85)] text-white divide-white/[0.06]'
                }`}
              >
                {/* 1. Layers Section */}
                <div className="py-1 px-1">
                  <div className={`px-2 py-0.5 text-[9.5px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${
                    isLight ? 'text-neutral-500' : 'text-zinc-400'
                  }`}>
                    <LayersIcon className="w-3 h-3" />
                    <span>Layers</span>
                  </div>
                  {layers.length === 0 ? (
                    <div className="px-2 py-1 text-[10.5px] text-neutral-400 italic">No layers</div>
                  ) : (
                    layers.map((layer) => {
                      const isLayerActive = targetScope === 'active_layer' && activeLayerId === layer.id;
                      return (
                        <button
                          key={layer.id}
                          type="button"
                          onClick={() => handleSelectLayerItem(layer)}
                          className={`w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between text-[11px] transition-colors ${
                            isLayerActive
                              ? isLight
                                ? 'bg-neutral-200 dark:bg-white/20 text-neutral-900 dark:text-white font-bold'
                                : 'bg-white/15 text-white font-bold'
                              : isLight
                              ? 'text-neutral-700 hover:bg-black/5 hover:text-neutral-900'
                              : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: layer.colorTag || '#38bdf8' }}
                            />
                            <span className="truncate">{layer.name}</span>
                          </div>
                          {isLayerActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* 2. 3D Models Section */}
                <div className="py-1 px-1">
                  <div className={`px-2 py-0.5 text-[9.5px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${
                    isLight ? 'text-neutral-500' : 'text-zinc-400'
                  }`}>
                    <Box className="w-3 h-3 text-current" />
                    <span>3D Models ({models.length})</span>
                  </div>
                  {models.length === 0 ? (
                    <div className="px-2 py-1 text-[10.5px] text-neutral-400 italic">No 3D models loaded</div>
                  ) : (
                    models.map((model, idx) => {
                      const isModelActive = targetScope === 'model' && (activeModelId === model.id || (!activeModelId && idx === 0));
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => handleSelectModelItem(model)}
                          className={`w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between text-[11px] transition-colors ${
                            isModelActive
                              ? isLight
                                ? 'bg-neutral-200 dark:bg-white/20 text-neutral-900 dark:text-white font-bold border border-black/10 dark:border-white/10' : 'bg-black/5 dark:bg-white/5 text-neutral-800 dark:text-neutral-200 font-bold border border-black/10 dark:border-white/10'
                              : isLight
                              ? 'text-neutral-700 hover:bg-black/5 hover:text-neutral-900'
                              : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Box className="w-3.5 h-3.5 text-current shrink-0" />
                            <span className="truncate">{model.name}</span>
                          </div>
                          {isModelActive && <Check className="w-3.5 h-3.5 text-current shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* 3. Global Scopes Section */}
                <div className="py-1 px-1">
                  <div className={`px-2 py-0.5 text-[9.5px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${
                    isLight ? 'text-neutral-500' : 'text-zinc-400'
                  }`}>
                    <Shapes className="w-3 h-3 text-current" />
                    <span>Global Scopes</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectScopeItem('strokes')}
                    className={`w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between text-[11px] transition-colors ${
                      targetScope === 'strokes'
                        ? isLight
                          ? 'bg-neutral-200 dark:bg-white/20 text-neutral-900 dark:text-white font-bold' : 'bg-black/5 dark:bg-white/5 text-neutral-800 dark:text-neutral-200 font-bold'
                        : isLight
                        ? 'text-neutral-700 hover:bg-black/5 hover:text-neutral-900'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>All Curves (All Layers)</span>
                    {targetScope === 'strokes' && <Check className="w-3.5 h-3.5 text-current shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectScopeItem('all')}
                    className={`w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between text-[11px] transition-colors ${
                      targetScope === 'all'
                        ? isLight
                          ? 'bg-neutral-200 dark:bg-white/20 text-neutral-900 dark:text-white font-bold' : 'bg-black/5 dark:bg-white/5 text-neutral-800 dark:text-neutral-200 font-bold'
                        : isLight
                        ? 'text-neutral-700 hover:bg-black/5 hover:text-neutral-900'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>All Objects (Scene)</span>
                    {targetScope === 'all' && <Check className="w-3.5 h-3.5 text-current shrink-0" />}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          <>
            <div className={`flex items-center gap-0.5${simplified ? ' ml-auto' : ''}`}>
            {/* Copy Action (Pro only) */}
            {!simplified && (
            <button
              id="navigator-btn-copy"
              type="button"
              onClick={handleCopyClick}
              title="Copy Curves in Active Layer (Ctrl+C)"
              aria-label="Copy curves"
              className={`p-1.5 rounded-lg text-xs transition-all duration-150 flex items-center justify-center ${
                copyFeedback
                  ? isLight
                    ? 'bg-neutral-900 text-white font-bold'
                    : 'bg-white text-zinc-950 font-bold'
                  : isLight
                  ? 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            )}

            {/* Paste Action (Pro only) */}
            {!simplified && (
            <button
              id="navigator-btn-paste"
              type="button"
              onClick={handlePasteClick}
              title={`Paste Copied Curves (Ctrl+V)${clipboardCount > 0 ? ` • ${clipboardCount} in clipboard` : ''}`}
              aria-label="Paste copied curves"
              className={`p-1.5 rounded-lg text-xs transition-all duration-150 flex items-center justify-center relative ${
                pasteFeedback
                  ? isLight
                    ? 'bg-neutral-900 text-white font-bold'
                    : 'bg-white text-zinc-950 font-bold'
                  : isLight
                  ? 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>
            )}

            {/* Lock Constraint Button (Pro only) */}
            {!simplified && (
            <button
              id="navigator-btn-lock"
              type="button"
              onClick={handleLockClick}
              title={isLocked ? 'Constraints Locked (Click to Unlock)' : 'Unlocked (Click to Lock)'}
              aria-label={isLocked ? 'Unlock constraints' : 'Lock constraints'}
              className={`p-1.5 rounded-lg text-xs transition-all duration-150 flex items-center justify-center ${
                isLocked
                  ? isLight
                    ? 'bg-neutral-900 text-white font-bold'
                    : 'bg-white text-zinc-950 font-bold'
                  : isLight
                  ? 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            )}

            {/* Reset Origin Button (kept in Play - it moves the object back, not a settings control) */}
            <button
              id="navigator-btn-reset"
              type="button"
              onClick={handleResetClick}
              title="Reset Transform Values"
              aria-label="Reset transform values"
              className={`p-1.5 rounded-lg transition-all duration-150 flex items-center justify-center ${
                isLight
                  ? 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Finger-Pen Accessibility Mode Toggle (Pro only) */}
            {!simplified && (
            <button
              id="navigator-btn-accessibility"
              type="button"
              onClick={handleAccessibilityClick}
              title={`Accessibility Mode: ${accessibilityMode} (Click to toggle)`}
              aria-label={`Toggle accessibility mode. Current: ${accessibilityMode}`}
              className={`p-1.5 rounded-lg text-xs transition-all duration-150 flex items-center justify-center ${
                accessibilityMode === 'finger-pen'
                  ? isLight
                    ? 'bg-neutral-900 text-white font-bold shadow-xs'
                    : 'bg-white text-zinc-950 font-bold shadow-xs'
                  : isLight
                  ? 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>
            )}

            {/* Haptic Feedback Toggle (Pro only) */}
            {!simplified && (
            <button
              id="navigator-btn-haptics"
              type="button"
              onClick={handleHapticsToggle}
              title={hapticsEnabled ? 'Haptic Feedback: Enabled (Click to Mute)' : 'Haptic Feedback: Disabled (Click to Enable)'}
              aria-label={hapticsEnabled ? 'Disable haptic feedback' : 'Enable haptic feedback'}
              className={`p-1.5 rounded-lg text-xs transition-all duration-150 flex items-center justify-center ${
                hapticsEnabled
                  ? isLight
                    ? 'text-neutral-800 hover:bg-black/5'
                    : 'text-zinc-200 hover:bg-white/10'
                  : isLight
                  ? 'text-neutral-400 hover:text-neutral-600 hover:bg-black/5 line-through'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5 line-through'
              }`}
            >
              <Vibrate className="w-3.5 h-3.5" />
            </button>
            )}
            </div>
          </>
        </div>
      </div>
    </div>
  );
};
