import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Layer, LayerBlendMode } from '../types';
import {
  Layers,
  Plus,
  FolderPlus,
  Folder,
  FolderOpen,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  X,
  RotateCcw,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Sun,
  Moon,
  Zap,
  Minus,
  Sliders,
  Layers2,
  Check,
  CornerDownRight,
  FolderTree,
  Tag,
} from 'lucide-react';

export interface LayerPanelProps {
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  activeLayerId: string;
  setActiveLayerId: (id: string) => void;
  onClose?: () => void;
  onClearLayerStrokes: (layerId: string) => void;
  onMergeLayerDown?: (layerId: string) => void;
  inline?: boolean;
  theme?: 'light' | 'dark';
}

export const BLEND_MODES: Array<{
  id: LayerBlendMode;
  label: string;
  desc: string;
  category: 'Normal';
  icon: React.FC<{ className?: string }>;
  colorClass: string;
}> = [
  {
    id: 'normal',
    label: 'Normal',
    desc: 'Standard Alpha Over composite',
    category: 'Normal',
    icon: Sliders,
    colorClass: 'text-neutral-300',
  },
];

const COLOR_TAGS = [
  { name: 'none', color: 'transparent' },
  { name: 'red', color: '#ef4444' },
  { name: 'orange', color: '#f97316' },
  { name: 'amber', color: '#f59e0b' },
  { name: 'emerald', color: '#10b981' },
  { name: 'cyan', color: '#06b6d4' },
  { name: 'indigo', color: '#6366f1' },
  { name: 'pink', color: '#ec4899' },
];

export const LayerPanelComponent: React.FC<LayerPanelProps> = ({
  layers,
  setLayers,
  activeLayerId,
  setActiveLayerId,
  onClose,
  onClearLayerStrokes,
  onMergeLayerDown,
  inline = false,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [openTagMenuId, setOpenTagMenuId] = useState<string | null>(null);
  const [tagMenuPosition, setTagMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameInputValue, setNameInputValue] = useState<string>('');

  // Build tree structure
  const layerMap = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);

  // Compute effective hierarchy state (inherited visibility, opacity, lock)
  const getInheritedState = (layer: Layer) => {
    let curr: Layer | undefined = layer;
    let effVisible = layer.visible;
    let effOpacity = layer.opacity;
    let effLocked = layer.locked;
    const visited = new Set<string>();

    while (curr && curr.parentId && !visited.has(curr.parentId)) {
      visited.add(curr.parentId);
      const parent = layerMap.get(curr.parentId);
      if (!parent) break;
      effVisible = effVisible && parent.visible;
      effOpacity = effOpacity * parent.opacity;
      effLocked = effLocked || parent.locked;
      curr = parent;
    }

    return { effVisible, effOpacity, effLocked };
  };

  // Get depth of a node in the tree
  const getNodeDepth = (layer: Layer): number => {
    let depth = 0;
    let curr = layer;
    const visited = new Set<string>();
    while (curr && curr.parentId && !visited.has(curr.parentId)) {
      visited.add(curr.parentId);
      const parent = layerMap.get(curr.parentId);
      if (!parent) break;
      depth++;
      curr = parent;
    }
    return depth;
  };

  // Check if any ancestor is collapsed
  const isAncestorCollapsed = (layer: Layer): boolean => {
    let curr = layer;
    const visited = new Set<string>();
    while (curr && curr.parentId && !visited.has(curr.parentId)) {
      visited.add(curr.parentId);
      const parent = layerMap.get(curr.parentId);
      if (!parent) break;
      if (parent.collapsed) return true;
      curr = parent;
    }
    return false;
  };

  // Visible items in hierarchy order
  const visibleHierarchyList = useMemo(() => {
    return layers.filter((l) => !isAncestorCollapsed(l));
  }, [layers]);

  const handleAddLayer = (parentId: string | null = null) => {
    const newId = 'layer_' + Date.now().toString(36);
    const newLayer: Layer = {
      id: newId,
      name: `Layer ${layers.length + 1}`,
      type: 'layer',
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'normal',
      strokeIds: [],
      parentId: parentId,
    };

    setLayers((prev) => [newLayer, ...prev]);
    setActiveLayerId(newId);
  };

  const handleAddGroup = (parentId: string | null = null) => {
    const newId = 'group_' + Date.now().toString(36);
    const newGroup: Layer = {
      id: newId,
      name: `Group Folder ${layers.filter((l) => l.type === 'group').length + 1}`,
      type: 'group',
      visible: true,
      locked: false,
      opacity: 1.0,
      blendMode: 'normal',
      strokeIds: [],
      parentId: parentId,
      collapsed: false,
      children: [],
    };

    setLayers((prev) => [newGroup, ...prev]);
    setActiveLayerId(newId);
  };

  const handleToggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, collapsed: !l.collapsed } : l))
    );
  };

  const handleDuplicate = (item: Layer, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = (item.type === 'group' ? 'group_' : 'layer_') + Date.now().toString(36);
    const duplicate: Layer = {
      id: newId,
      name: `${item.name} (Copy)`,
      type: item.type || 'layer',
      visible: item.visible,
      locked: false,
      opacity: item.opacity,
      blendMode: item.blendMode || 'normal',
      strokeIds: [...item.strokeIds],
      parentId: item.parentId,
      collapsed: item.collapsed,
      colorTag: item.colorTag,
    };
    const targetIdx = layers.findIndex((l) => l.id === item.id);
    const updated = [...layers];
    updated.splice(targetIdx, 0, duplicate);
    setLayers(updated);
    setActiveLayerId(newId);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (layers.length <= 1) return;

    // Collect all descendant IDs if deleting a group
    const toDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      layers.forEach((l) => {
        if (l.parentId && toDelete.has(l.parentId) && !toDelete.has(l.id)) {
          toDelete.add(l.id);
          changed = true;
        }
      });
    }

    toDelete.forEach((delId) => onClearLayerStrokes(delId));
    setLayers((prev) => prev.filter((l) => !toDelete.has(l.id)));

    if (toDelete.has(activeLayerId)) {
      const remaining = layers.filter((l) => !toDelete.has(l.id));
      if (remaining.length > 0) {
        setActiveLayerId(remaining[0].id);
      }
    }
  };

  const handleToggleVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const handleToggleLock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
    );
  };

  const handleSetOpacity = (id: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    );
  };

  const handleSetColorTag = (id: string, colorTag: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, colorTag: colorTag === 'none' ? undefined : colorTag } : l))
    );
    setOpenTagMenuId(null);
  };

  const handleMoveUp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === 0) return;
    setLayers((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
      return updated;
    });
  };

  const handleMoveDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === layers.length - 1) return;
    setLayers((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
      return updated;
    });
  };

  // Indent: nest item into the previous group in the list
  const handleIndent = (layer: Layer, e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = layers.findIndex((l) => l.id === layer.id);
    if (idx <= 0) return;
    // Find preceding group
    for (let i = idx - 1; i >= 0; i--) {
      if (layers[i].type === 'group' && layers[i].id !== layer.id) {
        setLayers((prev) =>
          prev.map((l) => (l.id === layer.id ? { ...l, parentId: layers[i].id } : l))
        );
        return;
      }
    }
  };

  // Outdent: move item out to parent's parent or root
  const handleOutdent = (layer: Layer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!layer.parentId) return;
    const parent = layerMap.get(layer.parentId);
    const newParentId = parent ? parent.parentId || null : null;
    setLayers((prev) =>
      prev.map((l) => (l.id === layer.id ? { ...l, parentId: newParentId } : l))
    );
  };

  const handleStartRename = (layer: Layer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNameId(layer.id);
    setNameInputValue(layer.name);
  };

  const handleSaveRename = () => {
    if (!editingNameId) return;
    const trimmed = nameInputValue.trim();
    if (trimmed) {
      setLayers((prev) =>
        prev.map((l) => (l.id === editingNameId ? { ...l, name: trimmed } : l))
      );
    }
    setEditingNameId(null);
  };

  return (
    <div
      id={inline ? undefined : "mody-layer-studio-panel"}
      className={
        inline
          ? `pr-surface w-full select-none space-y-2 font-sans ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`
          : `pr-surface fixed z-50 select-none shadow-2xl border font-sans animate-in fade-in duration-150 flex flex-col overflow-hidden
             /* Mobile: bottom sheet anchored at bottom */
             inset-x-2 bottom-2 max-h-[74dvh] rounded-2xl p-3.5 space-y-3 slide-in-from-bottom-3
             /* Desktop: top-right floating */
             sm:inset-x-auto sm:bottom-auto sm:top-16 sm:right-6 sm:w-96 sm:max-w-[400px] sm:max-h-[80vh] sm:rounded-2xl sm:p-4 sm:space-y-3 sm:slide-in-from-right-2 ${
              isLight
                ? 'bg-white border-black/10 text-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
                : 'bg-[#18191d] border-[#2c2e36] text-neutral-200 shadow-2xl shadow-black/50'
            }`
      }
    >
      {/* Header (floating only; ProPanel already provides its own header) */}
      {!inline && (
        <div className={`flex items-center justify-between pb-2 border-b shrink-0 ${isLight ? 'border-black/10' : 'border-neutral-800'}`}>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-neutral-900' : 'text-neutral-200'}`}>
              Drawings & Layers Studio
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isLight ? 'bg-neutral-200 text-neutral-700' : 'bg-neutral-800 text-neutral-400'}`}>
              {layers.length} layers
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-colors ${isLight ? 'hover:bg-neutral-200 text-neutral-500' : 'hover:bg-neutral-800 text-neutral-400 hover:text-white'}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Action Buttons: Add Layer, Add Group */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => handleAddLayer(null)}
          className="h-8 min-h-[32px] py-1 px-2.5 rounded-lg bg-neutral-900 dark:bg-white hover:bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-all active:scale-98"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Layer</span>
        </button>
        <button
          type="button"
          onClick={() => handleAddGroup(null)}
          className={`h-8 min-h-[32px] py-1 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-all active:scale-98 border ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-neutral-800'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
          }`}
        >
          <FolderPlus className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
          <span>New Group</span>
        </button>
      </div>

      {/* Tree List */}
      <div className={`${inline ? 'space-y-1.5 pr-1 studio-scroll' : 'max-h-[380px] overflow-y-auto space-y-1.5 pr-1 studio-scroll'}`}>
        {visibleHierarchyList.map((item, visibleIdx) => {
          const rawIdx = layers.findIndex((l) => l.id === item.id);
          const isActive = item.id === activeLayerId;
          const isGroup = item.type === 'group';
          const depth = getNodeDepth(item);
          const { effVisible, effLocked } = getInheritedState(item);

          return (
            <div
              key={item.id}
              onClick={() => setActiveLayerId(item.id)}
              style={{ marginLeft: `${depth * 14}px` }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? isGroup
                    ? isLight
                      ? 'bg-neutral-100 dark:bg-white/5/90 border-neutral-400 dark:border-neutral-600/80 shadow-xs ring-1 ring-neutral-400 dark:ring-neutral-500/30'
                      : 'bg-black/30 dark:bg-white/5/40 border-neutral-900 dark:border-white/60 shadow-md ring-1 ring-neutral-900 dark:ring-white/30'
                    : isLight
                    ? 'bg-neutral-100 dark:bg-white/5/90 border-neutral-400 dark:border-neutral-600/80 shadow-xs ring-1 ring-neutral-400 dark:ring-neutral-500/30'
                    : 'bg-black/30 dark:bg-white/5/40 border-neutral-900 dark:border-white/60 shadow-md ring-1 ring-neutral-900 dark:ring-white/30'
                  : isLight
                  ? 'bg-neutral-50/90 border-black/5 hover:bg-neutral-100 hover:border-black/10'
                  : 'bg-neutral-900/90 border-neutral-800/90 hover:bg-neutral-850 hover:border-neutral-700'
              }`}
            >
              {/* Item Header Row */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {/* Expand / Collapse Chevron for Groups */}
                  {isGroup ? (
                    <button
                      onClick={(e) => handleToggleCollapse(item.id, e)}
                      className={`p-0.5 rounded transition-colors ${isLight ? 'text-neutral-500 hover:text-neutral-900' : 'text-neutral-400 hover:text-white'}`}
                    >
                      {item.collapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ) : depth > 0 ? (
                    <CornerDownRight className="w-3 h-3 text-neutral-400 shrink-0" />
                  ) : null}

                  {/* Icon */}
                  {isGroup ? (
                    item.collapsed ? (
                      <Folder className="w-4 h-4 text-neutral-700 dark:text-zinc-300 shrink-0" />
                    ) : (
                      <FolderOpen className="w-4 h-4 text-neutral-700 dark:text-zinc-300 shrink-0" />
                    )
                  ) : (
                    <Layers className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300 shrink-0" />
                  )}

                  {/* Color Tag Indicator */}
                  {item.colorTag && (
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.colorTag }}
                    />
                  )}

                  {/* Title / Rename */}
                  {editingNameId === item.id ? (
                    <input
                      type="text"
                      value={nameInputValue}
                      autoFocus
                      onChange={(e) => setNameInputValue(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') setEditingNameId(null);
                      }}
                      className={`text-xs border rounded px-1.5 py-0.5 font-medium w-full focus:outline-none ${
                        isLight
                          ? 'bg-white border-neutral-900 dark:border-white text-neutral-900'
                          : 'bg-neutral-950 border-neutral-900 dark:border-white text-white'
                      }`}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => handleStartRename(item, e)}
                      className={`text-xs font-semibold truncate ${
                        isActive
                          ? isGroup
                            ? isLight ? 'text-neutral-900 dark:text-white' : 'text-neutral-800 dark:text-zinc-200'
                            : isLight ? 'text-neutral-900 dark:text-white' : 'text-neutral-800 dark:text-zinc-200'
                          : isLight ? 'text-neutral-800' : 'text-neutral-200'
                      }`}
                      title="Double-click to rename"
                    >
                      {item.name}
                    </span>
                  )}
                </div>

                {/* Primary Quick Actions: Visibility & Lock (compact, leaves room for title) */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Visibility Toggle */}
                  <button
                    onClick={(e) => handleToggleVisibility(item.id, e)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isLight ? 'hover:bg-neutral-200' : 'hover:bg-neutral-800'
                    } ${
                      item.visible && effVisible
                        ? 'text-neutral-700 dark:text-zinc-300'
                        : isLight ? 'text-neutral-400 opacity-60' : 'text-neutral-500 opacity-50'
                    }`}
                    title="Toggle Visibility"
                  >
                    {item.visible && effVisible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Lock Toggle */}
                  <button
                    onClick={(e) => handleToggleLock(item.id, e)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isLight ? 'hover:bg-neutral-200' : 'hover:bg-neutral-800'
                    } ${
                      item.locked || effLocked ? 'text-neutral-700 dark:text-zinc-300' : isLight ? 'text-neutral-400' : 'text-neutral-400'
                    }`}
                    title="Toggle Lock"
                  >
                    {item.locked || effLocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Secondary actions & Controls (when layer is selected) */}
              {isActive && (
                <div className={`mt-2 pt-2 border-t space-y-2 animate-in fade-in duration-100 ${isLight ? 'border-black/10' : 'border-neutral-800/80'}`}>
                  {/* Action Strip: Indent, Outdent, Tag, Duplicate, Delete */}
                  <div className="flex items-center justify-between gap-1 pb-1">
                    <div className="flex items-center gap-1">
                      {depth > 0 && (
                        <button
                          onClick={(e) => handleOutdent(item, e)}
                          title="Outdent (Move out of group)"
                          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                            isLight ? 'border-black/10 hover:bg-neutral-200 text-neutral-700' : 'border-white/10 hover:bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          <ArrowUp className="w-3 h-3 -rotate-45" />
                        </button>
                      )}
                      {rawIdx > 0 && (
                        <button
                          onClick={(e) => handleIndent(item, e)}
                          title="Indent (Move into preceding group)"
                          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                            isLight ? 'border-black/10 hover:bg-neutral-200 text-neutral-700' : 'border-white/10 hover:bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          <ArrowDown className="w-3 h-3 -rotate-45" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openTagMenuId === item.id) {
                            setOpenTagMenuId(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTagMenuPosition({
                              top: rect.bottom + 4,
                              left: Math.max(8, Math.min(window.innerWidth - 180, rect.right - 160)),
                            });
                            setOpenTagMenuId(item.id);
                          }
                        }}
                        className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                          isLight ? 'border-black/10 hover:bg-neutral-200 text-neutral-700' : 'border-white/10 hover:bg-neutral-800 text-neutral-300'
                        }`}
                        title="Color Tag"
                      >
                        <Tag className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleDuplicate(item, e)}
                        className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                          isLight ? 'border-black/10 hover:bg-neutral-200 text-neutral-700' : 'border-white/10 hover:bg-neutral-800 text-neutral-300'
                        }`}
                        title="Duplicate"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {layers.length > 1 && (
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                            isLight ? 'border-red-200 hover:bg-red-50 text-red-600' : 'border-red-900/40 hover:bg-red-950/40 text-red-400'
                          }`}
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Opacity Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={isLight ? 'text-neutral-500' : 'text-neutral-400'}>Opacity</span>
                      <span className={`font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>
                        {Math.round(item.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.01"
                      value={item.opacity}
                      onChange={(e) => handleSetOpacity(item.id, parseFloat(e.target.value))}
                      className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-white ${isLight ? 'bg-neutral-200' : 'bg-neutral-800'}`}
                    />
                  </div>

                  {/* If group, button to add layer inside this group */}
                  {isGroup && (
                    <div className="pt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddLayer(item.id);
                        }}
                        className={`w-full py-1 px-2 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                          isLight
                            ? 'bg-neutral-100 dark:bg-white/10 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-200'
                            : 'bg-neutral-900 dark:bg-white/30 border-neutral-900 dark:border-white/40 text-neutral-800 dark:text-zinc-300 hover:bg-neutral-900 dark:bg-white/50'
                        }`}
                        title="Add child layer inside this group"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Layer Inside Group</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Portalled Menus to avoid clipping inside overflow-y-auto */}
      {openTagMenuId && tagMenuPosition && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setOpenTagMenuId(null)}
          />
          <div
            style={{ top: tagMenuPosition.top, left: tagMenuPosition.left }}
            className={`fixed p-1.5 rounded-xl shadow-2xl z-[9999] flex gap-1.5 border animate-in fade-in zoom-in-95 duration-100 ${
              isLight ? 'bg-white border-black/10 shadow-lg' : 'bg-neutral-950 border-neutral-700 shadow-2xl'
            }`}
          >
            {COLOR_TAGS.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => {
                  handleSetColorTag(openTagMenuId, t.color);
                  setOpenTagMenuId(null);
                }}
                className="w-4 h-4 rounded-full border border-black/20 hover:scale-110 transition-transform"
                style={{ backgroundColor: t.color === 'transparent' ? (isLight ? '#e5e5e5' : '#262626') : t.color }}
                title={t.name}
              />
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export const LayerPanel = React.memo(LayerPanelComponent);
