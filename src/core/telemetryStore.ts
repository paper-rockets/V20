/**
 * High-Frequency Telemetry Store
 *
 * The render loop produces camera pose and FPS updates every single frame. Feeding
 * those into React state re-renders the whole application tree 60-120 times a
 * second, which on a low-power tablet costs more than the 3D rendering itself.
 *
 * This module is a tiny synchronous pub/sub: the engine writes into a mutable
 * snapshot, and only components that actually display the value subscribe. Leaf
 * components read it with useSyncExternalStore or write straight to a DOM node,
 * so nothing above them re-renders.
 */

export interface CameraPose {
  radius: number;
  theta: number;
  phi: number;
}

type Listener = () => void;

/** Live camera pose. Mutated in place by the engine - never store the object itself. */
const cameraPose: CameraPose = { radius: 3.5, theta: Math.PI / 4, phi: Math.PI / 3 };
const cameraListeners = new Set<Listener>();

let fps = 60;
const fpsListeners = new Set<Listener>();

function notify(listeners: Set<Listener>): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.warn('Telemetry listener error:', e);
    }
  }
}

// --- Camera pose --------------------------------------------------------

/** Called by the engine's render loop. Allocation-free. */
export function publishCameraPose(radius: number, theta: number, phi: number): void {
  if (cameraPose.radius === radius && cameraPose.theta === theta && cameraPose.phi === phi) {
    return;
  }
  cameraPose.radius = radius;
  cameraPose.theta = theta;
  cameraPose.phi = phi;
  notify(cameraListeners);
}

/**
 * Reads the live pose. The returned object is shared and mutable, so copy the
 * fields you need rather than retaining the reference.
 */
export function getCameraPose(): Readonly<CameraPose> {
  return cameraPose;
}

export function subscribeCameraPose(listener: Listener): () => void {
  cameraListeners.add(listener);
  return () => {
    cameraListeners.delete(listener);
  };
}

// --- Frame rate ---------------------------------------------------------

/** Called roughly twice a second by the engine's FPS sampler. */
export function publishFps(value: number): void {
  if (fps === value) return;
  fps = value;
  notify(fpsListeners);
}

export function getFps(): number {
  return fps;
}

export function subscribeFps(listener: Listener): () => void {
  fpsListeners.add(listener);
  return () => {
    fpsListeners.delete(listener);
  };
}
