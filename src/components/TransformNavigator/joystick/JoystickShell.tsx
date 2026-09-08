import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import type { JoystickMode } from './conceptTypes';

interface ShellProps {
  mode: JoystickMode;
  onSetMode: (mode: JoystickMode) => void;
  locked: boolean;
  onToggleLock: () => void;
  children: React.ReactNode;
}

export const JoystickShell: React.FC<ShellProps> = ({
  mode,
  onSetMode,
  locked,
  onToggleLock,
  children,
}) => (
  <div className="jsk">
    <div className="jsk-disc">
      {children}

      <button
        type="button"
        className="jsk-key jsk-key-lock"
        onClick={onToggleLock}
        aria-pressed={locked}
        aria-label={locked ? 'Snapping on' : 'Snapping off'}
        title={locked ? 'Snapping on — neat steps' : 'Snapping off — moves freely'}
      >
        <i className={locked ? 'on' : ''}>
          {locked ? <Lock size={14} strokeWidth={2.1} /> : <Unlock size={14} strokeWidth={2.1} />}
        </i>
      </button>

      <button
        type="button"
        className="jsk-key jsk-key-mode"
        onClick={() => onSetMode(mode === '2d' ? '3d' : '2d')}
        aria-label={mode === '2d' ? 'Switch to the 3D joystick' : 'Switch to the 2D joystick'}
        title={mode === '2d' ? 'Switch to the 3D joystick' : 'Switch to the 2D joystick'}
      >
        <i>{mode === '2d' ? '2D' : '3D'}</i>
      </button>
    </div>
  </div>
);
