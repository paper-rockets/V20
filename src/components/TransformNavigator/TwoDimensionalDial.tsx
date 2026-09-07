import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Move,
  ArrowUpDown,
  ArrowLeftRight,
  Maximize2,
  RotateCw,
} from 'lucide-react';
import {
  AccessibilityMode,
  TranslationEventPayload,
  RotationEventPayload,
  ScaleEventPayload,
} from '../../types';
import { applyElasticResistance, getAngle, normalizeAngleDeg } from '../../utils/mathUtils';
import { haptics } from '../../utils/haptics';

interface TwoDimensionalDialProps {
  isLocked: boolean;
  accessibilityMode: AccessibilityMode;
  onTranslate?: (data: TranslationEventPayload) => void;
  onRotate?: (data: RotationEventPayload) => void;
  onScale?: (data: ScaleEventPayload) => void;
  onInteractionStart?: (handleName: string) => void;
  onInteractionEnd?: (handleName: string) => void;
}

export const TwoDimensionalDial: React.FC<TwoDimensionalDialProps> = ({
  isLocked,
  accessibilityMode,
  onTranslate,
  onRotate,
  onScale,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Center stick drag state
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isStickDragging, setIsStickDragging] = useState(false);
  const stickDragOriginRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const hitBoundaryRef = useRef(false);

  // Active handle tracking
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  // Rotation angle state for 2D rotate handle
  const [currentRotationAngle, setCurrentRotationAngle] = useState(0);
  const rotateStartAngleRef = useRef<number>(0);
  const initialRotationAngleRef = useRef<number>(0);
  const lastAngleDetentRef = useRef<number>(0);

  // Scale drag states
  const scaleDragOriginRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const lastScaleStepRef = useRef<number>(1);
  const [scaleDisplacements, setScaleDisplacements] = useState({
    top: { x: 0, y: 0 },
    left: { x: 0, y: 0 },
    topLeft: { x: 0, y: 0 },
  });

  const isFingerPen = accessibilityMode === 'finger-pen';
  const handleSize = isFingerPen ? 'w-10 h-10' : 'w-8 h-8';
  const centerStickSize = isFingerPen ? 'w-22 h-22' : 'w-18 h-18';

  // -------------------------------------------------------------
  // 1. Central Move Stick Drag Handlers (Elastic & Normalized Vector)
  // -------------------------------------------------------------
  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) {
      haptics.trigger('lock');
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    stickDragOriginRef.current = { clientX: e.clientX, clientY: e.clientY };
    setIsStickDragging(true);
    hitBoundaryRef.current = false;
    setActiveHandle('move');
    haptics.trigger('light');
    onInteractionStart?.('move');
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isStickDragging || !stickDragOriginRef.current) return;
    e.preventDefault();

    const rawDx = e.clientX - stickDragOriginRef.current.clientX;
    const rawDy = e.clientY - stickDragOriginRef.current.clientY;

    const rawDistance = Math.hypot(rawDx, rawDy);
    const maxBound = 48; // Boundary radius for pure travel
    const elasticDistance = applyElasticResistance(rawDistance, maxBound, 0.4);

    if (rawDistance > maxBound * 1.3 && !hitBoundaryRef.current) {
      hitBoundaryRef.current = true;
      haptics.trigger('boundary');
    } else if (rawDistance <= maxBound) {
      hitBoundaryRef.current = false;
    }

    const angle = Math.atan2(rawDy, rawDx);
    const clampedX = Math.cos(angle) * elasticDistance;
    const clampedY = Math.sin(angle) * elasticDistance;

    setStickPos({ x: clampedX, y: clampedY });

    // Normalized vector in [-1, 1] range
    const maxNormalizedRadius = 60;
    const normalizedX = Number((clampedX / maxNormalizedRadius).toFixed(4));
    const normalizedY = Number((-clampedY / maxNormalizedRadius).toFixed(4)); // Invert Y for screen up = positive

    const payload: TranslationEventPayload = {
      x: normalizedX,
      y: normalizedY,
      z: 0,
      normalizedX,
      normalizedY,
      normalizedZ: 0,
      deltaX: rawDx,
      deltaY: -rawDy,
      deltaZ: 0,
      source: '2d-move-stick',
      timestamp: Date.now(),
    };

    console.log('[TransformNavigator 2D] Move Vector:', {
      normX: normalizedX,
      normY: normalizedY,
      rawDx,
      rawDy,
    });

    onTranslate?.(payload);
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isStickDragging) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setIsStickDragging(false);
    stickDragOriginRef.current = null;
    hitBoundaryRef.current = false;
    setActiveHandle(null);
    haptics.trigger('snap');
    onInteractionEnd?.('move');

    // Elastic snap back to origin
    setStickPos({ x: 0, y: 0 });

    const snapPayload: TranslationEventPayload = {
      x: 0,
      y: 0,
      z: 0,
      normalizedX: 0,
      normalizedY: 0,
      normalizedZ: 0,
      deltaX: 0,
      deltaY: 0,
      deltaZ: 0,
      source: '2d-move-stick-snap',
      timestamp: Date.now(),
    };
    onTranslate?.(snapPayload);
  };

  // -------------------------------------------------------------
  // 2. 2D Rotate Handle (Orange right handle)
  // -------------------------------------------------------------
  const handleRotatePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked || !containerRef.current) {
      if (isLocked) haptics.trigger('lock');
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angleRad = getAngle(e.clientX - centerX, e.clientY - centerY);
    const angleDeg = normalizeAngleDeg((angleRad * 180) / Math.PI);

    rotateStartAngleRef.current = angleDeg;
    initialRotationAngleRef.current = currentRotationAngle;
    lastAngleDetentRef.current = currentRotationAngle;

    setActiveHandle('rotate-2d');
    haptics.trigger('medium');
    onInteractionStart?.('rotate-2d');
  };

  const handleRotatePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeHandle !== 'rotate-2d' || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angleRad = getAngle(e.clientX - centerX, e.clientY - centerY);
    const currentAngleDeg = normalizeAngleDeg((angleRad * 180) / Math.PI);

    let deltaAngle = currentAngleDeg - rotateStartAngleRef.current;
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;

    const newAngle = normalizeAngleDeg(initialRotationAngleRef.current + deltaAngle);
    setCurrentRotationAngle(newAngle);

    // Haptic detent feedback every 15 degrees
    haptics.checkAngleDetent(newAngle, lastAngleDetentRef, 15);

    const payload: RotationEventPayload = {
      rx: 0,
      ry: 0,
      rz: Number(newAngle.toFixed(2)),
      deltaAngle: Number(deltaAngle.toFixed(2)),
      axis: '2d-plane',
      source: '2d-rotate-handle',
      timestamp: Date.now(),
    };

    console.log('[TransformNavigator 2D] Rotate In-Plane:', {
      angleDeg: Number(newAngle.toFixed(2)),
      deltaAngle: Number(deltaAngle.toFixed(2)),
    });

    onRotate?.(payload);
  };

  const handleRotatePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeHandle !== 'rotate-2d') return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setActiveHandle(null);
    haptics.trigger('light');
    onInteractionEnd?.('rotate-2d');
  };

  // -------------------------------------------------------------
  // 3. Scale Handles: Top (Height), Left (Width), Top-Left (Uniform)
  // -------------------------------------------------------------
  const handleScalePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    handleType: 'scale-y' | 'scale-x' | 'scale-uniform'
  ) => {
    if (isLocked) {
      haptics.trigger('lock');
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    scaleDragOriginRef.current = { clientX: e.clientX, clientY: e.clientY };
    lastScaleStepRef.current = 1;
    setActiveHandle(handleType);
    haptics.trigger('medium');
    onInteractionStart?.(handleType);
  };

  const handleScalePointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    handleType: 'scale-y' | 'scale-x' | 'scale-uniform'
  ) => {
    if (activeHandle !== handleType || !scaleDragOriginRef.current) return;
    e.preventDefault();

    const rawDx = e.clientX - scaleDragOriginRef.current.clientX;
    const rawDy = e.clientY - scaleDragOriginRef.current.clientY;

    if (handleType === 'scale-y') {
      const clampedDy = Math.max(-40, Math.min(40, rawDy));
      setScaleDisplacements((prev) => ({ ...prev, top: { x: 0, y: clampedDy } }));

      // Dragging up (negative dy) scales UP (height > 1.0)
      const scaleDelta = -rawDy * 0.02;
      const sy = Math.max(0.1, Number((1 + scaleDelta).toFixed(3)));

      const step = Math.round(sy * 4) / 4;
      if (Math.abs(step - lastScaleStepRef.current) >= 0.25) {
        lastScaleStepRef.current = step;
        haptics.trigger('detent', 50);
      }

      onScale?.({
        sx: 1,
        sy,
        sz: 1,
        uniform: sy,
        deltaScale: scaleDelta,
        handle: 'scale-y',
        source: '2d-scale-top',
        timestamp: Date.now(),
      });
      console.log('[TransformNavigator 2D] Scale Height (Y):', { sy, rawDy });
    } else if (handleType === 'scale-x') {
      const clampedDx = Math.max(-40, Math.min(40, rawDx));
      setScaleDisplacements((prev) => ({ ...prev, left: { x: clampedDx, y: 0 } }));

      // Dragging left (negative dx) or right scales width
      const scaleDelta = -rawDx * 0.02;
      const sx = Math.max(0.1, Number((1 + scaleDelta).toFixed(3)));

      const step = Math.round(sx * 4) / 4;
      if (Math.abs(step - lastScaleStepRef.current) >= 0.25) {
        lastScaleStepRef.current = step;
        haptics.trigger('detent', 50);
      }

      onScale?.({
        sx,
        sy: 1,
        sz: 1,
        uniform: sx,
        deltaScale: scaleDelta,
        handle: 'scale-x',
        source: '2d-scale-left',
        timestamp: Date.now(),
      });
      console.log('[TransformNavigator 2D] Scale Width (X):', { sx, rawDx });
    } else if (handleType === 'scale-uniform') {
      const clampedDist = Math.max(-30, Math.min(30, (rawDx - rawDy) / 1.414));
      setScaleDisplacements((prev) => ({
        ...prev,
        topLeft: { x: clampedDist, y: -clampedDist },
      }));

      const scaleDelta = (-rawDx - rawDy) * 0.015;
      const uniform = Math.max(0.1, Number((1 + scaleDelta).toFixed(3)));

      const step = Math.round(uniform * 4) / 4;
      if (Math.abs(step - lastScaleStepRef.current) >= 0.25) {
        lastScaleStepRef.current = step;
        haptics.trigger('detent', 50);
      }

      onScale?.({
        sx: uniform,
        sy: uniform,
        sz: 1,
        uniform,
        deltaScale: scaleDelta,
        handle: 'scale-uniform',
        source: '2d-scale-uniform',
        timestamp: Date.now(),
      });
      console.log('[TransformNavigator 2D] Scale Uniform:', { uniform, scaleDelta });
    }
  };

  const handleScalePointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    handleType: 'scale-y' | 'scale-x' | 'scale-uniform'
  ) => {
    if (activeHandle !== handleType) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setActiveHandle(null);
    haptics.trigger('light');
    scaleDragOriginRef.current = null;
    setScaleDisplacements({
      top: { x: 0, y: 0 },
      left: { x: 0, y: 0 },
      topLeft: { x: 0, y: 0 },
    });
    onInteractionEnd?.(handleType);
  };

  return (
    <div
      id="two-dimensional-dial-view"
      ref={containerRef}
      className="relative w-[230px] h-[230px] mx-auto flex items-center justify-center select-none"
    >
      {/* Background Radar Dial & Grid Guides */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
        className="absolute inset-0 rounded-full bg-[#131315] border border-white/10 shadow-inner flex items-center justify-center overflow-hidden"
      >
        {/* Subtle Radial Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0%,transparent_75%)]" />

        {/* Outer Circular Reference Ring */}
        <div className="absolute w-[86%] h-[86%] rounded-full border border-dashed border-white/15" />

        {/* Mid Circular Reference Ring */}
        <div className="absolute w-[62%] h-[62%] rounded-full border border-white/10" />

        {/* Inner Boundary Ring */}
        <div className="absolute w-[44%] h-[44%] rounded-full border border-dashed border-white/10" />

        {/* Center Crosshair Lines */}
        <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-white/15 to-transparent" />

        {/* Diagonal Crosshair Guides for 2D View */}
        <div className="absolute w-full h-[1px] rotate-45 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <div className="absolute w-full h-[1px] -rotate-45 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </motion.div>

      {/* Elastic Tether Line while dragging central move stick */}
      {isStickDragging && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: 'visible' }}
        >
          <line
            x1="50%"
            y1="50%"
            x2={`calc(50% + ${stickPos.x}px)`}
            y2={`calc(50% + ${stickPos.y}px)`}
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="3 3"
            strokeOpacity="0.8"
          />
        </svg>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Central Move Stick: Circular Tactile Button with 4-Way Arrow */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        id="handle-2d-move-stick"
        role="button"
        tabIndex={0}
        aria-label="2D Screen Move Joystick"
        style={{
          transform: `translate3d(${stickPos.x}px, ${stickPos.y}px, 0)`,
        }}
        onPointerDown={handleStickPointerDown}
        onPointerMove={handleStickPointerMove}
        onPointerUp={handleStickPointerUp}
        onPointerCancel={handleStickPointerUp}
        whileHover={{
          scale: 1.04,
          transition: { type: 'spring', stiffness: 400, damping: 20 },
        }}
        whileTap={{
          scale: 0.98,
          transition: { type: 'spring', stiffness: 500, damping: 20 },
        }}
        animate={{
          scale: isStickDragging ? 1.08 : 1,
          borderColor: isStickDragging ? '#34d399' : 'rgba(255, 255, 255, 0.2)',
          boxShadow: isStickDragging
            ? '0 0 28px rgba(16,185,129,0.45), inset 0 0 10px rgba(16,185,129,0.2)'
            : '0 10px 20px rgba(0,0,0,0.4)',
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className={`relative z-20 ${centerStickSize} rounded-full bg-gradient-to-b from-[#2a2a2e] to-[#1c1c1f] border-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none`}
      >
        {/* Inner Tactile Ring */}
        <div className="w-[82%] h-[82%] rounded-full bg-[#18181a] border border-white/10 flex flex-col items-center justify-center text-zinc-300">
          <Move
            className={`w-4 h-4 transition-transform duration-150 ${
              isStickDragging ? 'text-white scale-110 font-bold' : 'text-zinc-300'
            }`}
          />
          <span className="text-[8.5px] font-bold tracking-wider mt-0.5 text-zinc-400">
            MOVE
          </span>
        </div>
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* Top Scale Handle (Height / Scale Y: ↕) */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        id="handle-2d-scale-y"
        role="button"
        tabIndex={0}
        aria-label="Vertical Height Scale Handle"
        title="Scale Height (Y-Axis)"
        style={{
          top: '13%',
          left: '50%',
          transform: `translate(-50%, calc(-50% + ${scaleDisplacements.top.y}px))`,
        }}
        onPointerDown={(e) => handleScalePointerDown(e, 'scale-y')}
        onPointerMove={(e) => handleScalePointerMove(e, 'scale-y')}
        onPointerUp={(e) => handleScalePointerUp(e, 'scale-y')}
        onPointerCancel={(e) => handleScalePointerUp(e, 'scale-y')}
        whileHover={{
          scale: 1.12,
          transition: { type: 'spring', stiffness: 450, damping: 15 },
        }}
        whileTap={{
          scale: 0.92,
          transition: { type: 'spring', stiffness: 500, damping: 18 },
        }}
        animate={{
          scale: activeHandle === 'scale-y' ? 1.18 : 1,
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 20 }}
        className={`absolute z-30 ${handleSize} rounded-full border shadow-md flex items-center justify-center cursor-ns-resize touch-none select-none transition-colors duration-150 ${
          activeHandle === 'scale-y'
            ? 'bg-white text-zinc-950 border-white shadow-[0_0_16px_rgba(255,255,255,0.7)]'
            : 'bg-[#242428] text-zinc-200 border-white/25 hover:bg-zinc-700 hover:border-white/50'
        }`}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* Left Scale Handle (Width / Scale X: ↔) */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        id="handle-2d-scale-x"
        role="button"
        tabIndex={0}
        aria-label="Horizontal Width Scale Handle"
        title="Scale Width (X-Axis)"
        style={{
          top: '50%',
          left: '13%',
          transform: `translate(calc(-50% + ${scaleDisplacements.left.x}px), -50%)`,
        }}
        onPointerDown={(e) => handleScalePointerDown(e, 'scale-x')}
        onPointerMove={(e) => handleScalePointerMove(e, 'scale-x')}
        onPointerUp={(e) => handleScalePointerUp(e, 'scale-x')}
        onPointerCancel={(e) => handleScalePointerUp(e, 'scale-x')}
        whileHover={{
          scale: 1.12,
          transition: { type: 'spring', stiffness: 450, damping: 15 },
        }}
        whileTap={{
          scale: 0.92,
          transition: { type: 'spring', stiffness: 500, damping: 18 },
        }}
        animate={{
          scale: activeHandle === 'scale-x' ? 1.18 : 1,
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 20 }}
        className={`absolute z-30 ${handleSize} rounded-full border shadow-md flex items-center justify-center cursor-ew-resize touch-none select-none transition-colors duration-150 ${
          activeHandle === 'scale-x'
            ? 'bg-white text-zinc-950 border-white shadow-[0_0_16px_rgba(255,255,255,0.7)]'
            : 'bg-[#242428] text-zinc-200 border-white/25 hover:bg-zinc-700 hover:border-white/50'
        }`}
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* Top-Left Scale Handle (Uniform / Free Scale: ⤢) */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        id="handle-2d-scale-uniform"
        role="button"
        tabIndex={0}
        aria-label="Uniform Free Scale Handle"
        title="Scale Uniform / Free"
        style={{
          top: '23%',
          left: '23%',
          transform: `translate(calc(-50% + ${scaleDisplacements.topLeft.x}px), calc(-50% + ${scaleDisplacements.topLeft.y}px))`,
        }}
        onPointerDown={(e) => handleScalePointerDown(e, 'scale-uniform')}
        onPointerMove={(e) => handleScalePointerMove(e, 'scale-uniform')}
        onPointerUp={(e) => handleScalePointerUp(e, 'scale-uniform')}
        onPointerCancel={(e) => handleScalePointerUp(e, 'scale-uniform')}
        whileHover={{
          scale: 1.12,
          transition: { type: 'spring', stiffness: 450, damping: 15 },
        }}
        whileTap={{
          scale: 0.92,
          transition: { type: 'spring', stiffness: 500, damping: 18 },
        }}
        animate={{
          scale: activeHandle === 'scale-uniform' ? 1.18 : 1,
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 20 }}
        className={`absolute z-30 ${handleSize} rounded-full border shadow-md flex items-center justify-center cursor-nwse-resize touch-none select-none transition-colors duration-150 ${
          activeHandle === 'scale-uniform'
            ? 'bg-white text-zinc-950 border-white shadow-[0_0_16px_rgba(255,255,255,0.7)]'
            : 'bg-[#242428] text-zinc-200 border-white/25 hover:bg-zinc-700 hover:border-white/50'
        }`}
      >
        <Maximize2 className="w-3 h-3" />
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* Right Rotate Handle (Dedicated Monochrome Circular Handle: ↻) */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        id="handle-2d-rotate-right"
        role="button"
        tabIndex={0}
        aria-label="2D In-Plane Rotate Handle"
        title="Rotate In-Plane (Screen Z)"
        style={{
          top: '50%',
          right: '5%',
          transform: 'translate(50%, -50%)',
        }}
        onPointerDown={handleRotatePointerDown}
        onPointerMove={handleRotatePointerMove}
        onPointerUp={handleRotatePointerUp}
        onPointerCancel={handleRotatePointerUp}
        whileHover={{
          scale: 1.12,
          transition: { type: 'spring', stiffness: 450, damping: 15 },
        }}
        whileTap={{
          scale: 0.92,
          transition: { type: 'spring', stiffness: 500, damping: 18 },
        }}
        animate={{
          scale: activeHandle === 'rotate-2d' ? 1.18 : 1,
          boxShadow:
            activeHandle === 'rotate-2d'
              ? '0 0 20px rgba(255,255,255,0.8), inset 0 0 8px rgba(255,255,255,0.4)'
              : '0 4px 10px rgba(0,0,0,0.3)',
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 20 }}
        className={`absolute z-30 ${handleSize} rounded-full bg-white border border-zinc-200 shadow-md flex items-center justify-center text-zinc-950 font-bold cursor-grab active:cursor-grabbing touch-none select-none`}
      >
        <RotateCw className="w-3.5 h-3.5 text-zinc-950 stroke-[2.5]" />
      </motion.div>
    </div>
  );
};
