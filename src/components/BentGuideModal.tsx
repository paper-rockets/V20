import React, { useState } from 'react';
import { BentGuideConfig, NumpadTarget } from '../types';
import {
  Spline,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Sliders,
  Check,
  X,
  Layers,
  Sparkles,
  RotateCw,
  Activity,
  Maximize2,
} from 'lucide-react';
import { StudioEngine } from '../core/studioEngine';
import { getThemeClasses } from '../utils/themeStyles';

interface BentGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: StudioEngine | null;
  onOpenNumpad: (target: NumpadTarget) => void;
  theme?: 'light' | 'dark';
}

export const BentGuideModal: React.FC<BentGuideModalProps> = ({
  isOpen,
  onClose,
  engine,
  onOpenNumpad,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  const t = getThemeClasses(theme);
  const isLight = theme === 'light';

  const [guideName, setGuideName] = useState<string>('Curved Ribbon Guide');
  const [guideWidth, setGuideWidth] = useState<number>(0.35);
  const [guideOpacity, setGuideOpacity] = useState<number>(0.55);
  const [guidePreset, setGuidePreset] = useState<'wave' | 'arch' | 'spiral' | 'saddle'>('wave');
  const [profileCurve, setProfileCurve] = useState<'ribbon' | 'arc' | 'uchannel' | 'pipe'>('ribbon');
  const [tension, setTension] = useState<number>(0.5);
  const [divisions, setDivisions] = useState<number>(64);
  const [twist, setTwist] = useState<number>(0);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);

  const [activeGuides, setActiveGuides] = useState<BentGuideConfig[]>(
    engine?.getBentGuides() || []
  );

  const handleCreatePresetGuide = () => {
    if (!engine) return;
    const guide = engine.createPresetBentGuide(guidePreset, guideWidth, guideOpacity);
    if (guide) {
      engine.updateBentGuideParameters(guide.id, {
        profileCurve,
        tension,
        divisions,
        twist,
      });
      setSelectedGuideId(guide.id);
    }
    setActiveGuides(engine.getBentGuides());
  };

  const handleRemoveGuide = (id: string) => {
    if (!engine) return;
    engine.removeBentGuide(id);
    if (selectedGuideId === id) setSelectedGuideId(null);
    setActiveGuides(engine.getBentGuides());
  };

  const handleToggleVisibility = (guide: BentGuideConfig) => {
    if (!engine) return;
    engine.toggleBentGuideVisibility(guide.id, !guide.visible);
    setActiveGuides(engine.getBentGuides());
  };

  const handleCreateFromActiveStroke = () => {
    if (!engine) return;
    const created = engine.createBentGuideFromSelectedStroke(guideWidth, guideOpacity);
    if (created) {
      engine.updateBentGuideParameters(created.id, {
        profileCurve,
        tension,
        divisions,
        twist,
      });
      setSelectedGuideId(created.id);
      setActiveGuides(engine.getBentGuides());
    }
  };

  const handleUpdateSelected = (updates: Partial<BentGuideConfig>) => {
    if (!engine || !selectedGuideId) return;
    engine.updateBentGuideParameters(selectedGuideId, updates);
    setActiveGuides(engine.getBentGuides());
  };

  return (
    <div
      id="mody-bent-guide-modal"
      className={`pr-surface paperrocket-context-panel fixed left-[76px] sm:left-[88px] top-1/2 -translate-y-1/2 z-50 w-[300px] max-w-[calc(100vw-6rem)] max-h-[72vh] select-none shadow-2xl rounded-2xl border p-4 space-y-3 font-sans animate-in fade-in slide-in-from-left-2 duration-150 overflow-y-auto ${isLight ? 'bg-white border-black/10 shadow-black/10' : 'bg-[#18191d] border-neutral-800 shadow-black/50'} ${t.shell}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        <div className="flex items-center gap-2">
          <Spline className={`w-4 h-4 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${t.textPrimary}`}>
            Bend Along a Path
          </span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg transition-colors ${t.btnGhost}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className={`text-[11px] leading-relaxed ${t.textSecondary}`}>
        Creates curved 3D guide surfaces you can draw across with precision.
      </p>

      {/* Preset Geometry Selector */}
      <div className="space-y-1">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textSecondary}`}>
          Curvature Preset
        </span>
        <div className="grid grid-cols-4 gap-1">
          {(['wave', 'arch', 'spiral', 'saddle'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setGuidePreset(p)}
              className={`py-1 px-1.5 rounded-xl text-xs font-semibold uppercase border transition-all ${
                guidePreset === p
                  ? isLight
                    ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white shadow-xs'
                    : 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white shadow-md'
                  : isLight
                  ? 'bg-neutral-100 border-black/10 text-neutral-600 hover:bg-neutral-200'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Cross-Section Profile Selection */}
      <div className="space-y-1">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textSecondary}`}>
          Cross-Section Profile
        </span>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              { id: 'ribbon', label: 'Ribbon' },
              { id: 'arc', label: 'Arch' },
              { id: 'uchannel', label: 'U-Channel' },
              { id: 'pipe', label: 'Pipe' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setProfileCurve(item.id);
                handleUpdateSelected({ profileCurve: item.id });
              }}
              className={`py-1 px-1 rounded-xl text-[11px] font-semibold border transition-all ${
                profileCurve === item.id
                  ? isLight
                    ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white shadow-xs'
                    : 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white shadow-md'
                  : isLight
                  ? 'bg-neutral-100 border-black/10 text-neutral-600 hover:bg-neutral-200'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="space-y-2.5 pt-1">
        {/* Catmull-Rom Tension Slider */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium flex items-center gap-1 ${t.textPrimary}`}>
              <Activity className={`w-3 h-3 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`} />
              <span>Curve Tension</span>
            </span>
            <span className={`font-mono text-xs font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>
              {tension.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={tension}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setTension(val);
              handleUpdateSelected({ tension: val });
            }}
            className={`w-full h-1.5 rounded-lg cursor-pointer ${
              isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
            }`}
          />
          <div className={`flex justify-between text-[9px] font-mono ${t.textMuted}`}>
            <span>0.0 (Loose / Spline)</span>
            <span>0.5 (Centripetal)</span>
            <span>1.0 (Taut / Linear)</span>
          </div>
        </div>

        {/* Resampling Divisions Slider */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium flex items-center gap-1 ${t.textPrimary}`}>
              <Sliders className={`w-3 h-3 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`} />
              <span>Segment Divisions (Density)</span>
            </span>
            <span className={`font-mono text-xs font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>
              {divisions} segs
            </span>
          </div>
          <input
            type="range"
            min="16"
            max="256"
            step="8"
            value={divisions}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setDivisions(val);
              handleUpdateSelected({ divisions: val });
            }}
            className={`w-full h-1.5 rounded-lg cursor-pointer ${
              isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
            }`}
          />
        </div>

        {/* Swept Twist Rotation Slider */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium flex items-center gap-1 ${t.textPrimary}`}>
              <RotateCw className={`w-3 h-3 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`} />
              <span>Swept Axial Twist</span>
            </span>
            <span className={`font-mono text-xs font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>
              {twist}°
            </span>
          </div>
          <input
            type="range"
            min="-360"
            max="360"
            step="15"
            value={twist}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setTwist(val);
              handleUpdateSelected({ twist: val });
            }}
            className={`w-full h-1.5 rounded-lg cursor-pointer ${
              isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
            }`}
          />
        </div>

        {/* Width Slider */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${t.textPrimary}`}>Guide Width</span>
            <button
              onClick={() =>
                onOpenNumpad({
                  id: 'guide_width',
                  title: 'Guide Width',
                  value: guideWidth,
                  min: 0.05,
                  max: 2.0,
                  step: 0.05,
                  unit: 'm',
                  onConfirm: (val) => {
                    setGuideWidth(val);
                    handleUpdateSelected({ width: val });
                  },
                })
              }
              className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold ${
                isLight ? 'bg-neutral-100 text-neutral-900 dark:text-neutral-200 border border-black/10' : 'bg-neutral-800 text-neutral-800 dark:text-zinc-300'
              }`}
            >
              {(guideWidth * 100).toFixed(0)} cm
            </button>
          </div>
          <input
            type="range"
            min="0.05"
            max="1.5"
            step="0.05"
            value={guideWidth}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setGuideWidth(val);
              handleUpdateSelected({ width: val });
            }}
            className={`w-full h-1.5 rounded-lg cursor-pointer ${
              isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
            }`}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-1.5 pt-1">
        <button
          onClick={handleCreatePresetGuide}
          className={`w-full py-2 px-3 rounded-xl ${isLight ? 'bg-neutral-900 hover:bg-black text-white' : 'bg-white hover:bg-neutral-100 text-zinc-950'} text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-transform active:scale-98`}
        >
          <Plus className="w-4 h-4" />
          <span>Create Curved Guide</span>
        </button>

        <button
          onClick={handleCreateFromActiveStroke}
          className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${t.btnSecondary}`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-700 dark:text-zinc-300' : 'text-neutral-700 dark:text-zinc-300'}`} />
          <span>Convert Last Drawn Curve to Guide</span>
        </button>
      </div>

      {/* Active Bent Guides List */}
      {activeGuides.length > 0 && (
        <div className={`pt-2 border-t space-y-1.5 ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textSecondary}`}>
            Active Curved Guides ({activeGuides.length})
          </span>
          <div className="space-y-1">
            {activeGuides.map((g) => {
              const isSelected = selectedGuideId === g.id;
              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGuideId(g.id)}
                  className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? isLight
                        ? 'bg-neutral-100 dark:bg-white/5 border-neutral-400 dark:border-neutral-600 ring-1 ring-neutral-400 dark:ring-neutral-600'
                        : 'bg-black/30 dark:bg-white/5/40 border-neutral-900 dark:border-white/60 ring-1 ring-neutral-900 dark:ring-white/30'
                      : isLight
                      ? 'bg-neutral-50 border-black/10 hover:border-black/20'
                      : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Spline className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`} />
                    <span className={`font-semibold truncate ${t.textPrimary}`}>{g.name}</span>
                    <span className={`text-[10px] font-mono ${t.textMuted}`}>
                      ({g.profileCurve || 'ribbon'})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(g);
                      }}
                      className={`p-1 rounded ${t.btnGhost}`}
                      title="Toggle Visibility"
                    >
                      {g.visible ? (
                        <Eye className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-700 dark:text-zinc-300'}`} />
                      ) : (
                        <EyeOff className={`w-3.5 h-3.5 ${t.textMuted}`} />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveGuide(g.id);
                      }}
                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                      title="Delete Guide"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
