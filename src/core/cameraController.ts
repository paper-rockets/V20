/**
 * @license
 * Camera Controller
 *
 * Dedicated controller for 3D viewpoint management, spherical orbit controls,
 * pan, zoom, field-of-view, projection toggles, and perfect view alignment.
 */

import * as THREE from 'three';
import { PerfectViewInfo, PerfectViewType } from '../types';
import { publishCameraPose } from './telemetryStore';

const _panForward = new THREE.Vector3();
const _panRight = new THREE.Vector3();
const _panUp = new THREE.Vector3();
const _cameraOffset = new THREE.Vector3();
const _viewDirScratch = new THREE.Vector3();

// Canonical view axes for perfect-view detection
const _AXIS_FRONT = new THREE.Vector3(0, 0, -1);
const _AXIS_BACK = new THREE.Vector3(0, 0, 1);
const _AXIS_TOP = new THREE.Vector3(0, -1, 0);
const _AXIS_BOTTOM = new THREE.Vector3(0, 1, 0);
const _AXIS_RIGHT = new THREE.Vector3(-1, 0, 0);
const _AXIS_LEFT = new THREE.Vector3(1, 0, 0);

export interface CameraControllerOptions {
  width: number;
  height: number;
  onDirty?: () => void;
  onCameraChange?: (spherical: { radius: number; theta: number; phi: number }) => void;
  onProjectionChange?: (mode: 'perspective' | 'orthographic', fov: number) => void;
}

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public cameraTarget: THREE.Vector3 = new THREE.Vector3(-0.08, 0.42, 0);
  public cameraSpherical: THREE.Spherical = new THREE.Spherical(7.85, 1.5303, -0.0249);
  public targetSpherical: THREE.Spherical = new THREE.Spherical(7.85, 1.5303, -0.0249);
  public targetPosition: THREE.Vector3 = new THREE.Vector3(-0.08, 0.42, 0);

  public navigatorSensitivity: number = 1.0;
  public projectionMode: 'perspective' | 'orthographic' = 'perspective';
  public savedPerspectiveFov: number = 45;

  public onDirty?: () => void;
  public onCameraChange?: (spherical: { radius: number; theta: number; phi: number }) => void;
  public onProjectionChange?: (mode: 'perspective' | 'orthographic', fov: number) => void;

  private perfectViewScratch: PerfectViewInfo = {
    isPerfect: false,
    view: null,
    depthAxis: null,
  };

  constructor(options: CameraControllerOptions) {
    this.camera = new THREE.PerspectiveCamera(45, options.width / options.height, 0.05, 2000);
    this.onDirty = options.onDirty;
    this.onCameraChange = options.onCameraChange;
    this.onProjectionChange = options.onProjectionChange;
    this.updateCameraPosition();
  }

  public markDirty(): void {
    this.onDirty?.();
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public setNavigatorSensitivity(s: number): void {
    this.navigatorSensitivity = Math.max(0.1, Math.min(5.0, s));
  }

  public getNavigatorSensitivity(): number {
    return this.navigatorSensitivity;
  }

  public orbit(deltaX: number, deltaY: number): void {
    const rotSpeed = 0.006 * this.navigatorSensitivity;
    this.targetSpherical.theta -= deltaX * rotSpeed;
    this.targetSpherical.phi -= deltaY * rotSpeed;

    const eps = 0.01;
    this.targetSpherical.phi = Math.max(eps, Math.min(Math.PI - eps, this.targetSpherical.phi));
    this.markDirty();
  }

  public orbitNavigator(deltaX: number, deltaY: number): void {
    const speed = 0.02 * this.navigatorSensitivity;
    this.cameraSpherical.theta -= deltaX * speed;
    this.cameraSpherical.phi = Math.max(
      0.01,
      Math.min(Math.PI - 0.01, this.cameraSpherical.phi - deltaY * speed)
    );
    this.targetSpherical.theta = this.cameraSpherical.theta;
    this.targetSpherical.phi = this.cameraSpherical.phi;
    this.markDirty();
  }

  public pan(deltaX: number, deltaY: number): void {
    const panSpeed = 0.0025 * (this.cameraSpherical.radius / 3.0);
    const forward = this.camera.getWorldDirection(_panForward);
    const right = _panRight.crossVectors(forward, this.camera.up).normalize();
    const up = _panUp.crossVectors(right, forward).normalize();

    this.targetPosition.addScaledVector(right, -deltaX * panSpeed);
    this.targetPosition.addScaledVector(up, deltaY * panSpeed);
    this.markDirty();
  }

  public zoom(deltaDistance: number): void {
    const zoomSpeed = 0.0015;
    this.targetSpherical.radius += deltaDistance * zoomSpeed * this.targetSpherical.radius;
    this.targetSpherical.radius = Math.max(0.4, Math.min(25.0, this.targetSpherical.radius));
    this.markDirty();
  }

  public getCameraSpherical(): { radius: number; theta: number; phi: number } {
    return {
      radius: this.cameraSpherical.radius,
      theta: this.cameraSpherical.theta,
      phi: this.cameraSpherical.phi,
    };
  }

  public orbitCamera(deltaTheta: number, deltaPhi: number): void {
    this.targetSpherical.theta += deltaTheta;
    this.targetSpherical.phi += deltaPhi;
    const eps = 0.001;
    this.targetSpherical.phi = Math.max(eps, Math.min(Math.PI - eps, this.targetSpherical.phi));
    this.markDirty();
  }

  public setCameraView(theta: number, phi: number, radius?: number, instant: boolean = false): void {
    this.targetSpherical.theta = theta;
    this.targetSpherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, phi));
    if (radius !== undefined) {
      this.targetSpherical.radius = radius;
    }
    if (instant) {
      this.cameraSpherical.theta = this.targetSpherical.theta;
      this.cameraSpherical.phi = this.targetSpherical.phi;
      if (radius !== undefined) this.cameraSpherical.radius = radius;
      this.updateCameraPosition();
    }
    this.markDirty();
  }

  public zoomCamera(deltaRadius: number): void {
    this.targetSpherical.radius = Math.max(0.4, Math.min(25.0, this.targetSpherical.radius + deltaRadius));
    this.markDirty();
  }

  public resetView(modelDimensions?: THREE.Vector3, isDrawingCanvas: boolean = false): void {
    if (isDrawingCanvas) {
      this.targetSpherical.radius = 7.85;
      this.targetSpherical.phi = 1.5303;
      this.targetSpherical.theta = -0.0249;
      this.targetPosition.set(-0.08, 0.42, 0);
    } else if (modelDimensions) {
      const maxDim = Math.max(modelDimensions.x, modelDimensions.y, modelDimensions.z, 1.0);
      this.targetSpherical.radius = maxDim * 2.2;
      this.targetSpherical.theta = Math.PI / 4;
      this.targetSpherical.phi = Math.PI / 2.3;
      this.targetPosition.set(0, 0, 0);
    } else {
      this.targetSpherical.radius = 7.85;
      this.targetSpherical.phi = 1.5303;
      this.targetSpherical.theta = -0.0249;
      this.targetPosition.set(-0.08, 0.42, 0);
    }
    this.markDirty();
  }

  public resetCamera(): void {
    this.resetView();
  }

  public setTargetPosition(x: number, y: number, z: number): void {
    this.targetPosition.set(x, y, z);
    this.markDirty();
  }

  public getFov(): number {
    return this.camera.fov;
  }

  public setFov(fov: number): void {
    const clamped = Math.max(12, Math.min(105, fov));
    this.camera.fov = clamped;
    this.camera.updateProjectionMatrix();
    if (this.projectionMode === 'orthographic' && clamped > 22) {
      this.projectionMode = 'perspective';
    }
    this.onProjectionChange?.(this.projectionMode, clamped);
  }

  public adjustFov(delta: number): number {
    this.setFov(this.camera.fov + delta);
    return this.camera.fov;
  }

  public getProjectionMode(): 'perspective' | 'orthographic' {
    return this.projectionMode;
  }

  public setProjectionMode(mode: 'perspective' | 'orthographic'): void {
    this.projectionMode = mode;
    if (mode === 'orthographic') {
      this.savedPerspectiveFov = this.camera.fov;
      this.camera.fov = 15; // Low distortion isometric telephoto
    } else {
      this.camera.fov = this.savedPerspectiveFov || 45;
    }
    this.camera.updateProjectionMatrix();
    this.onProjectionChange?.(this.projectionMode, this.camera.fov);
  }

  public toggleProjectionMode(): 'perspective' | 'orthographic' {
    const nextMode = this.projectionMode === 'perspective' ? 'orthographic' : 'perspective';
    this.setProjectionMode(nextMode);
    return nextMode;
  }

  public snapToView(view: PerfectViewType): void {
    const radius = Math.max(this.targetSpherical.radius, 2.0);
    switch (view) {
      case 'front':
        this.targetSpherical.set(radius, Math.PI / 2, 0);
        break;
      case 'back':
        this.targetSpherical.set(radius, Math.PI / 2, Math.PI);
        break;
      case 'top':
        this.targetSpherical.set(radius, 0.001, 0);
        break;
      case 'bottom':
        this.targetSpherical.set(radius, Math.PI - 0.001, 0);
        break;
      case 'right':
        this.targetSpherical.set(radius, Math.PI / 2, Math.PI / 2);
        break;
      case 'left':
        this.targetSpherical.set(radius, Math.PI / 2, -Math.PI / 2);
        break;
      case 'isometric':
        this.targetSpherical.set(radius, Math.PI / 2.3, Math.PI / 4);
        break;
    }
    this.markDirty();
  }

  public getPerfectView(): PerfectViewInfo {
    const dir = this.camera.getWorldDirection(_viewDirScratch).normalize();
    const threshold = 0.985; // ~10 degrees tolerance
    const out = this.perfectViewScratch;

    if (dir.dot(_AXIS_FRONT) > threshold) {
      out.isPerfect = true;
      out.view = 'front';
      out.depthAxis = 'z';
    } else if (dir.dot(_AXIS_BACK) > threshold) {
      out.isPerfect = true;
      out.view = 'back';
      out.depthAxis = 'z';
    } else if (dir.dot(_AXIS_TOP) > threshold) {
      out.isPerfect = true;
      out.view = 'top';
      out.depthAxis = 'y';
    } else if (dir.dot(_AXIS_BOTTOM) > threshold) {
      out.isPerfect = true;
      out.view = 'bottom';
      out.depthAxis = 'y';
    } else if (dir.dot(_AXIS_RIGHT) > threshold) {
      out.isPerfect = true;
      out.view = 'right';
      out.depthAxis = 'x';
    } else if (dir.dot(_AXIS_LEFT) > threshold) {
      out.isPerfect = true;
      out.view = 'left';
      out.depthAxis = 'x';
    } else {
      out.isPerfect = false;
      out.view = null;
      out.depthAxis = null;
    }

    return out;
  }

  public updateCameraPosition(): void {
    this.cameraSpherical.theta += (this.targetSpherical.theta - this.cameraSpherical.theta) * 0.15;
    this.cameraSpherical.phi += (this.targetSpherical.phi - this.cameraSpherical.phi) * 0.15;
    this.cameraSpherical.radius += (this.targetSpherical.radius - this.cameraSpherical.radius) * 0.15;

    this.cameraTarget.lerp(this.targetPosition, 0.15);

    _cameraOffset.setFromSpherical(this.cameraSpherical);
    this.camera.position.copy(this.cameraTarget).add(_cameraOffset);
    this.camera.lookAt(this.cameraTarget);

    publishCameraPose(this.cameraSpherical.radius, this.cameraSpherical.theta, this.cameraSpherical.phi);
  }

  public isCameraSettling(): boolean {
    const EPS_ANGLE = 0.0004;
    const EPS_DIST = 0.0008;
    return (
      Math.abs(this.targetSpherical.theta - this.cameraSpherical.theta) > EPS_ANGLE ||
      Math.abs(this.targetSpherical.phi - this.cameraSpherical.phi) > EPS_ANGLE ||
      Math.abs(this.targetSpherical.radius - this.cameraSpherical.radius) > EPS_DIST ||
      this.cameraTarget.distanceToSquared(this.targetPosition) > EPS_DIST * EPS_DIST
    );
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
