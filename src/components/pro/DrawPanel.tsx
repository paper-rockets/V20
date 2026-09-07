import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  IcDraw as PenLine,
  IcErase as Eraser,
  IcSample as Pipette,
  IcPalette as Palette,
  IcSparkle as Sparkles,
  IcLitForm as Zap,
  IcFlatPaint as FlatPaintIc,
  IcGlow as Flame,
  IcCutout as Scissors,
  IcCheck as Check,
  IcCurve as Spline,
  IcRuler as Ruler,
  IcStar as Star,
} from './StudioIcons';
import { StudioEngine } from '../../core/studioEngine';
import {
  ToolType,
  BrushSettings,
  StrokeProfile,
  MaterialType,
  SmoothingAlgorithm,
  EraserMode,
} from '../../types';
import {
  DEFAULT_BRUSH_PRESETS,
  applyBrushPresetToSettings,
} from '../../presets/brushPresets';
import {
  CURATED_BRUSHES,
  getActiveCuratedBrush,
  applyCuratedBrush,
  getBrushesForTab,
  BrushCategoryTab,
} from '../../presets/curatedBrushes';
import { BrushShapeGlyph } from '../play/BrushShapeGlyph';
import { RealBrushSizeControl } from '../common/RealBrushSizeControl';
import { haptics } from '../../utils/haptics';


interface DrawPanelProps {
  engine?: StudioEngine | null;
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  onOpenColorStudio?: () => void;
  theme?: 'light' | 'dark';
}

export const DrawPanel: React.FC<DrawPanelProps> = ({
  tool,
  setTool,
  brushSettings,
  setBrushSettings,
  onOpenColorStudio,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<BrushCategoryTab>('Sculpt');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const activeBrush = getActiveCuratedBrush(brushSettings);
  const displayedBrushes = getBrushesForTab(activeTab);

  const isConformal = brushSettings.drawingMode !== 'spatial_3d' && tool !== 'free_brush';
  const isFlat = brushSettings.profile === 'ribbon' || brushSettings.profile === 'conformal';

  const updateSetting = <K extends keyof BrushSettings>(key: K, value: BrushSettings[K]) => {
    setBrushSettings((prev) => ({ ...prev, [key]: value }));
  };

  const cardClass = isLight
    ? 'p-2.5 rounded-xl bg-neutral-100/50 border border-black/5 space-y-1.5'
    : 'p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5';

  const subHeadingClass = `text-[10px] font-bold uppercase tracking-wider ${
    isLight ? 'text-neutral-500' : 'text-neutral-400'
  }`;

  const PROFILES: { id: StrokeProfile; label: string }[] = [
    { id: 'ribbon', label: 'Ribbon' },
    { id: 'tube', label: '3D Tube' },
    { id: 'marker', label: 'Marker' },
    { id: 'conformal', label: 'Surface Decal' },
  ];

  const MATERIALS: { id: MaterialType; label: string; icon: any }[] = [
    { id: 'shadeless', label: 'Flat Paint', icon: FlatPaintIc },
    { id: 'shaded', label: 'Lit Form', icon: Zap },
    { id: 'glow', label: 'Glow Light', icon: Flame },
    { id: 'cutout', label: 'Cutout', icon: Scissors },
  ];

  const SMOOTHING_OPTIONS: { id: SmoothingAlgorithm; label: string }[] = [
    { id: 'streamline', label: 'Smooth Glide' },
    { id: 'exponential', label: 'Natural' },
    { id: 'none', label: 'Direct Raw' },
  ];

  return (
    <div className="space-y-2 text-xs select-none">
      {/* 1. UNIFIED TOOL ROW: Draw / Erase / Eyedropper */}
      <div className={cardClass}>
        <div className={subHeadingClass}>Active Tool</div>
        <div className="grid grid-cols-3 gap-1.5">
          {/* Draw Button (Unified 3D Pen / Sketch) */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              setTool('brush');
            }}
            className={`h-11 min-h-[40px] px-1.5 py-1 rounded-lg border flex flex-col items-center justify-center gap-0.5 font-semibold transition-all ${
              tool === 'brush'
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                  : 'bg-white border-white text-neutral-950 shadow-sm'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span className="text-[10.5px]">Draw</span>
          </button>

          {/* Erase Button */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              setTool('eraser');
            }}
            className={`h-11 min-h-[40px] px-1.5 py-1 rounded-lg border flex flex-col items-center justify-center gap-0.5 font-semibold transition-all ${
              tool === 'eraser'
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                  : 'bg-white border-white text-neutral-950 shadow-sm'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="text-[10.5px]">Erase</span>
          </button>

          {/* Eyedropper / Copy Look */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              setTool('eyedropper');
            }}
            className={`min-h-[44px] px-2 py-2 rounded-xl border flex flex-col items-center justify-center gap-1 font-semibold transition-all ${
              tool === 'eyedropper'
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                  : 'bg-white border-white text-neutral-950 shadow-sm'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
            title="Sample color and brush look from screen"
          >
            <Pipette className="w-4 h-4" />
            <span className="text-[11px]">Sample</span>
          </button>
        </div>
      </div>

      {/* 2. CURRENT PALETTE TYPE CONFIRMATION */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className={subHeadingClass}>Current Palette Type</div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${
                isConformal
                  ? isLight
                    ? 'bg-neutral-900 text-white border-neutral-700'
                    : 'bg-white text-neutral-950 border-neutral-200'
                  : isLight
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
              }`}
            >
              {isConformal ? 'Conformal' : 'Non-Conformal'}
            </span>
            <span
              className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${
                isFlat
                  ? isLight
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : isLight
                  ? 'bg-purple-50 text-purple-700 border-purple-300'
                  : 'bg-purple-500/20 text-purple-300 border-purple-400/40'
              }`}
            >
              {isFlat ? 'Flat' : 'Not Flat'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* Surface Attachment: Conformal vs Non-Conformal */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              updateSetting('drawingMode', isConformal ? 'spatial_3d' : 'surface');
            }}
            className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 cursor-pointer ${
              isConformal
                ? isLight
                  ? 'border-neutral-900 bg-neutral-900/10 text-neutral-950 shadow-xs'
                  : 'border-white bg-white/15 text-white shadow-xs'
                : isLight
                ? 'border-amber-500/40 bg-amber-50 text-amber-950 shadow-xs'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-200 shadow-xs'
            }`}
            title={isConformal ? 'Conformal (Hugs 3D surface). Click to switch to Non-Conformal (Mid-Air).' : 'Non-Conformal (Mid-Air). Click to switch to Conformal (Surface).'}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
              Surface Attachment
            </div>
            <div className="text-xs font-bold mt-0.5">
              {isConformal ? 'Conformal' : 'Non-Conformal'}
            </div>
            <div className="text-[10px] opacity-75 mt-0.5">
              {isConformal ? 'Hugs 3D Surface' : '3D Mid-Air'}
            </div>
          </button>

          {/* Geometry Shape: Flat vs Not Flat */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              updateSetting('profile', isFlat ? 'tube' : 'ribbon');
            }}
            className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 cursor-pointer ${
              isFlat
                ? isLight
                  ? 'border-emerald-500/40 bg-emerald-50 text-emerald-950 shadow-xs'
                  : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 shadow-xs'
                : isLight
                ? 'border-purple-500/40 bg-purple-50 text-purple-950 shadow-xs'
                : 'border-purple-400/40 bg-purple-500/15 text-purple-200 shadow-xs'
            }`}
            title={isFlat ? 'Flat (Ribbon band). Click to switch to Not Flat (Round 3D Tube).' : 'Not Flat (Round 3D Tube). Click to switch to Flat (Ribbon band).'}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
              Geometry Shape
            </div>
            <div className="text-xs font-bold mt-0.5">
              {isFlat ? 'Flat' : 'Not Flat'}
            </div>
            <div className="text-[10px] opacity-75 mt-0.5">
              {isFlat ? 'Flat Ribbon Band' : 'Round 3D Tube'}
            </div>
          </button>
        </div>
      </div>

      {/* 3. COLOR & MATERIAL: Quick palette swatches + native picker + Color Studio */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className={subHeadingClass}>Color & Material</div>
          <span className="font-mono text-[11px] font-bold opacity-80">
            {(brushSettings.color || '#38bdf8').toUpperCase()}
          </span>
        </div>

        {/* Quick Color Swatches */}
        <div className="grid grid-cols-8 gap-1 pt-0.5">
          {['#2563eb', '#38bdf8', '#ef4444', '#f59e0b', '#10b981', '#a855f7', '#18191d', '#ffffff'].map((hex) => {
            const isSelected = (brushSettings.color || '#38bdf8').toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => {
                  haptics.trigger('light');
                  updateSetting('color', hex);
                }}
                className={`!min-w-0 h-6 sm:h-7 rounded-md sm:rounded-lg border transition-transform active:scale-90 ${
                  isSelected
                    ? isLight
                      ? 'ring-2 ring-neutral-900 scale-105 border-white'
                      : 'ring-2 ring-white scale-105 border-black/40'
                    : 'border-black/20 dark:border-white/20 hover:scale-105'
                }`}
                style={{ backgroundColor: hex }}
                aria-label={`Use ${hex}`}
                title={hex}
              >
                <span className="sr-only">{hex}</span>
              </button>
            );
          })}
        </div>

        {/* Studio & Full Shaders button */}
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            onOpenColorStudio?.();
          }}
          className={`w-full min-h-[40px] p-2 rounded-xl border flex items-center justify-between transition-all group ${
            isLight
              ? 'bg-white border-black/10 hover:border-black/30 text-neutral-900'
              : 'bg-black/30 border-white/10 hover:border-white/30 text-white'
          }`}
          title="Open Color Studio (Palettes, HSV, PBR, Shaders)"
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-6 h-6 rounded-lg border border-black/15 dark:border-white/20 shadow-xs shrink-0"
              style={{ backgroundColor: brushSettings.color || '#38bdf8' }}
            />
            <div className="text-left">
              <div className="font-semibold text-xs leading-none">Color Studio & Shaders</div>
              <div className="text-[10px] opacity-60 mt-0.5">Palettes, gradients, & materials</div>
            </div>
          </div>
          <Palette className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* 3. BRUSHES MENU: Category Tabs & 3D Clay Mark Thumbnails */}
      <div className={cardClass}>
        <div className="flex items-center justify-between border-b pb-1.5 border-black/10 dark:border-white/10">
          <div className="text-xs font-bold tracking-tight text-current">Brushes</div>
          <div className="flex items-center gap-2 text-[10.5px] font-semibold">
            {(['Favorites', 'Sculpt', 'Surface', 'Polish'] as BrushCategoryTab[]).map((tab) => {
              const isTabActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    haptics.trigger('light');
                    setActiveTab(tab);
                  }}
                  className={`relative pb-0.5 transition-colors ${
                    isTabActive
                      ? 'text-neutral-950 dark:text-white font-bold'
                      : isLight
                      ? 'text-neutral-500 hover:text-neutral-900'
                      : 'text-white/40 hover:text-white/80'
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

        {/* 4-column Grid of 3D Clay Mark Presets */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {displayedBrushes.map((preset) => {
            const isSelected = activeBrush.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  haptics.trigger('medium');
                  setBrushSettings((prev) => applyCuratedBrush(preset, prev));
                }}
                className={`relative rounded-xl p-1.5 flex flex-col items-center justify-between transition-all active:scale-95 aspect-[4/5] border ${
                  isSelected
                    ? isLight
                      ? 'border-neutral-900 bg-black/[0.08] shadow-xs ring-1 ring-neutral-900/60'
                      : 'border-white bg-white/[0.12] shadow-[0_0_10px_rgba(255,255,255,0.2)] ring-1 ring-white/70'
                    : isLight
                    ? 'border-black/10 bg-white hover:border-black/20 text-neutral-800'
                    : 'border-white/[0.06] bg-[#18191e] hover:border-white/20 hover:bg-[#1f2127] text-white/80'
                }`}
                title={preset.description}
              >
                {/* Active Star Badge */}
                {isSelected && (
                  <Star className="w-2.5 h-2.5 text-neutral-900 fill-neutral-900 dark:text-white dark:fill-white absolute top-1 right-1" />
                )}

                {/* Brush Icon */}
                <div className="w-full flex-1 flex items-center justify-center p-0.5 overflow-hidden pointer-events-none">
                  <BrushShapeGlyph brushId={preset.id} size={0.05} boxSize={38} />
                </div>

                {/* Label */}
                <span
                  className={`text-[9.5px] truncate w-full text-center leading-tight pb-0.5 ${
                    isSelected
                      ? isLight ? 'text-neutral-950 font-bold' : 'text-white font-bold'
                      : 'opacity-80 font-medium'
                  }`}
                >
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom Falloff Curve preview & Stylus Tip */}
        <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium ${isLight ? 'text-neutral-500' : 'text-white/60'}`}>Falloff</span>
            <div className={`w-18 h-6 rounded-lg border px-1.5 py-0.5 flex items-center justify-center ${
              isLight ? 'border-black/10 bg-neutral-200/50' : 'border-white/10 bg-black/40'
            }`}>
              <svg viewBox="0 0 40 18" className={`w-full h-full stroke-current fill-none ${isLight ? 'text-neutral-700' : 'text-white/80'}`}>
                <path d="M 2 16 C 14 16, 20 2, 32 2 C 36 2, 38 16, 39 16" strokeWidth="1.2" />
              </svg>
            </div>
          </div>

          <button
            type="button"
            className="w-7 h-7 rounded-lg border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/5 flex items-center justify-center text-neutral-800 dark:text-white active:scale-95 transition-all shadow-xs"
            title="Stylus pressure tip"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current fill-none">
              <path d="M 12 2 L 18 8 L 8 18 L 4 20 L 6 16 Z" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 4. BRUSH SIZE & INTENSITY */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className={subHeadingClass}>Brush Size & Intensity</div>
          <div className="flex items-center gap-1.5">
            <BrushShapeGlyph brushId={activeBrush.id} size={0.04} boxSize={18} />
            <span className="text-[10.5px] font-semibold text-neutral-950 dark:text-white">{activeBrush.name}</span>
            <span className="text-[9px] font-medium opacity-65 font-mono">
              ({isConformal ? 'Conformal' : 'Non-Conf'}, {isFlat ? 'Flat' : 'Not Flat'})
            </span>
          </div>
        </div>

        {/* Live Real Shape & Size Control */}
        <RealBrushSizeControl
          brushSettings={brushSettings}
          onSizeChange={(newSize) => updateSetting('size', newSize)}
          theme={theme}
          showHeading={false}
        />

        {/* Opacity / Intensity Slider */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-medium text-current">Intensity</span>
            <span className="font-mono text-[10px] font-bold">
              {Math.round((brushSettings.opacity ?? 1.0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.02"
            value={brushSettings.opacity ?? 1.0}
            onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
            className={`w-full h-1.5 rounded cursor-pointer ${
              isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
            }`}
          />
        </div>
      </div>

      {/* 5. ADVANCED BRUSH SETTINGS (Expandable Accordion) */}
      <div className={cardClass}>
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            setShowAdvancedSettings((prev) => !prev);
          }}
          className="w-full flex items-center justify-between min-h-[36px] text-left"
        >
          <div className={subHeadingClass}>Advanced Brush Settings</div>
          <div className="flex items-center gap-1.5 opacity-70">
            <span className="text-[10px] font-mono">
              {showAdvancedSettings ? 'Hide' : 'Profile / Smoothing'}
            </span>
            {showAdvancedSettings ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </button>

        {showAdvancedSettings && (
          <div className="space-y-3 pt-1 border-t border-black/5 dark:border-white/5">
            {/* Profile Selection */}
            <div className="space-y-1">
              <label className={`text-[10.5px] font-medium ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                Stroke Profile
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PROFILES.map(({ id, label }) => {
                  const isSelected = brushSettings.profile === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        haptics.trigger('light');
                        updateSetting('profile', id);
                      }}
                      className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-center font-medium transition-all text-xs ${
                        isSelected
                          ? isLight
                            ? 'bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs'
                            : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
                          : isLight
                          ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                          : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Material Type Selection */}
            <div className="space-y-1 pt-1">
              <label className={`text-[10.5px] font-medium ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                Surface Finish
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {MATERIALS.map(({ id, label, icon: Icon }) => {
                  const isSelected = brushSettings.materialType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        haptics.trigger('light');
                        updateSetting('materialType', id);
                      }}
                      className={`min-h-[44px] px-2 py-1.5 rounded-xl border flex items-center justify-center gap-1.5 font-medium transition-all text-xs ${
                        isSelected
                          ? isLight
                            ? 'bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs'
                            : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
                          : isLight
                          ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                          : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smoothing Selection */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-medium text-current">Stroke Smoothing</span>
                <span className="font-mono text-[10px] font-bold">
                  {Math.round(brushSettings.smoothingStrength * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                {SMOOTHING_OPTIONS.map(({ id, label }) => {
                  const isSelected = brushSettings.smoothingAlgorithm === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        haptics.trigger('light');
                        updateSetting('smoothingAlgorithm', id);
                      }}
                      className={`min-h-[44px] px-1.5 py-1 rounded-xl border text-center font-medium transition-all text-[11px] ${
                        isSelected
                          ? isLight
                            ? 'bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs'
                            : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
                          : isLight
                          ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                          : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={brushSettings.smoothingStrength}
                onChange={(e) => updateSetting('smoothingStrength', parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded cursor-pointer ${
                  isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
                }`}
              />
            </div>

            {/* Drawing Assistance & Toggles */}
            <div className="space-y-2 pt-1 border-t border-black/5 dark:border-white/5">
              {/* Straight line mode */}
              <label className="flex items-center justify-between min-h-[44px] cursor-pointer">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  <span className="text-[11px] font-medium">Straight Line (Ruler)</span>
                </div>
                <input
                  type="checkbox"
                  checked={brushSettings.straightLineMode || false}
                  onChange={(e) => updateSetting('straightLineMode', e.target.checked)}
                  className="w-4 h-4 rounded accent-neutral-900 dark:accent-white cursor-pointer"
                />
              </label>

              {/* Shape snapping */}
              <label className="flex items-center justify-between min-h-[44px] cursor-pointer border-t border-black/5 dark:border-white/5 pt-1">
                <div className="flex items-center gap-2">
                  <Spline className="w-4 h-4" />
                  <span className="text-[11px] font-medium">Geometric Shape Snapping</span>
                </div>
                <input
                  type="checkbox"
                  checked={brushSettings.shapeSnapping || false}
                  onChange={(e) => updateSetting('shapeSnapping', e.target.checked)}
                  className="w-4 h-4 rounded accent-neutral-900 dark:accent-white cursor-pointer"
                />
              </label>

              {/* Pressure sensitivity */}
              <label className="flex items-center justify-between min-h-[44px] cursor-pointer border-t border-black/5 dark:border-white/5 pt-1">
                <span className="text-[11px] font-medium">Stylus Pressure Sensitivity</span>
                <input
                  type="checkbox"
                  checked={brushSettings.pressureSensitivity !== false}
                  onChange={(e) => updateSetting('pressureSensitivity', e.target.checked)}
                  className="w-4 h-4 rounded accent-neutral-900 dark:accent-white cursor-pointer"
                />
              </label>
            </div>

            {/* Eraser Mode: Cutout vs Vacuum */}
            <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-medium text-current">Eraser Mode</span>
                <span className="font-mono text-[10px] opacity-70">
                  {brushSettings.eraserMode === 'cutout' ? 'Negative Mask' : 'Super Zap (Continuous)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['vacuum', 'cutout'] as EraserMode[]).map((mode) => {
                  const isSelected = (brushSettings.eraserMode || 'vacuum') === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        haptics.trigger('light');
                        updateSetting('eraserMode', mode);
                      }}
                      className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-center font-medium transition-all text-xs ${
                        isSelected
                          ? isLight
                            ? 'bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs'
                            : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
                          : isLight
                          ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                          : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      {mode === 'vacuum' ? 'Super Zap (Full Curve)' : 'Mask Cutout'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
