import * as THREE from 'three';
import { SmoothingAlgorithm } from '../types';

/**
 * Real-time Stroke Smoother & Contact Point Optimizer
 * 
 * Provides stable smoothing via:
 * - Streamline (Weighted Moving Average / Pull-string smoothing)
 * - Exponential Weighted Moving Average (EWMA)
 * - Direct / None (Raw precision coordinates)
 */
export class StrokeSmoother {
  private static readonly MAX_HISTORY = 8;
  private historyX = new Float32Array(8);
  private historyY = new Float32Array(8);
  private historyP = new Float32Array(8);
  private historyTime = new Float32Array(8);
  private historyCount = 0;
  private historyHead = 0;

  private lastSmoothed: { x: number; y: number; pressure: number } = { x: 0, y: 0, pressure: 1.0 };
  private hasLastSmoothed = false;

  public reset(): void {
    this.historyCount = 0;
    this.historyHead = 0;
    this.hasLastSmoothed = false;
  }

  /**
   * Process raw input coordinate into a smooth, jitter-free coordinate
   */
  public processPoint(
    rawX: number,
    rawY: number,
    pressure: number,
    algorithm: SmoothingAlgorithm = 'streamline',
    strength: number = 0.55, // 0.0 to 1.0
    timestamp: number = performance.now()
  ): { x: number; y: number; pressure: number } {
    if (algorithm === 'none') {
      this.lastSmoothed.x = rawX;
      this.lastSmoothed.y = rawY;
      this.lastSmoothed.pressure = pressure;
      this.hasLastSmoothed = true;
      return { x: rawX, y: rawY, pressure };
    }

    let outX = rawX;
    let outY = rawY;
    let outP = pressure;

    switch (algorithm) {
      case 'streamline': {
        const idx = this.historyHead;
        this.historyX[idx] = rawX;
        this.historyY[idx] = rawY;
        this.historyP[idx] = pressure;
        this.historyTime[idx] = timestamp;
        this.historyHead = (this.historyHead + 1) % StrokeSmoother.MAX_HISTORY;
        if (this.historyCount < StrokeSmoother.MAX_HISTORY) {
          this.historyCount++;
        }

        // Weighted moving average with exponential decay falloff
        let weightSum = 0;
        let sumX = 0;
        let sumY = 0;
        let sumP = 0;
        const count = this.historyCount;
        const alpha = 0.3 + (1.0 - Math.min(1.0, Math.max(0.0, strength))) * 0.6;

        // Iterate from oldest to newest
        const startIdx = (this.historyHead - count + StrokeSmoother.MAX_HISTORY) % StrokeSmoother.MAX_HISTORY;
        for (let i = 0; i < count; i++) {
          const bufferIdx = (startIdx + i) % StrokeSmoother.MAX_HISTORY;
          const w = Math.pow(alpha, count - 1 - i);
          sumX += this.historyX[bufferIdx] * w;
          sumY += this.historyY[bufferIdx] * w;
          sumP += this.historyP[bufferIdx] * w;
          weightSum += w;
        }

        outX = sumX / weightSum;
        outY = sumY / weightSum;
        outP = sumP / weightSum;
        break;
      }

      case 'exponential': {
        if (!this.hasLastSmoothed) {
          outX = rawX;
          outY = rawY;
          outP = pressure;
        } else {
          // Velocity-adaptive smoothing factor
          const dist = Math.hypot(rawX - this.lastSmoothed.x, rawY - this.lastSmoothed.y);
          const dynamicAlpha = Math.min(0.95, Math.max(0.1, (1.0 - strength * 0.75) + dist * 5.0));
          outX = this.lastSmoothed.x + (rawX - this.lastSmoothed.x) * dynamicAlpha;
          outY = this.lastSmoothed.y + (rawY - this.lastSmoothed.y) * dynamicAlpha;
          outP = this.lastSmoothed.pressure + (pressure - this.lastSmoothed.pressure) * dynamicAlpha;
        }
        break;
      }

      default: {
        outX = rawX;
        outY = rawY;
        outP = pressure;
        break;
      }
    }

    this.lastSmoothed.x = outX;
    this.lastSmoothed.y = outY;
    this.lastSmoothed.pressure = outP;
    this.hasLastSmoothed = true;
    return { x: outX, y: outY, pressure: Math.max(0.05, Math.min(1.0, outP)) };
  }
}
