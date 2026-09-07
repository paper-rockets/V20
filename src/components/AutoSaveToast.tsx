// src/components/AutoSaveToast.tsx
import React from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveToastProps {
  status: AutoSaveStatus;
  message?: string;
  lastSaved?: Date | null;
  isPersistent?: boolean;
  theme?: 'light' | 'dark';
  onOpenStorage?: () => void;
}

export const AutoSaveToast: React.FC<AutoSaveToastProps> = ({
  status,
  message,
  lastSaved,
  isPersistent = false,
  theme = 'dark',
  onOpenStorage,
}) => {
  const isSaving = status === 'saving';
  const isError = status === 'error';

  const titleText = isSaving
    ? message || 'Auto-saving 3D project...'
    : isError
    ? message || 'Autosave error (check storage quota)'
    : message || (lastSaved ? 'All changes saved' : 'Autosave active');

  return (
    <div
      id="mody-autosave-indicator"
      aria-live="polite"
      title={titleText}
      onClick={onOpenStorage}
      className={`fixed bottom-3 right-3 z-40 select-none flex items-center justify-center p-1 rounded-full transition-all duration-300 ${
        onOpenStorage ? 'cursor-pointer hover:scale-110' : 'pointer-events-auto'
      }`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {isSaving && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 shadow-sm transition-colors duration-200 ${
            isError
              ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
              : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] ring-1 ring-black/20 dark:ring-white/20'
          }`}
        />
      </span>
    </div>
  );
};
