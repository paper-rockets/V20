import * as THREE from 'three';
import { StrokeDescriptor, StrokePoint, LiquifySettings, LiquifyMode } from '../types';
import { ConformalBeadGenerator } from './conformalBeadGenerator';

export class VolumetricLiquifyEngine {
  private beadGenerator: ConformalBeadGenerator;
  private baseDescriptors: Map<string, StrokeDescriptor> = new Map();
  private liveDescriptors: Map<string, StrokeDescriptor> = new Map();
  private compareModeActive: boolean = false; // When true, shows base state un-deformed

  constructor(beadGenerator: ConformalBeadGenerator) {
    this.beadGenerator = beadGenerator;
  }

  /**
   * Initializes a session for non-destructive compare & apply
   */
  public startSession(descriptors: StrokeDescriptor[]): void {
    this.baseDescriptors.clear();
    this.liveDescriptors.clear();
    this.compareModeActive = false;

    for (const desc of descriptors) {
      // Deep clone descriptor and stroke points
      const clonedDesc: StrokeDescriptor = {
        ...desc,
        points: desc.points.map((p) => ({
          position: p.position.clone(),
          normal: p.normal.clone(),
          surfaceOffset: p.surfaceOffset,
          pressure: p.pressure,
          tangent: p.tangent ? p.tangent.clone() : undefined,
          binormal: p.binormal ? p.binormal.clone() : undefined,
          uv: p.uv ? p.uv.clone() : undefined,
          hitMeshId: p.hitMeshId,
          isSurfaceHit: p.isSurfaceHit,
          time: p.time,
        })),
        settings: { ...desc.settings },
      };

      const baseDesc: StrokeDescriptor = {
        ...desc,
        points: desc.points.map((p) => ({
          position: p.position.clone(),
          normal: p.normal.clone(),
          surfaceOffset: p.surfaceOffset,
          pressure: p.pressure,
          tangent: p.tangent ? p.tangent.clone() : undefined,
          binormal: p.binormal ? p.binormal.clone() : undefined,
          uv: p.uv ? p.uv.clone() : undefined,
          hitMeshId: p.hitMeshId,
          isSurfaceHit: p.isSurfaceHit,
          time: p.time,
        })),
        settings: { ...desc.settings },
      };

      this.liveDescriptors.set(desc.id, clonedDesc);
      this.baseDescriptors.set(desc.id, baseDesc);
    }
  }

  public beginSession(
    strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>,
    layerId: string
  ): void {
    const layerStrokes: StrokeDescriptor[] = [];
    strokes.forEach((val) => {
      if (val.descriptor.layerId === layerId) {
        layerStrokes.push(val.descriptor);
      }
    });
    this.startSession(layerStrokes);
  }

  public applyDeformation(
    screenX: number,
    screenY: number,
    deltaScreenX: number,
    deltaScreenY: number,
    camera: THREE.Camera,
    strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>,
    settings: LiquifySettings,
    layerId: string
  ): void {
    // Unproject screen coordinates into 3D ray in world space
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(screenX, screenY), camera);

    // Compute average distance of target layer points from camera
    let totalDist = 0;
    let count = 0;
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);

    strokes.forEach((val) => {
      if (val.descriptor.layerId === layerId) {
        for (const pt of val.descriptor.points) {
          totalDist += pt.position.distanceTo(camPos);
          count++;
          if (count > 20) break;
        }
      }
    });

    const depth = count > 0 ? totalDist / count : 2.5;
    const brushCenter = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, depth);

    // Compute drag vector in camera plane
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const dragVector3D = new THREE.Vector3()
      .addScaledVector(camRight, deltaScreenX * depth)
      .addScaledVector(camUp, deltaScreenY * depth);

    const affectedIds = this.applyDeformationRaw(brushCenter, dragVector3D, settings, camera);

    // Update geometry in real-time for affected stroke meshes
    for (const id of affectedIds) {
      const strokeEntry = strokes.get(id);
      const liveDesc = this.liveDescriptors.get(id);
      if (strokeEntry && liveDesc && liveDesc.points.length >= 2) {
        strokeEntry.descriptor.points = liveDesc.points;
        const newGeom = this.beadGenerator.generateGeometry(liveDesc.points, liveDesc.settings);
        if (strokeEntry.meshes.length > 0 && newGeom) {
          strokeEntry.meshes[0].geometry.dispose();
          strokeEntry.meshes[0].geometry = newGeom;
        }
      }
    }
  }

  public toggleCompare(
    active: boolean,
    strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>
  ): void {
    this.setCompareMode(active);
    const descriptors = this.getCurrentDescriptors();
    for (const desc of descriptors) {
      const strokeEntry = strokes.get(desc.id);
      if (strokeEntry && desc.points.length >= 2) {
        strokeEntry.descriptor.points = desc.points;
        const newGeom = this.beadGenerator.generateGeometry(desc.points, desc.settings);
        if (strokeEntry.meshes.length > 0 && newGeom) {
          strokeEntry.meshes[0].geometry.dispose();
          strokeEntry.meshes[0].geometry = newGeom;
        }
      }
    }
  }

  public commit(
    strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>
  ): void {
    this.baseDescriptors.clear();
    this.liveDescriptors.clear();
    this.compareModeActive = false;
  }

  public discard(
    strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>
  ): void {
    const restored = Array.from(this.baseDescriptors.values());
    for (const desc of restored) {
      const strokeEntry = strokes.get(desc.id);
      if (strokeEntry && desc.points.length >= 2) {
        strokeEntry.descriptor.points = desc.points;
        const newGeom = this.beadGenerator.generateGeometry(desc.points, desc.settings);
        if (strokeEntry.meshes.length > 0 && newGeom) {
          strokeEntry.meshes[0].geometry.dispose();
          strokeEntry.meshes[0].geometry = newGeom;
        }
      }
    }
    this.baseDescriptors.clear();
    this.liveDescriptors.clear();
    this.compareModeActive = false;
  }

  public decimateStrokes(
    strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>,
    tolerance: number = 0.006,
    layerId?: string
  ): { before: number; after: number } {
    let before = 0;
    let after = 0;

    strokes.forEach((val) => {
      if (!layerId || val.descriptor.layerId === layerId) {
        const origCount = val.descriptor.points.length;
        before += origCount;

        if (origCount > 2) {
          const decimated = VolumetricLiquifyEngine.decimateCurveRDP(val.descriptor.points, tolerance);
          after += decimated.length;
          val.descriptor.points = decimated;
          const newGeom = this.beadGenerator.generateGeometry(decimated, val.descriptor.settings);
          if (val.meshes.length > 0 && newGeom) {
            val.meshes[0].geometry.dispose();
            val.meshes[0].geometry = newGeom;
          }
        } else {
          after += origCount;
        }
      }
    });

    return { before, after };
  }

  /**
   * Applies volumetric deformation (Push, Pinch, Inflate, Comb) to all vertices within sphere
   */
  public applyDeformationRaw(
    brushCenter: THREE.Vector3,
    dragVector3D: THREE.Vector3,
    settings: LiquifySettings,
    camera: THREE.Camera
  ): string[] {
    const affectedStrokeIds: string[] = [];
    const radius = Math.max(0.01, settings.brushRadius);
    const radiusSq = radius * radius;
    const strength = settings.influenceStrength;

    this.liveDescriptors.forEach((desc, strokeId) => {
      let strokeModified = false;
      const points = desc.points;
      const numPoints = points.length;

      for (let i = 0; i < numPoints; i++) {
        const pt = points[i];
        const distSq = pt.position.distanceToSquared(brushCenter);

        if (distSq < radiusSq) {
          strokeModified = true;
          const dist = Math.sqrt(distSq);
          // Smooth bell falloff: (1 - (d/R)^2)^2
          const normDist = dist / radius;
          const falloff = Math.pow(1 - normDist * normDist, 2);

          switch (settings.mode) {
            case 'push': {
              // Displace vertices along the camera plane drag vector
              pt.position.addScaledVector(dragVector3D, falloff * strength);
              break;
            }

            case 'pinch': {
              // Attract vertices toward brush epicenter
              const dirToCenter = new THREE.Vector3().subVectors(brushCenter, pt.position);
              pt.position.addScaledVector(dirToCenter, falloff * strength * 0.15);
              break;
            }

            case 'inflate': {
              // Repel vertices away from brush epicenter
              const dirFromCenter = new THREE.Vector3().subVectors(pt.position, brushCenter);
              if (dirFromCenter.lengthSq() < 1e-5) {
                dirFromCenter.copy(pt.normal);
              } else {
                dirFromCenter.normalize();
              }
              pt.position.addScaledVector(dirFromCenter, falloff * strength * 0.05 * radius);
              break;
            }

            case 'comb': {
              // Align tangents and smooth noisy oscillations with neighbors
              if (dragVector3D.lengthSq() > 1e-6) {
                pt.position.addScaledVector(dragVector3D, falloff * strength * 0.4);
              }
              if (i > 0 && i < numPoints - 1) {
                const prev = points[i - 1].position;
                const next = points[i + 1].position;
                const avg = new THREE.Vector3().addVectors(prev, next).multiplyScalar(0.5);
                pt.position.lerp(avg, falloff * strength * 0.25);
              }
              break;
            }
          }
        }
      }

      if (strokeModified) {
        affectedStrokeIds.push(strokeId);
      }
    });

    return affectedStrokeIds;
  }

  /**
   * Set Compare A/B Mode: true shows un-deformed base state, false shows live preview
   */
  public setCompareMode(active: boolean): void {
    this.compareModeActive = active;
  }

  public isCompareActive(): boolean {
    return this.compareModeActive;
  }

  /**
   * Retrieves active descriptors (live preview or base depending on compare mode)
   */
  public getCurrentDescriptors(): StrokeDescriptor[] {
    const source = this.compareModeActive ? this.baseDescriptors : this.liveDescriptors;
    return Array.from(source.values());
  }

  /**
   * Commits the current live deformations and returns them for undo stack
   */
  public commitSession(): { previous: StrokeDescriptor[]; modified: StrokeDescriptor[] } {
    const previous = Array.from(this.baseDescriptors.values());
    const modified = Array.from(this.liveDescriptors.values());
    this.baseDescriptors.clear();
    this.liveDescriptors.clear();
    this.compareModeActive = false;
    return { previous, modified };
  }

  /**
   * Discards all modifications and reverts to base descriptors
   */
  public discardSession(): StrokeDescriptor[] {
    const restored = Array.from(this.baseDescriptors.values());
    this.baseDescriptors.clear();
    this.liveDescriptors.clear();
    this.compareModeActive = false;
    return restored;
  }

  /**
   * Ramer-Douglas-Peucker (RDP) 3D Curve Decimation ("Lighten")
   * Recalculates Catmull-Rom splines and Bishop parallel transport frames.
   */
  public static decimateCurveRDP(
    points: StrokePoint[],
    tolerance: number = 0.005
  ): StrokePoint[] {
    if (!points || points.length <= 2) return points;

    // Perpendicular distance in 3D from point P to line segment A-B
    const getPerpendicularDistance = (
      p: THREE.Vector3,
      a: THREE.Vector3,
      b: THREE.Vector3
    ): number => {
      const line = new THREE.Vector3().subVectors(b, a);
      const lenSq = line.lengthSq();
      if (lenSq < 1e-8) {
        return p.distanceTo(a);
      }
      const ap = new THREE.Vector3().subVectors(p, a);
      const cross = new THREE.Vector3().crossVectors(ap, line);
      return cross.length() / Math.sqrt(lenSq);
    };

    const rdpRecursive = (
      pts: StrokePoint[],
      startIdx: number,
      endIdx: number,
      tol: number,
      outIndices: Set<number>
    ) => {
      let maxDist = 0;
      let index = startIdx;

      const a = pts[startIdx].position;
      const b = pts[endIdx].position;

      for (let i = startIdx + 1; i < endIdx; i++) {
        const dist = getPerpendicularDistance(pts[i].position, a, b);
        if (dist > maxDist) {
          maxDist = dist;
          index = i;
        }
      }

      if (maxDist > tol) {
        outIndices.add(index);
        rdpRecursive(pts, startIdx, index, tol, outIndices);
        rdpRecursive(pts, index, endIdx, tol, outIndices);
      }
    };

    const keptIndices = new Set<number>([0, points.length - 1]);
    rdpRecursive(points, 0, points.length - 1, tolerance, keptIndices);

    const sortedIndices = Array.from(keptIndices).sort((x, y) => x - y);
    const decimated = sortedIndices.map((i) => ({
      ...points[i],
      position: points[i].position.clone(),
      normal: points[i].normal.clone(),
      tangent: points[i].tangent ? points[i].tangent.clone() : undefined,
      binormal: points[i].binormal ? points[i].binormal.clone() : undefined,
    }));

    // Recalculate Bishop Parallel Transport Frames across decimated curve
    return VolumetricLiquifyEngine.computeBishopFrames(decimated);
  }

  /**
   * Computes Bishop Parallel Transport Frames (Rotation Minimizing Frames)
   * eliminating twist / inflection artifacts along 3D Catmull-Rom splines.
   */
  public static computeBishopFrames(points: StrokePoint[]): StrokePoint[] {
    const n = points.length;
    if (n < 2) return points;

    const tangents: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      let t = new THREE.Vector3();
      if (i === 0) {
        t.subVectors(points[1].position, points[0].position);
      } else if (i === n - 1) {
        t.subVectors(points[n - 1].position, points[n - 2].position);
      } else {
        t.subVectors(points[i + 1].position, points[i - 1].position);
      }
      if (t.lengthSq() < 1e-6) t.set(0, 0, 1);
      else t.normalize();
      tangents.push(t);
    }

    // Initialize first reference normal
    let initialNormal = points[0].normal.clone();
    if (initialNormal.lengthSq() < 1e-4) {
      initialNormal.crossVectors(tangents[0], new THREE.Vector3(0, 1, 0));
      if (initialNormal.lengthSq() < 1e-4) {
        initialNormal.crossVectors(tangents[0], new THREE.Vector3(1, 0, 0));
      }
    }
    initialNormal.normalize();

    const normals: THREE.Vector3[] = [initialNormal];
    const binormals: THREE.Vector3[] = [
      new THREE.Vector3().crossVectors(tangents[0], initialNormal).normalize(),
    ];

    // Parallel transport normal vector from i to i+1
    for (let i = 0; i < n - 1; i++) {
      const t0 = tangents[i];
      const t1 = tangents[i + 1];
      const v = new THREE.Vector3().crossVectors(t0, t1);
      const c = t0.dot(t1);

      let nextNorm = normals[i].clone();
      if (v.lengthSq() > 1e-6) {
        const axis = v.clone().normalize();
        const angle = Math.acos(Math.max(-1, Math.min(1, c)));
        nextNorm.applyAxisAngle(axis, angle);
      }
      nextNorm.normalize();
      normals.push(nextNorm);

      const nextBinorm = new THREE.Vector3().crossVectors(t1, nextNorm).normalize();
      binormals.push(nextBinorm);
    }

    // Assign smoothly transported frames
    for (let i = 0; i < n; i++) {
      points[i].tangent = tangents[i];
      points[i].normal = normals[i];
      points[i].binormal = binormals[i];
    }

    return points;
  }
}
