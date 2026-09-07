import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SampleModelFactory, PresetModelDefinition } from '../core/sampleModels';
import { StudioEngine } from '../core/studioEngine';
import { ModelDisplayMode, Saved3DModel } from '../types';
import { ModelStorage } from '../core/modelStorage';
import { AutoPreviewGenerator } from '../utils/autoPreviewGenerator';
import {
  Box,
  Upload,
  X,
  Check,
  Search,
  Sparkles,
  Loader2,
  Zap,
  Palette,
  Trash2,
  FolderHeart,
} from 'lucide-react';

interface ModelLibraryModalProps {
  engine: StudioEngine | null;
  onClose: () => void;
  activeModelName: string;
  onOpenConverter?: () => void;
  theme?: 'light' | 'dark';
}

export const ModelLibraryModal: React.FC<ModelLibraryModalProps> = ({
  engine,
  onClose,
  activeModelName,
  onOpenConverter,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const presets = useMemo(() => SampleModelFactory.getPresets(), []);
  const [activeTab, setActiveTab] = useState<'presets' | 'saved'>('presets');
  const [savedModels, setSavedModels] = useState<Saved3DModel[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Preparing model…');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadDisplayMode, setLoadDisplayMode] = useState<ModelDisplayMode>('texture');
  const [urlInput, setUrlInput] = useState('');

  const refreshSavedModels = useCallback(async () => {
    try {
      const list = await ModelStorage.getAllModels();
      setSavedModels(list);
    } catch (e) {
      console.warn('Failed to load saved models from storage:', e);
    }
  }, []);

  useEffect(() => {
    void refreshSavedModels();
  }, [refreshSavedModels]);

  const filteredPresets = useMemo(() => {
    return presets.filter((p) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [presets, searchQuery]);

  const filteredSavedModels = useMemo(() => {
    return savedModels.filter((m) => {
      if (searchQuery.trim() === '') return true;
      return (
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.originalFormat.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [savedModels, searchQuery]);

  const handleSelectPreset = async (preset: PresetModelDefinition) => {
    if (!engine) return;
    setLoading(true);
    setLoadingMessage(`Loading ${preset.name}…`);
    setError(null);
    try {
      await engine.loadPresetModel(preset.id, loadDisplayMode);
      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to load ${preset.name}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSavedModel = async (model: Saved3DModel) => {
    if (!engine) return;
    setLoading(true);
    setLoadingMessage(`Loading ${model.name}…`);
    setError(null);
    try {
      await engine.loadGLTF(model.blob, model.name);
      engine.setModelDisplayMode(loadDisplayMode);
      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to load ${model.name}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSavedModel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ModelStorage.deleteModel(id);
      await refreshSavedModels();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete saved model.');
    }
  };

  const handleUrlLoad = async () => {
    if (!engine || !urlInput.trim()) return;
    setLoading(true);
    setLoadingMessage('Fetching & generating Auto Preview…');
    setError(null);
    try {
      const url = urlInput.trim();
      const modelName = url.split('/').pop()?.split('?')[0] || 'Remote Model';
      const response = await fetch(url);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      await engine.loadGLTF(arrayBuffer, modelName);
      engine.setModelDisplayMode(loadDisplayMode);

      let snapshot: string | null = null;
      try {
        snapshot = engine.captureSnapshot();
      } catch (e) {
        console.warn('captureSnapshot failed:', e);
      }

      await AutoPreviewGenerator.autoPreviewAndSaveBuffer(arrayBuffer, modelName, 'glb', snapshot);
      await refreshSavedModels();

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to download or parse remote 3D model.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!engine) return;
    setLoading(true);
    setLoadingMessage('Generating Auto Preview & saving model…');
    setError(null);

    try {
      await engine.loadUniversalFiles([file], file.name);
      engine.setModelDisplayMode(loadDisplayMode);

      let snapshot: string | null = null;
      try {
        snapshot = engine.captureSnapshot();
      } catch (e) {
        console.warn('captureSnapshot failed:', e);
      }

      await AutoPreviewGenerator.autoPreviewAndSaveFile(file, snapshot);
      await refreshSavedModels();

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to parse 3D model file.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        id="model-library-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Model Library"
        className={`pr-surface paperrocket-library-tray pointer-events-auto absolute inset-x-0 bottom-0 sm:inset-x-5 sm:bottom-5 flex flex-col p-4 sm:p-5 rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150 ${
          isLight
            ? 'bg-white border-black/10 text-neutral-900 shadow-[0_25px_60px_rgba(0,0,0,0.15)]'
            : 'bg-neutral-900 border-neutral-800 text-zinc-100 shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-black/10' : 'border-zinc-800'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              isLight ? 'bg-neutral-900 dark:bg-white/10 border-neutral-900 dark:border-white/20 text-neutral-900 dark:text-zinc-200' : 'bg-white/10 border-white/20 text-white'
            }`}>
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-semibold text-base leading-tight ${isLight ? 'text-neutral-900' : 'text-zinc-100'}`}>
                3D Models
              </h2>
              <p className={`text-xs ${isLight ? 'text-neutral-500' : 'text-zinc-400'}`}>
                Library, Auto Previews & Ingestion
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenConverter && (
              <button
                onClick={() => {
                  onClose();
                  onOpenConverter();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-800'
                    : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Advanced converter</span>
              </button>
            )}
            <button
              id="close-model-library-btn"
              onClick={onClose}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isLight ? 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs: Curated Presets vs My Saved Models */}
        <div className={`flex items-center justify-between pt-3 pb-1 border-b ${isLight ? 'border-black/5' : 'border-zinc-800/80'}`}>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'presets'
                  ? isLight
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white text-zinc-950 shadow-sm'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Curated Presets ({presets.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'saved'
                  ? isLight
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white text-zinc-950 shadow-sm'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderHeart className="w-3.5 h-3.5" />
              <span>My Saved Models ({savedModels.length})</span>
            </button>
          </div>

          <div className={`flex items-center gap-1 p-0.5 rounded-xl border ${
            isLight ? 'bg-neutral-100 border-black/10' : 'bg-zinc-950 border-zinc-800'
          }`}>
            <button
              type="button"
              onClick={() => setLoadDisplayMode('texture')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                loadDisplayMode === 'texture'
                  ? isLight
                    ? 'bg-white text-neutral-900 font-bold shadow-xs border border-black/10'
                    : 'bg-white text-zinc-950 font-bold shadow-sm'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Palette className="w-3 h-3" />
              <span>Original</span>
            </button>
            <button
              type="button"
              onClick={() => setLoadDisplayMode('clay')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                loadDisplayMode === 'clay'
                  ? isLight
                    ? 'bg-white text-neutral-900 font-bold shadow-xs border border-black/10'
                    : 'bg-white text-zinc-950 font-bold shadow-sm'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>White clay</span>
            </button>
          </div>
        </div>

        {/* Search Filter Bar */}
        <div className="py-2.5">
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-neutral-400' : 'text-zinc-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'presets' ? 'Search 3D model presets…' : 'Search your saved models…'}
              className={`w-full rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none transition-all ${
                isLight
                  ? 'bg-neutral-50 border border-black/15 text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 dark:border-white'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-zinc-500'
              }`}
            />
          </div>
        </div>

        {/* Models Grid & Ingestion */}
        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
          {error && (
            <div className={`p-3 rounded-xl border text-xs ${
              isLight ? 'bg-neutral-100 dark:bg-white/5 border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200' : 'bg-zinc-800 border-zinc-700 text-zinc-300'
            }`}>
              {error}
            </div>
          )}

          {loading ? (
            <div className={`h-64 flex flex-col items-center justify-center gap-3 ${isLight ? 'text-neutral-500' : 'text-zinc-400'}`}>
              <Loader2 className={`w-8 h-8 animate-spin ${isLight ? 'text-neutral-800' : 'text-zinc-200'}`} />
              <p className="text-xs font-semibold">{loadingMessage}</p>
            </div>
          ) : activeTab === 'presets' ? (
            <div className="paperrocket-model-grid grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredPresets.map((preset) => {
                const isCurrent =
                  activeModelName.toLowerCase() === preset.name.toLowerCase() ||
                  activeModelName.toLowerCase().includes(preset.id.replace(/_/g, ' '));
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`paperrocket-model-item group relative p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                      isCurrent
                        ? isLight
                          ? 'bg-neutral-100 dark:bg-white/5 border-neutral-900 dark:border-white shadow-sm'
                          : 'bg-white/10 border-white shadow-md'
                        : isLight
                        ? 'bg-[#f4f0e9]/80 border-black/10 hover:bg-[#ede8e0] hover:border-black/20'
                        : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700'
                    }`}
                  >
                    {/* Photorealistic 3D Model Preview Thumbnail */}
                    <div className={`w-16 h-16 shrink-0 rounded-xl overflow-hidden border flex items-center justify-center ${
                      isLight ? 'bg-black/5 border-black/10' : 'bg-black/40 border-white/10'
                    }`}>
                      {preset.previewImage ? (
                        <img
                          src={preset.previewImage}
                          alt={preset.name}
                          className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <Box className="w-6 h-6 opacity-40" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h3 className={`text-xs font-bold leading-tight truncate ${
                          isLight ? 'text-neutral-900' : 'text-zinc-100 group-hover:text-white'
                        }`}>
                          {preset.name}
                        </h3>
                        {isCurrent && (
                          <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            isLight ? 'bg-neutral-900 dark:bg-white text-white' : 'bg-white text-zinc-950'
                          }`}>
                            <Check className="w-2.5 h-2.5" /> Active
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] line-clamp-1 leading-snug ${isLight ? 'text-neutral-600' : 'text-zinc-400'}`}>
                        {preset.description}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
                        <span>{preset.file ? 'Draco GLB' : 'Mesh'}</span>
                        <span className="font-semibold text-neutral-400 group-hover:text-neutral-200">
                          Load Model →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="paperrocket-model-grid grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredSavedModels.map((model) => {
                const isCurrent = activeModelName.toLowerCase() === model.name.toLowerCase();
                return (
                  <div
                    key={model.id}
                    className={`paperrocket-model-item group relative p-3 rounded-2xl border transition-all flex items-center gap-3.5 ${
                      isCurrent
                        ? isLight
                          ? 'bg-neutral-100 border-neutral-900 shadow-sm'
                          : 'bg-white/10 border-white shadow-md'
                        : isLight
                        ? 'bg-[#f4f0e9]/80 border-black/10 hover:bg-[#ede8e0]'
                        : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Auto Preview Image Thumbnail */}
                    <div
                      onClick={() => handleSelectSavedModel(model)}
                      className={`w-16 h-16 shrink-0 rounded-xl overflow-hidden border flex items-center justify-center cursor-pointer ${
                        isLight ? 'bg-black/5 border-black/10' : 'bg-black/40 border-white/10'
                      }`}
                    >
                      {model.thumbnail ? (
                        <img
                          src={model.thumbnail}
                          alt={model.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Box className="w-6 h-6 opacity-40" />
                      )}
                    </div>

                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleSelectSavedModel(model)}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <h3 className={`text-xs font-bold leading-tight truncate ${
                          isLight ? 'text-neutral-900' : 'text-zinc-100 group-hover:text-white'
                        }`}>
                          {model.name}
                        </h3>
                        {isCurrent && (
                          <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            isLight ? 'bg-neutral-900 text-white' : 'bg-white text-zinc-950'
                          }`}>
                            <Check className="w-2.5 h-2.5" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {(model.compressedSize / 1024).toFixed(0)} KB • {model.originalFormat.toUpperCase()}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
                        <span>{model.triangleCount > 0 ? `${model.triangleCount.toLocaleString()} tris` : 'Auto Saved'}</span>
                        <span className="font-semibold text-neutral-400 group-hover:text-neutral-200">
                          Load Model →
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      title="Delete saved model"
                      onClick={(e) => handleDeleteSavedModel(model.id, e)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'presets' && filteredPresets.length === 0 && !loading && (
            <div className={`py-12 text-center text-xs ${isLight ? 'text-neutral-400' : 'text-zinc-500'}`}>
              No 3D models match &ldquo;{searchQuery}&rdquo;. Try another search term or upload a file.
            </div>
          )}

          {activeTab === 'saved' && filteredSavedModels.length === 0 && !loading && (
            <div className={`py-12 text-center text-xs ${isLight ? 'text-neutral-400' : 'text-zinc-500'}`}>
              {savedModels.length === 0
                ? 'No saved models in your library yet. Upload any 3D model below to automatically generate an Auto Preview and save it!'
                : `No saved models match "${searchQuery}".`}
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`paperrocket-model-upload mt-4 p-4 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-2 ${
              isDragging
                ? isLight
                  ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-white/5 text-neutral-900 dark:text-white'
                  : 'border-white bg-white/10 text-white'
                : isLight
                ? 'border-neutral-300 bg-neutral-50 text-neutral-600 hover:border-neutral-400'
                : 'border-zinc-800 bg-zinc-950/30 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <Upload className={`w-5 h-5 ${isLight ? 'text-neutral-500' : 'text-zinc-400'}`} />
            <div>
              <p className={`text-xs font-medium ${isLight ? 'text-neutral-800' : 'text-zinc-200'}`}>
                Upload any custom 3D model (.glb, .gltf, .obj)
              </p>
              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-neutral-500' : 'text-zinc-400'}`}>
                Auto Preview snapshot is automatically generated and saved to your library
              </p>
            </div>
            <label className={`mt-0.5 px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors border ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-black/10'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
            }`}>
              Choose file
              <input
                type="file"
                accept=".glb,.gltf,.obj"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          {/* Remote URL Ingestion */}
          <div className="paperrocket-model-url flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Or paste direct 3D model GLB URL (e.g. GitHub raw or CDN)..."
              className={`flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none transition-all ${
                isLight
                  ? 'bg-neutral-50 border border-black/15 text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 dark:border-white'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-zinc-500'
              }`}
            />
            <button
              onClick={handleUrlLoad}
              disabled={!urlInput.trim() || loading}
              className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-900 dark:bg-white disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Fetch & Load
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
