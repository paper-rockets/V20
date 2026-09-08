/**
 * @license
 * Studio Lighting & Environment Controller
 *
 * Manages PBR directional lights, ambient & hemisphere illumination,
 * seamless studio cyclorama backdrop, soft shadows, and ground grid.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LightingPreset, ModelDisplayMode } from '../types';
import { QualityProfile } from '../utils/deviceProfile';
import { ProceduralSkyEngine } from './proceduralSky';

export interface StudioLightingState {
  mode: 'studio' | 'north' | 'softbox' | 'silhouette';
  intensity: number;
  softness: number;
  color: string;
  direction: { x: number; y: number; z: number };
  shadowFloor: boolean;
  showGrid: boolean;
}

export interface LightingControllerOptions {
  scene: THREE.Scene;
  helperRoot: THREE.Group;
  renderer: THREE.WebGLRenderer;
  profile: QualityProfile;
  onDirty: () => void;
  onSetModelDisplayMode?: (mode: ModelDisplayMode) => void;
  onApplySkyPresetIfEnabled?: (preset: string) => void;
  getSkyEngine?: () => ProceduralSkyEngine | null;
}

export class LightingController {
  private scene: THREE.Scene;
  private helperRoot: THREE.Group;
  private renderer: THREE.WebGLRenderer;
  private profile: QualityProfile;
  private onDirty: () => void;
  private onSetModelDisplayMode?: (mode: ModelDisplayMode) => void;
  private onApplySkyPresetIfEnabled?: (preset: string) => void;
  private getSkyEngine?: () => ProceduralSkyEngine | null;

  public lightsRoot: THREE.Group;
  public ambientLight!: THREE.AmbientLight;
  public hemiLight!: THREE.HemisphereLight;
  public dirLight1!: THREE.DirectionalLight;
  public dirLight2!: THREE.DirectionalLight;

  public gridHelper: THREE.GridHelper | null = null;
  public studioGroundMesh: THREE.Mesh | null = null;
  public studioBackdropTexture: THREE.CanvasTexture | null = null;
  public generatedEnvTexture: THREE.Texture | null = null;
  public currentStudioTheme: 'light' | 'dark' = 'light';

  public studioLightingState: StudioLightingState = {
    mode: 'studio',
    intensity: 1.6,
    softness: 0.65,
    color: '#fff7ec',
    direction: { x: 4.5, y: 7.5, z: 5.0 },
    shadowFloor: true,
    showGrid: true,
  };

  constructor(options: LightingControllerOptions) {
    this.scene = options.scene;
    this.helperRoot = options.helperRoot;
    this.renderer = options.renderer;
    this.profile = options.profile;
    this.onDirty = options.onDirty;
    this.onSetModelDisplayMode = options.onSetModelDisplayMode;
    this.onApplySkyPresetIfEnabled = options.onApplySkyPresetIfEnabled;
    this.getSkyEngine = options.getSkyEngine;

    this.lightsRoot = new THREE.Group();
    this.lightsRoot.name = 'LightsRoot';
    this.scene.add(this.lightsRoot);

    this.initLightingAndStage();
  }

  private initLightingAndStage(): void {
    // 1. Grid Helper
    this.gridHelper = new THREE.GridHelper(10, 20, 0xe2e8f0, 0xf1f5f9);
    this.gridHelper.position.y = -1.2;
    this.helperRoot.add(this.gridHelper);

    // 2. Seamless product-photography stage
    const studioGroundMaterial = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: 0.24,
      transparent: true,
      depthWrite: false,
    });
    this.studioGroundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      studioGroundMaterial
    );
    this.studioGroundMesh.name = 'StudioGroundPlane';
    this.studioGroundMesh.rotation.x = -Math.PI / 2;
    this.studioGroundMesh.position.y = -1.205;
    this.studioGroundMesh.receiveShadow = true;
    this.helperRoot.add(this.studioGroundMesh);
    this.applyStudioBackdrop('light');

    // 3. PBR Baseline Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.7);
    this.hemiLight.position.set(0, 20, 0);

    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight1.position.set(5, 10, 7);
    this.dirLight1.castShadow = true;
    this.dirLight1.shadow.mapSize.width = 2048;
    this.dirLight1.shadow.mapSize.height = 2048;
    this.dirLight1.shadow.camera.left = -6;
    this.dirLight1.shadow.camera.right = 6;
    this.dirLight1.shadow.camera.top = 6;
    this.dirLight1.shadow.camera.bottom = -6;
    this.dirLight1.shadow.camera.near = 0.1;
    this.dirLight1.shadow.camera.far = 30;
    this.dirLight1.shadow.bias = -0.00035;
    this.dirLight1.shadow.normalBias = 0.025;
    this.dirLight1.shadow.radius = 4;

    this.dirLight2 = new THREE.DirectionalLight(0xdbeafe, 0.6);
    this.dirLight2.position.set(-5, -2, -5);

    this.lightsRoot.add(this.ambientLight);
    this.lightsRoot.add(this.hemiLight);
    this.lightsRoot.add(this.dirLight1);
    this.lightsRoot.add(this.dirLight2);

    this.ensureBaselineLighting();
  }

  public setLightingPreset(preset: LightingPreset): void {
    this.ensureBaselineLighting();
    switch (preset) {
      case 'studio':
        this.setStudioLightingMode('studio');
        break;
      case 'daylight':
        this.onApplySkyPresetIfEnabled?.('clear-day');
        break;
      case 'neon':
        this.onApplySkyPresetIfEnabled?.('cyberpunk-neon');
        break;
      case 'sunset':
        this.onApplySkyPresetIfEnabled?.('sunset-dusk');
        break;
      case 'clay_neutral':
        this.setStudioLightingMode('studio');
        this.onSetModelDisplayMode?.('clay');
        break;
    }
  }

  public getStudioLightingState(): Readonly<StudioLightingState> {
    return {
      ...this.studioLightingState,
      direction: { ...this.studioLightingState.direction },
    };
  }

  public setStudioLightingMode(mode: 'studio' | 'north' | 'softbox' | 'silhouette'): void {
    this.ensureBaselineLighting();
    this.studioLightingState.mode = mode;
    const skyEngine = this.getSkyEngine?.();
    if (skyEngine) {
      skyEngine.setCustomOffBackground(this.studioBackdropTexture);
      skyEngine.applyPreset('off');
    }
    if (this.studioBackdropTexture) {
      this.scene.background = this.studioBackdropTexture;
    }

    const isLight = this.currentStudioTheme === 'light';

    switch (mode) {
      case 'studio':
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.32;
        this.hemiLight.color.setHex(0xfff7ee);
        this.hemiLight.groundColor.setHex(isLight ? 0xb5ab9f : 0x1a1b1d);
        this.hemiLight.intensity = 0.52;
        this.dirLight1.color.setHex(0xfff7ec);
        this.dirLight1.position.set(4.5, 7.5, 5.0);
        this.dirLight1.intensity = 1.6;
        this.dirLight1.shadow.radius = 7;
        this.dirLight2.color.setHex(0xe2e8f0);
        this.dirLight2.position.set(-4.5, 3.2, -4.0);
        this.dirLight2.intensity = 0.38;
        this.studioLightingState.color = '#fff7ec';
        this.studioLightingState.intensity = 1.6;
        break;

      case 'north':
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.38;
        this.hemiLight.color.setHex(0xecf2fa);
        this.hemiLight.groundColor.setHex(isLight ? 0xb2abb5 : 0x181a1d);
        this.hemiLight.intensity = 0.65;
        this.dirLight1.color.setHex(0xf0f4fc);
        this.dirLight1.position.set(0.8, 9.5, 3.0);
        this.dirLight1.intensity = 1.45;
        this.dirLight1.shadow.radius = 10;
        this.dirLight2.color.setHex(0xdbeafe);
        this.dirLight2.position.set(-1.0, 2.0, -4.5);
        this.dirLight2.intensity = 0.25;
        this.studioLightingState.color = '#f0f4fc';
        this.studioLightingState.intensity = 1.45;
        break;

      case 'softbox':
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.44;
        this.hemiLight.color.setHex(0xfffcf5);
        this.hemiLight.groundColor.setHex(isLight ? 0xbaaead : 0x222428);
        this.hemiLight.intensity = 0.7;
        this.dirLight1.color.setHex(0xfff9f2);
        this.dirLight1.position.set(3.8, 6.2, 4.5);
        this.dirLight1.intensity = 1.5;
        this.dirLight1.shadow.radius = 12;
        this.dirLight2.color.setHex(0xf1f5f9);
        this.dirLight2.position.set(-3.8, 4.5, 2.5);
        this.dirLight2.intensity = 0.48;
        this.studioLightingState.color = '#fff9f2';
        this.studioLightingState.intensity = 1.5;
        break;

      case 'silhouette':
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.16;
        this.hemiLight.color.setHex(0xe2e8f0);
        this.hemiLight.groundColor.setHex(isLight ? 0x908a82 : 0x0f1011);
        this.hemiLight.intensity = 0.28;
        this.dirLight1.color.setHex(0xfffaed);
        this.dirLight1.position.set(-3.5, 4.5, -5.5);
        this.dirLight1.intensity = 2.4;
        this.dirLight1.shadow.radius = 5;
        this.dirLight2.color.setHex(0xdbeafe);
        this.dirLight2.position.set(3.5, 2.8, -4.5);
        this.dirLight2.intensity = 1.4;
        this.studioLightingState.color = '#fffaed';
        this.studioLightingState.intensity = 2.4;
        break;
    }
    this.onDirty();
  }

  public setStudioSoftness(softness?: number): void {
    const safeSoftness = typeof softness === 'number' && !isNaN(softness) ? softness : 0.65;
    const s = Math.max(0.1, Math.min(1.0, safeSoftness));
    this.studioLightingState.softness = s;
    if (this.dirLight1 && this.dirLight1.shadow) {
      this.dirLight1.shadow.radius = 2 + s * 12;
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = 0.35 + s * 0.45;
    }
    this.onDirty();
  }

  public setStudioLightDirection(dir?: { x: number; y: number; z: number }): void {
    if (!dir || typeof dir.x !== 'number' || typeof dir.y !== 'number' || typeof dir.z !== 'number') return;
    this.studioLightingState.direction = { x: dir.x, y: dir.y, z: dir.z };
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dist = 9.5;
    if (this.dirLight1) {
      this.dirLight1.position.set(
        (dir.x / len) * dist,
        Math.max(1.8, (dir.y / len) * dist),
        (dir.z / len) * dist
      );
      this.dirLight1.updateMatrixWorld();
    }
    if (this.dirLight2) {
      const fillDist = 6.5;
      this.dirLight2.position.set(
        (-dir.x / len) * fillDist,
        Math.max(1.5, Math.abs(dir.y / len) * 0.5 * fillDist + 1.2),
        (-dir.z / len) * fillDist
      );
      this.dirLight2.updateMatrixWorld();
    }
    this.onDirty();
  }

  public setStudioLightIntensity(intensity?: number): void {
    const safeIntensity = typeof intensity === 'number' && !isNaN(intensity) ? intensity : 1.6;
    this.studioLightingState.intensity = safeIntensity;
    if (this.dirLight1) {
      this.dirLight1.intensity = Math.max(0.2, safeIntensity);
    }
    if (this.hemiLight) {
      this.hemiLight.intensity = Math.max(0.15, safeIntensity * 0.35);
    }
    this.onDirty();
  }

  public setStudioLightColor(colorHex?: string): void {
    if (!colorHex) return;
    this.studioLightingState.color = colorHex;
    if (this.dirLight1) {
      this.dirLight1.color.set(colorHex);
    }
    if (this.hemiLight) {
      this.hemiLight.color.set(colorHex);
    }
    this.onDirty();
  }

  public setStudioFloorShadow(visible: boolean): void {
    this.studioLightingState.shadowFloor = visible;
    if (this.studioGroundMesh) {
      this.studioGroundMesh.visible = visible;
    }
    const contactShadow = this.helperRoot.getObjectByName('ModelGroundContactShadow') as THREE.Mesh | null;
    if (contactShadow) {
      contactShadow.visible = visible;
    }
    this.onDirty();
  }

  public setStudioGridVisible(visible: boolean): void {
    this.studioLightingState.showGrid = visible;
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
    this.onDirty();
  }

  public applyStudioBackdrop(theme: 'light' | 'dark'): void {
    this.studioBackdropTexture?.dispose();
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const light = theme === 'light';
    const glow = ctx.createRadialGradient(480, 420, 24, 512, 512, 780);
    glow.addColorStop(0, light ? '#ede7de' : '#303235');
    glow.addColorStop(0.45, light ? '#dfd7cc' : '#232527');
    glow.addColorStop(1, light ? '#c6beb2' : '#141516');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const studioWash = ctx.createLinearGradient(60, 20, 960, 980);
    studioWash.addColorStop(0, light ? 'rgba(255,250,242,0.18)' : 'rgba(255,255,255,0.035)');
    studioWash.addColorStop(0.46, light ? 'rgba(225,215,202,0.015)' : 'rgba(0,0,0,0.01)');
    studioWash.addColorStop(1, light ? 'rgba(125,110,95,0.08)' : 'rgba(0,0,0,0.22)');
    ctx.fillStyle = studioWash;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let seed = light ? 1847 : 4861;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 72; i += 1) {
      const x = random() * 1024;
      const y = random() * 1024;
      const radius = 38 + random() * 170;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const pale = random() > 0.5;
      const alpha = light ? 0.022 + random() * 0.018 : 0.018 + random() * 0.022;
      const tone = light
        ? (pale ? `rgba(255,250,240,${alpha})` : `rgba(103,88,72,${alpha * 0.7})`)
        : (pale ? `rgba(212,216,216,${alpha})` : `rgba(0,0,0,${alpha})`);
      cloud.addColorStop(0, tone);
      cloud.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cloud;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    ctx.lineCap = 'round';
    for (let i = 0; i < 280; i += 1) {
      const x = random() * 1024;
      const y = random() * 1024;
      const length = 7 + random() * 34;
      const rise = (random() - 0.5) * 5;
      ctx.strokeStyle = light
        ? `rgba(${random() > 0.5 ? '255,252,246' : '105,92,77'},${0.018 + random() * 0.018})`
        : `rgba(${random() > 0.5 ? '220,224,224' : '0,0,0'},${0.018 + random() * 0.02})`;
      ctx.lineWidth = 0.45 + random() * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + length * 0.5, y + rise, x + length, y + rise * 0.35);
      ctx.stroke();
    }

    let grainSeed = light ? 7319 : 9323;
    const grainRandom = () => {
      grainSeed = (grainSeed * 1664525 + 1013904223) >>> 0;
      return grainSeed / 4294967296;
    };
    for (let i = 0; i < 12500; i += 1) {
      const alpha = light ? 0.012 + grainRandom() * 0.018 : 0.014 + grainRandom() * 0.024;
      const value = light ? (grainRandom() > 0.5 ? 255 : 95) : (grainRandom() > 0.5 ? 255 : 0);
      ctx.fillStyle = `rgba(${value},${value},${value},${alpha})`;
      const size = grainRandom() > 0.94 ? 2 : 1;
      ctx.fillRect(grainRandom() * 1024, grainRandom() * 1024, size, size);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    this.studioBackdropTexture = texture;
    this.scene.background = texture;

    const skyEngine = this.getSkyEngine?.();
    if (skyEngine) {
      skyEngine.setCustomOffBackground(texture);
    }
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.currentStudioTheme = theme;
    const gridWasVisible = this.gridHelper?.visible ?? false;
    if (theme === 'light') {
      this.applyStudioBackdrop('light');
      this.renderer.toneMappingExposure = 0.92;
      if (this.gridHelper) {
        this.helperRoot.remove(this.gridHelper);
        this.gridHelper.geometry.dispose();
        this.gridHelper = new THREE.GridHelper(10, 20, 0xcfd8dc, 0xe2e8f0);
        this.gridHelper.position.y = -1.2;
        this.gridHelper.visible = gridWasVisible;
        this.helperRoot.add(this.gridHelper);
      }
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.28;
      this.hemiLight.color.setHex(0xfff8ee);
      this.hemiLight.groundColor.setHex(0xb5ab9f);
      this.hemiLight.intensity = 0.52;
      this.dirLight1.color.setHex(0xfff6ea);
      this.dirLight1.position.set(4.5, 7.5, 5.0);
      this.dirLight1.intensity = 1.6;
      this.dirLight1.shadow.radius = 7;
      this.dirLight2.color.setHex(0xdce7ee);
      this.dirLight2.position.set(-4.5, 3.0, -4.0);
      this.dirLight2.intensity = 0.32;

      const groundMaterial = this.studioGroundMesh?.material as THREE.ShadowMaterial | undefined;
      if (groundMaterial) groundMaterial.opacity = 0.18;
      const contactShadow = this.helperRoot.getObjectByName('ModelGroundContactShadow') as THREE.Mesh | null;
      const contactMaterial = contactShadow?.material as THREE.MeshBasicMaterial | undefined;
      if (contactMaterial) contactMaterial.opacity = 0.48;
    } else {
      this.applyStudioBackdrop('dark');
      this.renderer.toneMappingExposure = 1.0;
      if (this.gridHelper) {
        this.helperRoot.remove(this.gridHelper);
        this.gridHelper.geometry.dispose();
        this.gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
        this.gridHelper.position.y = -1.2;
        this.gridHelper.visible = gridWasVisible;
        this.helperRoot.add(this.gridHelper);
      }
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.32;
      this.hemiLight.color.setHex(0xe4e7eb);
      this.hemiLight.groundColor.setHex(0x191a1c);
      this.hemiLight.intensity = 0.5;
      this.dirLight1.color.setHex(0xfff8f0);
      this.dirLight1.position.set(4.5, 7.5, 5.0);
      this.dirLight1.intensity = 1.6;
      this.dirLight1.shadow.radius = 7;
      this.dirLight2.color.setHex(0xb5c0cc);
      this.dirLight2.position.set(-4.5, 3.0, -4.0);
      this.dirLight2.intensity = 0.35;

      const groundMaterial = this.studioGroundMesh?.material as THREE.ShadowMaterial | undefined;
      if (groundMaterial) groundMaterial.opacity = 0.28;
      const contactShadow = this.helperRoot.getObjectByName('ModelGroundContactShadow') as THREE.Mesh | null;
      const contactMaterial = contactShadow?.material as THREE.MeshBasicMaterial | undefined;
      if (contactMaterial) contactMaterial.opacity = 0.72;
    }
    this.onDirty();
  }

  public toggleGrid(show: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = show;
      this.onDirty();
    }
  }

  public setGrid(show: boolean): void {
    this.toggleGrid(show);
  }

  public ensureBaselineLighting(): void {
    if (!this.lightsRoot) {
      this.lightsRoot = new THREE.Group();
      this.scene.add(this.lightsRoot);
    }

    if (!this.ambientLight || !this.ambientLight.parent) {
      if (!this.ambientLight) {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
      }
      this.lightsRoot.add(this.ambientLight);
    }
    if (this.ambientLight.intensity <= 0) {
      this.ambientLight.intensity = 0.35;
    }

    if (!this.hemiLight || !this.hemiLight.parent) {
      if (!this.hemiLight) {
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.55);
      }
      this.lightsRoot.add(this.hemiLight);
    }

    if (!this.dirLight1 || !this.dirLight1.parent) {
      if (!this.dirLight1) {
        this.dirLight1 = new THREE.DirectionalLight(0xfff7ec, 1.6);
        this.dirLight1.position.set(4.5, 7.5, 5.0);
      }
      this.lightsRoot.add(this.dirLight1);
    }
    if (this.dirLight1.intensity <= 0) {
      this.dirLight1.intensity = 1.6;
    }

    if (!this.dirLight2 || !this.dirLight2.parent) {
      if (!this.dirLight2) {
        this.dirLight2 = new THREE.DirectionalLight(0xe0f2fe, 0.9);
        this.dirLight2.position.set(-6, -2, -6);
      }
      this.lightsRoot.add(this.dirLight2);
    }

    const skyEngine = this.getSkyEngine?.();
    if (skyEngine) {
      if (this.renderer) {
        skyEngine.setRenderer(this.renderer);
      }
      skyEngine.setLights(this.dirLight1, this.ambientLight, this.dirLight2, this.hemiLight);
    }

    if (!this.scene.environment && this.renderer && this.profile.environmentMap) {
      try {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        const roomEnv = new RoomEnvironment();
        const envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
        this.scene.environment = envTexture;
        this.generatedEnvTexture = envTexture;
        pmremGenerator.dispose();
        roomEnv.dispose?.();
      } catch (e) {
        console.warn('Failed to generate baseline environment map:', e);
      }
    }
  }
}
