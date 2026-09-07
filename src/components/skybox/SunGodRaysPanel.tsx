import React from 'react';
import { SunGodRaySettings } from '../../types/skybox';
import { Sun, Sparkles } from 'lucide-react';
import { CelestialDomeWidget } from './CelestialDomeWidget';

interface SunGodRaysPanelProps {
  sunGodRays: SunGodRaySettings;
  onChange: (updated: Partial<SunGodRaySettings>) => void;
}

export const SunGodRaysPanel: React.FC<SunGodRaysPanelProps> = ({ sunGodRays, onChange }) => {
  return (
    <div className="space-y-4 text-xs text-zinc-200">
      {/* 2D Celestial Polar Dome Tracker */}
      <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 flex justify-center">
        <CelestialDomeWidget
          altitude={sunGodRays.sunHeight}
          azimuth={sunGodRays.sunAzimuth}
          onChange={(alt, az) => onChange({ sunHeight: alt, sunAzimuth: az })}
        />
      </div>

      {/* Sun Height (Altitude) */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Sun Height (Altitude)</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="-30"
            max="90"
            step="1"
            value={sunGodRays.sunHeight}
            onChange={(e) => onChange({ sunHeight: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">{sunGodRays.sunHeight}°</span>
        </div>
      </div>

      {/* Sun Azimuth (Angle) */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Sun Azimuth (Angle)</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={sunGodRays.sunAzimuth}
            onChange={(e) => onChange({ sunAzimuth: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">{sunGodRays.sunAzimuth}°</span>
        </div>
      </div>

      {/* Lock Sun to Player */}
      <div className="flex items-center justify-between">
        <label className="text-zinc-300 cursor-pointer" htmlFor="lock-sun">
          Lock Sun to Player
        </label>
        <input
          id="lock-sun"
          type="checkbox"
          checked={sunGodRays.lockSunToPlayer}
          onChange={(e) => onChange({ lockSunToPlayer: e.target.checked })}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-white cursor-pointer accent-white"
        />
      </div>

      {/* Sun Disc Size */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Sun Disc Size</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.5"
            max="5.0"
            step="0.1"
            value={sunGodRays.sunDiscSize}
            onChange={(e) => onChange({ sunDiscSize: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {sunGodRays.sunDiscSize.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Color Temperature */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Color Temperature</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="2000"
            max="10000"
            step="100"
            value={sunGodRays.colorTemperature}
            onChange={(e) => onChange({ colorTemperature: parseInt(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-12 text-right font-mono text-zinc-200 text-[11px]">
            {sunGodRays.colorTemperature}K
          </span>
        </div>
      </div>

      {/* God Rays Section Header */}
      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
          God Rays Enable
        </span>
        <input
          type="checkbox"
          checked={sunGodRays.godRaysEnable}
          onChange={(e) => onChange({ godRaysEnable: e.target.checked })}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-white cursor-pointer accent-white"
        />
      </div>

      {/* Ray Intensity */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Ray Intensity</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="2.0"
            step="0.05"
            value={sunGodRays.rayIntensity}
            onChange={(e) => onChange({ rayIntensity: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {sunGodRays.rayIntensity.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Ray Density */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Ray Density</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.1"
            max="1.5"
            step="0.05"
            value={sunGodRays.rayDensity}
            onChange={(e) => onChange({ rayDensity: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {sunGodRays.rayDensity.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Ray Decay */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Ray Decay</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.5"
            max="0.99"
            step="0.01"
            value={sunGodRays.rayDecay}
            onChange={(e) => onChange({ rayDecay: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {sunGodRays.rayDecay.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Lum Gate Min */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Lum Gate Min</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.1"
            max="0.95"
            step="0.02"
            value={sunGodRays.lumGateMin}
            onChange={(e) => onChange({ lumGateMin: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {sunGodRays.lumGateMin.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Lum Gate Max */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Lum Gate Max</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.5"
            max="1.0"
            step="0.01"
            value={sunGodRays.lumGateMax}
            onChange={(e) => onChange({ lumGateMax: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {sunGodRays.lumGateMax.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Highlight Rolloff */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Highlight Rolloff</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={sunGodRays.highlightRolloff}
            onChange={(e) => onChange({ highlightRolloff: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {sunGodRays.highlightRolloff.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Horizon Glow */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Horizon Glow</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="1.5"
            step="0.05"
            value={sunGodRays.horizonGlow}
            onChange={(e) => onChange({ horizonGlow: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {sunGodRays.horizonGlow.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Ray Color (Inner) */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Ray Color (Inner)</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={sunGodRays.rayColorInner}
            onChange={(e) => onChange({ rayColorInner: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{sunGodRays.rayColorInner.replace('#', '')}</span>
        </div>
      </div>

      {/* Ray Color (Outer) */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Ray Color (Outer)</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={sunGodRays.rayColorOuter}
            onChange={(e) => onChange({ rayColorOuter: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{sunGodRays.rayColorOuter.replace('#', '')}</span>
        </div>
      </div>
    </div>
  );
};
