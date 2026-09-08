import React, { useState, useRef, useEffect } from 'react';
import { IcPointer, IcDraw, IcCreate, IcDeform, IcLayers } from './StudioIcons';
import { ProMode, useOpenSheet, closeSheet, openSheetId } from '../studio/panelStore';
import { haptics } from '../../utils/haptics';
import { ToolType, BrushSettings } from '../../types';
import { RealBrushSizeControl } from '../common/RealBrushSizeControl';
import {
  getActiveCuratedBrush,
  applyCuratedBrush,
  getBrushesForTab,
  BrushCategoryTab,
} from '../../presets/curatedBrushes';
import { ChevronLeft, ChevronRight, Check, Palette } from 'lucide-react';
import { useDismissibleSurface } from '../../hooks/useDismissibleSurface';
import { MenuShelf } from '../ui/MenuPrimitives';
import './ProResponsive.css';

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

const COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#000000', '#ffffff'];

const BrushProfileGlyph: React.FC<{
  profile: BrushSettings['profile'];
  patternType?: string;
}> = ({ profile, patternType }) => (
  <svg viewBox="0 0 40 40" className="h-9 w-9 fill-none stroke-current" aria-hidden="true">
    {profile === 'tube' && (
      <>
        <path d="M6 25C13 9 25 31 34 14" strokeWidth="4.5" strokeLinecap="round" opacity="0.22" />
        <path d="M6 25C13 9 25 31 34 14" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="34" cy="14" r="2.25" strokeWidth="1.5" />
      </>
    )}
    {profile === 'ribbon' && (
      <path d="M5 26C12 8 23 31 35 12L35 18C24 35 13 14 5 30Z" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
    )}
    {profile === 'marker' && (
      <>
        <path d="M7 29L25 11L34 15L16 33Z" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
        <path d="M25 11L29 7L38 11L34 15" strokeWidth="1.5" strokeLinejoin="round" />
      </>
    )}
    {profile === 'conformal' && (
      <>
        <path d="M5 27C13 15 27 15 35 27" strokeWidth="5" strokeLinecap="round" opacity="0.18" />
        <path d="M5 27C13 15 27 15 35 27" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 31H36" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3" opacity="0.55" />
      </>
    )}
    {patternType && patternType !== 'none' && (
      <>
        <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
        <circle cx="19" cy="9" r="1" fill="currentColor" stroke="none" />
        <circle cx="27" cy="12" r="1.25" fill="currentColor" stroke="none" />
      </>
    )}
  </svg>
);

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
  const shelfRef = useRef<HTMLDivElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const sizeBtnRef = useRef<HTMLButtonElement>(null);
  const brushBtnRef = useRef<HTMLButtonElement>(null);
  const [shelfTop, setShelfTop] = useState<number | null>(null);

  const [panel, setPanel] = useState<'color' | 'size' | 'brush' | null>(null);
  const [activeTab, setActiveTab] = useState<BrushCategoryTab>('Core');
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(true);

  // Align popover shelf dynamically beside the active trigger button
  useEffect(() => {
    if (!panel) {
      setShelfTop(null);
      return;
    }
    const targetBtn =
      panel === 'color'
        ? colorBtnRef.current
        : panel === 'size'
        ? sizeBtnRef.current
        : brushBtnRef.current;
    if (targetBtn) {
      const top = targetBtn.offsetTop + targetBtn.offsetHeight / 2;
      setShelfTop(top);
    }
  }, [panel]);

  const activeTriggerRef =
    panel === 'color'
      ? colorBtnRef
      : panel === 'size'
      ? sizeBtnRef
      : panel === 'brush'
      ? brushBtnRef
      : undefined;

  useDismissibleSurface({
    isOpen: panel !== null,
    onClose: () => setPanel(null),
    surfaceRef: shelfRef,
    triggerRef: activeTriggerRef,
    ignoreSelector: '[data-pro-rail-button]',
  });

  const currentBrushSettings: BrushSettings = brushSettings || {
    color: '#000000',
    size: 0.03,
    opacity: 1.0,
    profile: 'tube',
  };

  const activeBrush = getActiveCuratedBrush(currentBrushSettings);
  const displayedBrushes = getBrushesForTab(activeTab);



  return (
    <>
      {/* Tap-outside backdrop for shelf popover */}
      {panel && (
        <div
          className="fixed inset-0 z-30 pointer-events-auto"
          onClick={() => setPanel(null)}
          aria-hidden="true"
        />
      )}

      <nav
        ref={rootRef}
        aria-label="Studio modes"
        data-theme={theme}
        data-expanded={isDesktopExpanded ? 'true' : 'false'}
        className="paperrocket-studio-rail fixed z-40 select-none pointer-events-none"
      >
        <div className={`paperrocket-studio-rail-inner pointer-events-auto flex items-center ${light ? 'text-neutral-800' : 'text-white/85'}`}>
          {/* Studio Modes: Select, Draw, Create, Deform, Layers */}
          <div className="paperrocket-studio-mode-group">
            {MODES.map(({ id, label, icon: Icon }) => {
              const isActive = openSheet === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-pro-rail-button="true"
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => {
                    haptics.trigger('light');
                    if (id === 'draw' && setTool) {
                      setTool('brush');
                    }
                    setPanel(null);
                    if (openSheet === id) {
                      closeSheet();
                    } else {
                      openSheetId(id);
                    }
                  }}
                  className={`paperrocket-studio-mode flex items-center justify-center rounded-xl transition-colors active:scale-95 border-0 bg-transparent ${
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
                  <Icon className="h-[21px] w-[21px] shrink-0" strokeWidth={1.5} />
                  <span className="paperrocket-studio-mode-label">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="paperrocket-studio-quick-group">
            {/* Color swatch disc */}
            <button
            ref={colorBtnRef}
            type="button"
            data-pro-rail-button="true"
            data-active={panel === 'color' ? 'true' : 'false'}
            onClick={() => {
              haptics.trigger('light');
              closeSheet();
              setPanel((prev) => (prev === 'color' ? null : 'color'));
            }}
            className="paperrocket-studio-quick rounded-xl flex items-center justify-center active:scale-95 transition-transform border-0 bg-transparent"
            aria-label="Color"
            title="Color"
          >
            <span
              className={`w-7 h-7 rounded-full border transition-all ${
                panel === 'color'
                  ? isLight ? 'border-neutral-900 ring-2 ring-neutral-900/40 shadow-xs' : 'border-white ring-2 ring-white/40 shadow-xs'
                  : isLight ? 'border-black/15' : 'border-white/20'
              }`}
              style={{ background: currentBrushSettings.color || '#000000' }}
            />
            </button>

          {/* Size button - Sleek concentric target circle */}
            <button
            ref={sizeBtnRef}
            type="button"
            data-pro-rail-button="true"
            data-active={panel === 'size' ? 'true' : 'false'}
            onClick={() => {
              haptics.trigger('light');
              closeSheet();
              setPanel((prev) => (prev === 'size' ? null : 'size'));
            }}
            className={`paperrocket-studio-quick rounded-xl flex items-center justify-center active:scale-95 transition-colors border-0 bg-transparent ${
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
            ref={brushBtnRef}
            type="button"
            data-pro-rail-button="true"
            data-active={panel === 'brush' ? 'true' : 'false'}
            onClick={() => {
              haptics.trigger('light');
              if (setTool) {
                setTool('brush');
              }
              closeSheet();
              setPanel((prev) => (prev === 'brush' ? null : 'brush'));
            }}
            className={`paperrocket-studio-quick rounded-xl flex items-center justify-center active:scale-95 transition-colors border-0 bg-transparent ${
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

          <button
            type="button"
            className="paperrocket-studio-expand rounded-xl items-center justify-center active:scale-95 transition-colors border-0 bg-transparent"
            onClick={() => setIsDesktopExpanded((expanded) => !expanded)}
            aria-label={isDesktopExpanded ? 'Collapse Studio rail' : 'Expand Studio rail'}
            aria-expanded={isDesktopExpanded}
            title={isDesktopExpanded ? 'Collapse Studio rail' : 'Expand Studio rail'}
          >
            <ChevronLeft className="paperrocket-studio-expand-icon h-4 w-4" />
          </button>
        </div>

        {/* Popover Floating Shelf on the Right of the Dock */}
        {panel && (
          <MenuShelf
            ref={shelfRef}
            theme={theme}
            padding={panel === 'brush' ? 'standard' : 'tight'}
            style={shelfTop !== null ? { top: `${shelfTop}px`, transform: 'translateY(-50%)' } : undefined}
            className={`paperrocket-studio-shelf pointer-events-auto absolute left-full ml-3 z-50 animate-in fade-in slide-in-from-left-2 duration-150 ${
              shelfTop === null ? 'top-1/2 -translate-y-1/2' : ''
            } ${
              panel === 'color'
                ? 'w-[154px]'
                : panel === 'size'
                ? 'w-[154px]'
                : 'w-[320px] max-w-[calc(100vw-88px)]'
            }`}
          >

              {/* Color Panel */}
              {panel === 'color' && (
                <div className="flex flex-col gap-2">
                  {/* Active Color Preview & Quick Native Color Picker */}
                  <div className="flex items-center justify-between px-0.5 pb-1 border-b border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/15 dark:border-white/20 shadow-xs shrink-0"
                        style={{ background: currentBrushSettings.color || '#000000' }}
                      />
                      <span className="font-mono text-[10px] font-bold tracking-tight opacity-75">
                        {(currentBrushSettings.color || '#000000').toUpperCase()}
                      </span>
                    </div>
                    {/* Quick Native Color Picker */}
                    <label
                      title="Pick custom color"
                      className="relative cursor-pointer w-5 h-5 rounded-md flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                      <input
                        type="color"
                        value={currentBrushSettings.color || '#000000'}
                        onChange={(e) => {
                          const newColor = e.target.value;
                          if (setBrushSettings) {
                            setBrushSettings((p) => ({ ...p, color: newColor }));
                          }
                        }}
                        className="sr-only"
                      />
                      <Palette className="w-3 h-3 opacity-70" />
                    </label>
                  </div>

                  {/* Preset Swatches with Selection Indicator */}
                  <div className="grid grid-cols-3 gap-2.5 py-1 justify-items-center">
                    {COLORS.map((color) => {
                      const isSelected = (currentBrushSettings.color || '#000000').toLowerCase() === color.toLowerCase();
                      const isWhite = color.toLowerCase() === '#ffffff';
                      const isLightColor = color === '#ffffff' || color === '#f59e0b';
                      return (
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
                          className={`w-5 h-5 rounded-full border transition-transform shadow-xs flex items-center justify-center shrink-0 ${
                            isSelected
                              ? isLight
                                ? 'ring-2 ring-neutral-900 ring-offset-1 ring-offset-[#FAF9F5] scale-105 border-transparent'
                                : 'ring-2 ring-white ring-offset-1 ring-offset-[#131518] scale-105 border-transparent'
                              : isWhite
                              ? isLight
                                ? 'border-black/30 ring-1 ring-black/10 hover:scale-110 active:scale-95'
                                : 'border-white/30 hover:scale-110 active:scale-95'
                              : isLight
                              ? 'border-black/20 hover:scale-110 active:scale-95'
                              : 'border-white/20 hover:scale-110 active:scale-95'
                          }`}
                          style={{ background: color }}
                          aria-label={`Use ${color}`}
                          title={color}
                        >
                          {isSelected && (
                            <Check
                              className={`w-3 h-3 ${isLightColor ? 'text-neutral-950' : 'text-white'}`}
                              strokeWidth={3}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* More Colors Button -> Opens Full Color Studio */}
                  <button
                    type="button"
                    onClick={() => {
                      setPanel(null);
                      onOpenColorStudio?.();
                    }}
                    className={`w-full h-7 rounded-lg border flex items-center justify-center gap-1 text-[11px] font-medium active:scale-95 transition-all ${
                      isLight
                        ? 'border-black/15 text-neutral-800 hover:text-black hover:bg-black/5'
                        : 'border-white/10 text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>More colors</span>
                    <ChevronRight className="w-3 h-3 opacity-70" />
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
                <div className="paperrocket-brush-browser flex flex-col gap-3 w-full">
                {/* Header Title & Category Tabs */}
                <div className="flex flex-col gap-1.5">
                  <h3 className={`text-sm font-semibold tracking-tight ${isLight ? 'text-neutral-900' : 'text-white/95'}`}>
                    Brushes
                  </h3>
                  <div className={`paperrocket-brush-tabs grid grid-cols-4 gap-1 rounded-xl p-1 ${isLight ? 'bg-black/[0.05]' : 'bg-white/[0.06]'}`}>
                    {(['Favorites', 'Core', 'Textures', 'Surface'] as BrushCategoryTab[]).map((tab) => {
                      const isTabActive = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={`paperrocket-brush-tab min-h-8 rounded-lg px-1.5 text-[11px] font-semibold transition-colors ${
                            isTabActive
                              ? isLight ? 'bg-white text-neutral-950 shadow-sm' : 'bg-white/[0.13] text-white shadow-sm'
                              : isLight ? 'text-neutral-500 hover:text-neutral-900' : 'text-white/50 hover:text-white/80'
                          }`}
                          aria-pressed={isTabActive}
                        >
                          {tab}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Readable two-column brush list */}
                <div className="paperrocket-brush-grid grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto studio-scroll pr-0.5">
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
                        className={`paperrocket-brush-card relative min-h-[64px] rounded-xl p-2 flex items-center gap-2 text-left transition-all active:scale-[0.98] border ${
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
                        <div className={`paperrocket-brush-glyph h-11 w-11 shrink-0 rounded-lg grid place-items-center ${
                          isLight ? 'bg-white/70' : 'bg-white/[0.07]'
                        }`}>
                          <BrushProfileGlyph profile={preset.profile} patternType={preset.patternType} />
                        </div>
                        <span className="min-w-0 flex-1">
                          <span
                          className={`block text-[11px] whitespace-normal break-words leading-[1.2] ${
                            isSelected
                              ? isLight ? 'text-neutral-950 font-bold' : 'text-white font-semibold'
                              : isLight ? 'text-neutral-700' : 'text-white/70'
                          }`}
                          >
                            {preset.name}
                          </span>
                          <span className={`mt-1 block text-[9px] leading-none ${isLight ? 'text-neutral-500' : 'text-white/40'}`}>
                            {preset.profile === 'tube' ? '3D tube' : preset.profile === 'conformal' ? 'Surface' : preset.profile === 'marker' ? 'Marker' : 'Ribbon'}
                          </span>
                        </span>
                        {isSelected && (
                          <span className={`absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full ${isLight ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-950'}`}>
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </MenuShelf>
        )}
      </nav>
    </>
  );
};
