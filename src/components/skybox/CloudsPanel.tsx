import React from 'react';
import { CloudSettings, WeatherType } from '../../types/skybox';
import { Cloud, Wind } from 'lucide-react';

interface CloudsPanelProps {
  clouds: CloudSettings;
  onChange: (updated: Partial<CloudSettings>) => void;
}

export const CloudsPanel: React.FC<CloudsPanelProps> = ({ clouds, onChange }) => {
  return (
    <div className="space-y-3.5 text-xs text-zinc-200">
      {/* Cloud Coverage */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Cloud Coverage</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={clouds.cloudCoverage}
            onChange={(e) => onChange({ cloudCoverage: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {clouds.cloudCoverage.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Cloud Edge */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Cloud Edge</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.01"
            max="0.4"
            step="0.01"
            value={clouds.cloudEdge}
            onChange={(e) => onChange({ cloudEdge: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {clouds.cloudEdge.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Cloud Speed */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Cloud Speed</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="0.1"
            step="0.002"
            value={clouds.cloudSpeed}
            onChange={(e) => onChange({ cloudSpeed: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {clouds.cloudSpeed.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Sky Zenith */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Sky Zenith</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={clouds.skyZenith}
            onChange={(e) => onChange({ skyZenith: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{clouds.skyZenith.replace('#', '')}</span>
        </div>
      </div>

      {/* Sky Horizon */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Sky Horizon</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={clouds.skyHorizon}
            onChange={(e) => onChange({ skyHorizon: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{clouds.skyHorizon.replace('#', '')}</span>
        </div>
      </div>

      {/* Cloud Color */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Cloud Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={clouds.cloudColor}
            onChange={(e) => onChange({ cloudColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{clouds.cloudColor.replace('#', '')}</span>
        </div>
      </div>

      {/* Cloud Shadow */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Cloud Shadow</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={clouds.cloudShadow}
            onChange={(e) => onChange({ cloudShadow: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{clouds.cloudShadow.replace('#', '')}</span>
        </div>
      </div>

      {/* Cloud Altitude (Height) */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Cloud Altitude</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="300"
            max="3000"
            step="50"
            value={clouds.cloudAltitude}
            onChange={(e) => onChange({ cloudAltitude: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-12 text-right font-mono text-zinc-200 text-[11px]">
            {clouds.cloudAltitude}m
          </span>
        </div>
      </div>

      {/* Storm Turbulence */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Storm Turbulence</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={clouds.stormTurbulence}
            onChange={(e) => onChange({ stormTurbulence: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {clouds.stormTurbulence.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Storm Darken */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Storm Darken</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={clouds.stormDarken}
            onChange={(e) => onChange({ stormDarken: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {clouds.stormDarken.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Cloud Opacity */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Cloud Opacity</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={clouds.cloudOpacity}
            onChange={(e) => onChange({ cloudOpacity: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {clouds.cloudOpacity.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Weather Dropdown */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
        <label className="text-zinc-300 w-36 flex items-center gap-1.5">
          <Cloud className="w-3.5 h-3.5 text-zinc-400" />
          Weather
        </label>
        <select
          value={clouds.weather}
          onChange={(e) => onChange({ weather: e.target.value as WeatherType })}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1 text-xs cursor-pointer hover:border-zinc-500 focus:outline-none capitalize"
        >
          <option value="clear">clear</option>
          <option value="overcast">overcast</option>
          <option value="rain">rain</option>
          <option value="storm">storm</option>
          <option value="foggy">foggy</option>
        </select>
      </div>
    </div>
  );
};
