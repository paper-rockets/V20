import React, { useState, useEffect, useRef } from 'react';
import {
  ToolType,
  BrushSettings,
  SymmetryMode,
  Layer,
} from '../types';
import {
  Paintbrush,
  Eraser,
  Pipette,
  Layers,
  Sparkles,
  RotateCcw,
  RotateCw,
  Compass,
  X,
  Sliders,
  ShieldAlert,
  Minimize2,
  Maximize2,
  Check,
  Split,
  Palette,
  Circle,
  Hash,
} from 'lucide-react';

export interface RadialMenuPosition {
  x: number;
  y: number;
}

interface StylusRadialMenuProps {
  isOpen: boolean;
  position: RadialMenuPosition | null;
  onClose: () => void;
  tool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  brushSettings: BrushSettings;
  onUpdateBrushSettings: (settings: Partial<BrushSettings>) => void;
  symmetry: SymmetryMode;
  onSelectSymmetry: (sym: SymmetryMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onResetView: () => void;
  onRecalculateNormals: () => void;
  onOpenColorPanel?: () => void;
  onOpenNumpad?: (target: {
    id: string;
    title: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onConfirm: (val: number) => void;
  }) => void;
  theme?: 'light' | 'dark';
}

const QUICK_COLORS = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#38bdf8',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];

export const StylusRadialMenu: React.FC<StylusRadialMenuProps> = ({
  isOpen,
  position,
  onClose,
  tool,
  onSelectTool,
  brushSettings,
  onUpdateBrushSettings,
  symmetry,
  onSelectSymmetry,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onResetView,
  onRecalculateNormals,
  onOpenColorPanel,
  onOpenNumpad,
  theme = 'dark',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<'tools' | 'symmetry' | 'colors' | 'size' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveSubmenu(null);
    }
  }, [isOpen]);

  if (!isOpen || !position) return null;

  // Safe Haptic feedback
  const triggerHaptic = (ms: number = 15) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch (_) {}
  };

  // Clamp radial position within screen bounds
  const menuRadius = 140;
  const clampedX = Math.max(menuRadius + 20, Math.min(window.innerWidth - menuRadius - 20, position.x));
  const clampedY = Math.max(menuRadius + 20, Math.min(window.innerHeight - menuRadius - 20, position.y));

  const isDark = theme === 'dark';

  // Primary Ring Items: Angles in degrees
  const primaryItems = [
    {
      id: 'tool_brush',
      label: 'Brush',
      icon: Paintbrush,
      active: tool === 'brush' || tool === 'uv_brush',
      action: () => {
        triggerHaptic(12);
        onSelectTool('brush');
        onClose();
      },
      angle: -90, // Top
      color: '#38bdf8',
    },
    {
      id: 'tool_eraser',
      label: 'Eraser',
      icon: Eraser,
      active: tool === 'eraser',
      action: () => {
        triggerHaptic(12);
        onSelectTool('eraser');
        onClose();
      },
      angle: -45, // Top-Right
      color: '#f43f5e',
    },
    {
      id: 'colors',
      label: 'Palette',
      icon: Palette,
      active: activeSubmenu === 'colors',
      action: () => {
        triggerHaptic(10);
        setActiveSubmenu(activeSubmenu === 'colors' ? null : 'colors');
      },
      angle: 0, // Right
      color: brushSettings.color,
    },
    {
      id: 'size',
      label: 'Size',
      icon: Sliders,
      active: activeSubmenu === 'size',
      action: () => {
        triggerHaptic(10);
        setActiveSubmenu(activeSubmenu === 'size' ? null : 'size');
      },
      angle: 45, // Bottom-Right
      color: '#a855f7',
    },
    {
      id: 'undo',
      label: 'Undo',
      icon: RotateCcw,
      disabled: !canUndo,
      action: () => {
        if (canUndo) {
          triggerHaptic(18);
          onUndo();
        }
      },
      angle: 90, // Bottom
      color: '#94a3b8',
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: RotateCw,
      disabled: !canRedo,
      action: () => {
        if (canRedo) {
          triggerHaptic(18);
          onRedo();
        }
      },
      angle: 135, // Bottom-Left
      color: '#94a3b8',
    },
    {
      id: 'symmetry',
      label: 'Symmetry',
      icon: Split,
      active: symmetry !== 'none',
      action: () => {
        triggerHaptic(10);
        setActiveSubmenu(activeSubmenu === 'symmetry' ? null : 'symmetry');
      },
      angle: 180, // Left
      color: '#10b981',
    },
    {
      id: 'eyedropper',
      label: 'Sampler',
      icon: Pipette,
      active: tool === 'eyedropper' || tool === 'paint_picker' || tool === 'brush_picker',
      action: () => {
        triggerHaptic(12);
        onSelectTool('paint_picker');
        onClose();
      },
      angle: -135, // Top-Left
      color: '#f59e0b',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto select-none font-sans"
      onPointerDown={(e) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-100" />

      {/* Radial Menu Container centered at stylus tip */}
      <div
        ref={menuRef}
        style={{
          left: `${clampedX}px`,
          top: `${clampedY}px`,
        }}
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto animate-in zoom-in-75 fade-in duration-150"
      >
        {/* Center Stylus Reticle Hub */}
        <div
          onClick={onClose}
          className={`relative z-20 w-14 h-14 rounded-full flex flex-col items-center justify-center cursor-pointer shadow-2xl border transition-transform hover:scale-105 active:scale-95 ${
            isDark
              ? 'bg-neutral-900/95 border-neutral-700 text-white'
              : 'bg-white/95 border-neutral-300 text-neutral-800'
          }`}
          style={{
            boxShadow: isDark
              ? '0 0 30px rgba(56, 189, 248, 0.3), 0 10px 25px rgba(0,0,0,0.6)'
              : '0 0 25px rgba(56, 189, 248, 0.25), 0 10px 20px rgba(0,0,0,0.15)',
          }}
          title="Close Radial Menu"
        >
          <div
            className="w-4 h-4 rounded-full border border-white/60 mb-0.5"
            style={{ backgroundColor: brushSettings.color }}
          />
          <span className="text-[9px] font-mono font-bold leading-none">
            {Math.round(brushSettings.size * 1000)}mm
          </span>
        </div>

        {/* Primary Circular Orbital Ring */}
        {primaryItems.map((item) => {
          const rad = (item.angle * Math.PI) / 180;
          const radius = 80;
          const posX = Math.cos(rad) * radius;
          const posY = Math.sin(rad) * radius;

          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={item.action}
              disabled={item.disabled}
              style={{
                transform: `translate(${posX}px, ${posY}px) translate(-50%, -50%)`,
              }}
              className={`absolute top-1/2 left-1/2 z-10 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border transition-all duration-150 ${
                item.disabled
                  ? 'opacity-30 cursor-not-allowed bg-neutral-800 border-neutral-700 text-neutral-500'
                  : item.active
                  ? 'bg-neutral-900 dark:bg-white border-neutral-700 dark:border-neutral-300 text-white dark:text-zinc-950 scale-110 shadow-lg'
                  : isDark
                  ? 'bg-neutral-900/90 border-neutral-700/80 text-neutral-200 hover:bg-neutral-800 hover:scale-105'
                  : 'bg-white/95 border-neutral-300 text-neutral-700 hover:bg-neutral-100 hover:scale-105'
              }`}
              title={item.label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}

        {/* Submenu Popout: Color Palette */}
        {activeSubmenu === 'colors' && (
          <div
            className={`absolute top-1/2 left-1/2 -translate-y-1/2 translate-x-24 z-30 p-2.5 rounded-2xl shadow-2xl border flex flex-col gap-2 animate-in fade-in slide-in-from-left-4 duration-150 ${
              isDark ? 'bg-[#18191d] border-neutral-700' : 'bg-white border-neutral-200'
            }`}
            style={{ width: '160px' }}
          >
            <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400 px-1">
              Quick Swatches
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {QUICK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    triggerHaptic(10);
                    onUpdateBrushSettings({ color: c });
                    onClose();
                  }}
                  className={`w-5 h-5 rounded-full border transition-transform hover:scale-125 ${
                    brushSettings.color.toLowerCase() === c.toLowerCase()
                      ? 'ring-2 ring-neutral-900 dark:ring-white scale-110'
                      : 'border-black/20'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            {onOpenColorPanel && (
              <button
                onClick={() => {
                  onClose();
                  onOpenColorPanel();
                }}
                className="w-full py-1 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center gap-1 mt-1 transition-colors"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Full Color Studio</span>
              </button>
            )}
          </div>
        )}

        {/* Submenu Popout: Brush Size */}
        {activeSubmenu === 'size' && (
          <div
            className={`absolute top-1/2 left-1/2 -translate-y-1/2 translate-x-24 z-30 p-3 rounded-2xl shadow-2xl border flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-4 duration-150 ${
              isDark ? 'bg-[#18191d] border-neutral-700' : 'bg-white border-neutral-200'
            }`}
            style={{ width: '180px' }}
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400">
              <span>Stroke Radius</span>
              <button
                onClick={() => {
                  if (onOpenNumpad) {
                    onOpenNumpad({
                      id: 'brush_size_radial',
                      title: 'Brush Size (Radius)',
                      value: brushSettings.size,
                      min: 0.002,
                      max: 0.5,
                      step: 0.005,
                      unit: 'm',
                      onConfirm: (val) => onUpdateBrushSettings({ size: val }),
                    });
                    onClose();
                  }
                }}
                className="flex items-center gap-0.5 font-mono text-neutral-900 dark:text-zinc-300 hover:underline underline"
              >
                <Hash className="w-2.5 h-2.5" />
                <span>{(brushSettings.size * 1000).toFixed(1)}mm</span>
              </button>
            </div>
            <input
              type="range"
              min="0.002"
              max="0.25"
              step="0.002"
              value={brushSettings.size}
              onChange={(e) => {
                onUpdateBrushSettings({ size: parseFloat(e.target.value) });
              }}
              className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-neutral-100"
            />
            <div className="grid grid-cols-4 gap-1">
              {[0.005, 0.015, 0.035, 0.08].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    triggerHaptic(10);
                    onUpdateBrushSettings({ size: s });
                  }}
                  className={`py-1 rounded-lg text-[10px] font-mono font-semibold border ${
                    Math.abs(brushSettings.size - s) < 0.001
                      ? 'bg-neutral-900 dark:bg-white border-neutral-700 dark:border-neutral-300 text-white dark:text-zinc-950'
                      : isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-300'
                      : 'bg-neutral-100 border-neutral-300 text-neutral-700'
                  }`}
                >
                  {Math.round(s * 1000)}mm
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submenu Popout: Symmetry Modes */}
        {activeSubmenu === 'symmetry' && (
          <div
            className={`absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-[260px] z-30 p-2.5 rounded-2xl shadow-2xl border flex flex-col gap-1 animate-in fade-in slide-in-from-right-4 duration-150 ${
              isDark ? 'bg-[#18191d] border-neutral-700' : 'bg-white border-neutral-200'
            }`}
            style={{ width: '150px' }}
          >
            <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400 px-1 mb-1">
              Symmetry Mode
            </div>
            {[
              { id: 'none', label: 'Off' },
              { id: 'mirror_x', label: 'Mirror X (Sagittal)' },
              { id: 'mirror_y', label: 'Mirror Y (Horizontal)' },
              { id: 'mirror_z', label: 'Mirror Z (Coronal)' },
              { id: 'radial_4x', label: 'Radial 4-Fold' },
              { id: 'custom_plane', label: 'Custom Plane' },
            ].map((sym) => (
              <button
                key={sym.id}
                onClick={() => {
                  triggerHaptic(12);
                  onSelectSymmetry(sym.id as SymmetryMode);
                  onClose();
                }}
                className={`w-full px-2.5 py-1 rounded-lg text-left text-xs font-semibold transition-colors flex items-center justify-between ${
                  symmetry === sym.id
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-zinc-950'
                    : isDark
                    ? 'hover:bg-neutral-800 text-neutral-300'
                    : 'hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                <span>{sym.label}</span>
                {symmetry === sym.id && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
