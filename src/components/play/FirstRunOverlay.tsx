import React, { useState, useCallback } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { setHasOnboarded, useHasOnboarded } from '../../core/uiModeStore';

export interface FirstRunOverlayProps {
  onOpenToybox: () => void;
  theme?: 'light' | 'dark';
}

/**
 * Three-card first-run overlay. Shown once on app load.
 *
 * Card 1: "Your screen" - a labelled map of the four zones
 * Card 2: "Fingers move. Pen draws." - the most important, shows gestures
 * Card 3: "Pick something to colour" - calls onOpenToybox and sets hasOnboarded
 *
 * Skippable at any point. Calling setHasOnboarded(true) happens on finish or skip.
 */
export const FirstRunOverlay: React.FC<FirstRunOverlayProps> = ({ onOpenToybox, theme = 'dark' }) => {
  const hasOnboarded = useHasOnboarded();
  const [currentCard, setCurrentCard] = useState(0);

  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-white' : 'bg-[#0f1117]';
  const textColor = isLight ? 'text-neutral-900' : 'text-white';
  const accentColor = isLight ? 'bg-neutral-200 text-neutral-900' : 'bg-white/10 text-white';
  const subtleColor = isLight ? 'text-neutral-600' : 'text-neutral-400';

  const handleSkip = useCallback(() => {
    setHasOnboarded(true);
  }, []);

  const handleNext = useCallback(() => {
    if (currentCard < 2) {
      setCurrentCard(currentCard + 1);
    } else {
      setHasOnboarded(true);
      onOpenToybox();
    }
  }, [currentCard, onOpenToybox]);

  // Render nothing if already onboarded
  if (hasOnboarded) {
    return null;
  }

  return (
    <div className="paperrocket-modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className={`pr-surface relative w-full max-w-md mx-4 rounded-3xl shadow-2xl flex flex-col overflow-hidden ${bgColor} motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:zoom-in-95`}
        style={{
          maxHeight: 'min(90vh, 560px)',
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
        }}
      >
        {/* Close button (top right) */}
        <button
          type="button"
          onClick={handleSkip}
          className={`absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 z-10 ${
            isLight ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200' : 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
          }`}
          aria-label="Skip tutorial"
          title="Skip"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable body — cards only */}
        <div className="flex flex-col gap-5 p-6 overflow-y-auto">
          {currentCard === 0 && <Card1YourScreen isLight={isLight} textColor={textColor} subtleColor={subtleColor} />}
          {currentCard === 1 && <Card2FingersPen isLight={isLight} textColor={textColor} subtleColor={subtleColor} />}
          {currentCard === 2 && <Card3PickSomething isLight={isLight} textColor={textColor} accentColor={accentColor} />}
        </div>

        {/* Fixed footer — always visible, never scrolls */}
        <div
          className={`flex items-center justify-between gap-3 px-6 py-4 border-t ${
            isLight ? 'border-neutral-200 bg-white/50' : 'border-neutral-800 bg-[#0f1117]/50'
          }`}
        >
          <button
            type="button"
            onClick={handleSkip}
            className={`min-h-11 px-4 rounded-full font-medium text-sm transition-all active:scale-95 ${
              isLight ? 'text-neutral-600 hover:bg-neutral-100' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === currentCard
                    ? isLight
                      ? 'w-8 bg-neutral-900'
                      : 'w-8 bg-white'
                    : isLight
                      ? 'w-2 bg-neutral-300'
                      : 'w-2 bg-neutral-700'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className={`h-11 w-11 rounded-full flex items-center justify-center font-medium transition-all active:scale-95 ${
              isLight ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-zinc-950 hover:bg-neutral-100'
            }`}
            aria-label={currentCard === 2 ? 'Open the Toybox' : 'Next'}
          >
            {currentCard === 2 ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Card 1: "Your screen" — a labelled map of the four zones.
 */
function Card1YourScreen({
  isLight,
  textColor,
  subtleColor,
}: {
  isLight: boolean;
  textColor: string;
  subtleColor: string;
}) {
  return (
    <div className="flex flex-col gap-4 select-none">
      <h2 className={`text-xl font-bold ${textColor}`}>Interface Layout</h2>

      <svg viewBox="0 0 320 480" className="w-full border rounded-xl max-h-[220px]" style={{ borderColor: isLight ? '#e5e7eb' : '#27272a' }}>
        {/* Screen background */}
        <rect width="320" height="480" fill={isLight ? '#f9fafb' : '#121214'} />

        {/* Zone A: Top strip */}
        <rect x="0" y="0" width="320" height="50" fill={isLight ? '#e5e7eb' : '#202328'} opacity="0.7" />
        <text x="160" y="32" textAnchor="middle" className={`text-xs font-bold ${isLight ? 'fill-neutral-800' : 'fill-neutral-200'}`}>
          Model · Undo · Redo · Settings
        </text>

        {/* Zone B: Left Command Bar */}
        <rect x="0" y="120" width="96" height="220" rx="8" fill={isLight ? '#e5e7eb' : '#202328'} opacity="0.75" />
        <text x="48" y="235" textAnchor="middle" className={`text-[11px] font-bold ${isLight ? 'fill-neutral-800' : 'fill-neutral-100'}`}>
          Drawing tools
        </text>

        {/* Zone C: Bottom right */}
        <rect x="260" y="420" width="44" height="44" rx="22" fill={isLight ? '#d1d5db' : '#202328'} opacity="0.8" />
        <text x="280" y="445" textAnchor="middle" className={`text-[9px] font-bold ${isLight ? 'fill-neutral-950' : 'fill-neutral-200'}`}>
          Navigator
        </text>

        {/* Canvas area label */}
        <text x="200" y="240" textAnchor="middle" className={`text-xs font-bold ${isLight ? 'fill-neutral-500' : 'fill-neutral-500'}`}>
          3D Canvas
        </text>
      </svg>

      <p className={`text-xs leading-relaxed ${subtleColor}`}>
        Drawing tools stay at the left edge. Color, stroke size, and brush profile sit in the small bottom pod. The Navigator stays as a tiny puck until you touch it.
      </p>
    </div>
  );
}

/**
 * Card 2: "Fingers move. Pen draws."
 */
function Card2FingersPen({
  isLight,
  textColor,
  subtleColor,
}: {
  isLight: boolean;
  textColor: string;
  subtleColor: string;
}) {
  return (
    <div className="flex flex-col gap-4 select-none">
      <h2 className={`text-xl font-bold ${textColor}`}>Touch Gestures & Stylus</h2>

      <div className="space-y-2.5">
        {/* 1 finger = orbit */}
        <div className="p-3 rounded-xl border" style={{ borderColor: isLight ? '#e5e7eb' : '#27272a', backgroundColor: isLight ? '#f9fafb' : '#18181b' }}>
          <div className={`font-bold text-xs mb-0.5 ${textColor}`}>1 finger touch</div>
          <div className={`text-xs ${subtleColor}`}>Orbit camera in 3D space</div>
        </div>

        {/* 2 fingers = pan & zoom */}
        <div className="p-3 rounded-xl border" style={{ borderColor: isLight ? '#e5e7eb' : '#27272a', backgroundColor: isLight ? '#f9fafb' : '#18181b' }}>
          <div className={`font-bold text-xs mb-0.5 ${textColor}`}>2 fingers pinch / drag</div>
          <div className={`text-xs ${subtleColor}`}>Pan & zoom viewport</div>
        </div>

        {/* Stylus = draws */}
        <div className="p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-white/5">
          <div className={`font-bold text-xs mb-0.5 ${textColor}`}>Stylus Pen</div>
          <div className={`text-xs ${textColor}`}>Draws curves in 3D volume</div>
        </div>
      </div>

      <p className={`text-xs leading-relaxed ${subtleColor}`}>
        No stylus? Enable Touch Input Drawing in Preferences to draw with your finger.
      </p>
    </div>
  );
}

/**
 * Card 3: "3D Model Library"
 */
function Card3PickSomething({
  isLight,
  textColor,
}: {
  isLight: boolean;
  textColor: string;
  accentColor?: string;
}) {
  return (
    <div className="flex flex-col gap-4 items-center select-none text-center">
      <h2 className={`text-xl font-bold ${textColor}`}>3D Model Library</h2>

      <svg viewBox="0 0 200 200" className="w-36 h-36 max-h-[140px]">
        <rect width="200" height="200" fill={isLight ? '#f9fafb' : '#18181b'} rx="12" />
        <g opacity="0.85">
          <circle cx="100" cy="90" r="45" fill={isLight ? '#e5e7eb' : '#27272a'} />
          <circle cx="120" cy="70" r="14" fill={isLight ? '#d1d5db' : '#3f3f46'} opacity="0.8" />
          <rect x="55" y="130" width="36" height="36" fill={isLight ? '#d1d5db' : '#3f3f46'} />
          <polygon points="91,130 110,115 110,150 91,166" fill={isLight ? '#9ca3af' : '#52525b'} />
        </g>
      </svg>

      <p className={`text-xs leading-relaxed ${textColor}`}>
        Select an asset from the 3D Model Library to paint directly on its surface, or start fresh on a blank drawing canvas.
      </p>
    </div>
  );
}
