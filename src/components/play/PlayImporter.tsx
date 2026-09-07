import React, { useCallback, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Upload,
  Check,
  Sliders,
  X,
  Loader2,
  Image,
  Box,
  RotateCw,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Maximize2,
} from 'lucide-react';
import { StudioEngine } from '../../core/studioEngine';
import { ModelStorage } from '../../core/modelStorage';
import { SampleModelFactory, PresetModelDefinition } from '../../core/sampleModels';
import { Saved3DModel } from '../../types';
import { haptics } from '../../utils/haptics';
import { Model3DPreview, Model3DStats } from '../common/Model3DPreview';
import { StudioCloseButton } from '../common/StudioCloseButton';

interface PlayImporterProps {
  isOpen: boolean;
  engine: StudioEngine | null;
  onClose: () => void;
  onSaved: (name: string) => void;
  onOpenFineTuning: () => void;
  theme?: 'light' | 'dark';
}

type Stage = 'choose' | 'adjusting' | 'saving';

export const PlayImporter: React.FC<PlayImporterProps> = ({
  isOpen,
  engine,
  onClose,
  onSaved,
  onOpenFineTuning,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('choose');
  const [name, setName] = useState<string>('');
  const [size, setSize] = useState<number>(1);
  const [textured, setTextured] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rotationOffset, setRotationOffset] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const [modelStats, setModelStats] = useState<Model3DStats | null>(null);

  // Loaded model reference for preview
  const [previewSource, setPreviewSource] = useState<THREE.Object3D | ArrayBuffer | null>(null);
  const [activePreset, setActivePreset] = useState<PresetModelDefinition | null>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);

  const sourceBytes = useRef<ArrayBuffer | null>(null);
  const sourceFormat = useRef<string>('glb');

  // Curated starter models for quick 1-click loading
  const starterPresets = useMemo(() => {
    const all = SampleModelFactory.getPresets();
    const desired = [
      'cyber_helmet',
      'pikachu_creature',
      'sculpted_bust',
      'ceramic_vase',
      'scifi_drone',
      'retro_arcade',
      'torus_knot',
      'capybara_bath',
    ];
    return all.filter((p) => desired.includes(p.id));
  }, []);

  const resetState = () => {
    setStage('choose');
    setName('');
    setSize(1);
    setTextured(true);
    setError(null);
    setRotationOffset({ x: 0, y: 0, z: 0 });
    setModelStats(null);
    setPreviewSource(null);
    setActivePreset(null);
    setPickedFiles([]);
    sourceBytes.current = null;
    sourceFormat.current = 'glb';
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;
      setError(null);
      setStage('saving');
      const picked = Array.from(files as ArrayLike<File>);
      try {
        const first = picked[0];
        const bytes = first ? await first.arrayBuffer() : null;
        if (!bytes) throw new Error('File buffer is empty');

        sourceBytes.current = bytes;
        sourceFormat.current = (first?.name.split('.').pop() || 'glb').toLowerCase();
        setPickedFiles(picked);
        setActivePreset(null);

        const shortName = (first?.name || 'My model').replace(/\.[^.]+$/, '');
        setName(shortName);
        setSize(1);
        setTextured(true);
        setRotationOffset({ x: 0, y: 0, z: 0 });

        // Set ArrayBuffer as preview source
        setPreviewSource(bytes);
        setStage('adjusting');
        haptics.trigger('success');
      } catch (err: any) {
        setError('That file could not be opened. Please try a valid .glb, .gltf, or .obj file.');
        setStage('choose');
      }
    },
    []
  );

  const handleSelectStarterPreset = useCallback((preset: PresetModelDefinition) => {
    haptics.trigger('light');
    setActivePreset(preset);
    setPickedFiles([]);
    sourceBytes.current = null;
    sourceFormat.current = 'mesh';
    setName(preset.name);
    setSize(1);
    setTextured(true);
    setRotationOffset({ x: 0, y: 0, z: 0 });

    try {
      const mesh = preset.createMesh ? preset.createMesh() : SampleModelFactory.createFallbackModelForPreset(preset);
      setPreviewSource(mesh);
      setStage('adjusting');
    } catch {
      setError(`Failed to generate ${preset.name}.`);
    }
  }, []);

  const handleRotateAxis = (axis: 'x' | 'y' | 'z', delta: number) => {
    haptics.trigger('light');
    setRotationOffset((prev) => ({
      ...prev,
      [axis]: (prev[axis] + delta + 360) % 360,
    }));
  };

  const handleResetOrientation = () => {
    haptics.trigger('light');
    setRotationOffset({ x: 0, y: 0, z: 0 });
  };

  const scalePresets = [0.5, 1.0, 1.5, 2.0, 4.0];

  const handleScalePreset = (val: number) => {
    haptics.trigger('light');
    setSize(val);
  };

  const toggleTexture = () => {
    haptics.trigger('light');
    setTextured((prev) => !prev);
  };

  const keepAndLoad = async () => {
    if (!engine) return;
    setStage('saving');
    setError(null);
    try {
      if (activePreset) {
        // Load preset directly into engine
        await engine.loadPresetModel(activePreset.id, textured ? 'texture' : 'clay');
        if (size !== 1) {
          engine.scaleModelOrSurface(size);
        }
      } else if (sourceBytes.current && pickedFiles.length > 0) {
        // Load custom file into engine
        await engine.loadUniversalFiles(pickedFiles);
        engine.setModelDisplayMode(textured ? 'texture' : 'clay');
        if (size !== 1) {
          engine.scaleModelOrSurface(size);
        }

        // Configure clean studio environment & surface brush
        engine.setSkyPreset('off');
        engine.setTheme(theme);
        engine.setGrid(false);

        // Save custom model to ModelStorage with Auto Preview for reuse
        try {
          const thumbnail = engine.captureSnapshot();
          const bytes = sourceBytes.current;
          const saved: Saved3DModel = {
            id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: name.trim() || 'My model',
            originalName: name.trim() || 'My model',
            originalFormat: sourceFormat.current,
            originalSize: bytes.byteLength,
            compressedSize: bytes.byteLength,
            savedDate: Date.now(),
            thumbnail,
            blob: bytes,
            triangleCount: modelStats?.triangles || 0,
            vertexCount: modelStats?.vertices || 0,
            meshCount: 1,
            materialCount: 1,
            dimensions: modelStats?.dimensions || { x: 0, y: 0, z: 0 },
          } as Saved3DModel;
          await ModelStorage.saveModel(saved);
        } catch (storageErr) {
          console.warn('Could not persist to storage, model is still on canvas:', storageErr);
        }
      }

      haptics.trigger('success');
      onSaved(name.trim() || (activePreset ? activePreset.name : 'Model'));
      resetState();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not load model onto canvas.');
      setStage('adjusting');
    }
  };

  if (!isOpen) return null;

  const panelBg = isLight ? 'bg-white text-neutral-900 border-neutral-200' : 'bg-[#12141a] text-neutral-100 border-zinc-800';
  const cardBg = isLight ? 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200' : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800';
  const softBg = isLight ? 'bg-neutral-100 border-neutral-200' : 'bg-white/5 border-white/10';

  return (
    <div className="paperrocket-modal-overlay fixed inset-0 z-[56] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className={`pr-surface w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${panelBg}`}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-5 h-16 border-b ${
          isLight ? 'border-neutral-200' : 'border-zinc-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {stage === 'adjusting' && (
              <button
                type="button"
                onClick={() => {
                  haptics.trigger('light');
                  setStage('choose');
                  setPreviewSource(null);
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-zinc-800 text-zinc-300'
                }`}
                aria-label="Back to selection"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">
                {stage === 'choose' ? 'Add a 3D Model' : 'Inspect & Tune Model'}
              </h1>
              <p className="text-xs text-neutral-400 leading-tight">
                {stage === 'choose'
                  ? 'Import your own file or select a starter 3D mesh'
                  : '360° interactive preview and placement settings'}
              </p>
            </div>
          </div>

          <StudioCloseButton
            onClick={() => {
              resetState();
              onClose();
            }}
            theme={isLight ? 'light' : 'dark'}
            ariaLabel="Close"
          />
        </div>

        {error && (
          <div className="shrink-0 mx-5 mt-3 p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto studio-scroll p-5 space-y-5">
          {stage === 'saving' && (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
              <span className="text-sm font-bold">Processing 3D mesh…</span>
            </div>
          )}

          {stage === 'choose' && (
            <>
              {/* File Dropzone */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`w-full rounded-2xl border-2 border-dashed p-7 flex flex-col items-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer ${
                  isLight
                    ? 'border-neutral-300 hover:border-neutral-500 hover:bg-neutral-50'
                    : 'border-zinc-700 hover:border-zinc-500 hover:bg-white/5'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs ${softBg}`}>
                  <Upload className={`w-6 h-6 ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`} />
                </div>
                <span className="text-sm font-bold">Choose a 3D file or drag & drop</span>
                <span className="text-xs text-neutral-400">.glb, .gltf, .obj supported</span>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".glb,.gltf,.obj,.fbx,.stl,.ply,.dae,.3ds"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Curated Starter Meshes */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Starter 3D Models
                  </span>
                  <span className="text-[11px] text-neutral-500">Tap to preview</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {starterPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectStarterPreset(preset)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 cursor-pointer ${cardBg}`}
                    >
                      <div className="aspect-video rounded-xl bg-black/20 flex items-center justify-center mb-2 overflow-hidden border border-white/5">
                        {preset.previewImage ? (
                          <img
                            src={preset.previewImage}
                            alt={preset.name}
                            className="w-full h-full object-contain p-1"
                            loading="lazy"
                          />
                        ) : (
                          <Box className="w-6 h-6 opacity-60" />
                        )}
                      </div>
                      <span className="text-xs font-bold leading-tight truncate w-full block">
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 block mt-0.5 capitalize truncate">
                        {preset.category.split('&')[0].trim()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {stage === 'adjusting' && (
            <div className="space-y-4">
              {/* Interactive 3D Model Preview Viewport */}
              <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-white/10 shadow-inner relative">
                <Model3DPreview
                  model={previewSource}
                  theme={theme}
                  displayMode={textured ? 'texture' : 'clay'}
                  rotationOffset={rotationOffset}
                  scaleMultiplier={size}
                  onStatsReady={setModelStats}
                  onDisplayModeChange={(m) => setTextured(m === 'texture')}
                />
              </div>

              {/* Model Name Input */}
              <div>
                <label className="text-xs font-bold opacity-60 block mb-1">Model Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full h-11 rounded-xl px-3.5 text-sm font-bold outline-none border transition-all ${
                    isLight
                      ? 'bg-neutral-50 border-neutral-200 focus:border-neutral-900 text-neutral-900'
                      : 'bg-zinc-900 border-zinc-700 focus:border-zinc-400 text-neutral-100'
                  }`}
                  placeholder="My model"
                />
              </div>

              {/* Quick Visual Orientation Pills */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold opacity-60">Orientation & Flip</label>
                  <button
                    type="button"
                    onClick={handleResetOrientation}
                    className="text-[11px] font-bold text-neutral-400 hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset Tilt
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRotateAxis('x', 90)}
                    className={`h-9 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${softBg}`}
                  >
                    <RotateCw className="w-3.5 h-3.5" /> +90° X
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateAxis('y', 90)}
                    className={`h-9 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${softBg}`}
                  >
                    <RotateCw className="w-3.5 h-3.5" /> +90° Y
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateAxis('z', 90)}
                    className={`h-9 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${softBg}`}
                  >
                    <RotateCw className="w-3.5 h-3.5" /> +90° Z
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateAxis('y', -90)}
                    className={`h-9 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${softBg}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> -90° Y
                  </button>
                </div>
              </div>

              {/* Visual Scale Pills & Refined Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold opacity-60">Scale & Proportions</label>
                  <span className="text-xs font-mono font-bold">{size.toFixed(2)}x</span>
                </div>

                <div className="flex items-center gap-1.5 mb-2">
                  {scalePresets.map((val) => {
                    const active = Math.abs(size - val) < 0.05;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleScalePreset(val)}
                        className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? isLight
                              ? 'bg-neutral-900 text-white shadow-xs'
                              : 'bg-white text-zinc-950 shadow-xs'
                            : softBg
                        }`}
                      >
                        {val}x
                      </button>
                    );
                  })}
                </div>

                <input
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={size}
                  onChange={(e) => setSize(parseFloat(e.target.value))}
                  className={`w-full h-6 cursor-pointer ${isLight ? 'accent-neutral-900' : 'accent-white'}`}
                />
              </div>

              {/* Surface Finish Toggle */}
              <div>
                <label className="text-xs font-bold opacity-60 block mb-1.5">Surface Material</label>
                <div className={`p-1 rounded-xl border flex items-center gap-1 ${softBg}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setTextured(true);
                      haptics.trigger('light');
                    }}
                    className={`flex-1 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      textured
                        ? isLight
                          ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200'
                          : 'bg-zinc-800 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Image className="w-3.5 h-3.5" />
                    <span>Colours from file</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTextured(false);
                      haptics.trigger('light');
                    }}
                    className={`flex-1 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !textured
                        ? isLight
                          ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200'
                          : 'bg-zinc-800 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>Plain White Clay</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {stage === 'adjusting' && (
          <div className={`shrink-0 px-5 py-4 border-t flex items-center gap-3 ${
            isLight ? 'border-neutral-200 bg-neutral-50/50' : 'border-zinc-800 bg-zinc-950/50'
          }`}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFineTuning();
              }}
              className={`h-12 px-4 rounded-2xl flex items-center gap-2 text-xs font-bold border transition-all active:scale-95 cursor-pointer ${softBg}`}
            >
              <Sliders className="w-4 h-4" />
              <span>Advanced Tuning</span>
            </button>
            <button
              type="button"
              onClick={() => void keepAndLoad()}
              className={`flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer shadow-lg ${
                isLight ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-zinc-950 hover:bg-zinc-100'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Keep & Load to Canvas</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
