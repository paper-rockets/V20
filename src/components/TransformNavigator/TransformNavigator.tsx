import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MoreHorizontal,
  Sliders,
  RotateCcw,
  Minus,
  Cpu,
  Compass,
} from 'lucide-react';
import { TransformNavigatorProps, TransformMode, AccessibilityMode } from '../../types';
import { NavigatorHeader } from './NavigatorHeader';
import { TwoDimensionalDial } from './TwoDimensionalDial';
import { ThreeDimensionalDial } from './ThreeDimensionalDial';
import { TactileNavigatorDial } from './TactileNavigatorDial';
import { playHapticSound } from '../../utils/audio';
import { useUiMode } from '../../core/uiModeStore';
import { subscribeCameraPose } from '../../core/telemetryStore';

/**
 * `simplified` is threaded through as an explicit optional prop (per the Play/Pro
 * split), but nothing upstream passes it yet - App.tsx's render call site is out of
 * scope for this change. So when the prop is omitted, fall back to reading the mode
 * store directly (it's already a public module-level signal, see uiModeStore.ts)
 * rather than defaulting to the Pro appearance. An explicit prop always wins, so a
 * future caller (or a test) can still force either appearance.
 */
export const TransformNavigator: React.FC<TransformNavigatorProps & { simplified?: boolean }> = ({
  initialMode = '2d',
  isLocked: controlledLocked,
  onLockChange,
  onModeChange,
  onTranslate,
  onRotate,
  onScale,
  onInteractionStart,
  onInteractionEnd,
  onReset,
  onClose,
  onCopy,
  onPaste,
  clipboardCount = 0,
  activeTargetName = 'Main Curves',
  layers = [],
  activeLayerId,
  onSelectLayer,
  models = [],
  activeModelId,
  onSelectModel,
  targetScope = 'active_layer',
  onSelectTargetScope,
  accessibilityMode: controlledAccessibilityMode,
  onAccessibilityModeChange,
  soundEnabled: controlledSoundEnabled,
  onToggleSound: controlledToggleSound,
  uiScale = 1.0,
  className = '',
  engine,
  simplified: simplifiedProp,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const uiMode = useUiMode();
  const isSimplified = simplifiedProp ?? uiMode === 'play';
  // Internal Mode State (with fallback if not controlled)
  const [mode, setMode] = useState<TransformMode>(initialMode);
  const [isOpen, setIsOpen] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showHiddenPhysicsPanel, setShowHiddenPhysicsPanel] = useState(false);
  const [isBiggerUI, setIsBiggerUI] = useState(false);
  const [hasWebGPU, setHasWebGPU] = useState(false);

  // Sound State
  const [internalSoundEnabled, setInternalSoundEnabled] = useState(true);
  const soundEnabled = controlledSoundEnabled !== undefined ? controlledSoundEnabled : internalSoundEnabled;
  const onToggleSound = useCallback(() => {
    if (controlledToggleSound) {
      controlledToggleSound();
    } else {
      setInternalSoundEnabled((prev) => !prev);
    }
  }, [controlledToggleSound]);

  // Configurable Physics Settings
  const [physicsSettings, setPhysicsSettings] = useState({
    rubberBandStiffness: 420,
    rubberBandDamping: 24,
    friction: 0.91,
    vibrationStrength: 0.65,
    clampBounds: true,
  });

  // Detect WebGPU capability
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      const navGpu = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
      navGpu?.requestAdapter?.().then((adapter) => {
        if (adapter) setHasWebGPU(true);
      }).catch(() => {});
    }
  }, []);

  // Free-floating position with auto-clamping and localStorage persistence
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultWidth = 270;
    const defaultHeight = 360;
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const defaultX = Math.max(12, Math.min(screenW - defaultWidth - 16, screenW - 290));
    const defaultY = Math.max(12, Math.min(screenH - defaultHeight - 16, screenH - 420));
    
    try {
      const saved = localStorage.getItem('mody_transform_navigator_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const maxX = Math.max(10, screenW - defaultWidth);
          const maxY = Math.max(10, screenH - defaultHeight);
          return {
            x: Math.max(10, Math.min(maxX, parsed.x)),
            y: Math.max(10, Math.min(maxY, parsed.y)),
          };
        }
      }
    } catch (_) {}
    return { x: defaultX, y: defaultY };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Independent Navigator Scale State & Drag-to-Resize Handler
  const [navigatorScale, setNavigatorScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('paperrocket_transform_navigator_scale_v2');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.55 && parsed <= 1.6) return parsed;
      }
    } catch (_) {}
    return 0.76;
  });

  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ startX: number; startY: number; startScale: number }>({
    startX: 0,
    startY: 0,
    startScale: 1.0,
  });

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScale: navigatorScale,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) return;
      const dx = moveEvent.clientX - resizeStartRef.current.startX;
      const dy = moveEvent.clientY - resizeStartRef.current.startY;
      const deltaScale = (dx + dy) / 360;
      const newScale = Math.min(1.55, Math.max(0.55, resizeStartRef.current.startScale + deltaScale));
      const roundedScale = Math.round(newScale * 100) / 100;
      setNavigatorScale(roundedScale);
    };

    const handlePointerUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        setNavigatorScale((curr) => {
          try {
            localStorage.setItem('paperrocket_transform_navigator_scale_v2', curr.toString());
          } catch (_) {}
          return curr;
        });
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResetScale = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNavigatorScale(0.76);
    try {
      localStorage.setItem('paperrocket_transform_navigator_scale_v2', '0.76');
    } catch (_) {}
  };

  // Lock State
  const [internalLocked, setInternalLocked] = useState(false);
  const isLocked = controlledLocked !== undefined ? controlledLocked : internalLocked;

  // Accessibility State (Standard vs Finger-Pen)
  const [internalAccessibilityMode, setInternalAccessibilityMode] =
    useState<AccessibilityMode>('standard');
  const accessibilityMode =
    controlledAccessibilityMode !== undefined
      ? controlledAccessibilityMode
      : internalAccessibilityMode;

  // Active interaction tracking for footer indicator
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  const handleModeChange = useCallback(
    (newMode: TransformMode) => {
      setMode(newMode);
      onModeChange?.(newMode);
    },
    [onModeChange]
  );

  // Play mode only offers the "Flat Screen" / "3D World" tabs - if the widget
  // arrives (or was left, from a prior Pro session) on Tactile Ball, there is no
  // tab left to switch away from it. Fall back to the 2D dial automatically.
  useEffect(() => {
    if (isSimplified && mode === 'tactile') {
      setMode('2d');
      onModeChange?.('2d');
    }
  }, [isSimplified, mode, onModeChange]);

  // --- Silent depth-guard toast --------------------------------------------
  // Snapping to an axis-aligned Front/Top/Side view collapses one axis to zero
  // (studioEngine.getPerfectView()), which quietly stops that axis from doing
  // anything - confusing without feedback. `engine` is already threaded into
  // this component as a prop, so this reads the engine's read-only view state
  // directly; it deliberately does NOT touch `engine.onViewChange`, since that
  // is a single-callback slot App.tsx already owns (see App.tsx's `perfectView`
  // state) - assigning it here would silently steal that subscription instead
  // of sharing it. Re-checks whenever the camera pose telemetry changes
  // (telemetryStore.ts), so it's event-driven rather than a blind poll.
  const [showDepthLockToast, setShowDepthLockToast] = useState(false);
  const wasDepthLockedRef = useRef(false);
  const depthToastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!engine || typeof engine.getPerfectView !== 'function') return;

    const checkDepthLock = () => {
      let info: { isPerfect?: boolean; depthAxis?: 'x' | 'y' | 'z' | null } | undefined;
      try {
        info = engine.getPerfectView();
      } catch {
        return;
      }
      const isDepthLocked = !!(info && info.isPerfect && info.depthAxis);
      if (isDepthLocked && !wasDepthLockedRef.current) {
        setShowDepthLockToast(true);
        if (depthToastTimeoutRef.current !== null) {
          window.clearTimeout(depthToastTimeoutRef.current);
        }
        depthToastTimeoutRef.current = window.setTimeout(() => {
          setShowDepthLockToast(false);
        }, 2200);
      }
      wasDepthLockedRef.current = isDepthLocked;
    };

    checkDepthLock();
    const unsubscribe = subscribeCameraPose(checkDepthLock);
    return () => {
      unsubscribe();
      if (depthToastTimeoutRef.current !== null) {
        window.clearTimeout(depthToastTimeoutRef.current);
      }
    };
  }, [engine]);

  // Reuses the exact toast styling App.tsx uses for `snappedShapeNotice`
  // (see App.tsx, search "snappedShapeNotice"). Portaled to <body> because this
  // widget's own root is `transform: scale(...)`-ed, which would otherwise
  // drag a `position: fixed` child along with it instead of pinning it to the
  // viewport.
  const depthLockToast =
    typeof document !== 'undefined'
      ? createPortal(
          showDepthLockToast ? (
            <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-xs shadow-xl border border-white/20">
                <span className="w-2 h-2 rounded-full bg-neutral-950 animate-ping" />
                <span>Depth locked - you're drawing flat</span>
              </div>
            </div>
          ) : null,
          document.body
        )
      : null;

  const handleLockToggle = useCallback(() => {
    const nextLocked = !isLocked;
    setInternalLocked(nextLocked);
    onLockChange?.(nextLocked);
  }, [isLocked, onLockChange]);

  const handleAccessibilityToggle = useCallback(() => {
    const nextMode: AccessibilityMode =
      accessibilityMode === 'standard' ? 'finger-pen' : 'standard';
    setInternalAccessibilityMode(nextMode);
    onAccessibilityModeChange?.(nextMode);
  }, [accessibilityMode, onAccessibilityModeChange]);

  const handleReset = useCallback(() => {
    onReset?.();
  }, [onReset]);

  const handleInteractionStartInternal = useCallback(
    (handleName: string) => {
      setActiveHandle(handleName);
      onInteractionStart?.(handleName);
    },
    [onInteractionStart]
  );

  const handleInteractionEndInternal = useCallback(
    (handleName: string) => {
      setActiveHandle(null);
      onInteractionEnd?.(handleName);
    },
    [onInteractionEnd]
  );

  // Card drag handler: Moves the modal when dragging anywhere around the circle or card background
  const handleCardDragStart = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // Don't drag if clicking buttons, segmented controls, or interactive dial handles
    if (
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.getAttribute('role') === 'button' ||
      target.closest('[role="button"]') ||
      target.id?.startsWith('handle-') ||
      target.closest('[id^="handle-"]') ||
      target.closest('#three-trackball-canvas') ||
      target.closest('#paperrocket-trackball-sphere') ||
      target.closest('#paperrocket-joystick-core') ||
      target.closest('#paperrocket-radial-dial')
    ) {
      return;
    }

    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      const maxX = Math.max(10, window.innerWidth - 275);
      const maxY = Math.max(10, window.innerHeight - 80);
      const newX = Math.min(maxX, Math.max(10, dragStartRef.current.posX + dx));
      const newY = Math.min(maxY, Math.max(10, dragStartRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(upEvent.pointerId);
        } catch (_) {}
        setPosition((curr) => {
          try {
            localStorage.setItem('mody_transform_navigator_coords', JSON.stringify(curr));
          } catch (_) {}
          return curr;
        });
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Auto-clamp on window resize to ensure widget is always within screen bounds
  useEffect(() => {
    const handleWindowResize = () => {
      setPosition((curr) => {
        const maxX = Math.max(10, window.innerWidth - 275);
        const maxY = Math.max(10, window.innerHeight - 120);
        const clampedX = Math.min(maxX, Math.max(10, curr.x));
        const clampedY = Math.min(maxY, Math.max(10, curr.y));
        if (clampedX !== curr.x || clampedY !== curr.y) {
          return { x: clampedX, y: clampedY };
        }
        return curr;
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // If collapsed to mini button
  if (!isOpen) {
    return (
      <>
        {depthLockToast}
        <motion.button
        id="transform-navigator-mini-trigger"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={() => {
          playHapticSound('pop', soundEnabled);
          setIsOpen(true);
        }}
        className="fixed z-40 px-3.5 py-2 rounded-2xl bg-[#18191d] border border-white/[0.12] shadow-[0_12px_32px_rgba(0,0,0,0.6)] flex items-center gap-2 text-white cursor-pointer group select-none"
        title="Restore Navigator"
      >
        <Compass className="w-4 h-4 text-current" />
        <span className="text-xs font-semibold text-neutral-200">Navigator</span>
        <div className="flex items-center gap-0.5 ml-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 group-hover:bg-neutral-600 dark:group-hover:bg-zinc-300 transition-colors" />
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 group-hover:bg-neutral-600 dark:group-hover:bg-zinc-300 transition-colors" />
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 group-hover:bg-neutral-600 dark:group-hover:bg-zinc-300 transition-colors" />
        </div>
        </motion.button>
      </>
    );
  }

  return (
    <>
      {depthLockToast}
      <aside
      id="transform-navigator-widget"
      role="region"
      aria-label="Transform Joystick Widget"
      onPointerDown={handleCardDragStart}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `scale(${(uiScale || 1.0) * navigatorScale})`,
        transformOrigin: 'top left',
      }}
      className={`paperrocket-transform-navigator fixed z-40 w-[264px] sm:w-[268px] ${showHiddenPhysicsPanel ? 'min-h-[440px]' : ''} rounded-[24px] border overflow-hidden flex flex-col touch-none cursor-grab active:cursor-grabbing select-none pb-2 ${
        isLight
          ? 'bg-white text-neutral-800 border-black/10 shadow-[0_20px_50px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)]'
          : 'bg-[#18191d] text-[#e2e4ea] border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.05)]'
      } ${className}`}
    >
      {/* Header Bar with Segmented Controls & Copy/Paste actions */}
      <NavigatorHeader
        mode={mode}
        onModeChange={handleModeChange}
        isLocked={isLocked}
        onLockToggle={handleLockToggle}
        onReset={handleReset}
        isCollapsed={false}
        onCollapseToggle={() => {}}
        onClose={onClose}
        targetName={activeTargetName}
        layers={layers}
        activeLayerId={activeLayerId}
        onSelectLayer={onSelectLayer}
        models={models}
        activeModelId={activeModelId}
        onSelectModel={onSelectModel}
        targetScope={targetScope}
        onSelectTargetScope={onSelectTargetScope}
        accessibilityMode={accessibilityMode}
        onAccessibilityModeToggle={handleAccessibilityToggle}
        onCopy={onCopy}
        onPaste={onPaste}
        clipboardCount={clipboardCount}
        simplified={isSimplified}
        theme={theme}
      />

      {/* Dial Interactive Surface & Drag Area around the Circle */}
      <div
        id="transform-navigator-body"
        className="overflow-hidden flex flex-col relative"
      >
        {/* Mode Content Switcher with smooth crossfade & spring layout */}
        <div className={`px-2 py-2 relative flex items-center justify-center transition-transform duration-200 ${isBiggerUI ? 'scale-105' : 'scale-100'}`}>
          <AnimatePresence mode="wait">
            {mode === '2d' && (
              <motion.div
                key="view-2d"
                initial={{ opacity: 0, scale: 0.94, rotate: -4 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.94, rotate: 4 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="w-full flex items-center justify-center"
              >
                <TwoDimensionalDial
                  isLocked={isLocked}
                  accessibilityMode={accessibilityMode}
                  onTranslate={onTranslate}
                  onRotate={onRotate}
                  onScale={onScale}
                  onInteractionStart={handleInteractionStartInternal}
                  onInteractionEnd={handleInteractionEndInternal}
                />
              </motion.div>
            )}

            {mode === '3d' && (
              <motion.div
                key="view-3d"
                initial={{ opacity: 0, scale: 0.94, rotate: 4 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.94, rotate: -4 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="w-full flex items-center justify-center"
              >
                <ThreeDimensionalDial
                  isLocked={isLocked}
                  accessibilityMode={accessibilityMode}
                  onTranslate={onTranslate}
                  onRotate={onRotate}
                  onInteractionStart={handleInteractionStartInternal}
                  onInteractionEnd={handleInteractionEndInternal}
                />
              </motion.div>
            )}

            {mode === 'tactile' && !isSimplified && (
              <motion.div
                key="view-tactile"
                initial={{ opacity: 0, scale: 0.94, rotate: 2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.94, rotate: -2 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="w-full flex items-center justify-center"
              >
                <TactileNavigatorDial
                  isLocked={isLocked}
                  accessibilityMode={accessibilityMode}
                  onTranslate={onTranslate}
                  onRotate={onRotate}
                  onInteractionStart={handleInteractionStartInternal}
                  onInteractionEnd={handleInteractionEndInternal}
                  engine={engine}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom-Left Settings Toggle (Repositioned into bottom-left corner) - Pro only */}
          {!isSimplified && (
          <button
            id="transform-navigator-settings-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playHapticSound('click', soundEnabled);
              setShowMenu((prev) => !prev);
              setShowHiddenPhysicsPanel(false);
            }}
            className={`absolute bottom-2.5 left-2.5 z-30 w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              showMenu
                ? 'bg-black/10 dark:bg-white/10 text-neutral-900 dark:text-white border border-black/15 dark:border-white/20 shadow-sm'
                : isLight
                ? 'bg-black/[0.04] hover:bg-black/[0.08] text-neutral-600 hover:text-neutral-900 border border-black/10 shadow-xs'
                : 'bg-white/[0.08] hover:bg-white/[0.16] text-neutral-400 hover:text-white border border-white/[0.06] shadow-sm'
            }`}
            title="Settings & Options"
            aria-label="Navigator settings"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          )}

          {/* Bottom-Right Minimize Toggle (Repositioned into bottom-right corner) */}
          <button
            id="transform-navigator-minimize-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playHapticSound('pop', soundEnabled);
              setIsOpen(false);
              setShowMenu(false);
              setShowHiddenPhysicsPanel(false);
            }}
            className={`absolute bottom-2.5 right-2.5 z-30 w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isLight
                ? 'bg-black/[0.04] hover:bg-black/[0.08] text-neutral-600 hover:text-neutral-900 border border-black/10 shadow-xs'
                : 'bg-white/[0.08] hover:bg-white/[0.16] text-neutral-400 hover:text-white border border-white/[0.06] shadow-sm'
            }`}
            title="Minimize to Dot"
            aria-label="Minimize navigator"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigator Quick Settings Popover anchored at Bottom - Pro only */}
      <AnimatePresence>
        {showMenu && !isSimplified && (
          <motion.div
            id="navigator-settings-popover"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            className={`absolute bottom-11 inset-x-2 z-50 p-3.5 rounded-2xl flex flex-col gap-2.5 max-h-[calc(100%-60px)] overflow-y-auto ${
              isLight
                ? 'bg-white border border-black/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] text-neutral-800'
                : 'bg-[#18191d] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-neutral-200'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
              <span className={`text-xs font-bold ${isLight ? 'text-neutral-900' : 'text-white'}`}>Navigator Options</span>
              <button
                onClick={() => setShowMenu(false)}
                className={`text-xs ${isLight ? 'text-neutral-500 hover:text-neutral-900' : 'text-neutral-400 hover:text-white'}`}
              >
                Done
              </button>
            </div>

            {/* GPU Acceleration status */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[11px] font-medium text-neutral-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-current" />
                Graphics Engine
              </span>
              <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full ${
                hasWebGPU ? 'bg-white/10 text-zinc-300' : 'bg-white/5 text-zinc-400'
              }`}>
                {hasWebGPU ? 'WebGPU' : 'WebGL2'}
              </span>
            </div>

            {/* Independent Navigator Scale Controls */}
            <div className="flex flex-col gap-1.5 py-1 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-300">Widget Scale</span>
                <span className="text-[10px] font-mono font-bold text-zinc-300">
                  {Math.round(navigatorScale * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    playHapticSound('click', soundEnabled);
                    const next = Math.max(0.55, Math.round((navigatorScale - 0.1) * 100) / 100);
                    setNavigatorScale(next);
                    try { localStorage.setItem('paperrocket_transform_navigator_scale_v2', next.toString()); } catch (_) {}
                  }}
                  className="flex-1 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold text-center transition-colors"
                  title="Decrease Widget Scale (-10%)"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    playHapticSound('click', soundEnabled);
                    handleResetScale(e);
                  }}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono text-center transition-colors"
                  title="Reset Widget Scale (100%)"
                >
                  Reset (100%)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playHapticSound('click', soundEnabled);
                    const next = Math.min(1.55, Math.round((navigatorScale + 0.1) * 100) / 100);
                    setNavigatorScale(next);
                    try { localStorage.setItem('paperrocket_transform_navigator_scale_v2', next.toString()); } catch (_) {}
                  }}
                  className="flex-1 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold text-center transition-colors"
                  title="Increase Widget Scale (+10%)"
                >
                  +
                </button>
              </div>
            </div>

            {/* Sound Feedback Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium">Haptic Audio Feedback</span>
              <button
                id="toggle-sound-btn"
                onClick={() => {
                  onToggleSound();
                  playHapticSound('pop', !soundEnabled);
                }}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  soundEnabled ? (isLight ? 'bg-neutral-900' : 'bg-white') : (isLight ? 'bg-neutral-300' : 'bg-neutral-800')
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Hidden Physics Engine shortcut */}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">Physics Config</span>
              <button
                id="open-navigator-physics-btn"
                onClick={() => {
                  playHapticSound('snap', soundEnabled);
                  setShowHiddenPhysicsPanel(true);
                  setShowMenu(false);
                }}
                className="text-[11px] font-bold text-zinc-300 hover:text-neutral-800 dark:text-zinc-300 flex items-center gap-1"
              >
                <span>Tune Physics</span>
                <Sliders className="w-3 h-3" />
              </button>
            </div>

            {/* Reset All Position & Rotation */}
            <button
              id="navigator-reset-all-btn"
              onClick={() => {
                playHapticSound('snap', soundEnabled);
                onReset?.();
                setShowMenu(false);
              }}
              className="w-full py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all mt-0.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Everything</span>
            </button>

            {/* Minimize Widget */}
            <button
              id="navigator-minimize-dot-btn"
              onClick={() => {
                playHapticSound('click', soundEnabled);
                setIsOpen(false);
                setShowMenu(false);
              }}
              className="w-full py-1 text-center text-[10.5px] text-neutral-400 hover:text-neutral-200"
            >
              Minimize to Dot
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Physics Configuration Panel for Standard Navigator - Pro only (unreachable in
          Play since its only entry point, the settings popover, is hidden) */}
      <AnimatePresence>
        {showHiddenPhysicsPanel && !isSimplified && (
          <motion.div
            id="navigator-hidden-physics-panel"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className={`absolute inset-0 z-50 rounded-[24px] border flex flex-col p-4 overflow-y-auto select-none gap-3 ${
              isLight
                ? 'bg-white border-black/10 shadow-[0_25px_60px_rgba(0,0,0,0.15)] text-neutral-800'
                : 'bg-[#18191d] border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-neutral-200'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b pb-2.5 shrink-0 ${
              isLight ? 'border-black/10' : 'border-neutral-800'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isLight ? 'bg-neutral-100 dark:bg-white/10 text-neutral-900' : 'bg-white/10 text-zinc-300'
                }`}>
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isLight ? 'text-neutral-900' : 'text-white'}`}>Navigator Physics & Dynamics</h4>
                  <p className={`text-[9.5px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Response tuning & spring config</p>
                </div>
              </div>
              <button
                id="close-navigator-physics-btn"
                onClick={() => {
                  playHapticSound('click', soundEnabled);
                  setShowHiddenPhysicsPanel(false);
                }}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                  isLight ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                }`}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable sliders body */}
            <div className="flex flex-col gap-3 flex-1">
              {/* Slider 1: Rubber-band Spring Tension (Stiffness) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>Rubber-Band Spring Tension</span>
                  <span className={`font-mono text-[11px] font-bold ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`}>
                    {physicsSettings.rubberBandStiffness}
                  </span>
                </div>
                <input
                  id="navigator-rubber-band-stiffness-slider"
                  type="range"
                  min="180"
                  max="650"
                  step="10"
                  value={physicsSettings.rubberBandStiffness}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPhysicsSettings((prev) => ({ ...prev, rubberBandStiffness: val }));
                  }}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100 ${
                    isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                  }`}
                />
                <div className="flex justify-between text-[9px] text-neutral-500">
                  <span>Loose (180)</span>
                  <span>Default (420)</span>
                  <span>Ultra-Taut (650)</span>
                </div>
              </div>

              {/* Slider 2: Rubber-band Damping */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>Spring Damping (Oscillation)</span>
                  <span className={`font-mono text-[11px] font-bold ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`}>
                    {physicsSettings.rubberBandDamping}
                  </span>
                </div>
                <input
                  id="navigator-rubber-band-damping-slider"
                  type="range"
                  min="12"
                  max="40"
                  step="1"
                  value={physicsSettings.rubberBandDamping}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPhysicsSettings((prev) => ({ ...prev, rubberBandDamping: val }));
                  }}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100 ${
                    isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                  }`}
                />
                <div className="flex justify-between text-[9px] text-neutral-500">
                  <span>Bouncy (12)</span>
                  <span>Balanced (24)</span>
                  <span>Overdamped (40)</span>
                </div>
              </div>

              {/* Slider 3: Friction Settle Physics */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>Momentum Friction Drift</span>
                  <span className={`font-mono text-[11px] font-bold ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`}>
                    {physicsSettings.friction.toFixed(2)}
                  </span>
                </div>
                <input
                  id="navigator-friction-physics-slider"
                  type="range"
                  min="0.75"
                  max="0.98"
                  step="0.01"
                  value={physicsSettings.friction}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPhysicsSettings((prev) => ({ ...prev, friction: val }));
                  }}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100 ${
                    isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                  }`}
                />
                <div className="flex justify-between text-[9px] text-neutral-500">
                  <span>Quick Stop (0.75)</span>
                  <span>Natural (0.91)</span>
                  <span>Long Glide (0.98)</span>
                </div>
              </div>

              {/* Slider 4: Haptic Vibration Resistance */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>Tactile Resistance Vibration</span>
                  <span className={`font-mono text-[11px] font-bold ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`}>
                    {Math.round(physicsSettings.vibrationStrength * 100)}%
                  </span>
                </div>
                <input
                  id="navigator-vibration-strength-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={physicsSettings.vibrationStrength}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPhysicsSettings((prev) => ({ ...prev, vibrationStrength: val }));
                  }}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100 ${
                    isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                  }`}
                />
              </div>

              {/* Toggles */}
              <div className={`pt-2 border-t flex flex-col gap-2 ${isLight ? 'border-black/10' : 'border-neutral-800/80'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>Canvas Bounds Guard</span>
                  <button
                    id="navigator-toggle-bounds-guard-btn"
                    onClick={() => {
                      playHapticSound('click', soundEnabled);
                      setPhysicsSettings((prev) => ({
                        ...prev,
                        clampBounds: !prev.clampBounds,
                      }));
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                      physicsSettings.clampBounds ? (isLight ? 'bg-neutral-900' : 'bg-white') : (isLight ? 'bg-neutral-300' : 'bg-neutral-800')
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        physicsSettings.clampBounds ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer action buttons */}
            <div className={`pt-2 flex items-center gap-2 shrink-0 border-t ${isLight ? 'border-black/10' : 'border-neutral-800/60'}`}>
              <button
                id="navigator-reset-physics-defaults-btn"
                onClick={() => {
                  playHapticSound('snap', soundEnabled);
                  setPhysicsSettings({
                    rubberBandStiffness: 420,
                    rubberBandDamping: 24,
                    friction: 0.91,
                    vibrationStrength: 0.65,
                    clampBounds: true,
                  });
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 border border-black/10'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                Defaults
              </button>
              <button
                id="navigator-apply-physics-btn"
                onClick={() => {
                  playHapticSound('pop', soundEnabled);
                  setShowHiddenPhysicsPanel(false);
                }}
                className="flex-1 py-1.5 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-zinc-100 text-xs font-bold text-white dark:text-zinc-950 shadow-md transition-all"
              >
                Apply & Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner Drag-to-Resize Handle ("Resizing Thingy") - Pro only; resizes the
          widget chrome, not the object, so it's outside what Play needs at rest */}
      {!isSimplified && (
      <div
        id="transform-navigator-resize-handle"
        onPointerDown={handleResizeStart}
        onDoubleClick={handleResetScale}
        className="absolute bottom-0 right-0 z-40 w-6 h-6 flex items-end justify-end p-1 cursor-nwse-resize group transition-transform active:scale-125 select-none"
        title="Drag corner to resize navigator (Double-click to reset 100%)"
      >
        <div className="w-3.5 h-3.5 flex flex-col justify-end items-end gap-[1.5px] opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="flex gap-[1.5px]">
            <div className="w-1 h-1 rounded-full bg-white/70" />
          </div>
          <div className="flex gap-[1.5px]">
            <div className="w-1 h-1 rounded-full bg-white/70" />
            <div className="w-1 h-1 rounded-full bg-white/70" />
          </div>
          <div className="flex gap-[1.5px]">
            <div className="w-1 h-1 rounded-full bg-white/90" />
            <div className="w-1 h-1 rounded-full bg-white/90" />
            <div className="w-1 h-1 rounded-full bg-white/90" />
          </div>
        </div>
      </div>
      )}

      {/* Live Scale Percentage Badge while Resizing */}
      {isResizing && (
        <div className="absolute top-2 right-12 z-50 px-2 py-0.5 rounded-full bg-white text-zinc-950 font-mono font-bold text-[10px] shadow-lg pointer-events-none animate-in fade-in duration-100">
          {Math.round(navigatorScale * 100)}%
        </div>
      )}
      </aside>
    </>
  );
};
