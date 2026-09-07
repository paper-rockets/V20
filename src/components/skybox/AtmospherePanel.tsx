import React from 'react';
import { AtmosphereSettings, ShadeMode } from '../../types/skybox';
import { Sun, Sparkles } from 'lucide-react';

interface AtmospherePanelProps {
  atmosphere: AtmosphereSettings;
  onChange: (updated: Partial<AtmosphereSettings>) => void;
}

export const AtmospherePanel: React.FC<AtmospherePanelProps> = ({ atmosphere, onChange }) => {
  return (
    <div className="space-y-3.5 text-xs text-zinc-200">
      {/* Global Brightness */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Global Brightness</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.05"
            value={atmosphere.globalBrightness}
            onChange={(e) => onChange({ globalBrightness: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {atmosphere.globalBrightness.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Summer Filter */}
      <div className="flex items-center justify-between">
        <label className="text-zinc-300 cursor-pointer flex items-center gap-1.5" htmlFor="summer-filter">
          <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
          Summer Filter
        </label>
        <input
          id="summer-filter"
          type="checkbox"
          checked={atmosphere.summerFilter}
          onChange={(e) => onChange({ summerFilter: e.target.checked })}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-white focus:ring-0 cursor-pointer accent-white"
        />
      </div>

      {/* Shade Mode */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Shade Mode</label>
        <select
          value={atmosphere.shadeMode}
          onChange={(e) => onChange({ shadeMode: e.target.value as ShadeMode })}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1 text-xs cursor-pointer hover:border-zinc-500 focus:outline-none"
        >
          <option value="original">original</option>
          <option value="vibrant">vibrant</option>
          <option value="stylized">stylized</option>
          <option value="ghibli">ghibli</option>
          <option value="cinematic">cinematic</option>
        </select>
      </div>

      {/* Sky Color */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Sky Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={atmosphere.skyColor}
            onChange={(e) => onChange({ skyColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{atmosphere.skyColor.replace('#', '')}</span>
        </div>
      </div>

      {/* Fog Color */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Fog Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={atmosphere.fogColor}
            onChange={(e) => onChange({ fogColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{atmosphere.fogColor.replace('#', '')}</span>
        </div>
      </div>

      {/* Ambient Light */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Ambient Light</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={atmosphere.ambientLightColor}
            onChange={(e) => onChange({ ambientLightColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{atmosphere.ambientLightColor.replace('#', '')}</span>
        </div>
      </div>

      {/* Sun Light */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Sun Light</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={atmosphere.sunLightColor}
            onChange={(e) => onChange({ sunLightColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{atmosphere.sunLightColor.replace('#', '')}</span>
        </div>
      </div>

      {/* Amb Intensity */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Amb Intensity</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.05"
            value={atmosphere.ambientIntensity}
            onChange={(e) => onChange({ ambientIntensity: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {atmosphere.ambientIntensity.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Sun Intensity */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-zinc-300 w-36">Sun Intensity</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.1"
            max="5.0"
            step="0.1"
            value={atmosphere.sunIntensity}
            onChange={(e) => onChange({ sunIntensity: parseFloat(e.target.value) })}
            className="w-full accent-white h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-zinc-200">
            {atmosphere.sunIntensity.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Water / Specular Glint */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
        <label className="text-zinc-300 w-36">Water Glint</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={atmosphere.waterGlintColor}
            onChange={(e) => onChange({ waterGlintColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-zinc-700"
          />
          <span className="font-mono text-zinc-400 uppercase">{atmosphere.waterGlintColor.replace('#', '')}</span>
        </div>
      </div>
    </div>
  );
};
