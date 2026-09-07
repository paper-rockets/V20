import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  X,
  Upload,
  Square,
  AlertCircle,
  Loader2,
  Search,
  Box,
  Check,
  Play,
  RotateCcw,
  Palette,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import { StudioEngine } from '../../core/studioEngine';
import { ModelStorage } from '../../core/modelStorage';
import { SampleModelFactory, PresetModelDefinition } from '../../core/sampleModels';
import { BrushSettings, Saved3DModel, ModelDisplayMode } from '../../types';
import { haptics } from '../../utils/haptics';
import { Model3DPreview, Model3DStats } from '../common/Model3DPreview';

interface ToyboxProps {
  isOpen: boolean;
  engine: StudioEngine | null;
  onClose: () => void;
  onSpawned: (modelName: string) => void;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  onOpenImporter?: () => void;
  theme?: 'light' | 'dark';
}

type ModelItem =
  | { type: 'preset'; data: PresetModelDefinition }
  | { type: 'custom'; data: Saved3DModel }
  | { type: 'blank' };

export const Toybox: React.FC<ToyboxProps> = ({
  isOpen,
  engine,
  onClose,
  onSpawned,
  setBrushSettings,
  onOpenImporter,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  // Models state
  const [customModels, setCustomModels] = useState<Saved3DModel[]>([]);
  const [listLoading, setListLoading] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected item for 3D Preview Inspector
  const [inspectingItem, setInspectingItem] = useState<ModelItem | null>(null);
  const [inspectDisplayMode, setInspectDisplayMode] = useState<ModelDisplayMode>('texture');
  const [inspectStats, setInspectStats] = useState<Model3DStats | null>(null);

  // Fetch all presets
  const presets = useMemo(() => SampleModelFactory.getPresets(), []);

  // Fetch custom saved models from IndexedDB
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setListLoading(true);
    setError(null);
    ModelStorage.getAllModels()
      .then((list) => {
        if (!cancelled) setCustomModels(list.sort((a, b) => b.savedDate - a.savedDate));
      })
      .catch(() => {
        if (!cancelled) setError('Could not read saved models from storage.');
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Filtered items
  const filteredPresets = useMemo(() => {
    return presets.filter((p) => {
      if (p.id === 'drawing_plane') return false; // Handled separately as special card
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [presets, searchQuery]);

  const filteredCustom = useMemo(() => {
    return customModels.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      return q === '' || m.name.toLowerCase().includes(q) || m.originalFormat.toLowerCase().includes(q);
    });
  }, [customModels, searchQuery]);

  /** True when canvas has drawn strokes that would be replaced. */
  const canvasHasWork = useCallback((): boolean => {
    if (!engine) return false;
    try {
      const layers = engine.getLayersSnapshot();
      return layers.some((l) => (l.strokeIds?.length ?? 0) > 0);
    } catch {
      return false;
    }
  }, [engine]);

  // Spawn model onto canvas
  const spawnModel = useCallback(
    async (item: ModelItem, displayMode: ModelDisplayMode = 'texture') => {
      if (!engine) return;
      const itemId = item.type === 'blank' ? 'blank' : item.type === 'preset' ? item.data.id : item.data.id;
      setBusyId(itemId);
      setError(null);
      try {
        engine.clearAllStrokes();

        if (item.type === 'blank') {
          await engine.loadPresetModel('drawing_plane');
          onSpawned('Drawing Canvas');
        } else if (item.type === 'preset') {
          await engine.loadPresetModel(item.data.id, displayMode);
          onSpawned(item.data.name);
        } else {
          await engine.loadGLTF(item.data.blob, item.data.name);
          engine.setModelDisplayMode(displayMode);
          onSpawned(item.data.name);
        }

        // Environment configuration
        engine.setSkyPreset('off');
        engine.setTheme(theme);
        engine.setGrid(false);

        // Arm surface brush
        setBrushSettings((prev) => ({
          ...prev,
          drawingMode: 'surface',
          profile: 'conformal',
          snappingEnabled: true,
          shapeSnapping: false,
          straightLineMode: false,
          surfaceOffset: 0.004,
        }));

        haptics.trigger('success');
        setInspectingItem(null);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'That model failed to load. Please try another.');
      } finally {
        setBusyId(null);
      }
    },
    [engine, onClose, onSpawned, setBrushSettings, theme]
  );

  // Generates preview source for inspector
  const previewSource = useMemo(() => {
    if (!inspectingItem) return null;
    if (inspectingItem.type === 'blank') {
      return SampleModelFactory.createDrawingPlane();
    }
    if (inspectingItem.type === 'preset') {
      const p = inspectingItem.data;
      return p.createMesh ? p.createMesh() : SampleModelFactory.createFallbackModelForPreset(p);
    }
    if (inspectingItem.type === 'custom') {
      return inspectingItem.data.blob;
    }
    return null;
  }, [inspectingItem]);

  if (!isOpen) return null;

  const panelBg = isLight ? 'bg-white text-neutral-900 font-sans' : 'bg-[#12141a] text-neutral-100 font-sans';
  const cardBg = isLight
    ? 'bg-neutral-50 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300'
    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80';
  const softBg = isLight ? 'bg-neutral-100' : 'bg-white/5';

  return (
    <div role="dialog" aria-modal="true" aria-label="Model Library" className={`pr-surface paperrocket-library-tray paperrocket-toybox fixed inset-x-0 bottom-0 sm:inset-x-5 sm:bottom-5 z-[55] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden ${panelBg} ${isLight ? 'border-neutral-200' : 'border-zinc-800'} select-none animate-in fade-in slide-in-from-bottom-4 duration-150`}>
      {/* Header */}
      <div className={`shrink-0 flex items-center justify-between px-5 h-16 border-b ${
        isLight ? 'border-neutral-200' : 'border-zinc-800'
      }`}>
        <div>
          <h1 className="text-base font-bold tracking-tight">Models</h1>
          <p className="text-xs text-neutral-400">Library & import</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isLight ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700' : 'bg-zinc-800 hover:bg-zinc-700 text-neutral-300'
          }`}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className={`shrink-0 px-5 py-3 border-b flex flex-col sm:flex-row items-center gap-3 ${
        isLight ? 'border-neutral-200 bg-neutral-50/50' : 'border-zinc-800 bg-zinc-950/40'
      }`}>
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models…"
            className={`w-full h-9 rounded-xl pl-9 pr-3 text-xs font-semibold outline-none border transition-all ${
              isLight
                ? 'bg-white border-neutral-200 focus:border-neutral-900 text-neutral-900 placeholder-neutral-400'
                : 'bg-zinc-900 border-zinc-700 focus:border-zinc-500 text-neutral-100 placeholder-zinc-500'
            }`}
          />
        </div>

      </div>

      {error && (
        <div className="shrink-0 mx-5 mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-5">
        {listLoading ? (
          <div className="h-full flex items-center justify-center opacity-60">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
          </div>
        ) : (
          <div className="paperrocket-toybox-list grid gap-0">
            {/* Special Action 1: Standard Drawing Canvas */}
            <button
              type="button"
              onClick={() => {
                haptics.trigger('light');
                setInspectingItem({ type: 'blank' });
              }}
              disabled={busyId !== null}
              className={`paperrocket-toybox-item rounded-2xl border p-3.5 flex flex-col gap-2.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${cardBg}`}
            >
              <div className="aspect-square rounded-xl bg-black/20 flex items-center justify-center border border-white/5">
                {busyId === 'blank' ? (
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                ) : (
                  <Square className="w-8 h-8 opacity-70" />
                )}
              </div>
              <div className="text-left">
                <span className="text-xs font-bold block leading-tight">Drawing Canvas</span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">Blank double-sided sheet</span>
              </div>
            </button>

            {/* Special Action 2: Import Custom File */}
            {onOpenImporter && (
              <button
                type="button"
                onClick={() => {
                  haptics.trigger('light');
                  onClose();
                  onOpenImporter();
                }}
                className={`paperrocket-toybox-item rounded-2xl border-2 border-dashed p-3.5 flex flex-col gap-2.5 transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'border-neutral-300 hover:border-neutral-500 hover:bg-neutral-50'
                    : 'border-zinc-700 hover:border-zinc-500 hover:bg-white/5'
                }`}
              >
                <div className="aspect-square rounded-xl flex items-center justify-center bg-black/20 border border-white/5">
                  <Upload className="w-8 h-8 opacity-70" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block leading-tight">Import 3D Asset</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">.glb, .gltf, .obj</span>
                </div>
              </button>
            )}

            {/* Curated Presets */}
            {filteredPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  haptics.trigger('light');
                  setInspectingItem({ type: 'preset', data: preset });
                }}
                disabled={busyId !== null}
                className={`paperrocket-toybox-item rounded-2xl border p-3.5 flex flex-col gap-2.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${cardBg}`}
              >
                <div className="aspect-square rounded-xl bg-black/25 flex items-center justify-center overflow-hidden border border-white/5 relative">
                  {busyId === preset.id ? (
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                  ) : preset.previewImage ? (
                    <img
                      src={preset.previewImage}
                      alt={preset.name}
                      className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <Box className="w-8 h-8 opacity-60" />
                  )}
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/75 text-white">
                    3D
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block leading-tight truncate w-full">{preset.name}</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5 truncate">
                    {preset.category.split('&')[0].trim()}
                  </span>
                </div>
              </button>
            ))}

            {/* Custom User Uploaded Models */}
            {filteredCustom.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  haptics.trigger('light');
                  setInspectingItem({ type: 'custom', data: m });
                }}
                disabled={busyId !== null}
                className={`paperrocket-toybox-item rounded-2xl border p-3.5 flex flex-col gap-2.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${cardBg}`}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-black/30 flex items-center justify-center border border-white/5">
                  {busyId === m.id ? (
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                  ) : m.thumbnail ? (
                    <img src={m.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Box className="w-8 h-8 opacity-40 text-neutral-400" />
                  )}
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block truncate w-full leading-tight">{m.name}</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">Saved Mesh</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {!listLoading && filteredPresets.length === 0 && filteredCustom.length === 0 && (
          <div className="py-16 text-center text-xs text-neutral-400">
            No 3D models found matching &ldquo;{searchQuery}&rdquo;.
          </div>
        )}
      </div>

      {/* Interactive 3D Model Preview Inspector Modal */}
      {inspectingItem && (
        <div className="paperrocket-modal-overlay fixed inset-0 z-[56] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div
            className={`pr-surface w-full max-w-lg rounded-3xl border shadow-2xl p-5 flex flex-col gap-4 overflow-hidden ${
              isLight ? 'bg-white text-neutral-900 border-neutral-200' : 'bg-[#14161d] text-neutral-100 border-zinc-800'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold leading-tight">
                  {inspectingItem.type === 'blank'
                    ? 'Drawing Canvas'
                    : inspectingItem.type === 'preset'
                    ? inspectingItem.data.name
                    : inspectingItem.data.name}
                </h2>
                <p className="text-xs text-neutral-400 leading-tight mt-0.5">
                  {inspectingItem.type === 'blank'
                    ? 'Flat double-sided sheet'
                    : inspectingItem.type === 'preset'
                    ? inspectingItem.data.description
                    : `${inspectingItem.data.originalFormat.toUpperCase()} custom model`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-neutral-100 text-neutral-500' : 'hover:bg-zinc-800 text-neutral-400'
                }`}
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Interactive 3D Preview Viewport */}
            <div className="w-full h-64 rounded-2xl overflow-hidden border border-white/10 shadow-inner relative">
              <Model3DPreview
                model={previewSource}
                theme={theme}
                displayMode={inspectDisplayMode}
                onStatsReady={setInspectStats}
                onDisplayModeChange={setInspectDisplayMode}
              />
            </div>

            {/* Surface Mode Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold opacity-60">Display Mode</span>
              <div className={`p-0.5 rounded-xl border flex items-center gap-1 ${softBg}`}>
                <button
                  type="button"
                  onClick={() => {
                    setInspectDisplayMode('texture');
                    haptics.trigger('light');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inspectDisplayMode === 'texture'
                      ? isLight
                        ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200'
                        : 'bg-zinc-800 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Textured
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInspectDisplayMode('clay');
                    haptics.trigger('light');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inspectDisplayMode === 'clay'
                      ? isLight
                        ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200'
                        : 'bg-zinc-800 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  White Clay
                </button>
              </div>
            </div>

            {/* Stroke warning if canvas has work */}
            {canvasHasWork() && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-500 font-medium">
                Note: Loading this model will clear unsaved strokes on your active drawing canvas.
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className={`flex-1 h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isLight ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700' : 'bg-zinc-800 hover:bg-zinc-700 text-neutral-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void spawnModel(inspectingItem, inspectDisplayMode)}
                disabled={busyId !== null}
                className={`flex-[2] h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer ${
                  isLight
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                    : 'bg-white text-zinc-950 hover:bg-neutral-100'
                }`}
              >
                {busyId !== null ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Spawn on Canvas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
