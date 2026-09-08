import React, { useEffect, useRef } from 'react';
import {
  IcSettings as Settings,
  IcFullscreen as Maximize,
  IcExitFullscreen as Minimize,
  IcSun as Sun,
  IcSave as Save,
  IcSessions as FolderArchive,
} from '../pro/StudioIcons';
import { Square, X } from 'lucide-react';

interface StudioTopMoreMenuProps {
  open: boolean;
  theme: 'light' | 'dark';
  isFullscreen: boolean;
  onClose: () => void;
  onQuickSave?: () => void;
  onOpenSessions?: () => void;
  onOpenIllumination?: () => void;
  onOpenShapes: () => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onSelect: () => void;
  isLight: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, description, onSelect, isLight }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`min-h-[56px] w-full rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-[0.99] ${
      isLight ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200' : 'bg-white/[0.07] text-white hover:bg-white/[0.12]'
    }`}
  >
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5">{label}</span>
        <span className={`block truncate text-xs leading-4 ${isLight ? 'text-neutral-600' : 'text-white/60'}`}>
          {description}
        </span>
      </span>
    </span>
  </button>
);

export const StudioTopMoreMenu: React.FC<StudioTopMoreMenuProps> = ({
  open,
  theme,
  isFullscreen,
  onClose,
  onQuickSave,
  onOpenSessions,
  onOpenIllumination,
  onOpenShapes,
  onOpenSettings,
  onToggleFullscreen,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
      ) as HTMLElement[];
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const select = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-[70] md:hidden">
      <div
        className="absolute inset-0 h-full w-full cursor-default bg-black/45"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        id="studio-top-more-menu"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-more-title"
        className={`absolute inset-x-0 bottom-0 rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl ${
          isLight ? 'bg-white text-neutral-900' : 'bg-[#15171c] text-white'
        }`}
      >
        <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <h2 id="studio-more-title" className="text-base font-semibold">More actions</h2>
          <button
            type="button"
            onClick={onClose}
            className={`grid h-11 w-11 place-items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/10'
            }`}
            aria-label="Close more actions"
          >
            <X className="h-5 w-5" strokeWidth={1.6} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2" aria-label="Studio actions">
          {onQuickSave && (
            <ActionButton icon={<Save className="h-5 w-5" />} label="Save" description="Quick save" onSelect={select(onQuickSave)} isLight={isLight} />
          )}
          {onOpenSessions && (
            <ActionButton icon={<FolderArchive className="h-5 w-5" />} label="Sessions" description="Versions and files" onSelect={select(onOpenSessions)} isLight={isLight} />
          )}
          {onOpenIllumination && (
            <ActionButton icon={<Sun className="h-5 w-5 text-amber-400" />} label="Lighting" description="Scene illumination" onSelect={select(onOpenIllumination)} isLight={isLight} />
          )}
          <ActionButton icon={<Square className="h-5 w-5" />} label="Shapes" description="Shape snapping" onSelect={select(onOpenShapes)} isLight={isLight} />
          <ActionButton icon={<Settings className="h-5 w-5" />} label="Settings" description="Studio preferences" onSelect={select(onOpenSettings)} isLight={isLight} />
          <ActionButton
            icon={isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            description="Adjust workspace view"
            onSelect={select(onToggleFullscreen)}
            isLight={isLight}
          />
        </div>
      </div>
    </div>
  );
};
