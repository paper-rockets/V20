import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Smartphone, Tablet, Monitor, RotateCw, Maximize2, Minimize2, X } from 'lucide-react';

export type SimulatedDevice = 's25ultra' | 's6lite' | 'none';
export type DeviceOrientation = 'portrait' | 'landscape';

interface DeviceSimulatorFrameProps {
  children: React.ReactNode;
  initialDevice?: SimulatedDevice;
}

interface DeviceConfig {
  name: string;
  category: 'phone' | 'tablet';
  nativeWidth: number;
  nativeHeight: number;
  aspectRatioPortrait: number;
  cssWidth: number;
  cssHeight: number;
  specs: string;
  bezelRadius: string;
  bezelBorder: string;
  hasPunchHole: boolean;
}

const DEVICE_CONFIGS: Record<'s25ultra' | 's6lite', DeviceConfig> = {
  s25ultra: {
    name: 'Galaxy S25 Ultra',
    category: 'phone',
    nativeWidth: 1440,
    nativeHeight: 3120,
    aspectRatioPortrait: 1440 / 3120,
    cssWidth: 412,
    cssHeight: 893,
    specs: '6.9″ Dynamic AMOLED 2X • 1440 × 3120 px • 19.5:9 • Titanium',
    bezelRadius: '28px',
    bezelBorder: '10px solid #2d3139',
    hasPunchHole: true,
  },
  s6lite: {
    name: 'Galaxy Tab S6 Lite',
    category: 'tablet',
    nativeWidth: 1200,
    nativeHeight: 2000,
    aspectRatioPortrait: 1200 / 2000,
    cssWidth: 600,
    cssHeight: 1000,
    specs: '10.4″ WUXGA+ TFT • 1200 × 2000 px • 5:3 • S-Pen Stylus',
    bezelRadius: '22px',
    bezelBorder: '14px solid #1c1e24',
    hasPunchHole: false,
  },
};

export const DeviceSimulatorFrame: React.FC<DeviceSimulatorFrameProps> = ({
  children,
  initialDevice,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const initialResolved = useMemo<SimulatedDevice>(() => {
    if (initialDevice) return initialDevice;
    if (typeof window === 'undefined') return 'none';
    const params = new URLSearchParams(window.location.search);
    const d = params.get('device')?.toLowerCase();
    if (d === 's25ultra') return 's25ultra';
    if (d === 's6lite') return 's6lite';
    if (params.get('simulator') === 'true') return 's25ultra';
    return 'none';
  }, [initialDevice]);

  const [device, setDevice] = useState<SimulatedDevice>(initialResolved);
  const [orientation, setOrientation] = useState<DeviceOrientation>('portrait');
  const [fitMode, setFitMode] = useState<'fit' | 'actual'>('fit');
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setContainerDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectDevice = (newDevice: SimulatedDevice) => {
    setDevice(newDevice);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (newDevice === 'none') {
        url.searchParams.delete('device');
        url.searchParams.delete('simulator');
      } else {
        url.searchParams.set('device', newDevice);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  if (device === 'none') {
    return <>{children}</>;
  }

  const config = DEVICE_CONFIGS[device];
  const isPortrait = orientation === 'portrait';
  const targetAspect = isPortrait ? config.aspectRatioPortrait : 1 / config.aspectRatioPortrait;

  const topBarHeight = 44;
  const paddingMargin = 28;
  const maxW = Math.max(320, containerDimensions.width - paddingMargin * 2);
  const maxH = Math.max(320, containerDimensions.height - topBarHeight - paddingMargin * 2);

  let frameWidth: number;
  let frameHeight: number;

  if (fitMode === 'fit') {
    if (maxW / maxH > targetAspect) {
      frameHeight = maxH;
      frameWidth = Math.round(frameHeight * targetAspect);
    } else {
      frameWidth = maxW;
      frameHeight = Math.round(frameWidth / targetAspect);
    }
  } else {
    frameWidth = isPortrait ? config.cssWidth : config.cssHeight;
    frameHeight = isPortrait ? config.cssHeight : config.cssWidth;
  }

  const currentResolutionText = isPortrait
    ? `${config.nativeWidth} × ${config.nativeHeight}`
    : `${config.nativeHeight} × ${config.nativeWidth}`;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col bg-[#111216] text-neutral-200 select-none overflow-hidden"
    >
      <header className="relative z-50 h-11 px-3 bg-[#181a20] border-b border-neutral-800/80 flex items-center justify-between text-xs shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectDevice('s25ultra')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors font-medium ${
              device === 's25ultra'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300'
            }`}
            title="Switch to Samsung Galaxy S25 Ultra (1440 × 3120)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>S25 Ultra (1440×3120)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectDevice('s6lite')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors font-medium ${
              device === 's6lite'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300'
            }`}
            title="Switch to Samsung Galaxy Tab S6 Lite (1200 × 2000)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Tab S6 Lite (1200×2000)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectDevice('none')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Exit simulator and view in full browser window"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Full Window</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
          <span className="text-neutral-200 font-semibold">{config.name}</span>
          <span className="text-neutral-600">•</span>
          <span className="text-blue-400">{currentResolutionText} px</span>
          <span className="text-neutral-600">•</span>
          <span>{isPortrait ? 'Portrait (1:1 Aspect)' : 'Landscape'}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))}
            className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 transition-colors"
            title={`Toggle Orientation (Currently ${orientation})`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline capitalize">{orientation}</span>
          </button>

          <button
            type="button"
            onClick={() => setFitMode((prev) => (prev === 'fit' ? 'actual' : 'fit'))}
            className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 transition-colors"
            title={fitMode === 'fit' ? 'Switch to actual 1:1 CSS pixels' : 'Fit to screen height'}
          >
            {fitMode === 'fit' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{fitMode === 'fit' ? 'Fit Screen' : '100%'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectDevice('none')}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors ml-1"
            title="Close simulator view"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-3 relative overflow-hidden bg-[#0d0e12]">
        <div
          className="relative transition-all duration-200 shadow-2xl overflow-hidden bg-black flex flex-col"
          style={{
            width: `${frameWidth}px`,
            height: `${frameHeight}px`,
            borderRadius: config.bezelRadius,
            border: config.bezelBorder,
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          }}
        >
          {config.hasPunchHole && isPortrait && (
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#080808] border border-neutral-700/40 z-[99999] pointer-events-none shadow-inner flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#031326] opacity-70" />
            </div>
          )}

          {!config.hasPunchHole && isPortrait && (
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#0c0d10] border border-neutral-700/30 z-[99999] pointer-events-none" />
          )}

          <div className="w-full h-full relative overflow-hidden bg-neutral-900">
            {children}
          </div>
        </div>
      </main>

      <footer className="h-6 px-3 bg-[#14151a] border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400 select-none">
        <div>
          Emulating <strong className="text-neutral-200">{config.name}</strong> •{' '}
          <span>Native: {config.nativeWidth}×{config.nativeHeight} px</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Aspect: {isPortrait ? (device === 's25ultra' ? '19.5 : 9' : '5 : 3') : (device === 's25ultra' ? '9 : 19.5' : '3 : 5')}</span>
          <span className="text-neutral-600">|</span>
          <span className="text-neutral-300">{config.specs}</span>
        </div>
      </footer>
    </div>
  );
};
