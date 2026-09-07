import React from 'react';

type IP = { className?: string; strokeWidth?: number; style?: React.CSSProperties };

const d = (paths: string, vb = '0 0 24 24'): React.FC<IP> => {
  const Icon: React.FC<IP> = ({ className = 'w-5 h-5', strokeWidth = 1.35, style }) => (
    <svg
      viewBox={vb}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {paths.split('|').map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
  Icon.displayName = 'StudioIcon';
  return Icon;
};

const df = (render: (p: IP) => React.JSX.Element): React.FC<IP> => {
  const Icon: React.FC<IP> = (props) => render({ className: 'w-5 h-5', strokeWidth: 1.35, ...props });
  Icon.displayName = 'StudioIcon';
  return Icon;
};

// ── Rail icons ──────────────────────────────────────────────

export const IcPointer = d(
  'M5 3l12 9-5 1.5L9 19z|M12 13.5l4 6'
);

export const IcDraw = d(
  'M3 21l2-6L17 3l4 4L9 19z|M15 5l4 4'
);

export const IcErase = d(
  'M9 21h10|M19 10l-6-6-10 10 4 4h5l7-8z'
);

export const IcSample = d(
  'M7 21l-4-4 8-8 4 4-8 8z|M11 9l4-4 4 4-4 4|M20 5l-1-1'
);

export const IcCreate = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <circle cx="17" cy="7" r="4" />
    <path d="M3 17l4-4 4 4-4 4z" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
));

export const IcDeform = d(
  'M12 2v20|M2 12h20|M5 5l3 3|M19 5l-3 3|M5 19l3-3|M19 19l-3-3'
);

export const IcLayers = d(
  'M12 2l10 5-10 5L2 7z|M2 12l10 5 10-5|M2 17l10 5 10-5'
);

export const IcSun = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3" />
    <path d="M12 19v3" />
    <path d="M4.22 4.22l2.12 2.12" />
    <path d="M17.66 17.66l2.12 2.12" />
    <path d="M2 12h3" />
    <path d="M19 12h3" />
    <path d="M4.22 19.78l2.12-2.12" />
    <path d="M17.66 6.34l2.12-2.12" />
  </svg>
));

// ── Top bar icons ───────────────────────────────────────────

export const IcScene = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2l-2 4h4l-2-4z" />
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
));

export const IcUndo = d(
  'M4 7h11a4 4 0 010 8H8|M4 7l4-4|M4 7l4 4'
);

export const IcRedo = d(
  'M20 7H9a4 4 0 000 8h7|M20 7l-4-4|M20 7l-4 4'
);

export const IcSave = d(
  'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z|M17 21v-7H7v7|M7 3v5h8'
);

export const IcSessions = d(
  'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z|M9 15h6|M9 18h4'
);

export const IcSettings = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
));

export const IcFullscreen = d(
  'M4 9V4h5|M15 4h5v5|M4 15v5h5|M15 20h5v-5'
);

export const IcExitFullscreen = d(
  'M9 4v5H4|M15 4v5h5|M9 20v-5H4|M15 20v-5h5'
);

export const IcIllumination = IcSun;

// ── Chevrons / collapse ─────────────────────────────────────

export const IcChevronRight = d('M9 18l6-6-6-6');

// ── Draw panel icons ────────────────────────────────────────

export const IcPalette = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="8" cy="9" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16" cy="9" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="8" cy="13" r="1.5" fill="currentColor" stroke="none" />
    <path d="M17 14a3 3 0 01-3 3 2 2 0 00-2 2v1" />
  </svg>
));

export const IcFlatPaint = d(
  'M12 3a9 9 0 100 18 9 9 0 000-18z|M12 3v9l6.36 3.64'
);

export const IcLitForm = d(
  'M13 2L3 14h9l-1 8 10-12h-9l1-8z'
);

export const IcGlow = d(
  'M12 15a3 3 0 100-6 3 3 0 000 6z|M12 3v2|M12 19v2|M5.64 5.64l1.41 1.41|M16.95 16.95l1.41 1.41|M3 12h2|M19 12h2|M5.64 18.36l1.41-1.41|M16.95 7.05l1.41-1.41|M8 12a4 4 0 018 0'
);

export const IcCutout = d(
  'M6 9l6 6|M12 9l-6 6|M20 4l-4 4|M20 4h-5|M20 4v5'
);

export const IcStar = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  </svg>
));

export const IcRuler = d(
  'M3 5l16 16|M19 5v16H3|M7 5v4|M11 5v2|M15 5v4'
);

export const IcCurve = d(
  'M3 20C3 10 10 4 21 4|M3 20h3|M21 4v3'
);

// ── Select panel icons ──────────────────────────────────────

export const IcLasso = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="11" rx="9" ry="8" strokeDasharray="4 3" />
    <circle cx="12" cy="19" r="2" />
    <path d="M12 17v-6" />
  </svg>
));

export const IcReset = d(
  'M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8|M21 3v5h-5|M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16|M3 21v-5h5'
);

export const IcSnapGround = d(
  'M12 5v10|M8 11l4 4 4-4|M4 19h16'
);

export const IcCopy = d(
  'M8 8h12v12H8z|M4 16V4h12'
);

export const IcDelete = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
));

export const IcLock = d(
  'M5 11V7a7 7 0 0114 0v4|M3 11h18v10a1 1 0 01-1 1H4a1 1 0 01-1-1V11z|M12 15v3'
);

export const IcUnlock = d(
  'M7 11V7a5 5 0 0110 0|M3 11h18v10a1 1 0 01-1 1H4a1 1 0 01-1-1V11z|M12 15v3'
);

export const IcEye = d(
  'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z|M12 15a3 3 0 100-6 3 3 0 000 6z'
);

export const IcEyeOff = d(
  'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94|M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19|M1 1l22 22|M14.12 14.12a3 3 0 11-4.24-4.24'
);

export const IcAxis = d(
  'M12 22V2|M22 12H2|M12 12l7-7'
);

export const IcRefresh = d(
  'M23 4v6h-6|M1 20v-6h6|M3.51 9a9 9 0 0114.85-3.36L23 10|M20.49 15a9 9 0 01-14.85 3.36L1 14'
);

export const IcCheck = d('M20 6L9 17l-5-5');

export const IcSparkle = d(
  'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z'
);

export const IcCompass = d(
  'M12 2a10 10 0 100 20 10 10 0 000-20z|M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z'
);

// ── Create panel icons (primitives) ─────────────────────────

export const IcCube = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
));

export const IcSphere = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <ellipse cx="12" cy="12" rx="4" ry="10" />
    <path d="M2 12h20" />
  </svg>
));

export const IcCylinder = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
  </svg>
));

export const IcTorus = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="12" rx="10" ry="4" />
    <path d="M6 12c0-2.21 1.34-4 3-4s3 1.79 3 4-1.34 4-3 4-3-1.79-3-4z" />
    <path d="M12 12c0-2.21 1.34-4 3-4s3 1.79 3 4-1.34 4-3 4-3-1.79-3-4z" />
  </svg>
));

export const IcCapsule = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 8a4 4 0 018 0v8a4 4 0 01-8 0V8z" />
    <path d="M8 12h8" />
  </svg>
));

export const IcCone = d(
  'M12 2L4 20h16z|M4 20c0-1.1 3.58-2 8-2s8 .9 8 2'
);

export const IcPyramid = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2L2 20h20z" />
    <path d="M12 2l8 18" />
    <path d="M12 2L4 20" />
    <path d="M12 2v18" />
  </svg>
));

export const IcDisk = df(({ className, strokeWidth }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="12" rx="10" ry="4" />
    <circle cx="12" cy="12" r="2" />
  </svg>
));

export const IcModelLibrary = d(
  'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z'
);

export const IcImport = d(
  'M12 16V3|M8 12l4 4 4-4|M20 21H4'
);

export const IcTexture = IcPalette;

export const IcClay = IcSparkle;

export const IcOrigin = d(
  'M12 2v4|M12 18v4|M2 12h4|M18 12h4|M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0'
);

// ── Deform panel icons ──────────────────────────────────────

export const IcMove = d(
  'M12 2v20|M2 12h20|M8 6l4-4 4 4|M16 18l-4 4-4-4|M6 8L2 12l4 4|M18 8l4 4-4 4'
);

export const IcGuide = d(
  'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z|M12 6v6l4 2'
);

export const IcMirror = d(
  'M12 2v20|M5 7h4v10H5|M15 7h4v10h-4'
);

export const IcSimplify = d(
  'M6 9l6 6|M12 9l-6 6|M14 4l6 6-6 6'
);

export const IcCamera = d(
  'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z|M12 17a4 4 0 100-8 4 4 0 000 8z'
);

export const IcBend = d(
  'M3 20c4-16 14-16 18 0'
);

export const IcArmature = d(
  'M12 4a2 2 0 100-4 2 2 0 000 4z|M12 4v7|M12 11l-6 5|M12 11l6 5|M6 16l-2 5|M6 16l2 5|M18 16l-2 5|M18 16l2 5'
);

export const IcMirrorSettings = d(
  'M12 2v20|M7 7l-4 5 4 5|M17 7l4 5-4 5'
);

export const IcAlignView = d(
  'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z|M12 17a4 4 0 100-8 4 4 0 000 8z'
);

export const IcSimplifySettings = d(
  'M4 21l16-16|M15 3h6v6|M10 14l-6 6'
);

export const IcQuickSimplify = d(
  'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z'
);

// ── Brush type icons (Sculpt presets) ───────────────────────

export const IcBrushClay = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M6 16c0-4 2-8 6-12 4 4 6 8 6 12a6 6 0 01-12 0z" />
    <path d="M9 17c0-1.5 1.3-3 3-3s3 1.5 3 3" />
  </svg>
));

export const IcBrushBuild = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M4 18h16" />
    <path d="M6 14h12" />
    <path d="M8 10h8" />
    <path d="M10 6h4" />
    <path d="M4 18l2-4m14 4l-2-4" />
    <path d="M6 14l2-4m8 4l2-4" />
    <path d="M8 10l2-4m4 4l2-4" />
  </svg>
));

export const IcBrushMove = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M4 16C6 10 10 6 16 4" />
    <path d="M12 4l4 0 0 4" />
    <path d="M20 20C18 14 14 10 8 8" />
  </svg>
));

export const IcBrushInflate = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v-2" />
    <path d="M12 22v-2" />
    <path d="M4 12H2" />
    <path d="M22 12h-2" />
    <path d="M6.34 6.34L5 5" />
    <path d="M19 19l-1.34-1.34" />
    <path d="M6.34 17.66L5 19" />
    <path d="M19 5l-1.34 1.34" />
  </svg>
));

export const IcBrushPinch = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M4 4l7 8-7 8" />
    <path d="M20 4l-7 8 7 8" />
    <path d="M12 8v8" />
  </svg>
));

export const IcBrushCrease = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M3 6l9 12L21 6" />
    <path d="M8 10l4 5 4-5" />
  </svg>
));

export const IcBrushFlatten = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M4 12h16" />
    <path d="M8 6l-4 6 4 6" />
    <path d="M16 6l4 6-4 6" />
    <path d="M7 8v8" />
    <path d="M17 8v8" />
  </svg>
));

export const IcBrushSmooth = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M3 12c2-4 5-6 9-6s7 2 9 6" />
    <path d="M3 12c2 4 5 6 9 6s7-2 9-6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
));

export const IcBrushRibbon = d(
  'M4 8c4-3 12-3 16 0|M4 16c4 3 12 3 16 0|M4 8v8|M20 8v8'
);

export const IcBrushTube = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <ellipse cx="6" cy="12" rx="3" ry="6" />
    <ellipse cx="18" cy="12" rx="3" ry="6" />
    <path d="M6 6h12" />
    <path d="M6 18h12" />
  </svg>
));

export const IcBrushMarker = d(
  'M4 20L14 4h6L10 20z|M14 4l6 0'
);

export const IcBrushWire = d(
  'M3 12h18|M3 10h18|M3 14h18'
);

export const IcBrushNeon = df(({ className, strokeWidth, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M4 12c2-6 6-8 8-8s6 2 8 8" />
    <path d="M4 12c2 6 6 8 8 8s6-2 8-8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
));

export const IcBrushStipple = df(({ className, style }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className} style={style}>
    <circle cx="6" cy="8" r="1.5" />
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="18" cy="8" r="1.5" />
    <circle cx="4" cy="14" r="1.5" />
    <circle cx="10" cy="12" r="1.5" />
    <circle cx="16" cy="11" r="1.5" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="14" cy="17" r="1.5" />
    <circle cx="20" cy="15" r="1.5" />
  </svg>
));

export const BRUSH_ICON_MAP: Record<string, React.FC<IP>> = {
  clay: IcBrushClay,
  build: IcBrushBuild,
  move: IcBrushMove,
  inflate: IcBrushInflate,
  pinch: IcBrushPinch,
  crease: IcBrushCrease,
  flatten: IcBrushFlatten,
  smooth: IcBrushSmooth,
  streamline_ink: IcBrushRibbon,
  spatial_pipe: IcBrushTube,
  chisel_marker: IcBrushMarker,
  drafting_wire: IcBrushWire,
  neon_cable: IcBrushNeon,
  stipple_texture: IcBrushStipple,
};
