import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Orbit } from 'lucide-react';
import {
  AccessibilityMode,
  TranslationEventPayload,
  RotationEventPayload,
} from '../../types';
import {
  computeTrackballRotation,
  getAngle,
  normalizeAngleDeg,
} from '../../utils/mathUtils';
import { haptics } from '../../utils/haptics';

interface ThreeDimensionalDialProps {
  isLocked: boolean;
  accessibilityMode: AccessibilityMode;
  onTranslate?: (data: TranslationEventPayload) => void;
  onRotate?: (data: RotationEventPayload) => void;
  onInteractionStart?: (handleName: string) => void;
  onInteractionEnd?: (handleName: string) => void;
}

export const ThreeDimensionalDial: React.FC<ThreeDimensionalDialProps> = ({
  isLocked,
  accessibilityMode,
  onTranslate,
  onRotate,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [hoveredArc, setHoveredArc] = useState<'x' | 'y' | 'z' | null>(null);

  // Trackball drag tracking
  const [trackballOffset, setTrackballOffset] = useState({ x: 0, y: 0 });
  const trackballOriginRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const trackballPrevRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // Arc rotation angle tracking
  const [arcAngles, setArcAngles] = useState<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });
  const arcAngleDetentRefs = {
    x: useRef(0),
    y: useRef(0),
    z: useRef(0),
  };
  const arcDragRef = useRef<{
    axis: 'x' | 'y' | 'z';
    startAngle: number;
    lastAngle: number;
  } | null>(null);

  // Translation node continuous repeat timer or drag
  const translationDragOriginRef = useRef<{
    nodeId: string;
    axis: 'x' | 'y' | 'z';
    direction: 1 | -1;
    clientX: number;
    clientY: number;
  } | null>(null);

  const [nodeActiveState, setNodeActiveState] = useState<string | null>(null);

  const isFingerPen = accessibilityMode === 'finger-pen';
  const nodePadding = isFingerPen ? 'px-2 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[9px]';
  const trackballSize = isFingerPen ? 'w-18 h-18' : 'w-15 h-15';

  // -------------------------------------------------------------
  // 1. Central Trackball Sphere Handlers (Freeform 3D Rotation)
  // -------------------------------------------------------------
  const handleTrackballPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLocked) {
      haptics.trigger('lock');
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    trackballOriginRef.current = { clientX: e.clientX, clientY: e.clientY };
    trackballPrevRef.current = { clientX: e.clientX, clientY: e.clientY };

    setActiveHandle('trackball');
    haptics.trigger('medium');
    onInteractionStart?.('trackball');
  };

  const handleTrackballPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeHandle !== 'trackball' || !trackballPrevRef.current || !trackballOriginRef.current) return;
    e.preventDefault();

    const deltaX = e.clientX - trackballPrevRef.current.clientX;
    const deltaY = e.clientY - trackballPrevRef.current.clientY;
    trackballPrevRef.current = { clientX: e.clientX, clientY: e.clientY };

    const totalDx = e.clientX - trackballOriginRef.current.clientX;
    const totalDy = e.clientY - trackballOriginRef.current.clientY;

    // Small visual tilt offset for the trackball sphere (clamped to max 14px)
    const clampedOffsetX = Math.max(-14, Math.min(14, totalDx * 0.25));
    const clampedOffsetY = Math.max(-14, Math.min(14, totalDy * 0.25));
    setTrackballOffset({ x: clampedOffsetX, y: clampedOffsetY });

    const rotDelta = computeTrackballRotation(deltaX, deltaY, 0.9);

    // Subtle tactile tick during continuous trackball roll
    if (Math.hypot(deltaX, deltaY) > 2) {
      haptics.trigger('light', 65);
    }

    const payload: RotationEventPayload = {
      rx: Number(rotDelta.deltaRx.toFixed(3)),
      ry: Number(rotDelta.deltaRy.toFixed(3)),
      rz: 0,
      deltaAngle: Math.hypot(rotDelta.deltaRx, rotDelta.deltaRy),
      axis: 'trackball',
      source: '3d-trackball-sphere',
      timestamp: Date.now(),
    };

    console.log('[TransformNavigator 3D] Trackball Freeform Rotation:', {
      deltaRx: rotDelta.deltaRx,
      deltaRy: rotDelta.deltaRy,
    });

    onRotate?.(payload);
  };

  const handleTrackballPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeHandle !== 'trackball') return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setActiveHandle(null);
    trackballOriginRef.current = null;
    trackballPrevRef.current = null;
    setTrackballOffset({ x: 0, y: 0 });
    haptics.trigger('snap');
    onInteractionEnd?.('trackball');
  };

  // -------------------------------------------------------------
  // 2. Translation Nodes (+Y, -Y, +X, -X, +Z, -Z)
  // -------------------------------------------------------------
  const handleNodePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    nodeId: string,
    axis: 'x' | 'y' | 'z',
    direction: 1 | -1
  ) => {
    if (isLocked) {
      haptics.trigger('lock');
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    translationDragOriginRef.current = {
      nodeId,
      axis,
      direction,
      clientX: e.clientX,
      clientY: e.clientY,
    };

    setNodeActiveState(nodeId);
    setActiveHandle(nodeId);
    haptics.trigger('medium');
    onInteractionStart?.(nodeId);

    // Initial nudge step translation
    emitTranslation(axis, direction * 0.1, 0, nodeId);
  };

  const handleNodePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!translationDragOriginRef.current || !nodeActiveState) return;
    e.preventDefault();

    const { nodeId, axis, direction, clientX, clientY } = translationDragOriginRef.current;
    const rawDx = e.clientX - clientX;
    const rawDy = e.clientY - clientY;

    let dragAmount = 0;
    if (axis === 'y') {
      dragAmount = -rawDy * 0.05 * direction;
    } else if (axis === 'x') {
      dragAmount = rawDx * 0.05 * direction;
    } else if (axis === 'z') {
      dragAmount = (rawDx - rawDy) * 0.035 * direction;
    }

    if (Math.abs(dragAmount) > 0.01) {
      haptics.trigger('light', 60);
      emitTranslation(axis, dragAmount, axis === 'x' ? rawDx : rawDy, nodeId);
    }
  };

  const handleNodePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!nodeActiveState) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const currentId = nodeActiveState;
    setNodeActiveState(null);
    setActiveHandle(null);
    translationDragOriginRef.current = null;
    haptics.trigger('light');
    onInteractionEnd?.(currentId);
  };

  const emitTranslation = (
    axis: 'x' | 'y' | 'z',
    amount: number,
    rawDelta: number,
    sourceNode: string
  ) => {
    const payload: TranslationEventPayload = {
      x: axis === 'x' ? amount : 0,
      y: axis === 'y' ? amount : 0,
      z: axis === 'z' ? amount : 0,
      normalizedX: axis === 'x' ? Math.max(-1, Math.min(1, amount)) : 0,
      normalizedY: axis === 'y' ? Math.max(-1, Math.min(1, amount)) : 0,
      normalizedZ: axis === 'z' ? Math.max(-1, Math.min(1, amount)) : 0,
      deltaX: axis === 'x' ? rawDelta : 0,
      deltaY: axis === 'y' ? rawDelta : 0,
      deltaZ: axis === 'z' ? rawDelta : 0,
      source: `3d-node-${sourceNode}`,
      timestamp: Date.now(),
    };

    console.log(`[TransformNavigator 3D] Translation Node [${sourceNode}]:`, payload);
    onTranslate?.(payload);
  };

  // -------------------------------------------------------------
  // 3. Concentric Dashed Rotation Arcs (Rx, Ry, Rz)
  // -------------------------------------------------------------
  const handleArcPointerDown = (
    e: React.PointerEvent<SVGCircleElement | SVGPathElement>,
    axis: 'x' | 'y' | 'z'
  ) => {
    if (isLocked || !dialRef.current) {
      if (isLocked) haptics.trigger('lock');
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angleDeg = normalizeAngleDeg((getAngle(e.clientX - centerX, e.clientY - centerY) * 180) / Math.PI);
    arcDragRef.current = { axis, startAngle: angleDeg, lastAngle: angleDeg };
    arcAngleDetentRefs[axis].current = angleDeg;

    const handleId = `rot-arc-${axis}`;
    setActiveHandle(handleId);
    haptics.trigger('medium');
    onInteractionStart?.(handleId);
  };

  const handleArcPointerMove = (e: React.PointerEvent<SVGCircleElement | SVGPathElement>) => {
    if (!arcDragRef.current || !dialRef.current) return;
    e.preventDefault();

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const currentAngleDeg = normalizeAngleDeg(
      (getAngle(e.clientX - centerX, e.clientY - centerY) * 180) / Math.PI
    );

    let deltaAngle = currentAngleDeg - arcDragRef.current.lastAngle;
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;

    arcDragRef.current.lastAngle = currentAngleDeg;

    const axis = arcDragRef.current.axis;
    const updatedAngle = normalizeAngleDeg(arcAngles[axis] + deltaAngle);
    setArcAngles((prev) => ({
      ...prev,
      [axis]: updatedAngle,
    }));

    // Haptic detent feedback every 15 degrees
    haptics.checkAngleDetent(updatedAngle, arcAngleDetentRefs[axis], 15);

    const payload: RotationEventPayload = {
      rx: axis === 'x' ? Number(deltaAngle.toFixed(2)) : 0,
      ry: axis === 'y' ? Number(deltaAngle.toFixed(2)) : 0,
      rz: axis === 'z' ? Number(deltaAngle.toFixed(2)) : 0,
      deltaAngle: Number(deltaAngle.toFixed(2)),
      axis,
      source: `3d-arc-rot-${axis}`,
      timestamp: Date.now(),
    };

    console.log(`[TransformNavigator 3D] Arc Rotation [Axis ${axis.toUpperCase()}]:`, {
      deltaAngle: Number(deltaAngle.toFixed(2)),
    });

    onRotate?.(payload);
  };

  const handleArcPointerUp = (e: React.PointerEvent<SVGCircleElement | SVGPathElement>) => {
    if (!arcDragRef.current) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const currentHandle = `rot-arc-${arcDragRef.current.axis}`;
    arcDragRef.current = null;
    setActiveHandle(null);
    haptics.trigger('light');
    onInteractionEnd?.(currentHandle);
  };

  // Helper for rendering motion translation node
  const renderTranslationNode = (
    id: string,
    label: string,
    axis: 'x' | 'y' | 'z',
    direction: 1 | -1,
    positionClasses: string,
    colorTheme: 'red' | 'emerald' | 'blue'
  ) => {
    const isActive = nodeActiveState === id;

    const colorConfig = {
      emerald: {
        activeBg: 'bg-white text-zinc-950 border-white shadow-[0_0_18px_rgba(255,255,255,0.4)]',
        inactiveBg: 'bg-[#202024] text-zinc-300 border-white/20 hover:bg-white/10 hover:border-white/40',
        ringColor: 'rgba(16, 185, 129, 0.4)',
      },
      red: {
        activeBg: 'bg-red-500 text-zinc-950 border-red-300 shadow-[0_0_18px_rgba(239,68,68,0.85)]',
        inactiveBg: 'bg-[#202024] text-red-400 border-red-500/40 hover:bg-red-950/40 hover:border-red-400',
        ringColor: 'rgba(239, 68, 68, 0.4)',
      },
      blue: {
        activeBg: 'bg-blue-500 text-zinc-950 border-blue-300 shadow-[0_0_18px_rgba(59,130,246,0.85)]',
        inactiveBg: 'bg-[#202024] text-blue-400 border-blue-500/40 hover:bg-blue-950/40 hover:border-blue-400',
        ringColor: 'rgba(59, 130, 246, 0.4)',
      },
    }[colorTheme];

    return (
      <div className={`absolute z-30 ${positionClasses}`}>
        {/* Animated Spring Active Pulse Halo */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.45, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                boxShadow: `0 0 16px 4px ${colorConfig.ringColor}`,
              }}
            />
          )}
        </AnimatePresence>

        <motion.button
          id={`node-3d-${id}`}
          type="button"
          aria-label={`Translate ${label}`}
          onPointerDown={(e) => handleNodePointerDown(e, id, axis, direction)}
          onPointerMove={handleNodePointerMove}
          onPointerUp={handleNodePointerUp}
          onPointerCancel={handleNodePointerUp}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: isActive ? 1.16 : 1,
            opacity: 1,
          }}
          whileHover={{
            scale: 1.1,
            transition: { type: 'spring', stiffness: 450, damping: 15 },
          }}
          whileTap={{
            scale: 0.92,
            transition: { type: 'spring', stiffness: 500, damping: 18 },
          }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className={`${nodePadding} rounded-full font-bold font-mono tracking-tight border shadow-md flex items-center justify-center cursor-pointer touch-none select-none transition-colors duration-150 ${
            isActive ? colorConfig.activeBg : colorConfig.inactiveBg
          }`}
        >
          {label}
        </motion.button>
      </div>
    );
  };

  return (
    <div
      id="three-dimensional-dial-view"
      ref={dialRef}
      className="relative w-[230px] h-[230px] mx-auto flex items-center justify-center select-none"
    >
      {/* Background Circular Plate */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
        className="absolute inset-0 rounded-full bg-[#131315] border border-white/10 shadow-inner flex items-center justify-center overflow-hidden"
      >
        {/* Subtle Radial Lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />

        {/* Global Reference Grid Crosshairs */}
        <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        <div className="absolute w-full h-[1px] rotate-45 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <div className="absolute w-full h-[1px] -rotate-45 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* Interactive Concentric Dashed Rotation Arcs (Rx, Ry, Rz) SVG  */}
      {/* Color Code: Red (#ef4444) for Rx, Green (#10b981) for Ry, Blue (#3b82f6) for Rz */}
      {/* ------------------------------------------------------------- */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto z-10 overflow-visible"
        viewBox="0 0 200 200"
      >
        <defs>
          <filter id="glow-rz" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-ry" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-rx" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Base Ring */}
        <circle
          cx="100"
          cy="100"
          r="86"
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1"
        />

        {/* Outer Arc: Rz (Roll / Cobalt Blue #3b82f6) */}
        <motion.circle
          id="arc-rotation-rz"
          cx="100"
          cy="100"
          r="76"
          fill="none"
          stroke="#3b82f6"
          strokeDasharray="6 4"
          filter={activeHandle === 'rot-arc-z' || hoveredArc === 'z' ? 'url(#glow-rz)' : undefined}
          animate={{
            strokeWidth: activeHandle === 'rot-arc-z' ? 4 : hoveredArc === 'z' ? 3 : 2,
            strokeOpacity: activeHandle === 'rot-arc-z' ? 1 : hoveredArc === 'z' ? 0.85 : 0.45,
            strokeDashoffset: -arcAngles.z * 0.4,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="cursor-pointer"
          onPointerDown={(e) => handleArcPointerDown(e, 'z')}
          onPointerMove={handleArcPointerMove}
          onPointerUp={handleArcPointerUp}
          onPointerCancel={handleArcPointerUp}
          onMouseEnter={() => setHoveredArc('z')}
          onMouseLeave={() => setHoveredArc(null)}
        />

        {/* Middle Arc: Ry (Yaw / Emerald Green #10b981) */}
        <motion.circle
          id="arc-rotation-ry"
          cx="100"
          cy="100"
          r="62"
          fill="none"
          stroke="#10b981"
          strokeDasharray="5 4"
          filter={activeHandle === 'rot-arc-y' || hoveredArc === 'y' ? 'url(#glow-ry)' : undefined}
          animate={{
            strokeWidth: activeHandle === 'rot-arc-y' ? 4 : hoveredArc === 'y' ? 3 : 2,
            strokeOpacity: activeHandle === 'rot-arc-y' ? 1 : hoveredArc === 'y' ? 0.85 : 0.45,
            strokeDashoffset: -arcAngles.y * 0.35,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="cursor-pointer"
          onPointerDown={(e) => handleArcPointerDown(e, 'y')}
          onPointerMove={handleArcPointerMove}
          onPointerUp={handleArcPointerUp}
          onPointerCancel={handleArcPointerUp}
          onMouseEnter={() => setHoveredArc('y')}
          onMouseLeave={() => setHoveredArc(null)}
        />

        {/* Inner Arc: Rx (Pitch / Studio Red #ef4444) */}
        <motion.circle
          id="arc-rotation-rx"
          cx="100"
          cy="100"
          r="48"
          fill="none"
          stroke="#ef4444"
          strokeDasharray="4 3"
          filter={activeHandle === 'rot-arc-x' || hoveredArc === 'x' ? 'url(#glow-rx)' : undefined}
          animate={{
            strokeWidth: activeHandle === 'rot-arc-x' ? 4 : hoveredArc === 'x' ? 3 : 2,
            strokeOpacity: activeHandle === 'rot-arc-x' ? 1 : hoveredArc === 'x' ? 0.85 : 0.45,
            strokeDashoffset: -arcAngles.x * 0.3,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="cursor-pointer"
          onPointerDown={(e) => handleArcPointerDown(e, 'x')}
          onPointerMove={handleArcPointerMove}
          onPointerUp={handleArcPointerUp}
          onPointerCancel={handleArcPointerUp}
          onMouseEnter={() => setHoveredArc('x')}
          onMouseLeave={() => setHoveredArc(null)}
        />
      </svg>

      {/* ------------------------------------------------------------- */}
      {/* Central Trackball Sphere (Orbit Freeform Rotation)           */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        id="handle-3d-trackball"
        role="button"
        tabIndex={0}
        aria-label="3D Freeform Trackball Orbit Sphere"
        title="Freeform Trackball 3D Rotation"
        style={{
          transform: `translate3d(${trackballOffset.x}px, ${trackballOffset.y}px, 0)`,
        }}
        onPointerDown={handleTrackballPointerDown}
        onPointerMove={handleTrackballPointerMove}
        onPointerUp={handleTrackballPointerUp}
        onPointerCancel={handleTrackballPointerUp}
        whileHover={{
          scale: 1.06,
          transition: { type: 'spring', stiffness: 400, damping: 20 },
        }}
        whileTap={{
          scale: 0.95,
          transition: { type: 'spring', stiffness: 500, damping: 20 },
        }}
        animate={{
          scale: activeHandle === 'trackball' ? 1.08 : 1,
          borderColor: activeHandle === 'trackball' ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
          boxShadow:
            activeHandle === 'trackball'
              ? '0 0 28px rgba(255,255,255,0.4), inset 0 0 12px rgba(255,255,255,0.3)'
              : '0 10px 25px rgba(0,0,0,0.5)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`relative z-20 ${trackballSize} rounded-full bg-[radial-gradient(circle_at_35%_35%,#323238_0%,#18181b_70%,#0e0e10_100%)] border-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none`}
      >
        {/* Subtle Orbit / Compass Icon */}
        <motion.div
          animate={{
            rotate: activeHandle === 'trackball' ? 45 : 0,
            scale: activeHandle === 'trackball' ? 1.05 : 1,
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          className="w-[78%] h-[78%] rounded-full bg-[#151517] border border-white/10 flex items-center justify-center text-zinc-300"
        >
          <Orbit
            className={`w-4 h-4 transition-colors duration-200 ${
              activeHandle === 'trackball' ? 'text-white' : 'text-zinc-400'
            }`}
          />
        </motion.div>
      </motion.div>

      {/* ------------------------------------------------------------- */}
      {/* Uniform Pill Translation Nodes on Perimeter                   */}
      {/* Color Code: Studio Red (#ef4444) for X, Emerald Green (#10b981) for Y, Cobalt Blue (#3b82f6) for Z */}
      {/* ------------------------------------------------------------- */}

      {/* +Y Node (Top) -> Emerald Green */}
      {renderTranslationNode('trans-py', '+Y', 'y', 1, 'top-1 left-1/2 -translate-x-1/2', 'emerald')}

      {/* -Y Node (Bottom) -> Emerald Green */}
      {renderTranslationNode('trans-ny', '-Y', 'y', -1, 'bottom-1 left-1/2 -translate-x-1/2', 'emerald')}

      {/* -X Node (Left) -> Studio Red */}
      {renderTranslationNode('trans-nx', '-X', 'x', -1, 'top-1/2 left-1 -translate-y-1/2', 'red')}

      {/* +X Node (Right) -> Studio Red */}
      {renderTranslationNode('trans-px', '+X', 'x', 1, 'top-1/2 right-1 -translate-y-1/2', 'red')}

      {/* +Z Node (Top-Right) -> Cobalt Blue */}
      {renderTranslationNode('trans-pz', '+Z', 'z', 1, 'top-3 right-3', 'blue')}

      {/* -Z Node (Bottom-Left) -> Cobalt Blue */}
      {renderTranslationNode('trans-nz', '-Z', 'z', -1, 'bottom-3 left-3', 'blue')}
    </div>
  );
};
