import React, { useState } from 'react';
import { StudioEngine } from '../core/studioEngine';
import { Download, Camera, Image, Box, X, Check, Loader2, FolderHeart } from 'lucide-react';
import { ModelStorage } from '../core/modelStorage';
import { Saved3DModel } from '../types';

import { PlatformBridge } from '../core/platformBridge';

interface ExportModalProps {
  engine: StudioEngine | null;
  onClose: () => void;
  activeModelName: string;
  theme?: 'light' | 'dark';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  engine,
  onClose,
  activeModelName,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [exporting, setExporting] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExportGLB = async () => {
    if (!engine) return;
    setExporting('glb');
    try {
      const blob = await engine.exportGLB();
      const savedPath = await PlatformBridge.saveModelFile(
        `${activeModelName.replace(/\s+/g, '_')}_painted.glb`,
        blob,
        [{ name: 'GLB 3D Model', extensions: ['glb'] }]
      );
      if (savedPath) {
        PlatformBridge.triggerHaptic('success');
        setSuccess('GLB export completed successfully!');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportOBJ = async () => {
    if (!engine) return;
    setExporting('obj');
    try {
      const text = engine.exportOBJ();
      const savedPath = await PlatformBridge.saveModelFile(
        `${activeModelName.replace(/\s+/g, '_')}_painted.obj`,
        text,
        [{ name: 'Wavefront OBJ', extensions: ['obj'] }]
      );
      if (savedPath) {
        PlatformBridge.triggerHaptic('success');
        setSuccess('OBJ export completed successfully!');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportUVTexture = async () => {
    if (!engine) return;
    setExporting('uv');
    try {
      const dataUrl = engine.uvEngine.exportPNG();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const savedPath = await PlatformBridge.saveModelFile(
        `${activeModelName.replace(/\s+/g, '_')}_texture_2048.png`,
        blob,
        [{ name: 'PNG Texture Map', extensions: ['png'] }]
      );
      if (savedPath) {
        PlatformBridge.triggerHaptic('success');
        setSuccess('UV Texture map exported successfully!');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!engine) return;
    setExporting('snapshot');
    try {
      const dataUrl = engine.captureSnapshot();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const savedPath = await PlatformBridge.saveModelFile(
        `${activeModelName.replace(/\s+/g, '_')}_studio_render.png`,
        blob,
        [{ name: 'PNG Studio Render', extensions: ['png'] }]
      );
      if (savedPath) {
        PlatformBridge.triggerHaptic('success');
        setSuccess('Studio render snapshot captured!');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!engine) return;
    setExporting('storage');
    try {
      const glbBlob = await engine.exportGLB();
      const arrayBuffer = await glbBlob.arrayBuffer();
      const snapshot = engine.captureSnapshot();

      const savedModel: Saved3DModel = {
        id: `model_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: `${activeModelName}_painted`,
        originalName: activeModelName,
        originalFormat: 'glb',
        originalSize: arrayBuffer.byteLength,
        compressedSize: arrayBuffer.byteLength,
        savedDate: Date.now(),
        thumbnail: snapshot,
        blob: arrayBuffer,
        triangleCount: 0,
        vertexCount: 0,
        meshCount: 1,
        materialCount: 1,
        dimensions: { x: 1, y: 1, z: 1 },
        dracoCompressed: false,
        isBaked: true,
      };

      await ModelStorage.saveModel(savedModel);
      PlatformBridge.triggerHaptic('success');
      setSuccess('Model & Auto Preview saved to your library!');
    } catch (e: any) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="paperrocket-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        id="export-modal-dialog"
        className={`pr-surface w-full max-w-lg flex flex-col p-6 rounded-3xl border shadow-2xl overflow-hidden ${
          isLight
            ? 'bg-white border-black/10 text-neutral-800 shadow-2xl'
            : 'bg-[#18191d] border-neutral-800 text-neutral-100 shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-4 border-b ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
          <div className={`flex items-center gap-2.5 font-semibold text-base ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>
            <Download className="w-5 h-5 text-neutral-700 dark:text-zinc-300" />
            <span>Export</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors ${
              isLight ? 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900' : 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Options */}
        <div className="space-y-3 my-5">
          {/* GLB Option */}
          <div
            onClick={handleExportGLB}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
              isLight
                ? 'bg-[#f4f0e9]/80 hover:bg-[#ede8e0] border-black/10'
                : 'bg-neutral-950/50 hover:bg-neutral-800/60 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl transition-all ${
                isLight ? 'bg-black/5 text-neutral-900 group-hover:bg-neutral-900 group-hover:text-white' : 'bg-white/10 text-white group-hover:bg-white group-hover:text-zinc-950'
              }`}>
                <Box className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className={`text-sm font-semibold transition-colors ${
                  isLight ? 'text-neutral-900 group-hover:text-neutral-900' : 'text-neutral-100 group-hover:text-white'
                }`}>
                  Combined 3D GLB Binary
                </span>
                <span className={`text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Full 3D model with integrated conformal stroke geometries
                </span>
              </div>
            </div>
            {exporting === 'glb' ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-700 dark:text-zinc-300" />
            ) : (
              <Download className={`w-4 h-4 transition-colors ${isLight ? 'text-neutral-400 group-hover:text-neutral-900' : 'text-neutral-500 group-hover:text-neutral-200'}`} />
            )}
          </div>

          {/* OBJ Option */}
          <div
            onClick={handleExportOBJ}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
              isLight
                ? 'bg-[#f4f0e9]/80 hover:bg-[#ede8e0] border-black/10'
                : 'bg-neutral-950/50 hover:bg-neutral-800/60 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl transition-all ${
                isLight ? 'bg-neutral-900 dark:bg-white/10 text-neutral-900 dark:text-zinc-200 group-hover:bg-neutral-900 dark:bg-white group-hover:text-white' : 'bg-neutral-900 dark:bg-white/20 text-neutral-700 dark:text-zinc-300 group-hover:bg-neutral-900 dark:bg-white group-hover:text-white'
              }`}>
                <Box className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className={`text-sm font-semibold transition-colors ${
                  isLight ? 'text-neutral-900 group-hover:text-neutral-900 dark:text-zinc-200' : 'text-neutral-100 group-hover:text-neutral-700 dark:text-zinc-300'
                }`}>
                  Wavefront OBJ Mesh
                </span>
                <span className={`text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Standard OBJ geometry compatible with Blender, Maya, and Unity
                </span>
              </div>
            </div>
            {exporting === 'obj' ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-700 dark:text-zinc-300" />
            ) : (
              <Download className={`w-4 h-4 transition-colors ${isLight ? 'text-neutral-400 group-hover:text-neutral-900' : 'text-neutral-500 group-hover:text-neutral-200'}`} />
            )}
          </div>

          {/* UV Map Texture PNG */}
          <div
            onClick={handleExportUVTexture}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
              isLight
                ? 'bg-[#f4f0e9]/80 hover:bg-[#ede8e0] border-black/10'
                : 'bg-neutral-950/50 hover:bg-neutral-800/60 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl transition-all ${
                isLight ? 'bg-neutral-900 dark:bg-white/10 text-neutral-900 dark:text-zinc-200 group-hover:bg-neutral-900 dark:bg-white group-hover:text-white' : 'bg-neutral-900 dark:bg-white/20 text-neutral-700 dark:text-zinc-300 group-hover:bg-neutral-900 dark:bg-white group-hover:text-white'
              }`}>
                <Image className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className={`text-sm font-semibold transition-colors ${
                  isLight ? 'text-neutral-900 group-hover:text-neutral-900 dark:text-zinc-200' : 'text-neutral-100 group-hover:text-neutral-700 dark:text-zinc-300'
                }`}>
                  2K UV Texture Map PNG
                </span>
                <span className={`text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  2048x2048 dynamic UV painted surface texture map
                </span>
              </div>
            </div>
            {exporting === 'uv' ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-700 dark:text-zinc-300" />
            ) : (
              <Download className={`w-4 h-4 transition-colors ${isLight ? 'text-neutral-400 group-hover:text-neutral-900' : 'text-neutral-500 group-hover:text-neutral-200'}`} />
            )}
          </div>

          {/* Save to In-App Library with Auto Preview */}
          <div
            onClick={handleSaveToLibrary}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
              isLight
                ? 'bg-[#f4f0e9]/80 hover:bg-[#ede8e0] border-black/10'
                : 'bg-neutral-950/50 hover:bg-neutral-800/60 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl transition-all ${
                isLight ? 'bg-black/5 text-neutral-900 group-hover:bg-neutral-900 group-hover:text-white' : 'bg-white/10 text-white group-hover:bg-white group-hover:text-zinc-950'
              }`}>
                <FolderHeart className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className={`text-sm font-semibold transition-colors ${
                  isLight ? 'text-neutral-900 group-hover:text-neutral-900' : 'text-neutral-100 group-hover:text-white'
                }`}>
                  Save to In-App Library
                </span>
                <span className={`text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Auto-captures preview thumbnail and saves painted model into your library
                </span>
              </div>
            </div>
            {exporting === 'storage' ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-700 dark:text-zinc-300" />
            ) : (
              <Download className={`w-4 h-4 transition-colors ${isLight ? 'text-neutral-400 group-hover:text-neutral-900' : 'text-neutral-500 group-hover:text-neutral-200'}`} />
            )}
          </div>

          {/* Studio Render Snapshot */}
          <div
            onClick={handleCaptureSnapshot}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
              isLight
                ? 'bg-[#f4f0e9]/80 hover:bg-[#ede8e0] border-black/10'
                : 'bg-neutral-950/50 hover:bg-neutral-800/60 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl transition-all ${
                isLight ? 'bg-neutral-900 dark:bg-white/10 text-neutral-900 dark:text-zinc-200 group-hover:bg-neutral-900 dark:bg-white group-hover:text-white' : 'bg-neutral-900 dark:bg-white/20 text-neutral-700 dark:text-zinc-300 group-hover:bg-neutral-900 dark:bg-white group-hover:text-white'
              }`}>
                <Camera className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className={`text-sm font-semibold transition-colors ${
                  isLight ? 'text-neutral-900 group-hover:text-neutral-900 dark:text-zinc-200' : 'text-neutral-100 group-hover:text-neutral-700 dark:text-zinc-300'
                }`}>
                  Studio HD Screenshot
                </span>
                <span className={`text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  High-resolution rendered PNG of current viewport
                </span>
              </div>
            </div>
            {exporting === 'snapshot' ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-700 dark:text-zinc-300" />
            ) : (
              <Download className={`w-4 h-4 transition-colors ${isLight ? 'text-neutral-400 group-hover:text-neutral-900' : 'text-neutral-500 group-hover:text-neutral-200'}`} />
            )}
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-900 dark:bg-white/10 border border-neutral-900 dark:border-white/30 text-xs text-neutral-900 dark:text-white font-medium">
            <Check className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}
      </div>
    </div>
  );
};
