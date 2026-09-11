import React from 'react';
import { Copy, Trash2, RotateCcw, X, Box, Spline } from 'lucide-react';
import { haptics } from '../../utils/haptics';

export interface SelectionInfo {
  type: 'model' | 'stroke';
  id: string;
  name: string;
}

interface SelectionActionBarProps {
  selection: SelectionInfo | null;
  onClone: () => void;
  onDelete: () => void;
  onResetTransform?: () => void;
  onDeselect: () => void;
  theme?: 'light' | 'dark';
}

export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
  selection,
  onClone,
  onDelete,
  onResetTransform,
  onDeselect,
  theme = 'dark',
}) => {
  if (!selection) return null;

  const isLight = theme === 'light';

  const handleCloneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.trigger('medium');
    onClone();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.trigger('heavy');
    onDelete();
  };

  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.trigger('light');
    onResetTransform?.();
  };

  const handleDeselectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.trigger('light');
    onDeselect();
  };

  const Icon = selection.type === 'model' ? Box : Spline;

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl shadow-2xl border backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 select-none max-w-[calc(100vw-32px)] ${
        isLight
          ? 'bg-white/95 border-black/15 text-neutral-800 shadow-[0_12px_40px_rgba(0,0,0,0.15)]'
          : 'bg-[#15171c]/95 border-white/20 text-neutral-100 shadow-[0_16px_50px_rgba(0,0,0,0.7)]'
      }`}
    >
      {/* Selected Item Indicator */}
      <div className="flex items-center gap-1.5 pr-1.5 border-r border-black/10 dark:border-white/10 shrink-0">
        <Icon className={`w-4 h-4 ${selection.type === 'model' ? 'text-sky-400' : 'text-emerald-400'}`} />
        <span
          className="text-xs font-semibold max-w-[90px] sm:max-w-[130px] truncate"
          title={selection.name}
        >
          {selection.name}
        </span>
      </div>

      {/* Clone Action Button */}
      <button
        type="button"
        onClick={handleCloneClick}
        className={`h-9 min-h-[36px] px-2.5 rounded-xl border flex items-center gap-1.5 font-semibold text-xs transition-all active:scale-95 ${
          isLight
            ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-800'
            : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-200'
        }`}
        title="Clone item"
      >
        <Copy className="w-3.5 h-3.5" />
        <span>Clone</span>
      </button>

      {/* Delete Action Button */}
      <button
        type="button"
        onClick={handleDeleteClick}
        className={`h-9 min-h-[36px] px-2.5 rounded-xl border flex items-center gap-1.5 font-semibold text-xs transition-all active:scale-95 ${
          isLight
            ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
            : 'bg-red-500/15 hover:bg-red-500/25 border-red-500/30 text-red-300'
        }`}
        title="Delete item"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-500" />
        <span>Delete</span>
      </button>

      {/* Reset Transform Button (Models only) */}
      {selection.type === 'model' && onResetTransform && (
        <button
          type="button"
          onClick={handleResetClick}
          className={`h-9 w-9 min-h-[36px] min-w-[36px] rounded-xl border flex items-center justify-center transition-all active:scale-95 ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-700'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
          }`}
          title="Reset position & rotation to center"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Deselect / Close Button */}
      <button
        type="button"
        onClick={handleDeselectClick}
        className={`h-9 w-9 min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center transition-colors opacity-60 hover:opacity-100 ${
          isLight ? 'hover:bg-black/5 text-neutral-700' : 'hover:bg-white/10 text-neutral-300'
        }`}
        title="Deselect"
        aria-label="Deselect item"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
