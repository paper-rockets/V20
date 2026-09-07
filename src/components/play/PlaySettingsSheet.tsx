import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Wrench,
  Gauge,
  Compass,
  Hand,
  Box,
  HardDrive,
  ShieldCheck,
  Shield,
  RotateCcw,
  Sliders,
  Volume2,
  Grid,
  Layers,
  Download,
  Glasses,
  Image,
  Sparkles,
  Smartphone,
  Check,
  ChevronRight,
  ChevronDown,
  FolderArchive,
} from 'lucide-react';
import { PlaySheet } from './PlaySheet';
import { closeSheet } from './sheetStore';
import { setUiMode, useUiMode } from '../../core/uiModeStore';
import { haptics } from '../../utils/haptics';
import { StorageEstimateInfo, AutoSaveMetaInfo } from '../../utils/storagePermission';

export interface PlaySettingsSheetProps {
  theme: 'light' | 'dark';
  onSetTheme: (t: 'light' | 'dark') => void;
  // UI Scale
  uiScale?: number;
  onUiScaleChange?: (scale: number) => void;
  // Sensitivity
  navigatorSensitivity?: number;
  onSensitivityChange?: (sens: number) => void;
  // Camera Projection
  projectionMode?: 'perspective' | 'orthographic';
  onToggleProjection?: () => void;
  // Touch drawing
  fingerDraw: boolean;
  onToggleFingerDraw: (on: boolean) => void;
  // Radial menu
  disableContextMenu?: boolean;
  onToggleDisableContextMenu?: () => void;
  // Sound
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  // Scene
  showGrid?: boolean;
  onToggleGrid?: () => void;
  showPlane?: boolean;
  onTogglePlane?: () => void;
  modelDisplayMode: 'texture' | 'clay';
  onSetModelDisplayMode: (mode: 'texture' | 'clay') => void;
  onOpenIllumination?: () => void;
  onOpenSkyEnvironment?: () => void;
  onOpenRenderSettings?: () => void;
  // Share & Export
  onOpenSessions?: () => void;
  onOpenExport?: () => void;
  onOpenARViewer?: () => void;
  // Reference Images
  onOpenClipboard?: () => void;
  // Storage & Autosave
  isStoragePersistent?: boolean;
  onRequestStoragePermission?: () => Promise<boolean>;
  storageEstimate?: StorageEstimateInfo | null;
  autoSaveMeta?: AutoSaveMetaInfo;
  onRestoreAutoSave?: () => void;
  // Navigator Style & Toggle
  navigatorStyle?: 'opt3' | 'opt1' | 'classic';
  onNavigatorStyleChange?: (style: 'opt3' | 'opt1' | 'classic') => void;
  // Navigator & Stats
  showNavigator?: boolean;
  onToggleNavigator?: (show: boolean) => void;
  showStats?: boolean;
  onToggleStats?: (show: boolean) => void;
}



const Row: React.FC<{
  icon: React.FC<{ className?: string }>;
  label: string;
  hint?: string;
  children: React.ReactNode;
  isLight: boolean;
}> = ({ icon: Icon, label, hint, children, isLight }) => (
  <div
    className={`paperrocket-settings-row flex items-center gap-3.5 py-3 border-b last:border-b-0 min-h-[52px] ${
      isLight ? 'border-neutral-200' : 'border-neutral-800'
    }`}
  >
    <Icon className="w-5 h-5 shrink-0 opacity-80" />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-bold leading-tight">{label}</div>
      {hint && <div className="text-xs text-neutral-400 leading-tight mt-0.5">{hint}</div>}
    </div>
    <div className="paperrocket-settings-control shrink-0">{children}</div>
  </div>
);

const SectionHeader: React.FC<{ title: string; isLight: boolean }> = ({ title, isLight }) => (
  <div className={`paperrocket-settings-section pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
    {title}
  </div>
);

/** Minimalist switch. */
const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; isLight?: boolean }> = ({
  on,
  onChange,
  label,
  isLight = false,
}) => (
  <button
    type="button"
    role="switch"
    data-state={on ? 'on' : 'off'}
    aria-checked={on}
    aria-label={label}
    onClick={() => {
      haptics.trigger('light');
      onChange(!on);
    }}
    className={`paperrocket-toggle w-12 h-7 rounded-full transition-colors cursor-pointer relative min-h-[28px] ${
      on ? (isLight ? 'bg-neutral-900' : 'bg-white') : (isLight ? 'bg-neutral-300' : 'bg-neutral-700')
    }`}
  >
    <span
      className={`absolute top-1 w-5 h-5 rounded-full shadow transition-all duration-150 ${
        on ? (isLight ? 'left-6 bg-white' : 'left-6 bg-zinc-950') : 'left-1 bg-white'
      }`}
    />
  </button>
);

export const PlaySettingsSheet: React.FC<PlaySettingsSheetProps> = ({
  theme,
  onSetTheme,
  uiScale = 1.0,
  onUiScaleChange,
  navigatorSensitivity = 1.0,
  onSensitivityChange,
  projectionMode = 'perspective',
  onToggleProjection,
  fingerDraw,
  onToggleFingerDraw,
  disableContextMenu = false,
  onToggleDisableContextMenu,
  soundEnabled,
  onToggleSound,
  showGrid = true,
  onToggleGrid,
  showPlane = false,
  onTogglePlane,
  modelDisplayMode,
  onSetModelDisplayMode,
  onOpenIllumination,
  onOpenSkyEnvironment,
  onOpenRenderSettings,
  onOpenSessions,
  onOpenExport,
  onOpenARViewer,
  onOpenClipboard,
  isStoragePersistent = false,
  onRequestStoragePermission,
  storageEstimate,
  autoSaveMeta,
  onRestoreAutoSave,
  navigatorStyle = 'opt3',
  onNavigatorStyleChange,
  showNavigator = true,
  onToggleNavigator,
  showStats = false,
  onToggleStats,
}) => {
  const isLight = theme === 'light';
  const uiMode = useUiMode();
  const [internalSound, setInternalSound] = useState<boolean>(() => haptics.getAudioFeedbackEnabled());
  const [showMore, setShowMore] = useState(false);

  const effectiveSound = soundEnabled !== undefined ? soundEnabled : internalSound;

  const handleToggleSoundFeedback = () => {
    if (onToggleSound) {
      onToggleSound();
    } else {
      const next = haptics.toggleAudioFeedback();
      setInternalSound(next);
    }
  };

  const pill = (active: boolean) =>
    `flex-1 min-h-[36px] h-9 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
      active
        ? isLight ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-zinc-950 shadow-sm'
        : isLight
          ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
    }`;

  const actionBtn = `min-h-[38px] px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-2 border transition-all active:scale-98 cursor-pointer ${
    isLight
      ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
      : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
  }`;

  return (
    <PlaySheet id="settings" title="Preferences" theme={theme} tall>
      <div className="paperrocket-preferences">
      {/* 1. STUDIO */}
      <SectionHeader title="Studio" isLight={isLight} />

      <Row icon={isLight ? Sun : Moon} label="Studio Theme" hint="Viewport and interface contrast" isLight={isLight}>
        <div className="flex gap-1 w-40">
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onSetTheme('light');
            }}
            className={pill(isLight)}
          >
            <Sun className="w-4 h-4" /> Light
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onSetTheme('dark');
            }}
            className={pill(!isLight)}
          >
            <Moon className="w-4 h-4" /> Dark
          </button>
        </div>
      </Row>

      {onUiScaleChange && (
        <Row icon={Sliders} label="UI Scale" hint={`Interface size (${Math.round(uiScale * 100)}%)`} isLight={isLight}>
          <div className="paperrocket-stepper flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                haptics.trigger('light');
                onUiScaleChange(Math.max(0.7, uiScale - 0.1));
              }}
              className={`min-h-[36px] min-w-[36px] px-2 rounded-lg border text-sm font-bold flex items-center justify-center transition-colors ${
                isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white'
              }`}
            >
              -
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.trigger('light');
                onUiScaleChange(1.0);
              }}
              className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] font-mono font-bold flex items-center justify-center transition-colors ${
                isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
              }`}
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.trigger('light');
                onUiScaleChange(Math.min(1.5, uiScale + 0.1));
              }}
              className={`min-h-[36px] min-w-[36px] px-2 rounded-lg border text-sm font-bold flex items-center justify-center transition-colors ${
                isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white'
              }`}
            >
              +
            </button>
          </div>
        </Row>
      )}

      {onNavigatorStyleChange && (
        <Row icon={Compass} label="Navigator Tool" hint="Active 3D navigation interface" isLight={isLight}>
          <div className="flex gap-1 w-44">
            <button
              type="button"
              onClick={() => {
                haptics.trigger('light');
                onNavigatorStyleChange('opt3');
              }}
              className={pill(navigatorStyle === 'opt3')}
              title="Opt 3: Sphere Gimbal Navigator"
            >
              Sphere
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.trigger('light');
                onNavigatorStyleChange('opt1');
              }}
              className={pill(navigatorStyle === 'opt1')}
              title="Opt 1: Tabbed Deck Navigator"
            >
              Tabbed
            </button>
          </div>
        </Row>
      )}

      {onSensitivityChange && (
        <Row icon={Compass} label="Navigator Sensitivity" hint={`Speed and responsiveness (${navigatorSensitivity.toFixed(2)}x)`} isLight={isLight}>
          <div className="flex flex-col gap-1.5 w-40">
            <div className="flex items-center gap-1">
              {[0.25, 0.5, 1.0, 2.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    haptics.trigger('light');
                    onSensitivityChange(s);
                  }}
                  className={`flex-1 min-h-[36px] py-1 text-[11px] font-mono rounded-lg border transition-all ${
                    Math.abs(navigatorSensitivity - s) < 0.05
                      ? isLight
                        ? 'bg-neutral-900 border-neutral-900 text-white font-bold'
                        : 'bg-white border-white text-zinc-950 font-bold'
                      : isLight
                      ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.05"
              value={navigatorSensitivity}
              onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded cursor-pointer ${isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'}`}
            />
          </div>
        </Row>
      )}

      {onToggleProjection && (
        <Row icon={Box} label="Camera Projection" hint="3D perspective depth vs isometric flat view" isLight={isLight}>
          <div className="flex gap-1 w-40">
            <button
              type="button"
              onClick={() => {
                if (projectionMode !== 'perspective') {
                  haptics.trigger('light');
                  onToggleProjection();
                }
              }}
              className={pill(projectionMode === 'perspective')}
            >
              Perspective
            </button>
            <button
              type="button"
              onClick={() => {
                if (projectionMode !== 'orthographic') {
                  haptics.trigger('light');
                  onToggleProjection();
                }
              }}
              className={pill(projectionMode === 'orthographic')}
            >
              Flat
            </button>
          </div>
        </Row>
      )}

      <Row icon={Hand} label="Touch Input Drawing" hint="Enable touch drawing when stylus is unavailable" isLight={isLight}>
        <Toggle on={fingerDraw} onChange={onToggleFingerDraw} label="Touch Input Drawing" isLight={isLight} />
      </Row>

      {onToggleDisableContextMenu && (
        <Row icon={Compass} label="Radial Quick Menu" hint="Stylus hover or tap shortcut ring" isLight={isLight}>
          <Toggle on={!disableContextMenu} onChange={() => onToggleDisableContextMenu()} label="Radial Quick Menu" isLight={isLight} />
        </Row>
      )}

      <Row icon={Volume2} label="Tactile Sound" hint="Auditory clicks and vibration feedback" isLight={isLight}>
        <Toggle on={effectiveSound} onChange={handleToggleSoundFeedback} label="Tactile Sound" isLight={isLight} />
      </Row>

      {onToggleNavigator && (
        <Row icon={Compass} label="Spatial Navigator" hint="Corner rotation and positioning controller" isLight={isLight}>
          <Toggle on={showNavigator} onChange={onToggleNavigator} label="Spatial Navigator" isLight={isLight} />
        </Row>
      )}

      {/* 2. SCENE */}
      <SectionHeader title="Scene" isLight={isLight} />

      {onToggleGrid && (
        <Row icon={Grid} label="Ground Grid" hint="Display reference 3D ground plane grid" isLight={isLight}>
          <Toggle on={showGrid} onChange={() => onToggleGrid()} label="Ground Grid" isLight={isLight} />
        </Row>
      )}

      {/* Accordion toggle: More settings / Fewer settings */}
      <button
        type="button"
        onClick={() => {
          haptics.trigger('light');
          setShowMore((value) => !value);
        }}
        className={`paperrocket-settings-more w-full min-h-[46px] flex items-center gap-2.5 border-b text-left transition-colors ${
          isLight ? 'border-neutral-200 hover:bg-black/[0.025]' : 'border-neutral-800 hover:bg-white/[0.025]'
        }`}
        aria-expanded={showMore}
      >
        {showMore ? <ChevronDown className="w-5 h-5 opacity-70" /> : <ChevronRight className="w-5 h-5 opacity-70" />}
        <span className="flex-1 text-sm font-bold">{showMore ? 'Fewer settings' : 'More settings'}</span>
        <span className="text-xs text-neutral-400">{showMore ? 'Hide details' : 'Scene, export, storage & Pro'}</span>
      </button>

      {/* Advanced Settings Block (Contiguous, revealed directly beneath the toggle) */}
      {showMore && (
        <>
          {onTogglePlane && (
            <Row icon={Layers} label="Drawing Plane" hint="Surface alignment plane for drawing strokes" isLight={isLight}>
              <Toggle on={showPlane} onChange={() => onTogglePlane()} label="Drawing Plane" isLight={isLight} />
            </Row>
          )}

          {onOpenIllumination && (
            <Row icon={Sun} label="Studio Lighting" hint="Scene illumination, soft shadows, and studio presets" isLight={isLight}>
              <button type="button" onClick={onOpenIllumination} className={actionBtn}>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Studio Illumination</span>
              </button>
            </Row>
          )}

          {onOpenSkyEnvironment && (
            <Row icon={Sun} label="Skybox" hint="Atmosphere and background environment lighting" isLight={isLight}>
              <button type="button" onClick={onOpenSkyEnvironment} className={actionBtn}>
                <Sun className="w-4 h-4" />
                <span>Configure Skybox</span>
              </button>
            </Row>
          )}

          {onOpenRenderSettings && (
            <Row icon={Sparkles} label="Picture Quality" hint="Visual fidelity, glow, and viewport rendering" isLight={isLight}>
              <button type="button" onClick={onOpenRenderSettings} className={actionBtn}>
                <Sparkles className="w-4 h-4" />
                <span>Picture Quality</span>
              </button>
            </Row>
          )}

          <Row icon={Box} label="Model Appearance" hint="Keep imported textures or use neutral studio clay" isLight={isLight}>
            <div className="flex gap-1 w-40">
              <button type="button" onClick={() => onSetModelDisplayMode('texture')} className={pill(modelDisplayMode === 'texture')}>Texture</button>
              <button type="button" onClick={() => onSetModelDisplayMode('clay')} className={pill(modelDisplayMode === 'clay')}>White Clay</button>
            </div>
          </Row>

          {/* 3. SHARE & EXPORT */}
          <SectionHeader title="Share & Export" isLight={isLight} />

          {onOpenSessions && (
            <Row icon={FolderArchive} label="Project Sessions" hint="Save and switch between editable sessions with undo history" isLight={isLight}>
              <button type="button" onClick={onOpenSessions} className={actionBtn}>
                <FolderArchive className="w-4 h-4" />
                <span>Manage Sessions</span>
              </button>
            </Row>
          )}

          {onOpenExport && (
            <Row icon={Download} label="Export 3D Artwork" hint="Save model as GLB, OBJ, STL, or image capture" isLight={isLight}>
              <button type="button" onClick={onOpenExport} className={actionBtn}>
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </Row>
          )}

          {onOpenARViewer && (
            <Row icon={Glasses} label="View in AR" hint="Experience model in real space with augmented reality" isLight={isLight}>
              <button type="button" onClick={onOpenARViewer} className={actionBtn}>
                <Glasses className="w-4 h-4" />
                <span>View in AR</span>
              </button>
            </Row>
          )}

          {/* 4. REFERENCE IMAGES */}
          {onOpenClipboard && (
            <>
              <SectionHeader title="Reference Images" isLight={isLight} />
              <Row icon={Image} label="Reference Images" hint="Pin 2D concept art and blueprint photos on screen" isLight={isLight}>
                <button type="button" onClick={onOpenClipboard} className={actionBtn}>
                  <Image className="w-4 h-4" />
                  <span>Reference Images</span>
                </button>
              </Row>
            </>
          )}

          {/* 5. STORAGE & DIAGNOSTICS */}
          <SectionHeader title="Storage & Diagnostics" isLight={isLight} />

          <Row
            icon={HardDrive}
            label="Storage & Autosave"
            hint={
              isStoragePersistent
                ? `Protected against eviction • ${storageEstimate?.formattedUsage || '0 MB'} used`
                : `Standard browser storage • ${storageEstimate?.formattedUsage || '0 MB'} used`
            }
            isLight={isLight}
          >
            <div className="flex items-center gap-2">
              {isStoragePersistent ? (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    isLight
                      ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                      : 'bg-white/10 border-white/20 text-white'
                  }`}
                  title="Browser storage permission granted: protected against automatic cache eviction"
                >
                  <ShieldCheck className="w-4 h-4 text-current" />
                  <span>Protected</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (onRequestStoragePermission) {
                      await onRequestStoragePermission();
                      haptics.trigger('success');
                    }
                  }}
                  className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                    isLight
                      ? 'bg-neutral-900 border-neutral-900 text-white hover:bg-neutral-800'
                      : 'bg-white border-white text-zinc-950 hover:bg-neutral-200'
                  }`}
                  title="Request browser storage permission so projects are protected from browser cache clearance"
                >
                  <Shield className="w-4 h-4 text-current" />
                  <span>Protect Storage</span>
                </button>
              )}

              {autoSaveMeta?.exists && onRestoreAutoSave && (
                <button
                  type="button"
                  onClick={() => {
                    onRestoreAutoSave();
                    haptics.trigger('success');
                  }}
                  className={`min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                    isLight
                      ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                      : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                  }`}
                  title={`Restore session from ${autoSaveMeta.formattedDate || 'autosave'}`}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-current" />
                  <span>Restore</span>
                </button>
              )}
            </div>
          </Row>

          {onToggleStats && (
            <Row icon={Gauge} label="Performance Diagnostics" hint="Display real-time frame rate & engine latency" isLight={isLight}>
              <Toggle on={showStats} onChange={onToggleStats} label="Performance Diagnostics" isLight={isLight} />
            </Row>
          )}

          {/* 6. INTERFACE MODE */}
          <SectionHeader title="Interface Mode" isLight={isLight} />
          <Row
            icon={Wrench}
            label="Pro Mode Interface"
            hint="Switch to five-mode professional 3D studio workbench"
            isLight={isLight}
          >
            <Toggle
              on={uiMode === 'pro'}
              onChange={(v) => {
                haptics.trigger('mode-switch');
                setUiMode(v ? 'pro' : 'play');
              }}
              label="Pro Mode Interface"
              isLight={isLight}
            />
          </Row>
        </>
      )}

      </div>
    </PlaySheet>
  );
};
