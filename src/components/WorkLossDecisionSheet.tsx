import React, { useEffect, useRef } from 'react';
import { Save, ShieldAlert, X } from 'lucide-react';

interface WorkLossDecisionSheetProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel: string;
  theme?: 'light' | 'dark';
  busy?: boolean;
  onSave: () => void;
  onReplace: () => void;
  onCancel: () => void;
}

export const WorkLossDecisionSheet: React.FC<WorkLossDecisionSheetProps> = ({
  isOpen,
  title,
  description,
  actionLabel,
  theme = 'dark',
  busy = false,
  onSave,
  onReplace,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    window.requestAnimationFrame(() => cancelRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [busy, isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/65 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="work-loss-title"
        aria-describedby="work-loss-description"
        className={`w-full max-w-md rounded-2xl border p-4 shadow-2xl ${
          isLight ? 'border-black/15 bg-white text-neutral-950' : 'border-white/15 bg-[#17191e] text-white'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-400/15 text-amber-300'}`}>
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="work-loss-title" className="text-base font-bold">{title}</h2>
            <p id="work-loss-description" className={`mt-1 text-xs leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-300'}`}>{description}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" aria-label="Cancel and close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className={`min-h-12 rounded-xl border px-4 text-sm font-bold ${isLight ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-white bg-white text-neutral-950'}`}>
            Cancel — Keep My Work
          </button>
          <button type="button" onClick={onSave} disabled={busy} className={`min-h-12 rounded-xl border px-4 text-sm font-semibold ${isLight ? 'border-black/15 bg-neutral-100' : 'border-white/15 bg-white/10'}`}>
            <span className="inline-flex items-center gap-2"><Save className="h-4 w-4" />Save &amp; {actionLabel}</span>
          </button>
          <button type="button" onClick={onReplace} disabled={busy} className="min-h-12 rounded-xl border border-red-500/40 px-4 text-sm font-semibold text-red-600 dark:text-red-300">
            {actionLabel} Without Saving
          </button>
        </div>
      </section>
    </div>
  );
};
