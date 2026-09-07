// src/components/IlluminationStudioModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sun,
  Moon,
  Sunset,
  Sunrise,
  Clock,
  Compass,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Cloud,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  X,
  ChevronRight,
  Flame,
  Check,
  Wind,
  Layers,
  Palette,
} from 'lucide-react';
import { StudioEngine } from '../core/studioEngine';
import { SkyPresetName, SKY_PRESETS } from '../core/proceduralSky';

interface IlluminationStudioModalProps {
  engine: StudioEngine | null;
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

type TabMode = 'presets' | 'sun' | 'clouds' | 'godrays';

export const IlluminationStudioModal: React.FC<IlluminationStudioModalProps> = ({
  engine,
  isOpen,
  onClose,
  theme = 'light',
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('presets');

  // Sun & Illumination State
  const [azimuth, setAzimuth] = useState<number>(145); // 0° - 360°
  const [elevation, setElevation] = useState<number>(42); // -15° - 90°
  const [timeOfDay, setTimeOfDayState] = useState<number>(13.5); // 0.0 - 24.0 hours
  const [isPlayingTime, setIsPlayingTime] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1x, 5x, 15x

  // Lighting & Sun Colors
  const [sunIntensity, setSunIntensityState] = useState<number>(1.25);
  const [ambientIntensity, setAmbientIntensityState] = useState<number>(0.8);
  const [sunCorona, setSunCoronaState] = useState<number>(0.85);
  const [sunColor, setSunColorState] = useState<string>('#fff4d0');
  const [colorTemp, setColorTemp] = useState<number>(5500); // 2000K to 8500K

  // Procedural Clouds & Movements State
  const [activePreset, setActivePreset] = useState<SkyPresetName>('daylight');
  const [enableClouds, setEnableCloudsState] = useState<boolean>(true);
  const [cloudCoverage, setCloudCoverageState] = useState<number>(0.45);
  const [cloudDensity, setCloudDensityState] = useState<number>(1.0);
  const [cloudSpeed, setCloudSpeedState] = useState<number>(0.018);
  const [cloudWindAngle, setCloudWindAngleState] = useState<number>(45); // 0° to 360°
  const [cloudScale, setCloudScaleState] = useState<number>(1.0);
  const [cloudTurbulence, setCloudTurbulenceState] = useState<number>(0.4);
  const [cloudOpacity, setCloudOpacityState] = useState<number>(0.95);
  const [cloudColor, setCloudColorState] = useState<string>('#fffdf5');
  const [cloudShadow, setCloudShadowState] = useState<string>('#8ca4c8');

  // God Rays (Crepuscular Rays) State
  const [enableGodRays, setEnableGodRaysState] = useState<boolean>(true);
  const [godRaysIntensity, setGodRaysIntensityState] = useState<number>(1.2);
  const [godRaysDensity, setGodRaysDensityState] = useState<number>(0.8);
  const [godRaysDecay, setGodRaysDecayState] = useState<number>(0.94);
  const [godRaysColor, setGodRaysColorState] = useState<string>('#fff5d6');

  // Trackball canvas & interaction refs
  const trackballContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingTrackballRef = useRef<boolean>(false);

  // Modal Dragging State
  const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const isDraggingModalRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Sync initial state from engine
  useEffect(() => {
    if (engine && isOpen) {
      const state = engine.getIlluminationState();
      if (state) {
        setAzimuth(state.azimuth);
        setElevation(state.elevation);
        setTimeOfDayState(state.timeOfDay);
        setSunIntensityState(state.sunIntensity);
        setAmbientIntensityState(state.ambientIntensity);
        setSunColorState(state.sunColor);
        setSunCoronaState(state.sunCorona);
      }
      const sky = engine.getSkySettings();
      if (sky) {
        setActivePreset(sky.preset);
        setEnableCloudsState(sky.enableClouds);
        setCloudCoverageState(sky.cloudCoverage);
        setCloudDensityState(sky.cloudDensity);
        setCloudSpeedState(sky.cloudSpeed);
        setCloudWindAngleState(sky.cloudWindAngle);
        setCloudScaleState(sky.cloudScale);
        setCloudTurbulenceState(sky.cloudTurbulence);
        setCloudOpacityState(sky.cloudOpacity);
        setCloudColorState(sky.cloudColor);
        setCloudShadowState(sky.cloudShadow);
        setEnableGodRaysState(sky.enableGodRays);
        setGodRaysIntensityState(sky.godRaysIntensity);
        setGodRaysDensityState(sky.godRaysDensity);
        setGodRaysDecayState(sky.godRaysDecay);
        setGodRaysColorState(sky.godRaysColor);
      }
    }
  }, [engine, isOpen]);

  // Live Diurnal Cycle (Time of Day animation)
  useEffect(() => {
    if (!isPlayingTime) return;
    const interval = setInterval(() => {
      setTimeOfDayState((prev) => {
        const next = (prev + 0.05 * playSpeed) % 24;
        if (engine) {
          engine.setTimeOfDay(next);
          const state = engine.getIlluminationState();
          if (state) {
            setAzimuth(state.azimuth);
            setElevation(state.elevation);
          }
        }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPlayingTime, playSpeed, engine]);

  // Handle direct Azimuth & Elevation updates
  const handleAngleChange = useCallback(
    (newAz: number, newEl: number) => {
      setAzimuth(newAz);
      setElevation(newEl);
      if (engine) {
        engine.setSunAngles(newAz, newEl);
      }
    },
    [engine]
  );

  // Handle direct Time of Day change
  const handleTimeChange = useCallback(
    (newTime: number) => {
      setTimeOfDayState(newTime);
      if (engine) {
        engine.setTimeOfDay(newTime);
        const state = engine.getIlluminationState();
        if (state) {
          setAzimuth(state.azimuth);
          setElevation(state.elevation);
        }
      }
    },
    [engine]
  );

  // Color temperature to HEX converter
  const kelvinToHex = (k: number): string => {
    const temp = k / 100;
    let r: number, g: number, b: number;

    if (temp <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(temp) - 161.1195681661;
      b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
      b = 255;
    }

    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const hex = (v: number) => clamp(v).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  };

  const handleColorTempChange = (k: number) => {
    setColorTemp(k);
    const hex = kelvinToHex(k);
    setSunColorState(hex);
    engine?.setSunColor(hex);
  };

  // --------------------------------------------------------------------------
  // 3D Sun Trackball Pointer Drag
  // --------------------------------------------------------------------------
  const handleTrackballPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingTrackballRef.current = true;

    const updateFromPointer = (clientX: number, clientY: number) => {
      if (!trackballContainerRef.current) return;
      const rect = trackballContainerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = rect.width / 2 - 10;

      const dx = (clientX - cx) / radius;
      const dy = (clientY - cy) / radius;

      // Project onto 3D hemisphere
      const distSq = dx * dx + dy * dy;
      let x = dx;
      let z = dy;
      let y = 0;

      if (distSq <= 1.0) {
        y = Math.sqrt(1.0 - distSq);
      } else {
        const len = Math.sqrt(distSq);
        x /= len;
        z /= len;
        y = -0.15; // slightly below horizon
      }

      if (engine) {
        engine.setSunPositionVector(x, y, z);
        const state = engine.getIlluminationState();
        if (state) {
          setAzimuth(state.azimuth);
          setElevation(state.elevation);
        }
      }
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingTrackballRef.current) return;
      updateFromPointer(moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = () => {
      isDraggingTrackballRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    updateFromPointer(e.clientX, e.clientY);
  };

  // Modal drag handling
  const handleModalHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [role="button"]')) return;
    isDraggingModalRef.current = true;
    const initialPos = modalPos || {
      x: window.innerWidth / 2 - 190,
      y: Math.max(20, window.innerHeight / 2 - 270),
    };
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: initialPos.x,
      posY: initialPos.y,
    };

    const onPointerMove = (pe: PointerEvent) => {
      if (!isDraggingModalRef.current) return;
      const dx = pe.clientX - dragStartRef.current.startX;
      const dy = pe.clientY - dragStartRef.current.startY;
      setModalPos({
        x: Math.max(10, Math.min(window.innerWidth - 380, dragStartRef.current.posX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 100, dragStartRef.current.posY + dy)),
      });
    };

    const onPointerUp = () => {
      isDraggingModalRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (!isOpen) return null;

  // Derive Compass direction
  const getCompassHeading = (az: number): string => {
    const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(az / 45) % 8;
    return headings[idx];
  };

  // Derive Elevation status
  const getElevationLabel = (el: number): { label: string; color: string } => {
    if (el < -5) return { label: 'Midnight Night', color: 'text-neutral-700 dark:text-zinc-300' };
    if (el < 5) return { label: 'Dusk / Twilight', color: 'text-neutral-700 dark:text-zinc-300' };
    if (el < 20) return { label: 'Golden Sunset', color: 'text-neutral-700 dark:text-zinc-300' };
    if (el < 55) return { label: 'Daylight Sun', color: 'text-neutral-700 dark:text-zinc-300' };
    return { label: 'Overhead Zenith', color: 'text-neutral-800 dark:text-zinc-300' };
  };

  // Convert decimal hours to 12h AM/PM string
  const formatTime12h = (h: number): string => {
    const totalMinutes = Math.round(h * 60);
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const presetList: { id: SkyPresetName; name: string; desc: string; icon: any; color: string; badge: string }[] = [
    {
      id: 'day',
      name: 'Crisp Day',
      desc: 'Brilliant azure sky with crisp sun, streaming god rays & clouds',
      icon: Sun,
      color: 'text-neutral-700 dark:text-zinc-300',
      badge: 'Daytime',
    },
    {
      id: 'dusk',
      name: 'Dusk Sunset',
      desc: 'Dramatic magenta-violet twilight with fiery orange god rays',
      icon: Sunset,
      color: 'text-neutral-700 dark:text-zinc-300',
      badge: 'Dusk / Sunset',
    },
    {
      id: 'daylight',
      name: 'Warm Daylight',
      desc: 'Natural golden daylight with balanced fill & puffy clouds',
      icon: Sun,
      color: 'text-neutral-800 dark:text-zinc-300',
      badge: 'Daylight',
    },
    {
      id: 'noon',
      name: 'High Noon',
      desc: 'Direct overhead solar zenith with crisp high-contrast clouds',
      icon: Flame,
      color: 'text-neutral-700 dark:text-zinc-300',
      badge: 'Zenith',
    },
    {
      id: 'golden',
      name: 'Golden Hour',
      desc: 'Rich amber light beams cutting through glowing cloud edges',
      icon: Sparkles,
      color: 'text-neutral-700 dark:text-zinc-300',
      badge: 'Golden Hour',
    },
    {
      id: 'ghibli',
      name: 'Ghibli Summer',
      desc: 'Stylized anime skies with vibrant clouds and luminous sun shafts',
      icon: Zap,
      color: 'text-neutral-700 dark:text-zinc-300',
      badge: 'Stylized',
    },
    {
      id: 'mist',
      name: 'Misty Dawn',
      desc: 'Soft lavender-peach morning fog with diffused sun rays',
      icon: Sunrise,
      color: 'text-neutral-800 dark:text-zinc-300',
      badge: 'Dawn',
    },
    {
      id: 'overcast',
      name: 'Overcast Storm',
      desc: 'Moody rolling cloud decks with dramatic crepuscular light breaks',
      icon: Wind,
      color: 'text-neutral-400',
      badge: 'Storm',
    },
    {
      id: 'night',
      name: 'Night Cosmos',
      desc: 'Deep midnight starfield, Milky Way band & moonlit clouds',
      icon: Moon,
      color: 'text-neutral-700 dark:text-zinc-300',
      badge: 'Night',
    },
    {
      id: 'off',
      name: 'Studio Neutral',
      desc: 'Clean studio neutral background for precision 3D painting',
      icon: Sliders,
      color: 'text-neutral-400',
      badge: 'Neutral',
    },
  ];

  const elevationInfo = getElevationLabel(elevation);

  return (
    <div
      ref={modalCardRef}
      style={{
        left: modalPos ? `${modalPos.x}px` : 'calc(50vw - 190px)',
        top: modalPos ? `${modalPos.y}px` : 'calc(50vh - 270px)',
      }}
      className="pr-surface fixed z-50 w-[380px] max-w-[calc(100vw-20px)] bg-[#18191d] border border-[#2b2c36] text-[#e2e4ea] rounded-3xl shadow-2xl flex flex-col select-none overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans"
    >
      {/* ---------------------------------------------------- */}
      {/* MODAL HEADER & DRAG HANDLE                           */}
      {/* ---------------------------------------------------- */}
      <div
        onPointerDown={handleModalHeaderPointerDown}
        className="p-3.5 pb-2.5 bg-[#141519] border-b border-[#24262e] flex items-center justify-between cursor-move"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 shadow-sm">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-wide text-neutral-100 flex items-center gap-1.5">
              <span>Sky & Atmosphere Studio</span>
            </h3>
            <p className="text-[10px] text-neutral-400 font-medium">Procedural Sky, Clouds & God Rays</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close Studio"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* NAVIGATION TABS                                      */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center gap-1 p-2 bg-[#101116] border-b border-[#20222a] text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'presets'
              ? 'bg-[#252733] text-white shadow-sm border border-[#3b3e4d]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
          <span>Presets</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sun')}
          className={`flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'sun'
              ? 'bg-[#252733] text-white shadow-sm border border-[#3b3e4d]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
          <span>Sun & Orbit</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clouds')}
          className={`flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'clouds'
              ? 'bg-[#252733] text-white shadow-sm border border-[#3b3e4d]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
          }`}
        >
          <Cloud className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
          <span>Clouds</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('godrays')}
          className={`flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'godrays'
              ? 'bg-[#252733] text-white shadow-sm border border-[#3b3e4d]'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-neutral-800 dark:text-zinc-300" />
          <span>God Rays</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MAIN TAB CONTENT AREA                                */}
      {/* ---------------------------------------------------- */}
      <div className="p-3.5 max-h-[65vh] overflow-y-auto space-y-3.5 scrollbar-none text-xs">
        {/* ==================================================== */}
        {/* TAB 1: PRESETS (DAY, DUSK, NOON, GOLDEN, ETC.)       */}
        {/* ==================================================== */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-300">Atmosphere Presets</span>
              <span className="text-[10px] text-neutral-700 dark:text-zinc-300 font-semibold bg-neutral-900 dark:bg-white/10 px-2 py-0.5 rounded-full border border-neutral-900 dark:border-white/30">
                1-Click Lighting
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {presetList.map((p) => {
                const Icon = p.icon;
                const isSel = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePreset(p.id);
                      engine?.setSkyPreset(p.id);
                      if (p.id !== 'off') {
                        const state = engine?.getIlluminationState();
                        if (state) {
                          setAzimuth(state.azimuth);
                          setElevation(state.elevation);
                        }
                      }
                    }}
                    className={`flex flex-col text-left p-2.5 rounded-2xl border transition-all relative overflow-hidden group ${
                      isSel
                        ? 'bg-[#242733] border-neutral-900 dark:border-white/80 text-white shadow-lg ring-1 ring-neutral-900 dark:ring-white/50'
                        : 'bg-[#14151c] border-[#242630] text-neutral-300 hover:bg-[#1c1e27] hover:border-[#383b48]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="w-7 h-7 rounded-xl bg-[#232530] flex items-center justify-center">
                        <Icon className={`w-4 h-4 ${p.color}`} />
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                          isSel ? 'bg-neutral-900 dark:bg-white/30 text-neutral-800 dark:text-zinc-300' : 'bg-white/5 text-neutral-400'
                        }`}
                      >
                        {p.badge}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-white mb-0.5">{p.name}</div>
                    <div className="text-[9px] text-neutral-400 leading-snug line-clamp-2">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: SUN ELEVATION & DIURNAL CYCLE                 */}
        {/* ==================================================== */}
        {activeTab === 'sun' && (
          <div className="space-y-3">
            {/* Status Callout */}
            <div className="flex items-center justify-between bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c]">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
                <div>
                  <div className="text-[10px] text-neutral-400">Sun Position</div>
                  <div className="text-[11px] font-bold text-white">
                    Azimuth {azimuth}° ({getCompassHeading(azimuth)}) · Elevation {elevation}°
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 ${elevationInfo.color}`}>
                {elevationInfo.label}
              </span>
            </div>

            {/* Interactive 3D Solar Dome Canvas */}
            <div className="bg-[#0d0e12] p-3 rounded-2xl border border-[#23242c] flex flex-col items-center">
              <div className="text-[10px] font-bold text-neutral-400 mb-2">Drag Dome to Position Sun</div>
              <div
                ref={trackballContainerRef}
                onPointerDown={handleTrackballPointerDown}
                className="relative w-36 h-36 rounded-full bg-gradient-to-b from-[#1c2235] to-[#0a0d14] border-2 border-[#33384a] shadow-inner cursor-crosshair flex items-center justify-center touch-none group"
              >
                {/* Compass markers */}
                <span className="absolute top-1 text-[8px] font-bold text-neutral-400">N</span>
                <span className="absolute bottom-1 text-[8px] font-bold text-neutral-400">S</span>
                <span className="absolute left-1 text-[8px] font-bold text-neutral-400">W</span>
                <span className="absolute right-1 text-[8px] font-bold text-neutral-400">E</span>
                <div className="w-16 h-16 rounded-full border border-dashed border-white/10" />

                {/* Sun Indicator Puck */}
                {(() => {
                  const azRad = (azimuth * Math.PI) / 180;
                  const elRad = (Math.max(0, elevation) * Math.PI) / 180;
                  const r = Math.cos(elRad) * 56;
                  const x = Math.sin(azRad) * r;
                  const y = Math.cos(azRad) * r;
                  return (
                    <div
                      style={{
                        transform: `translate(${x}px, ${y}px)`,
                      }}
                      className="absolute w-5 h-5 rounded-full bg-white border-2 border-neutral-400 shadow-[0_0_12px_rgba(255,255,255,0.9)] flex items-center justify-center transition-transform duration-75 pointer-events-none"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Sun Elevation Slider */}
            <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-1.5">
              <div className="flex justify-between text-neutral-300">
                <span className="font-semibold flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
                  Sun Elevation
                </span>
                <span className="font-mono text-neutral-800 dark:text-zinc-300 font-bold">{elevation}°</span>
              </div>
              <input
                type="range"
                min="-15"
                max="90"
                step="1"
                value={elevation}
                onChange={(e) => handleAngleChange(azimuth, parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
              />
              <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
                <span>-15° Night</span>
                <span>0° Sunset / Dusk</span>
                <span>45° Day</span>
                <span>90° Zenith</span>
              </div>
            </div>

            {/* Sun Azimuth Slider */}
            <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-1.5">
              <div className="flex justify-between text-neutral-300">
                <span className="font-semibold flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
                  Sun Azimuth (Heading)
                </span>
                <span className="font-mono text-neutral-800 dark:text-zinc-300 font-bold">
                  {azimuth}° ({getCompassHeading(azimuth)})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={azimuth}
                onChange={(e) => handleAngleChange(parseInt(e.target.value, 10), elevation)}
                className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
              />
            </div>

            {/* 24-Hour Diurnal Cycle Simulator */}
            <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-2">
              <div className="flex items-center justify-between text-neutral-300">
                <span className="font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
                  24h Time of Day
                </span>
                <span className="font-mono text-neutral-800 dark:text-zinc-300 font-bold">{formatTime12h(timeOfDay)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="0.1"
                value={timeOfDay}
                onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
              />
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setIsPlayingTime(!isPlayingTime)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
                    isPlayingTime
                      ? 'bg-neutral-700 text-white border border-neutral-600'
                      : 'bg-neutral-900 dark:bg-white/20 text-neutral-800 dark:text-zinc-300 border border-neutral-900 dark:border-white/40 hover:bg-neutral-900 dark:bg-white/30'
                  }`}
                >
                  {isPlayingTime ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isPlayingTime ? 'Pause Cycle' : 'Simulate Day/Night'}</span>
                </button>

                <div className="flex items-center gap-1">
                  {[1, 5, 15].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaySpeed(speed)}
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${
                        playSpeed === speed ? 'bg-white text-black' : 'bg-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sun Intensity & Color Temperature */}
            <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-2">
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Sun Beam Intensity</span>
                  <span className="font-mono text-neutral-800 dark:text-zinc-300">{sunIntensity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="3.0"
                  step="0.05"
                  value={sunIntensity}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setSunIntensityState(v);
                    engine?.setSunIntensity(v);
                  }}
                  className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                />
              </div>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Color Temperature</span>
                  <span className="font-mono text-neutral-800 dark:text-zinc-300">{colorTemp}K</span>
                </div>
                <input
                  type="range"
                  min="2000"
                  max="8500"
                  step="100"
                  value={colorTemp}
                  onChange={(e) => handleColorTempChange(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: PROCEDURAL CLOUDS & MOVEMENTS                 */}
        {/* ==================================================== */}
        {activeTab === 'clouds' && (
          <div className="space-y-3">
            {/* Enable Clouds Toggle */}
            <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
                <div>
                  <div className="text-[11px] font-bold text-white">Procedural Clouds</div>
                  <div className="text-[9px] text-neutral-400">Multi-octave volumetric cloud generator</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !enableClouds;
                  setEnableCloudsState(next);
                  engine?.setEnableClouds(next);
                }}
                className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                  enableClouds
                    ? 'bg-neutral-900 dark:bg-white/20 text-neutral-800 dark:text-zinc-300 border border-neutral-900 dark:border-white/40'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {enableClouds ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{enableClouds ? 'Active' : 'Disabled'}</span>
              </button>
            </div>

            {enableClouds && (
              <div className="space-y-2.5">
                {/* Cloud Density & Coverage */}
                <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-2">
                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>Cloud Density (Thickness)</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{cloudDensity.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.05"
                      value={cloudDensity}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setCloudDensityState(v);
                        engine?.setCloudDensity(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>Cloud Sky Coverage</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{Math.round(cloudCoverage * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="0.95"
                      step="0.02"
                      value={cloudCoverage}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setCloudCoverageState(v);
                        engine?.setCloudCoverage(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>
                </div>

                {/* Cloud Movements & Wind Direction */}
                <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-2">
                  <div className="text-[10px] font-bold text-neutral-300 flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
                    <span>Cloud Movements & Wind Vector</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>Wind Movement Speed</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{(cloudSpeed * 1000).toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="0.06"
                      step="0.002"
                      value={cloudSpeed}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setCloudSpeedState(v);
                        engine?.setCloudSpeed(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>Wind Direction Angle</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{cloudWindAngle}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={cloudWindAngle}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setCloudWindAngleState(v);
                        engine?.setCloudWindAngle(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>
                </div>

                {/* Cloud Fluffiness & Scale */}
                <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-2">
                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>Cloud Scale / Detail</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{cloudScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.5"
                      step="0.05"
                      value={cloudScale}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setCloudScaleState(v);
                        engine?.setCloudScale(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>Turbulence (Fluffiness)</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{Math.round(cloudTurbulence * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={cloudTurbulence}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setCloudTurbulenceState(v);
                        engine?.setCloudTurbulence(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: GOD RAYS & VOLUMETRIC LIGHT SHAFTS            */}
        {/* ==================================================== */}
        {activeTab === 'godrays' && (
          <div className="space-y-3">
            {/* Enable God Rays Toggle */}
            <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-neutral-800 dark:text-zinc-300" />
                <div>
                  <div className="text-[11px] font-bold text-white">Volumetric God Rays</div>
                  <div className="text-[9px] text-neutral-400">Crepuscular light shafts through clouds</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !enableGodRays;
                  setEnableGodRaysState(next);
                  engine?.setEnableGodRays(next);
                }}
                className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                  enableGodRays
                    ? 'bg-neutral-900 dark:bg-white/20 text-neutral-800 dark:text-zinc-300 border border-neutral-900 dark:border-white/40'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {enableGodRays ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{enableGodRays ? 'Active' : 'Disabled'}</span>
              </button>
            </div>

            {enableGodRays && (
              <div className="space-y-2.5">
                {/* God Ray Intensity & Density */}
                <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-2">
                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>God Rays Intensity / Exposure</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{godRaysIntensity.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.05"
                      value={godRaysIntensity}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setGodRaysIntensityState(v);
                        engine?.setGodRaysIntensity(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>Ray Length & Sample Density</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{godRaysDensity.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={godRaysDensity}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setGodRaysDensityState(v);
                        engine?.setGodRaysDensity(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-400 mb-1">
                      <span>Ray Falloff Decay</span>
                      <span className="font-mono text-neutral-800 dark:text-zinc-300">{godRaysDecay.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.80"
                      max="0.99"
                      step="0.01"
                      value={godRaysDecay}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setGodRaysDecayState(v);
                        engine?.setGodRaysDecay(v);
                      }}
                      className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                    />
                  </div>
                </div>

                {/* Sun Flare Corona */}
                <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-1.5">
                  <div className="flex justify-between text-neutral-400">
                    <span>Sun Corona / Flare Halo</span>
                    <span className="font-mono text-neutral-800 dark:text-zinc-300">{sunCorona.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.1"
                    value={sunCorona}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setSunCoronaState(v);
                      engine?.setSunCoronaIntensity(v);
                    }}
                    className="w-full h-1.5 bg-[#23242b] rounded-lg appearance-none cursor-pointer accent-neutral-100"
                  />
                </div>

                {/* Quick Color Tint Palettes */}
                <div className="bg-[#0d0e12] p-2.5 rounded-2xl border border-[#23242c] space-y-2">
                  <div className="text-[10px] font-bold text-neutral-400">Light Shaft Color Tint</div>
                  <div className="flex items-center gap-1.5">
                    {[
                      { name: 'Sunlight Gold', hex: '#fff5d6' },
                      { name: 'Sunset Amber', hex: '#ff7733' },
                      { name: 'Sky Cyan', hex: '#c8f0ff' },
                      { name: 'Crisp White', hex: '#ffffff' },
                    ].map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => {
                          setGodRaysColorState(c.hex);
                          engine?.setGodRaysColor(c.hex);
                        }}
                        style={{ backgroundColor: c.hex }}
                        className={`flex-1 py-1 px-1.5 rounded-lg text-[9px] font-bold text-black border transition-all ${
                          godRaysColor === c.hex ? 'ring-2 ring-white scale-105' : 'opacity-80 hover:opacity-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* MODAL FOOTER CONTROLS                                */}
        {/* ---------------------------------------------------- */}
        <div className="pt-2.5 border-t border-[#24262e] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              handleAngleChange(145, 42);
              handleTimeChange(13.5);
              handleColorTempChange(5500);
              setSunIntensityState(1.25);
              setAmbientIntensityState(0.8);
              setCloudCoverageState(0.45);
              setCloudDensityState(1.0);
              setCloudSpeedState(0.018);
              setCloudWindAngleState(45);
              setEnableGodRaysState(true);
              setGodRaysIntensityState(1.2);
              engine?.setSunIntensity(1.25);
              engine?.setAmbientIntensity(0.8);
              engine?.setCloudCoverage(0.45);
              engine?.setCloudDensity(1.0);
              engine?.setCloudSpeed(0.018);
              engine?.setCloudWindAngle(45);
              engine?.setEnableGodRays(true);
              engine?.setGodRaysIntensity(1.2);
            }}
            className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Solar & Cloud Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-neutral-200 transition-colors shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
