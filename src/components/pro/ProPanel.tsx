import React, { useRef } from 'react';
import { ProMode, closeSheet, useOpenSheet } from '../play/sheetStore';
import { useDismissibleSurface } from '../../hooks/useDismissibleSurface';
import { StudioCloseButton } from '../common/StudioCloseButton';
import { haptics } from '../../utils/haptics';
import { SelectPanel } from './SelectPanel';
import { DrawPanel } from './DrawPanel';
import { CreatePanel } from './CreatePanel';
import { DeformPanel } from './DeformPanel';
import { LayerPanel } from '../LayerPanel';
import { StudioEngine } from '../../core/studioEngine';
import {
  ToolType,
  BrushSettings,
  TransformTargetScope,
  NumpadTarget,
  ModelDisplayMode,
  LiquifySettings,
  Layer,
} from '../../types';

export interface ProPanelProps {
  engine?: StudioEngine | null;
  tool?: ToolType;
  setTool?: (tool: ToolType) => void;
  brushSettings?: BrushSettings;
  setBrushSettings?: React.Dispatch<React.SetStateAction<BrushSettings>>;
  isGizmoActive?: boolean;
  onToggleGizmo?: () => void;
  isGizmoLocked?: boolean;
  onToggleLock?: () => void;
  onOpenNumpad?: (target: NumpadTarget) => void;
  onOpenColorStudio?: () => void;
  activeModelName?: string;
  modelDisplayMode?: ModelDisplayMode;
  onSetModelDisplayMode?: (mode: ModelDisplayMode) => void;
  onOpenModelLibrary?: () => void;
  onOpenImporter?: () => void;
  targetScope?: TransformTargetScope;
  onSelectTargetScope?: (scope: TransformTargetScope) => void;
  onGizmoReset?: () => void;
  // Deform Mode props
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
  // Layers Mode props
  layers?: Layer[];
  setLayers?: React.Dispatch<React.SetStateAction<Layer[]>>;
  activeLayerId?: string;
  setActiveLayerId?: (id: string) => void;
  onClearLayerStrokes?: (layerId: string) => void;
  onMergeLayerDown?: (layerId: string) => void;
  theme?: 'light' | 'dark';
}

const MODE_TITLES: Record<ProMode, string> = {
  select: 'Select',
  draw: 'Draw',
  create: 'Create',
  deform: 'Deform',
  layers: 'Layers',
};

export const ProPanel: React.FC<ProPanelProps> = ({
  engine = null,
  tool = 'brush',
  setTool = () => {},
  brushSettings,
  setBrushSettings = () => {},
  isGizmoActive = true,
  onToggleGizmo = () => {},
  isGizmoLocked = false,
  onToggleLock = () => {},
  onOpenNumpad,
  onOpenColorStudio,
  activeModelName = 'Default Model',
  modelDisplayMode = 'texture',
  onSetModelDisplayMode = () => {},
  onOpenModelLibrary = () => {},
  onOpenImporter = () => {},
  targetScope = 'all',
  onSelectTargetScope = () => {},
  onGizmoReset,
  liquifySettings,
  setLiquifySettings,
  isLiquifyOpen,
  onOpenLiquify,
  isCompareActive,
  onToggleCompare,
  onApplyLiquify,
  onCancelLiquify,
  onOpenScaffolding,
  onOpenBentGuide,
  onOpenCustomMirror,
  onOpenDecimate,
  layers,
  setLayers,
  activeLayerId,
  setActiveLayerId,
  onClearLayerStrokes,
  onMergeLayerDown,
  theme = 'dark',
}) => {
  const openSheet = useOpenSheet();
  const light = theme === 'light';

  // Only render if a ProMode is active
  const isProMode =
    openSheet === 'select' ||
    openSheet === 'draw' ||
    openSheet === 'create' ||
    openSheet === 'deform' ||
    openSheet === 'layers';

  const panelRef = useRef<HTMLElement | null>(null);
  useDismissibleSurface({
    isOpen: isProMode,
    onClose: closeSheet,
    surfaceRef: panelRef,
  });

  if (!isProMode || !openSheet) return null;

  const mode = openSheet as ProMode;
  const title = MODE_TITLES[mode] ?? mode;

  return (
    <aside
      ref={panelRef}
      role="region"
      aria-label={`${title} Panel`}
      data-theme={theme}
      className={`paperrocket-pro-panel fixed left-[76px] sm:left-[88px] top-1/2 -translate-y-1/2 z-40 w-[290px] sm:w-[300px] max-w-[calc(100vw-6rem)] h-fit max-h-[76vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden select-none animate-in fade-in slide-in-from-left-3 duration-150 ${
        light
          ? 'bg-[#f7f4ee]/98 border-black/15 text-neutral-800 shadow-[0_20px_50px_rgba(35,28,20,0.14)]'
          : 'bg-[#14161a]/98 border-white/15 text-neutral-200 shadow-[0_24px_70px_rgba(0,0,0,0.6)]'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b min-h-[34px] shrink-0 ${
          light ? 'border-black/10 bg-black/[0.02]' : 'border-white/10 bg-white/[0.02]'
        }`}
      >
        <h2 className="text-xs font-bold uppercase tracking-wider text-current">{title}</h2>
        <StudioCloseButton
          onClick={() => {
            haptics.trigger('light');
            closeSheet();
          }}
          ariaLabel={`Close ${title} Panel`}
          title="Close Panel"
          theme={theme}
          size="sm"
        />
      </div>

      {/* Body / Placeholders */}
      <div className="paperrocket-pro-content min-h-0 flex-initial p-2.5 overflow-y-auto studio-scroll">
        {mode === 'select' && brushSettings && (
          <SelectPanel
            engine={engine}
            tool={tool}
            setTool={setTool}
            brushSettings={brushSettings}
            setBrushSettings={setBrushSettings}
            isGizmoActive={isGizmoActive}
            onToggleGizmo={onToggleGizmo}
            isGizmoLocked={isGizmoLocked}
            onToggleLock={onToggleLock}
            onOpenNumpad={onOpenNumpad}
            targetScope={targetScope}
            onSelectTargetScope={onSelectTargetScope}
            onGizmoReset={onGizmoReset}
            theme={theme}
          />
        )}
        {mode === 'draw' && brushSettings && (
          <DrawPanel
            engine={engine}
            tool={tool}
            setTool={setTool}
            brushSettings={brushSettings}
            setBrushSettings={setBrushSettings}
            onOpenColorStudio={onOpenColorStudio}
            theme={theme}
          />
        )}
        {mode === 'create' && (
          <CreatePanel
            engine={engine}
            activeModelName={activeModelName}
            modelDisplayMode={modelDisplayMode}
            onSetModelDisplayMode={onSetModelDisplayMode}
            onOpenModelLibrary={onOpenModelLibrary}
            onOpenImporter={onOpenImporter}
            theme={theme}
          />
        )}
        {mode === 'deform' && (
          <DeformPanel
            engine={engine}
            tool={tool}
            setTool={setTool}
            liquifySettings={liquifySettings}
            setLiquifySettings={setLiquifySettings}
            isLiquifyOpen={isLiquifyOpen}
            onOpenLiquify={onOpenLiquify}
            isCompareActive={isCompareActive}
            onToggleCompare={onToggleCompare}
            onApplyLiquify={onApplyLiquify}
            onCancelLiquify={onCancelLiquify}
            onOpenScaffolding={onOpenScaffolding}
            onOpenBentGuide={onOpenBentGuide}
            onOpenCustomMirror={onOpenCustomMirror}
            onOpenDecimate={onOpenDecimate}
            onOpenNumpad={onOpenNumpad}
            theme={theme}
          />
        )}
        {mode === 'layers' && layers && setLayers && activeLayerId && setActiveLayerId && (
          <LayerPanel
            layers={layers}
            setLayers={setLayers}
            activeLayerId={activeLayerId}
            setActiveLayerId={setActiveLayerId}
            onClearLayerStrokes={onClearLayerStrokes || (() => {})}
            onMergeLayerDown={onMergeLayerDown}
            inline={true}
            theme={theme}
          />
        )}
      </div>
    </aside>
  );
};
