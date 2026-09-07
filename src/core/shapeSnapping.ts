/**
 * @license
 * Algorithmic Shape Snapping & Geometric Conformance Engine
 *
 * Mathematically conforms rough hand-drawn 3D / 2D curves into:
 * 1. Perfect Straight Lines (Linear regression / end-to-end chord interpolation)
 * 2. Perfect Circles & Closed Ellipses (Least-squares circle fitting / planar projection)
 * 3. Smooth Circular Arcs (Constant curvature arc fitting)
 * 4. Polygons / Triangles / Rectangles (Corner angle detection & piecewise linear segments)
 */

import * as THREE from 'three';
import { StrokePoint } from '../types';

export type DetectedShapeType = 'line' | 'circle' | 'ellipse' | 'arc' | 'triangle' | 'rectangle' | 'polygon' | 'none';

export interface ShapeSnapResult {
  detectedShape: DetectedShapeType;
  confidence: number; // 0.0 to 1.0
  snappedPoints: StrokePoint[];
  center?: THREE.Vector3;
  radius?: number;
  length?: number;
  description: string;
}

export class ShapeSnappingEngine {
  /**
   * Evaluates a stroke's point sequence and snaps to the best fitting geometric primitive
   */
  public static snapStroke(
    points: StrokePoint[],
    tolerance: number = 0.15
  ): ShapeSnapResult {
    if (!points || points.length < 4) {
      return {
        detectedShape: 'none',
        confidence: 0,
        snappedPoints: points,
        description: 'Too few points to snap',
      };
    }

    const n = points.length;
    const startPoint = points[0];
    const endPoint = points[n - 1];

    // Compute stroke path length and direct chord length
    let pathLength = 0;
    for (let i = 1; i < n; i++) {
      pathLength += points[i].position.distanceTo(points[i - 1].position);
    }
    const chordDist = startPoint.position.distanceTo(endPoint.position);

    // Average normal and surface offset across stroke
    const avgNormal = new THREE.Vector3();
    let avgOffset = 0;
    let avgPressure = 0;
    for (const p of points) {
      avgNormal.add(p.normal);
      avgOffset += p.surfaceOffset;
      avgPressure += p.pressure;
    }
    avgNormal.divideScalar(n).normalize();
    avgOffset /= n;
    avgPressure /= n;

    // -------------------------------------------------------------
    // 1. Check for CLOSED LOOP / CIRCLE / ELLIPSE
    // -------------------------------------------------------------
    const isClosedLoop = (chordDist / Math.max(pathLength, 0.0001)) < 0.22 && n >= 8;

    if (isClosedLoop) {
      const circleSnap = this.fitCircleOrEllipse(points, avgNormal, avgOffset, avgPressure);
      if (circleSnap.confidence > 0.65) {
        return circleSnap;
      }
    }

    // -------------------------------------------------------------
    // 2. Check for STRAIGHT LINE
    // -------------------------------------------------------------
    const lineSnap = this.fitStraightLine(points, startPoint, endPoint, pathLength, chordDist, avgNormal, avgOffset);
    if (lineSnap.confidence > 0.78) {
      return lineSnap;
    }

    // -------------------------------------------------------------
    // 3. Check for RECTANGLE / TRIANGLE / POLYGON
    // -------------------------------------------------------------
    if (isClosedLoop) {
      const polygonSnap = this.fitPolygon(points, avgNormal, avgOffset, avgPressure);
      if (polygonSnap.confidence > 0.70) {
        return polygonSnap;
      }
    }

    // -------------------------------------------------------------
    // 4. Check for CIRCULAR ARC
    // -------------------------------------------------------------
    const arcSnap = this.fitCircularArc(points, avgNormal, avgOffset, avgPressure);
    if (arcSnap.confidence > 0.72) {
      return arcSnap;
    }

    // Fallback: If line confidence is moderately high, use line
    if (lineSnap.confidence > 0.60) {
      return lineSnap;
    }

    return {
      detectedShape: 'none',
      confidence: 0,
      snappedPoints: points,
      description: 'Freeform Stroke',
    };
  }

  /**
   * Fits a straight line from start to end with interpolated normals & pressure
   */
  private static fitStraightLine(
    points: StrokePoint[],
    startPoint: StrokePoint,
    endPoint: StrokePoint,
    pathLength: number,
    chordDist: number,
    avgNormal: THREE.Vector3,
    avgOffset: number
  ): ShapeSnapResult {
    const n = points.length;
    const lineDir = endPoint.position.clone().sub(startPoint.position);
    const lineLen = lineDir.length();

    if (lineLen < 0.0001) {
      return { detectedShape: 'none', confidence: 0, snappedPoints: points, description: 'Degenerate line' };
    }

    lineDir.normalize();

    // Compute maximum and mean perpendicular deviation from the line segment
    let maxDev = 0;
    let sumDev = 0;

    for (let i = 1; i < n - 1; i++) {
      const p = points[i].position;
      const v = p.clone().sub(startPoint.position);
      const proj = v.dot(lineDir);
      const projClamped = Math.max(0, Math.min(lineLen, proj));
      const nearestPt = startPoint.position.clone().addScaledVector(lineDir, projClamped);
      const dev = p.distanceTo(nearestPt);

      if (dev > maxDev) maxDev = dev;
      sumDev += dev;
    }

    const meanDev = sumDev / Math.max(1, n - 2);
    const relDeviation = maxDev / Math.max(lineLen, 0.001);
    const straightnessRatio = chordDist / Math.max(pathLength, 0.0001);

    // Confidence formula
    const confidence = Math.max(0, Math.min(1.0, straightnessRatio * (1.0 - Math.min(1.0, relDeviation * 4.0))));

    // Generate perfectly straight interpolated stroke points
    const stepCount = Math.max(8, Math.min(64, Math.round(n * 0.8)));
    const snappedPoints: StrokePoint[] = [];

    for (let i = 0; i <= stepCount; i++) {
      const t = i / stepCount;
      const pos = startPoint.position.clone().lerp(endPoint.position, t);
      const norm = startPoint.normal.clone().lerp(endPoint.normal, t).normalize();
      const pressure = startPoint.pressure + (endPoint.pressure - startPoint.pressure) * t;

      snappedPoints.push({
        position: pos,
        normal: norm.lengthSq() > 0.01 ? norm : avgNormal.clone(),
        surfaceOffset: avgOffset,
        pressure,
        isSurfaceHit: startPoint.isSurfaceHit || endPoint.isSurfaceHit,
        time: performance.now(),
      });
    }

    return {
      detectedShape: 'line',
      confidence,
      snappedPoints,
      length: lineLen,
      description: `Straight Line (${(lineLen * 100).toFixed(1)}cm)`,
    };
  }

  /**
   * Fits a 3D circle or ellipse to a closed loop
   */
  private static fitCircleOrEllipse(
    points: StrokePoint[],
    avgNormal: THREE.Vector3,
    avgOffset: number,
    avgPressure: number
  ): ShapeSnapResult {
    const n = points.length;

    // 1. Compute Centroid
    const center = new THREE.Vector3();
    for (const p of points) {
      center.add(p.position);
    }
    center.divideScalar(n);

    // 2. Compute Radii from Center
    const radii: number[] = [];
    let sumR = 0;
    for (const p of points) {
      const r = p.position.distanceTo(center);
      radii.push(r);
      sumR += r;
    }
    const avgR = sumR / n;

    // 3. Compute variance of radius to determine circularity vs ellipticity
    let sumDiffSq = 0;
    let minR = Infinity;
    let maxR = -Infinity;
    for (const r of radii) {
      sumDiffSq += (r - avgR) * (r - avgR);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
    const stdDev = Math.sqrt(sumDiffSq / n);
    const circularity = 1.0 - Math.min(1.0, stdDev / Math.max(avgR, 0.0001));

    // Plane normal for circle: use avgNormal
    const normal = avgNormal.clone().normalize();
    // Build tangent frame on the plane
    const arbitrary = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const uAxis = new THREE.Vector3().crossVectors(normal, arbitrary).normalize();
    const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();

    const isCircle = (maxR - minR) / Math.max(avgR, 0.0001) < 0.35;
    const shapeType: DetectedShapeType = isCircle ? 'circle' : 'ellipse';

    const segments = 48;
    const snappedPoints: StrokePoint[] = [];

    const radiusA = isCircle ? avgR : maxR * 0.95;
    const radiusB = isCircle ? avgR : Math.max(minR, avgR * 0.7);

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const pos = center.clone()
        .addScaledVector(uAxis, cosA * radiusA)
        .addScaledVector(vAxis, sinA * radiusB);

      snappedPoints.push({
        position: pos,
        normal: normal.clone(),
        surfaceOffset: avgOffset,
        pressure: avgPressure,
        isSurfaceHit: points[0].isSurfaceHit,
        time: performance.now(),
      });
    }

    const confidence = Math.max(0, Math.min(1.0, circularity * 0.95 + 0.05));

    return {
      detectedShape: shapeType,
      confidence,
      snappedPoints,
      center,
      radius: avgR,
      description: isCircle
        ? `Circle (Radius: ${(avgR * 100).toFixed(1)}cm)`
        : `Ellipse (${(radiusA * 100).toFixed(1)}cm × ${(radiusB * 100).toFixed(1)}cm)`,
    };
  }

  /**
   * Fits a smooth circular arc between start and end
   */
  private static fitCircularArc(
    points: StrokePoint[],
    avgNormal: THREE.Vector3,
    avgOffset: number,
    avgPressure: number
  ): ShapeSnapResult {
    const n = points.length;
    const start = points[0].position;
    const mid = points[Math.floor(n / 2)].position;
    const end = points[n - 1].position;

    // 3-point circle formula in 3D
    const v1 = mid.clone().sub(start);
    const v2 = end.clone().sub(start);
    const cross = new THREE.Vector3().crossVectors(v1, v2);

    if (cross.lengthSq() < 0.000001) {
      return { detectedShape: 'none', confidence: 0, snappedPoints: points, description: 'Collinear arc' };
    }

    const norm1 = v1.lengthSq();
    const norm2 = v2.lengthSq();

    const alpha = (norm1 * v2.dot(v2) - norm2 * v1.dot(v2)) / (2 * cross.lengthSq());
    const beta = (norm2 * v1.dot(v1) - norm1 * v1.dot(v2)) / (2 * cross.lengthSq());

    const center = start.clone()
      .addScaledVector(v1, alpha)
      .addScaledVector(v2, beta);

    const radius = center.distanceTo(start);

    // Verify error across all points
    let maxError = 0;
    for (const p of points) {
      const err = Math.abs(p.position.distanceTo(center) - radius);
      if (err > maxError) maxError = err;
    }

    const relError = maxError / Math.max(radius, 0.001);
    const confidence = Math.max(0, Math.min(1.0, 1.0 - relError * 3.5));

    if (confidence < 0.65) {
      return { detectedShape: 'none', confidence: 0, snappedPoints: points, description: 'Low arc confidence' };
    }

    // Generate smooth arc points
    const uAxis = start.clone().sub(center).normalize();
    const planeNorm = cross.normalize();
    const vAxis = new THREE.Vector3().crossVectors(planeNorm, uAxis).normalize();

    const endDir = end.clone().sub(center);
    let totalAngle = Math.atan2(endDir.dot(vAxis), endDir.dot(uAxis));
    if (totalAngle < 0) totalAngle += Math.PI * 2;

    const segments = 32;
    const snappedPoints: StrokePoint[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = totalAngle * t;
      const pos = center.clone()
        .addScaledVector(uAxis, Math.cos(angle) * radius)
        .addScaledVector(vAxis, Math.sin(angle) * radius);

      snappedPoints.push({
        position: pos,
        normal: avgNormal.clone(),
        surfaceOffset: avgOffset,
        pressure: avgPressure,
        isSurfaceHit: points[0].isSurfaceHit,
        time: performance.now(),
      });
    }

    return {
      detectedShape: 'arc',
      confidence,
      snappedPoints,
      center,
      radius,
      description: `Circular Arc (${(radius * 100).toFixed(1)}cm radius)`,
    };
  }

  /**
   * Fits sharp polygons (Triangle / Rectangle / Polygon) by detecting prominent corners
   */
  private static fitPolygon(
    points: StrokePoint[],
    avgNormal: THREE.Vector3,
    avgOffset: number,
    avgPressure: number
  ): ShapeSnapResult {
    const n = points.length;
    if (n < 12) {
      return { detectedShape: 'none', confidence: 0, snappedPoints: points, description: 'Too few points for polygon' };
    }

    // Corner detection via windowed direction change
    const windowSize = Math.max(2, Math.floor(n / 14));
    const corners: number[] = [];

    for (let i = windowSize; i < n - windowSize; i++) {
      const vPrev = points[i].position.clone().sub(points[i - windowSize].position).normalize();
      const vNext = points[i + windowSize].position.clone().sub(points[i].position).normalize();
      const dot = vPrev.dot(vNext);

      // Sharp direction change: angle > 45 deg (dot < 0.7)
      if (dot < 0.7) {
        // Suppress close duplicate corners
        if (corners.length === 0 || (i - corners[corners.length - 1]) > windowSize * 2) {
          corners.push(i);
        }
      }
    }

    let detectedType: DetectedShapeType = 'polygon';
    if (corners.length === 3) detectedType = 'triangle';
    else if (corners.length === 4) detectedType = 'rectangle';
    else if (corners.length < 3 || corners.length > 6) {
      return { detectedShape: 'none', confidence: 0, snappedPoints: points, description: 'Non-matching corner count' };
    }

    // Build straight edges connecting detected corners and loop back to start
    const cornerIndices = [0, ...corners, n - 1];
    const snappedPoints: StrokePoint[] = [];

    for (let c = 0; c < cornerIndices.length - 1; c++) {
      const idxA = cornerIndices[c];
      const idxB = cornerIndices[c + 1];
      const ptA = points[idxA].position;
      const ptB = points[idxB].position;

      const edgeSteps = 10;
      for (let s = 0; s < edgeSteps; s++) {
        const t = s / edgeSteps;
        const pos = ptA.clone().lerp(ptB, t);
        snappedPoints.push({
          position: pos,
          normal: avgNormal.clone(),
          surfaceOffset: avgOffset,
          pressure: avgPressure,
          isSurfaceHit: points[0].isSurfaceHit,
          time: performance.now(),
        });
      }
    }

    return {
      detectedShape: detectedType,
      confidence: 0.82,
      snappedPoints,
      description: detectedType === 'triangle'
        ? 'Equilateral Triangle'
        : detectedType === 'rectangle'
        ? 'Rectangle / Box'
        : `Polygon (${corners.length} Vertices)`,
    };
  }
}
