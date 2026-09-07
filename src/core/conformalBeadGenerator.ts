import * as THREE from 'three';
import { StrokePoint, BrushSettings, StrokeProfile } from '../types';

// ============================================================================
// Zero-Allocation Math & Vector Scratch Pools
// ============================================================================
class VectorPool {
  private pool: THREE.Vector3[] = [];
  private index = 0;

  public get(): THREE.Vector3 {
    if (this.index >= this.pool.length) {
      this.pool.push(new THREE.Vector3());
    }
    return this.pool[this.index++];
  }

  public reset(): void {
    this.index = 0;
  }
}

const _vecPool = new VectorPool();
const _scratchV1 = new THREE.Vector3();
const _scratchV2 = new THREE.Vector3();
const _scratchV3 = new THREE.Vector3();
const _scratchV4 = new THREE.Vector3();
const _scratchNorm = new THREE.Vector3();
const _scratchBinorm = new THREE.Vector3();
const _scratchTan = new THREE.Vector3();
const _scratchCenter = new THREE.Vector3();
const _scratchJitter = new THREE.Vector3();
const _scratchRadialDir = new THREE.Vector3();
const _scratchPos = new THREE.Vector3();
const _scratchArchNorm = new THREE.Vector3();
const _scratchTipDir = new THREE.Vector3();
const _scratchTipPos = new THREE.Vector3();
const _scratchChiselDir = new THREE.Vector3();

// Reusable working arrays to prevent garbage collection churn
let _workVertices: number[] = [];
let _workNormals: number[] = [];
let _workUvs: number[] = [];
let _workIndices: number[] = [];

/**
 * Volumetric Stroke Geometry Generator
 * Supports 4 distinct geometric profiles:
 * - Tube: 360-degree cylindrical 3D mesh with spherical end-caps (equal volume from all angles)
 * - Ribbon: Flat tape-like cross-section aligned with drawing surface / plane
 * - Marker / Chisel: Asymmetric rectangular profile with calligraphic angle variation
 * - Conformal: Arched dome cross-section snapped to surface curvature
 *
 * Fully optimized for zero-allocation real-time drawing & in-place dynamic vertex updates.
 */
export class ConformalBeadGenerator {
  private raycaster: THREE.Raycaster;

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * Builds volumetric stroke geometry from sampled points and brush profile settings
   */
  public generateGeometry(
    rawPoints: StrokePoint[],
    settings: BrushSettings,
    targetMeshes: THREE.Mesh[] = []
  ): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    return this.updateBufferGeometry(geom, rawPoints, settings, targetMeshes);
  }

  /**
   * Zero-allocation in-place buffer update.
   * If targetGeom already contains allocated buffers with adequate capacity,
   * it updates the Float32Arrays directly and sets drawRange without GC allocations.
   */
  public updateBufferGeometry(
    targetGeom: THREE.BufferGeometry,
    rawPoints: StrokePoint[],
    settings: BrushSettings,
    targetMeshes: THREE.Mesh[] = []
  ): THREE.BufferGeometry {
    if (!rawPoints || rawPoints.length === 0) {
      targetGeom.setDrawRange(0, 0);
      return targetGeom;
    }

    _vecPool.reset();
    _workVertices.length = 0;
    _workNormals.length = 0;
    _workUvs.length = 0;
    _workIndices.length = 0;

    // Filter micro-jitter
    const filteredPoints: StrokePoint[] = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length; i++) {
      const prev = filteredPoints[filteredPoints.length - 1];
      const curr = rawPoints[i];
      if (prev.position.distanceTo(curr.position) > 0.0008) {
        filteredPoints.push(curr);
      }
    }

    const profile: StrokeProfile = settings.profile || 'ribbon';

    // Handle single dab
    if (filteredPoints.length === 1) {
      this.populateDabData(filteredPoints[0], settings, profile);
      return this.applyDataToGeometry(targetGeom);
    }

    // Interpolate points along centripetal Catmull-Rom curve with surface snapping
    const { positions, normals, pressures } = this.resampleCurve(
      filteredPoints,
      settings.size,
      targetMeshes
    );
    const numPoints = positions.length;

    if (numPoints < 2) {
      this.populateDabData(filteredPoints[0], settings, profile);
      return this.applyDataToGeometry(targetGeom);
    }

    // Compute cumulative distances
    const cumulativeDistances: number[] = [0];
    let totalLength = 0;
    for (let i = 1; i < numPoints; i++) {
      totalLength += positions[i].distanceTo(positions[i - 1]);
      cumulativeDistances.push(totalLength);
    }

    const baseOffset = settings.surfaceOffset ?? 0.003;
    const taperLength = Math.max(0.01, settings.taperLength ?? 0.05);

    // Compute continuous Bishop Rotation Minimizing Frames (RMF) using Double Reflection Method
    const { tangents, normals: bishopNormals, binormals: bishopBinormals } =
      ConformalBeadGenerator.computeBishopRMF(positions, normals);

    switch (profile) {
      case 'tube':
        this.populateTubeData(
          positions,
          bishopNormals,
          bishopBinormals,
          tangents,
          pressures,
          cumulativeDistances,
          totalLength,
          settings,
          baseOffset,
          taperLength
        );
        break;
      case 'ribbon':
        this.populateRibbonData(
          positions,
          bishopNormals,
          bishopBinormals,
          tangents,
          pressures,
          cumulativeDistances,
          totalLength,
          settings,
          baseOffset,
          taperLength
        );
        break;
      case 'marker':
        this.populateMarkerData(
          positions,
          bishopNormals,
          bishopBinormals,
          tangents,
          pressures,
          cumulativeDistances,
          totalLength,
          settings,
          baseOffset,
          taperLength
        );
        break;
      case 'conformal':
      default:
        this.populateConformalData(
          positions,
          bishopNormals,
          bishopBinormals,
          tangents,
          pressures,
          cumulativeDistances,
          totalLength,
          settings,
          targetMeshes,
          baseOffset,
          taperLength
        );
        break;
    }

    return this.applyDataToGeometry(targetGeom);
  }

  /**
   * Uploads working vertex and index data to target BufferGeometry using dynamic draw buffers
   */
  private applyDataToGeometry(geom: THREE.BufferGeometry): THREE.BufferGeometry {
    const vCount = _workVertices.length;
    const iCount = _workIndices.length;

    let posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    let normAttr = geom.getAttribute('normal') as THREE.BufferAttribute | undefined;
    let uvAttr = geom.getAttribute('uv') as THREE.BufferAttribute | undefined;
    let indexAttr = geom.getIndex();

    // Reallocate or reuse position buffer
    if (!posAttr || posAttr.array.length < vCount) {
      const newCapacity = Math.max(vCount * 1.5, 768);
      const newPosArr = new Float32Array(newCapacity);
      newPosArr.set(_workVertices);
      posAttr = new THREE.BufferAttribute(newPosArr, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute('position', posAttr);

      const newNormArr = new Float32Array(newCapacity);
      newNormArr.set(_workNormals);
      normAttr = new THREE.BufferAttribute(newNormArr, 3);
      normAttr.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute('normal', normAttr);

      const newUvArr = new Float32Array((newCapacity / 3) * 2);
      newUvArr.set(_workUvs);
      uvAttr = new THREE.BufferAttribute(newUvArr, 2);
      uvAttr.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute('uv', uvAttr);
    } else {
      (posAttr.array as Float32Array).set(_workVertices);
      posAttr.needsUpdate = true;

      (normAttr!.array as Float32Array).set(_workNormals);
      normAttr!.needsUpdate = true;

      (uvAttr!.array as Float32Array).set(_workUvs);
      uvAttr!.needsUpdate = true;
    }

    // Reallocate or reuse index buffer
    if (!indexAttr || indexAttr.array.length < iCount) {
      const newIndexCapacity = Math.max(iCount * 1.5, 512);
      const newIndexArr = new Uint32Array(newIndexCapacity);
      newIndexArr.set(_workIndices);
      indexAttr = new THREE.BufferAttribute(newIndexArr, 1);
      indexAttr.setUsage(THREE.DynamicDrawUsage);
      geom.setIndex(indexAttr);
    } else {
      (indexAttr.array as Uint32Array).set(_workIndices);
      indexAttr.needsUpdate = true;
    }

    geom.setDrawRange(0, iCount);
    geom.computeBoundingSphere();
    geom.computeBoundingBox();

    return geom;
  }

  /**
   * Computes Bishop Rotation Minimizing Frames (RMF) along curve using the Double Reflection Method (Wang et al. 2008).
   * Eliminates unwanted twist and inflection flipping along arbitrary 3D spatial splines.
   */
  public static computeBishopRMF(
    positions: THREE.Vector3[],
    initialNormals: THREE.Vector3[]
  ): { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] } {
    const n = positions.length;
    if (n < 2) {
      const defaultT = _vecPool.get().set(0, 0, 1);
      const defaultN = _vecPool.get().copy(initialNormals[0] || _scratchV1.set(0, 1, 0)).normalize();
      const defaultB = _vecPool.get().crossVectors(defaultT, defaultN).normalize();
      return { tangents: [defaultT], normals: [defaultN], binormals: [defaultB] };
    }

    const tangents: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const t = _vecPool.get();
      if (i === 0) {
        t.subVectors(positions[1], positions[0]);
      } else if (i === n - 1) {
        t.subVectors(positions[n - 1], positions[n - 2]);
      } else {
        t.subVectors(positions[i + 1], positions[i - 1]);
      }
      if (t.lengthSq() < 1e-8) t.set(0, 0, 1);
      else t.normalize();
      tangents.push(t);
    }

    // Initialize first reference normal r0 orthogonal to t0
    const r0 = _vecPool.get().copy(initialNormals[0] || _scratchV1.set(0, 1, 0));
    // Project r0 orthogonal to t0
    r0.sub(_scratchV1.copy(tangents[0]).multiplyScalar(tangents[0].dot(r0)));
    if (r0.lengthSq() < 1e-4) {
      r0.crossVectors(tangents[0], _scratchV1.set(0, 1, 0));
      if (r0.lengthSq() < 1e-4) {
        r0.crossVectors(tangents[0], _scratchV1.set(1, 0, 0));
      }
    }
    r0.normalize();

    const normals: THREE.Vector3[] = [r0];
    const b0 = _vecPool.get().crossVectors(tangents[0], r0).normalize();
    const binormals: THREE.Vector3[] = [b0];

    // Double Reflection Method (Wang et al. 2008)
    for (let i = 0; i < n - 1; i++) {
      const x_i = positions[i];
      const x_next = positions[i + 1];
      const t_i = tangents[i];
      const t_next = tangents[i + 1];
      const r_i = normals[i];

      const v1 = _scratchV1.subVectors(x_next, x_i);
      const c1 = v1.dot(v1);

      const r_next = _vecPool.get();

      if (c1 > 1e-8) {
        // First reflection across bisecting plane of xi and x_{i+1}
        const r_i_L = _scratchV2.copy(r_i).sub(_scratchV3.copy(v1).multiplyScalar((2.0 / c1) * v1.dot(r_i)));
        const t_i_L = _scratchV4.copy(t_i).sub(_scratchV3.copy(v1).multiplyScalar((2.0 / c1) * v1.dot(t_i)));

        // Second reflection across bisecting plane of t_i^L and t_{i+1}
        const v2 = _scratchV3.subVectors(t_next, t_i_L);
        const c2 = v2.dot(v2);

        if (c2 > 1e-8) {
          r_next.copy(r_i_L).sub(_scratchV4.copy(v2).multiplyScalar((2.0 / c2) * v2.dot(r_i_L)));
        } else {
          r_next.copy(r_i_L);
        }
      } else {
        r_next.copy(r_i);
      }

      // Gram-Schmidt orthogonalization against tangent[i+1]
      r_next.sub(_scratchV1.copy(t_next).multiplyScalar(t_next.dot(r_next))).normalize();
      normals.push(r_next);

      const s_next = _vecPool.get().crossVectors(t_next, r_next).normalize();
      binormals.push(s_next);
    }

    return { tangents, normals, binormals };
  }

  /**
   * 1. Tube Profile: Full 3D Cylindrical Geometry
   */
  private populateTubeData(
    positions: THREE.Vector3[],
    normals: THREE.Vector3[],
    binormals: THREE.Vector3[],
    tangents: THREE.Vector3[],
    pressures: number[],
    cumulativeDistances: number[],
    totalLength: number,
    settings: BrushSettings,
    baseOffset: number,
    taperLength: number
  ): void {
    const numPoints = positions.length;
    const radialSegments = 12;

    const jitterStrength = settings.jitterStrength ?? (settings.spatialJitterEnabled ? 0.25 : 0.0);
    const jitterFreq = settings.jitterFrequency ?? 8.0;
    const jitterAxis = settings.jitterAxis || 'binormal';

    for (let i = 0; i < numPoints; i++) {
      const pos = positions[i];
      const normal = normals[i];
      const binormal = binormals[i];
      const t = totalLength > 0 ? cumulativeDistances[i] / totalLength : i / (numPoints - 1);

      let taper = 1.0;
      if (t < 0.04) {
        taper = Math.sin((t / 0.04) * (Math.PI * 0.5));
      } else if (t > 0.96) {
        taper = Math.sin(((1.0 - t) / 0.04) * (Math.PI * 0.5));
      }
      taper = Math.max(0.01, Math.min(1.0, taper));

      const pressureScale = settings.pressureSensitivity ? Math.max(0.2, pressures[i]) : 1.0;
      const radius = settings.size * pressureScale * taper;

      // Spatial Jitter offset along Bishop frame axes
      _scratchJitter.set(0, 0, 0);
      if (jitterStrength > 0.001) {
        const phase = (cumulativeDistances[i] || i * 0.01) * jitterFreq;
        const noiseNorm = Math.sin(phase * 13.7 + Math.cos(phase * 7.9)) * jitterStrength * radius * 0.5;
        const noiseBinorm = Math.cos(phase * 19.1 + Math.sin(phase * 11.3)) * jitterStrength * radius * 0.5;
        if (jitterAxis === 'normal' || jitterAxis === 'omnidirectional') _scratchJitter.addScaledVector(normal, noiseNorm);
        if (jitterAxis === 'binormal' || jitterAxis === 'omnidirectional') _scratchJitter.addScaledVector(binormal, noiseBinorm);
      }

      _scratchCenter.copy(pos).addScaledVector(normal, baseOffset + radius).add(_scratchJitter);

      for (let j = 0; j < radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        _scratchRadialDir.copy(binormal).multiplyScalar(cosT).addScaledVector(normal, sinT).normalize();
        _scratchPos.copy(_scratchCenter).addScaledVector(_scratchRadialDir, radius);

        _workVertices.push(_scratchPos.x, _scratchPos.y, _scratchPos.z);
        _workNormals.push(_scratchRadialDir.x, _scratchRadialDir.y, _scratchRadialDir.z);
        _workUvs.push(j / radialSegments, t);
      }
    }

    // Cylindrical ring faces
    for (let i = 0; i < numPoints - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const nextJ = (j + 1) % radialSegments;
        const a = i * radialSegments + j;
        const b = (i + 1) * radialSegments + j;
        const c = (i + 1) * radialSegments + nextJ;
        const d = i * radialSegments + nextJ;

        _workIndices.push(a, b, d);
        _workIndices.push(b, c, d);
      }
    }

    // Spherical Start and End Caps
    this.addSphericalEndCap(_workVertices, _workNormals, _workUvs, _workIndices, positions[0], normals[0], binormals[0], tangents[0], 0, radialSegments, settings.size * pressures[0], baseOffset, true);
    this.addSphericalEndCap(_workVertices, _workNormals, _workUvs, _workIndices, positions[numPoints - 1], normals[numPoints - 1], binormals[numPoints - 1], tangents[numPoints - 1], (numPoints - 1) * radialSegments, radialSegments, settings.size * pressures[numPoints - 1], baseOffset, false);
  }

  /**
   * 2. Ribbon Profile: Flat Tape-Like Cross Section
   */
  private populateRibbonData(
    positions: THREE.Vector3[],
    normals: THREE.Vector3[],
    binormals: THREE.Vector3[],
    tangents: THREE.Vector3[],
    pressures: number[],
    cumulativeDistances: number[],
    totalLength: number,
    settings: BrushSettings,
    baseOffset: number,
    taperLength: number
  ): void {
    const numPoints = positions.length;

    const jitterStrength = settings.jitterStrength ?? (settings.spatialJitterEnabled ? 0.25 : 0.0);
    const jitterFreq = settings.jitterFrequency ?? 8.0;
    const jitterAxis = settings.jitterAxis || 'binormal';

    for (let i = 0; i < numPoints; i++) {
      const pos = positions[i];
      const normal = normals[i];
      const binormal = binormals[i];
      const t = totalLength > 0 ? cumulativeDistances[i] / totalLength : i / (numPoints - 1);

      let taper = 1.0;
      if (t < 0.04) {
        taper = Math.sin((t / 0.04) * (Math.PI * 0.5));
      } else if (t > 0.96) {
        taper = Math.sin(((1.0 - t) / 0.04) * (Math.PI * 0.5));
      }
      taper = Math.max(0.01, Math.min(1.0, taper));

      const pressureScale = settings.pressureSensitivity ? Math.max(0.2, pressures[i]) : 1.0;
      const widthMultiplier = Math.max(0.5, Math.min(10.0, settings.brushWidthMultiplier ?? (settings.brushShape === 'wide_flat' ? 3.0 : 1.0)));
      const width = settings.size * pressureScale * taper * 1.5 * widthMultiplier;

      // Spatial Jitter offset along Bishop frame axes
      _scratchJitter.set(0, 0, 0);
      if (jitterStrength > 0.001) {
        const phase = (cumulativeDistances[i] || i * 0.01) * jitterFreq;
        const noiseNorm = Math.sin(phase * 13.7 + Math.cos(phase * 7.9)) * jitterStrength * width * 0.5;
        const noiseBinorm = Math.cos(phase * 19.1 + Math.sin(phase * 11.3)) * jitterStrength * width * 0.5;
        if (jitterAxis === 'normal' || jitterAxis === 'omnidirectional') _scratchJitter.addScaledVector(normal, noiseNorm);
        if (jitterAxis === 'binormal' || jitterAxis === 'omnidirectional') _scratchJitter.addScaledVector(binormal, noiseBinorm);
      }

      _scratchCenter.copy(pos).addScaledVector(normal, baseOffset).add(_scratchJitter);
      const left = _scratchV1.copy(_scratchCenter).addScaledVector(binormal, -width);
      const right = _scratchV2.copy(_scratchCenter).addScaledVector(binormal, width);

      _workVertices.push(left.x, left.y, left.z);
      _workNormals.push(normal.x, normal.y, normal.z);
      _workUvs.push(0.0, t);

      _workVertices.push(right.x, right.y, right.z);
      _workNormals.push(normal.x, normal.y, normal.z);
      _workUvs.push(1.0, t);
    }

    for (let i = 0; i < numPoints - 1; i++) {
      const a = i * 2;
      const b = (i + 1) * 2;
      const c = (i + 1) * 2 + 1;
      const d = i * 2 + 1;

      _workIndices.push(a, b, d);
      _workIndices.push(b, c, d);
    }
  }

  /**
   * 3. Marker / Chisel Profile: Asymmetric Calligraphic Rectangular Profile
   */
  private populateMarkerData(
    positions: THREE.Vector3[],
    normals: THREE.Vector3[],
    binormals: THREE.Vector3[],
    tangents: THREE.Vector3[],
    pressures: number[],
    cumulativeDistances: number[],
    totalLength: number,
    settings: BrushSettings,
    baseOffset: number,
    taperLength: number
  ): void {
    const numPoints = positions.length;

    const chiselAngleRad = ((settings.chiselAngle ?? 45) * Math.PI) / 180;
    const aspectRatio = settings.aspectRatio ?? 3.5;
    const jitterStrength = settings.jitterStrength ?? (settings.spatialJitterEnabled ? 0.25 : 0.0);
    const jitterFreq = settings.jitterFrequency ?? 8.0;
    const jitterAxis = settings.jitterAxis || 'binormal';

    for (let i = 0; i < numPoints; i++) {
      const pos = positions[i];
      const normal = normals[i];
      const binormal = binormals[i];
      const tangent = tangents[i];
      const t = totalLength > 0 ? cumulativeDistances[i] / totalLength : i / (numPoints - 1);

      let taper = 1.0;
      if (t < 0.04) {
        taper = Math.sin((t / 0.04) * (Math.PI * 0.5));
      } else if (t > 0.96) {
        taper = Math.sin(((1.0 - t) / 0.04) * (Math.PI * 0.5));
      }
      taper = Math.max(0.01, Math.min(1.0, taper));

      const pressureScale = settings.pressureSensitivity ? Math.max(0.2, pressures[i]) : 1.0;
      const widthMultiplier = Math.max(0.5, Math.min(10.0, settings.brushWidthMultiplier ?? (settings.brushShape === 'wide_flat' ? 3.0 : 1.0)));
      const baseRadius = settings.size * pressureScale * taper;
      const width = baseRadius * aspectRatio * 0.7 * widthMultiplier;
      const height = baseRadius * 0.35;

      // Rotate chisel plane around surface normal by fixed chisel angle
      _scratchChiselDir.copy(binormal).multiplyScalar(Math.cos(chiselAngleRad)).addScaledVector(tangent, Math.sin(chiselAngleRad)).normalize();

      _scratchJitter.set(0, 0, 0);
      if (jitterStrength > 0.001) {
        const phase = (cumulativeDistances[i] || i * 0.01) * jitterFreq;
        const noiseNorm = Math.sin(phase * 13.7 + Math.cos(phase * 7.9)) * jitterStrength * width * 0.5;
        const noiseBinorm = Math.cos(phase * 19.1 + Math.sin(phase * 11.3)) * jitterStrength * width * 0.5;
        if (jitterAxis === 'normal' || jitterAxis === 'omnidirectional') _scratchJitter.addScaledVector(normal, noiseNorm);
        if (jitterAxis === 'binormal' || jitterAxis === 'omnidirectional') _scratchJitter.addScaledVector(binormal, noiseBinorm);
      }

      _scratchCenter.copy(pos).addScaledVector(normal, baseOffset + height).add(_scratchJitter);

      // 4 corners of rectangular chisel profile
      const pTL = _scratchV1.copy(_scratchCenter).addScaledVector(_scratchChiselDir, -width).addScaledVector(normal, height);
      const pTR = _scratchV2.copy(_scratchCenter).addScaledVector(_scratchChiselDir, width).addScaledVector(normal, height);
      const pBR = _scratchV3.copy(_scratchCenter).addScaledVector(_scratchChiselDir, width).addScaledVector(normal, -height);
      const pBL = _scratchV4.copy(_scratchCenter).addScaledVector(_scratchChiselDir, -width).addScaledVector(normal, -height);

      const corners = [pTL, pTR, pBR, pBL];
      for (let k = 0; k < 4; k++) {
        _workVertices.push(corners[k].x, corners[k].y, corners[k].z);
        _workNormals.push(normal.x, normal.y, normal.z);
        _workUvs.push(k / 3, t);
      }
    }

    for (let i = 0; i < numPoints - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const nextK = (k + 1) % 4;
        const a = i * 4 + k;
        const b = (i + 1) * 4 + k;
        const c = (i + 1) * 4 + nextK;
        const d = i * 4 + nextK;

        _workIndices.push(a, b, d);
        _workIndices.push(b, c, d);
      }
    }
  }

  /**
   * 4. Conformal Profile: Arched Dome Snapped to Surface
   */
  private populateConformalData(
    positions: THREE.Vector3[],
    normals: THREE.Vector3[],
    binormals: THREE.Vector3[],
    tangents: THREE.Vector3[],
    pressures: number[],
    cumulativeDistances: number[],
    totalLength: number,
    settings: BrushSettings,
    targetMeshes: THREE.Mesh[],
    baseOffset: number,
    taperLength: number
  ): void {
    const numPoints = positions.length;
    const segmentsAcross = Math.max(3, settings.archSegments || 5);
    const uValues: number[] = [];
    for (let j = 0; j < segmentsAcross; j++) {
      uValues.push(-1.0 + (2.0 * j) / (segmentsAcross - 1));
    }

    const domeFactor = settings.domeFactor || 0.22;
    const jitterStrength = settings.jitterStrength ?? (settings.spatialJitterEnabled ? 0.25 : 0.0);
    const jitterFreq = settings.jitterFrequency ?? 8.0;
    const jitterAxis = settings.jitterAxis || 'binormal';

    for (let i = 0; i < numPoints; i++) {
      const pos = positions[i];
      const normal = normals[i];
      const binormal = binormals[i];
      const t = totalLength > 0 ? cumulativeDistances[i] / totalLength : i / (numPoints - 1);

      let taper = 1.0;
      if (t < 0.04) {
        taper = Math.sin((t / 0.04) * (Math.PI * 0.5));
      } else if (t > 0.96) {
        taper = Math.sin(((1.0 - t) / 0.04) * (Math.PI * 0.5));
      }
      taper = Math.max(0.01, Math.min(1.0, taper));

      const pressureScale = settings.pressureSensitivity ? Math.max(0.2, pressures[i]) : 1.0;
      const ringRadius = settings.size * pressureScale * taper;

      _scratchJitter.set(0, 0, 0);
      if (jitterStrength > 0.001) {
        const phase = (cumulativeDistances[i] || i * 0.01) * jitterFreq;
        const noiseNorm = Math.sin(phase * 13.7 + Math.cos(phase * 7.9)) * jitterStrength * ringRadius * 0.5;
        const noiseBinorm = Math.cos(phase * 19.1 + Math.sin(phase * 11.3)) * jitterStrength * ringRadius * 0.5;
        if (jitterAxis === 'normal' || jitterAxis === 'omnidirectional') _scratchJitter.addScaledVector(normal, noiseNorm);
        if (jitterAxis === 'binormal' || jitterAxis === 'omnidirectional') _scratchJitter.addScaledVector(binormal, noiseBinorm);
      }

      for (let j = 0; j < segmentsAcross; j++) {
        const u = uValues[j];
        const domeHeight = baseOffset + ringRadius * domeFactor * Math.sqrt(Math.max(0, 1.0 - u * u));
        const lateralOffset = u * ringRadius;

        _scratchPos.copy(pos)
          .addScaledVector(binormal, lateralOffset)
          .addScaledVector(normal, domeHeight)
          .add(_scratchJitter);

        _scratchArchNorm.copy(normal).addScaledVector(binormal, u * 0.4).normalize();

        _workVertices.push(_scratchPos.x, _scratchPos.y, _scratchPos.z);
        _workNormals.push(_scratchArchNorm.x, _scratchArchNorm.y, _scratchArchNorm.z);
        _workUvs.push((u + 1.0) * 0.5, t);
      }
    }

    for (let i = 0; i < numPoints - 1; i++) {
      for (let j = 0; j < segmentsAcross - 1; j++) {
        const a = i * segmentsAcross + j;
        const b = (i + 1) * segmentsAcross + j;
        const c = (i + 1) * segmentsAcross + (j + 1);
        const d = i * segmentsAcross + (j + 1);

        _workIndices.push(a, b, d);
        _workIndices.push(b, c, d);
      }
    }

    // Add Start and End Caps
    this.addEndCap(_workVertices, _workNormals, _workUvs, _workIndices, positions[0], normals[0], binormals[0], tangents[0], 0, segmentsAcross, settings.size * pressures[0], baseOffset, true);
    this.addEndCap(_workVertices, _workNormals, _workUvs, _workIndices, positions[numPoints - 1], normals[numPoints - 1], binormals[numPoints - 1], tangents[numPoints - 1], (numPoints - 1) * segmentsAcross, segmentsAcross, settings.size * pressures[numPoints - 1], baseOffset, false);
  }

  private addEndCap(
    vertices: number[],
    geomNormals: number[],
    uvs: number[],
    indices: number[],
    centerPos: THREE.Vector3,
    normal: THREE.Vector3,
    binormal: THREE.Vector3,
    tangent: THREE.Vector3,
    ringStartIndex: number,
    segmentsAcross: number,
    radius: number,
    baseOffset: number,
    isStart: boolean
  ): void {
    _scratchTipDir.copy(tangent);
    if (isStart) _scratchTipDir.negate();

    _scratchTipPos.copy(centerPos)
      .addScaledVector(_scratchTipDir, radius * 0.35)
      .addScaledVector(normal, baseOffset + radius * 0.15);

    const tipVertexIdx = vertices.length / 3;
    vertices.push(_scratchTipPos.x, _scratchTipPos.y, _scratchTipPos.z);
    geomNormals.push(normal.x, normal.y, normal.z);
    uvs.push(0.5, isStart ? 0.0 : 1.0);

    for (let j = 0; j < segmentsAcross - 1; j++) {
      const ringA = ringStartIndex + j;
      const ringB = ringStartIndex + j + 1;
      if (isStart) {
        indices.push(tipVertexIdx, ringB, ringA);
      } else {
        indices.push(tipVertexIdx, ringA, ringB);
      }
    }
  }

  private addSphericalEndCap(
    vertices: number[],
    geomNormals: number[],
    uvs: number[],
    indices: number[],
    centerPos: THREE.Vector3,
    normal: THREE.Vector3,
    binormal: THREE.Vector3,
    tangent: THREE.Vector3,
    ringStartIndex: number,
    radialSegments: number,
    radius: number,
    baseOffset: number,
    isStart: boolean
  ): void {
    _scratchTipDir.copy(tangent);
    if (isStart) _scratchTipDir.negate();

    _scratchTipPos.copy(centerPos)
      .addScaledVector(normal, baseOffset + radius)
      .addScaledVector(_scratchTipDir, radius);

    const tipIdx = vertices.length / 3;
    vertices.push(_scratchTipPos.x, _scratchTipPos.y, _scratchTipPos.z);
    geomNormals.push(_scratchTipDir.x, _scratchTipDir.y, _scratchTipDir.z);
    uvs.push(0.5, isStart ? 0.0 : 1.0);

    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const a = ringStartIndex + j;
      const b = ringStartIndex + nextJ;
      if (isStart) {
        indices.push(tipIdx, b, a);
      } else {
        indices.push(tipIdx, a, b);
      }
    }
  }

  private populateDabData(
    point: StrokePoint,
    settings: BrushSettings,
    profile: StrokeProfile
  ): void {
    const normal = _scratchNorm.copy(point.normal).normalize();
    const pressureScale = settings.pressureSensitivity ? Math.max(0.3, point.pressure) : 1.0;
    const radius = settings.size * pressureScale;
    const baseOffset = settings.surfaceOffset ?? 0.0015;

    let tangent = _scratchTan.set(0, 1, 0);
    if (Math.abs(normal.y) > 0.9) {
      tangent.set(1, 0, 0);
    }
    const binormal = _scratchBinorm.crossVectors(normal, tangent).normalize();
    tangent.crossVectors(binormal, normal).normalize();

    const radialSegments = profile === 'marker' ? 4 : 16;
    const centerPos = _scratchCenter.copy(point.position).addScaledVector(normal, baseOffset);

    _workVertices.push(centerPos.x, centerPos.y, centerPos.z);
    _workNormals.push(normal.x, normal.y, normal.z);
    _workUvs.push(0.5, 0.5);

    for (let s = 0; s < radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      _scratchPos.copy(centerPos)
        .addScaledVector(tangent, cosT * radius)
        .addScaledVector(binormal, sinT * radius);

      _workVertices.push(_scratchPos.x, _scratchPos.y, _scratchPos.z);
      _workNormals.push(normal.x, normal.y, normal.z);
      _workUvs.push(0.5 + cosT * 0.5, 0.5 + sinT * 0.5);
    }

    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      _workIndices.push(0, 1 + s, 1 + nextS);
    }
  }

  /**
   * Resamples raw points using centripetal Catmull-Rom spline interpolation,
   * 7-point Gaussian velocity smoothing, and start/end whip clamping.
   */
  private resampleCurve(
    points: StrokePoint[],
    brushSize: number,
    targetMeshes: THREE.Mesh[] = []
  ): { positions: THREE.Vector3[]; normals: THREE.Vector3[]; pressures: number[]; velocities: number[] } {
    if (points.length < 2) {
      return {
        positions: points.map((p) => _vecPool.get().copy(p.position)),
        normals: points.map((p) => _vecPool.get().copy(p.normal)),
        pressures: points.map((p) => p.pressure),
        velocities: [0],
      };
    }

    // 1. Calculate raw instantaneous velocities
    const rawVelocities: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      const dt = Math.max(1, points[i].time - points[i - 1].time) * 0.001;
      const dist = points[i].position.distanceTo(points[i - 1].position);
      rawVelocities.push(dist / dt);
    }

    // 2. 7-point Gaussian-weighted velocity kernel [1, 4, 8, 12, 8, 4, 1] / 38
    const kernel = [1, 4, 8, 12, 8, 4, 1];
    const smoothedVelocities: number[] = [];

    for (let i = 0; i < points.length; i++) {
      let vSum = 0;
      let wSum = 0;
      for (let k = -3; k <= 3; k++) {
        const idx = i + k;
        if (idx >= 0 && idx < points.length) {
          const w = kernel[k + 3];
          vSum += rawVelocities[idx] * w;
          wSum += w;
        }
      }
      smoothedVelocities.push(wSum > 0 ? vSum / wSum : rawVelocities[i]);
    }

    // 3. Start/End Whip Clamping
    if (smoothedVelocities.length >= 6) {
      const refVStart = smoothedVelocities[3] || 1.0;
      for (let i = 0; i < 3; i++) {
        smoothedVelocities[i] = Math.min(smoothedVelocities[i], refVStart * 1.5);
      }
      const endIdx = smoothedVelocities.length - 1;
      const refVEnd = smoothedVelocities[endIdx - 3] || 1.0;
      for (let i = endIdx - 2; i <= endIdx; i++) {
        smoothedVelocities[i] = Math.min(smoothedVelocities[i], refVEnd * 1.5);
      }
    }

    const vectorPoints = points.map((p) => p.position);
    const curve = new THREE.CatmullRomCurve3(vectorPoints, false, 'centripetal', 0.5);

    const stepSize = Math.max(0.005, brushSize * 0.35);
    const length = curve.getLength();
    const divisions = Math.max(4, Math.min(180, Math.ceil(length / stepSize)));

    const rawPoints = curve.getPoints(divisions);
    const sampledPositions: THREE.Vector3[] = [];
    const sampledNormals: THREE.Vector3[] = [];
    const sampledPressures: number[] = [];
    const sampledVelocities: number[] = [];

    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const rawIndex = t * (points.length - 1);
      const idxA = Math.floor(rawIndex);
      const idxB = Math.min(points.length - 1, idxA + 1);
      const frac = rawIndex - idxA;

      const normA = points[idxA].normal;
      const normB = points[idxB].normal;
      const interpNorm = _vecPool.get().copy(normA).lerp(normB, frac).normalize();
      const pos = _vecPool.get().copy(rawPoints[i]);

      sampledPositions.push(pos);
      sampledNormals.push(interpNorm);

      const pressA = points[idxA].pressure || 1.0;
      const pressB = points[idxB].pressure || 1.0;
      sampledPressures.push(pressA + (pressB - pressA) * frac);

      const velA = smoothedVelocities[idxA] || 0;
      const velB = smoothedVelocities[idxB] || 0;
      sampledVelocities.push(velA + (velB - velA) * frac);
    }

    return {
      positions: sampledPositions,
      normals: sampledNormals,
      pressures: sampledPressures,
      velocities: sampledVelocities,
    };
  }
}

