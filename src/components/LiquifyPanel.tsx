import React from 'react';
import { LiquifyMode, LiquifySettings, NumpadTarget } from '../types';
import { getThemeClasses } from '../utils/themeStyles';
import {
  Hand,
  Move,
  Shrink,
  Expand,
  Wind,
  Check,
  RotateCcw,
  Eye,
  Sliders,
  X,
  Sparkles,
} from 'lucide-react';

interface LiquifyPanelProps {
  isOpen?: boolean;
  inline?: boolean;
  onClose?: () => void;
  settings: LiquifySettings;
  setSettings?: React.Dispatch<React.SetStateAction<LiquifySettings>>;
  onSettingsChange?: (settings: LiquifySettings) => void;
  isCompareActive: boolean;
  onToggleCompare: (active: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset?: () => void;
  onOpenNumpad?: (target: NumpadTarget) => void;
  theme?: 'light' | 'dark';
}

export const LiquifyPanel: React.FC<LiquifyPanelProps> = ({
  isOpen = true,
  inline = false,
  onClose,
  settings,
  setSettings,
  onSettingsChange,
  isCompareActive,
  onToggleCompare,
  onApply,
  onCancel,
  onReset,
  onOpenNumpad,
  theme = 'dark',
}) => {
  if (isOpen === false) return null;

  const t = getThemeClasses(theme);
  const isLight = theme === 'light';

  const updateSetting = <K extends keyof LiquifySettings>(key: K, value: LiquifySettings[K]) => {
    const next = { ...settings, [key]: value };
    if (onSettingsChange) {
      onSettingsChange(next);
    } else if (setSettings) {
      setSettings(next);
    }
  };

  const modes: { id: LiquifyMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'push',
      label: 'Push',
      icon: <Move className="w-4 h-4" />,
      desc: 'Displaces vertices along screen drag vector in 3D camera plane',
    },
    {
      id: 'pinch',
      label: 'Pinch',
      icon: <Shrink className="w-4 h-4" />,
      desc: 'Attracts vertices toward brush epicenter with radial falloff',
    },
    {
      id: 'inflate',
      label: 'Inflate',
      icon: <Expand className="w-4 h-4" />,
      desc: 'Repels vertices outward from brush epicenter',
    },
    {
      id: 'comb',
      label: 'Comb',
      icon: <Wind className="w-4 h-4" />,
      desc: 'Smooths and aligns curve tangents along stroke drag direction',
    },
  ];

  return (
    <div
      className={
        inline
          ? `pr-surface w-full select-none rounded-xl border p-3.5 space-y-3 font-sans ${isLight ? 'bg-white border-black/10' : 'bg-[#18191d] border-white/10'}`
          : `pr-surface paperrocket-context-panel fixed left-[76px] sm:left-[88px] top-1/2 -translate-y-1/2 z-50 w-[300px] max-w-[calc(100vw-6rem)] max-h-[72vh] overflow-y-auto select-none shadow-2xl rounded-2xl border p-3.5 space-y-3 font-sans animate-in fade-in slide-in-from-left-2 duration-150 ${isLight ? 'bg-white border-black/10 shadow-black/10' : 'bg-[#18191d] border-neutral-800 shadow-black/50'}`
      }
    >
      {/* Header */}
      <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-900 dark:text-zinc-300'}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${t.textPrimary}`}>Push & Pull</span>
        </div>
        {(onClose || onCancel) && !inline && (
          <button
            onClick={onClose || onCancel}
            className={`p-1 rounded-lg transition-colors ${t.btnGhost}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => updateSetting('mode', m.id)}
            className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition-all ${
              settings.mode === m.id
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                  : 'bg-white border-white text-neutral-900 shadow-md font-bold'
                : isLight
                ? 'bg-neutral-100 border-black/10 text-neutral-700 hover:bg-neutral-200'
                : 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Mode description */}
      <div className={`text-[11px] px-1 italic ${t.textSecondary}`}>
        {modes.find((m) => m.id === settings.mode)?.desc}
      </div>

      {/* Parameter Sliders */}
      <div className="space-y-2.5 pt-1">
        {/* Brush Radius (Size) */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-medium ${t.textSecondary}`}>Brush Radius</span>
            <button
              onClick={() =>
                onOpenNumpad?.({
                  id: 'liquify_radius',
                  title: 'Brush Radius',
                  value: settings.brushRadius,
                  min: 0.02,
                  max: 1.5,
                  step: 0.02,
                  unit: 'm',
                  onConfirm: (val) => updateSetting('brushRadius', val),
                })
              }
              className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-bold ${
                isLight ? 'bg-neutral-100 text-neutral-900 border border-black/10' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
              }`}
            >
              {(settings.brushRadius * 100).toFixed(0)} cm
            </button>
          </div>
          <input
            type="range"
            min="0.02"
            max="1.2"
            step="0.02"
            value={settings.brushRadius}
            onChange={(e) => updateSetting('brushRadius', parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg cursor-pointer accent-neutral-900 dark:accent-neutral-100 bg-neutral-200 dark:bg-neutral-800"
          />
        </div>

        {/* Strength */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-medium ${t.textSecondary}`}>Influence Strength</span>
            <button
              onClick={() =>
                onOpenNumpad?.({
                  id: 'liquify_strength',
                  title: 'Influence Strength',
                  value: settings.influenceStrength,
                  min: 0.05,
                  max: 2.0,
                  step: 0.05,
                  unit: 'x',
                  onConfirm: (val) => updateSetting('influenceStrength', val),
                })
              }
              className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-bold ${
                isLight ? 'bg-neutral-100 text-neutral-900 border border-black/10' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
              }`}
            >
              {(settings.influenceStrength * 100).toFixed(0)}%
            </button>
          </div>
          <input
            type="range"
            min="0.05"
            max="2.0"
            step="0.05"
            value={settings.influenceStrength}
            onChange={(e) => updateSetting('influenceStrength', parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg cursor-pointer accent-neutral-900 dark:accent-neutral-100 bg-neutral-200 dark:bg-neutral-800"
          />
        </div>
      </div>

      {/* Non-Destructive Compare & Apply Controls */}
      <div className={`pt-2 border-t space-y-2 ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        {/* Hold to Compare A/B Toggle */}
        <button
          onPointerDown={() => onToggleCompare(true)}
          onPointerUp={() => onToggleCompare(false)}
          onPointerLeave={() => onToggleCompare(false)}
          className={`w-full py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            isCompareActive
              ? 'bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900 shadow-lg font-bold'
              : isLight
              ? 'bg-neutral-100 border-black/10 text-neutral-700 hover:bg-neutral-200'
              : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
          }`}
          title="Hold to view Original Base State vs Live Deformed Mesh"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{isCompareActive ? 'Showing Original (A)' : 'Hold to Compare A/B'}</span>
        </button>

        {/* Commit / Discard Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className={`py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${t.btnSecondary}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
          <button
            onClick={onApply}
            className="py-1.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 active:scale-95 text-white dark:text-neutral-900 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
};
