import React, { useState } from 'react';
import { StudioEngine } from '../core/studioEngine';
import { NumpadTarget } from '../types';
import { getThemeClasses } from '../utils/themeStyles';
import {
  Scissors,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';

interface CurveDecimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine?: StudioEngine | null;
  onApplyDecimation?: (epsilon: number, preserveTopology: boolean) => void;
  onOpenNumpad?: (target: NumpadTarget) => void;
  theme?: 'light' | 'dark';
}

export const CurveDecimateModal: React.FC<CurveDecimateModalProps> = ({
  isOpen,
  onClose,
  engine,
  onApplyDecimation,
  onOpenNumpad,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  const t = getThemeClasses(theme);
  const isLight = theme === 'light';

  const [tolerance, setTolerance] = useState<number>(0.006);
  const [scope, setScope] = useState<'layer' | 'all'>('layer');
  const [lastStats, setLastStats] = useState<{ before: number; after: number } | null>(null);

  const handleApplyDecimation = () => {
    if (onApplyDecimation) {
      onApplyDecimation(tolerance, scope === 'layer');
      return;
    }
    if (!engine) return;
    const stats = engine.decimateCurves(tolerance, scope);
    if (stats) {
      setLastStats(stats);
    }
  };

  return (
    <div className="paperrocket-modal-overlay fixed inset-0 z-50 flex items-center justify-center select-none p-4">
      <div
        className={`pr-surface w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-150 ${t.shell}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${t.header}`}>
          <div className="flex items-center gap-2">
            <Scissors className={`w-4 h-4 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`} />
            <span className={`text-sm font-bold tracking-wide ${t.textPrimary}`}>Simplify Lines</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${t.btnGhost}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className={`text-xs leading-relaxed ${t.textSecondary}`}>
            Reduces extra points along your strokes to keep the canvas fast and responsive while preserving curve shape.
          </p>

          {/* Scope Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScope('layer')}
              className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                scope === 'layer'
                  ? isLight
                    ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                    : 'bg-white border-white text-neutral-900 shadow-md font-bold'
                  : isLight
                  ? 'bg-neutral-100 border-black/10 text-neutral-600 hover:bg-neutral-200'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              Active Layer Only
            </button>
            <button
              onClick={() => setScope('all')}
              className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                scope === 'all'
                  ? isLight
                    ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                    : 'bg-white border-white text-neutral-900 shadow-md font-bold'
                  : isLight
                  ? 'bg-neutral-100 border-black/10 text-neutral-600 hover:bg-neutral-200'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              All Project Curves
            </button>
          </div>

          {/* Tolerance Slider with Numpad */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={`font-medium ${t.textPrimary}`}>Simplification Tolerance</span>
              <button
                onClick={() =>
                  onOpenNumpad?.({
                    id: 'rdp_tol',
                    title: 'Simplification Tolerance',
                    value: tolerance,
                    min: 0.001,
                    max: 0.05,
                    step: 0.001,
                    unit: 'm',
                    onConfirm: (val) => setTolerance(val),
                  })
                }
                className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
                  isLight ? 'bg-neutral-100 text-neutral-900 border border-black/10' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                }`}
              >
                {(tolerance * 1000).toFixed(1)} mm
              </button>
            </div>
            <input
              type="range"
              min="0.001"
              max="0.03"
              step="0.001"
              value={tolerance}
              onChange={(e) => setTolerance(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg cursor-pointer accent-neutral-900 dark:accent-neutral-100 bg-neutral-200 dark:bg-neutral-800"
            />
          </div>

          {/* Stats Feedback Badge */}
          {lastStats && (
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              isLight
                ? 'bg-neutral-100 border-neutral-300 text-neutral-900'
                : 'bg-neutral-900 border-neutral-800 text-neutral-200'
            }`}>
              <div>
                <span className="font-semibold">Lines Simplified</span>
                <div className={`text-[11px] font-mono ${isLight ? 'text-neutral-700' : 'text-neutral-400'}`}>
                  {lastStats.before} pts → {lastStats.after} pts
                </div>
              </div>
              <div className="text-lg font-bold font-mono">
                -{Math.round(((lastStats.before - lastStats.after) / Math.max(1, lastStats.before)) * 100)}%
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onClose}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${t.btnSecondary}`}
            >
              Close
            </button>
            <button
              onClick={handleApplyDecimation}
              className="flex-1 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 active:scale-95 text-white dark:text-neutral-900 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
            >
              <Scissors className="w-4 h-4" />
              <span>Simplify Lines</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
