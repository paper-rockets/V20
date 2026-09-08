export type JoystickMode = '2d' | '3d';

export interface AxisScreenInfo {
  axis: 'x' | 'y' | 'z';
  dx: number;
  dy: number;
  angle: number;
  usable: number;
}

export interface JoystickReadout {
  move: [number, number, number];
  turn: [number, number, number];
  size: [number, number, number];
}

export type ConceptId = 'disc' | 'petal' | 'collar';

export interface ConceptProps {
  mode: JoystickMode;
  onSetMode: (mode: JoystickMode) => void;
  locked: boolean;
  onToggleLock: () => void;
  axisInfo: AxisScreenInfo[];
  readout?: JoystickReadout;
  onOrbit: (dx: number, dy: number) => void;
  onZoom: (dy: number) => void;
  onSelectView: (view: 'front' | 'side' | 'top' | 'angle') => void;
  onSelectAxis?: (axis: 'x' | 'y' | 'z') => void;
  onAxisDrag?: (axis: 'x' | 'y' | 'z', amount: number) => void;
  onRingSweep?: (deltaRadians: number) => void;
}
