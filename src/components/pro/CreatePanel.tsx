import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Square } from 'lucide-react';
import {
  IcCube as Box,
  IcSphere as Circle,
  IcCylinder as Cylinder,
  IcTorus as Orbit,
  IcCapsule as Disc3,
  IcCone as Cone,
  IcPyramid as Triangle,
  IcDisk as Disc,
  IcModelLibrary as FolderOpen,
  IcImport as Upload,
  IcPalette as Palette,
  IcSparkle as Sparkles,
  IcOrigin as Crosshair,
} from './StudioIcons';
import { StudioEngine } from '../../core/studioEngine';
import { SampleModelFactory } from '../../core/sampleModels';
import { ModelDisplayMode } from '../../types';
import { haptics } from '../../utils/haptics';

interface CreatePanelProps {
  engine: StudioEngine | null;
  activeModelName?: string;
  modelDisplayMode: ModelDisplayMode;
  onSetModelDisplayMode: (mode: ModelDisplayMode) => void;
  onOpenModelLibrary: () => void;
  onOpenImporter: () => void;
  theme?: 'light' | 'dark';
}

interface PrimitiveDef {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  factory: () => any;
}

const PRIMITIVES: PrimitiveDef[] = [
  { id: 'cube', name: 'Cube', icon: Box, factory: SampleModelFactory.createCube },
  { id: 'sphere', name: 'Sphere', icon: Circle, factory: SampleModelFactory.createSphere },
  { id: 'cylinder', name: 'Cylinder', icon: Cylinder, factory: SampleModelFactory.createCylinder },
  { id: 'plane', name: 'Plane', icon: Square, factory: SampleModelFactory.createDrawingPlane },
  { id: 'torus', name: 'Torus', icon: Orbit, factory: SampleModelFactory.createTorus },
  { id: 'capsule', name: 'Capsule', icon: Disc3, factory: SampleModelFactory.createCapsule },
  { id: 'cone', name: 'Cone', icon: Cone, factory: SampleModelFactory.createCone },
  { id: 'pyramid', name: 'Pyramid', icon: Triangle, factory: SampleModelFactory.createPyramid },
];

export const CreatePanel: React.FC<CreatePanelProps> = ({
  engine,
  activeModelName = 'Default Model',
  modelDisplayMode,
  onSetModelDisplayMode,
  onOpenModelLibrary,
  onOpenImporter,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [showFineGeometry, setShowFineGeometry] = useState(false);
  const [modelOpacity, setModelOpacityState] = useState(1.0);
  const [wireframeOpacity, setWireframeOpacityState] = useState(0.0);
  const [spawnNotice, setSpawnNotice] = useState<string | null>(null);

  const handleSpawn = (p: PrimitiveDef) => {
    haptics.trigger('medium');
    if (!engine) return;
    const mesh = p.factory();
    if (mesh) {
      engine.addPrimitiveToScene(mesh, `Primitive ${p.name}`);
      setSpawnNotice(`Added ${p.name}`);
      setTimeout(() => setSpawnNotice(null), 1800);
    }
  };

  const handleOpacityChange = (val: number) => {
    setModelOpacityState(val);
    engine?.setModelOpacity(val);
  };

  const handleWireframeChange = (val: number) => {
    setWireframeOpacityState(val);
    engine?.setModelWireframeOpacity(val);
  };

  const cardClass = isLight
    ? 'p-2.5 rounded-xl bg-neutral-100/50 border border-black/5 space-y-1.5'
    : 'p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5';

  const subHeadingClass = `text-[10px] font-bold uppercase tracking-wider ${
    isLight ? 'text-neutral-500' : 'text-neutral-400'
  }`;

  return (
    <div className="space-y-2 text-xs select-none">
      {/* 1. 3D SHAPES / PRIMITIVES */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className={subHeadingClass}>3D Shapes</div>
          {spawnNotice && (
            <span className="text-[10px] font-semibold text-emerald-500 animate-in fade-in duration-100">
              {spawnNotice}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {PRIMITIVES.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSpawn(p)}
                className={`h-10 min-h-[38px] p-1 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                  isLight
                    ? 'bg-white border-black/10 hover:bg-neutral-200/50 text-neutral-800'
                    : 'bg-black/30 border-white/10 hover:bg-white/10 text-neutral-200'
                }`}
                title={`Spawn ${p.name}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[9.5px] font-medium leading-none">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. MODEL LIBRARY & IMPORT */}
      <div className={cardClass}>
        <div className={subHeadingClass}>3D Models</div>

        <div className="space-y-1.5">
          {/* Open Model Library Button */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onOpenModelLibrary();
            }}
            className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-between font-medium transition-all ${
              isLight
                ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse Model Library</span>
            </div>
            <span className="text-[10px] opacity-75 truncate max-w-[100px]">{activeModelName}</span>
          </button>

          {/* Import 3D File Button */}
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onOpenImporter();
            }}
            className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-between font-medium transition-all ${
              isLight
                ? 'bg-white border-black/10 hover:bg-neutral-200/50 text-neutral-800'
                : 'bg-black/30 border-white/10 hover:bg-white/10 text-neutral-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Import 3D Model File</span>
            </div>
            <span className="text-[10px] opacity-60 font-mono">GLB, OBJ, STL</span>
          </button>
        </div>
      </div>

      {/* 3. SHOW AS: Texture vs Clay */}
      <div className={cardClass}>
        <div className={subHeadingClass}>Show As</div>

        {/* Display Mode Toggles */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onSetModelDisplayMode('texture');
              engine?.setModelDisplayMode('texture');
            }}
            className={`h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-all ${
              modelDisplayMode === 'texture'
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs'
                  : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Full Texture</span>
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.trigger('light');
              onSetModelDisplayMode('clay');
              engine?.setModelDisplayMode('clay');
            }}
            className={`h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-all ${
              modelDisplayMode === 'clay'
                ? isLight
                  ? 'bg-neutral-900 border-neutral-900 text-white font-bold shadow-xs'
                  : 'bg-white border-white text-neutral-950 font-bold shadow-xs'
                : isLight
                ? 'bg-white border-black/10 text-neutral-700 hover:bg-neutral-200/50'
                : 'bg-black/30 border-white/10 text-neutral-300 hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>White Clay</span>
          </button>
        </div>
      </div>

      {/* 4. FINE GEOMETRY & DISPLAY (Expandable Accordion) */}
      <div className={cardClass}>
        <button
          type="button"
          onClick={() => {
            haptics.trigger('light');
            setShowFineGeometry((prev) => !prev);
          }}
          className="w-full flex items-center justify-between min-h-[28px] py-0.5 text-left"
        >
          <div className={subHeadingClass}>Fine Geometry & Display</div>
          <div className="flex items-center gap-1.5 opacity-70">
            <span className="text-[10px] font-mono">
              {showFineGeometry ? 'Hide' : 'Opacity / Wireframe'}
            </span>
            {showFineGeometry ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </button>

        {showFineGeometry && (
          <div className="space-y-2 pt-1 border-t border-black/5 dark:border-white/5">
            {/* Model Opacity Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-medium text-current">Model Opacity</span>
                <span className="font-mono text-[10px] font-bold">
                  {Math.round(modelOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.02"
                value={modelOpacity}
                onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded cursor-pointer ${
                  isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
                }`}
              />
            </div>

            {/* Wireframe Overlay Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-medium text-current">Wireframe Overlay</span>
                <span className="font-mono text-[10px] font-bold">
                  {Math.round(wireframeOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.02"
                value={wireframeOpacity}
                onChange={(e) => handleWireframeChange(parseFloat(e.target.value))}
                className={`w-full h-1.5 rounded cursor-pointer ${
                  isLight ? 'accent-neutral-900 bg-neutral-200' : 'accent-white bg-neutral-800'
                }`}
              />
            </div>

            {/* Center Model to Origin */}
            <button
              type="button"
              onClick={() => {
                haptics.trigger('light');
                engine?.centerModelToOrigin();
              }}
              className={`w-full h-8 min-h-[32px] px-2.5 py-1 rounded-lg border flex items-center justify-center gap-1.5 font-medium text-xs transition-all active:scale-98 ${
                isLight
                  ? 'bg-white border-black/10 hover:bg-neutral-200/50 text-neutral-800'
                  : 'bg-black/30 border-white/10 hover:bg-white/10 text-neutral-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Center Model to Origin</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
