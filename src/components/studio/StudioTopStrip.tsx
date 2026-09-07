import React, { useState, useEffect, useCallback } from 'react';
import {
  IcScene as Box,
  IcUndo as Undo2,
  IcRedo as Redo2,
  IcSettings as Settings,
  IcFullscreen as Maximize,
  IcExitFullscreen as Minimize,
  IcSun as Sun,
  IcSave as Save,
  IcSessions as FolderArchive,
} from '../pro/StudioIcons';
import { Square } from 'lucide-react';
import { toggleSheet } from './panelStore';

interface StudioTopStripProps {
  projectName: string;
  onOpenModelLibrary: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  theme?: 'light' | 'dark';
  onOpenIllumination?: () => void;
  onQuickSave?: () => void;
  onOpenSessions?: () => void;
}

export const StudioTopStrip: React.FC<StudioTopStripProps> = ({
  projectName,
  onOpenModelLibrary,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  theme = 'dark',
  onOpenIllumination,
  onQuickSave,
  onOpenSessions,
}) => {
  const ink = theme === 'light' ? 'text-neutral-800' : 'text-white/90';
  const button = `pointer-events-auto shrink-0 min-w-[44px] min-h-[44px] w-11 h-11 grid place-items-center rounded-xl transition-colors hover:bg-current/[0.045] active:bg-current/[0.075] ${ink}`;

  const isCurrentlyFullscreen = (): boolean => {
    if (typeof document === 'undefined') return false;
    const doc = document as any;
    return Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  };

  const [isFullscreen, setIsFullscreen] = useState(isCurrentlyFullscreen);
  const [simulatedFs, setSimulatedFs] = useState(false);
  const isFsActive = isFullscreen || simulatedFs;

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = isCurrentlyFullscreen();
      setIsFullscreen(isFs);
      if (isFs) setSimulatedFs(false);
    };

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange',
    ];
    events.forEach((ev) => document.addEventListener(ev, handleFullscreenChange));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, handleFullscreenChange));
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const doc = document as any;
    const docEl = (document.documentElement || document.body) as any;
    const nativeFs = isCurrentlyFullscreen();

    if (!nativeFs && !simulatedFs) {
      let enteredNative = false;
      try {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
          enteredNative = true;
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
          enteredNative = true;
        } else if (docEl.webkitRequestFullScreen) {
          await docEl.webkitRequestFullScreen();
          enteredNative = true;
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
          enteredNative = true;
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
          enteredNative = true;
        }
      } catch (err) {
        console.warn('Native fullscreen request failed, falling back to simulated:', err);
      }
      if (!enteredNative) {
        setSimulatedFs(true);
      }
    } else {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.webkitCancelFullScreen) {
          await doc.webkitCancelFullScreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      } catch (err) {
        console.warn('Native fullscreen exit failed:', err);
      }
      setSimulatedFs(false);
    }
  }, [simulatedFs]);

  return (
    <header className="studio-top-strip fixed inset-x-0 top-0 z-30 flex h-14 sm:h-16 items-center justify-between px-1.5 sm:px-4 pl-[max(0.375rem,env(safe-area-inset-left))] pr-[max(0.375rem,env(safe-area-inset-right))] pointer-events-none select-none">
      <button
        type="button"
        onClick={onOpenModelLibrary}
        className={`pointer-events-auto studio-top-strip-left shrink inline-flex items-center gap-1.5 sm:gap-2 h-11 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl transition-colors hover:bg-current/[0.045] active:bg-current/[0.075] ${ink}`}
        aria-label="Open model library"
      >
        <Box className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" strokeWidth={1.35} />
        <span className="text-[11px] sm:text-[13px] font-medium tracking-[0.01em] whitespace-nowrap truncate max-w-[64px] sm:max-w-[160px]">
          {projectName || 'Model'}
        </span>
      </button>
      <nav className="flex items-center gap-0.5 sm:gap-1.5 pointer-events-auto shrink-0 py-0.5 overflow-x-auto no-scrollbar" aria-label="History and settings">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`${button} disabled:opacity-25`}
          aria-label="Undo"
        >
          <Undo2 className="w-[18px] h-[18px] sm:w-[21px] sm:h-[21px]" strokeWidth={1.35} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={`${button} disabled:opacity-25`}
          aria-label="Redo"
        >
          <Redo2 className="w-[18px] h-[18px] sm:w-[21px] sm:h-[21px]" strokeWidth={1.35} />
        </button>
        {onQuickSave && (
          <button
            type="button"
            onClick={onQuickSave}
            className={button}
            aria-label="Quick Save Session (Ctrl+S)"
            title="Quick Save Session (Ctrl+S)"
          >
            <Save className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" strokeWidth={1.35} />
          </button>
        )}
        {onOpenSessions && (
          <button
            type="button"
            onClick={onOpenSessions}
            className={button}
            aria-label="Project Sessions"
            title="Project Sessions"
          >
            <FolderArchive className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" strokeWidth={1.35} />
          </button>
        )}
        {onOpenIllumination && (
          <button
            type="button"
            onClick={onOpenIllumination}
            className={`${button} text-amber-400 hover:text-amber-300`}
            aria-label="Studio Illumination"
            title="Studio Illumination"
          >
            <Sun className="w-[18px] h-[18px] sm:w-[21px] sm:h-[21px]" strokeWidth={1.35} />
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleSheet('shapes')}
          className={button}
          aria-label="Shape Snapping"
          title="Shape Snapping (Auto-Shapes)"
        >
          <Square className="w-[17px] h-[17px] sm:w-[19px] sm:h-[19px]" strokeWidth={1.35} />
        </button>
        <button
          type="button"
          onClick={() => toggleSheet('settings')}
          className={button}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="w-[18px] h-[18px] sm:w-[21px] sm:h-[21px]" strokeWidth={1.35} />
        </button>
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className={`${button} shrink-0`}
          aria-label={isFsActive ? 'Exit Full Screen' : 'Full Screen'}
          title={isFsActive ? 'Exit Full Screen' : 'Full Screen'}
        >
          {isFsActive ? (
            <Minimize className="w-[18px] h-[18px] sm:w-[21px] sm:h-[21px]" strokeWidth={1.35} />
          ) : (
            <Maximize className="w-[18px] h-[18px] sm:w-[21px] sm:h-[21px]" strokeWidth={1.35} />
          )}
        </button>
      </nav>
    </header>
  );
};
