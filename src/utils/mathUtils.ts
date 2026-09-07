/**
 * Math utilities for 2D/3D Transform Joystick navigation
 */

// Apply rubber band resistance when dragging beyond max radius
export function applyElasticResistance(distance: number, maxRadius: number, damping = 0.35): number {
  if (distance <= maxRadius) return distance;
  const overshoot = distance - maxRadius;
  return maxRadius + overshoot * damping;
}

// Convert cartesian coordinates to polar angle in radians (-PI to PI)
export function getAngle(dx: number, dy: number): number {
  return Math.atan2(dy, dx);
}

// Normalize angle in degrees to [0, 360)
export function normalizeAngleDeg(deg: number): number {
  let angle = deg % 360;
  if (angle < 0) angle += 360;
  return angle;
}

// Snap value to step increment
export function snapValue(val: number, step: number): number {
  return Math.round(val / step) * step;
}

// Virtual Trackball Math: map 2D drag (dx, dy) on sphere of radius R to 3D rotation delta (rx, ry, rz)
export function computeTrackballRotation(
  deltaX: number,
  deltaY: number,
  sensitivity = 0.8
): { deltaRx: number; deltaRy: number; deltaRz: number } {
  // Dragging right rotates around Y axis (yaw)
  // Dragging up rotates around X axis (pitch)
  const deltaRy = deltaX * sensitivity;
  const deltaRx = -deltaY * sensitivity;
  return {
    deltaRx,
    deltaRy,
    deltaRz: 0,
  };
}

// Format vector float numbers nicely for display
export function formatVectorNum(val: number, precision = 3): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(precision)}`;
}
