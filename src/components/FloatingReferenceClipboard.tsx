import React, { useState, useRef, useEffect } from 'react';
import { ReferenceImageItem } from '../types';
import {
  Image,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Move,
  RotateCw,
  Sliders,
  X,
  Upload,
  Clipboard,
  Pin,
  PinOff,
  Contrast,
  Sun,
  Layers,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getThemeClasses } from '../utils/themeStyles';

interface FloatingReferenceClipboardProps {
  isOpen: boolean;
  onClose: () => void;
  referenceImages: ReferenceImageItem[];
  setReferenceImages: React.Dispatch<React.SetStateAction<ReferenceImageItem[]>>;
  theme?: 'light' | 'dark';
}

export const FloatingReferenceClipboard: React.FC<FloatingReferenceClipboardProps> = ({
  isOpen,
  onClose,
  referenceImages,
  setReferenceImages,
  theme = 'dark',
}) => {
  const themeClasses = getThemeClasses(theme);
  const isLight = theme === 'light';

  if (!isOpen) return null;

  const [activeImageId, setActiveImageId] = useState<string | null>(
    referenceImages[0]?.id || null
  );
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [clipboardPosition, setClipboardPosition] = useState<{ x: number; y: number }>({
    x: 24,
    y: 80,
  });
  const [isDraggingHeader, setIsDraggingHeader] = useState<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global paste handler for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const url = event.target?.result as string;
              if (url) {
                addImageItem(url, `Blueprint ${referenceImages.length + 1}`);
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, referenceImages]);

  // Window drag handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingHeader) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setClipboardPosition({
        x: Math.max(10, dragStartRef.current.startX + dx),
        y: Math.max(10, dragStartRef.current.startY + dy),
      });
    };

    const handleMouseUp = () => {
      setIsDraggingHeader(false);
    };

    if (isDraggingHeader) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHeader]);

  const addImageItem = (url: string, name: string = 'Reference Image') => {
    const id = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newItem: ReferenceImageItem = {
      id,
      name,
      url,
      x: 10,
      y: 10,
      width: 240,
      height: 180,
      opacity: 0.75,
      rotation: 0,
      scale: 1.0,
      visible: true,
      locked: false,
      pinned: true,
      grayscale: false,
      invert: false,
    };

    setReferenceImages((prev) => [newItem, ...prev]);
    setActiveImageId(id);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (url) {
          addImageItem(url, file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const activeItem = referenceImages.find((item) => item.id === activeImageId);

  const updateActiveItem = (updates: Partial<ReferenceImageItem>) => {
    if (!activeImageId) return;
    setReferenceImages((prev) =>
      prev.map((item) => (item.id === activeImageId ? { ...item, ...updates } : item))
    );
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReferenceImages((prev) => prev.filter((item) => item.id !== id));
    if (activeImageId === id) {
      const remaining = referenceImages.filter((item) => item.id !== id);
      setActiveImageId(remaining[0]?.id || null);
    }
  };

  return (
    <>
      {/* Floating Blueprint Pinboard Overlay on screen */}
      <div
        id="mody-floating-clipboard"
        style={{
          left: `${clipboardPosition.x}px`,
          top: `${clipboardPosition.y}px`,
        }}
        className={`pr-surface fixed z-40 select-none shadow-2xl rounded-2xl border font-sans w-80 sm:w-96 animate-in fade-in zoom-in-95 duration-150 ${
          isLight ? 'bg-white border-black/10 text-neutral-800 shadow-2xl' : 'bg-[#18191d] border-neutral-800 text-neutral-200 shadow-2xl'
        }`}
      >
        {/* Header (Draggable Handle) */}
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drag-handle')) {
              setIsDraggingHeader(true);
              dragStartRef.current = {
                mouseX: e.clientX,
                mouseY: e.clientY,
                startX: clipboardPosition.x,
                startY: clipboardPosition.y,
              };
            }
          }}
          className={`drag-handle flex items-center justify-between p-3 border-b cursor-move rounded-t-2xl ${themeClasses.header}`}
        >
          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-neutral-700 dark:text-zinc-300" />
            <span className={`text-xs font-bold uppercase tracking-wider ${themeClasses.textPrimary}`}>
              Reference Images
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${isLight ? 'bg-neutral-100 dark:bg-white/5 text-neutral-900 dark:text-neutral-200 border-black/10 dark:border-white/10' : 'bg-black/30 dark:bg-white/5 text-neutral-800 dark:text-zinc-300 border-neutral-800 dark:border-neutral-200/40'}`}>
              {referenceImages.length} pins
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className={`p-1 rounded cursor-pointer ${themeClasses.btnGhost}`}
            >
              {isMinimized ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={onClose}
              className={`p-1 rounded cursor-pointer ${themeClasses.btnGhost}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="p-3.5 space-y-3">
            {/* Quick Actions: Upload File, Paste Helper */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-1.5 px-2.5 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-900 dark:bg-white text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Blueprint</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.read().then((items) => {
                    for (const item of items) {
                      const imageType = item.types.find((t) => t.startsWith('image/'));
                      if (imageType) {
                        item.getType(imageType).then((blob) => {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const url = ev.target?.result as string;
                            if (url) addImageItem(url, `Pasted Clipboard ${referenceImages.length + 1}`);
                          };
                          reader.readAsDataURL(blob);
                        });
                      }
                    }
                  });
                }}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${themeClasses.btnSecondary}`}
              >
                <Clipboard className="w-3.5 h-3.5 text-neutral-700 dark:text-zinc-300" />
                <span>Paste (Ctrl+V)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Thumbnail Pin Strip */}
            {referenceImages.length > 0 && (
              <div className="space-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.textSecondary}`}>
                  Pinned Moodboards & References
                </span>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {referenceImages.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => setActiveImageId(img.id)}
                      className={`relative shrink-0 w-16 h-14 rounded-lg overflow-hidden border cursor-pointer group transition-all ${
                        activeImageId === img.id
                          ? 'border-neutral-400 dark:border-neutral-600 ring-2 ring-neutral-900 dark:ring-white/40 scale-105'
                          : isLight ? 'border-black/10 opacity-70 hover:opacity-100' : 'border-neutral-800 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => handleDeleteItem(img.id, e)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/70 text-neutral-700 dark:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Selected Reference Controls & Live Preview Overlay */}
            {activeItem ? (
              <div className={`space-y-2.5 pt-2 border-t ${themeClasses.borderSubtle}`}>
                {/* Image Live Tracing Preview Box */}
                <div className={`relative w-full h-44 rounded-xl overflow-hidden border flex items-center justify-center p-1 ${isLight ? 'bg-neutral-100 border-black/10' : 'bg-neutral-950 border-neutral-800'}`}>
                  <img
                    src={activeItem.url}
                    alt={activeItem.name}
                    style={{
                      opacity: activeItem.opacity,
                      transform: `scale(${activeItem.scale}) rotate(${activeItem.rotation}deg)`,
                      filter: `${activeItem.grayscale ? 'grayscale(100%)' : ''} ${
                        activeItem.invert ? 'invert(100%)' : ''
                      }`,
                    }}
                    className="max-w-full max-h-full object-contain transition-transform duration-75 pointer-events-none"
                  />
                  <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-full bg-black/85 text-[10px] font-mono text-white border border-white/20">
                    {Math.round(activeItem.opacity * 100)}% opacity • {activeItem.rotation}°
                  </div>
                </div>

                {/* Opacity Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium flex items-center gap-1 ${themeClasses.textPrimary}`}>
                      <Sun className="w-3 h-3 text-neutral-700 dark:text-zinc-300" />
                      <span>Blueprint Overlay Opacity</span>
                    </span>
                    <span className={`font-mono text-xs font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>
                      {Math.round(activeItem.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={activeItem.opacity}
                    onChange={(e) =>
                      updateActiveItem({ opacity: parseFloat(e.target.value) })
                    }
                    className={`w-full h-1.5 rounded-lg ${themeClasses.rangeSlider}`}
                  />
                </div>

                {/* Zoom & Rotation Controls */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Zoom Scale */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={themeClasses.textSecondary}>Zoom Scale</span>
                      <span className={`font-mono font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>
                        {activeItem.scale.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateActiveItem({ scale: Math.max(0.2, activeItem.scale - 0.2) })
                        }
                        className={`p-1 rounded cursor-pointer ${themeClasses.btnSecondary}`}
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={activeItem.scale}
                        onChange={(e) =>
                          updateActiveItem({ scale: parseFloat(e.target.value) })
                        }
                        className={`w-full h-1 rounded-lg ${themeClasses.rangeSlider}`}
                      />
                      <button
                        onClick={() =>
                          updateActiveItem({ scale: Math.min(3.0, activeItem.scale + 0.2) })
                        }
                        className={`p-1 rounded cursor-pointer ${themeClasses.btnSecondary}`}
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Rotation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={themeClasses.textSecondary}>Rotation</span>
                      <span className={`font-mono font-bold ${isLight ? 'text-neutral-900 dark:text-zinc-200' : 'text-neutral-800 dark:text-zinc-300'}`}>
                        {activeItem.rotation}°
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateActiveItem({ rotation: (activeItem.rotation + 90) % 360 })
                        }
                        className={`w-full py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${themeClasses.btnSecondary}`}
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>+90°</span>
                      </button>
                      <button
                        onClick={() => updateActiveItem({ rotation: 0 })}
                        className={`px-2 py-1 rounded text-[10px] cursor-pointer ${themeClasses.btnSecondary}`}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Toggles: Grayscale, Invert, Lock, Pin */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() =>
                      updateActiveItem({ grayscale: !activeItem.grayscale })
                    }
                    className={`py-1 px-2 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      activeItem.grayscale
                        ? isLight
                          ? 'bg-neutral-100 dark:bg-white/10 border-neutral-400 dark:border-neutral-600 text-neutral-900 dark:text-white'
                          : 'bg-neutral-900 dark:bg-white/30 border-neutral-900 dark:border-white text-neutral-800 dark:text-zinc-300'
                        : themeClasses.inactivePill
                    }`}
                  >
                    <Contrast className="w-3 h-3" />
                    <span>Grayscale</span>
                  </button>

                  <button
                    onClick={() => updateActiveItem({ invert: !activeItem.invert })}
                    className={`py-1 px-2 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      activeItem.invert
                        ? isLight
                          ? 'bg-neutral-100 dark:bg-white/10 border-neutral-400 dark:border-neutral-600 text-neutral-900 dark:text-white'
                          : 'bg-neutral-900 dark:bg-white/30 border-neutral-900 dark:border-white text-neutral-800 dark:text-zinc-300'
                        : themeClasses.inactivePill
                    }`}
                  >
                    <Contrast className="w-3 h-3 rotate-180" />
                    <span>Invert</span>
                  </button>

                  <button
                    onClick={() => updateActiveItem({ pinned: !activeItem.pinned })}
                    className={`py-1 px-2 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      activeItem.pinned
                        ? isLight
                          ? 'bg-neutral-100 dark:bg-white/10 border-neutral-400 dark:border-neutral-600 text-neutral-900 dark:text-white'
                          : 'bg-neutral-900 dark:bg-white/30 border-neutral-900 dark:border-white text-neutral-800 dark:text-zinc-300'
                        : themeClasses.inactivePill
                    }`}
                  >
                    {activeItem.pinned ? (
                      <Pin className="w-3 h-3" />
                    ) : (
                      <PinOff className="w-3 h-3" />
                    )}
                    <span>{activeItem.pinned ? 'Pinned' : 'Float'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className={`text-center py-6 border border-dashed rounded-xl space-y-1 ${themeClasses.borderSubtle}`}>
                <Image className={`w-6 h-6 mx-auto ${themeClasses.textMuted}`} />
                <p className={`text-xs font-medium ${themeClasses.textSecondary}`}>No Blueprints Pinned</p>
                <p className={`text-[10px] ${themeClasses.textMuted}`}>
                  Upload an image or press Ctrl+V to paste reference moodboards
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
