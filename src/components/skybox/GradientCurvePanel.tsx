import React from 'react';
import { GradientSettings, SkyMode } from '../../types/skybox';

interface GradientCurvePanelProps {
  gradient: GradientSettings;
  onChange: (updated: Partial<GradientSettings>) => void;
}

export const GradientCurvePanel: React.FC<GradientCurvePanelProps> = ({ gradient, onChange }) => {
  return (
    <div className="space-y-3.5 text-xs text-neutral-200">
      {/* Sky Mode */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-neutral-300 w-36">Sky Mode</label>
        <select
          value={gradient.skyMode}
          onChange={(e) => onChange({ skyMode: e.target.value as SkyMode })}
          className="bg-neutral-800 border border-neutral-700 text-neutral-200 rounded px-2.5 py-1 text-xs cursor-pointer hover:border-neutral-500 focus:outline-none"
        >
          <option value="gradient_clouds">Gradient + Clouds</option>
          <option value="rayleigh_mie">Rayleigh & Mie</option>
          <option value="solid_fog">Solid + Fog</option>
          <option value="stylized_ghibli">Stylized Ghibli</option>
          <option value="deep_night">Deep Night</option>
        </select>
      </div>

      {/* Checkboxes */}
      <div className="grid grid-cols-1 gap-2 pt-1">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-neutral-300">Procedural Sky Dome</span>
          <input
            type="checkbox"
            checked={gradient.proceduralSkyDome}
            onChange={(e) => onChange({ proceduralSkyDome: e.target.checked })}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-neutral-800 dark:text-white cursor-pointer accent-neutral-800 dark:accent-white"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-neutral-300">Enable Procedural Clouds</span>
          <input
            type="checkbox"
            checked={gradient.enableProceduralClouds}
            onChange={(e) => onChange({ enableProceduralClouds: e.target.checked })}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-neutral-800 dark:text-white cursor-pointer accent-neutral-800 dark:accent-white"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-neutral-300">Enable Gradient Curve</span>
          <input
            type="checkbox"
            checked={gradient.enableGradientCurve}
            onChange={(e) => onChange({ enableGradientCurve: e.target.checked })}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-neutral-800 dark:text-white cursor-pointer accent-neutral-800 dark:accent-white"
          />
        </label>
      </div>

      {/* Visual 3-Stop Gradient Preview Bar */}
      <div className="pt-2">
        <div className="text-[11px] text-neutral-400 mb-1 flex justify-between">
          <span>Zenith</span>
          <span>Mid-Atmosphere</span>
          <span>Horizon</span>
        </div>
        <div
          className="w-full h-4 rounded border border-neutral-700 shadow-inner"
          style={{
            background: `linear-gradient(to right, ${gradient.zenithColor} 0%, ${gradient.midSkyColor} ${(gradient.midHeightOffset * 100).toFixed(0)}%, ${gradient.horizonColor} 100%)`,
          }}
        />
      </div>

      {/* Zenith Color */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-neutral-300 w-36">Zenith Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={gradient.zenithColor}
            onChange={(e) => onChange({ zenithColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-neutral-700"
          />
          <span className="font-mono text-neutral-400 uppercase">{gradient.zenithColor.replace('#', '')}</span>
        </div>
      </div>

      {/* Mid-Sky Color */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-neutral-300 w-36">Mid-Sky Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={gradient.midSkyColor}
            onChange={(e) => onChange({ midSkyColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-neutral-700"
          />
          <span className="font-mono text-neutral-400 uppercase">{gradient.midSkyColor.replace('#', '')}</span>
        </div>
      </div>

      {/* Horizon Color */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-neutral-300 w-36">Horizon Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={gradient.horizonColor}
            onChange={(e) => onChange({ horizonColor: e.target.value })}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border border-neutral-700"
          />
          <span className="font-mono text-neutral-400 uppercase">{gradient.horizonColor.replace('#', '')}</span>
        </div>
      </div>

      {/* Gradient Curve (Power) */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-neutral-300 w-36">Gradient Curve (Power)</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.2"
            max="3.5"
            step="0.05"
            value={gradient.gradientCurvePower}
            onChange={(e) => onChange({ gradientCurvePower: parseFloat(e.target.value) })}
            className="w-full accent-neutral-100 h-1.5 bg-neutral-700 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-neutral-800 dark:text-zinc-300">
            {gradient.gradientCurvePower.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Mid-Height Offset */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-neutral-300 w-36">Mid-Height Offset</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.05"
            max="0.95"
            step="0.01"
            value={gradient.midHeightOffset}
            onChange={(e) => onChange({ midHeightOffset: parseFloat(e.target.value) })}
            className="w-full accent-neutral-100 h-1.5 bg-neutral-700 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-neutral-800 dark:text-zinc-300">
            {gradient.midHeightOffset.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Sun Flare Glow */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-neutral-300 w-36">Sun Flare Glow</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="2.0"
            step="0.05"
            value={gradient.sunFlareGlow}
            onChange={(e) => onChange({ sunFlareGlow: parseFloat(e.target.value) })}
            className="w-full accent-neutral-100 h-1.5 bg-neutral-700 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-neutral-800 dark:text-zinc-300">
            {gradient.sunFlareGlow.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Horizon Band Glow */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-neutral-300 w-36">Horizon Band Glow</label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min="0.0"
            max="2.0"
            step="0.05"
            value={gradient.horizonBandGlow}
            onChange={(e) => onChange({ horizonBandGlow: parseFloat(e.target.value) })}
            className="w-full accent-neutral-100 h-1.5 bg-neutral-700 rounded cursor-pointer"
          />
          <span className="w-10 text-right font-mono text-neutral-800 dark:text-zinc-300">
            {gradient.horizonBandGlow.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
