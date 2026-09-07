import React, { useState, useRef, useCallback } from 'react';
import { ThreeTrackball } from '../ThreeTrackball';
import { playHapticSound } from '../../utils/audio';
import {
  TranslationEventPayload,
  RotationEventPayload,
  AccessibilityMode,
} from '../../types';
import { Compass, Move, Disc, ZoomIn, RotateCcw } from 'lucide-react';

interface TactileNavigatorDialProps {
  isLocked?: boolean;
  accessibilityMode?: AccessibilityMode;
  onTranslate?: (data: TranslationEventPayload) => void;
  onRotate?: (data: RotationEventPayload) => void;
  onInteractionStart?: (handleName: string) => void;
  onInteractionEnd?: (handleName: string) => void;
  engine?: any;
}

type SubWheelMode = 'trackball' | 'joystick' | 'radial' | 'zoom';

export const TactileNavigatorDial: React.FC<TactileNavigatorDialProps> = ({
  isLocked = false,
  onTranslate,
  onRotate,
  onInteractionStart,
  onInteractionEnd,
  engine,
}) => {
  const [subMode, setSubMode] = useState<SubWheelMode>('trackball');
  const [activeAxis, setActiveAxis] = useState<'all' | 'x' | 'y' | 'z'>('all');
  const [pitch, setPitch] = useState<number>(18);
  const [yaw, setYaw] = useState<number>(-24);
  const [soundEnabled] = useState<boolean>(true);

  // 3D Trackball Rotation handler
  const handleTrackballRotate = useCallback(
    (deltaYaw: number, deltaPitch: number) => {
      if (isLocked) return;
      setYaw((prev) => (prev + deltaYaw) % 360);
      setPitch((prev) => Math.max(-89, Math.min(89, prev + deltaPitch)));

      onInteractionStart?.('trackball-rotate');

      if (onRotate) {
        onRotate({
          rx: deltaPitch,
          ry: deltaYaw,
          rz: 0,
          deltaAngle: Math.hypot(deltaYaw, deltaPitch),
          axis: activeAxis === 'all' ? 'trackball' : (activeAxis as any),
          source: 'tactile-trackball',
          timestamp: performance.now(),
        });
      }

      if (engine) {
        if (activeAxis === 'all') {
          engine.orbitCamera(-deltaYaw * 0.015, -deltaPitch * 0.015);
        } else {
          const axisRad = (deltaYaw * Math.PI) / 180;
          engine.rotateAxis3D(activeAxis, axisRad, 'all');
        }
      }

      onInteractionEnd?.('trackball-rotate');
    },
    [isLocked, activeAxis, onRotate, onInteractionStart, onInteractionEnd, engine]
  );

  // 2D Joystick Physics
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const [joystickOffset, setJoystickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingJoystickRef = useRef<boolean>(false);
  const joystickCenterRef = useRef<{ cx: number; cy: number }>({ cx: 0, cy: 0 });

  const handleJoystickPointerDown = (e: React.PointerEvent) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    if (!joystickContainerRef.current) return;
    const rect = joystickContainerRef.current.getBoundingClientRect();
    joystickCenterRef.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    isDraggingJoystickRef.current = true;
    onInteractionStart?.('joystick-translate');
    playHapticSound('click', soundEnabled);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleJoystickPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingJoystickRef.current || isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - joystickCenterRef.current.cx;
    const dy = e.clientY - joystickCenterRef.current.cy;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 42;
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const cx = Math.cos(angle) * clampedDist;
    const cy = Math.sin(angle) * clampedDist;

    setJoystickOffset({ x: cx, y: cy });

    const normX = cx / maxRadius;
    const normY = -cy / maxRadius;

    if (onTranslate) {
      onTranslate({
        x: normX * 0.05,
        y: normY * 0.05,
        z: 0,
        normalizedX: normX,
        normalizedY: normY,
        normalizedZ: 0,
        deltaX: normX * 0.02,
        deltaY: normY * 0.02,
        deltaZ: 0,
        source: 'tactile-joystick',
        timestamp: performance.now(),
      });
    }

    if (engine) {
      engine.translateScreenSpace(cx * 0.002, -cy * 0.002, 'all');
    }
  };

  const handleJoystickPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingJoystickRef.current) return;
    isDraggingJoystickRef.current = false;
    setJoystickOffset({ x: 0, y: 0 });
    onInteractionEnd?.('joystick-translate');
    playHapticSound('pop', soundEnabled);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  return (
    <div className="w-full flex flex-col items-center select-none text-xs">
      {/* Submode switcher bar */}
      <div className="w-full grid grid-cols-4 gap-1 mb-1.5 text-[9.5px] font-semibold">
        {(
          [
            ['trackball', '3D Ball', Disc],
            ['joystick', 'Move', Move],
            ['radial', 'Orbit', Compass],
            ['zoom', 'Zoom', ZoomIn],
          ] as const
        ).map(([mKey, label, IconComponent]) => (
          <button
            key={mKey}
            type="button"
            onClick={() => {
              setSubMode(mKey);
              playHapticSound('click', soundEnabled);
            }}
            className={`py-1 px-1 rounded-md flex items-center justify-center gap-1 transition-all ${
              subMode === mKey
                ? 'bg-white text-zinc-950 font-bold shadow-sm'
                : 'bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
            }`}
          >
            <IconComponent className="w-3 h-3 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Main Interactive Dial Container - Unified 230px circle matching 2D Dial and 3D Spatial */}
      <div className="relative w-[230px] h-[230px] flex items-center justify-center bg-[#0d0e12] rounded-full border border-white/[0.08] shadow-inner overflow-hidden">
        {/* 1. 3D Trackball Mode */}
        {subMode === 'trackball' && (
          <ThreeTrackball
            yaw={yaw}
            pitch={pitch}
            onRotate={handleTrackballRotate}
            soundEnabled={soundEnabled}
            size={200}
          />
        )}

        {/* 2. 2D Spring Joystick Mode */}
        {subMode === 'joystick' && (
          <div
            ref={joystickContainerRef}
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            className="relative w-full h-full flex items-center justify-center cursor-pointer touch-none"
          >
            <div className="absolute inset-x-6 h-[1px] bg-zinc-800 pointer-events-none" />
            <div className="absolute inset-y-6 w-[1px] bg-zinc-800 pointer-events-none" />
            <div className="absolute w-24 h-24 rounded-full border border-dashed border-zinc-700/60 pointer-events-none" />

            <div
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 border-2 border-white/50 shadow-2xl flex flex-col items-center justify-center text-[10px] font-bold text-white transition-transform duration-75 pointer-events-none"
              style={{
                transform: `translate(${joystickOffset.x}px, ${joystickOffset.y}px)`,
              }}
            >
              <Move className="w-3.5 h-3.5 mb-0.5 text-white" />
              <span>MOVE</span>
            </div>
          </div>
        )}

        {/* 3. Radial Orbit Views Mode */}
        {subMode === 'radial' && (
          <div className="flex flex-col items-center justify-center gap-2 p-3 w-full h-full text-center">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Quick Snap Views</span>
            <div className="grid grid-cols-2 gap-1.5 w-full max-w-[170px]">
              <button
                type="button"
                onClick={() => engine?.snapToView('front')}
                className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white hover:text-zinc-950 text-zinc-300 text-[11px] font-semibold transition-all"
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => engine?.snapToView('top')}
                className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white hover:text-zinc-950 text-zinc-300 text-[11px] font-semibold transition-all"
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => engine?.snapToView('right')}
                className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white hover:text-zinc-950 text-zinc-300 text-[11px] font-semibold transition-all"
              >
                Right
              </button>
              <button
                type="button"
                onClick={() => engine?.snapToView('isometric')}
                className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white hover:text-zinc-950 text-zinc-300 text-[11px] font-semibold transition-all"
              >
                Isometric
              </button>
            </div>
          </div>
        )}

        {/* 4. Zoom Slider Mode */}
        {subMode === 'zoom' && (
          <div className="flex flex-col items-center justify-center gap-3 p-3 w-full h-full">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Camera Zoom</span>
            <div className="flex items-center gap-2 w-full max-w-[170px]">
              <button
                type="button"
                onClick={() => {
                  engine?.zoomCamera(0.4);
                  playHapticSound('click', soundEnabled);
                }}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-base transition flex items-center justify-center"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => {
                  engine?.snapToView('isometric');
                  playHapticSound('snap', soundEnabled);
                }}
                className="flex-1 py-2 rounded-xl bg-white text-zinc-950 font-bold text-[11px] transition shadow"
              >
                1:1 Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  engine?.zoomCamera(-0.4);
                  playHapticSound('click', soundEnabled);
                }}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-base transition flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Axis Selection & Reset Controls */}
      <div className="w-full flex items-center justify-between pt-1.5 mt-1.5 border-t border-white/[0.06] text-[9.5px]">
        <span className="text-zinc-400 font-mono">Axis:</span>
        <div className="flex items-center gap-1">
          {(['all', 'x', 'y', 'z'] as const).map((ax) => (
            <button
              key={ax}
              type="button"
              onClick={() => setActiveAxis(ax)}
              className={`px-1.5 py-0.5 rounded font-mono uppercase transition ${
                activeAxis === ax
                  ? 'bg-white text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-white bg-white/5'
              }`}
            >
              {ax}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            engine?.resetTransform('all');
            engine?.snapToView('isometric');
            setYaw(-24);
            setPitch(18);
            playHapticSound('snap', soundEnabled);
          }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 font-medium transition"
        >
          <RotateCcw className="w-3 h-3 text-zinc-400" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
