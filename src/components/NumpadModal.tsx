import React, { useState, useEffect } from 'react';
import { NumpadTarget } from '../types';
import { Delete, Check, RotateCcw, X, Plus, Minus, Move, Hash } from 'lucide-react';

interface NumpadModalProps {
  target: NumpadTarget | null;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

export const NumpadModal: React.FC<NumpadModalProps> = ({
  target,
  onClose,
  theme = 'dark',
}) => {
  if (!target) return null;

  const [inputStr, setInputStr] = useState<string>(String(target.value));
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: Math.min(window.innerWidth - 320, Math.max(20, window.innerWidth / 2 - 140)),
    y: Math.min(window.innerHeight - 440, Math.max(60, window.innerHeight / 2 - 200)),
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    setInputStr(String(target.value));
  }, [target]);

  const handleDigit = (digit: string) => {
    if (inputStr === '0' && digit !== '.') {
      setInputStr(digit);
      return;
    }
    if (digit === '.' && inputStr.includes('.')) {
      return;
    }
    setInputStr((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setInputStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setInputStr('0');
  };

  const handleToggleSign = () => {
    setInputStr((prev) => {
      if (prev === '0' || prev === '') return '0';
      if (prev.startsWith('-')) return prev.slice(1);
      return '-' + prev;
    });
  };

  const handlePreset = (fraction: number) => {
    const val = target.min + (target.max - target.min) * fraction;
    const rounded = Number(val.toFixed(target.step < 0.01 ? 3 : target.step < 0.1 ? 2 : 1));
    setInputStr(String(rounded));
  };

  const handleStep = (multiplier: number) => {
    const current = parseFloat(inputStr) || 0;
    const next = current + target.step * multiplier;
    const clamped = Math.max(target.min, Math.min(target.max, next));
    const rounded = Number(clamped.toFixed(target.step < 0.01 ? 3 : target.step < 0.1 ? 2 : 1));
    setInputStr(String(rounded));
  };

  const handleConfirm = () => {
    let val = parseFloat(inputStr);
    if (isNaN(val)) val = target.min;
    val = Math.max(target.min, Math.min(target.max, val));
    target.onConfirm(val);
    onClose();
  };

  const handlePointerDownHeader = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const nextX = Math.max(10, Math.min(window.innerWidth - 280, e.clientX - dragOffset.x));
    const nextY = Math.max(10, Math.min(window.innerHeight - 380, e.clientY - dragOffset.y));
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className="pr-surface fixed z-50 select-none shadow-2xl rounded-2xl overflow-hidden font-sans border animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '280px',
        backgroundColor: isDark ? '#18191d' : '#ffffff',
        borderColor: isDark ? '#383a42' : '#e2e4ea',
        boxShadow: isDark
          ? '0 20px 50px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.2)'
          : '0 20px 40px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Header bar draggable */}
      <div
        onPointerDown={handlePointerDownHeader}
        className={`flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing border-b ${
          isDark ? 'border-neutral-800 bg-neutral-900/60 text-neutral-200' : 'border-neutral-200 bg-neutral-100/80 text-neutral-800'
        }`}
      >
        <div className="flex items-center gap-1.5 pointer-events-none">
          <Hash className="w-3.5 h-3.5 text-neutral-900 dark:text-zinc-300" />
          <span className="text-xs font-semibold tracking-wide truncate max-w-[170px]">
            {target.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-200 text-neutral-600'
            }`}
            title="Close Numpad"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Readout Display */}
        <div
          className={`px-3 py-2 rounded-xl flex items-center justify-between font-mono text-right border ${
            isDark
              ? 'bg-neutral-950/80 border-neutral-800 text-white'
              : 'bg-neutral-50 border-neutral-300 text-neutral-900'
          }`}
        >
          <span className="text-[11px] text-neutral-400 font-sans tracking-tight">
            {target.unit || 'VAL'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-wider">{inputStr}</span>
            <span className="text-xs text-neutral-900 dark:text-zinc-300">{target.unit}</span>
          </div>
        </div>

        {/* Range & Quick Step Row */}
        <div className="flex items-center justify-between gap-1 text-[10px]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePreset(0)}
              className={`px-1.5 py-0.5 rounded border transition-colors ${
                isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Min ({target.min})
            </button>
            <button
              onClick={() => handlePreset(0.5)}
              className={`px-1.5 py-0.5 rounded border transition-colors ${
                isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Mid
            </button>
            <button
              onClick={() => handlePreset(1)}
              className={`px-1.5 py-0.5 rounded border transition-colors ${
                isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Max ({target.max})
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleStep(-1)}
              className={`p-1 rounded border transition-colors ${
                isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 bg-neutral-100 text-neutral-700'
              }`}
              title="Step Down"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleStep(1)}
              className={`p-1 rounded border transition-colors ${
                isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-200 bg-neutral-100 text-neutral-700'
              }`}
              title="Step Up"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Numpad Keypad Grid (4x3 + Action Row) */}
        <div className="grid grid-cols-4 gap-1.5">
          {['7', '8', '9', 'C'].map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === 'C') handleClear();
                else handleDigit(k);
              }}
              className={`h-9 rounded-xl font-mono text-sm font-semibold flex items-center justify-center transition-transform active:scale-95 border ${
                k === 'C'
                  ? isDark
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                    : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200'
                  : isDark
                  ? 'bg-neutral-900/80 border-neutral-800/80 text-neutral-200 hover:bg-neutral-800 hover:text-white'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200'
              }`}
            >
              {k}
            </button>
          ))}

          {['4', '5', '6', 'DEL'].map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === 'DEL') handleBackspace();
                else handleDigit(k);
              }}
              className={`h-9 rounded-xl font-mono text-sm font-semibold flex items-center justify-center transition-transform active:scale-95 border ${
                k === 'DEL'
                  ? isDark
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                    : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200'
                  : isDark
                  ? 'bg-neutral-900/80 border-neutral-800/80 text-neutral-200 hover:bg-neutral-800 hover:text-white'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200'
              }`}
            >
              {k === 'DEL' ? <Delete className="w-4 h-4" /> : k}
            </button>
          ))}

          {['1', '2', '3', '±'].map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === '±') handleToggleSign();
                else handleDigit(k);
              }}
              className={`h-9 rounded-xl font-mono text-sm font-semibold flex items-center justify-center transition-transform active:scale-95 border ${
                isDark
                  ? 'bg-neutral-900/80 border-neutral-800/80 text-neutral-200 hover:bg-neutral-800 hover:text-white'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200'
              }`}
            >
              {k}
            </button>
          ))}

          {['0', '.', 'OK'].map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === 'OK') handleConfirm();
                else handleDigit(k);
              }}
              className={`h-9 rounded-xl font-mono text-sm font-semibold flex items-center justify-center transition-transform active:scale-95 border ${
                k === 'OK'
                  ? `col-span-2 ${isDark ? 'bg-white hover:bg-neutral-100 text-zinc-950 border-white' : 'bg-neutral-900 hover:bg-black text-white border-neutral-900'} shadow-md font-bold`
                  : isDark
                  ? 'bg-neutral-900/80 border-neutral-800/80 text-neutral-200 hover:bg-neutral-800'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-800 hover:bg-neutral-200'
              }`}
            >
              {k === 'OK' ? (
                <div className="flex items-center gap-1 text-xs uppercase tracking-wider font-bold">
                  <Check className="w-4 h-4" />
                  <span>Set Value</span>
                </div>
              ) : (
                k
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
