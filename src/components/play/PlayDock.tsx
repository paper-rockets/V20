import React, { useEffect, useRef, useState } from 'react';
import { PenLine, Square, Eraser, ChevronRight, Star } from 'lucide-react';
import { ToolType, BrushSettings } from '../../types';
import {
  SCULPT_BRUSHES,
  getActiveCuratedBrush,
  applyCuratedBrush,
  getBrushesForTab,
  BrushCategoryTab,
} from '../../presets/curatedBrushes';
import { haptics } from '../../utils/haptics';
import { StudioEngine } from '../../core/studioEngine';
import { useDismissibleSurface } from '../../hooks/useDismissibleSurface';
import { RealBrushSizeControl } from '../common/RealBrushSizeControl';
import { MenuShelf } from '../ui/MenuPrimitives';

export type PlayToolId = 'draw' | 'shape' | 'eraser';

interface PlayDockProps {
  tool: ToolType;
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  shapeSnapping: boolean;
  onSelect: (id: PlayToolId) => void;
  onOpenFullColor?: () => void;
  engine?: StudioEngine | null;
  theme?: 'light' | 'dark';
  hideToolRail?: boolean;
}

const TOOLS = [
  { id: 'draw' as const, label: 'Draw', icon: PenLine },
  { id: 'shape' as const, label: 'Shape', icon: Square },
  { id: 'eraser' as const, label: 'Erase', icon: Eraser },
];

const COLORS = ['#2563eb', '#38bdf8', '#ef4444', '#f59e0b', '#10b981', '#a855f7', '#18191d', '#ffffff'];


export function activePlayTool(tool: ToolType, shapeSnapping: boolean): PlayToolId {
  if (tool === 'eraser') return 'eraser';
  return shapeSnapping ? 'shape' : 'draw';
}

export function playToolSettings(id: PlayToolId): { tool: ToolType; patch: Partial<BrushSettings> } {
  if (id === 'eraser') return { tool: 'eraser', patch: { eraserMode: 'vacuum', shapeSnapping: false } };
  return { tool: 'brush', patch: { shapeSnapping: id === 'shape', straightLineMode: false } };
}

export const PlayDock: React.FC<PlayDockProps> = ({
  tool,
  brushSettings,
  setBrushSettings,
  shapeSnapping,
  onSelect,
  onOpenFullColor,
  theme = 'dark',
  hideToolRail = false,
}) => {
  const active = activePlayTool(tool, shapeSnapping);
  const [panel, setPanel] = useState<'color' | 'size' | 'brush' | null>(null);
  const [activeTab, setActiveTab] = useState<BrushCategoryTab>('Sculpt');
  const root = useRef<HTMLDivElement>(null);

  const activeBrush = getActiveCuratedBrush(brushSettings);
  const displayedBrushes = getBrushesForTab(activeTab);

  const isConformal = brushSettings.drawingMode !== 'spatial_3d' && tool !== 'free_brush';
  const isFlat = brushSettings.profile === 'ribbon' || brushSettings.profile === 'conformal';

  const isLight = theme === 'light';

  useDismissibleSurface({
    isOpen: panel !== null,
    onClose: () => setPanel(null),
    surfaceRef: root,
  });

  // Brush size integer for display (matching the "56" in the mockup)
  const displaySizeNumber = Math.round(((brushSettings.size - 0.008) / (0.16 - 0.008)) * 90 + 10);
  const displayStrengthNumber = Math.round((brushSettings.opacity ?? 1.0) * 100);

  return (
    <div ref={root} className="fixed inset-0 z-40 pointer-events-none select-none">
      {!hideToolRail && (
        /* ================= UNIFIED LEFT TOOL RAIL (All devices & orientations) ================= */
        <div
          className={`pointer-events-auto absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 ${isLight ? 'text-neutral-800' : 'text-white/85'}`}
        >
          {/* Tool mode buttons: Draw, Shape, Erase */}
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                haptics.trigger('light');
                if (id === 'draw' && active === 'draw') {
                  setPanel(panel === 'brush' ? null : 'brush');
                } else {
                  onSelect(id);
                  setPanel(null);
                }
              }}
              title={label}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors active:scale-95 border-0 bg-transparent ${
                active === id
                  ? isLight
                    ? 'text-neutral-950 font-bold'
                    : 'text-white font-bold'
                  : isLight
                  ? 'text-neutral-500 hover:text-neutral-900'
                  : 'text-white/50 hover:text-white/90'
              }`}
              aria-label={label}
              aria-pressed={active === id}
            >
              <Icon className="h-[21px] w-[21px] shrink-0" strokeWidth={1.4} />
            </button>
          ))}

          {/* Color swatch disc */}
          <button
            type="button"
            onClick={() => setPanel(panel === 'color' ? null : 'color')}
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
              style={{ background: brushSettings.color || '#38bdf8' }}
            />
          </button>

          {/* Size button - Sleek concentric target circle from mockup */}
          <button
            type="button"
            onClick={() => setPanel(panel === 'size' ? null : 'size')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-colors border-0 bg-transparent ${
              panel === 'size'
                ? isLight
                  ? 'text-neutral-950'
                  : 'text-white'
                : isLight
                ? 'text-neutral-500 hover:text-neutral-900'
                : 'text-white/50 hover:text-white/90'
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
                  width: Math.max(4, Math.min(10, brushSettings.size * 100)),
                  height: Math.max(4, Math.min(10, brushSettings.size * 100)),
                }}
              />
            </div>
          </button>

          {/* Brushes button - Sleek spline wave curve from mockup */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              if (active !== 'draw') {
                onSelect('draw');
              }
              setPanel(panel === 'brush' ? null : 'brush');
            }}
            className={`w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 transition-colors border-0 bg-transparent ${
              panel === 'brush'
                ? isLight
                  ? 'text-neutral-950'
                  : 'text-white'
                : isLight
                ? 'text-neutral-500 hover:text-neutral-900'
                : 'text-white/50 hover:text-white/90'
            }`}
            aria-label="Brushes"
            title={`Brush: ${activeBrush.name}`}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none">
              <path d="M 4 14 Q 8 6, 12 12 T 20 10" strokeWidth={1.6} strokeLinecap="round" />
            </svg>
          </button>


          {/* Popout menu appearing to the RIGHT in portrait */}
          {panel && (
            <MenuShelf
              theme={theme}
              padding={panel === 'brush' ? 'standard' : 'tight'}
              className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 animate-in fade-in slide-in-from-left-2 duration-150 ${
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
                        onClick={() => {
                          setBrushSettings((p) => ({ ...p, color }));
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
                      onOpenFullColor?.();
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
                    brushSettings={brushSettings}
                    onSizeChange={(newSize) => setBrushSettings((p) => ({ ...p, size: newSize }))}
                    theme={theme}
                  />
                </div>
              )}

              {/* Brushes Panel - Exact Design Language from Image 1 */}
              {panel === 'brush' && (
                <div className="flex flex-col gap-3 w-full">
                  {/* Header Title & Category Tabs */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold tracking-tight text-white/95">Brushes</h3>
                    <div className="flex items-center gap-4 text-xs font-medium border-b border-white/[0.08] pb-1.5">
                      {(['Favorites', 'Sculpt', 'Surface', 'Polish'] as BrushCategoryTab[]).map((tab) => {
                        const isTabActive = activeTab === tab;
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`transition-colors relative pb-1 ${
                              isTabActive ? 'text-white font-semibold' : 'text-white/40 hover:text-white/75'
                            }`}
                          >
                            {tab}
                            {isTabActive && (
                              <span className="absolute bottom-[-7px] left-0 right-0 h-[2px] bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4x2 Grid of 3D Sculpt Brushes */}
                  <div className="grid grid-cols-4 gap-2 py-1">
                    {displayedBrushes.map((preset) => {
                      const isSelected = activeBrush.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            haptics.trigger('medium');
                            setBrushSettings((prev) => applyCuratedBrush(preset, prev));
                            onSelect('draw');
                          }}
                          className={`relative rounded-xl p-1.5 flex flex-col items-center justify-between transition-all active:scale-95 aspect-[4/5] border ${
                            isSelected
                              ? 'border-white bg-white/[0.12] shadow-[0_0_12px_rgba(255,255,255,0.2)] ring-1 ring-white/70'
                              : 'border-white/[0.06] bg-[#18191e] hover:border-white/20 hover:bg-[#1f2127]'
                          }`}
                          title={preset.description}
                        >
                          {/* Active Star */}
                          {isSelected && (
                            <Star className="w-2.5 h-2.5 text-white fill-white absolute top-1.5 right-1.5" />
                          )}

                          {/* 3D Clay Thumbnail */}
                          <div className="w-full flex-1 flex items-center justify-center p-0.5 overflow-hidden">
                            <img
                              src={preset.iconUrl}
                              alt={preset.name}
                              className="w-10 h-10 object-contain pointer-events-none"
                            />
                          </div>

                          {/* Label */}
                          <span
                            className={`text-[10px] truncate w-full text-center leading-tight pb-0.5 ${
                              isSelected ? 'text-white font-semibold' : 'text-white/70'
                            }`}
                          >
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bottom Sliders & Falloff (matching Image 1) */}
                  <div className="pt-2 border-t border-white/[0.08] flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex justify-between text-[10px] text-white/70">
                          <span>Size</span>
                          <span className="font-mono text-white/90">{displaySizeNumber}</span>
                        </div>
                        <input
                          type="range"
                          min="0.008"
                          max="0.16"
                          step="0.002"
                          value={brushSettings.size}
                          onChange={(e) => setBrushSettings((p) => ({ ...p, size: parseFloat(e.target.value) }))}
                          className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex justify-between text-[10px] text-white/70">
                          <span>Strength</span>
                          <span className="font-mono text-white/90">{displayStrengthNumber}</span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="1.0"
                          step="0.02"
                          value={brushSettings.opacity ?? 1.0}
                          onChange={(e) => setBrushSettings((p) => ({ ...p, opacity: parseFloat(e.target.value) }))}
                          className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </MenuShelf>
          )}
        </div>
      )}
    </div>
  );
};
