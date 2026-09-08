import React, { useCallback, useEffect, useState } from 'react';
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
    <aside className={`jn-wrap jn-${theme}`} aria-label="Precision Navigation Control">
      <div className="jn-rig">
        {/* Top layout strip: Disc | Petal | Collar */}
        <div className="rig-strip" role="tablist" aria-label="Joystick type">
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
