// src/components/SpatialNavGizmo.tsx
import React, { useState, useRef } from 'react';
import {
  Lock,
  Unlock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Move,
  RotateCw,
  Check,
  Compass,
  Maximize2,
  MoveVertical,
  MoveHorizontal,
} from 'lucide-react';
import { StudioEngine } from '../core/studioEngine';
import { TransformTargetScope, Guide3D } from '../types';

interface SpatialNavGizmoProps {
  engine: StudioEngine | null;
  isOpen?: boolean;
  onClose?: () => void;
  cameraSpherical?: { radius: number; theta: number; phi: number };
  onOrbitCamera?: (deltaTheta: number, deltaPhi: number) => void;
  onSetCameraView?: (theta: number, phi: number, radius?: number) => void;
  onZoomCamera?: (deltaRadius: number) => void;
  activeGuide?: Guide3D | null;
  onUpdateGuide?: (guide: Guide3D | null) => void;
  activeLayerName?: string;
}

type ViewMode = '2d' | '3d';

export const SpatialNavGizmo: React.FC<SpatialNavGizmoProps> = ({
  engine,
  isOpen = true,
  cameraSpherical = { radius: 3.5, theta: Math.PI / 4, phi: Math.PI / 3 },
  onOrbitCamera,
  onSetCameraView,
  onZoomCamera,
  activeLayerName = 'Main Curves',
}) => {
  const [mode, setMode] = useState<ViewMode>('2d');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [targetScope, setTargetScope] = useState<TransformTargetScope | 'camera'>('strokes');
  const [showScopeDropdown, setShowScopeDropdown] = useState<boolean>(false);

  // Widget positioning
  const [customPosition, setCustomPosition] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isDraggingHeaderRef = useRef(false);
  const dragHeaderStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Active interaction tracking
  const [activeInteraction, setActiveInteraction] = useState<string | null>(null);
  const activeInteractionRef = useRef<string | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const totalDragDistanceRef = useRef<number>(0);

  // Drag Handling (Repositioning)
  const handleStartMoveWidget = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, svg.interactive-node')) return;
    e.preventDefault();
    isDraggingHeaderRef.current = true;

    let currentX = customPosition ? customPosition.x : 0;
    let currentY = customPosition ? customPosition.y : 0;

    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      currentX = rect.left;
      currentY = rect.top;
    } else if (!customPosition) {
      const defaultW = window.innerWidth < 640 ? 200 : 230;
      const defaultH = window.innerWidth < 640 ? 320 : 360;
      currentX = Math.max(10, window.innerWidth - defaultW);
      currentY = Math.max(10, window.innerHeight - defaultH);
    }

    dragHeaderStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: currentX,
      posY: currentY,
    };

    const handleWindowHeaderMove = (moveEvt: PointerEvent) => {
      if (!isDraggingHeaderRef.current) return;
      const dx = moveEvt.clientX - dragHeaderStartRef.current.startX;
      const dy = moveEvt.clientY - dragHeaderStartRef.current.startY;
      const widgetWidth = window.innerWidth < 640 ? 196 : 220;
      const newX = Math.max(6, Math.min(window.innerWidth - widgetWidth - 6, dragHeaderStartRef.current.posX + dx));
      const newY = Math.max(6, Math.min(window.innerHeight - 60, dragHeaderStartRef.current.posY + dy));
      setCustomPosition({ x: newX, y: newY });
    };

    const handleWindowHeaderUp = () => {
      isDraggingHeaderRef.current = false;
      window.removeEventListener('pointermove', handleWindowHeaderMove);
      window.removeEventListener('pointerup', handleWindowHeaderUp);
    };

    window.addEventListener('pointermove', handleWindowHeaderMove);
    window.addEventListener('pointerup', handleWindowHeaderUp);
  };

  // Interaction Handler
  const handleNodePointerDown = (type: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    activeInteractionRef.current = type;
    setActiveInteraction(type);
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    totalDragDistanceRef.current = 0;

    if (engine && targetScope !== 'camera') {
      engine.beginTransform(targetScope as TransformTargetScope);
    }

    const handleWindowMove = (moveEvt: PointerEvent) => {
      if (!activeInteractionRef.current) return;

      const dx = moveEvt.clientX - lastPointerPosRef.current.x;
      const dy = moveEvt.clientY - lastPointerPosRef.current.y;
      totalDragDistanceRef.current += Math.abs(dx) + Math.abs(dy);
      lastPointerPosRef.current = { x: moveEvt.clientX, y: moveEvt.clientY };

      const action = activeInteractionRef.current;

      if (action === 'center-3d') {
        if (targetScope === 'camera' || !engine) {
          if (onOrbitCamera) {
            onOrbitCamera(-dx * 0.015, -dy * 0.015);
          } else if (engine) {
            engine.orbit(dx, dy);
          }
        } else {
          engine.rotateTrackball(dx, dy, targetScope as TransformTargetScope);
        }
      } else if (action === 'axis-y-top' || action === 'axis-y-bottom') {
        if (engine && targetScope !== 'camera') {
          engine.translateAxis3D('y', -dy * 0.02, targetScope as TransformTargetScope);
        } else {
          if (onOrbitCamera) onOrbitCamera(0, dy * 0.015);
          else if (engine) engine.orbit(0, dy * 2);
        }
      } else if (action === 'axis-x-right' || action === 'axis-x-left') {
        if (engine && targetScope !== 'camera') {
          engine.translateAxis3D('x', dx * 0.02, targetScope as TransformTargetScope);
        } else {
          if (onOrbitCamera) onOrbitCamera(-dx * 0.015, 0);
          else if (engine) engine.orbit(dx * 2, 0);
        }
      } else if (action === 'axis-z-front' || action === 'axis-z-back') {
        if (engine && targetScope !== 'camera') {
          engine.translateAxis3D('z', (dx - dy) * 0.02, targetScope as TransformTargetScope);
        } else {
          const deltaZoom = (dx - dy) * 0.02;
          if (onZoomCamera) onZoomCamera(-deltaZoom * 2);
          else if (engine) engine.zoom(-deltaZoom * 100);
        }
      } else if (action === 'center-2d-move') {
        // Center Move in 2D view
        if (engine && targetScope !== 'camera') {
          engine.translateScreenSpace(dx, dy, targetScope as TransformTargetScope, isLocked);
        } else if (engine) {
          engine.pan(dx, dy);
        }
      } else if (action === 'node-2d-scale-y') {
        // Vertical stretch along Y
        const delta = -dy * 0.02;
        if (engine && targetScope !== 'camera') {
          engine.scaleAxis('y', 1 + delta, targetScope as TransformTargetScope);
        } else if (engine) {
          engine.zoom(-delta * 100);
        }
      } else if (action === 'node-2d-scale-x') {
        // Horizontal stretch along X
        const delta = dx * 0.02;
        if (engine && targetScope !== 'camera') {
          engine.scaleAxis('x', 1 + delta, targetScope as TransformTargetScope);
        } else if (engine) {
          engine.zoom(-delta * 100);
        }
      } else if (action === 'node-2d-scale-uniform') {
        // Diagonal Uniform Scale
        const delta = (dx - dy) * 0.018;
        const factor = 1 + delta;
        if (engine && targetScope !== 'camera') {
          engine.scaleAxis('uniform', factor, targetScope as TransformTargetScope);
        } else {
          if (onZoomCamera) onZoomCamera(-delta * 3);
          else if (engine) engine.zoom(-delta * 120);
        }
      } else if (action === 'node-2d-rotate') {
        // Clockwise/counter-clockwise screen rotate
        const rad = (dx + dy) * 0.03;
        if (engine && targetScope !== 'camera') {
          engine.rotateAxis3D('z', rad, targetScope as TransformTargetScope, isLocked);
        } else if (engine) {
          engine.orbit(dx * 1.5, 0);
        }
      }
    };

    const handleWindowUp = (upEvt: PointerEvent) => {
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('pointerup', handleWindowUp);

      const action = activeInteractionRef.current;
      activeInteractionRef.current = null;
      setActiveInteraction(null);

      if (totalDragDistanceRef.current < 8) {
        if (action === 'axis-y-top') {
          if (onSetCameraView) onSetCameraView(0, 0.001);
          else engine?.snapToView('top');
        } else if (action === 'axis-y-bottom') {
          if (onSetCameraView) onSetCameraView(0, Math.PI - 0.001);
          else engine?.snapToView('bottom');
        } else if (action === 'axis-x-right') {
          if (onSetCameraView) onSetCameraView(Math.PI / 2, Math.PI / 2);
          else engine?.snapToView('right');
        } else if (action === 'axis-x-left') {
          if (onSetCameraView) onSetCameraView(-Math.PI / 2, Math.PI / 2);
          else engine?.snapToView('left');
        } else if (action === 'axis-z-front') {
          if (onSetCameraView) onSetCameraView(0, Math.PI / 2);
          else engine?.snapToView('front');
        } else if (action === 'axis-z-back') {
          if (onSetCameraView) onSetCameraView(Math.PI, Math.PI / 2);
          else engine?.snapToView('back');
        }
      }

      if (engine && targetScope !== 'camera') {
        engine.endTransform();
      }
    };

    window.addEventListener('pointermove', handleWindowMove);
    window.addEventListener('pointerup', handleWindowUp);
  };

  const handleReset = () => {
    if (targetScope === 'camera' || !engine) {
      if (onSetCameraView) {
        onSetCameraView(Math.PI / 4, Math.PI / 3, 3.5);
      } else if (engine) {
        engine.snapToView('isometric');
      }
    } else {
      engine.resetTransform(targetScope as TransformTargetScope);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={
        customPosition
          ? {
              position: 'fixed',
              left: `${customPosition.x}px`,
              top: `${customPosition.y}px`,
              zIndex: 30,
            }
          : undefined
      }
      className={
        customPosition
          ? ''
          : 'fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-30 flex flex-col items-end select-none'
      }
    >
      {isMinimized ? (
        /* MINIMIZED COMPACT PILL */
        <div
          ref={cardRef}
          onPointerDown={handleStartMoveWidget}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#18191d] border border-[#2b2c32] text-[#e2e4ea] shadow-2xl cursor-grab active:cursor-grabbing touch-none select-none transition-all"
        >
          <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
          <span className="text-[11px] sm:text-xs font-mono font-bold tracking-wider">NAV GIZMO</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
            }}
            className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Expand Gizmo"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* EXPANDED MONOCHROME PRECISION CAD GIZMO - LESS ROUND */
        <div
          ref={cardRef}
          className="w-[196px] sm:w-[214px] bg-[#18191d] text-[#e2e4ea] border border-[#2b2c32] rounded-2xl shadow-2xl p-2 sm:p-2.5 flex flex-col gap-2 relative select-none"
        >
          {/* Top Drag Handle Grip */}
          <div
            onPointerDown={handleStartMoveWidget}
            className="w-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none -mt-1 py-0.5"
            title="Drag to reposition gizmo"
          >
            <div className="w-7 h-1 bg-[#2e3038] hover:bg-[#40434e] rounded-full transition-colors" />
          </div>

          {/* 1. TOP HEADER: MODE TOGGLE & QUICK ACTIONS */}
          <div
            onPointerDown={handleStartMoveWidget}
            className="flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing touch-none pb-0.5"
          >
            {/* Pill Capsule (2D View | 3D Spatial) */}
            <div className="flex items-center bg-[#121316] p-0.5 rounded-xl border border-[#27282f] flex-1 max-w-[136px] h-8">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMode('2d');
                }}
                className={`flex-1 h-full rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                  mode === '2d'
                    ? 'bg-neutral-100 text-black shadow-sm font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                2D View
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMode('3d');
                }}
                className={`flex-1 h-full rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                  mode === '3d'
                    ? 'bg-neutral-100 text-black shadow-sm font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                3D Spatial
              </button>
            </div>

            {/* Header Right Action Icons */}
            <div className="flex items-center gap-0.5 text-neutral-400">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLocked(!isLocked);
                }}
                className={`p-1.5 rounded-lg hover:text-white transition-colors ${
                  isLocked ? 'text-white bg-white/10' : 'hover:bg-white/5'
                }`}
                title={isLocked ? 'Constraints Locked' : 'Lock Proportions'}
              >
                {isLocked ? (
                  <Lock className="w-3.5 h-3.5 stroke-[2]" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 stroke-[1.8]" />
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[1.8]" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(true);
                }}
                className="p-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-colors"
                title="Minimize Gizmo"
              >
                <ChevronDown className="w-3.5 h-3.5 stroke-[1.8]" />
              </button>
            </div>
          </div>

          {/* 2. SUBHEADER: TARGET SCOPE LABEL */}
          <div className="flex items-center justify-between px-1 text-xs -mt-1">
            <span className="text-neutral-300 font-medium text-[11px] truncate max-w-[105px]">
              {targetScope === 'strokes'
                ? 'Main Curves'
                : targetScope === 'model'
                ? '3D Model'
                : targetScope === 'active_layer'
                ? activeLayerName
                : targetScope === 'camera'
                ? 'Camera'
                : 'Main Curves'}
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowScopeDropdown(!showScopeDropdown);
                }}
                className="text-neutral-900 dark:text-zinc-300 hover:text-neutral-700 dark:hover:text-white font-semibold text-[11px] transition-colors"
              >
                Select Group
              </button>

              {showScopeDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-[#141519] border border-[#2b2c32] rounded-xl shadow-2xl py-1 z-50 text-xs text-white">
                  {[
                    { id: 'strokes', label: 'Main Curves' },
                    { id: 'model', label: '3D Model' },
                    { id: 'camera', label: 'Camera View' },
                    { id: 'all', label: 'All Objects' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetScope(item.id as any);
                        setShowScopeDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between text-[11px] hover:bg-white/10 transition-colors ${
                        targetScope === item.id ? 'text-white font-bold' : 'text-neutral-400'
                      }`}
                    >
                      <span>{item.label}</span>
                      {targetScope === item.id && <Check className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. CENTER DIAL: 2D VIEW RADAR OR 3D SPATIAL GIZMO */}
          <div className="w-full aspect-square bg-[#121316] rounded-xl border border-[#27282f] relative flex items-center justify-center overflow-hidden touch-none select-none">
            {mode === '2d' ? (
              /* ======================= RESTORED 2D VIEW MODE ======================= */
              <div className="w-full h-full relative flex items-center justify-center p-1">
                {/* SVG Concentric Guides & Crosshairs */}
                <svg className="w-full h-full pointer-events-none absolute inset-0" viewBox="0 0 190 190">
                  <circle cx="95" cy="95" r="74" fill="none" stroke="#252730" strokeWidth="1.2" />
                  <circle cx="95" cy="95" r="54" fill="none" stroke="#252730" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx="95" cy="95" r="34" fill="none" stroke="#252730" strokeWidth="1" />
                  <line x1="95" y1="12" x2="95" y2="178" stroke="#1e2027" strokeWidth="1" />
                  <line x1="12" y1="95" x2="178" y2="95" stroke="#1e2027" strokeWidth="1" />
                </svg>

                {/* Top Node (12 o'clock): Vertical Scale Handle */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('node-2d-scale-y', e)}
                  className={`absolute top-2.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-ns-resize z-20 ${
                    activeInteraction === 'node-2d-scale-y' ? 'ring-2 ring-neutral-400 scale-110' : ''
                  }`}
                  title="Drag to Stretch / Scale Vertically"
                >
                  <MoveVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                {/* Left Node (9 o'clock): Horizontal Scale Handle */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('node-2d-scale-x', e)}
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-ew-resize z-20 ${
                    activeInteraction === 'node-2d-scale-x' ? 'ring-2 ring-neutral-400 scale-110' : ''
                  }`}
                  title="Drag to Stretch / Scale Horizontally"
                >
                  <MoveHorizontal className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                {/* Upper Left Node (~10:30): Diagonal Uniform Scale Handle */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('node-2d-scale-uniform', e)}
                  className={`absolute top-6 left-6 w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-nwse-resize z-20 ${
                    activeInteraction === 'node-2d-scale-uniform' ? 'ring-2 ring-neutral-400 scale-110' : ''
                  }`}
                  title="Drag to Uniform Scale"
                >
                  <Maximize2 className="w-3 h-3 stroke-[2.5]" />
                </button>

                {/* Right Node (3 o'clock): Screen Rotate Handle */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('node-2d-rotate', e)}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white text-black font-bold flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer z-20 ${
                    activeInteraction === 'node-2d-rotate' ? 'ring-2 ring-neutral-400 scale-110' : ''
                  }`}
                  title="Drag to Rotate View / Group"
                >
                  <RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                {/* Center Node: MOVE Circular Button */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('center-2d-move', e)}
                  className={`w-14 h-14 rounded-full bg-[#20222a] hover:bg-[#2a2c35] border border-[#383a48] flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-all shadow-lg z-20 ${
                    activeInteraction === 'center-2d-move' ? 'ring-2 ring-white bg-white text-black' : 'text-neutral-200'
                  }`}
                  title="Drag to Pan View / Screen Move"
                >
                  <Move className="w-4 h-4 stroke-[2]" />
                  <span className="text-[8.5px] font-extrabold mt-0.5 tracking-wider font-mono">MOVE</span>
                </button>
              </div>
            ) : (
              /* ======================= MONOCHROME 3D SPATIAL MODE ======================= */
              <div className="w-full h-full relative flex items-center justify-center">
                {/* SVG Concentric Multi-Ring Gyroscope Arcs */}
                <svg className="w-full h-full pointer-events-none absolute inset-0" viewBox="0 0 190 190">
                  <circle cx="95" cy="95" r="74" fill="none" stroke="#252730" strokeWidth="1.2" />
                  <circle cx="95" cy="95" r="56" fill="none" stroke="#252730" strokeWidth="1" strokeDasharray="4 4" />
                  <circle cx="95" cy="95" r="38" fill="none" stroke="#252730" strokeWidth="1" />
                  <line x1="95" y1="15" x2="95" y2="175" stroke="#1f2128" strokeWidth="1" />
                  <line x1="15" y1="95" x2="175" y2="95" stroke="#1f2128" strokeWidth="1" />
                </svg>

                {/* +Y Top Snap */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('axis-y-top', e)}
                  className={`absolute top-2 left-1/2 -translate-x-1/2 bg-[#22242c] hover:bg-[#2e303b] border border-[#353744] text-neutral-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer z-20 ${
                    activeInteraction === 'axis-y-top' ? 'ring-2 ring-white scale-105 bg-neutral-200 text-black' : ''
                  }`}
                  title="+Y (Top View)"
                >
                  +Y
                </button>

                {/* -Y Bottom Snap */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('axis-y-bottom', e)}
                  className={`absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#22242c] hover:bg-[#2e303b] border border-[#353744] text-neutral-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer z-20 ${
                    activeInteraction === 'axis-y-bottom' ? 'ring-2 ring-white scale-105 bg-neutral-200 text-black' : ''
                  }`}
                  title="-Y (Bottom View)"
                >
                  -Y
                </button>

                {/* +X Right Snap */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('axis-x-right', e)}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#22242c] hover:bg-[#2e303b] border border-[#353744] text-neutral-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer z-20 ${
                    activeInteraction === 'axis-x-right' ? 'ring-2 ring-white scale-105 bg-neutral-200 text-black' : ''
                  }`}
                  title="+X (Right View)"
                >
                  +X
                </button>

                {/* -X Left Snap */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('axis-x-left', e)}
                  className={`absolute left-1.5 top-1/2 -translate-y-1/2 bg-[#22242c] hover:bg-[#2e303b] border border-[#353744] text-neutral-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer z-20 ${
                    activeInteraction === 'axis-x-left' ? 'ring-2 ring-white scale-105 bg-neutral-200 text-black' : ''
                  }`}
                  title="-X (Left View)"
                >
                  -X
                </button>

                {/* +Z Upper Right Snap */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('axis-z-front', e)}
                  className={`absolute top-4 right-4 bg-[#22242c] hover:bg-[#2e303b] border border-[#353744] text-neutral-200 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer z-20 ${
                    activeInteraction === 'axis-z-front' ? 'ring-2 ring-white scale-105 bg-neutral-200 text-black' : ''
                  }`}
                  title="+Z (Front View)"
                >
                  +Z
                </button>

                {/* -Z Lower Left Snap */}
                <button
                  type="button"
                  onPointerDown={(e) => handleNodePointerDown('axis-z-back', e)}
                  className={`absolute bottom-4 left-4 bg-[#22242c] hover:bg-[#2e303b] border border-[#353744] text-neutral-200 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer z-20 ${
                    activeInteraction === 'axis-z-back' ? 'ring-2 ring-white scale-105 bg-neutral-200 text-black' : ''
                  }`}
                  title="-Z (Back View)"
                >
                  -Z
                </button>

                {/* Central Free Trackball Sphere */}
                <div
                  onPointerDown={(e) => handleNodePointerDown('center-3d', e)}
                  className={`w-13 h-13 rounded-full bg-gradient-to-br from-[#2a2c34] via-[#1a1b20] to-[#121316] border border-[#3d404d] shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-all z-30 ${
                    activeInteraction === 'center-3d' ? 'ring-2 ring-white scale-105' : ''
                  }`}
                  title="Drag to Free-Orbit Camera / Trackball"
                >
                  <Compass className="w-5 h-5 text-neutral-300 stroke-[1.5]" />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Precision Caption */}
          <div className="text-center text-[9px] font-mono text-neutral-400 tracking-tight">
            Screen View Aligned • Center Crosshair
          </div>
        </div>
      )}
    </div>
  );
};

