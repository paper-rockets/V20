/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import {
  MoreHorizontal,
  RotateCcw,
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
} from 'lucide-react';
import { SpatialMode, SubWheelMode, SpatialState } from '../types';
import { playHapticSound } from '../utils/audio';
import { ThreeTrackball } from './ThreeTrackball';
import { StudioEngine } from '../core/studioEngine';

interface TactileSpatialControllerProps {
  engine?: StudioEngine | null;
  cameraSpherical?: { radius: number; theta: number; phi: number };
  onOrbitCamera?: (deltaTheta: number, deltaPhi: number) => void;
  onSetCameraView?: (targetTheta: number, targetPhi: number, targetRadius?: number) => void;
  onZoomCamera?: (deltaRadius: number) => void;
  onClose?: () => void;
  brushSize?: number;
  onBrushSizeChange?: (size: number) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export const TactileSpatialController: React.FC<TactileSpatialControllerProps> = ({
  engine,
  cameraSpherical,
  onClose,
  brushSize = 18,
  onBrushSizeChange,
  soundEnabled: controlledSoundEnabled,
  onToggleSound,
}) => {
  // Mode and Spatial State
  const [mode, setMode] = useState<SpatialMode>('3d');
  const [spatialState, setSpatialState] = useState<SpatialState>({
    x: 0,
    y: 0,
    z: 0,
    pitch: 18,
    yaw: -24,
    roll: 0,
    scale: 1.0,
    brushSize: brushSize || 18,
  });

  const [internalSoundEnabled, setInternalSoundEnabled] = useState<boolean>(true);
  const soundEnabled = controlledSoundEnabled !== undefined ? controlledSoundEnabled : internalSoundEnabled;
  const toggleSound = () => {
    if (onToggleSound) {
      onToggleSound();
    } else {
      setInternalSoundEnabled((prev) => !prev);
    }
  };

  // Synchronize incoming brushSize
  useEffect(() => {
    if (brushSize && brushSize !== spatialState.brushSize) {
      setSpatialState((prev) => ({ ...prev, brushSize }));
    }
  }, [brushSize]);

  // Widget states
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [subMode, setSubMode] = useState<SubWheelMode>('joystick');
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showHiddenPhysicsPanel, setShowHiddenPhysicsPanel] = useState<boolean>(false);
  const [isBiggerUI, setIsBiggerUI] = useState<boolean>(false);
  const [activeAxis, setActiveAxis] = useState<'x' | 'y' | 'z' | 'all'>('all');
  const [dragValueLabel, setDragValueLabel] = useState<string | null>(null);
  const [pinchFeedback, setPinchFeedback] = useState<string | null>(null);
  const [hasWebGPU, setHasWebGPU] = useState<boolean>(false);

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

  // Reset handler
  const handleReset = useCallback(() => {
    setSpatialState((prev) => ({
      ...prev,
      x: 0,
      y: 0,
      z: 0,
      pitch: mode === '3d' ? 18 : 0,
      yaw: mode === '3d' ? -24 : 0,
      roll: 0,
      scale: 1.0,
    }));
    if (engine) {
      engine.resetTransform('all');
      engine.snapToView('isometric');
    }
  }, [engine, mode]);

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

  // Joystick pointer handlers with normalized coordinate math & engine sync
  const handleJoystickDown = (e: React.PointerEvent, axis: 'x' | 'y' | 'z' | 'all' = 'all') => {
    e.preventDefault();
    e.stopPropagation();

    if (joystickFrictionRef.current) {
      cancelAnimationFrame(joystickFrictionRef.current);
      joystickFrictionRef.current = null;
    }

    setIsDraggingJoystick(true);
    setActiveAxis(axis);
    joystickLastPos.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    joystickVelocity.current = { x: 0, y: 0 };
    playHapticSound('squish', soundEnabled);

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
      const normDist = Math.min(1.0, dist / (radius * 0.82));

      let normU = Math.cos(angle) * normDist;
      let normV = Math.sin(angle) * normDist;

      if (axis === 'y' || axis === 'z') normU = 0;
      if (axis === 'x') normV = 0;

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

    const normDist = Math.min(1.0, dist / (radius * 0.82));
    let normU = Math.cos(angle) * normDist;
    let normV = Math.sin(angle) * normDist;

    if (activeAxis === 'x') normV = 0;
    if (activeAxis === 'y' || activeAxis === 'z') normU = 0;

    const maxVisualTravel = isBiggerUI ? 48 : 30;
    rawX.set(normU * maxVisualTravel);
    rawY.set(normV * maxVisualTravel);

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

    const deadzone = 0.035;
    const effectiveMag = Math.max(0, (normDist - deadzone) / (1 - deadzone));
    const responseMag = Math.pow(effectiveMag, 1.28);

    const dirU = normDist > 0 ? (normU / normDist) * responseMag : 0;
    const dirV = normDist > 0 ? (normV / normDist) * responseMag : 0;

    const speedScale = mode === '3d' ? 3.2 : 2.4;
    const deltaX = dirU * speedScale;
    const deltaY = -dirV * speedScale;

    if (activeAxis === 'z') {
      const deltaZ = -dirV * speedScale;
      setSpatialState((prev) => clampSpatial({ ...prev, z: prev.z + deltaZ }));
      const dispZ = Math.round(-normV * 50);
      setDragValueLabel(`${dispZ > 0 ? '+' : ''}${dispZ}mm Z`);
      if (engine) {
        engine.translateAxis3D('z', deltaZ * 0.04, 'all');
      }
    } else if (activeAxis === 'x') {
      setSpatialState((prev) => clampSpatial({ ...prev, x: prev.x + deltaX }));
      const dispX = Math.round(normU * 50);
      setDragValueLabel(`${dispX > 0 ? '+' : ''}${dispX}mm X`);
      if (engine) {
        engine.translateAxis3D('x', deltaX * 0.04, 'all');
      }
    } else if (activeAxis === 'y') {
      setSpatialState((prev) => clampSpatial({ ...prev, y: prev.y + deltaY }));
      const dispY = Math.round(-normV * 50);
      setDragValueLabel(`${dispY > 0 ? '+' : ''}${dispY}mm Y`);
      if (engine) {
        engine.translateAxis3D('y', deltaY * 0.04, 'all');
      }
    } else {
      setSpatialState((prev) => clampSpatial({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
      const disp = Math.round(normDist * 50);
      setDragValueLabel(`${disp}mm`);
      if (engine) {
        engine.translateScreenSpace(deltaX * 0.04, -deltaY * 0.04, 'all');
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
      if (joystickContainerRef.current) {
        try {
          joystickContainerRef.current.releasePointerCapture(e.pointerId);
        } catch {}
      }

      rawX.set(0);
      rawY.set(0);

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

        setSpatialState((prev) =>
          clampSpatial({
            ...prev,
            x: prev.x + vx * 1.5,
            y: prev.y - vy * 1.5,
          })
        );

        if (engine) {
          engine.translateScreenSpace(vx * 0.02, vy * 0.02, 'all');
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
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      dialCenterRef.current = { cx, cy };
      let angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      dialLastAngle.current = angle;
    }

    handleDialPointer(e);
  };

  const handleDialPointer = (e: React.PointerEvent) => {
    if (!dialRef.current) return;
    const { cx, cy } = dialCenterRef.current;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    const now = performance.now();
    const dt = Math.max(1, now - dialLastTime.current);
    const dAngle = angle - dialLastAngle.current;

    let normalizedDelta = dAngle;
    if (normalizedDelta > 180) normalizedDelta -= 360;
    if (normalizedDelta < -180) normalizedDelta += 360;

    const currentVAngle = (normalizedDelta / dt) * 16.67;
    dialVelocity.current = dialVelocity.current * 0.3 + currentVAngle * 0.7;
    dialLastAngle.current = angle;
    dialLastTime.current = now;

    activeVelocityRef.current = Math.min(2.0, Math.abs(currentVAngle) * 0.1);

    const val = Math.max(1, Math.min(50, Math.round((angle / 360) * 50)));

    if (val !== lastTickValue.current) {
      playHapticSound('tick', soundEnabled);
      lastTickValue.current = val;
    }

    setSpatialState((prev) => ({ ...prev, brushSize: val }));
    if (onBrushSizeChange) onBrushSizeChange(val);
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

      setSpatialState((prev) => {
        const step = vAngle > 0 ? 1 : -1;
        const nextVal = Math.max(1, Math.min(50, prev.brushSize + (Math.abs(vAngle) > 2 ? step : 0)));
        if (nextVal !== prev.brushSize) {
          playHapticSound('tick', soundEnabled);
          if (onBrushSizeChange) onBrushSizeChange(nextVal);
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

  // Multi-touch Pinch-to-Zoom Gesture Handlers
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

      setSpatialState((prev) => ({ ...prev, scale: newScale }));
      setPinchFeedback(`Pinch Scale: ${newScale.toFixed(2)}x`);
      activeVelocityRef.current = Math.abs(ratio - 1) * 10;

      if (engine) {
        const factor = 1 + (ratio - 1) * 0.05;
        engine.scaleAxis3D(factor, 'all');
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistanceRef.current = null;
      setTimeout(() => setPinchFeedback(null), 1200);
      activeVelocityRef.current = 0;
    }
  };

  const wheelSizeClass = isBiggerUI ? 'w-[320px] h-[320px]' : 'w-[260px] h-[260px]';

  // If collapsed to mini button
  if (!isOpen) {
    return (
      <motion.button
        id="paperrocket-mini-trigger"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          playHapticSound('pop', soundEnabled);
          setIsOpen(true);
        }}
        className="w-14 h-14 min-w-[48px] min-h-[48px] rounded-full bg-neutral-900 border-2 border-neutral-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.6)] flex items-center justify-center text-white cursor-pointer group"
        title="Open Tactile Spatial Controller (Navigator 2)"
      >
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 group-hover:bg-neutral-600 dark:group-hover:bg-zinc-300 transition-colors" />
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 group-hover:bg-neutral-600 dark:group-hover:bg-zinc-300 transition-colors" />
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 group-hover:bg-neutral-600 dark:group-hover:bg-zinc-300 transition-colors" />
        </div>
      </motion.button>
    );
  }

  return (
    <div
      className="relative select-none flex flex-col items-center touch-none font-['Plus_Jakarta_Sans',sans-serif]"
      id="paperrocket-wheel-root"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Chunky Segmented Pill: "Flat Screen" / "3D World" */}
      <div className="mb-3 p-1 bg-neutral-900 border border-neutral-800 rounded-full flex items-center shadow-lg w-full max-w-[260px]">
        <button
          id="toggle-flat-screen-btn"
          onClick={() => {
            playHapticSound('mode', soundEnabled);
            setMode('2d');
          }}
          className={`flex-1 py-2 min-h-[44px] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mode === '2d'
              ? 'bg-neutral-100 text-neutral-950 shadow-md font-extrabold'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Flat Screen
        </button>

        <button
          id="toggle-3d-world-btn"
          onClick={() => {
            playHapticSound('mode', soundEnabled);
            setMode('3d');
          }}
          className={`flex-1 py-2 min-h-[44px] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mode === '3d'
              ? 'bg-neutral-100 text-neutral-950 shadow-md font-extrabold'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          3D World
        </button>
      </div>

      {/* Main PaperRockets Tactile Circular Disc with Long-Press Detection */}
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
        className={`relative ${wheelSizeClass} rounded-full bg-[#18181b] border border-neutral-800 shadow-[0_25px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] flex items-center justify-center touch-none overflow-hidden transition-all duration-200`}
      >
        {/* Inner Surface with Velocity-Based CSS Vibration */}
        <div
          id="paperrocket-wheel-surface"
          style={{
            transform: `translate3d(${vibration.x}px, ${vibration.y}px, 0) rotate(${vibration.rot}deg)`,
          }}
          className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none"
        >
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

        {/* Outer Ring Navigation Buttons & Mode Changers */}
        {/* Top Arc Pill (Switch to Dial / Step) */}
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

        {/* Right Arc Pill (Switch to 3D Sphere Roll) */}
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

        {/* Left Arc Button (Quick Recenter) */}
        <motion.button
          id="quick-recenter-pill"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            playHapticSound('snap', soundEnabled);
            handleReset();
          }}
          className="absolute left-3 z-30 w-6 h-11 rounded-full bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-400 hover:text-white flex items-center justify-center transition-all"
          title="Recenter to Origin"
        >
          <RotateCcw className="w-3 h-3" />
        </motion.button>

        {/* Bottom Arc (3 Dots for Popover Menu) */}
        <motion.button
          id="paperrocket-menu-pill"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            playHapticSound('click', soundEnabled);
            setShowMenu(!showMenu);
          }}
          className="absolute bottom-3 z-30 w-11 h-6 rounded-full bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/60 text-neutral-300 hover:text-white flex items-center justify-center gap-1 transition-all"
          title="Settings Menu (or Long-press for Physics)"
        >
          <div className="w-1 h-1 rounded-full bg-current" />
          <div className="w-1 h-1 rounded-full bg-current" />
          <div className="w-1 h-1 rounded-full bg-current" />
        </motion.button>

        {/* ---------------------------------------------------- */}
        {/* CENTER INTERACTIVE CORE                              */}
        {/* ---------------------------------------------------- */}

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
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
                isDraggingJoystick ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
              }`}
            >
              {/* Top/Green Petal (Elevation Y) */}
              <button
                id="petal-green-y"
                onPointerDown={(e) => handleJoystickDown(e, 'y')}
                className={`absolute ${
                  isBiggerUI ? '-top-1.5 w-6 h-10' : '-top-1 w-5 h-8'
                } rounded-full bg-[#22c55e] hover:brightness-125 transition-all shadow-md cursor-pointer`}
                title="Move Y (Elevation)"
              />

              {/* Left/Pink Petal (Lateral X) */}
              <button
                id="petal-pink-x"
                onPointerDown={(e) => handleJoystickDown(e, 'x')}
                className={`absolute ${
                  isBiggerUI ? '-left-1.5 w-10 h-6' : '-left-1 w-8 h-5'
                } rounded-full bg-[#ec4899] hover:brightness-125 transition-all shadow-md cursor-pointer`}
                title="Move X (Lateral)"
              />

              {/* Right/Blue Petal (Depth Z in 3D mode) */}
              {mode === '3d' && (
                <button
                  id="petal-blue-z"
                  onPointerDown={(e) => handleJoystickDown(e, 'z')}
                  className={`absolute ${
                    isBiggerUI ? '-right-1.5 w-10 h-6' : '-right-1 w-8 h-5'
                  } rounded-full bg-[#3b82f6] hover:brightness-125 transition-all shadow-md cursor-pointer`}
                  title="Move Z (Depth)"
                />
              )}
            </div>

            {/* Elastic White Center Puck */}
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
              {isDraggingJoystick && dragValueLabel ? (
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

        {/* MODE 2: ROLLING 3D TOY SPHERE */}
        {subMode === 'ball' && (
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
                setSpatialState((prev) => ({
                  ...prev,
                  yaw: (prev.yaw + deltaYaw) % 360,
                  pitch: Math.max(-85, Math.min(85, prev.pitch + deltaPitch)),
                }));
                if (engine) {
                  engine.rotateTrackball(deltaYaw * 0.8, -deltaPitch * 0.8, 'all');
                }
              }}
            />
          </div>
        )}

        {/* MODE 3: RADIAL SCRUBBER DIAL */}
        {subMode === 'dial' && (
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

            <div
              className={`${
                isBiggerUI ? 'w-20 h-20' : 'w-14 h-14'
              } rounded-full bg-white text-neutral-950 shadow-2xl flex flex-col items-center justify-center font-bold`}
            >
              <span className={`${isBiggerUI ? 'text-base' : 'text-xs'} leading-none font-extrabold`}>
                {spatialState.brushSize}
              </span>
              <div className={`${isBiggerUI ? 'w-6 h-0.5' : 'w-4 h-0.5'} bg-neutral-300 my-0.5`} />
              <span className={`${isBiggerUI ? 'text-[10px]' : 'text-[8px]'} text-neutral-500 font-semibold leading-none`}>
                50
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* 3-Dots Quick Settings Popover */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            id="paperrocket-settings-popover"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-16 right-0 z-50 w-56 p-4 rounded-3xl bg-[#1c1c1e] border border-neutral-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-neutral-200 flex flex-col gap-3"
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
              <span className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-neutral-400" />
                Graphics Engine
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                hasWebGPU ? 'bg-white/10 text-zinc-300' : 'bg-white/5 text-zinc-400'
              }`}>
                {hasWebGPU ? 'WebGPU' : 'WebGL2'}
              </span>
            </div>

            {/* Bigger UI Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Bigger Wheel UI</span>
              <button
                id="toggle-bigger-ui-btn"
                onClick={() => {
                  playHapticSound('click', soundEnabled);
                  setIsBiggerUI(!isBiggerUI);
                }}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                  isBiggerUI ? 'bg-white' : 'bg-neutral-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full ${isBiggerUI ? 'bg-zinc-950' : 'bg-white'} transition-transform ${
                    isBiggerUI ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Sound Feedback Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Haptic Audio Feedback</span>
              <button
                id="toggle-sound-btn"
                onClick={() => {
                  toggleSound();
                  playHapticSound('pop', !soundEnabled);
                }}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                  soundEnabled ? 'bg-white' : 'bg-neutral-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full ${
                    soundEnabled ? 'bg-zinc-950 translate-x-4' : 'bg-white translate-x-0'
                  } transition-transform`}
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
                className="text-[11px] font-bold text-zinc-200 hover:text-white flex items-center gap-1"
              >
                <span>Tune Physics</span>
                <Sliders className="w-3 h-3 text-zinc-400" />
              </button>
            </div>

            {/* Reset All Position & Rotation */}
            <button
              id="menu-reset-all-btn"
              onClick={() => {
                playHapticSound('snap', soundEnabled);
                handleReset();
                setShowMenu(false);
              }}
              className="w-full py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all mt-1"
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
              className="w-full py-1.5 text-center text-[11px] text-neutral-400 hover:text-neutral-200"
            >
              Minimize to Dot
            </button>

            {onClose && (
              <button
                id="menu-close-btn"
                onClick={() => {
                  playHapticSound('click', soundEnabled);
                  onClose();
                  setShowMenu(false);
                }}
                className="w-full py-1 text-center text-[11px] text-zinc-400 hover:text-white"
              >
                Hide Navigator
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIDDEN SETTINGS PANEL */}
      <AnimatePresence>
        {showHiddenPhysicsPanel && (
          <motion.div
            id="paperrocket-hidden-physics-panel"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-16 right-0 z-50 w-80 max-w-[calc(100vw-32px)] max-h-[85vh] p-4 sm:p-5 rounded-3xl bg-[#18181b] border border-neutral-700 shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-neutral-200 flex flex-col gap-3.5 overflow-y-auto select-none"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 text-zinc-200 flex items-center justify-center">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Tactile Physics & Dynamics</h4>
                  <p className="text-[10px] text-neutral-400">Response tuning & spring config</p>
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

            {/* Slider 1: Spring Stiffness */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">Rubber-Band Spring Tension</span>
                <span className="font-mono text-zinc-200 text-[11px] font-bold">
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
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[9px] text-neutral-500">
                <span>Loose (180)</span>
                <span>Default (420)</span>
                <span>Ultra-Taut (650)</span>
              </div>
            </div>

            {/* Slider 2: Spring Damping */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">Spring Damping (Oscillation)</span>
                <span className="font-mono text-zinc-200 text-[11px] font-bold">
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
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[9px] text-neutral-500">
                <span>Bouncy (12)</span>
                <span>Balanced (24)</span>
                <span>Overdamped (40)</span>
              </div>
            </div>

            {/* Slider 3: Friction Drift */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">Momentum Friction Drift</span>
                <span className="font-mono text-zinc-200 text-[11px] font-bold">
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
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[9px] text-neutral-500">
                <span>Quick Stop (0.75)</span>
                <span>Natural (0.91)</span>
                <span>Long Glide (0.98)</span>
              </div>
            </div>

            {/* Slider 4: Haptic Vibration */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">Tactile Resistance Vibration</span>
                <span className="font-mono text-zinc-200 text-[11px] font-bold">
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
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-2">
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
                    physicsSettings.clampBounds ? 'bg-white' : 'bg-neutral-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${
                      physicsSettings.clampBounds ? 'bg-zinc-950 translate-x-4' : 'bg-white translate-x-0'
                    } transition-transform`}
                  />
                </button>
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
                className="flex-1 py-1.5 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-zinc-100 text-xs font-bold text-white dark:text-zinc-950 shadow-md transition-all"
              >
                Apply & Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
