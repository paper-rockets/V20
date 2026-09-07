import React, { useState, useEffect } from 'react';
import { StudioEngine } from '../core/studioEngine';
import { EnvironmentPreset } from '../types/skybox';
import { DEFAULT_PRESETS } from '../constants/presets';
import { AtmospherePanel } from './skybox/AtmospherePanel';
import { GradientCurvePanel } from './skybox/GradientCurvePanel';
import { CloudsPanel } from './skybox/CloudsPanel';
import { SunGodRaysPanel } from './skybox/SunGodRaysPanel';
import { WeatherFogPanel } from './skybox/WeatherFogPanel';
import { timeOfDayToSunAngles } from '../engine/colorUtils';
import { getThemeClasses } from '../utils/themeStyles';
import {
  Sun,
  Sparkles,
  Layers,
  Cloud,
  CloudSun,
  CloudRain,
  Play,
  Pause,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';

interface SkyEnvironmentPanelProps {
  engine: StudioEngine | null;
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

type SubmenuTab = 'presets' | 'atmosphere' | 'gradient' | 'clouds' | 'sun' | 'weather';

export const SkyEnvironmentPanel: React.FC<SkyEnvironmentPanelProps> = ({
  engine,
  isOpen,
  onClose,
  theme = 'dark',
}) => {
  const t = getThemeClasses(theme);
  const isLight = theme === 'light';
  const [preset, setPreset] = useState<EnvironmentPreset>(DEFAULT_PRESETS[0]);
  const [activeTab, setActiveTab] = useState<SubmenuTab>('presets');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<1 | 5 | 15>(1);

  // Sync state from engine when opened
  useEffect(() => {
    if (engine && isOpen && engine.skyEngine) {
      const current = engine.skyEngine.getCurrentPreset();
      if (current) {
        setPreset(current);
      }
    }
  }, [engine, isOpen]);

  // Live Time of Day simulation loop
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setPreset((prev) => {
        const nextHour = (prev.timeOfDayHour + 0.05 * simSpeed) % 24;
        const { altitude, azimuth } = timeOfDayToSunAngles(nextHour);
        const updated: EnvironmentPreset = {
          ...prev,
          timeOfDayHour: nextHour,
          sunGodRays: {
            ...prev.sunGodRays,
            sunHeight: Math.round(altitude),
            sunAzimuth: Math.round(azimuth),
          },
        };
        if (engine && engine.skyEngine) {
          engine.skyEngine.updatePresetSettings(updated);
        }
        return updated;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isSimulating, simSpeed, engine]);

  const handleSelectPreset = (p: EnvironmentPreset) => {
    setPreset(p);
    if (engine && engine.skyEngine) {
      engine.skyEngine.applyPreset(p);
    }
  };

  const handleTimeChange = (hour: number) => {
    const { altitude, azimuth } = timeOfDayToSunAngles(hour);
    const updated: EnvironmentPreset = {
      ...preset,
      timeOfDayHour: hour,
      sunGodRays: {
        ...preset.sunGodRays,
        sunHeight: Math.round(altitude),
        sunAzimuth: Math.round(azimuth),
      },
    };
    setPreset(updated);
    if (engine && engine.skyEngine) {
      engine.skyEngine.updatePresetSettings(updated);
    }
  };

  const handleUpdatePreset = (partial: Partial<EnvironmentPreset>) => {
    const updated: EnvironmentPreset = {
      ...preset,
      ...partial,
    };
    setPreset(updated);
    if (engine && engine.skyEngine) {
      engine.skyEngine.updatePresetSettings(updated);
    }
  };

  const formatTime = (h: number) => {
    const totalMinutes = Math.floor(h * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  if (!isOpen) return null;

  return (
    <aside
      id="skybox-studio-panel"
      className={`pr-surface paperrocket-context-panel fixed left-[76px] sm:left-[88px] top-1/2 -translate-y-1/2 z-50 w-[300px] max-w-[calc(100vw-6rem)] max-h-[72vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none animate-in slide-in-from-left-2 fade-in duration-150 ${isLight ? 'bg-white border-black/10 text-neutral-800 shadow-2xl' : 'bg-[#18191d] border-white/10 text-neutral-200 shadow-2xl'}`}
    >
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${t.header}`}>
        <div className="flex items-center gap-2">
          <Sun className={`w-4 h-4 ${isLight ? 'text-neutral-500' : 'text-zinc-400'}`} />
          <div>
            <h3 className={`text-xs font-bold tracking-wide uppercase ${isLight ? 'text-neutral-900' : 'text-white'}`}>
              Skybox
            </h3>
            <span className={`text-[10px] font-mono ${t.textSecondary}`}>
              {preset.name}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg transition ${t.btnGhost}`}
          title="Close Skybox Studio"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className={`flex items-center gap-1 px-3 py-2 border-b overflow-x-auto scrollbar-none text-[11px] ${
        isLight ? 'bg-neutral-100/70 border-black/10' : 'bg-[#121317] border-white/10'
      }`}>
        {(
          [
            ['presets', 'Presets', Sparkles],
            ['atmosphere', 'Atmosphere', Sun],
            ['gradient', 'Gradient', Layers],
            ['clouds', 'Clouds', Cloud],
            ['sun', 'Sun & Rays', CloudSun],
            ['weather', 'Fog', CloudRain],
          ] as const
        ).map(([tabKey, label, IconComponent]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === tabKey
                ? isLight
                  ? 'bg-white text-neutral-950 font-bold shadow-xs border border-black/10'
                  : 'bg-white text-zinc-950 font-bold shadow-sm'
                : isLight
                ? 'text-neutral-600 hover:text-neutral-950 hover:bg-black/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <IconComponent className="w-3 h-3 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {/* Time of Day Scrubbing bar */}
        <div className={`p-3.5 rounded-xl border space-y-2.5 ${t.innerCard}`}>
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium flex items-center gap-1.5 ${t.textPrimary}`}>
              <Sun className={`w-3.5 h-3.5 ${t.textSecondary}`} />
              <span>Time of Day</span>
            </span>
            <span className={`font-mono font-semibold text-[11px] px-2 py-0.5 rounded border ${
              isLight ? 'bg-white border-black/10 text-neutral-800' : 'bg-zinc-900 border-zinc-800 text-zinc-200'
            }`}>
              {formatTime(preset.timeOfDayHour)}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="24"
            step="0.1"
            value={preset.timeOfDayHour}
            onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
            className={`w-full h-1.5 rounded-lg cursor-pointer ${
              isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-zinc-800'
            }`}
          />

          {/* Simulation Controls */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-3 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1.5 ${
                isSimulating
                  ? isLight
                    ? 'bg-neutral-900 text-white font-bold'
                    : 'bg-white text-zinc-950 font-bold'
                  : isLight
                  ? 'bg-neutral-200/80 text-neutral-800 hover:bg-neutral-300/80'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {isSimulating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isSimulating ? 'Pause Diurnal' : 'Play Diurnal'}</span>
            </button>

            <div className={`flex items-center gap-1 p-0.5 rounded-lg border text-[10px] font-mono ${
              isLight ? 'bg-white border-black/10' : 'bg-zinc-900 border-zinc-800'
            }`}>
              {([1, 5, 15] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2 py-0.5 rounded ${
                    simSpeed === spd
                      ? isLight
                        ? 'bg-neutral-900 text-white font-bold'
                        : 'bg-white text-zinc-950 font-bold'
                      : isLight
                      ? 'text-neutral-500 hover:text-neutral-900'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TAB 1: PRESETS GRID */}
        {activeTab === 'presets' && (
          <div className="space-y-2.5">
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${t.textSecondary}`}>
              Environment Atmosphere Presets
            </div>
            <div className="grid grid-cols-1 gap-2">
              {DEFAULT_PRESETS.map((p) => {
                const isSelected = preset.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? isLight
                          ? 'bg-white border-neutral-900 shadow-md ring-1 ring-neutral-900/30 text-neutral-900'
                          : 'bg-white/10 border-white text-white shadow-lg'
                        : isLight
                        ? 'bg-neutral-50/90 border-black/10 text-neutral-700 hover:border-black/20 hover:bg-white'
                        : 'bg-[#0e0f12] border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`font-semibold text-xs flex items-center gap-1.5 ${
                        isSelected ? (isLight ? 'text-neutral-900' : 'text-white') : t.textPrimary
                      }`}>
                        <Sparkles className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-700' : 'text-zinc-300'}`} />
                        <span>{p.name}</span>
                      </span>
                      <span className={`text-[10px] font-mono ${t.textSecondary}`}>
                        {formatTime(p.timeOfDayHour)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-inner"
                        style={{ backgroundColor: p.gradient.zenithColor }}
                        title="Zenith"
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-inner"
                        style={{ backgroundColor: p.gradient.midSkyColor }}
                        title="Mid Sky"
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-inner"
                        style={{ backgroundColor: p.gradient.horizonColor }}
                        title="Horizon"
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-inner ml-auto"
                        style={{ backgroundColor: p.atmosphere.sunLightColor }}
                        title="Sun"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: ATMOSPHERE */}
        {activeTab === 'atmosphere' && (
          <AtmospherePanel
            atmosphere={preset.atmosphere}
            onChange={(updated) =>
              handleUpdatePreset({
                atmosphere: { ...preset.atmosphere, ...updated },
              })
            }
          />
        )}

        {/* TAB 3: GRADIENT CURVE */}
        {activeTab === 'gradient' && (
          <GradientCurvePanel
            gradient={preset.gradient}
            onChange={(updated) =>
              handleUpdatePreset({
                gradient: { ...preset.gradient, ...updated },
              })
            }
          />
        )}

        {/* TAB 4: CLOUDS */}
        {activeTab === 'clouds' && (
          <CloudsPanel
            clouds={preset.clouds}
            onChange={(updated) =>
              handleUpdatePreset({
                clouds: { ...preset.clouds, ...updated },
              })
            }
          />
        )}

        {/* TAB 5: SUN & GOD RAYS */}
        {activeTab === 'sun' && (
          <SunGodRaysPanel
            sunGodRays={preset.sunGodRays}
            onChange={(updated) =>
              handleUpdatePreset({
                sunGodRays: { ...preset.sunGodRays, ...updated },
              })
            }
          />
        )}

        {/* TAB 6: FOG & WEATHER */}
        {activeTab === 'weather' && (
          <WeatherFogPanel
            fog={preset.fog}
            rain={preset.rain}
            onFogChange={(updated) =>
              handleUpdatePreset({
                fog: { ...preset.fog, ...updated },
              })
            }
            onRainChange={(updated) =>
              handleUpdatePreset({
                rain: { ...preset.rain, ...updated },
              })
            }
          />
        )}
      </div>

      {/* Footer Actions */}
      <div className={`p-3 flex items-center justify-between ${t.footer}`}>
        <button
          type="button"
          onClick={() => handleSelectPreset(DEFAULT_PRESETS[0])}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${t.btnSecondary}`}
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Clear Day</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition ${t.btnPrimary}`}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Done</span>
        </button>
      </div>
    </aside>
  );
};
