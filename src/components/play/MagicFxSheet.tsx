import React, { useEffect, useRef } from 'react';
import { BrushSettings } from '../../types';
import { PlaySheet } from './PlaySheet';
import { MAGIC_FX_TILES } from '../../presets/magicFx';
import { haptics } from '../../utils/haptics';

interface MagicFxSheetProps {
  brushSettings: BrushSettings;
  setBrushSettings: React.Dispatch<React.SetStateAction<BrushSettings>>;
  theme?: 'light' | 'dark';
}

export const MagicFxSheet: React.FC<MagicFxSheetProps> = ({
  brushSettings,
  setBrushSettings,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Inject animation keyframes once
  useEffect(() => {
    if (styleRef.current) return;
    const style = document.createElement('style');
    style.textContent = `
      @media (prefers-reduced-motion: no-preference) {
        @keyframes lavaFlow {
          0%, 100% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(5deg); }
        }
        @keyframes slimeWobble {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes sparkleShimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .fx-lava { animation: lavaFlow 4s ease-in-out infinite; }
        .fx-slime { animation: slimeWobble 3s ease-in-out infinite; }
        .fx-sparkle { animation: sparkleShimmer 2s ease-in-out infinite; }
      }
    `;
    document.head.appendChild(style);
    styleRef.current = style;
  }, []);

  const handleSelectFx = (fxTile: typeof MAGIC_FX_TILES[0]) => {
    haptics.trigger('light');
    setBrushSettings((prev) => ({
      ...prev,
      shaderEffect: fxTile.shaderEffect,
      materialType: fxTile.materialType,
      emissiveIntensity: fxTile.emissiveIntensity,
    }));
  };

  // Determine which effect is currently active
  const currentFxId = MAGIC_FX_TILES.find(
    (tile) =>
      tile.shaderEffect === brushSettings.shaderEffect &&
      tile.materialType === brushSettings.materialType &&
      tile.emissiveIntensity === brushSettings.emissiveIntensity
  )?.id;

  const getPreviewClasses = (effectId: string): string => {
    switch (effectId) {
      case 'lava':
        return 'fx-lava';
      case 'slime':
        return 'fx-slime';
      case 'sparkle':
        return 'fx-sparkle';
      default:
        return '';
    }
  };

  const getPreviewStyle = (effectId: string): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      'neon-glow': {
        background: '#00ffff',
        boxShadow: `
          0 0 8px rgba(0, 255, 255, 0.8),
          0 0 16px rgba(0, 255, 255, 0.6),
          0 0 24px rgba(0, 255, 255, 0.4),
          inset 0 0 4px rgba(255, 255, 255, 0.6)
        `,
      },
      'lava': {
        background: `
          radial-gradient(circle at 30% 30%, #ff3300 0%, #ff6600 20%, #330000 100%),
          radial-gradient(circle at 70% 60%, #ff6600 0%, #cc0000 30%, transparent 70%),
          radial-gradient(ellipse at 50% 50%, #1a0000 0%, #4d0000 50%)
        `,
      },
      'slime': {
        background: `
          radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.6) 0%, transparent 50%),
          radial-gradient(ellipse 80% 60% at 50% 50%, #00dd00 0%, #008800 100%)
        `,
      },
      'cartoon': {
        background: '#1a1a1a',
        border: '3px solid #000',
        boxShadow: `
          inset 0 -4px 0 rgba(0, 0, 0, 0.8),
          4px 4px 0 rgba(0, 0, 0, 0.5)
        `,
      },
      'rainbow': {
        background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
      },
      'sparkle': {
        background: '#1a1a2e',
        boxShadow: `
          inset 0 0 2px #ffff00,
          12px 8px 0 #ffff00,
          -8px 12px 0 #ffff88,
          20px -4px 0 #ffffcc,
          -12px -8px 0 #ffff44,
          6px -14px 0 #ffffff
        `,
      },
      'none': {
        background: 'linear-gradient(135deg, #cccccc 0%, #999999 100%)',
      },
    };
    return styles[effectId] || {};
  };

  return (
    <PlaySheet id="fx" title="Magic" theme={theme}>
      <div className="grid grid-cols-3 gap-2">
        {MAGIC_FX_TILES.map((tile) => {
          const selected = tile.id === currentFxId;
          const previewClasses = getPreviewClasses(tile.id);

          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleSelectFx(tile)}
              className={`rounded-lg border transition-all active:scale-95 flex flex-col items-center justify-center gap-1 p-1.5
                ${
                  selected
                    ? isLight
                      ? 'ring-2 ring-neutral-900 border-neutral-900'
                      : 'ring-2 ring-white border-white'
                    : isLight
                      ? 'border-neutral-200 hover:bg-neutral-50'
                      : 'border-neutral-800 hover:bg-white/5'
                }`}
              style={{ minHeight: 64 }}
            >
              <div
                className={`w-10 h-10 rounded-md border-0 flex-shrink-0 ${previewClasses}`}
                style={getPreviewStyle(tile.id)}
              />
              <span className="text-[10px] font-bold text-center leading-tight px-0.5">{tile.label}</span>
            </button>
          );
        })}
      </div>
    </PlaySheet>
  );
};
