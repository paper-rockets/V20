import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Compass, RotateCcw, Minus, Maximize2, Camera, Layers } from 'lucide-react';
import { StudioEngine } from '../../core/studioEngine';
import { TransformTargetScope } from '../../types';
import { getCameraPose, subscribeCameraPose } from '../../core/telemetryStore';
import './navigatorStyles.css';

export interface Option1TabbedNavigatorProps {
  engine?: StudioEngine | null;
  theme?: 'light' | 'dark';
  targetScope?: TransformTargetScope;
  onSelectTargetScope?: (scope: TransformTargetScope) => void;
  isLocked?: boolean;
  onLockChange?: (locked: boolean) => void;
  onClose?: () => void;
  uiScale?: number;
}

interface AxisDef {
  dir: [number, number, number];
  col: string;
  lbl: string;
  viewName: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';
}

const AXES: AxisDef[] = [
  { dir: [0, 1, 0], col: '#f4f4f5', lbl: 'Y', viewName: 'top' },
  { dir: [0, -1, 0], col: '#777a80', lbl: '-Y', viewName: 'bottom' },
  { dir: [-1, 0, 0], col: '#b8bac0', lbl: 'X', viewName: 'left' },
  { dir: [1, 0, 0], col: '#b8bac0', lbl: '-X', viewName: 'right' },
  { dir: [0, 0, 1], col: '#d4d5d8', lbl: 'Z', viewName: 'front' },
  { dir: [0, 0, -1], col: '#8b8e94', lbl: '-Z', viewName: 'back' },
];

export const Option1TabbedNavigator: React.FC<Option1TabbedNavigatorProps> = ({
  engine,
  theme = 'dark',
  targetScope: propTargetScope = 'all',
  onSelectTargetScope,
  isLocked = false,
  uiScale = 1.0,
}) => {
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<'camera' | 'surface'>('camera');
  const [targetScope, setTargetScope] = useState<TransformTargetScope>(propTargetScope);

  useEffect(() => {
    if (propTargetScope) {
      setTargetScope(propTargetScope);
    }
  }, [propTargetScope]);

  const handleSelectScope = useCallback(
    (scope: TransformTargetScope) => {
      setTargetScope(scope);
      if (onSelectTargetScope) {
        onSelectTargetScope(scope);
      }
    },
    [onSelectTargetScope]
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('paperrocket_nav_expanded');
      if (saved !== null) return saved === 'true';
    } catch (_) {}
    return false;
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Position state (persisted to localStorage, clamped to screen bounds)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultWidth = 232;
    const defaultHeight = 300;
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const defaultX = 18;
    const defaultY = Math.round(screenH / 2 + 215);

    try {
      const saved = localStorage.getItem('paperrocket_opt1_coords');
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
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handleCardDragStart = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('canvas')) return;

    isDraggingCardRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!isDraggingCardRef.current) return;
      const dx = moveEv.clientX - dragStartRef.current.mouseX;
      const dy = moveEv.clientY - dragStartRef.current.mouseY;
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const maxX = Math.max(10, screenW - 232);
      const maxY = Math.max(10, screenH - 80);
      const newX = Math.min(maxX, Math.max(10, dragStartRef.current.startX + dx));
      const newY = Math.min(maxY, Math.max(10, dragStartRef.current.startY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      if (isDraggingCardRef.current) {
        isDraggingCardRef.current = false;
        setPosition((curr) => {
          try {
            localStorage.setItem('paperrocket_opt1_coords', JSON.stringify(curr));
          } catch (_) {}
          return curr;
        });
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [position.x, position.y]);

  const puckDragRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
    hasDragged: boolean;
  }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
    hasDragged: false,
  });

  const [isPuckDragging, setIsPuckDragging] = useState(false);

  const expandCard = useCallback(() => {
    setPosition((curr) => {
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const maxX = Math.max(10, screenW - 232);
      const maxY = Math.max(10, screenH - 280);
      return {
        x: Math.min(maxX, Math.max(10, curr.x)),
        y: Math.min(maxY, Math.max(10, curr.y)),
      };
    });
    try {
      localStorage.setItem('paperrocket_nav_expanded', 'true');
    } catch (_) {}
    setIsExpanded(true);
  }, []);

  const handlePuckPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    puckDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
      hasDragged: false,
    };

    const targetEl = e.currentTarget as HTMLElement;
    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch (_) {}

    const handlePointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - puckDragRef.current.startX;
      const dy = moveEv.clientY - puckDragRef.current.startY;
      if (!puckDragRef.current.hasDragged && Math.hypot(dx, dy) > 3) {
        puckDragRef.current.hasDragged = true;
        setIsPuckDragging(true);
      }
      if (puckDragRef.current.hasDragged) {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const maxX = Math.max(10, screenW - 48);
        const maxY = Math.max(10, screenH - 30);
        const newX = Math.min(maxX, Math.max(10, puckDragRef.current.posX + dx));
        const newY = Math.min(maxY, Math.max(10, puckDragRef.current.posY + dy));
        setPosition({ x: newX, y: newY });
      }
    };

    const handlePointerUp = (upEv: PointerEvent) => {
      try {
        targetEl.releasePointerCapture(upEv.pointerId);
      } catch (_) {}
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setIsPuckDragging(false);

      if (puckDragRef.current.hasDragged) {
        setPosition((curr) => {
          try {
            localStorage.setItem('paperrocket_opt1_coords', JSON.stringify(curr));
          } catch (_) {}
          return curr;
        });
      } else {
        expandCard();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [position.x, position.y, expandCard]);

  // Auto-clamp when viewport resizes
  useEffect(() => {
    const handleResize = () => {
      setPosition((curr) => {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const maxX = Math.max(10, screenW - 232);
        const maxY = Math.max(10, screenH - 120);
        const clampedX = Math.min(maxX, Math.max(10, curr.x));
        const clampedY = Math.min(maxY, Math.max(10, curr.y));
        if (clampedX !== curr.x || clampedY !== curr.y) {
          return { x: clampedX, y: clampedY };
        }
        return curr;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3D Math Projection
  const projectDir = useCallback(
    (dx: number, dy: number, dz: number, GW: number, GH: number, G_ARM: number) => {
      const pose = getCameraPose();
      const GCX = GW / 2,
        GCY = GH / 2;
      const sinT = Math.sin(pose.theta),
        cosT = Math.cos(pose.theta);
      const sinP = Math.sin(pose.phi),
        cosP = Math.cos(pose.phi);

      const rx = cosT,
        ry = 0,
        rz = -sinT;
      const ux = -cosP * sinT,
        uy = sinP,
        uz = -cosP * cosT;
      const fx = sinP * sinT,
        fy = cosP,
        fz = sinP * cosT;

      const sx = dx * rx + dy * ry + dz * rz;
      const sy = dx * ux + dy * uy + dz * uz;
      const depth = dx * fx + dy * fy + dz * fz;

      return { x: GCX + sx * G_ARM, y: GCY - sy * G_ARM, depth };
    },
    []
  );

  // Draw Camera Orbit Gimbal 1 with High-DPI
  const drawGimbal1 = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssSize = 132;
    if (canvas.width !== cssSize * dpr) {
      canvas.width = cssSize * dpr;
      canvas.height = cssSize * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const GW = cssSize;
    const GH = cssSize;
    const G_ARM = 42;
    const G_DOT = 12;

    ctx.save();
    ctx.fillStyle = isLight ? '#ebe7df' : '#1c1e23';
    ctx.beginPath();
    ctx.arc(GW / 2, GH / 2, GW / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    const projected = AXES.map((ax) => {
      const p = projectDir(ax.dir[0], ax.dir[1], ax.dir[2], GW, GH, G_ARM);
      return { ax, p, depth: p.depth };
    }).sort((a, b) => a.depth - b.depth);

    // Coordinate arms
    projected.forEach(({ ax, p, depth }) => {
      const isFront = depth >= -0.05;
      ctx.save();
      ctx.strokeStyle = isFront
        ? ax.col
        : isLight
        ? 'rgba(0,0,0,0.22)'
        : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = isFront ? 2.4 : 1.2;
      if (!isFront) ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(GW / 2, GH / 2);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      const dotR = G_DOT * (isFront ? 1.0 : 0.75);
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);

      if (isFront) {
        ctx.fillStyle = ax.col;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ax.lbl, p.x, p.y + 0.5);
      } else {
        ctx.fillStyle = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)';
        ctx.fill();
      }
      ctx.restore();
    });

    // Center pivot point
    ctx.save();
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(GW / 2, GH / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }, [isLight, projectDir]);

  useEffect(() => {
    if (!isExpanded || activeTab !== 'camera') return;
    drawGimbal1();
    const unsubscribe = subscribeCameraPose(() => {
      drawGimbal1();
    });
    return () => unsubscribe();
  }, [isExpanded, activeTab, drawGimbal1]);

  // Orbit Drag Handlers
  const orbitDrag = useRef<{ isDragging: boolean; startX: number; startY: number; pointerId: number; scale: number }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    pointerId: -1,
    scale: 1,
  });

  const handleOrbitPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (e.button !== 0 || orbitDrag.current.isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Axis dots are direct-manipulation handles. Snapping remains available in
    // the dedicated Ground / Wall / 45° buttons below the dial.
    orbitDrag.current = {
      isDragging: true, startX: e.clientX, startY: e.clientY,
      pointerId: e.pointerId, scale: 132 / Math.max(1, canvas.getBoundingClientRect().width),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleOrbitPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!orbitDrag.current.isDragging || e.pointerId !== orbitDrag.current.pointerId || !engine) return;
    const dx = e.clientX - orbitDrag.current.startX;
    const dy = e.clientY - orbitDrag.current.startY;
    const scale = orbitDrag.current.scale * (e.shiftKey ? 0.25 : 1);
    engine.orbitNavigator(dx * scale, dy * scale);
    orbitDrag.current.startX = e.clientX;
    orbitDrag.current.startY = e.clientY;
  };

  const handleOrbitPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!orbitDrag.current.isDragging || e.pointerId !== orbitDrag.current.pointerId) return;
    orbitDrag.current.isDragging = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Surface Mode: Move Pad Knob State
  const [moveKnobPos, setMoveKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const movePadDrag = useRef<{
    isDragging: boolean;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
  }>({
    isDragging: false,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
  });

  const handleMovePadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    movePadDrag.current = {
      isDragging: true,
      originX: e.clientX,
      originY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    engine?.beginTransform(targetScope);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleMovePadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!movePadDrag.current.isDragging || !engine) return;
    const totalX = e.clientX - movePadDrag.current.originX;
    const totalY = e.clientY - movePadDrag.current.originY;
    const dx = e.clientX - movePadDrag.current.lastX;
    const dy = e.clientY - movePadDrag.current.lastY;
    const clampRadius = 26;
    const dist = Math.hypot(totalX, totalY);
    const factor = dist > clampRadius ? clampRadius / dist : 1;
    setMoveKnobPos({ x: totalX * factor, y: totalY * factor });

    engine.translateScreenSpace(dx * 1.5, dy * 1.5, targetScope, isLocked);

    movePadDrag.current.lastX = e.clientX;
    movePadDrag.current.lastY = e.clientY;
  };

  const handleMovePadPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    movePadDrag.current.isDragging = false;
    setMoveKnobPos({ x: 0, y: 0 });
    engine?.endTransform();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Surface Mode: Tilt Rail
  const [tiltKnobY, setTiltKnobY] = useState<number>(0);
  const tiltDrag = useRef<{ isDragging: boolean; startY: number }>({ isDragging: false, startY: 0 });

  const handleTiltPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    tiltDrag.current = { isDragging: true, startY: e.clientY };
    engine?.beginTransform(targetScope);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleTiltPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!tiltDrag.current.isDragging || !engine) return;
    const dy = e.clientY - tiltDrag.current.startY;
    const clampedY = Math.max(-30, Math.min(30, dy));
    setTiltKnobY(clampedY);
    engine.rotateAxis3D('x', -dy * 0.02, targetScope, isLocked);
    tiltDrag.current.startY = e.clientY;
  };

  const handleTiltPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    tiltDrag.current.isDragging = false;
    setTiltKnobY(0);
    engine?.endTransform();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Surface Mode: Elev Rail
  const [elevKnobY, setElevKnobY] = useState<number>(0);
  const elevDrag = useRef<{ isDragging: boolean; startY: number }>({ isDragging: false, startY: 0 });

  const handleElevPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    elevDrag.current = { isDragging: true, startY: e.clientY };
    engine?.beginTransform(targetScope);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleElevPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!elevDrag.current.isDragging || !engine) return;
    const dy = e.clientY - elevDrag.current.startY;
    const clampedY = Math.max(-30, Math.min(30, dy));
    setElevKnobY(clampedY);
    engine.translateAxis3D('y', -dy * 0.015, targetScope);
    elevDrag.current.startY = e.clientY;
  };

  const handleElevPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    elevDrag.current.isDragging = false;
    setElevKnobY(0);
    engine?.endTransform();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Surface Mode: Yaw Swipe Track
  const yawDrag = useRef<{ isDragging: boolean; startX: number }>({ isDragging: false, startX: 0 });

  const handleYawPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    yawDrag.current = { isDragging: true, startX: e.clientX };
    engine?.beginTransform(targetScope);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleYawPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!yawDrag.current.isDragging || !engine) return;
    const dx = e.clientX - yawDrag.current.startX;
    engine.rotateWorldAxis('y', -dx * 0.02, targetScope, isLocked);
    yawDrag.current.startX = e.clientX;
  };

  const handleYawPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    yawDrag.current.isDragging = false;
    engine?.endTransform();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Mini Collapsed Puck - Micro Floating Pill
  if (!isExpanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Expand 3D Navigator"
        title="3D Navigator (Drag to move, click to expand)"
        className={`nav-mini-puck ${isLight ? 'card-theme-light' : 'card-theme-dark'} ${isPuckDragging ? 'is-dragging' : ''}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `scale(${uiScale})`,
          transformOrigin: 'top left',
        }}
        onPointerDown={handlePuckPointerDown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            expandCard();
          }
        }}
      >
        <Compass className="w-3.5 h-3.5 text-current shrink-0 pointer-events-none" />
        <Maximize2 className="w-2.5 h-2.5 opacity-60 shrink-0 pointer-events-none" />
      </div>
    );
  }

  // Full Expanded Card
  return (
    <div
      ref={cardRef}
      onPointerDown={handleCardDragStart}
      className={`pr-surface nav-controller-modal ${isLight ? 'card-theme-light' : 'card-theme-dark'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '232px',
        transform: `scale(${uiScale})`,
        transformOrigin: 'top left',
      }}
    >
      {/* Top Toolbar (draggable via background) */}
      <div
        className="nav-top-toolbar cursor-grab active:cursor-grabbing"
        onPointerDown={handleCardDragStart}
      >
        {/* Camera vs Surface Switch Pill */}
        <div className="seg-pill-wrap" aria-label="Navigator mode">
          <button
            type="button"
            className={`seg-choice flex items-center justify-center ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
            title="Camera View (Orbit & Pan)"
            aria-label="Camera View"
          >
            <Camera className="w-3.5 h-3.5 shrink-0" />
          </button>
          <button
            type="button"
            className={`seg-choice flex items-center justify-center ${activeTab === 'surface' ? 'active' : ''}`}
            onClick={() => setActiveTab('surface')}
            title="Surface Controls (Rotate & Move)"
            aria-label="Surface Controls"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>

        {/* Reset Button */}
        <button
          className="nav-tool-btn"
          onClick={() => {
            engine?.resetTransform(targetScope);
            engine?.resetCamera();
            drawGimbal1();
          }}
          title="Reset Transform & Camera"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Minimize Button */}
        <button
          className="nav-tool-btn"
          onClick={() => {
            try {
              localStorage.setItem('paperrocket_nav_expanded', 'false');
            } catch (_) {}
            setIsExpanded(false);
          }}
          title="Minimize Navigator"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Panels */}
      <div className="fc-panels">
        {/* Camera Tab View */}
        {activeTab === 'camera' && (
          <div className="gimbal-wrap">
            <canvas
              ref={canvasRef}
              className="gimbal-canvas-el"
              onPointerDown={handleOrbitPointerDown}
              onPointerMove={handleOrbitPointerMove}
              onPointerUp={handleOrbitPointerUp}
              onPointerCancel={handleOrbitPointerUp}
              onLostPointerCapture={handleOrbitPointerUp}
              title="Drag to orbit. Hold Shift for precision."
            />
            <div className="zoom-col">
              <button
                className="zoom-btn"
                onClick={() => engine?.zoomCamera(-0.3)}
                title="Zoom In"
              >
                +
              </button>
              <button
                className="zoom-btn"
                onClick={() => engine?.zoomCamera(0.3)}
                title="Zoom Out"
              >
                -
              </button>
            </div>
          </div>
        )}

        {/* Surface Tab View */}
        {activeTab === 'surface' && (
          <>
            {/* Target Scope Selector: Pick Canvas, Painting, All, or Layer */}
            <div className="nav-scope-container" style={{ marginBottom: 6 }}>
              <div className="nav-scope-pill" aria-label="Target to transform">
                <button
                  type="button"
                  className={`nav-scope-btn ${targetScope === 'all' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectScope('all');
                  }}
                  title="Move Everything (Canvas + Painting together)"
                >
                  All
                </button>
                <button
                  type="button"
                  className={`nav-scope-btn ${targetScope === 'model' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectScope('model');
                  }}
                  title="Move Canvas Only (Painting stays in place)"
                >
                  Canvas
                </button>
                <button
                  type="button"
                  className={`nav-scope-btn ${targetScope === 'strokes' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectScope('strokes');
                  }}
                  title="Move Painting Only (Canvas stays in place)"
                >
                  Paint
                </button>
                <button
                  type="button"
                  className={`nav-scope-btn ${targetScope === 'active_layer' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectScope('active_layer');
                  }}
                  title="Move Active Layer Only"
                >
                  Layer
                </button>
              </div>
            </div>

            <div className="deck-row">
              {/* 2D Move Pad */}
              <div
                className="move-pad"
                onPointerDown={handleMovePadPointerDown}
                onPointerMove={handleMovePadPointerMove}
                onPointerUp={handleMovePadPointerUp}
                onPointerCancel={handleMovePadPointerUp}
              >
                <div
                  className="move-knob"
                  style={{ transform: `translate(${moveKnobPos.x}px, ${moveKnobPos.y}px)` }}
                >
                  Move
                </div>
                <div className="move-sublabel">X / Z Drag</div>
              </div>

              {/* Tilt & Elevation Sliders */}
              <div className="sliders-col">
                <div
                  className="slider-rail"
                  onPointerDown={handleTiltPointerDown}
                  onPointerMove={handleTiltPointerMove}
                  onPointerUp={handleTiltPointerUp}
                  onPointerCancel={handleTiltPointerUp}
                  title="Drag vertically for Pitch Tilt"
                >
                  <span className="rail-tag">Up</span>
                  <div
                    className="rail-knob"
                    style={{ transform: `translateY(${tiltKnobY}px)` }}
                  >
                    Tilt
                  </div>
                  <span className="rail-tag">Down</span>
                </div>
                <div
                  className="slider-rail"
                  onPointerDown={handleElevPointerDown}
                  onPointerMove={handleElevPointerMove}
                  onPointerUp={handleElevPointerUp}
                  onPointerCancel={handleElevPointerUp}
                  title="Drag vertically for Height Elevation"
                >
                  <span className="rail-tag">Up</span>
                  <div
                    className="rail-knob"
                    style={{ transform: `translateY(${elevKnobY}px)` }}
                  >
                    Elev
                  </div>
                  <span className="rail-tag">Down</span>
                </div>
              </div>
            </div>

            {/* Yaw Spin Strip */}
            <div className="spin-strip">
              <button
                className="spin-step-btn"
                onClick={() => engine?.rotateAxis3D('y', -Math.PI / 4, targetScope, isLocked)}
                title="Rotate -45°"
              >
                -45°
              </button>
              <div
                className="spin-label-track"
                onPointerDown={handleYawPointerDown}
                onPointerMove={handleYawPointerMove}
                onPointerUp={handleYawPointerUp}
                onPointerCancel={handleYawPointerUp}
                title="Swipe left/right to spin yaw"
              >
                Swipe to Spin Yaw
              </div>
              <button
                className="spin-step-btn"
                onClick={() => engine?.rotateAxis3D('y', Math.PI / 4, targetScope, isLocked)}
                title="Rotate +45°"
              >
                +45°
              </button>
            </div>
          </>
        )}

        {/* Quick Snap Presets (≥ 44px) */}
        <div className="presets-grid">
          <button
            className="preset-chip"
            onClick={() => engine?.snapToView('top')}
            title="Snap to flat ground"
          >
            Ground
          </button>
          <button
            className="preset-chip"
            onClick={() => engine?.snapToView('front')}
            title="Snap to vertical wall"
          >
            Wall
          </button>
          <button
            className="preset-chip"
            onClick={() => engine?.snapToView('isometric')}
            title="Snap to 45° slant"
          >
            45°
          </button>
          <button
            className="preset-chip"
            onClick={() => engine?.snapToView('isometric')}
            title="Align view"
          >
            Align
          </button>
        </div>
      </div>
    </div>
  );
};
