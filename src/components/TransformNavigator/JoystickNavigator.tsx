import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { StudioEngine } from '../../core/studioEngine';
import { haptics } from '../../utils/haptics';
import { PetalJoystick } from './joystick/PetalJoystick';
import { DiscJoystick } from './joystick/DiscJoystick';
import { CollarJoystick } from './joystick/CollarJoystick';
import type { AxisScreenInfo, JoystickMode } from './joystick/conceptTypes';
import './joystickNavigator.css';

export type NavigatorLayout = 'sphere' | 'disc' | 'petal' | 'collar';

interface JoystickNavigatorProps {
  engine?: StudioEngine | null;
  theme?: 'light' | 'dark';
  layout: Exclude<NavigatorLayout, 'sphere'>;
  onLayoutChange: (layout: NavigatorLayout) => void;
  onClose?: () => void;
}

const VIEWS = {
  front: [0, Math.PI / 2],
  side: [Math.PI / 2, Math.PI / 2],
  top: [0, 0.035],
  angle: [Math.PI / 4, Math.PI / 3],
} as const;

export const JoystickNavigator: React.FC<JoystickNavigatorProps> = ({
  engine,
  theme = 'dark',
  layout,
  onLayoutChange,
  onClose,
}) => {
  const [mode, setMode] = useState<JoystickMode>('3d');
  const [locked, setLocked] = useState(false);
  const [axisInfo, setAxisInfo] = useState<AxisScreenInfo[]>([
    { axis: 'y', dx: 0, dy: -1, angle: -90, usable: 1 },
    { axis: 'x', dx: 0.866, dy: 0.5, angle: 30, usable: 1 },
    { axis: 'z', dx: -0.866, dy: 0.5, angle: 150, usable: 1 },
  ]);

  // Position & Repositioning State
  const [customPos, setCustomPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('paperrocket_nav_custom_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clampedX = Math.min(Math.max(parsed.x, 10), Math.max(10, window.innerWidth - 150));
          const clampedY = Math.min(Math.max(parsed.y, 55), Math.max(55, window.innerHeight - 200));
          return { x: clampedX, y: clampedY };
        }
      }
    } catch (_) {}
    return null;
  });
  const [isRepositioning, setIsRepositioning] = useState<boolean>(false);
  const [isInUse, setIsInUse] = useState<boolean>(false);

  const wrapRef = useRef<HTMLElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPosRef = useRef<{ x: number; y: number } | null>(customPos);

  useEffect(() => {
    currentPosRef.current = customPos;
  }, [customPos]);

  // Clamp position when window resizes or device orientation changes
  useEffect(() => {
    const handleResize = () => {
      setCustomPos((prev) => {
        if (!prev) return null;
        const width = wrapRef.current?.offsetWidth || 150;
        const height = wrapRef.current?.offsetHeight || 220;
        const minX = 10;
        const maxX = Math.max(minX, window.innerWidth - width - 10);
        const minY = 55;
        const maxY = Math.max(minY, window.innerHeight - height - 70);
        const clampedX = Math.min(Math.max(prev.x, minX), maxX);
        const clampedY = Math.min(Math.max(prev.y, minY), maxY);
        if (clampedX !== prev.x || clampedY !== prev.y) {
          const next = { x: clampedX, y: clampedY };
          try {
            localStorage.setItem('paperrocket_nav_custom_pos', JSON.stringify(next));
          } catch (_) {}
          return next;
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global pointer listeners while dragging to reposition
  useEffect(() => {
    if (!isRepositioning) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const targetX = e.clientX - dragOffsetRef.current.x;
      const targetY = e.clientY - dragOffsetRef.current.y;
      const width = wrapRef.current?.offsetWidth || 150;
      const height = wrapRef.current?.offsetHeight || 220;
      const minX = 10;
      const maxX = Math.max(minX, window.innerWidth - width - 10);
      const minY = 55;
      const maxY = Math.max(minY, window.innerHeight - height - 70);
      const clampedX = Math.min(Math.max(targetX, minX), maxX);
      const clampedY = Math.min(Math.max(targetY, minY), maxY);

      const nextPos = { x: clampedX, y: clampedY };
      currentPosRef.current = nextPos;
      setCustomPos(nextPos);
    };

    const handleWindowPointerUp = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setIsRepositioning(false);
      setIsInUse(false);
      haptics.trigger('light');
      if (currentPosRef.current) {
        try {
          localStorage.setItem('paperrocket_nav_custom_pos', JSON.stringify(currentPosRef.current));
        } catch (_) {}
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp, { capture: true });
    window.addEventListener('pointercancel', handleWindowPointerUp, { capture: true });

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp, { capture: true });
      window.removeEventListener('pointercancel', handleWindowPointerUp, { capture: true });
    };
  }, [isRepositioning]);

  // Global listener to release in-use enlargement when pointer lifts
  useEffect(() => {
    if (!isInUse || isRepositioning) return;

    const handleGlobalPointerUp = () => {
      setIsInUse(false);
    };

    window.addEventListener('pointerup', handleGlobalPointerUp, { capture: true });
    window.addEventListener('pointercancel', handleGlobalPointerUp, { capture: true });

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp, { capture: true });
      window.removeEventListener('pointercancel', handleGlobalPointerUp, { capture: true });
    };
  }, [isInUse, isRepositioning]);

  const handleGripPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // 350ms hold triggers reposition mode with tactile vibration
    longPressTimerRef.current = window.setTimeout(() => {
      setIsRepositioning(true);
      setIsInUse(true);
      haptics.trigger('medium');

      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        dragOffsetRef.current = {
          x: pointerStartRef.current.x - rect.left,
          y: pointerStartRef.current.y - rect.top,
        };
        const initial = { x: rect.left, y: rect.top };
        currentPosRef.current = initial;
        setCustomPos(initial);
      }
    }, 350);
  };

  const handleGripPointerMove = (e: React.PointerEvent) => {
    if (!isRepositioning) {
      const dist = Math.hypot(
        e.clientX - pointerStartRef.current.x,
        e.clientY - pointerStartRef.current.y
      );
      if (dist > 8 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleGripPointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleResetPosition = () => {
    setCustomPos(null);
    currentPosRef.current = null;
    try {
      localStorage.removeItem('paperrocket_nav_custom_pos');
    } catch (_) {}
    haptics.trigger('light');
  };

  const updateAxisScreenInfo = useCallback(() => {
    const cam = engine?.getCamera?.() || (engine as any)?.cameraController?.camera;
    if (!cam) return;
    try {
      cam.updateMatrixWorld();
      const origin = (engine as any)?.cameraTarget?.clone?.() || new THREE.Vector3(0, 0.6, 0);
      const viewDir = cam.getWorldDirection(new THREE.Vector3());
      const axes: Array<'x' | 'y' | 'z'> = ['y', 'x', 'z'];
      const updated = axes.map((axis) => {
        const dir = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
        const a = origin.clone().project(cam);
        const b = origin.clone().addScaledVector(dir, 0.5).project(cam);
        let dx = b.x - a.x;
        let dy = -(b.y - a.y);
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const dot = Math.abs(dir.dot(viewDir));
        const usable = Math.sqrt(Math.max(0, 1 - dot * dot));
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return { axis, dx, dy, angle, usable };
      });
      setAxisInfo(updated);
    } catch {
      // Keep previous
    }
  }, [engine]);

  useEffect(() => {
    updateAxisScreenInfo();
    let animId: number;
    let lastTime = 0;
    const loop = (time: number) => {
      if (time - lastTime > 80) {
        lastTime = time;
        updateAxisScreenInfo();
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [updateAxisScreenInfo]);

  const handleOrbit = useCallback(
    (dx: number, dy: number) => {
      if (!engine) return;
      engine.orbitNavigator(dx, dy);
      updateAxisScreenInfo();
    },
    [engine, updateAxisScreenInfo]
  );

  const handleZoom = useCallback(
    (dy: number) => {
      if (!engine) return;
      engine.zoom(dy * 1.1);
      updateAxisScreenInfo();
    },
    [engine, updateAxisScreenInfo]
  );

  const handleSelectView = useCallback(
    (view: 'front' | 'side' | 'top' | 'angle') => {
      const [theta, phi] = VIEWS[view];
      engine?.setCameraView(theta, phi, undefined, false);
      haptics.trigger('light');
      setTimeout(updateAxisScreenInfo, 60);
    },
    [engine, updateAxisScreenInfo]
  );

  const handleSelectAxis = useCallback(
    (axis: 'x' | 'y' | 'z') => {
      haptics.trigger('light');
      if (axis === 'y') handleSelectView('top');
      else if (axis === 'x') handleSelectView('side');
      else if (axis === 'z') handleSelectView('front');
    },
    [handleSelectView]
  );

  const commonProps = {
    mode,
    onSetMode: setMode,
    locked,
    onToggleLock: () => {
      setLocked((prev) => !prev);
      haptics.trigger('light');
    },
    axisInfo,
    onOrbit: handleOrbit,
    onZoom: handleZoom,
    onSelectView: handleSelectView,
    onSelectAxis: handleSelectAxis,
  };

  return (
    <aside
      ref={wrapRef}
      className={`jn-wrap jn-${theme} ${isInUse ? 'jn-in-use' : ''} ${isRepositioning ? 'jn-repositioning' : ''}`}
      style={
        customPos
          ? {
              left: `${customPos.x}px`,
              top: `${customPos.y}px`,
              right: 'auto',
              bottom: 'auto',
              transformOrigin: 'center center',
            }
          : undefined
      }
      onPointerDownCapture={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('.jn-close') || target?.closest('.jn-reset-pos-btn')) {
          return;
        }
        setIsInUse(true);
      }}
      aria-label="Precision Navigation Control"
    >
      <div className="jn-rig">
        {/* Dedicated reposition drag handle: long press to drag */}
        <div
          className={`jn-drag-handle ${isRepositioning ? 'dragging' : ''}`}
          onPointerDown={handleGripPointerDown}
          onPointerMove={handleGripPointerMove}
          onPointerUp={handleGripPointerUp}
          onPointerCancel={handleGripPointerUp}
          onDoubleClick={handleResetPosition}
          title="Press and hold to reposition • Double-click to reset corner"
          aria-label="Reposition drag handle"
        >
          <div className="jn-drag-pill" />
          {customPos && !isRepositioning && (
            <button
              type="button"
              className="jn-reset-pos-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleResetPosition();
              }}
              title="Reset to default corner"
              aria-label="Reset position"
            >
              ↺
            </button>
          )}
          {isRepositioning && <span className="jn-drag-hint">Moving</span>}
        </div>

        {/* Top layout strip: Sphere | Disc | Petal | Collar */}
        <div className="rig-strip" role="tablist" aria-label="Navigator style">
          <button
            type="button"
            className="rig-chip"
            onClick={() => {
              onLayoutChange('sphere');
              haptics.trigger('light');
            }}
          >
            Sphere
          </button>
          <button
            type="button"
            className={`rig-chip ${layout === 'disc' ? 'on' : ''}`}
            onClick={() => {
              onLayoutChange('disc');
              haptics.trigger('light');
            }}
          >
            Disc
          </button>
          <button
            type="button"
            className={`rig-chip ${layout === 'petal' ? 'on' : ''}`}
            onClick={() => {
              onLayoutChange('petal');
              haptics.trigger('light');
            }}
          >
            Petal
          </button>
          <button
            type="button"
            className={`rig-chip ${layout === 'collar' ? 'on' : ''}`}
            onClick={() => {
              onLayoutChange('collar');
              haptics.trigger('light');
            }}
          >
            Collar
          </button>
        </div>

        {/* View presets strip: front | side | top | angle */}
        <div className="rig-strip" aria-label="Camera view presets">
          <button
            type="button"
            className="rig-chip"
            onClick={() => handleSelectView('front')}
          >
            front
          </button>
          <button
            type="button"
            className="rig-chip"
            onClick={() => handleSelectView('side')}
          >
            side
          </button>
          <button
            type="button"
            className="rig-chip"
            onClick={() => handleSelectView('top')}
          >
            top
          </button>
          <button
            type="button"
            className="rig-chip"
            onClick={() => handleSelectView('angle')}
          >
            ang...
          </button>
        </div>

        {/* The active Joystick component from Joystick Lab */}
        {layout === 'disc' && <DiscJoystick {...commonProps} />}
        {layout === 'petal' && <PetalJoystick {...commonProps} />}
        {layout === 'collar' && <CollarJoystick {...commonProps} />}
      </div>

      <div className="jn-side-menu">
        {onClose && (
          <button
            type="button"
            className="jn-close"
            aria-label="Hide navigator"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>
    </aside>
  );
};
