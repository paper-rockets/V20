import * as THREE from 'three';
import { BentGuideConfig, StrokePoint } from '../types';

export class LoftGuideEngine {
  private bentGuides: Map<string, BentGuideConfig> = new Map();
  private guideRoot: THREE.Group;
  private customPlaneMesh: THREE.Mesh | null = null;
  private customPlaneArrow: THREE.ArrowHelper | null = null;

  constructor() {
    this.guideRoot = new THREE.Group();
    this.guideRoot.name = 'LoftGuidesRoot';
  }

  public getGuideRoot(): THREE.Group {
    return this.guideRoot;
  }

  /**
   * Generates a developable swept ruled surface BufferGeometry from trajectory points
   * with dynamic Catmull-Rom tension resampling, segment density, and cross-section profiles.
   */
  public createBentGuide(
    id: string,
    name: string,
    points: THREE.Vector3[],
    width: number = 0.4,
    opacity: number = 0.45,
    tension: number = 0.5,
    divisions: number = 32,
    twist: number = 0,
    profileCurve: 'ribbon' | 'arc' | 'uchannel' | 'pipe' = 'ribbon'
  ): BentGuideConfig {
    // Remove existing if any
    this.removeBentGuide(id);

    if (!points || points.length < 2) {
      const fallbackPoints = [
        new THREE.Vector3(-0.5, 0, 0),
        new THREE.Vector3(0, 0.2, 0),
        new THREE.Vector3(0.5, 0, 0),
      ];
      points = fallbackPoints;
    }

    // Determine Catmull-Rom curve type based on tension slider (0.0 to 1.0)
    let curveType: 'catmullrom' | 'centripetal' | 'chordal' = 'centripetal';
    let curveTension = 0.5;
    if (tension < 0.25) {
      curveType = 'catmullrom';
      curveTension = 0.0;
    } else if (tension > 0.75) {
      curveType = 'chordal';
      curveTension = 1.0;
    } else {
      curveType = 'centripetal';
      curveTension = tension;
    }

    const curve = new THREE.CatmullRomCurve3(points, false, curveType, curveTension);
    const sampleCount = Math.max(8, Math.min(128, divisions));
    const sampledPts = curve.getPoints(sampleCount);

    const geometry = this.buildSweptGeometry(sampledPts, width, twist, profileCurve);

    const material = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      wireframe: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `bent_guide_${id}`;
    mesh.renderOrder = 3;

    // Attach wireframe outline edge helper for clear spatial visualization
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      wireframe: true,
      transparent: true,
      opacity: opacity * 0.7,
    });
    const wireframeMesh = new THREE.Mesh(geometry, wireframeMat);
    mesh.add(wireframeMesh);

    this.guideRoot.add(mesh);

    const config: BentGuideConfig = {
      id,
      name,
      points,
      width,
      opacity,
      visible: true,
      manifoldMesh: mesh,
      tension,
      divisions: sampleCount,
      twist,
      profileCurve,
    };

    this.bentGuides.set(id, config);
    return config;
  }

  /**
   * Dynamically rebuilds bent guide geometry in real-time when sliders change
   */
  public updateBentGuideParameters(
    id: string,
    params: Partial<{
      width: number;
      opacity: number;
      tension: number;
      divisions: number;
      twist: number;
      profileCurve: 'ribbon' | 'arc' | 'uchannel' | 'pipe';
      visible: boolean;
    }>
  ): BentGuideConfig | null {
    const existing = this.bentGuides.get(id);
    if (!existing) return null;

    const width = params.width !== undefined ? params.width : existing.width;
    const opacity = params.opacity !== undefined ? params.opacity : existing.opacity;
    const tension = params.tension !== undefined ? params.tension : (existing.tension ?? 0.5);
    const divisions = params.divisions !== undefined ? params.divisions : (existing.divisions ?? 32);
    const twist = params.twist !== undefined ? params.twist : (existing.twist ?? 0);
    const profileCurve = params.profileCurve !== undefined ? params.profileCurve : (existing.profileCurve ?? 'ribbon');
    const visible = params.visible !== undefined ? params.visible : existing.visible;

    const guide = this.createBentGuide(
      id,
      existing.name,
      existing.points,
      width,
      opacity,
      tension,
      divisions,
      twist,
      profileCurve
    );
    if (guide && guide.manifoldMesh) {
      guide.visible = visible;
      guide.manifoldMesh.visible = visible;
    }
    return guide;
  }

  public toggleGuideVisibility(id: string, visible: boolean): void {
    const existing = this.bentGuides.get(id);
    if (!existing) return;
    existing.visible = visible;
    if (existing.manifoldMesh) {
      existing.manifoldMesh.visible = visible;
    }
  }

  private buildSweptGeometry(
    sampledPts: THREE.Vector3[],
    width: number,
    twistDeg: number,
    profileCurve: 'ribbon' | 'arc' | 'uchannel' | 'pipe'
  ): THREE.BufferGeometry {
    const divisions = sampledPts.length - 1;
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Profile cross-section relative offsets
    // Ribbon: 2 points [-0.5, 0.5]
    // Arc: 5 points curved down
    // U-Channel: 4 points rectangular trough
    // Pipe: 7 points semi-circle
    type ProfilePoint = { uOffset: number; vOffset: number; normalY: number };
    let profilePts: ProfilePoint[] = [];

    if (profileCurve === 'arc') {
      profilePts = [
        { uOffset: -0.5, vOffset: -0.15, normalY: 0.6 },
        { uOffset: -0.25, vOffset: 0.08, normalY: 0.95 },
        { uOffset: 0.0, vOffset: 0.15, normalY: 1.0 },
        { uOffset: 0.25, vOffset: 0.08, normalY: 0.95 },
        { uOffset: 0.5, vOffset: -0.15, normalY: 0.6 },
      ];
    } else if (profileCurve === 'uchannel') {
      profilePts = [
        { uOffset: -0.5, vOffset: 0.25, normalY: 0.0 },
        { uOffset: -0.4, vOffset: -0.1, normalY: 1.0 },
        { uOffset: 0.4, vOffset: -0.1, normalY: 1.0 },
        { uOffset: 0.5, vOffset: 0.25, normalY: 0.0 },
      ];
    } else if (profileCurve === 'pipe') {
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const ang = (s / steps) * Math.PI;
        profilePts.push({
          uOffset: -Math.cos(ang) * 0.5,
          vOffset: Math.sin(ang) * 0.4,
          normalY: Math.sin(ang),
        });
      }
    } else {
      // Standard ribbon (2 points)
      profilePts = [
        { uOffset: -0.5, vOffset: 0, normalY: 1.0 },
        { uOffset: 0.5, vOffset: 0, normalY: 1.0 },
      ];
    }

    const crossCount = profilePts.length;

    for (let i = 0; i <= divisions; i++) {
      const pt = sampledPts[i];
      const t = i / divisions;

      let tangent = new THREE.Vector3();
      if (i === 0) {
        tangent.subVectors(sampledPts[1], sampledPts[0]);
      } else if (i === divisions) {
        tangent.subVectors(sampledPts[divisions], sampledPts[divisions - 1]);
      } else {
        tangent.subVectors(sampledPts[i + 1], sampledPts[i - 1]);
      }
      tangent.normalize();

      let up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(tangent.dot(up)) > 0.9) {
        up.set(0, 0, 1);
      }
      let binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      let normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

      // Apply swept twist rotation around tangent axis
      if (twistDeg !== 0) {
        const angleRad = ((twistDeg * t) * Math.PI) / 180;
        binormal.applyAxisAngle(tangent, angleRad);
        normal.applyAxisAngle(tangent, angleRad);
      }

      for (let j = 0; j < crossCount; j++) {
        const pDef = profilePts[j];
        const crossOffset = pDef.uOffset * width;
        const heightOffset = pDef.vOffset * width;

        const vertex = new THREE.Vector3()
          .copy(pt)
          .addScaledVector(binormal, crossOffset)
          .addScaledVector(normal, heightOffset);

        vertices.push(vertex.x, vertex.y, vertex.z);
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(j / (crossCount - 1), t);
      }

      if (i < divisions) {
        for (let j = 0; j < crossCount - 1; j++) {
          const row1 = i * crossCount + j;
          const row2 = (i + 1) * crossCount + j;

          indices.push(row1, row2, row1 + 1);
          indices.push(row1 + 1, row2, row2 + 1);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  public removeBentGuide(id: string): void {
    const existing = this.bentGuides.get(id);
    if (existing && existing.manifoldMesh) {
      this.guideRoot.remove(existing.manifoldMesh);
      existing.manifoldMesh.geometry.dispose();
      if (Array.isArray(existing.manifoldMesh.material)) {
        existing.manifoldMesh.material.forEach((m) => m.dispose());
      } else {
        existing.manifoldMesh.material.dispose();
      }
      this.bentGuides.delete(id);
    }
  }

  public removeGuide(id: string): void {
    this.removeBentGuide(id);
  }

  public getBentGuides(): BentGuideConfig[] {
    return Array.from(this.bentGuides.values());
  }

  public getGuides(): BentGuideConfig[] {
    return Array.from(this.bentGuides.values());
  }

  public createBentGuideFromPoints(
    points: THREE.Vector3[],
    name: string = 'Curved Ribbon Guide',
    width: number = 0.35,
    opacity: number = 0.45
  ): BentGuideConfig {
    const id = `guide_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return this.createBentGuide(id, name, points, width, opacity);
  }

  public createPresetGuide(
    preset: 'wave' | 'arch' | 'spiral' | 'saddle',
    width: number = 0.35,
    opacity: number = 0.5
  ): BentGuideConfig {
    const pts: THREE.Vector3[] = [];
    const count = 24;

    switch (preset) {
      case 'wave': {
        for (let i = 0; i <= count; i++) {
          const t = (i / count - 0.5) * 1.6;
          const y = Math.sin(t * Math.PI * 2) * 0.25;
          const z = Math.cos(t * Math.PI) * 0.15;
          pts.push(new THREE.Vector3(t, y, z));
        }
        break;
      }
      case 'arch': {
        for (let i = 0; i <= count; i++) {
          const angle = (i / count) * Math.PI;
          const r = 0.6;
          pts.push(new THREE.Vector3(-Math.cos(angle) * r, Math.sin(angle) * r * 0.8, 0));
        }
        break;
      }
      case 'spiral': {
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const angle = t * Math.PI * 3.5;
          const r = 0.2 + t * 0.4;
          const y = (t - 0.5) * 0.8;
          pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
        }
        break;
      }
      case 'saddle': {
        for (let i = 0; i <= count; i++) {
          const t = (i / count - 0.5) * 1.4;
          const y = (t * t - 0.25) * 0.5;
          const z = Math.sin(t * Math.PI) * 0.3;
          pts.push(new THREE.Vector3(t, y, z));
        }
        break;
      }
    }

    const id = `preset_${preset}_${Date.now()}`;
    const name = `${preset.toUpperCase()} Manifold Guide`;
    return this.createBentGuide(id, name, pts, width, opacity);
  }

  public createOrUpdateMirrorPlaneMesh(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    visible: boolean = true,
    opacity: number = 0.35
  ): void {
    this.updateCustomPlaneVisual(origin, normal, visible, opacity);
  }

  public getActiveGuideMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    this.bentGuides.forEach((g) => {
      if (g.visible && g.manifoldMesh) {
        meshes.push(g.manifoldMesh);
      }
    });
    return meshes;
  }

  /**
   * Real-time Mirror Math across Arbitrary Custom Plane:
   * Equation: P' = P - 2 * ((P - P0) . n) * n
   */
  public static mirrorPointAcrossPlane(
    point: THREE.Vector3,
    planeOrigin: THREE.Vector3,
    planeNormal: THREE.Vector3
  ): THREE.Vector3 {
    const norm = planeNormal.clone().normalize();
    const diff = new THREE.Vector3().subVectors(point, planeOrigin);
    const dist = diff.dot(norm);
    return new THREE.Vector3().copy(point).addScaledVector(norm, -2 * dist);
  }

  public static mirrorNormalAcrossPlane(
    normal: THREE.Vector3,
    planeNormal: THREE.Vector3
  ): THREE.Vector3 {
    const norm = planeNormal.clone().normalize();
    const dist = normal.dot(norm);
    return new THREE.Vector3().copy(normal).addScaledVector(norm, -2 * dist);
  }

  /**
   * Updates or creates visual 3D Custom Mirror Plane in the scene
   */
  public updateCustomPlaneVisual(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    visible: boolean = true,
    opacity: number = 0.35,
    size: number = 2.5
  ): void {
    if (!this.customPlaneMesh) {
      const geo = new THREE.PlaneGeometry(size, size, 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.2,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      this.customPlaneMesh = new THREE.Mesh(geo, mat);
      this.customPlaneMesh.name = 'CustomMirrorPlaneVisual';
      this.customPlaneMesh.renderOrder = 4;

      // Add border grid
      const grid = new THREE.GridHelper(size, 10, 0xa5b4fc, 0x6366f1);
      grid.rotation.x = Math.PI / 2;
      this.customPlaneMesh.add(grid);

      // Add normal arrow
      this.customPlaneArrow = new THREE.ArrowHelper(
        normal.clone().normalize(),
        new THREE.Vector3(0, 0, 0),
        0.5,
        0x38bdf8
      );
      this.customPlaneMesh.add(this.customPlaneArrow);

      this.guideRoot.add(this.customPlaneMesh);
    }

    this.customPlaneMesh.visible = visible;
    this.customPlaneMesh.position.copy(origin);

    // Orient plane towards normal
    const norm = normal.clone().normalize();
    const lookTarget = new THREE.Vector3().addVectors(origin, norm);
    this.customPlaneMesh.lookAt(lookTarget);

    if (this.customPlaneArrow) {
      this.customPlaneArrow.setDirection(new THREE.Vector3(0, 0, 1));
    }
  }

  public dispose(): void {
    this.bentGuides.forEach((g) => {
      if (g.manifoldMesh) {
        g.manifoldMesh.geometry.dispose();
      }
    });
    this.bentGuides.clear();
    if (this.customPlaneMesh) {
      this.guideRoot.remove(this.customPlaneMesh);
      this.customPlaneMesh.geometry.dispose();
      this.customPlaneMesh = null;
    }
  }
}
