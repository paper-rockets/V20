import React, { useState, useRef } from 'react';
import { IcPointer, IcDraw, IcCreate, IcDeform, IcLayers } from './StudioIcons';
import { ProMode, toggleSheet, useOpenSheet, closeSheet } from '../play/sheetStore';
import { haptics } from '../../utils/haptics';
import { ToolType, BrushSettings } from '../../types';
import { RealBrushSizeControl } from '../common/RealBrushSizeControl';
import {
  getActiveCuratedBrush,
  applyCuratedBrush,
  getBrushesForTab,
  BrushCategoryTab,
} from '../../presets/curatedBrushes';
import { ChevronRight, Star } from 'lucide-react';
import { useDismissibleSurface } from '../../hooks/useDismissibleSurface';
import { MenuShelf } from '../ui/MenuPrimitives';

export interface ProRailProps {
  theme?: 'light' | 'dark';
  tool?: ToolType;
  setTool?: (tool: ToolType) => void;
  brushSettings?: BrushSettings;
  setBrushSettings?: React.Dispatch<React.SetStateAction<BrushSettings>>;
  onOpenColorStudio?: () => void;
  onOpenIllumination?: () => void;
  isIlluminationOpen?: boolean;
}

interface ModeButton {
  id: ProMode;
  label: string;
  icon: React.FC<{ className?: string; strokeWidth?: number }>;
}

const MODES: ModeButton[] = [
  { id: 'select', label: 'Select', icon: IcPointer },
  { id: 'draw', label: 'Draw', icon: IcDraw },
  { id: 'create', label: 'Create', icon: IcCreate },
  { id: 'deform', label: 'Deform', icon: IcDeform },
  { id: 'layers', label: 'Layers', icon: IcLayers },
];

const COLORS = ['#2563eb', '#38bdf8', '#ef4444', '#f59e0b', '#10b981', '#a855f7', '#18191d', '#ffffff'];

export const ProRail: React.FC<ProRailProps> = ({
  theme = 'dark',
  tool,
  setTool,
  brushSettings,
  setBrushSettings,
  onOpenColorStudio,
  onOpenIllumination,
  isIlluminationOpen = false,
}) => {
  const openSheet = useOpenSheet();
  const light = theme === 'light';
  const isLight = light;
  const rootRef = useRef<HTMLElement>(null);

  const [panel, setPanel] = useState<'color' | 'size' | 'brush' | null>(null);
  const [activeTab, setActiveTab] = useState<BrushCategoryTab>('Sculpt');

  useDismissibleSurface({
    isOpen: panel !== null,
    onClose: () => setPanel(null),
    surfaceRef: rootRef,
  });

  const currentBrushSettings: BrushSettings = brushSettings || {
    color: '#38bdf8',
    size: 0.03,
    opacity: 1.0,
    profile: 'tube',
  };

  const activeBrush = getActiveCuratedBrush(currentBrushSettings);
  const displayedBrushes = getBrushesForTab(activeTab);



  return (
    <nav
      ref={rootRef}
      aria-label="Studio modes"
      className="fixed left-1.5 sm:left-2 top-1/2 -translate-y-1/2 z-40 select-none pointer-events-none"
    >
      <div className={`pointer-events-auto flex flex-col items-center gap-2 py-1 ${light ? 'text-neutral-800' : 'text-white/85'}`}>
        {/* Studio Modes: Select, Draw, Create, Deform, Layers */}
        {MODES.map(({ id, label, icon: Icon }) => {
          const isActive = openSheet === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                haptics.trigger('light');
                if (id === 'draw' && setTool) {
                  setTool('brush');
                }
                setPanel(null);
                toggleSheet(id);
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors active:scale-95 border-0 bg-transparent ${
                isActive
                  ? light
                    ? 'text-neutral-950 font-bold'
                    : 'text-white font-bold'
                  : light
                    ? 'text-neutral-500 hover:text-neutral-900'
                    : 'text-neutral-400 hover:text-white'
              }`}
              aria-label={label}
              aria-pressed={isActive}
              title={label}
            >
              <Icon className="h-[21px] w-[21px] shrink-0" strokeWidth={1.35} />
            </button>
          );
        })}

        {/* Color swatch disc */}
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            closeSheet();
            setPanel(panel === 'color' ? null : 'color');
          }}
          className="w-11 h-11 rounded-xl grid place-items-center active:scale-95 transition-transform border-0 bg-transparent"
          aria-label="Color"
          title="Color"
        >
          <span
            className={`w-7 h-7 rounded-full border transition-all ${
              panel === 'color'
                ? isLight ? 'border-neutral-900 ring-2 ring-neutral-900/40 shadow-xs' : 'border-white ring-2 ring-white/40 shadow-xs'
                : isLight ? 'border-black/15' : 'border-white/20'
            }`}
            style={{ background: currentBrushSettings.color || '#38bdf8' }}
          />
        </button>

        {/* Size button - Sleek concentric target circle */}
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            closeSheet();
            setPanel(panel === 'size' ? null : 'size');
          }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-colors border-0 bg-transparent ${
            panel === 'size'
              ? isLight
                ? 'text-neutral-950 font-bold'
                : 'text-white font-bold'
              : isLight
              ? 'text-neutral-500 hover:text-neutral-900'
              : 'text-neutral-400 hover:text-white'
          }`}
          aria-label="Stroke size"
          title={`Size: ${activeBrush.name}`}
        >
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
            panel === 'size'
              ? isLight ? 'border-neutral-900' : 'border-white'
              : isLight ? 'border-neutral-400' : 'border-white/40'
          }`}>
            <span
              className={`rounded-full transition-all ${
                panel === 'size'
                  ? isLight ? 'bg-neutral-900' : 'bg-white'
                  : isLight ? 'bg-neutral-900' : 'bg-white'
              }`}
              style={{
                width: Math.max(4, Math.min(10, currentBrushSettings.size * 100)),
                height: Math.max(4, Math.min(10, currentBrushSettings.size * 100)),
              }}
            />
          </div>
        </button>

        {/* Brushes button - Sleek spline wave curve */}
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            if (setTool) {
              setTool('brush');
            }
            closeSheet();
            setPanel(panel === 'brush' ? null : 'brush');
          }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-colors border-0 bg-transparent ${
            panel === 'brush'
              ? isLight
                ? 'text-neutral-950 font-bold'
                : 'text-white font-bold'
              : isLight
              ? 'text-neutral-500 hover:text-neutral-900'
              : 'text-neutral-400 hover:text-white'
          }`}
          aria-label="Brushes"
          title={`Brush: ${activeBrush.name}`}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none">
            <path d="M 4 14 Q 8 6, 12 12 T 20 10" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Popover Floating Shelf on the Right of the Dock */}
      {panel && (
        <MenuShelf
          theme={theme}
          padding={panel === 'brush' ? 'standard' : 'tight'}
          className={`pointer-events-auto absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 animate-in fade-in slide-in-from-left-2 duration-150 ${
            panel === 'color'
              ? 'w-[172px]'
              : panel === 'size'
              ? 'w-[154px]'
              : 'w-[320px] max-w-[calc(100vw-88px)]'
          }`}
        >

            {/* Color Panel */}
            {panel === 'color' && (
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        haptics.trigger('light');
                        if (setBrushSettings) {
                          setBrushSettings((p) => ({ ...p, color }));
                        }
                        setPanel(null);
                      }}
                      className={`w-8 h-8 rounded-full border active:scale-90 transition-transform shadow-sm ${
                        isLight ? 'border-black/20' : 'border-white/20'
                      }`}
                      style={{ background: color }}
                      aria-label={`Use ${color}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null);
                    onOpenColorStudio?.();
                  }}
                  className={`w-full h-8 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-semibold active:scale-95 transition-all ${
                    isLight
                      ? 'border-black/15 text-neutral-800 hover:text-black hover:bg-black/5'
                      : 'border-white/10 text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>More colors</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>
              </div>
            )}

            {/* Size Selector Panel - Actual Shape & Size with Slider */}
            {panel === 'size' && (
              <div className="w-full">
                <RealBrushSizeControl
                  brushSettings={currentBrushSettings}
                  onSizeChange={(newSize) => {
                    if (setBrushSettings) {
                      setBrushSettings((p) => ({ ...p, size: newSize }));
                    }
                  }}
                  theme={theme}
                />
              </div>
            )}

            {/* Brushes Panel */}
            {panel === 'brush' && (
              <div className="flex flex-col gap-2.5 w-full">
                {/* Header Title & Category Tabs */}
                <div className="flex flex-col gap-1.5">
                  <h3 className={`text-sm font-semibold tracking-tight ${isLight ? 'text-neutral-900' : 'text-white/95'}`}>
                    Brushes
                  </h3>
                  <div className={`flex items-center gap-3.5 text-xs font-medium border-b pb-1.5 ${isLight ? 'border-black/10' : 'border-white/[0.08]'}`}>
                    {(['Favorites', 'Sculpt', 'Surface', 'Polish'] as BrushCategoryTab[]).map((tab) => {
                      const isTabActive = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={`transition-colors relative pb-1 ${
                            isTabActive
                              ? isLight ? 'text-neutral-950 font-bold' : 'text-white font-semibold'
                              : isLight ? 'text-neutral-500 hover:text-neutral-900' : 'text-white/40 hover:text-white/75'
                          }`}
                        >
                          {tab}
                          {isTabActive && (
                            <span className="absolute -bottom-1.5 left-0 right-0 h-[2px] bg-neutral-900 dark:bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4-col Presets Grid */}
                <div className="grid grid-cols-4 gap-2 py-1 max-h-[260px] overflow-y-auto studio-scroll">
                  {displayedBrushes.map((preset) => {
                    const isSelected = activeBrush.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          haptics.trigger('medium');
                          if (setBrushSettings) {
                            setBrushSettings((prev) => applyCuratedBrush(preset, prev));
                          }
                          if (setTool && tool !== 'brush' && tool !== 'draw') {
                            setTool('draw');
                          }
                          setPanel(null);
                        }}
                        className={`relative rounded-xl p-1.5 flex flex-col items-center justify-between transition-all active:scale-95 aspect-[4/5] border ${
                          isSelected
                            ? isLight
                              ? 'border-neutral-900 bg-black/[0.08] shadow-xs ring-1 ring-neutral-900/60'
                              : 'border-white bg-white/[0.12] shadow-[0_0_12px_rgba(255,255,255,0.2)] ring-1 ring-white/70'
                            : isLight
                            ? 'border-black/10 bg-black/[0.03] hover:border-black/20 hover:bg-black/[0.06]'
                            : 'border-white/[0.06] bg-[#18191e] hover:border-white/20 hover:bg-[#1f2127]'
                        }`}
                        title={preset.description}
                      >
                        {isSelected && (
                          <Star className="w-2.5 h-2.5 text-neutral-900 fill-neutral-900 dark:text-white dark:fill-white absolute top-1.5 right-1.5" />
                        )}
                        <div className="w-full flex-1 flex items-center justify-center p-0.5 overflow-hidden">
                          <img
                            src={preset.iconUrl}
                            alt={preset.name}
                            className="w-9 h-9 object-contain pointer-events-none"
                          />
                        </div>
                        <span
                          className={`text-[9.5px] truncate w-full text-center leading-tight pb-0.5 ${
                            isSelected
                              ? isLight ? 'text-neutral-950 font-bold' : 'text-white font-semibold'
                              : isLight ? 'text-neutral-700' : 'text-white/70'
                          }`}
                        >
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </MenuShelf>
        )}
    </nav>
  );
};
