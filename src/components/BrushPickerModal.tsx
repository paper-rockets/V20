import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Paintbrush,
  Pipette,
  Sparkles,
  Zap,
  Sliders,
  Check,
  Trash2,
  Plus,
  X,
  Layers,
  Flame,
  Palette,
  Spline,
  Shapes,
  Eye,
  Info,
  Activity,
  Bookmark,
} from 'lucide-react';
import {
  BrushSettings,
  BrushPreset,
  ToolType,
  StrokeProfile,
  MaterialType,
} from '../types';
import {
  DEFAULT_BRUSH_PRESETS,
  getCustomBrushPresets,
  saveCustomBrushPreset,
  deleteCustomBrushPreset,
  applyBrushPresetToSettings,
  createPresetFromCurrentSettings,
} from '../presets/brushPresets';

interface BrushPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  onOpenBrushSettings?: () => void;
  onOpenColorStudio?: () => void;
  theme?: 'light' | 'dark';
}

type CategoryFilter = 'all' | 'ink' | 'tubes' | 'pbr' | 'glow_fx' | 'decals' | 'custom';

const BrushStrokeVisualizer: React.FC<{ preset: BrushPreset; theme?: 'light' | 'dark' }> = ({ preset, theme }) => {
  const isGlow = preset.materialType === 'glow' || preset.category === 'glow_fx';
  const isCutout = preset.materialType === 'cutout';
  const isTube = preset.profile === 'tube';
  const strokeWidth = Math.max(3, Math.min(10, (preset.settings?.size || 0.05) * 140));
  const strokeColor = preset.previewColor || preset.settings?.color || '#38bdf8';

  return (
    <div className={`w-full h-8 my-1.5 rounded-lg flex items-center justify-center overflow-hidden border ${
      theme === 'light' ? 'bg-neutral-100 border-neutral-200' : 'bg-neutral-900/90 border-neutral-800'
    }`}>
      <svg className="w-full h-full px-2" viewBox="0 0 100 24" fill="none">
        <defs>
          <filter id={`glow-${preset.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id={`grad-${preset.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
            <stop offset="50%" stopColor={strokeColor} stopOpacity="1" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {isGlow ? (
          <path
            d="M 6 12 Q 28 4, 50 12 T 94 12"
            stroke={strokeColor}
            strokeWidth={strokeWidth * 1.3}
            strokeLinecap="round"
            filter={`url(#glow-${preset.id})`}
            opacity="0.85"
          />
        ) : isTube ? (
          <>
            <path
              d="M 6 12 Q 28 4, 50 12 T 94 12"
              stroke="#0f172a"
              strokeWidth={strokeWidth + 2}
              strokeLinecap="round"
              opacity="0.6"
            />
            <path
              d="M 6 12 Q 28 4, 50 12 T 94 12"
              stroke={`url(#grad-${preset.id})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d="M 8 10 Q 28 3, 50 10 T 92 10"
              stroke="#ffffff"
              strokeWidth={Math.max(1, strokeWidth * 0.25)}
              strokeLinecap="round"
              opacity="0.75"
            />
          </>
        ) : isCutout ? (
          <path
            d="M 6 12 Q 28 4, 50 12 T 94 12"
            stroke="#ef4444"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="4 3"
          />
        ) : (
          <path
            d="M 6 12 Q 28 4, 50 12 T 94 12"
            stroke={`url(#grad-${preset.id})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
};

export const BrushPickerModal: React.FC<BrushPickerModalProps> = ({
  isOpen,
  onClose,
  brushSettings,
  setBrushSettings,
  tool,
  setTool,
  onOpenBrushSettings,
  onOpenColorStudio,
  theme = 'dark',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customPresets, setCustomPresets] = useState<BrushPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [showSaveCustom, setShowSaveCustom] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomPresets(getCustomBrushPresets());
    }
  }, [isOpen]);

  const allPresets = useMemo(() => {
    return [...customPresets, ...DEFAULT_BRUSH_PRESETS];
  }, [customPresets]);

  const filteredPresets = useMemo(() => {
    return allPresets.filter((preset) => {
      const matchesCategory =
        selectedCategory === 'all' || preset.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        preset.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        preset.profile.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allPresets, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: BrushPreset) => {
    setActivePresetId(preset.id);
    setBrushSettings((prev) => applyBrushPresetToSettings(preset, prev));
    setFeedbackToast(`Applied "${preset.name}"`);
    setTimeout(() => setFeedbackToast(null), 2000);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    const newPreset = createPresetFromCurrentSettings(newPresetName.trim(), brushSettings);
    const updated = saveCustomBrushPreset(newPreset);
    setCustomPresets(updated);
    setActivePresetId(newPreset.id);
    setNewPresetName('');
    setShowSaveCustom(false);
    setFeedbackToast(`Saved custom preset "${newPreset.name}"`);
    setTimeout(() => setFeedbackToast(null), 2000);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomBrushPreset(id);
    setCustomPresets(updated);
    if (activePresetId === id) setActivePresetId(null);
  };

  const handleActivateBrushSampler = () => {
    if (tool === 'brush_picker') {
      setTool('brush');
      setFeedbackToast('Brush DNA Sampler Deactivated');
      setTimeout(() => setFeedbackToast(null), 2000);
      return;
    }
    setTool('brush_picker');
    setFeedbackToast('Brush DNA Sampler Active: Click any 3D curve to sample (Click again to cancel)');
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const categories: { id: CategoryFilter; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'All', icon: Paintbrush },
    { id: 'ink', label: 'Ink & Pen', icon: Spline },
    { id: 'tubes', label: '3D Tubes', icon: Layers },
    { id: 'pbr', label: 'PBR Metals', icon: Zap },
    { id: 'glow_fx', label: 'Glow & FX', icon: Flame },
    { id: 'decals', label: 'Decals', icon: Shapes },
    { id: 'custom', label: 'Custom', icon: Bookmark },
  ];

  return createPortal(
    <div
      className="paperrocket-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="mody-brush-picker-modal"
        onClick={(e) => e.stopPropagation()}
        className={`pr-surface w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl select-none animate-in zoom-in-95 duration-150 overflow-hidden font-sans ${
          theme === 'light'
            ? 'bg-white text-neutral-800 border-neutral-200'
            : 'bg-[#18191d] text-neutral-200 border-neutral-800'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${
          theme === 'light' ? 'bg-neutral-50 border-neutral-200' : 'bg-[#101115] border-neutral-800'
        }`}>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Paintbrush className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
            <span>3D Brush Studio</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleActivateBrushSampler}
              className={`py-1 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                tool === 'brush_picker'
                  ? 'bg-neutral-900 dark:bg-white text-black font-bold ring-2 ring-neutral-400 dark:ring-neutral-600'
                  : theme === 'light' ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              }`}
              title={tool === 'brush_picker' ? 'Click to turn off sampler' : 'Sample Complete Stroke DNA from Viewport'}
            >
              <Pipette className="w-3.5 h-3.5" />
              <span>{tool === 'brush_picker' ? 'Cancel Sampling' : 'Sample DNA'}</span>
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'light' ? 'hover:bg-neutral-200 text-neutral-500' : 'hover:bg-white/10 text-neutral-400 hover:text-white'
              }`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {/* Active Brush Live DNA Summary Card */}
          <div className={`p-3 rounded-xl border space-y-2 ${
            theme === 'light' ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-950/60 border-neutral-800/80'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <span className={theme === 'light' ? 'text-neutral-600 font-medium' : 'text-neutral-400 font-medium'}>Active Configuration</span>
              <span className="font-mono text-neutral-700 dark:text-zinc-300 font-bold text-[11px]">
                {(brushSettings.size * 100).toFixed(1)}mm • {(brushSettings.opacity * 100).toFixed(0)}%
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1 text-center">
              <div className={`p-1.5 rounded-lg border ${theme === 'light' ? 'bg-white border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                <span className={`text-[10px] uppercase tracking-wider block ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>Profile</span>
                <span className="text-xs font-semibold capitalize">{brushSettings.profile}</span>
              </div>
              <div className={`p-1.5 rounded-lg border ${theme === 'light' ? 'bg-white border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                <span className={`text-[10px] uppercase tracking-wider block ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>Finish</span>
                <span className="text-xs font-semibold capitalize">
                  {brushSettings.materialType === 'animated_fx' ? brushSettings.shaderEffect || 'Shader' : brushSettings.materialType}
                </span>
              </div>
              <div className={`p-1.5 rounded-lg border ${theme === 'light' ? 'bg-white border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                <span className={`text-[10px] uppercase tracking-wider block ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>Smoothing</span>
                <span className="text-xs font-semibold capitalize">{brushSettings.smoothingAlgorithm}</span>
              </div>
              <div className={`p-1.5 rounded-lg border flex items-center justify-center ${theme === 'light' ? 'bg-white border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                <div
                  className="w-5 h-5 rounded-full border border-black/20 shadow-sm"
                  style={{ backgroundColor: brushSettings.color }}
                />
              </div>
            </div>
          </div>

          {/* Category Filters Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-neutral-900 text-white font-bold shadow-sm'
                      : theme === 'light'
                      ? 'bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 border border-neutral-200'
                      : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search & Custom Preset Add Row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search 3D brushes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`flex-1 px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-neutral-900 dark:border-white ${
                theme === 'light'
                  ? 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400'
                  : 'bg-neutral-950 border-neutral-800 text-white placeholder-neutral-500'
              }`}
            />

            <button
              type="button"
              onClick={() => setShowSaveCustom(!showSaveCustom)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 font-medium transition-colors ${
                theme === 'light'
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white'
              }`}
              title="Save Current Brush as Preset"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>

          {/* Save Custom Preset Form Popup */}
          {showSaveCustom && (
            <form onSubmit={handleSaveCustom} className={`p-3 rounded-xl border space-y-2 animate-in fade-in duration-100 ${
              theme === 'light' ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
            }`}>
              <span className="text-xs font-semibold block">Save Active Brush as Preset</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter preset name..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  autoFocus
                  className={`flex-1 px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-neutral-900 dark:border-white ${
                    theme === 'light' ? 'bg-white border-neutral-300 text-neutral-900' : 'bg-neutral-900 border-neutral-700 text-white'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!newPresetName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white hover:bg-neutral-900 dark:bg-white disabled:opacity-40 text-black font-semibold text-xs transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveCustom(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* Presets Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {filteredPresets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`relative p-3 rounded-xl border text-left cursor-pointer transition-all group flex flex-col justify-between ${
                    isSelected
                      ? 'bg-neutral-900 dark:bg-white/10 border-neutral-900 dark:border-white shadow-md ring-1 ring-neutral-900 dark:ring-white/30'
                      : theme === 'light'
                      ? 'bg-white border-neutral-200 hover:border-neutral-400 hover:shadow-sm'
                      : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold group-hover:text-neutral-700 dark:text-zinc-300 transition-colors truncate">
                        {preset.name}
                      </span>
                      {preset.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustom(preset.id, e)}
                          className="p-1 text-neutral-400 hover:text-neutral-700 dark:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete custom preset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <p className={`text-[10.5px] line-clamp-2 leading-relaxed ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      {preset.description}
                    </p>

                    {/* Visual Stroke Preview */}
                    <BrushStrokeVisualizer preset={preset} theme={theme} />
                  </div>

                  {/* Preset DNA Badges */}
                  <div className={`flex items-center justify-between pt-1 border-t text-[10px] ${
                    theme === 'light' ? 'border-neutral-100' : 'border-neutral-900'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded border capitalize ${
                        theme === 'light' ? 'bg-neutral-100 border-neutral-200 text-neutral-700' : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                      }`}>
                        {preset.profile}
                      </span>
                      {preset.materialType === 'animated_fx' ? (
                        <span className="px-1.5 py-0.5 rounded bg-neutral-900 dark:bg-white/20 border border-neutral-900 dark:border-white/30 text-neutral-700 dark:text-zinc-300 font-medium">
                          {preset.shaderEffect}
                        </span>
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded border capitalize ${
                          theme === 'light' ? 'bg-neutral-100 border-neutral-200 text-neutral-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                        }`}>
                          {preset.materialType}
                        </span>
                      )}
                    </div>

                    <div
                      className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-inner shrink-0"
                      style={{ backgroundColor: preset.previewColor || preset.settings?.color || '#38bdf8' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPresets.length === 0 && (
            <div className="text-center py-8 text-xs text-neutral-500">
              No brush presets match your search query.
            </div>
          )}

          {/* Quick Sliders */}
          <div className={`p-3 rounded-xl border space-y-3 ${
            theme === 'light' ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-950/40 border-neutral-800/60'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${theme === 'light' ? 'text-neutral-700' : 'text-neutral-300'}`}>Quick Brush Sliders</span>
              {onOpenBrushSettings && (
                <button
                  type="button"
                  onClick={onOpenBrushSettings}
                  className="text-[11px] text-neutral-700 dark:text-zinc-300 hover:underline flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" />
                  Advanced Settings
                </button>
              )}
            </div>

            {/* Size Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>Brush Size</span>
                <span className="font-mono font-bold text-neutral-700 dark:text-zinc-300">{(brushSettings.size * 100).toFixed(1)}mm</span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.25"
                step="0.002"
                value={brushSettings.size}
                onChange={(e) =>
                  setBrushSettings((prev) => ({ ...prev, size: parseFloat(e.target.value) }))
                }
                className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none"
              />
            </div>

            {/* Opacity Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>Stroke Opacity</span>
                <span className="font-mono font-bold text-neutral-700 dark:text-zinc-300">{Math.round(brushSettings.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={brushSettings.opacity}
                onChange={(e) =>
                  setBrushSettings((prev) => ({ ...prev, opacity: parseFloat(e.target.value) }))
                }
                className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none"
              />
            </div>
          </div>
        </div>

        {/* Footer Toast feedback */}
        {feedbackToast && (
          <div className="px-4 py-2 bg-neutral-900 dark:bg-white/15 border-t border-neutral-900 dark:border-white/30 text-[11px] text-neutral-700 dark:text-zinc-300 flex items-center justify-between font-medium animate-in fade-in duration-100">
            <span>{feedbackToast}</span>
            {tool === 'brush_picker' && (
              <button
                type="button"
                onClick={() => {
                  setTool('brush');
                  setFeedbackToast('Sampler Deactivated');
                  setTimeout(() => setFeedbackToast(null), 1500);
                }}
                className="px-2 py-0.5 rounded bg-black/50 hover:bg-black/80 text-white font-bold text-[10px] ml-2 transition-colors cursor-pointer"
              >
                Turn Off ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
