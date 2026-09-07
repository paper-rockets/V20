import React from 'react';
import { DistanceFogSettings, RainSettings } from '../../types/skybox';
import { DISTANCE_FOG_PRESETS } from '../../constants/presets';
import { CloudFog, CloudRain, Wind } from 'lucide-react';

interface WeatherFogPanelProps {
  fog: DistanceFogSettings;
  rain: RainSettings;
  onFogChange: (updated: Partial<DistanceFogSettings>) => void;
  onRainChange: (updated: Partial<RainSettings>) => void;
}

export const WeatherFogPanel: React.FC<WeatherFogPanelProps> = ({
  fog,
  rain,
  onFogChange,
  onRainChange,
}) => {
  return (
    <div className="space-y-4 text-xs text-zinc-200">
      {/* Distance Fog Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between font-medium text-zinc-200">
          <span className="flex items-center gap-1.5">
            <CloudFog className="w-3.5 h-3.5 text-zinc-400" />
            Distance Fog (Horizon & Range)
          </span>
        </div>

        {/* Global Fog Checkbox */}
        <div className="flex items-center justify-between">
          <label className="text-zinc-300 cursor-pointer" htmlFor="global-fog">
            Global Fog
          </label>
          <input
            id="global-fog"
            type="checkbox"
            checked={fog.globalFog}
            onChange={(e) => onFogChange({ globalFog: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-white cursor-pointer accent-white"
          />
        </div>

        {/* Start Dist (Clear Area) */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 w-36">Start Dist (Clear Area)</label>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min="0"
              max="1000"
              step="10"
              value={fog.startDist}
              onChange={(e) => onFogChange({ startDist: parseFloat(e.target.value) })}
              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-zinc-200">{fog.startDist}</span>
          </div>
        </div>

        {/* End Dist (Max Density) */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 w-36">End Dist (Max Density)</label>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min="500"
              max="10000"
              step="100"
              value={fog.endDist}
              onChange={(e) => onFogChange({ endDist: parseFloat(e.target.value) })}
              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-zinc-200">{fog.endDist}</span>
          </div>
        </div>

        {/* Density Multiplier */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 w-36">Density Multiplier</label>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.05"
              value={fog.densityMultiplier}
              onChange={(e) => onFogChange({ densityMultiplier: parseFloat(e.target.value) })}
              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-zinc-200">
              {fog.densityMultiplier.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Altitude Scale */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 w-36">Altitude Scale</label>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min="0.2"
              max="4.0"
              step="0.1"
              value={fog.altitudeScale}
              onChange={(e) => onFogChange({ altitudeScale: parseFloat(e.target.value) })}
              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-zinc-200">
              {fog.altitudeScale.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Altitude Auto-Expand */}
        <div className="flex items-center justify-between">
          <label className="text-zinc-300 cursor-pointer" htmlFor="alt-expand">
            Altitude Auto-Expand
          </label>
          <input
            id="alt-expand"
            type="checkbox"
            checked={fog.altitudeAutoExpand}
            onChange={(e) => onFogChange({ altitudeAutoExpand: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-white cursor-pointer accent-white"
          />
        </div>

        {/* Distance Fog Presets Buttons */}
        <div className="pt-2">
          <div className="text-[11px] text-zinc-400 mb-1.5 font-medium">Distance Fog Presets</div>
          <div className="space-y-1.5">
            {Object.entries(DISTANCE_FOG_PRESETS).map(([name, p]) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  onFogChange({
                    startDist: p.startDist,
                    endDist: p.endDist,
                    densityMultiplier: p.densityMultiplier,
                    altitudeScale: p.altitudeScale,
                  })
                }
                className="w-full text-left py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs transition border border-zinc-800 flex items-center justify-between"
              >
                <span>{name}</span>
                <span className="text-[10px] font-mono text-zinc-500">{p.endDist}m</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Wind & Rain Section */}
      <div className="pt-3 border-t border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-zinc-300 cursor-pointer flex items-center gap-1.5" htmlFor="wind-toggle">
            <Wind className="w-3.5 h-3.5 text-zinc-400" />
            Wind
          </label>
          <input
            id="wind-toggle"
            type="checkbox"
            checked={rain.wind}
            onChange={(e) => onRainChange({ wind: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-white cursor-pointer accent-white"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-zinc-300 cursor-pointer" htmlFor="wind-trails">
            Wind Trails
          </label>
          <input
            id="wind-trails"
            type="checkbox"
            checked={rain.windTrails}
            onChange={(e) => onRainChange({ windTrails: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-white cursor-pointer accent-white"
          />
        </div>

        {/* Rain Settings Header */}
        <div className="pt-2 flex items-center justify-between">
          <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5 text-zinc-400" />
            Rain Settings
          </span>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-zinc-300 cursor-pointer" htmlFor="enable-rain">
            Enable Rain
          </label>
          <input
            id="enable-rain"
            type="checkbox"
            checked={rain.enableRain}
            onChange={(e) => onRainChange({ enableRain: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-white cursor-pointer accent-white"
          />
        </div>

        {/* Drop Size */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 w-36">Drop Size</label>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.2"
              value={rain.dropSize}
              onChange={(e) => onRainChange({ dropSize: parseFloat(e.target.value) })}
              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-zinc-200">{rain.dropSize}</span>
          </div>
        </div>

        {/* Rain Intensity */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 w-36">Intensity</label>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min="0.1"
              max="4.0"
              step="0.1"
              value={rain.intensity}
              onChange={(e) => onRainChange({ intensity: parseFloat(e.target.value) })}
              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-zinc-200">{rain.intensity}</span>
          </div>
        </div>

        {/* Wind X */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 w-36">Wind X</label>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min="-3.0"
              max="3.0"
              step="0.1"
              value={rain.windX}
              onChange={(e) => onRainChange({ windX: parseFloat(e.target.value) })}
              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-zinc-200">{rain.windX}</span>
          </div>
        </div>

        {/* Wind Z */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-300 w-36">Wind Z</label>
          <div className="flex items-center gap-2 flex-1">
            <input
              type="range"
              min="-3.0"
              max="3.0"
              step="0.1"
              value={rain.windZ}
              onChange={(e) => onRainChange({ windZ: parseFloat(e.target.value) })}
              className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-zinc-200">{rain.windZ}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
