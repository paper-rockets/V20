import React, { useState, useRef } from 'react';
import {
  CollisionGuideMeshConfig,
  ScaffoldProxyType,
  ScaffoldRenderMode,
  PrimitiveTopologyConfig,
  NumpadTarget,
} from '../types';
import { StudioEngine } from '../core/studioEngine';
import { PrimitiveGenerator } from '../core/primitiveGenerator';
import { modelLoader } from '../core/modelLoader';
import { getThemeClasses } from '../utils/themeStyles';
import {
  Box,
  Circle,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Plus,
  Sliders,
  Trash2,
  Upload,
  User,
  X,
  Car,
  Maximize2,
  Sparkles,
  Shield,
  Activity,
  Check,
  Cuboid as Cube,
  ShieldAlert,
} from 'lucide-react';

interface ScaffoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: StudioEngine | null;
  onOpenNumpad: (target: NumpadTarget) => void;
  theme?: 'light' | 'dark';
}

const PROXIES: Array<{
  type: ScaffoldProxyType;
  label: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    type: 'mannequin_torso',
    label: 'Mannequin Torso',
    desc: 'Anatomical ribcage, pelvis, spine & shoulder joints',
    icon: User,
  },
  {
    type: 'head_sphere',
    label: 'Loomis Head Cage',
    desc: 'Cranial sphere, eye ring & jaw box guides',
    icon: Circle,
  },
  {
    type: 'car_chassis',
    label: 'Vehicle Chassis',
    desc: 'Aerodynamic cabin, hood & 4 wheel arch colliders',
    icon: Car,
  },
  {
    type: 'cylinder_limb',
    label: 'Limb Armature',
    desc: 'Shoulder/elbow ball joints & tapered bone cylinders',
    icon: Activity,
  },
  {
    type: 'dome_column',
    label: 'Dome & Column',
    desc: 'Pedestal, fluted shaft, capital & hemisphere dome',
    icon: Cube,
  },
  {
    type: 'capsule',
    label: 'Organic Capsule',
    desc: 'Smooth curved capsule scaffold for organic sculpts',
    icon: Sparkles,
  },
];

export const ScaffoldingModal: React.FC<ScaffoldingModalProps> = ({
  isOpen,
  onClose,
  engine,
  onOpenNumpad,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  const t = getThemeClasses(theme);
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'proxies' | 'primitives' | 'active_scaffolds'>('proxies');
  const [selectedScaffoldId, setSelectedScaffoldId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Primitive Config State
  const [primitiveConfig, setPrimitiveConfig] = useState<PrimitiveTopologyConfig>({
    type: 'sphere',
    radius: 0.8,
    height: 1.2,
    radialSegments: 24,
    heightSegments: 16,
    tubeRadius: 0.25,
    tubularSegments: 24,
    width: 1.2,
    depth: 1.2,
    wireframeOverlay: true,
  });

  const [scaffolds, setScaffolds] = useState<CollisionGuideMeshConfig[]>(
    engine?.getScaffolds() || []
  );

  // Calculate live stats for primitive
  const previewStats = React.useMemo(() => {
    const geo = PrimitiveGenerator.createPrimitiveGeometry(primitiveConfig);
    const stats = PrimitiveGenerator.calculateStats(geo);
    geo.dispose();
    return stats;
  }, [primitiveConfig]);

  const handleSpawnProxy = (type: ScaffoldProxyType) => {
    if (!engine) return;
    const config = engine.createProxyScaffold(type);
    setSelectedScaffoldId(config.id);
    setScaffolds(engine.getScaffolds());
    setActiveTab('active_scaffolds');
  };

  const handleSpawnPrimitive = (asScaffold: boolean) => {
    if (!engine) return;
    const group = PrimitiveGenerator.createPrimitiveMesh(
      primitiveConfig,
      asScaffold ? 0x38bdf8 : 0x64748b,
      asScaffold
    );

    if (asScaffold) {
      const config = engine.loadCollisionMeshFromObject(
        group,
        `Parametric ${primitiveConfig.type.toUpperCase()} Scaffold`
      );
      setSelectedScaffoldId(config.id);
      setScaffolds(engine.getScaffolds());
      setActiveTab('active_scaffolds');
    } else {
      // Add as standard scene model
      engine.getScene().add(group);
    }
  };

  const handleImportCollisionMesh = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !engine) return;

    const file = files[0];
    try {
      const result = await modelLoader.loadFromFiles([file]);
      if (result && result.scene) {
        const config = engine.loadCollisionMeshFromObject(
          result.scene,
          `Collision Guide: ${file.name}`
        );
        setSelectedScaffoldId(config.id);
        setScaffolds(engine.getScaffolds());
        setActiveTab('active_scaffolds');
      }
    } catch (err) {
      console.error('Failed to import collision guide:', err);
    }
  };

  const handleRemoveScaffold = (id: string) => {
    if (!engine) return;
    engine.removeScaffold(id);
    if (selectedScaffoldId === id) setSelectedScaffoldId(null);
    setScaffolds(engine.getScaffolds());
  };

  const handleUpdateScaffold = (id: string, updates: Partial<CollisionGuideMeshConfig>) => {
    if (!engine) return;
    engine.updateScaffold(id, updates);
    setScaffolds(engine.getScaffolds());
  };

  const selectedScaffold = scaffolds.find((s) => s.id === selectedScaffoldId);

  return (
    <div
      id="mody-scaffolding-modal"
      className={`pr-surface paperrocket-context-panel fixed left-[76px] sm:left-[88px] top-1/2 -translate-y-1/2 z-50 w-[300px] max-w-[calc(100vw-6rem)] max-h-[72vh] select-none shadow-2xl rounded-2xl border p-4 space-y-3 font-sans animate-in fade-in slide-in-from-left-2 duration-150 overflow-y-auto ${isLight ? 'bg-white border-black/10 shadow-black/10' : 'bg-[#18191d] border-neutral-800 shadow-black/50'} ${t.shell}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${t.textPrimary}`}>
            3D Armature & Form Guides
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
        Import or generate 3D armatures as reference guides. Your strokes snap directly across their surfaces.
      </p>

      {/* Tabs */}
      <div className={`grid grid-cols-3 gap-1 p-0.5 rounded-xl border text-xs font-semibold ${
        isLight ? 'bg-neutral-100 border-black/10' : 'bg-neutral-900 border-neutral-800'
      }`}>
        <button
          onClick={() => setActiveTab('proxies')}
          className={`py-1.5 px-2 rounded-lg transition-all ${
            activeTab === 'proxies'
              ? isLight
                ? 'bg-white text-neutral-950 font-bold shadow-xs border border-black/5'
                : 'bg-neutral-800 text-white font-bold shadow'
              : isLight
              ? 'text-neutral-600 hover:text-neutral-950'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Armatures
        </button>
        <button
          onClick={() => setActiveTab('primitives')}
          className={`py-1.5 px-2 rounded-lg transition-all ${
            activeTab === 'primitives'
              ? isLight
                ? 'bg-white text-neutral-950 font-bold shadow-xs border border-black/5'
                : 'bg-neutral-800 text-white font-bold shadow'
              : isLight
              ? 'text-neutral-600 hover:text-neutral-950'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Primitives
        </button>
        <button
          onClick={() => setActiveTab('active_scaffolds')}
          className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
            activeTab === 'active_scaffolds'
              ? isLight
                ? 'bg-white text-neutral-950 font-bold shadow-xs border border-black/5'
                : 'bg-neutral-800 text-white font-bold shadow'
              : isLight
              ? 'text-neutral-600 hover:text-neutral-950'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <span>Active</span>
          <span className={`px-1 py-0.2 rounded-full text-[9px] font-mono ${
            isLight ? 'bg-neutral-200 text-neutral-800' : 'bg-neutral-800 text-neutral-300'
          }`}>
            {scaffolds.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PROCEDURAL PROXY ARMATURES */}
      {activeTab === 'proxies' && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            {PROXIES.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.type}
                  onClick={() => handleSpawnProxy(p.type)}
                  className={`p-2.5 rounded-xl border text-left space-y-1 group transition-all ${
                    isLight
                      ? 'bg-neutral-50/80 border-black/10 hover:border-neutral-900 hover:bg-white shadow-xs'
                      : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg group-hover:scale-110 transition-transform ${
                      isLight ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-zinc-300'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-xs font-bold ${t.textPrimary}`}>{p.label}</span>
                  </div>
                  <p className={`text-[10px] leading-tight ${t.textSecondary}`}>{p.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Import Custom Non-Editable Collision Mesh */}
          <div className={`pt-2 border-t ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-2 px-3 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                isLight
                  ? 'bg-neutral-50 hover:bg-neutral-100 border-black/15 text-neutral-700'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
              }`}
            >
              <Upload className={`w-4 h-4 ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`} />
              <span>Import OBJ / GLTF as Collision Guide</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".obj,.gltf,.glb,.fbx"
              onChange={handleImportCollisionMesh}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* TAB 2: PROCEDURAL PRIMITIVE TOPOLOGY SLIDERS */}
      {activeTab === 'primitives' && (
        <div className="space-y-3 pt-1">
          {/* Primitive Shape Selector */}
          <div className="space-y-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textSecondary}`}>
              Primitive Geometry
            </span>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  'sphere',
                  'cylinder',
                  'torus',
                  'cone',
                  'capsule',
                  'box',
                  'plane',
                ] as const
              ).map((type) => (
                <button
                  key={type}
                  onClick={() => setPrimitiveConfig((prev) => ({ ...prev, type }))}
                  className={`py-1 px-1 rounded-xl text-[11px] font-semibold uppercase border transition-all ${
                    primitiveConfig.type === type
                      ? isLight
                        ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                        : 'bg-white border-white text-neutral-900 shadow-md font-bold'
                      : isLight
                      ? 'bg-neutral-100 border-black/10 text-neutral-600 hover:bg-neutral-200'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Topological Sliders */}
          <div className="space-y-2 pt-1">
            {/* Radial Segments */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${t.textPrimary}`}>Radial Segments (Circumference)</span>
                <span className={`font-mono font-bold ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                  {primitiveConfig.radialSegments}
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="64"
                step="1"
                value={primitiveConfig.radialSegments}
                onChange={(e) =>
                  setPrimitiveConfig((prev) => ({
                    ...prev,
                    radialSegments: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full h-1.5 rounded-lg cursor-pointer accent-neutral-900 dark:accent-neutral-100 bg-neutral-200 dark:bg-neutral-800"
              />
            </div>

            {/* Height / Tubular Segments */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${t.textPrimary}`}>
                  {primitiveConfig.type === 'torus' ? 'Tubular Segments' : 'Height Segments'}
                </span>
                <span className={`font-mono font-bold ${isLight ? 'text-neutral-700' : 'text-zinc-300'}`}>
                  {primitiveConfig.heightSegments}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="64"
                step="1"
                value={primitiveConfig.heightSegments}
                onChange={(e) =>
                  setPrimitiveConfig((prev) => ({
                    ...prev,
                    heightSegments: parseInt(e.target.value, 10),
                    tubularSegments: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full h-1.5 rounded-lg cursor-pointer accent-neutral-900 dark:accent-neutral-100 bg-neutral-200 dark:bg-neutral-800"
              />
            </div>

            {/* Radius / Size Slider */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${t.textPrimary}`}>Radius / Dimensions</span>
                <span className={`font-mono font-bold ${t.textPrimary}`}>
                  {(primitiveConfig.radius * 100).toFixed(0)} cm
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.05"
                value={primitiveConfig.radius}
                onChange={(e) =>
                  setPrimitiveConfig((prev) => ({
                    ...prev,
                    radius: parseFloat(e.target.value),
                  }))
                }
                className="w-full h-1.5 rounded-lg cursor-pointer accent-neutral-900 dark:accent-neutral-100 bg-neutral-200 dark:bg-neutral-800"
              />
            </div>

            {/* Topology Density Telemetry Box */}
            <div className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-mono ${t.innerCard}`}>
              <div className={t.textSecondary}>
                Vertices: <span className={`font-bold ${isLight ? 'text-neutral-900' : 'text-white'}`}>{previewStats.vertices}</span>
              </div>
              <div className={t.textSecondary}>
                Polygons: <span className={`font-bold ${isLight ? 'text-neutral-700' : 'text-zinc-300'}`}>{previewStats.triangles} tris</span>
              </div>
            </div>
          </div>

          {/* Spawn Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleSpawnPrimitive(true)}
              className="py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all active:scale-98"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Add as Guide</span>
            </button>
            <button
              onClick={() => handleSpawnPrimitive(false)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${t.btnSecondary}`}
            >
              <Cube className={`w-3.5 h-3.5 ${t.textSecondary}`} />
              <span>Spawn as Model</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE SCAFFOLDING MESHES */}
      {activeTab === 'active_scaffolds' && (
        <div className="space-y-3 pt-1">
          {scaffolds.length === 0 ? (
            <div className={`text-center py-6 border border-dashed rounded-xl space-y-1 ${
              isLight ? 'border-black/10' : 'border-neutral-800'
            }`}>
              <ShieldAlert className={`w-6 h-6 mx-auto ${isLight ? 'text-neutral-400' : 'text-neutral-600'}`} />
              <p className={`text-xs font-medium ${t.textSecondary}`}>No Active Guides</p>
              <p className={`text-[10px] ${t.textMuted}`}>
                Spawn an anatomical armature or import a 3D guide
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                {scaffolds.map((scaffold) => {
                  const isSelected = selectedScaffoldId === scaffold.id;
                  return (
                    <div
                      key={scaffold.id}
                      onClick={() => setSelectedScaffoldId(scaffold.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? isLight
                            ? 'bg-neutral-100 dark:bg-white/10 border-neutral-400 dark:border-neutral-600 ring-1 ring-neutral-400/30'
                            : 'bg-neutral-800 border-neutral-700 ring-1 ring-neutral-600/30'
                          : isLight
                          ? 'bg-neutral-50 border-black/10 hover:border-black/20'
                          : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <Shield className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`} />
                          <span className={`text-xs font-semibold truncate ${t.textPrimary}`}>
                            {scaffold.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateScaffold(scaffold.id, {
                                visible: !scaffold.visible,
                              });
                            }}
                            className={`p-1 rounded ${t.btnGhost}`}
                          >
                            {scaffold.visible ? (
                              <Eye className={`w-3.5 h-3.5 ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`} />
                            ) : (
                              <EyeOff className={`w-3.5 h-3.5 ${t.textMuted}`} />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveScaffold(scaffold.id);
                            }}
                            className={`p-1 rounded transition-colors ${t.btnGhost}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Scaffold Controls */}
              {selectedScaffold && (
                <div className={`p-3 rounded-xl border space-y-2.5 animate-in fade-in duration-100 ${t.innerCard}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-neutral-900' : 'text-zinc-300'}`}>
                    Render Mode & Shader Pass
                  </div>

                  {/* Render Mode Grid */}
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'ghost', label: 'Ghost X-Ray' },
                        { id: 'wireframe', label: 'Wireframe' },
                        { id: 'solid', label: 'Matte Solid' },
                        { id: 'invisible', label: 'Collision Only' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() =>
                          handleUpdateScaffold(selectedScaffold.id, {
                            renderMode: mode.id,
                          })
                        }
                        className={`py-1 px-1 rounded-lg text-[10px] font-semibold border transition-all ${
                          selectedScaffold.renderMode === mode.id
                            ? isLight
                              ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                              : 'bg-white border-white text-neutral-900 shadow font-bold'
                            : isLight
                            ? 'bg-white border-black/10 text-neutral-600 hover:bg-neutral-100'
                            : 'bg-neutral-850 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {/* Opacity Slider */}
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-medium ${t.textSecondary}`}>Hologram Opacity</span>
                      <span className={`font-mono font-bold ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                        {Math.round(selectedScaffold.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1.0"
                      step="0.05"
                      value={selectedScaffold.opacity}
                      onChange={(e) =>
                        handleUpdateScaffold(selectedScaffold.id, {
                          opacity: parseFloat(e.target.value),
                        })
                      }
                      className="w-full h-1.5 rounded-lg cursor-pointer accent-neutral-900 dark:accent-neutral-100 bg-neutral-200 dark:bg-neutral-800"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
