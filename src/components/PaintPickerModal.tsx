import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Palette,
  Pipette,
  Zap,
  Flame,
  Layers,
  Sparkles,
  Sliders,
  Check,
  Copy,
  X,
  Shuffle,
  Eye,
  Sun,
  Shield,
  RefreshCw,
  Scissors,
} from 'lucide-react';
import {
  BrushSettings,
  ToolType,
  MaterialType,
} from '../types';
import {
  CURATED_PAINT_PALETTES,
  PAINT_FINISH_PRESETS,
  getRecentPaintColors,
  addRecentPaintColor,
  applyPaintPresetToSettings,
} from '../presets/paintPresets';
import { normalizeHexColor } from '../core/materialCache';
import {
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
  hexToOKLCH,
  oklchToHex,
  generateHarmonies,
} from '../core/colorMath';
import { getThemeClasses } from '../utils/themeStyles';

interface PaintPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  onOpenColorStudio?: () => void;
  theme?: 'light' | 'dark';
}

type TabType = 'wheel' | 'finishes' | 'palettes' | 'oklab';

export const PaintPickerModal: React.FC<PaintPickerModalProps> = ({
  isOpen,
  onClose,
  brushSettings,
  setBrushSettings,
  tool,
  setTool,
  onOpenColorStudio,
  theme = 'dark',
}) => {
  const themeClasses = getThemeClasses(theme);
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<TabType>('wheel');
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [selectedPaletteId, setSelectedPaletteId] = useState<string>('cyberpunk');
  const [copiedHex, setCopiedHex] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const nativeColorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRecentColors(getRecentPaintColors());
    }
  }, [isOpen]);

  // Color Space States
  const currentHex = brushSettings.color || '#38bdf8';
  const rgb = useMemo(() => hexToRgb(currentHex), [currentHex]);
  const hsv = useMemo(() => rgbToHsv(rgb.r, rgb.g, rgb.b), [rgb]);
  const oklch = useMemo(() => hexToOKLCH(currentHex), [currentHex]);
  const harmonies = useMemo(() => generateHarmonies(currentHex), [currentHex]);

  if (!isOpen) return null;

  const handleSelectColor = (hex: string) => {
    const valid = normalizeHexColor(hex, '#38bdf8');
    setBrushSettings((prev) => ({ ...prev, color: valid }));
    const updated = addRecentPaintColor(valid);
    setRecentColors(updated);
  };

  const handleCopyHex = () => {
    navigator.clipboard.writeText(currentHex);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 1500);
  };

  const handleActivatePaintSampler = () => {
    setTool('paint_picker');
    setFeedbackToast('Paint Eyedropper Active: Click any surface to sample paint & finish');
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const handleHsvChange = (h: number, s: number, v: number) => {
    const { r, g, b } = hsvToRgb(h, s, v);
    const hex = rgbToHex(r, g, b);
    handleSelectColor(hex);
  };

  const handleOklchChange = (L: number, C: number, hRad: number) => {
    const hex = oklchToHex({ L, C, h: hRad });
    handleSelectColor(hex);
  };

  const activePalette = CURATED_PAINT_PALETTES.find((p) => p.id === selectedPaletteId) || CURATED_PAINT_PALETTES[0];

  if (!isOpen) return null;

  return createPortal(
    <div
      className="paperrocket-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="mody-paint-picker-modal"
        onClick={(e) => e.stopPropagation()}
        className={`pr-surface w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl select-none animate-in zoom-in-95 duration-150 overflow-hidden font-sans ${themeClasses.shell}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${themeClasses.header}`}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-md border border-black/20 shadow-inner shrink-0"
              style={{ backgroundColor: currentHex }}
            />
            <div>
              <h2 className={`text-sm font-semibold tracking-wide ${themeClasses.textPrimary}`}>3D Paint & Material Picker</h2>
              <p className={`text-[11px] ${themeClasses.textSecondary}`}>PBR Finishes, OKLab Pigments & Surface Sampler</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${themeClasses.btnGhost}`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Material Pipeline Switcher */}
        <div className={`px-4 pt-3 pb-1 border-b ${isLight ? 'bg-neutral-50/50 border-black/10' : 'bg-neutral-950/30 border-neutral-800/60'}`}>
          <div className={`text-[10px] font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1 ${themeClasses.textSecondary}`}>
            <Palette className="w-3 h-3" />
            <span>Material Shader Mode</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'shadeless' as MaterialType, label: 'Flat Paint', icon: Palette },
              { id: 'shaded' as MaterialType, label: 'PBR Lit', icon: Zap },
              { id: 'glow' as MaterialType, label: 'Glow', icon: Flame },
              { id: 'cutout' as MaterialType, label: 'Cutout', icon: Scissors },
            ].map((mat) => {
              const Icon = mat.icon;
              const isSelected = (brushSettings.materialType || 'shaded') === mat.id;
              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setBrushSettings((prev) => ({ ...prev, materialType: mat.id }))}
                  className={`py-1.5 px-2 rounded-xl border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? isLight ? 'bg-neutral-900 text-white font-bold border-neutral-900 shadow-sm' : 'bg-white text-zinc-950 font-bold border-white shadow-sm'
                      : isLight ? 'bg-white border-black/10 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{mat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Paint Eyedropper Banner */}
          <div className={`flex items-center justify-between p-3 rounded-xl border ${
            isLight
              ? 'bg-neutral-100 border-black/10'
              : 'bg-neutral-900/80 border-neutral-800'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${tool === 'paint_picker' || tool === 'eyedropper' ? 'bg-neutral-900 dark:bg-white text-white dark:text-zinc-950 font-bold animate-pulse' : isLight ? 'bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-neutral-200' : 'bg-neutral-900 dark:bg-white/20 text-neutral-800 dark:text-zinc-300'}`}>
                <Pipette className="w-4 h-4" />
              </div>
              <div>
                <span className={`text-xs font-semibold block ${themeClasses.textPrimary}`}>Paint & Finish Eyedropper</span>
                <span className={`text-[11px] block ${themeClasses.textSecondary}`}>Sample exact color, roughness, and material</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleActivatePaintSampler}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                tool === 'paint_picker' || tool === 'eyedropper'
                  ? 'bg-neutral-900 dark:bg-white text-white font-bold'
                  : themeClasses.btnSecondary
              }`}
            >
              <Pipette className="w-3 h-3" />
              {tool === 'paint_picker' || tool === 'eyedropper' ? 'Sampling Active' : 'Sample from Scene'}
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border ${isLight ? 'bg-neutral-100 border-black/10' : 'bg-neutral-950 border-neutral-800/80'}`}>
            <button
              type="button"
              onClick={() => setActiveTab('wheel')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'wheel'
                  ? isLight ? 'bg-white text-neutral-950 shadow-sm font-semibold' : 'bg-neutral-800 text-white shadow-sm font-semibold'
                  : themeClasses.textSecondary
              }`}
            >
              <Palette className="w-3 h-3" />
              Color Gamut
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('finishes')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'finishes'
                  ? isLight ? 'bg-white text-neutral-950 shadow-sm font-semibold' : 'bg-neutral-800 text-white shadow-sm font-semibold'
                  : themeClasses.textSecondary
              }`}
            >
              <Zap className="w-3 h-3" />
              PBR Finishes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('palettes')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'palettes'
                  ? isLight ? 'bg-white text-neutral-950 shadow-sm font-semibold' : 'bg-neutral-800 text-white shadow-sm font-semibold'
                  : themeClasses.textSecondary
              }`}
            >
              <Layers className="w-3 h-3" />
              Palettes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('oklab')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'oklab'
                  ? isLight ? 'bg-white text-neutral-950 shadow-sm font-semibold' : 'bg-neutral-800 text-white shadow-sm font-semibold'
                  : themeClasses.textSecondary
              }`}
            >
              <Sparkles className="w-3 h-3" />
              OKLab / LCh
            </button>
          </div>

        {/* TAB 1: COLOR GAMUT & SPECTRUM */}
        {activeTab === 'wheel' && (
          <div className="space-y-4">
            {/* Color preview bar & Hex readout */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${themeClasses.innerCard}`}>
              <div
                className="w-10 h-10 rounded-xl border border-black/20 shadow-md shrink-0 cursor-pointer relative group"
                style={{ backgroundColor: currentHex }}
                onClick={() => nativeColorInputRef.current?.click()}
                title="Click for Native Color Picker"
              >
                <input
                  ref={nativeColorInputRef}
                  type="color"
                  value={currentHex}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-mono text-sm font-semibold tracking-wider uppercase ${themeClasses.textPrimary}`}>
                    {currentHex}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHex}
                    className={`p-1 transition-colors cursor-pointer ${themeClasses.btnGhost}`}
                    title="Copy Hex"
                  >
                    {copiedHex ? <Check className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className={`flex items-center gap-2 text-[10px] font-mono ${themeClasses.textSecondary}`}>
                  <span>RGB({rgb.r}, {rgb.g}, {rgb.b})</span>
                  <span>•</span>
                  <span>OKLCh({Math.round(oklch.L * 100)}%, {(oklch.C * 100).toFixed(1)}, {Math.round((oklch.h * 180) / Math.PI)}°)</span>
                </div>
              </div>
            </div>

            {/* Hue Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className={themeClasses.textSecondary}>Hue</span>
                <span className={`font-mono font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>{Math.round(hsv.h * 360)}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={hsv.h}
                onChange={(e) => handleHsvChange(parseFloat(e.target.value), hsv.s, hsv.v)}
                className="w-full cursor-pointer h-3 rounded-lg appearance-none"
                style={{
                  background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              />
            </div>

            {/* Saturation Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className={themeClasses.textSecondary}>Saturation (Chroma)</span>
                <span className={`font-mono font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>{Math.round(hsv.s * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={hsv.s}
                onChange={(e) => handleHsvChange(hsv.h, parseFloat(e.target.value), hsv.v)}
                className="w-full cursor-pointer h-2.5 rounded-lg appearance-none"
                style={{
                  background: `linear-gradient(to right, #888888, ${currentHex})`,
                }}
              />
            </div>

            {/* Value / Brightness Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className={themeClasses.textSecondary}>Brightness (Value)</span>
                <span className={`font-mono font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>{Math.round(hsv.v * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="1"
                step="0.01"
                value={hsv.v}
                onChange={(e) => handleHsvChange(hsv.h, hsv.s, parseFloat(e.target.value))}
                className="w-full cursor-pointer h-2.5 rounded-lg appearance-none"
                style={{
                  background: `linear-gradient(to right, #000000, ${currentHex})`,
                }}
              />
            </div>

            {/* Harmonious Palette Suggestions */}
            <div className={`space-y-2 pt-2 border-t ${themeClasses.borderSubtle}`}>
              <span className={`text-[11px] font-semibold block ${themeClasses.textSecondary}`}>OKLab Color Harmonies</span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {harmonies.analogous.map((hex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectColor(hex)}
                    className="w-7 h-7 rounded-lg border border-black/15 hover:scale-110 transition-transform shrink-0 cursor-pointer shadow-xs"
                    style={{ backgroundColor: hex }}
                    title={`Harmonious Analogous ${hex}`}
                  />
                ))}
                {harmonies.complementary.map((hex, idx) => (
                  <button
                    key={`comp-${idx}`}
                    type="button"
                    onClick={() => handleSelectColor(hex)}
                    className="w-7 h-7 rounded-lg border border-black/15 hover:scale-110 transition-transform shrink-0 cursor-pointer shadow-xs"
                    style={{ backgroundColor: hex }}
                    title={`Harmonious Complementary ${hex}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PBR FINISHES & SHADERS */}
        {activeTab === 'finishes' && (
          <div className="space-y-4">
            {/* Finish Cards Grid */}
            <div className="grid grid-cols-2 gap-2">
              {PAINT_FINISH_PRESETS.map((finish) => {
                const isActive =
                  brushSettings.materialType === finish.materialType &&
                  (finish.materialType !== 'animated_fx' || brushSettings.shaderEffect === finish.shaderEffect);
                return (
                  <button
                    key={finish.id}
                    type="button"
                    onClick={() => {
                      setBrushSettings((prev) => applyPaintPresetToSettings(finish, prev));
                      setFeedbackToast(`Applied finish: ${finish.name}`);
                      setTimeout(() => setFeedbackToast(null), 2000);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? isLight ? 'bg-neutral-100 dark:bg-white/10 border-neutral-400 dark:border-neutral-600 shadow-sm' : 'bg-neutral-900 dark:bg-black/50/40 border-neutral-900 dark:border-white shadow-sm'
                        : themeClasses.innerCardMuted
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${themeClasses.textPrimary}`}>{finish.name}</span>
                      <span className={`text-[10px] ${themeClasses.textMuted}`}>{finish.category}</span>
                    </div>

                    <div className={`flex items-center gap-1.5 text-[10px] ${themeClasses.textSecondary}`}>
                      <span>R: {(finish.roughness * 100).toFixed(0)}%</span>
                      <span>•</span>
                      <span>M: {(finish.metalness * 100).toFixed(0)}%</span>
                      {finish.emissiveIntensity > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-neutral-700 dark:text-zinc-300 font-bold">Glow</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* PBR Surface Sliders */}
            <div className={`p-3 rounded-xl border space-y-3 ${themeClasses.innerCard}`}>
              <span className={`text-xs font-semibold block ${themeClasses.textPrimary}`}>Fine-Tune PBR Material Finish</span>

              {/* Roughness */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className={themeClasses.textSecondary}>Surface Roughness (Gloss vs Matte)</span>
                  <span className={`font-mono font-bold ${themeClasses.textPrimary}`}>{Math.round(brushSettings.roughness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={brushSettings.roughness}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({ ...prev, roughness: parseFloat(e.target.value) }))
                  }
                  className={`w-full h-1.5 rounded-lg ${themeClasses.rangeSlider}`}
                />
              </div>

              {/* Metalness */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className={themeClasses.textSecondary}>Metalness (Dielectric vs Metallic)</span>
                  <span className={`font-mono font-bold ${themeClasses.textPrimary}`}>{Math.round(brushSettings.metalness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={brushSettings.metalness}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({ ...prev, metalness: parseFloat(e.target.value) }))
                  }
                  className={`w-full h-1.5 rounded-lg ${themeClasses.rangeSlider}`}
                />
              </div>

              {/* Emissive Intensity */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className={themeClasses.textSecondary}>Emissive Glow Strength</span>
                  <span className={`font-mono font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`}>{(brushSettings.emissiveIntensity || 0).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={brushSettings.emissiveIntensity || 0}
                  onChange={(e) =>
                    setBrushSettings((prev) => ({
                      ...prev,
                      emissiveIntensity: parseFloat(e.target.value),
                      materialType: parseFloat(e.target.value) > 0 ? 'glow' : prev.materialType,
                    }))
                  }
                  className={`w-full ${themeClasses.rangeSlider}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CURATED PALETTES & SWATCHES */}
        {activeTab === 'palettes' && (
          <div className="space-y-4">
            {/* Palette Select Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CURATED_PAINT_PALETTES.map((pal) => (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => setSelectedPaletteId(pal.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedPaletteId === pal.id
                      ? isLight ? 'bg-neutral-900 text-white font-bold shadow-sm' : 'bg-white text-zinc-950 font-bold shadow-sm'
                      : themeClasses.btnSecondary
                  }`}
                >
                  {pal.name}
                </button>
              ))}
            </div>

            {/* Active Palette Swatches */}
            <div className={`p-4 rounded-xl border space-y-2 ${themeClasses.innerCard}`}>
              <span className={`text-xs font-semibold block ${themeClasses.textPrimary}`}>{activePalette.name} Colors</span>
              <div className="grid grid-cols-4 gap-2">
                {activePalette.colors.map((hex, idx) => {
                  const isSelected = currentHex.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectColor(hex)}
                      className={`h-10 rounded-xl border relative transition-all hover:scale-105 flex items-center justify-center cursor-pointer shadow-xs ${
                        isSelected ? 'border-neutral-400 dark:border-neutral-600 ring-2 ring-neutral-900 dark:ring-white/40 scale-105 shadow-md' : 'border-black/15'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent Color History */}
            <div className="space-y-2">
              <span className={`text-xs font-semibold block ${themeClasses.textSecondary}`}>Recent Color History</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {recentColors.map((hex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectColor(hex)}
                    className="w-8 h-8 rounded-xl border border-black/15 hover:scale-110 transition-transform shrink-0 cursor-pointer shadow-xs"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: OKLAB / OKLCH POLAR PERCEPTUAL */}
        {activeTab === 'oklab' && (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border space-y-3 ${themeClasses.innerCard}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${themeClasses.textPrimary}`}>Perceptual OKLCh Space</span>
                <span className={`text-[10px] font-medium ${isLight ? 'text-neutral-900 dark:text-neutral-200' : 'text-neutral-700 dark:text-zinc-300'}`}>Uniform Perceived Contrast</span>
              </div>

              {/* Lightness L */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className={themeClasses.textSecondary}>Perceived Lightness (L)</span>
                  <span className={`font-mono font-bold ${themeClasses.textPrimary}`}>{Math.round(oklch.L * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.98"
                  step="0.01"
                  value={oklch.L}
                  onChange={(e) => handleOklchChange(parseFloat(e.target.value), oklch.C, oklch.h)}
                  className={`w-full h-2 rounded-lg ${themeClasses.rangeSlider}`}
                />
              </div>

              {/* Chroma C */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className={themeClasses.textSecondary}>Chroma Saturation (C)</span>
                  <span className={`font-mono font-bold ${themeClasses.textPrimary}`}>{(oklch.C * 100).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.35"
                  step="0.005"
                  value={oklch.C}
                  onChange={(e) => handleOklchChange(oklch.L, parseFloat(e.target.value), oklch.h)}
                  className={`w-full ${themeClasses.rangeSlider}`}
                />
              </div>

              {/* Hue Angle h */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className={themeClasses.textSecondary}>Hue Angle (h)</span>
                  <span className={`font-mono font-bold ${themeClasses.textPrimary}`}>{Math.round((oklch.h * 180) / Math.PI)}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.02"
                  value={oklch.h}
                  onChange={(e) => handleOklchChange(oklch.L, oklch.C, parseFloat(e.target.value))}
                  className="w-full cursor-pointer h-3 rounded-lg appearance-none"
                  style={{
                    background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                  }}
                />
              </div>
            </div>

            {onOpenColorStudio && (
              <button
                type="button"
                onClick={onOpenColorStudio}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${themeClasses.btnSecondary}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
                <span>Open Full Color Studio (Gradients & Harmonizers)</span>
              </button>
            )}
          </div>
        )}
      </div>

        {/* Footer Toast feedback */}
        {feedbackToast && (
          <div className="px-4 py-2 bg-neutral-900 dark:bg-white/10 border-t border-neutral-900 dark:border-white/30 text-[11px] text-neutral-800 dark:text-zinc-300 text-center font-medium animate-in fade-in duration-100">
            {feedbackToast}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
