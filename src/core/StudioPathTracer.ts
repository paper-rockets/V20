/**
 * StudioPathTracer.ts
 *
 * Physically-based GPU Path Tracer engine for Remix 3D Studio, powered by three-gpu-pathtracer.
 * Traces true physical light rays with global illumination, soft contact grounding shadows,
 * and realistic color bounces across clay models and drawn strokes.
 *
 * Key Architecture:
 * - Dual-mode execution: 60 FPS fast drafting during interaction; physical ray accumulation when stationary.
 * - Automatic GPU Sleep: once target samples converge (e.g. 48 samples), pauses rendering to keep devices cool.
 * - Non-destructive: temporarily filters out editor helpers (grids, cursor decals) during BVH construction.
 */

import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { PathTracingProgressInfo } from '../types';

export interface StudioPathTracerOptions {
  bounces?: number;
  maxSamples?: number;
  renderScale?: number;
  onProgress?: (info: PathTracingProgressInfo) => void;
}

export class StudioPathTracer {
  private readonly _pathTracer: WebGLPathTracer;
  private readonly _renderer: THREE.WebGLRenderer;
  private _enabled: boolean = false;
  private _maxSamples: number = 48;
  private _bounces: number = 3;
  private _renderScale: number = 1.0;

  private _isStationary: boolean = false;
  private _isSleeping: boolean = false;
  private _sceneInitialized: boolean = false;
  private _needsSceneSync: boolean = true;

  private readonly _lastCameraMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private _onProgress?: (info: PathTracingProgressInfo) => void;
  private _lastReportedSample: number = -1;

  constructor(renderer: THREE.WebGLRenderer, options: StudioPathTracerOptions = {}) {
    this._renderer = renderer;
    this._maxSamples = options.maxSamples ?? 48;
    this._bounces = options.bounces ?? 3;
    this._onProgress = options.onProgress;

    // Detect mobile / low-power devices to set appropriate initial resolution scale
    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    this._renderScale = options.renderScale ?? (isMobile ? 0.85 : 1.0);

    this._pathTracer = new WebGLPathTracer(renderer);
    this._pathTracer.bounces = this._bounces;
    this._pathTracer.renderScale = this._renderScale;
    this._pathTracer.filterGlossyFactor = 0.5;
    this._pathTracer.synchronizeRenderSize = true;
    this._pathTracer.dynamicLowRes = false;
    this._pathTracer.minSamples = 1;
  }

  public enable(enabled: boolean): void {
    if (this._enabled === enabled) return;
    this._enabled = enabled;
    this.reset();
  }

  public get isEnabled(): boolean {
    return this._enabled;
  }

  public setMaxSamples(samples: number): void {
    const clamped = Math.max(8, Math.min(128, samples));
    if (this._maxSamples !== clamped) {
      this._maxSamples = clamped;
      this.reset();
    }
  }

  public get maxSamples(): number {
    return this._maxSamples;
  }

  public setBounces(bounces: number): void {
    const clamped = Math.max(1, Math.min(6, bounces));
    if (this._bounces !== clamped) {
      this._bounces = clamped;
      this._pathTracer.bounces = clamped;
      this.reset();
    }
  }

  public setRenderScale(scale: number): void {
    const clamped = Math.max(0.5, Math.min(1.5, scale));
    if (this._renderScale !== clamped) {
      this._renderScale = clamped;
      this._pathTracer.renderScale = clamped;
      this.reset();
    }
  }

  public setOnProgress(cb?: (info: PathTracingProgressInfo) => void): void {
    this._onProgress = cb;
  }

  /**
   * Flags that scene geometry (strokes, model transforms) has changed
   * and requires a BVH re-synchronization when stationary.
   */
  public markSceneDirty(): void {
    this._needsSceneSync = true;
    this.reset();
  }

  /**
   * Resets temporal sample accumulation and wakes up the ray tracer.
   */
  public reset(): void {
    try {
      this._pathTracer.reset();
    } catch (_) {}
    this._isSleeping = false;
    this._isStationary = false;
    this._lastReportedSample = -1;
    this._notifyProgress(0, false, false);
  }

  public get samples(): number {
    return this._pathTracer.samples;
  }

  public get isSleeping(): boolean {
    return this._isSleeping;
  }

  public get isStationary(): boolean {
    return this._isStationary;
  }

  private _checkCameraMovement(camera: THREE.Camera): boolean {
    const elements = camera.matrixWorld.elements;
    const lastElements = this._lastCameraMatrix.elements;

    let delta = 0;
    for (let i = 0; i < 16; i++) {
      delta += Math.abs(elements[i] - lastElements[i]);
    }

    if (delta > 0.0001) {
      this._lastCameraMatrix.copy(camera.matrixWorld);
      return true;
    }
    return false;
  }

  private _notifyProgress(samples: number, converged: boolean, stationary: boolean): void {
    if (this._onProgress) {
      this._onProgress({
        samples,
        maxSamples: this._maxSamples,
        converged,
        isStationary: stationary,
      });
    }
  }

  /**
   * Safely synchronizes the Three.js scene graph into the path tracer BVH.
   * Temporarily hides editor helpers (grids, planes, brush decals) so they
   * do not cast opaque shadows or block physical rays.
   */
  public syncScene(scene: THREE.Scene, camera: THREE.Camera): void {
    const helpers = scene.getObjectByName('helperRoot') || scene.children.find(c => c.name === 'helperRoot');
    const cursor = scene.getObjectByName('cursorDecal') || scene.children.find(c => c.name === 'cursorDecal');

    const prevHelperVis = helpers ? helpers.visible : true;
    const prevCursorVis = cursor ? cursor.visible : false;

    if (helpers) helpers.visible = false;
    if (cursor) cursor.visible = false;

    try {
      this._pathTracer.setScene(scene, camera);
      this._sceneInitialized = true;
      this._needsSceneSync = false;
    } catch (err) {
      console.warn('[StudioPathTracer] Error building scene BVH:', err);
    } finally {
      if (helpers) helpers.visible = prevHelperVis;
      if (cursor) cursor.visible = prevCursorVis;
    }
  }

  /**
   * Main progressive rendering step called inside the animation loop.
   * Returns true if path tracing drew the frame, or false if the caller
   * should fall back to standard raster rendering (e.g. while moving/drawing).
   */
  public step(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    isInteracting: boolean
  ): boolean {
    if (!this._enabled) return false;

    const cameraMoved = this._checkCameraMovement(camera);

    // If the user is actively drawing or rotating the camera, bypass path tracing
    // and let standard raster render at 60 FPS.
    if (cameraMoved || isInteracting) {
      if (cameraMoved) {
        try {
          this._pathTracer.updateCamera();
        } catch (_) {}
      }
      this._isStationary = false;
      this._isSleeping = false;
      this._pathTracer.reset();
      this._notifyProgress(0, false, false);
      return false;
    }

    // User is stationary and not interacting:
    this._isStationary = true;

    // Check if initial BVH or geometry update is required
    if (!this._sceneInitialized || this._needsSceneSync) {
      this.syncScene(scene, camera);
      this._pathTracer.reset();
    }

    // GPU Sleep: once target samples converge, bypass compute passes
    if (this._pathTracer.samples >= this._maxSamples) {
      if (!this._isSleeping) {
        this._isSleeping = true;
        this._notifyProgress(this._maxSamples, true, true);
      }
      return true; // Canvas already holds the converged frame
    }

    // Render next progressive light ray sample
    try {
      this._pathTracer.renderSample();
      const currentSamples = this._pathTracer.samples;
      const isConverged = currentSamples >= this._maxSamples;

      if (currentSamples !== this._lastReportedSample) {
        this._lastReportedSample = currentSamples;
        this._notifyProgress(currentSamples, isConverged, true);
      }

      if (isConverged) {
        this._isSleeping = true;
      }
      return true;
    } catch (err) {
      console.warn('[StudioPathTracer] Render error:', err);
      return false;
    }
  }

  public dispose(): void {
    try {
      this._pathTracer.dispose();
    } catch (_) {}
  }
}
