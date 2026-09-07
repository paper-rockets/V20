/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import {
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Camera,
  Move3d,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  ChevronRight,
  Move,
  Rotate3d,
  Disc,
  Compass,
  Check,
  Layers,
  Cpu,
  ZoomIn,
  Sliders,
  SlidersHorizontal,
  X,
  Minus,
} from 'lucide-react';
import { SpatialMode, SubWheelMode, SpatialState, BrushSettings, Layer, LoadedModelInfo, TransformTargetScope, AccessibilityMode } from '../types';
import { StudioEngine } from '../core/studioEngine';
import { playHapticSound } from '../utils/audio';
import { haptics } from '../utils/haptics';
import { ThreeTrackball } from './ThreeTrackball';
import { NavigatorHeader } from './TransformNavigator/NavigatorHeader';
import { useUiMode } from '../core/uiModeStore';

export interface PaperRocketTactileWheelProps {
  /** Light or dark, so the wheel matches the rest of the app instead of
      staying black on a white screen. */
  theme?: 'light' | 'dark';
  engine?: StudioEngine | null;
  cameraSpherical?: { radius: number; theta: number; phi: number };
  brushSettings?: BrushSettings;
  onUpdateBrushSettings?: (updater: (prev: BrushSettings) => BrushSettings) => void;
  mode?: SpatialMode;
  onModeChange?: (mode: SpatialMode) => void;
  spatialState?: SpatialState;
  onUpdateSpatial?: (updater: (prev: SpatialState) => SpatialState) => void;
  onReset?: () => void;
  onClose?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  uiScale?: number;
  className?: string;
  isLocked?: boolean;
  onLockChange?: (locked: boolean) => void;
  activeTargetName?: string;
  layers?: Layer[];
  activeLayerId?: string;
  onSelectLayer?: (layerId: string) => void;
  models?: LoadedModelInfo[];
  activeModelId?: string | null;
  onSelectModel?: (modelId: string | null) => void;
  targetScope?: TransformTargetScope;
  onSelectTargetScope?: (scope: TransformTargetScope) => void;
  accessibilityMode?: AccessibilityMode;
  onAccessibilityModeChange?: (mode: AccessibilityMode) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  clipboardCount?: number;
}

/**
 * Performance note — no backdrop-filter in here.
 *
 * This widget used to carry two NESTED backdrop-blur-2xl layers: the root card
 * (228x283) and the circular wheel inside it (176x176). backdrop-filter over a
 * live WebGL canvas makes the compositor re-read and blur that region every
 * frame, nesting does it twice, and 2xl is the widest radius. Because the wheel
 * is on screen the whole time in Play, that was a permanent tax — measured as a
 * drop to 30fps on a Galaxy S25 Ultra, worsening as menus stacked more blur on
 * top.
 *
 * The panel is bg-[#18181b]/95. At 95% opacity there is nothing meaningful to
 * see through it, so the blur was paying full price for an invisible effect.
 * Keep it opaque; do not reintroduce backdrop-blur here.
 */

export const PaperRocketTactileWheel: React.FC<PaperRocketTactileWheelProps> = ({
  theme = 'dark',
  engine,
  brushSettings,
  onUpdateBrushSettings,
  mode: controlledMode,
  onModeChange: controlledOnModeChange,
  spatialState: controlledSpatialState,
  onUpdateSpatial: controlledOnUpdateSpatial,
  onReset,
  onClose,
  soundEnabled: controlledSoundEnabled,
  onToggleSound: controlledToggleSound,
  uiScale = 1.0,
  className = '',
  isLocked: controlledLocked,
  onLockChange,
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
  onCopy,
  onPaste,
  clipboardCount = 0,
}) => {
  // Play/Pro appearance. Read directly from the shared mode store (rather than a
  // prop App.tsx would have to pass) so this component self-adjusts without any
  // change to its call site - see uiModeStore.ts.
  const uiMode = useUiMode();
  const isLightTheme = theme === 'light';
  const isPlayMode = uiMode === 'play';
  const isPhoneViewport = typeof window !== 'undefined' && window.innerWidth < 640;

  // Resizable scale factor with persistence (default to 0.85 for a compact footprint)
  const [scaleFactor, setScaleFactor] = useState<number>(() => {
    try {
      const s = localStorage.getItem('mody_tactile_scale');
      if (s) {
        const parsed = parseFloat(s);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 1.5) return parsed;
      }
    } catch (_) {}
    return 0.85;
  });

  const playUiScale = Math.min(uiScale || 1, 1) * scaleFactor;

  // Play Mode Micro-Puck expansion state: idles as a minimal translucent puck,
  // spring-expands on active touch/drag, and auto-collapses on release.
  const [isPlayExpanded, setIsPlayExpanded] = useState<boolean>(false);
  const playCollapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerPlayExpand = useCallback(() => {
    if (playCollapseTimerRef.current) {
      clearTimeout(playCollapseTimerRef.current);
      playCollapseTimerRef.current = null;
    }
    setIsPlayExpanded(true);
  }, []);

  const schedulePlayCollapse = useCallback((delayMs: number = 400) => {
    if (playCollapseTimerRef.current) {
      clearTimeout(playCollapseTimerRef.current);
    }
    playCollapseTimerRef.current = setTimeout(() => {
      setIsPlayExpanded(false);
      playCollapseTimerRef.current = null;
    }, delayMs);
  }, []);

  /** Card, dial face and edge, matched to the app's light or dark look and mode. */
  const shellCard = isPlayMode
    ? isLightTheme
      ? 'bg-[#f4f0e9]/95 border border-black/20 shadow-[0_14px_36px_rgba(70,62,52,0.18)] text-neutral-800 rounded-2xl'
      : 'bg-[#202225]/95 border border-white/15 shadow-[0_14px_36px_rgba(0,0,0,0.34)] text-neutral-100 rounded-2xl'
    : isLightTheme
      ? 'bg-white border-neutral-200 shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-neutral-800'
      : 'bg-[#14151a] border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-neutral-100';
  const shellDial = isPlayMode
    ? isLightTheme
      ? 'bg-transparent border-black/20'
      : 'bg-transparent border-white/15'
    : isLightTheme
      ? 'bg-neutral-100 border-neutral-200'
      : 'bg-[#181920] border-white/[0.05]';

  // Mode state with internal fallback
  const [internalMode, setInternalMode] = useState<SpatialMode>('3d');
  const mode = controlledMode !== undefined ? controlledMode : internalMode;

  const onModeChange = useCallback(
    (newMode: SpatialMode) => {
      setInternalMode(newMode);
      controlledOnModeChange?.(newMode);
    },
    [controlledOnModeChange]
  );

  // Spatial state with internal fallback
  const [internalSpatialState, setInternalSpatialState] = useState<SpatialState>({
    x: 0,
    y: 0,
    z: 0,
    pitch: 18,
    yaw: -24,
    roll: 0,
    scale: 1.0,
    brushSize: brushSettings?.size ? Math.max(1, Math.min(50, Math.round(brushSettings.size * 200))) : 18,
  });

  const spatialState = controlledSpatialState !== undefined ? controlledSpatialState : internalSpatialState;

  const onUpdateSpatial = useCallback(
    (updater: (prev: SpatialState) => SpatialState) => {
      if (controlledOnUpdateSpatial) {
        controlledOnUpdateSpatial(updater);
      } else {
        setInternalSpatialState(updater);
      }
    },
    [controlledOnUpdateSpatial]
  );

  // Sound state
  const [internalSoundEnabled, setInternalSoundEnabled] = useState<boolean>(true);
  const soundEnabled = controlledSoundEnabled !== undefined ? controlledSoundEnabled : internalSoundEnabled;
  const onToggleSound = useCallback(() => {
    if (controlledToggleSound) {
      controlledToggleSound();
    } else {
      setInternalSoundEnabled((prev) => !prev);
    }
  }, [controlledToggleSound]);
  // Lock State
  const [internalLocked, setInternalLocked] = useState(false);
  const isLocked = controlledLocked !== undefined ? controlledLocked : internalLocked;
  const handleLockToggle = useCallback(() => {
    const nextLocked = !isLocked;
    setInternalLocked(nextLocked);
    onLockChange?.(nextLocked);
  }, [isLocked, onLockChange]);

  // Accessibility State
  const [internalAccessibilityMode, setInternalAccessibilityMode] =
    useState<AccessibilityMode>('standard');
  const accessibilityMode =
    controlledAccessibilityMode !== undefined
      ? controlledAccessibilityMode
      : internalAccessibilityMode;
  const handleAccessibilityToggle = useCallback(() => {
    const nextMode: AccessibilityMode =
      accessibilityMode === 'standard' ? 'finger-pen' : 'standard';
    setInternalAccessibilityMode(nextMode);
    onAccessibilityModeChange?.(nextMode);
  }, [accessibilityMode, onAccessibilityModeChange]);

  // Position state with auto-clamping and localStorage persistence
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultWidth = 270;
    const defaultHeight = 360;
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const defaultX = Math.max(12, Math.min(screenW - defaultWidth - 16, screenW - 280));
    const defaultY = Math.max(12, Math.min(screenH - defaultHeight - 16, screenH - 420));
    
    try {
      const saved = localStorage.getItem('mody_tactile_wheel_coords');
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

  const isDraggingCardRef = useRef<boolean>(false);
  const dragCardStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  const handleCardDragStart = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
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
      target.closest('#paperrocket-radial-dial') ||
      // The rotation ring is a drag surface of its own. Without this the same
      // gesture both turned the canvas and hauled the whole panel into a corner.
      target.closest('#paperrocket-rotation-ring') ||
      target.closest('#transform-navigator-header')
    ) {
      return;
    }

    isDraggingCardRef.current = true;
    dragCardStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position ? position.x : 0,
      posY: position ? position.y : 0,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingCardRef.current) return;
      const dx = moveEvent.clientX - dragCardStartRef.current.startX;
      const dy = moveEvent.clientY - dragCardStartRef.current.startY;
      const maxX = Math.max(10, window.innerWidth - 275);
      const maxY = Math.max(10, window.innerHeight - 80);
      const newX = Math.min(maxX, Math.max(10, dragCardStartRef.current.posX + dx));
      const newY = Math.min(maxY, Math.max(10, dragCardStartRef.current.posY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (isDraggingCardRef.current) {
        isDraggingCardRef.current = false;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(upEvent.pointerId);
        } catch (_) {}
        setPosition((curr) => {
          if (curr) {
            try {
              localStorage.setItem('mody_tactile_wheel_coords', JSON.stringify(curr));
            } catch (_) {}
          }
          return curr;
        });
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Auto-clamp on window resize to ensure widget is always on screen
  useEffect(() => {
    const handleWindowResize = () => {
      setPosition((curr) => {
        if (!curr) return null;
        const maxX = Math.max(10, window.innerWidth - 280);
        const maxY = Math.max(10, window.innerHeight - 340);
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

  // Widget states
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [subMode, setSubMode] = useState<SubWheelMode>('joystick');

  // Play only shows the joystick (colour-coded petals + white centre puck) - the
  // Number Scrubber Dial (numeric readouts) and 3D Sphere Roll are Pro-only
  // alternates. If the wheel arrives (or was left, from a prior Pro session) on
  // either, fall back to the joystick automatically.
  useEffect(() => {
    if (isPlayMode && subMode !== 'joystick') {
      setSubMode('joystick');
    }
  }, [isPlayMode, subMode]);
  const [dialMode, setDialMode] = useState<'brush_size' | 'zoom' | 'rotate'>('brush_size');
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showHiddenPhysicsPanel, setShowHiddenPhysicsPanel] = useState<boolean>(false);
  const [isBiggerUI, setIsBiggerUI] = useState<boolean>(false);
  const [activeAxis, setActiveAxis] = useState<'x' | 'y' | 'z' | 'all'>('all');
  const [dragValueLabel, setDragValueLabel] = useState<string | null>(null);
  const [pinchFeedback, setPinchFeedback] = useState<string | null>(null);
  const [hasWebGPU, setHasWebGPU] = useState<boolean>(false);



  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ startX: number; startY: number; startScale: number }>({
    startX: 0,
    startY: 0,
    startScale: 0.85,
  });

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScale: scaleFactor,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) return;
      const dx = moveEvent.clientX - resizeStartRef.current.startX;
      const dy = moveEvent.clientY - resizeStartRef.current.startY;
      const deltaScale = (dx + dy) / 360;
      const newScale = Math.min(1.35, Math.max(0.55, resizeStartRef.current.startScale + deltaScale));
      const roundedScale = Math.round(newScale * 100) / 100;
      setScaleFactor(roundedScale);
    };

    const handlePointerUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        setScaleFactor((curr) => {
          try {
            localStorage.setItem('mody_tactile_scale', curr.toString());
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

  const handleScaleCycle = () => {
    const scales = [0.6, 0.75, 0.85, 1.0, 1.15];
    const currentIdx = scales.findIndex((s) => Math.abs(s - scaleFactor) < 0.05);
    const nextIdx = currentIdx === -1 ? 2 : (currentIdx + 1) % scales.length;
    const next = scales[nextIdx];
    setScaleFactor(next);
    try {
      localStorage.setItem('mody_tactile_scale', next.toString());
    } catch (_) {}
  };

  // User-configurable Physics Settings (Adjustable via Hidden Panel on Long-Press)
  const [physicsSettings, setPhysicsSettings] = useState({
    rubberBandStiffness: 420,
    rubberBandDamping: 24,
    friction: 0.91,
    vibrationStrength: 0.65,
    clampBounds: true,
  });

  // Long-press detection for hidden settings panel
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const startLongPressDetection = (e: React.PointerEvent) => {
    // Physics tuning is a Pro-only surface - don't arm the hidden panel in Play.
    if (isPlayMode) return;
    // Only detect on background / rim, not buttons
    longPressStartPos.current = { x: e.clientX, y: e.clientY };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      playHapticSound('snap', soundEnabled);
      setShowHiddenPhysicsPanel(true);
      setShowMenu(false);
      longPressTimerRef.current = null;
    }, 650);
  };

  const cancelLongPressDetection = (e?: React.PointerEvent) => {
    if (e && longPressStartPos.current) {
      const dist = Math.hypot(e.clientX - longPressStartPos.current.x, e.clientY - longPressStartPos.current.y);
      if (dist > 8 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    } else if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Velocity-based visual vibration state (simulates mechanical haptic resistance via CSS transforms)
  const [vibration, setVibration] = useState<{ x: number; y: number; rot: number }>({ x: 0, y: 0, rot: 0 });
  const activeVelocityRef = useRef<number>(0);
  const vibrationAnimFrame = useRef<number | null>(null);

  // Detect WebGPU capability once on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      const navGpu = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
      navGpu?.requestAdapter?.().then((adapter) => {
        if (adapter) setHasWebGPU(true);
      }).catch(() => {});
    }
  }, []);

  // Continuous animation loop for velocity-based visual resistance vibration
  useEffect(() => {
    const updateVibration = () => {
      const v = activeVelocityRef.current;
      const strength = physicsSettings.vibrationStrength;
      if (v > 0.15 && strength > 0.05) {
        const jitter = Math.min(2.0, Math.pow(v, 0.72) * 0.12 * strength);
        const t = performance.now() * 0.08;
        setVibration({
          x: Math.sin(t * 3.1) * jitter,
          y: Math.cos(t * 2.7) * jitter,
          rot: Math.sin(t * 1.9) * (jitter * 0.35),
        });
      } else {
        setVibration({ x: 0, y: 0, rot: 0 });
      }
      vibrationAnimFrame.current = requestAnimationFrame(updateVibration);
    };
    vibrationAnimFrame.current = requestAnimationFrame(updateVibration);
    return () => {
      if (vibrationAnimFrame.current) cancelAnimationFrame(vibrationAnimFrame.current);
    };
  }, [physicsSettings.vibrationStrength]);

  // Center joystick drag physics & friction settling
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const joystickOriginRef = useRef<{ cx: number; cy: number; radius: number }>({ cx: 0, cy: 0, radius: 1 });
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, {
    stiffness: physicsSettings.rubberBandStiffness,
    damping: physicsSettings.rubberBandDamping,
  });
  const springY = useSpring(rawY, {
    stiffness: physicsSettings.rubberBandStiffness,
    damping: physicsSettings.rubberBandDamping,
  });
  const joystickLastPos = useRef({ x: 0, y: 0, time: 0 });
  const joystickVelocity = useRef({ x: 0, y: 0 });
  const joystickFrictionRef = useRef<number | null>(null);

  // Helper to safely clamp spatial state within bounds
  const clampSpatial = useCallback((state: SpatialState): SpatialState => {
    if (!physicsSettings.clampBounds) return state;
    return {
      ...state,
      x: Math.max(-240, Math.min(240, state.x)),
      y: Math.max(-180, Math.min(180, state.y)),
      z: Math.max(-150, Math.min(150, state.z)),
    };
  }, [physicsSettings.clampBounds]);

  // Trackball sphere state
  const [isRollingBall, setIsRollingBall] = useState(false);

  // Radial dial state & momentum friction
  const dialRef = useRef<HTMLDivElement>(null);
  const dialCenterRef = useRef<{ cx: number; cy: number }>({ cx: 0, cy: 0 });
  const [isDialDragging, setIsDialDragging] = useState(false);
  const dialLastAngle = useRef<number>(0);
  const dialLastTime = useRef<number>(0);
  const dialVelocity = useRef<number>(0);
  const dialFrictionRef = useRef<number | null>(null);
  const lastTickValue = useRef<number>(spatialState.brushSize);

  // Multi-touch Pinch-to-Zoom gesture tracking
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef<number>(spatialState.scale);

  // Dynamic footer label
  const getFooterLabel = () => {
    if (pinchFeedback) return pinchFeedback;
    if (isDraggingJoystick && dragValueLabel) return dragValueLabel;
    if (isRollingBall) return `Turning 3D • Yaw: ${Math.round(spatialState.yaw)}° Pitch: ${Math.round(spatialState.pitch)}°`;
    if (isDialDragging) return `Dial Size • ${spatialState.brushSize} / 50`;

    if (subMode === 'joystick') {
      return mode === '3d'
        ? '3D World Space • Drag white ball to move'
        : 'Flat Screen • Drag white ball to pan';
    }
    if (subMode === 'ball') {
      return hasWebGPU ? '3D Sphere (WebGPU) • Roll the ball' : '3D Sphere • Roll the ball to turn';
    }
    if (subMode === 'dial') {
      return 'Wheel Dial • Slide circle to change size';
    }
    return 'Tactile Spatial Wheel';
  };

  // Joystick pointer handlers with normalized, pixel-independent coordinate math
  const handleJoystickDown = (e: React.PointerEvent, axis: 'x' | 'y' | 'z' | 'all' = 'all') => {
    e.preventDefault();
    e.stopPropagation();

    if (isPlayMode) {
      triggerPlayExpand();
    }

    if (joystickFrictionRef.current) {
      cancelAnimationFrame(joystickFrictionRef.current);
      joystickFrictionRef.current = null;
    }

    setIsDraggingJoystick(true);
    setActiveAxis(axis);
    joystickLastPos.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    joystickVelocity.current = { x: 0, y: 0 };
    playHapticSound('squish', soundEnabled);

    engine?.beginTransform(targetScope);

    // Set pointer capture directly on the container element
    if (joystickContainerRef.current) {
      try {
        joystickContainerRef.current.setPointerCapture(e.pointerId);
      } catch {}

      const rect = joystickContainerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = Math.max(1, rect.width / 2);
      joystickOriginRef.current = { cx, cy, radius };

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      // Normalized radius: [0, 1] unit disk
      const normDist = Math.min(1.0, dist / (radius * 0.82));

      let normU = Math.cos(angle) * normDist;
      let normV = Math.sin(angle) * normDist;

      if (axis === 'y' || axis === 'z') normU = 0;
      if (axis === 'x') normV = 0;

      // Visual spring offset
      const maxVisualTravel = isBiggerUI ? 48 : 30;
      rawX.set(normU * maxVisualTravel);
      rawY.set(normV * maxVisualTravel);
    }
  };

  const handleJoystickMove = (e: React.PointerEvent) => {
    if (!isDraggingJoystick || !joystickContainerRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const { cx, cy, radius } = joystickOriginRef.current;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Dynamic Haptic Click on unit threshold edge
    if (dist >= radius * 0.82 && Math.hypot(rawX.get(), rawY.get()) < (isBiggerUI ? 47 : 29)) {
      playHapticSound('click', soundEnabled);
    }

    // Compute unit-disk normalized coordinate [0, 1] regardless of screen resolution or UI size
    const normDist = Math.min(1.0, dist / (radius * 0.82));
    let normU = Math.cos(angle) * normDist;
    let normV = Math.sin(angle) * normDist;

    if (activeAxis === 'x') normV = 0;
    if (activeAxis === 'y' || activeAxis === 'z') normU = 0;

    // Visual puck displacement
    const maxVisualTravel = isBiggerUI ? 48 : 30;
    rawX.set(normU * maxVisualTravel);
    rawY.set(normV * maxVisualTravel);

    // Normalized frame velocity tracking (normalized displacement per ms)
    const now = performance.now();
    const dt = Math.max(1, now - joystickLastPos.current.time);
    const moveDx = (e.clientX - joystickLastPos.current.x) / radius;
    const moveDy = (e.clientY - joystickLastPos.current.y) / radius;

    const currentVx = (moveDx / dt) * 16.67;
    const currentVy = (moveDy / dt) * 16.67;
    const newVx = joystickVelocity.current.x * 0.35 + currentVx * 0.65;
    const newVy = joystickVelocity.current.y * 0.35 + currentVy * 0.65;
    joystickVelocity.current = { x: newVx, y: newVy };
    joystickLastPos.current = { x: e.clientX, y: e.clientY, time: now };

    const currentSpeed = Math.min(2.0, Math.hypot(newVx, newVy) * 10);
    activeVelocityRef.current = currentSpeed;

    // Continuous, pixel-independent rate delta calculation
    // Deadzone eliminates sub-pixel hand jitter at resting origin
    const deadzone = 0.035;
    const effectiveMag = Math.max(0, (normDist - deadzone) / (1 - deadzone));
    // Soft quadratic response curve for micro-precision near center and smooth acceleration at edge
    const responseMag = Math.pow(effectiveMag, 1.28);

    const dirU = normDist > 0 ? (normU / normDist) * responseMag : 0;
    const dirV = normDist > 0 ? (normV / normDist) * responseMag : 0;

    const speedScale = mode === '3d' ? 3.2 : 2.4;
    const deltaX = dirU * speedScale;
    const deltaY = -dirV * speedScale;

    if (activeAxis === 'z' || (mode === '3d' && activeAxis === 'z')) {
      const deltaZ = -dirV * speedScale;
      onUpdateSpatial((prev) => clampSpatial({ ...prev, z: prev.z + deltaZ }));
      const dispZ = Math.round(-normV * 50);
      setDragValueLabel(`${dispZ > 0 ? '+' : ''}${dispZ}mm Z`);

      if (engine) {
        if (mode === '3d') {
          engine.translateAxis3D('z', -dirV * 0.008, targetScope);
        } else {
          engine.translateScreenSpace(0, -dirV * 2.0, targetScope, isLocked);
        }
      }
    } else if (activeAxis === 'x') {
      onUpdateSpatial((prev) => clampSpatial({ ...prev, x: prev.x + deltaX }));
      const dispX = Math.round(normU * 50);
      setDragValueLabel(`${dispX > 0 ? '+' : ''}${dispX}mm X`);

      if (engine) {
        if (mode === '3d') {
          engine.translateAxis3D('x', dirU * 0.008, targetScope);
        } else {
          engine.translateScreenSpace(dirU * 2.0, 0, targetScope, isLocked);
        }
      }
    } else if (activeAxis === 'y') {
      onUpdateSpatial((prev) => clampSpatial({ ...prev, y: prev.y + deltaY }));
      const dispY = Math.round(-normV * 50);
      setDragValueLabel(`${dispY > 0 ? '+' : ''}${dispY}mm Y`);

      if (engine) {
        if (mode === '3d') {
          engine.translateAxis3D('y', -dirV * 0.008, targetScope);
        } else {
          engine.translateScreenSpace(0, dirV * 2.0, targetScope, isLocked);
        }
      }
    } else {
      onUpdateSpatial((prev) => clampSpatial({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
      const disp = Math.round(normDist * 50);
      setDragValueLabel(`${disp}mm`);

      if (engine) {
        engine.translateScreenSpace(dirU * 2.0, dirV * 2.0, targetScope, isLocked);
      }
    }
  };

  const handleJoystickUp = (e: React.PointerEvent) => {
    if (isDraggingJoystick) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingJoystick(false);
      setActiveAxis('all');
      setDragValueLabel(null);
      playHapticSound('snap', soundEnabled);
      engine?.endTransform();

      if (isPlayMode) {
        schedulePlayCollapse(350);
      }

      if (joystickContainerRef.current) {
        try {
          joystickContainerRef.current.releasePointerCapture(e.pointerId);
        } catch {}
      }

      // Elastic rubber-band snapback for the physical puck
      rawX.set(0);
      rawY.set(0);

      // Normalized friction-based momentum coasting
      let vx = joystickVelocity.current.x * 2.8;
      let vy = joystickVelocity.current.y * 2.8;
      const friction = physicsSettings.friction;

      const stepJoystickFriction = () => {
        const speed = Math.hypot(vx, vy);
        if (speed < 0.05) {
          joystickFrictionRef.current = null;
          activeVelocityRef.current = 0;
          return;
        }

        vx *= friction;
        vy *= friction;
        activeVelocityRef.current = Math.min(2.0, speed);

        onUpdateSpatial((prev) =>
          clampSpatial({
            ...prev,
            x: prev.x + vx * 1.5,
            y: prev.y - vy * 1.5,
          })
        );

        if (engine) {
          engine.translateScreenSpace(vx * 0.8, -vy * 0.8, targetScope, isLocked);
        }

        joystickFrictionRef.current = requestAnimationFrame(stepJoystickFriction);
      };

      if (Math.hypot(vx, vy) > 0.15) {
        joystickFrictionRef.current = requestAnimationFrame(stepJoystickFriction);
      } else {
        activeVelocityRef.current = 0;
      }
    }
  };

  // Radial dial handlers with normalized angular coordinate math
  /**
   * Rotation ring (Play).
   *
   * Simplifying the wheel to a single joystick removed the only way to turn
   * anything: the trackball and numeric-dial sub-modes went to Pro, and with them
   * rotation. Rather than bring a mode switch back, the widget now carries two
   * gestures at once, which is what the black wheel and its white knob already
   * look like: drag the WHITE PUCK to move, drag the BLACK RING around it to turn.
   * No mode, no menu — the shape tells you.
   */
  const ringRef = useRef<HTMLDivElement | null>(null);
  /** Radius the notch marks sit on, matching the dashed ring inset. */
  const ringRadiusPx = isBiggerUI ? 96 : 74;
  const ringLastAngle = useRef<number | null>(null);
  const [isRingTurning, setIsRingTurning] = useState<boolean>(false);

  /**
   * Detents on the rotation ring.
   *
   * A free-spinning ring is smooth but gives you nothing to aim at, so landing
   * exactly on a quarter turn is guesswork. These make the common angles - every
   * 45 degrees - behave like shallow notches: as you approach one, the ring
   * starts giving back less than you put in, so it settles there on its own. Push
   * past and it frees up again. Nothing is locked and nothing snaps, so a
   * deliberate odd angle is still possible; the notch just makes the tidy answer
   * the easy one.
   *
   * The angle we measure against is the rotation actually applied, not the raw
   * finger angle, so the notches line up with how the object really sits.
   */
  const ringAppliedAngle = useRef<number>(0);
  const ringDetentRef = useRef<number>(0);
  const [ringInDetent, setRingInDetent] = useState<boolean>(false);
  /** Total turn applied so far, so the marker still means something after you let go. */
  const [ringTotalAngle, setRingTotalAngle] = useState<number>(0);
  /**
   * Rotation Axis Mode:
   * 'yaw'    - Turntable rotation around global vertical Y axis (spins model around)
   * 'screen' - 2D Screen-space roll in camera plane (like paper on desk)
   * 'pitch'  - Tilt rotation around lateral X axis (tumble forward/backward)
   * 'camera' - Orbit camera view horizontally
   */
  type RingAxisMode = 'yaw' | 'screen' | 'pitch' | 'camera';
  const [ringAxis, setRingAxis] = useState<RingAxisMode>('yaw');

  const cycleRingAxis = useCallback(() => {
    haptics.trigger('mode-switch');
    setRingAxis((prev) => {
      if (prev === 'yaw') return 'screen';
      if (prev === 'screen') return 'pitch';
      if (prev === 'pitch') return 'camera';
      return 'yaw';
    });
  }, []);

  /** Reset also puts the turn indicator back to straight. */
  const handleRingAwareReset = useCallback(() => {
    setRingTotalAngle(0);
    ringAppliedAngle.current = 0;
    onReset?.();
  }, [onReset]);

  const ringAngleAt = (e: React.PointerEvent): number | null => {
    const el = ringRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  const handleRingDown = (e: React.PointerEvent) => {
    const a = ringAngleAt(e);
    if (a === null) return;
    e.preventDefault();
    e.stopPropagation();

    if (isPlayMode) {
      triggerPlayExpand();
    }

    ringLastAngle.current = a;
    ringAppliedAngle.current = 0;
    ringDetentRef.current = 0;
    setIsRingTurning(true);
    if (ringAxis !== 'camera') engine?.beginTransform(targetScope);
    try {
      ringRef.current?.setPointerCapture(e.pointerId);
    } catch {}
    playHapticSound('tick', soundEnabled);
  };

  const handleRingMove = (e: React.PointerEvent) => {
    if (!isRingTurning || ringLastAngle.current === null) return;
    const a = ringAngleAt(e);
    if (a === null) return;
    e.preventDefault();
    e.stopPropagation();

    // Shortest way round, so crossing the +/-180 seam does not spin the model.
    let delta = a - ringLastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    ringLastAngle.current = a;

    // How far the angle we are heading for sits from the nearest notch.
    const DETENT_EVERY = 90;
    const CAPTURE_DEG = 9;
    const MIN_PASS = 0.25; // right on a notch, only a quarter of your movement counts
    const target = ringAppliedAngle.current + delta;
    const off = ((target % DETENT_EVERY) + DETENT_EVERY) % DETENT_EVERY;
    const distToDetent = Math.min(off, DETENT_EVERY - off);

    const inDetent = distToDetent < CAPTURE_DEG;
    // Ramp resistance smoothly from full stickiness at the notch to none at the
    // edge of its pull, so there is no sudden step as you cross the boundary.
    const resistance = inDetent ? MIN_PASS + (1 - MIN_PASS) * (distToDetent / CAPTURE_DEG) : 1;
    delta *= resistance;

    ringAppliedAngle.current += delta;
    setRingTotalAngle((prev) => prev + delta);
    if (inDetent !== ringInDetent) setRingInDetent(inDetent);

    // A tick as each notch goes by, stronger on the quarter turns.
    haptics.checkAngleDetent(ringAppliedAngle.current, ringDetentRef, DETENT_EVERY);

    const rad = (delta * Math.PI) / 180;
    if (engine) {
      if (ringAxis === 'camera') {
        // Orbit around what you are looking at. Nothing on the canvas moves.
        engine.orbitCamera(-rad, 0);
      } else if (ringAxis === 'yaw') {
        // Turntable rotation around global vertical Y axis
        engine.rotateWorldAxis('y', -rad, targetScope, isLocked);
      } else if (ringAxis === 'pitch') {
        // Tilt rotation around lateral X axis
        engine.rotateWorldAxis('x', rad, targetScope, isLocked);
      } else {
        // Screen-space 2D roll in camera plane
        engine.rotateScreenSpace(rad, targetScope, isLocked);
      }
    }
    onUpdateSpatial((prev) => ({ ...prev, roll: (prev.roll + delta) % 360 }));
  };

  const handleRingUp = (e: React.PointerEvent) => {
    if (!isRingTurning) return;
    e.preventDefault();
    e.stopPropagation();
    setIsRingTurning(false);
    setRingInDetent(false);
    ringLastAngle.current = null;
    try {
      ringRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    if (ringAxis !== 'camera') engine?.endTransform();
    if (isPlayMode) {
      schedulePlayCollapse(350);
    }
  };

  const handleDialPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dialFrictionRef.current) {
      cancelAnimationFrame(dialFrictionRef.current);
      dialFrictionRef.current = null;
    }
    setIsDialDragging(true);
    dialLastTime.current = performance.now();
    dialVelocity.current = 0;

    if (dialRef.current) {
      try {
        dialRef.current.setPointerCapture(e.pointerId);
      } catch {}
      const rect = dialRef.current.getBoundingClientRect();
      dialCenterRef.current = {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
      };
      const dx = e.clientX - dialCenterRef.current.cx;
      const dy = e.clientY - dialCenterRef.current.cy;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;
      dialLastAngle.current = angle;
    }
  };

  const handleDialPointer = (e: React.PointerEvent) => {
    if (!isDialDragging) return;
    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - dialCenterRef.current.cx;
    const dy = e.clientY - dialCenterRef.current.cy;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    const now = performance.now();
    const dt = Math.max(1, now - dialLastTime.current);
    const dAngle = angle - dialLastAngle.current;
    
    // Normalize angular jump crossing 0/360 boundary
    let normalizedDelta = dAngle;
    if (normalizedDelta > 180) normalizedDelta -= 360;
    if (normalizedDelta < -180) normalizedDelta += 360;

    const currentVAngle = (normalizedDelta / dt) * 16.67;
    dialVelocity.current = dialVelocity.current * 0.3 + currentVAngle * 0.7;
    dialLastAngle.current = angle;
    dialLastTime.current = now;

    activeVelocityRef.current = Math.min(2.0, Math.abs(currentVAngle) * 0.1);

    // Map 0..360 to 1..50
    const val = Math.max(1, Math.min(50, Math.round((angle / 360) * 50)));

    if (val !== lastTickValue.current) {
      playHapticSound('tick', soundEnabled);
      lastTickValue.current = val;
    }

    onUpdateSpatial((prev) => ({ ...prev, brushSize: val }));

    if (dialMode === 'brush_size') {
      if (onUpdateBrushSettings) {
        const calculatedSize = 0.01 + ((val - 1) / 49) * 0.24;
        onUpdateBrushSettings((prev) => ({ ...prev, size: calculatedSize }));
      }
    } else if (dialMode === 'zoom') {
      if (engine) {
        const factor = normalizedDelta > 0 ? 1.02 : 0.98;
        engine.scaleAxis3D(factor, targetScope);
      }
    } else if (dialMode === 'rotate') {
      if (engine) {
        engine.rotateScreenSpace((normalizedDelta * Math.PI) / 180, targetScope);
      }
      onUpdateSpatial((prev) => ({ ...prev, roll: (prev.roll + normalizedDelta) % 360 }));
    }
  };

  const handleDialPointerUp = (e: React.PointerEvent) => {
    if (!isDialDragging) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDialDragging(false);
    if (dialRef.current) {
      try {
        dialRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }

    // Friction momentum loop for dial scrubber
    let vAngle = dialVelocity.current;
    const friction = 0.89;

    const stepDialFriction = () => {
      if (Math.abs(vAngle) < 0.2) {
        dialFrictionRef.current = null;
        activeVelocityRef.current = 0;
        return;
      }

      vAngle *= friction;
      activeVelocityRef.current = Math.min(2.0, Math.abs(vAngle) * 0.1);

      onUpdateSpatial((prev) => {
        const step = vAngle > 0 ? 1 : -1;
        const nextVal = Math.max(1, Math.min(50, prev.brushSize + (Math.abs(vAngle) > 2 ? step : 0)));
        if (nextVal !== prev.brushSize) {
          playHapticSound('tick', soundEnabled);
          if (dialMode === 'brush_size' && onUpdateBrushSettings) {
            const calculatedSize = 0.01 + ((nextVal - 1) / 49) * 0.24;
            onUpdateBrushSettings((b) => ({ ...b, size: calculatedSize }));
          }
        }
        return { ...prev, brushSize: nextVal };
      });

      dialFrictionRef.current = requestAnimationFrame(stepDialFriction);
    };

    if (Math.abs(vAngle) > 1.2) {
      dialFrictionRef.current = requestAnimationFrame(stepDialFriction);
    } else {
      activeVelocityRef.current = 0;
    }
  };

  // Multi-touch Pinch-to-Zoom Gesture Handlers (Mobile & Touchscreen support)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchDistanceRef.current = dist;
      initialPinchScaleRef.current = spatialState.scale;
      playHapticSound('pop', soundEnabled);
      setPinchFeedback(`Pinch Scale: ${spatialState.scale.toFixed(2)}x`);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = currentDist / initialPinchDistanceRef.current;
      const newScale = Math.max(0.4, Math.min(2.8, initialPinchScaleRef.current * ratio));

      onUpdateSpatial((prev) => ({ ...prev, scale: newScale }));
      setPinchFeedback(`Pinch Scale: ${newScale.toFixed(2)}x`);
      activeVelocityRef.current = Math.abs(ratio - 1) * 10;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistanceRef.current = null;
      setTimeout(() => setPinchFeedback(null), 1200);
      activeVelocityRef.current = 0;
    }
  };

  const wheelSizeClass = isPlayMode
    ? 'w-[144px] h-[144px]'
    : isBiggerUI
    ? 'w-[250px] h-[250px]'
    : 'w-[230px] h-[230px]';

  // Play Mode: Idle Micro-Puck state
  if (isPlayMode && !isPlayExpanded) {
    return (
      <motion.button
        id="paperrocket-play-micro-puck"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
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
        className={`fixed z-40 px-3.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer group select-none ${shellCard}`}
        title="Restore Spatial Navigator"
      >
        <Disc className="w-4 h-4 text-neutral-800 dark:text-zinc-300" />
        <span className="text-xs font-semibold text-neutral-200">Spatial Navigator</span>
        <div className="flex items-center gap-0.5 ml-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 group-hover:bg-neutral-900 dark:bg-white transition-colors" />
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 group-hover:bg-neutral-900 dark:bg-white transition-colors" />
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 group-hover:bg-neutral-900 dark:bg-white transition-colors" />
        </div>
      </motion.button>
    );
  }

  return (
    <motion.aside
      id="paperrocket-wheel-root"
      role="region"
      aria-label="Tactile Spatial Controller Widget"
      initial={isPlayMode ? { scale: 0.85, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      exit={isPlayMode ? { scale: 0.85, opacity: 0 } : undefined}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      onPointerDown={handleCardDragStart}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `scale(${isPlayMode ? playUiScale : (uiScale || 1.0) * scaleFactor})`,
        transformOrigin: isPlayMode ? 'bottom right' : 'top left',
      }}
      className={`fixed z-40 ${isPlayMode ? 'w-[168px]' : 'w-[264px] sm:w-[268px]'} ${showHiddenPhysicsPanel ? 'min-h-[440px]' : ''} border ${shellCard} overflow-hidden flex flex-col touch-none cursor-grab active:cursor-grabbing select-none pb-1.5 ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header Bar with Segmented Controls & Copy/Paste actions matching Left Navigator */}
      <NavigatorHeader
        mode={mode}
        onModeChange={(m) => onModeChange(m as SpatialMode)}
        tabs={[
          { id: '2d', label: 'Flat Screen' },
          { id: '3d', label: '3D World' },
        ]}
        isLocked={isLocked}
        onLockToggle={handleLockToggle}
        onReset={handleRingAwareReset}
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
        simplified={isPlayMode}
      />

      {/* Main PaperRockets Tactile Circular Disc Body */}
      <div id="paperrocket-wheel-body" className="overflow-hidden flex flex-col relative px-2 py-2 items-center justify-center">
        <motion.div
          id="paperrocket-circular-wheel"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onPointerDown={(e) => {
            startLongPressDetection(e);
          }}
          onPointerMove={(e) => {
            cancelLongPressDetection(e);
          }}
          onPointerUp={() => {
            cancelLongPressDetection();
          }}
          onPointerCancel={() => {
            cancelLongPressDetection();
          }}
          className={`relative ${wheelSizeClass} rounded-full border ${shellDial} shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center touch-none overflow-hidden transition-all duration-200`}
        >
        {/* Inner Surface with Velocity-Based CSS Vibration (Preventing outer button displacement glitches) */}
        <div
          id="paperrocket-wheel-surface"
          style={{
            transform: `translate3d(${vibration.x}px, ${vibration.y}px, 0) rotate(${vibration.rot}deg)`,
          }}
          className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none"
        >
          {/* Dynamic Blue Active Fill (Seen in video when dragging) */}
          <AnimatePresence>
            {(isDraggingJoystick || isRollingBall) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#1e3a8a] via-[#2563eb] to-[#3b82f6] opacity-90 transition-colors pointer-events-none"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Outer Ring Navigation Buttons & Mode Changers (with stopPropagation) */}
        {/* Top Arc Pill (Switch to Dial / Step) - Pro only: the numeric-readout dial isn't part of Play */}
        {!isPlayMode && (
        <motion.button
          id="submode-dial-pill"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            playHapticSound('click', soundEnabled);
            setSubMode(subMode === 'dial' ? 'joystick' : 'dial');
          }}
          className={`absolute top-3 z-30 w-11 h-6 rounded-full border flex items-center justify-center transition-all ${
            subMode === 'dial'
              ? 'bg-white text-neutral-950 border-white shadow-[0_0_12px_rgba(255,255,255,0.6)]'
              : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-white'
          }`}
          title="Number Scrubber Dial"
        >
          <div className="w-4 h-1.5 rounded-full bg-current opacity-80" />
        </motion.button>
        )}

        {/* Right Arc Pill (Switch to 3D Sphere Roll) - Pro only alternate to the joystick */}
        {!isPlayMode && (
        <motion.button
          id="submode-ball-pill"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            playHapticSound('click', soundEnabled);
            setSubMode(subMode === 'ball' ? 'joystick' : 'ball');
          }}
          className={`absolute right-3 z-30 w-6 h-11 rounded-full border flex items-center justify-center transition-all ${
            subMode === 'ball'
              ? 'bg-white text-neutral-950 border-white shadow-[0_0_12px_rgba(255,255,255,0.6)]'
              : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-white'
          }`}
          title="3D Sphere Orientation Roll"
        >
          <div className="w-1.5 h-4 rounded-full bg-current opacity-80" />
        </motion.button>
        )}

        {/* Left Arc Button (Quick Recenter) - Pro only; Play already has Reset in the header,
            a second reset button next to it would just be clutter */}
        {!isPlayMode && (
        <motion.button
          id="quick-recenter-pill"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            playHapticSound('snap', soundEnabled);
            onReset();
          }}
          className="absolute left-3 z-30 w-6 h-11 rounded-full bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-400 hover:text-white flex items-center justify-center transition-all"
          title="Recenter to Origin"
        >
          <RotateCcw className="w-3 h-3" />
        </motion.button>
        )}

        {/* ---------------------------------------------------- */}
        {/* CENTER INTERACTIVE CORE: 3 CHILD-SIMPLE TOY MODES     */}
        {/* ---------------------------------------------------- */}

        {/* Rotation ring: sits under the joystick core so the puck wins the centre. */}
        {isPlayMode && subMode === 'joystick' && (
          <div
            ref={ringRef}
            id="paperrocket-rotation-ring"
            onPointerDown={handleRingDown}
            onPointerMove={handleRingMove}
            onPointerUp={handleRingUp}
            onPointerCancel={handleRingUp}
            className="absolute inset-0 rounded-full z-10 touch-none cursor-grab active:cursor-grabbing"
            title="Drag the ring to turn"
          >
            {/* Grip notches, so it reads as a thing you can twist. */}
            <div
              className={`absolute inset-[6px] rounded-full border-2 transition-all duration-100 ${
                ringInDetent
                  ? isPlayMode ? 'border-solid border-neutral-500' : 'border-solid border-neutral-400 dark:border-neutral-600'
                  : isRingTurning
                    ? isPlayMode ? 'border-dashed border-neutral-500/70' : 'border-dashed border-neutral-900 dark:border-white/70'
                    : isLightTheme
                      ? 'border-dashed border-neutral-300'
                      : 'border-dashed border-white/12'
              }`}
            />

            {/*
              Turn indicator.

              Four faint marks show where the notches are, so the resistance you
              feel has somewhere visible to belong. One bright pointer turns with
              the canvas, so a glance tells you how far from straight you are -
              which the ring alone could never say, since it looks identical at
              0 and at 180 degrees.

              Everything here is non-interactive and sits under the puck.
            */}
            {[0, 90, 180, 270].map((deg) => (
              <div
                key={deg}
                className="absolute left-1/2 top-1/2 w-0 h-0 pointer-events-none"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div
                  className={`absolute rounded-full transition-colors duration-150 ${
                    ringInDetent ? 'bg-neutral-900 dark:bg-white' : isLightTheme ? 'bg-neutral-400' : 'bg-white/25'
                  }`}
                  style={{ width: 2, height: 7, left: -1, top: -(ringRadiusPx - 1) }}
                />
              </div>
            ))}

            {/* The pointer. Hidden at dead straight, because then there is
                nothing to report and a marker would just be furniture. */}
            {Math.abs(ringTotalAngle % 360) > 0.5 && (
              <div
                className="absolute left-1/2 top-1/2 w-0 h-0 pointer-events-none"
                style={{ transform: `rotate(${ringTotalAngle}deg)` }}
              >
                <div
                  className="absolute rounded-full bg-neutral-900 dark:bg-white shadow-[0_0_6px_rgba(56,189,248,0.9)]"
                  style={{ width: 4, height: 12, left: -2, top: -(ringRadiusPx + 1) }}
                />
              </div>
            )}

            {/* Degrees and Active Axis Name, only while turning */}
            {isRingTurning && (
              <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-0.5 z-20"
                   style={{ top: 2 }}>
                <span className="text-[8px] font-extrabold uppercase tracking-wider text-neutral-800 dark:text-zinc-300">
                  {ringAxis === 'yaw' ? 'Turntable Y' : ringAxis === 'pitch' ? 'Tilt X' : ringAxis === 'screen' ? 'Screen Roll' : 'Camera Orbit'}
                </span>
                <span className="text-[10px] font-extrabold tabular-nums text-white bg-black/70 px-2 py-0.5 rounded-full border border-neutral-900 dark:border-white/40">
                  {Math.round(((ringTotalAngle % 360) + 360) % 360)}&deg;
                </span>
              </div>
            )}
          </div>
        )}

        {/* MODE 1: ELASTIC JOYSTICK & 3-AXIS PETALS */}
        {subMode === 'joystick' && (
          <div
            ref={joystickContainerRef}
            id="paperrocket-joystick-core"
            onPointerDown={(e) => handleJoystickDown(e, 'all')}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickUp}
            onPointerCancel={handleJoystickUp}
            className={`relative ${
              isBiggerUI ? 'w-40 h-40' : 'w-28 h-28'
            } rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20`}
          >
            {/* Colorful 3-Axis Petals (persisted in DOM to avoid pointer-capture unmount cancellation) */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
                isDraggingJoystick ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
              }`}
            >
              {/* Top/Neon Lime Petal (Elevation Y) */}
              <button
                id="petal-green-y"
                onPointerDown={(e) => handleJoystickDown(e, 'y')}
                  style={{ backgroundColor: isPlayMode ? (isLightTheme ? '#7f827c' : '#a5a8a2') : '#22c55e' }}
                className={`absolute ${
                  isBiggerUI ? '-top-1.5 w-6 h-10' : '-top-1 w-5 h-8'
                } rounded-full hover:brightness-125 transition-all shadow-md cursor-pointer`}
                title="Move Y (Elevation)"
              />

              {/* Left/Hot Pink Petal (Lateral X) */}
              <button
                id="petal-red-x"
                onPointerDown={(e) => handleJoystickDown(e, 'x')}
                  style={{ backgroundColor: isPlayMode ? (isLightTheme ? '#8d8984' : '#b3aea8') : '#ef4444' }}
                className={`absolute ${
                  isBiggerUI ? '-left-1.5 w-10 h-6' : '-left-1 w-8 h-5'
                } rounded-full hover:brightness-125 transition-all shadow-md cursor-pointer`}
                title="Move X (Lateral)"
              />

              {/* Right/Electric Cyan Petal (Depth Z in 3D mode) */}
              {mode === '3d' && (
                <button
                  id="petal-blue-z"
                  onPointerDown={(e) => handleJoystickDown(e, 'z')}
                    style={{ backgroundColor: isPlayMode ? (isLightTheme ? '#68767c' : '#95a4aa') : '#3b82f6' }}
                  className={`absolute ${
                    isBiggerUI ? '-right-1.5 w-10 h-6' : '-right-1 w-8 h-5'
                  } rounded-full hover:brightness-125 transition-all shadow-md cursor-pointer`}
                  title="Move Z (Depth)"
                />
              )}
            </div>

            {/* Elastic White Center Puck with 3D Dome Shading */}
            <motion.div
              id="paperrocket-center-white-puck"
              style={{
                x: springX,
                y: springY,
              }}
              animate={{
                scale: isDraggingJoystick ? 1.08 : 1,
                boxShadow: isDraggingJoystick
                  ? '0 0 35px rgba(255, 255, 255, 0.9), 0 12px 28px rgba(0,0,0,0.6)'
                  : '0 8px 20px rgba(0,0,0,0.45), inset 0 2px 2px rgba(255,255,255,0.8), inset 0 -3px 6px rgba(0,0,0,0.2)',
              }}
              className={`relative z-20 ${
                isBiggerUI ? 'w-16 h-16 min-w-[48px] min-h-[48px]' : 'w-12 h-12 min-w-[40px] min-h-[40px]'
              } rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff_0%,#f8fafc_50%,#cbd5e1_100%)] border border-white/60 text-neutral-900 font-bold flex items-center justify-center text-xs shadow-xl cursor-grab active:cursor-grabbing select-none`}
            >
              {/* Dynamic metric label inside puck like in the video - Pro only;
                  Play keeps the plain dot so dragging never shows raw numbers */}
              {!isPlayMode && isDraggingJoystick && dragValueLabel ? (
                <span className="text-[10px] sm:text-[11px] font-extrabold tracking-tight text-neutral-950 animate-pulse">
                  {dragValueLabel}
                </span>
              ) : (
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-neutral-900/20 shadow-inner flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 shadow-sm" />
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* MODE 2: ROLLING 3D TOY SPHERE (Real Three.js WebGPU/WebGL 3D Sphere Trackball) - Pro only */}
        {subMode === 'ball' && !isPlayMode && (
          <div
            id="paperrocket-trackball-sphere"
            className={`relative ${
              isBiggerUI ? 'w-40 h-40' : 'w-28 h-28'
            } rounded-full bg-[#121214] border-2 border-neutral-800 shadow-[inset_0_4px_16px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden z-20`}
          >
            <ThreeTrackball
              yaw={spatialState.yaw}
              pitch={spatialState.pitch}
              soundEnabled={soundEnabled}
              size={isBiggerUI ? 160 : 112}
              onDragStateChange={setIsRollingBall}
              onVelocityChange={(v) => {
                activeVelocityRef.current = v;
              }}
              onRotate={(deltaYaw, deltaPitch) => {
                onUpdateSpatial((prev) => ({
                  ...prev,
                  yaw: (prev.yaw + deltaYaw) % 360,
                  pitch: Math.max(-85, Math.min(85, prev.pitch + deltaPitch)),
                }));

                if (engine) {
                  if (targetScope === 'active_layer' || targetScope === 'model' || targetScope === 'strokes') {
                    engine.rotateTrackball(deltaYaw * 0.8, -deltaPitch * 0.8, targetScope);
                  } else {
                    engine.orbitCamera(-deltaYaw * 0.015, -deltaPitch * 0.015);
                  }
                }
              }}
            />
          </div>
        )}

        {/* MODE 3: RADIAL SCRUBBER DIAL (numeric brush/zoom/rotate readouts) - Pro only */}
        {subMode === 'dial' && !isPlayMode && (
          <div
            ref={dialRef}
            id="paperrocket-radial-dial"
            onPointerDown={handleDialPointerDown}
            onPointerMove={(e) => {
              if (isDialDragging) handleDialPointer(e);
            }}
            onPointerUp={handleDialPointerUp}
            className={`relative ${
              isBiggerUI ? 'w-44 h-44' : 'w-32 h-32'
            } rounded-full flex items-center justify-center cursor-pointer z-20`}
          >
            {/* Radial tick marks around dial */}
            {Array.from({ length: 24 }).map((_, i) => {
              const deg = (i / 24) * 360;
              const isActive = (spatialState.brushSize / 50) * 360 >= deg;
              const tickOffset = isBiggerUI ? 68 : 46;
              return (
                <div
                  key={i}
                  className={`absolute w-0.5 ${isBiggerUI ? 'h-3' : 'h-2'} rounded-full transition-colors ${
                    isActive ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'bg-neutral-700/60'
                  }`}
                  style={{
                    transform: `rotate(${deg}deg) translateY(-${tickOffset}px)`,
                  }}
                />
              );
            })}

            {/* Center Dial Hub with Mode Switcher & Real-time Readout */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playHapticSound('click', soundEnabled);
                setDialMode((prev) => (prev === 'brush_size' ? 'zoom' : prev === 'zoom' ? 'rotate' : 'brush_size'));
              }}
              className={`${
                isBiggerUI ? 'w-24 h-24' : 'w-18 h-18'
              } rounded-full bg-white text-neutral-950 shadow-2xl flex flex-col items-center justify-center font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer select-none`}
              title="Click to cycle: Brush Size ➔ Camera Zoom ➔ 3D Rotate"
            >
              <span className={`${isBiggerUI ? 'text-[9px]' : 'text-[7px]'} font-extrabold tracking-wider text-neutral-500 uppercase`}>
                {dialMode === 'brush_size' ? 'BRUSH' : dialMode === 'zoom' ? 'ZOOM' : 'ROTATE'}
              </span>
              <span className={`${isBiggerUI ? 'text-lg' : 'text-xs'} leading-tight font-extrabold text-neutral-950`}>
                {dialMode === 'brush_size'
                  ? `${((brushSettings?.size || 0.035) * 30).toFixed(1)}px`
                  : dialMode === 'zoom'
                  ? `${Math.round((spatialState.scale || 1.0) * 100)}%`
                  : `${Math.round(spatialState.roll || 0)}°`}
              </span>
              <div className={`${isBiggerUI ? 'w-8 h-0.5' : 'w-5 h-0.5'} bg-neutral-200 my-0.5`} />
              <span className={`${isBiggerUI ? 'text-[9px]' : 'text-[7px]'} text-neutral-400 font-mono leading-none`}>
                {spatialState.brushSize} / 50
              </span>
            </button>
          </div>
        )}
      </motion.div>

        {/* Bottom-Left Settings Toggle (Repositioned into bottom-left corner) - Pro only */}
        {!isPlayMode && (
        <button
          id="paperrocket-settings-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playHapticSound('click', soundEnabled);
            setShowMenu((prev) => !prev);
            setShowHiddenPhysicsPanel(false);
          }}
          className={`absolute bottom-2.5 left-2.5 z-30 w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            showMenu
              ? 'bg-neutral-900 dark:bg-white/20 text-neutral-800 dark:text-zinc-300 border border-neutral-900 dark:border-white/40 shadow-sm'
              : 'bg-white/[0.08] hover:bg-white/[0.16] text-neutral-400 hover:text-white border border-white/[0.06] shadow-sm'
          }`}
          title="Settings & Options"
          aria-label="Wheel settings"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        )}

        {/* Bottom-Left Rotation Axis Toggle: Cycle between Turntable (Y), Screen Roll (Z), Tilt (X), and Camera Orbit */}
        <button
          id="paperrocket-ring-target-btn"
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            cycleRingAxis();
          }}
          className={`absolute bottom-2.5 left-2.5 z-30 px-2 h-8 rounded-lg flex items-center gap-1.5
            border transition-all active:scale-95 text-xs font-bold cursor-pointer ${
              isPlayMode
                ? isLightTheme
                  ? 'bg-transparent border-black/25 text-neutral-700'
                  : 'bg-transparent border-white/20 text-neutral-300'
                :
              ringAxis === 'yaw'
                ? 'bg-neutral-800 border-neutral-700 text-neutral-200 shadow-sm'
                : ringAxis === 'screen'
                ? 'bg-neutral-800 border-neutral-700 text-neutral-200 shadow-sm'
                : ringAxis === 'pitch'
                ? 'bg-neutral-800 border-neutral-700 text-neutral-200 shadow-sm'
                : 'bg-neutral-900 dark:bg-white border-neutral-400 dark:border-neutral-600 text-zinc-950 shadow-sm'
            }`}
          title={`Click to switch axis: Turntable (Y) ➔ Screen Roll (Z) ➔ Tilt (X) ➔ Camera Orbit (Current: ${ringAxis.toUpperCase()})`}
          aria-label="Change rotation axis"
        >
          {ringAxis === 'yaw' && <RotateCw className="w-3.5 h-3.5 text-neutral-300" />}
          {ringAxis === 'screen' && <Move3d className="w-3.5 h-3.5 text-neutral-300" />}
          {ringAxis === 'pitch' && <Move className="w-3.5 h-3.5 text-neutral-300" />}
          {ringAxis === 'camera' && <Camera className="w-3.5 h-3.5" />}
          <span className="text-[10px] uppercase font-mono font-extrabold">
            {ringAxis === 'yaw' ? 'Turn Y' : ringAxis === 'screen' ? 'Roll Z' : ringAxis === 'pitch' ? 'Tilt X' : 'Cam'}
          </span>
        </button>

        <button
          id="paperrocket-minimize-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playHapticSound('pop', soundEnabled);
            if (isPlayMode) {
              setIsPlayExpanded(false);
            } else {
              setIsOpen(false);
            }
            setShowMenu(false);
            setShowHiddenPhysicsPanel(false);
          }}
          className={`absolute bottom-2.5 right-2.5 z-30 w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border shadow-sm ${
            isLightTheme
              ? 'bg-neutral-200 border-neutral-300 text-neutral-600 hover:bg-neutral-300'
              : 'bg-white/[0.08] border-white/[0.06] text-neutral-400 hover:bg-white/[0.16] hover:text-white'
          }`}
          title="Minimize to Dot"
          aria-label="Minimize wheel"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* PaperRockets Quick Settings Popover anchored at Bottom - Pro only (unreachable in
          Play since the settings button that opens it is hidden; guarded here too) */}
      <AnimatePresence>
        {showMenu && !isPlayMode && (
          <motion.div
            id="paperrocket-settings-popover"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            className="absolute bottom-11 inset-x-2 z-50 p-3.5 rounded-2xl bg-[#1c1c1f]/98 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-neutral-200 flex flex-col gap-2.5 max-h-[calc(100%-60px)] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-bold text-white">Wheel Options</span>
              <button
                onClick={() => setShowMenu(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Done
              </button>
            </div>

            {/* GPU Acceleration status */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[11px] font-medium text-neutral-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-neutral-400" />
                Graphics Engine
              </span>
              <span className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full ${
                hasWebGPU ? 'bg-neutral-900 dark:bg-white/20 text-neutral-700 dark:text-zinc-300' : 'bg-white/10 text-neutral-300'
              }`}>
                {hasWebGPU ? 'WebGPU' : 'WebGL2'}
              </span>
            </div>

            {/* Independent Wheel Scale Controls */}
            <div className="flex flex-col gap-1.5 py-1 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-300">Widget Scale</span>
                <span className="text-[10px] font-mono font-bold text-neutral-800 dark:text-zinc-300">
                  {Math.round(scaleFactor * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    playHapticSound('click', soundEnabled);
                    const next = Math.max(0.55, Math.round((scaleFactor - 0.1) * 100) / 100);
                    setScaleFactor(next);
                    try { localStorage.setItem('mody_tactile_scale', next.toString()); } catch (_) {}
                  }}
                  className="flex-1 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold text-center transition-colors"
                  title="Decrease Widget Scale (-10%)"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playHapticSound('click', soundEnabled);
                    handleScaleCycle();
                  }}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono text-center transition-colors"
                  title="Cycle Widget Scale Preset"
                >
                  Preset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playHapticSound('click', soundEnabled);
                    const next = Math.min(1.4, Math.round((scaleFactor + 0.1) * 100) / 100);
                    setScaleFactor(next);
                    try { localStorage.setItem('mody_tactile_scale', next.toString()); } catch (_) {}
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
                  soundEnabled ? 'bg-white' : 'bg-neutral-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full ${soundEnabled ? 'bg-zinc-950' : 'bg-white'} transition-transform ${
                    soundEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Hidden Physics Engine shortcut */}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">Physics Config</span>
              <button
                id="open-hidden-physics-btn"
                onClick={() => {
                  playHapticSound('snap', soundEnabled);
                  setShowHiddenPhysicsPanel(true);
                  setShowMenu(false);
                }}
                className="text-[11px] font-bold text-neutral-800 dark:text-zinc-300 hover:text-neutral-800 dark:text-zinc-300 flex items-center gap-1"
              >
                <span>Tune Physics</span>
                <Sliders className="w-3 h-3" />
              </button>
            </div>

            {/* Reset All Position & Rotation */}
            <button
              id="menu-reset-all-btn"
              onClick={() => {
                playHapticSound('snap', soundEnabled);
                onReset();
                setShowMenu(false);
              }}
              className="w-full py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all mt-0.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Everything</span>
            </button>

            {/* Minimize Widget */}
            <button
              id="menu-minimize-btn"
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

      {/* ------------------------------------------------------------------ */}
      {/* HIDDEN SETTINGS PANEL (Accessible via Long-Press on Tactile Wheel) */}
      {/* Pro only - the long-press trigger itself is disarmed in Play        */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {showHiddenPhysicsPanel && !isPlayMode && (
          <motion.div
            id="paperrocket-hidden-physics-panel"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="absolute inset-0 z-50 rounded-[24px] bg-[#14151a]/98 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-neutral-200 flex flex-col p-4 overflow-y-auto select-none gap-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-neutral-900 dark:bg-white/20 text-neutral-800 dark:text-zinc-300 flex items-center justify-center">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Tactile Physics & Dynamics</h4>
                  <p className="text-[9.5px] text-neutral-400">Response tuning & spring config</p>
                </div>
              </div>
              <button
                id="close-physics-panel-btn"
                onClick={() => {
                  playHapticSound('click', soundEnabled);
                  setShowHiddenPhysicsPanel(false);
                }}
                className="w-6 h-6 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center text-xs transition-colors"
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
                  <span className="font-semibold text-neutral-300">Rubber-Band Spring Tension</span>
                  <span className="font-mono text-neutral-800 dark:text-zinc-300 text-[11px] font-bold">
                    {physicsSettings.rubberBandStiffness}
                  </span>
                </div>
                <input
                  id="rubber-band-stiffness-slider"
                  type="range"
                  min="180"
                  max="650"
                  step="10"
                  value={physicsSettings.rubberBandStiffness}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPhysicsSettings((prev) => ({ ...prev, rubberBandStiffness: val }));
                  }}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-100"
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
                  <span className="font-semibold text-neutral-300">Spring Damping (Oscillation)</span>
                  <span className="font-mono text-neutral-800 dark:text-zinc-300 text-[11px] font-bold">
                    {physicsSettings.rubberBandDamping}
                  </span>
                </div>
                <input
                  id="rubber-band-damping-slider"
                  type="range"
                  min="12"
                  max="40"
                  step="1"
                  value={physicsSettings.rubberBandDamping}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPhysicsSettings((prev) => ({ ...prev, rubberBandDamping: val }));
                  }}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-100"
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
                  <span className="font-semibold text-neutral-300">Momentum Friction Drift</span>
                  <span className="font-mono text-neutral-800 dark:text-zinc-300 text-[11px] font-bold">
                    {physicsSettings.friction.toFixed(2)}
                  </span>
                </div>
                <input
                  id="friction-physics-slider"
                  type="range"
                  min="0.75"
                  max="0.98"
                  step="0.01"
                  value={physicsSettings.friction}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPhysicsSettings((prev) => ({ ...prev, friction: val }));
                  }}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-100"
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
                  <span className="font-semibold text-neutral-300">Tactile Resistance Vibration</span>
                  <span className="font-mono text-neutral-800 dark:text-zinc-300 text-[11px] font-bold">
                    {Math.round(physicsSettings.vibrationStrength * 100)}%
                  </span>
                </div>
                <input
                  id="vibration-strength-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={physicsSettings.vibrationStrength}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPhysicsSettings((prev) => ({ ...prev, vibrationStrength: val }));
                  }}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-100"
                />
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-2">
                {/* Anti-Glitch Coordinate Clamping Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-300">Canvas Bounds Guard</span>
                  <button
                    id="toggle-bounds-guard-btn"
                    onClick={() => {
                      playHapticSound('click', soundEnabled);
                      setPhysicsSettings((prev) => ({
                        ...prev,
                        clampBounds: !prev.clampBounds,
                      }));
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                      physicsSettings.clampBounds ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-800'
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
            <div className="pt-2 flex items-center gap-2 shrink-0 border-t border-neutral-800/60">
              <button
                id="reset-physics-defaults-btn"
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
                className="flex-1 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 hover:text-white transition-all"
              >
                Defaults
              </button>
              <button
                id="apply-physics-btn"
                onClick={() => {
                  playHapticSound('pop', soundEnabled);
                  setShowHiddenPhysicsPanel(false);
                }}
                className="flex-1 py-1.5 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-900 dark:bg-white text-xs font-bold text-neutral-950 shadow-md transition-all"
              >
                Apply & Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner Drag-to-Resize Handle ("Resizing Thingy") - Pro only; resizes the
          widget chrome, not the object, so it's outside what Play needs at rest */}
      {!isPlayMode && (
      <div
        id="paperrocket-wheel-resize-handle"
        onPointerDown={handleResizeStart}
        onDoubleClick={handleScaleCycle}
        className="absolute bottom-0 right-0 z-40 w-6 h-6 flex items-end justify-end p-1 cursor-nwse-resize group transition-transform active:scale-125 select-none"
        title="Drag corner to resize wheel controller (Double-click to cycle presets)"
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
      {isResizing && !isPlayMode && (
        <div className="absolute top-2 right-12 z-50 px-2 py-0.5 rounded-full bg-neutral-900 dark:bg-white text-black font-mono font-bold text-[10px] shadow-lg pointer-events-none animate-in fade-in duration-100">
          {Math.round(scaleFactor * 100)}%
        </div>
      )}
    </motion.aside>
  );
};



