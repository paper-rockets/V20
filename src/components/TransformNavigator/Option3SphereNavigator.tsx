import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { StudioEngine } from '../../core/studioEngine';
import { TransformTargetScope } from '../../types';
import { useUiMode } from '../../core/uiModeStore';
import './navigatorStyles.css';

export interface Option3SphereNavigatorProps {
  engine?: StudioEngine | null;
  theme?: 'light' | 'dark';
  uiMode?: 'play' | 'pro';
  targetScope?: TransformTargetScope;
  onSelectTargetScope?: (scope: TransformTargetScope) => void;
  isLocked?: boolean;
  onLockChange?: (locked: boolean) => void;
  onClose?: () => void;
  uiScale?: number;
  layers?: any[];
  activeLayerId?: string | null;
  onSelectLayer?: (id: string) => void;
  models?: any[];
  activeModelId?: string | null;
  onSelectModel?: (id: string) => void;
}

interface TargetItem {
  id: string;
  name: string;
  note?: string;
  object: THREE.Object3D;
  home?: { p: THREE.Vector3; q: THREE.Quaternion };
}

interface AxisDef {
  dir: [number, number, number];
  lbl: string;
  back: string;
  tone: string;
}

const PLAY_AXES: AxisDef[] = [
  { dir: [0, 1, 0], lbl: 'Up', back: 'Down', tone: '#e0822a' },
  { dir: [1, 0, 0], lbl: 'Side', back: 'Side', tone: '#2f80c4' },
  { dir: [0, 0, 1], lbl: 'Front', back: 'Back', tone: '#3f9a62' }
];

const PRO_AXES: AxisDef[] = [
  { dir: [0, 1, 0], lbl: 'Y', back: '−Y', tone: '#5d9e35' },
  { dir: [1, 0, 0], lbl: 'X', back: '−X', tone: '#c84356' },
  { dir: [0, 0, 1], lbl: 'Z', back: '−Z', tone: '#3775cc' }
];

const ROT_STEPS = [
  { v: 0, lbl: 'Free' },
  { v: 5, lbl: '5°' },
  { v: 15, lbl: '15°' },
  { v: 45, lbl: '45°' }
];
const MOVE_STEPS = [
  { v: 0, lbl: 'Free' },
  { v: 0.25, lbl: '0.25' },
  { v: 0.5, lbl: '0.5' },
  { v: 1, lbl: '1' }
];

const DEG = Math.PI / 180;
const CROP = 0.055;
const MIN_RAD = 0.55;
const STORE = 'nv.layout.v1';

export const Option3SphereNavigator: React.FC<Option3SphereNavigatorProps> = ({
  engine,
  theme = 'dark',
  uiMode,
  layers = [],
  activeLayerId,
  onSelectLayer,
  models = [],
  activeModelId,
  onSelectModel,
}) => {
  const storeUiMode = useUiMode();
  const effectiveUiMode: 'play' | 'pro' = uiMode || storeUiMode || 'play';
  const isPro = effectiveUiMode === 'pro';

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isListOpen, setIsListOpen] = useState<boolean>(false);
  const [targetsList, setTargetsList] = useState<TargetItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [mode, setModeState] = useState<'move' | 'rotate' | 'look'>('look');
  const [rotStep, setRotStep] = useState<number>(15);
  const [moveStep, setMoveStep] = useState<number>(0.5);
  const [historyLen, setHistoryLen] = useState<number>(0);
  const [isTourRunning, setIsTourRunning] = useState<boolean>(false);

  const nvRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const tabRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const numRef = useRef<HTMLDivElement | null>(null);

  const axesRef = useRef<AxisDef[]>((isPro ? PRO_AXES : PLAY_AXES).map(a => ({ ...a })));

  // Mutable math state (exact mirror of Build 9 reference script)
  const gzRef = useRef({
    size: 210,
    mode: 'look' as 'move' | 'rotate' | 'look',
    rotStep: 15,
    moveStep: 0.5,
    active: null as any,
    hover: null as any,
    ring: null as any,
  });

  const objRef = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() });
  const dispRef = useRef({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() });
  const targetObjRef = useRef<THREE.Object3D | null>(null);
  const targetsRef = useRef<TargetItem[]>([]);
  const currentRef = useRef<number>(0);
  const anchorRef = useRef({ ax: 1, ay: 1 });

  const camRef = useRef({
    radius: 11,
    theta: 0.78,
    phi: 1.05,
    target: new THREE.Vector3(0, 1.1, 0)
  });

  const selBoxRef = useRef(new THREE.Box3());
  const localBoxRef = useRef(new THREE.Box3());
  const outlineRef = useRef<THREE.Box3Helper | null>(null);
  const historyRef = useRef<Array<{ o: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion }>>([]);
  const flightRef = useRef<{ p0: number; t0: number; p1: number; t1: number; start: number; ms: number } | null>(null);
  const tourRef = useRef<any>(null);
  const themeRef = useRef<any>({
    up: '#e0822a',
    side: '#2f80c4',
    front: '#3f9a62',
    ghost: 'rgba(51,46,40,.26)',
    hub: 'rgba(255,255,255,.96)',
    ink: '#332e28',
    shadow: 'rgba(51,46,40,.20)',
    onColor: '#ffffff',
    line: 'rgba(51,46,40,.13)'
  });
  const lastStepRef = useRef<any>(null);
  const dragRef = useRef<any>(null);
  const hintTimerRef = useRef<any>(null);
  const reduceMotionRef = useRef<boolean>(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Theme checking
  const isDark = useCallback(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    const root = document.documentElement;
    const forced = root.dataset.nvTheme;
    if (forced === 'dark') return true;
    if (forced === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [theme]);

  const readTheme = useCallback(() => {
    const nvEl = nvRef.current || document.getElementById('nv');
    if (!nvEl) return;
    const cs = getComputedStyle(nvEl);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    const dark = isDark();

    if (isPro) {
      themeRef.current = {
        up: v('--nv-y') || (dark ? '#84c94f' : '#5d9e35'),
        side: v('--nv-x') || (dark ? '#e8697c' : '#c84356'),
        front: v('--nv-z') || (dark ? '#5e9ff0' : '#3775cc'),
        accent: v('--nv-accent') || (dark ? '#5e9ff0' : '#3775cc'),
        ghost: v('--nv-ghost') || (dark ? 'rgba(242,237,230,.32)' : 'rgba(51,46,40,.26)'),
        hub: v('--nv-hub') || (dark ? 'rgba(46,44,41,.96)' : 'rgba(255,255,255,.96)'),
        ink: v('--nv-ink') || (dark ? '#f2ede6' : '#332e28'),
        shadow: dark ? 'rgba(0,0,0,0.55)' : 'rgba(51,46,40,0.28)',
        onColor: v('--nv-btn-on') || (dark ? 'rgba(255,255,255,.16)' : '#ffffff'),
        line: v('--nv-line') || (dark ? 'rgba(255,255,255,.14)' : 'rgba(51,46,40,.13)')
      };
    } else {
      themeRef.current = {
        up: v('--nv-up') || (dark ? '#f0a154' : '#e0822a'),
        side: v('--nv-side') || (dark ? '#63a9e4' : '#2f80c4'),
        front: v('--nv-front') || (dark ? '#5cba84' : '#3f9a62'),
        accent: v('--nv-up') || (dark ? '#f0a154' : '#e0822a'),
        ghost: v('--nv-ghost') || (dark ? 'rgba(242,237,230,.32)' : 'rgba(51,46,40,.26)'),
        hub: v('--nv-hub') || (dark ? 'rgba(46,44,41,.96)' : 'rgba(255,255,255,.96)'),
        ink: v('--nv-ink') || (dark ? '#f2ede6' : '#332e28'),
        shadow: dark ? 'rgba(0,0,0,0.55)' : 'rgba(51,46,40,0.28)',
        onColor: v('--nv-btn-on') || (dark ? 'rgba(255,255,255,.16)' : '#ffffff'),
        line: v('--nv-line') || (dark ? 'rgba(255,255,255,.14)' : 'rgba(51,46,40,.13)')
      };
    }

    if (axesRef.current && axesRef.current.length >= 3) {
      axesRef.current[0].tone = themeRef.current.up;
      axesRef.current[1].tone = themeRef.current.side;
      axesRef.current[2].tone = themeRef.current.front;
    }

    if (outlineRef.current) {
      (outlineRef.current.material as THREE.LineBasicMaterial).color.set(dark ? 0xf2ede6 : 0x332e28);
    }
  }, [isDark, isPro]);

  // Safe area metrics
  const cssPx = (n: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
  const safeBox = useCallback(() => {
    const g = cssPx('--nv-gap') || 10;
    return {
      left: (cssPx('--nv-left') || 62) + g,
      top: (cssPx('--nv-top') || 62) + g,
      right: window.innerWidth - (cssPx('--nv-right') || 8) - g,
      bottom: window.innerHeight - (cssPx('--nv-bottom') || 30) - g
    };
  }, []);

  const span = useCallback(() => {
    const s = safeBox();
    const dock = dockRef.current;
    const dw = dock ? dock.offsetWidth : 210;
    const dh = dock ? dock.offsetHeight : 210;
    return { s, w: Math.max(1, s.right - s.left - dw), h: Math.max(1, s.bottom - s.top - dh) };
  }, [safeBox]);

  const positionMenu = useCallback(() => {
    const nv = nvRef.current;
    const dock = dockRef.current;
    const menu = menuRef.current;
    if (!nv || !dock || !menu) return;
    if (nv.dataset.menu !== 'open') return;

    const s = safeBox();
    menu.style.maxHeight = Math.max(160, s.bottom - s.top) + 'px';
    const r = dock.getBoundingClientRect();
    const w = menu.offsetWidth || 198;
    const h = menu.offsetHeight || 380;
    const gap = 8;

    const cy = Math.max(s.top, Math.min(s.bottom - h, r.top + r.height / 2 - h / 2));
    const cx = Math.max(s.left, Math.min(s.right - w, r.left + r.width / 2 - w / 2));
    const right = { x: r.right + gap, y: cy, axis: 'x' };
    const left = { x: r.left - w - gap, y: cy, axis: 'x' };
    const below = { x: cx, y: r.bottom + gap, axis: 'y' };
    const above = { x: cx, y: r.top - h - gap, axis: 'y' };

    const order: any[] = [];
    order.push((r.left + r.width / 2) > window.innerWidth / 2 ? left : right);
    order.push(order[0] === left ? right : left);
    order.push((r.top + r.height / 2) > window.innerHeight / 2 ? above : below);
    order.push(order[2] === above ? below : above);

    const fits = (p: any) => p.axis === 'x'
      ? (p.x >= s.left && p.x + w <= s.right && h <= s.bottom - s.top)
      : (p.y >= s.top && p.y + h <= s.bottom && w <= s.right - s.left);

    const pick = order.find(fits) || order[0];
    const x = Math.max(s.left, Math.min(s.right - w, pick.x));
    const y = Math.max(s.top, Math.min(s.bottom - h, pick.y));
    menu.style.left = Math.round(x) + 'px';
    menu.style.top = Math.round(y) + 'px';

    nv.classList.toggle('nv-covered',
      !(x + w < r.left || x > r.right || y + h < r.top || y > r.bottom));
  }, [safeBox]);

  const saveLayout = useCallback(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        ax: +anchorRef.current.ax.toFixed(4),
        ay: +anchorRef.current.ay.toFixed(4),
        mode: gzRef.current.mode,
        rotStep: gzRef.current.rotStep,
        moveStep: gzRef.current.moveStep
      }));
    } catch (_) {}
  }, []);

  const place = useCallback((x: number, y: number, remember?: boolean) => {
    const dock = dockRef.current;
    if (!dock) return;
    const { s, w, h } = span();
    const left = Math.max(s.left, Math.min(s.right - dock.offsetWidth, x));
    const top = Math.max(s.top, Math.min(s.bottom - dock.offsetHeight, y));
    dock.style.left = Math.round(left) + 'px';
    dock.style.top = Math.round(top) + 'px';
    if (remember) {
      anchorRef.current = { ax: (left - s.left) / w, ay: (top - s.top) / h };
      saveLayout();
    }
    positionMenu();
  }, [span, saveLayout, positionMenu]);

  const placeFromAnchor = useCallback(() => {
    const { s, w, h } = span();
    place(s.left + anchorRef.current.ax * w, s.top + anchorRef.current.ay * h);
  }, [span, place]);

  const setMenu = useCallback((open: boolean) => {
    setIsMenuOpen(open);
    const nv = nvRef.current;
    const tab = tabRef.current;
    if (nv) nv.dataset.menu = open ? 'open' : 'closed';
    if (tab) tab.setAttribute('aria-expanded', String(open));
    if (open) {
      requestAnimationFrame(positionMenu);
    } else {
      nv?.classList.remove('nv-covered');
      setIsListOpen(false);
    }
  }, [positionMenu]);

  // Outline for active target
  const markSelection = useCallback(() => {
    const targetObj = targetObjRef.current;
    const outline = outlineRef.current;
    if (!targetObj || !outline) {
      if (outline) outline.visible = false;
      return;
    }
    targetObj.updateWorldMatrix(true, false);
    localBoxRef.current.setFromObject(targetObj);
    if (localBoxRef.current.isEmpty()) {
      outline.visible = false;
      return;
    }
    targetObj.worldToLocal(localBoxRef.current.min);
    targetObj.worldToLocal(localBoxRef.current.max);
    selBoxRef.current.copy(localBoxRef.current).applyMatrix4(targetObj.matrixWorld).expandByScalar(0.09);
    outline.visible = true;
    engine?.markDirty();
  }, [engine]);

  // Target sync
  const syncFromTarget = useCallback(() => {
    const targetObj = targetObjRef.current;
    if (!targetObj) return;
    targetObj.updateWorldMatrix(true, false);
    targetObj.getWorldPosition(objRef.current.pos);
    targetObj.getWorldQuaternion(objRef.current.quat);
    dispRef.current.pos.copy(objRef.current.pos);
    dispRef.current.quat.copy(objRef.current.quat);
  }, []);

  const commit = useCallback(() => {
    const targetObj = targetObjRef.current;
    if (!targetObj) return;
    const p = targetObj.parent;
    if (p) {
      p.updateWorldMatrix(true, false);
      targetObj.position.copy(p.worldToLocal(dispRef.current.pos.clone()));
      targetObj.quaternion.copy(
        p.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(dispRef.current.quat)
      );
    } else {
      targetObj.position.copy(dispRef.current.pos);
      targetObj.quaternion.copy(dispRef.current.quat);
    }
    targetObj.updateMatrixWorld(true);
    markSelection();
    engine?.markDirty();
  }, [markSelection, engine]);

  const jumpDisplay = useCallback(() => {
    dispRef.current.pos.copy(objRef.current.pos);
    dispRef.current.quat.copy(objRef.current.quat);
    commit();
  }, [commit]);

  const easeDisplay = useCallback((dt: number) => {
    const gz = gzRef.current;
    if (reduceMotionRef.current || !(gz.rotStep || gz.moveStep)) {
      jumpDisplay();
      return false;
    }
    const near = dispRef.current.pos.distanceToSquared(objRef.current.pos) < 1e-7 &&
                 1 - Math.abs(dispRef.current.quat.dot(objRef.current.quat)) < 1e-8;
    if (near) {
      if (!dispRef.current.pos.equals(objRef.current.pos) || !dispRef.current.quat.equals(objRef.current.quat)) {
        jumpDisplay();
        return true;
      }
      return false;
    }
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 20);
    dispRef.current.pos.lerp(objRef.current.pos, k);
    dispRef.current.quat.slerp(objRef.current.quat, k);
    commit();
    return true;
  }, [jumpDisplay, commit]);

  // Build 9 Metrics
  const metrics = (S: number) => ({
    S,
    c: S / 2,
    arm: S * 0.235,
    hand: S * 0.102,
    hub: S * 0.072
  });

  const fitGizmo = (size: number) => {
    const gzc = canvasRef.current;
    const dock = dockRef.current;
    if (!gzc) return;
    const gctx = gzc.getContext('2d');
    if (!gctx) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const h = Math.round(size * (1 - CROP * 2));
    gzc.style.width = size + 'px';
    gzc.style.height = h + 'px';
    gzc.width = Math.round(size * dpr);
    gzc.height = Math.round(h * dpr);
    gctx.setTransform(dpr, 0, 0, dpr, 0, -size * CROP * dpr);
    gzc.style.clipPath = 'circle(' + Math.round(size * 0.47) + 'px at 50% 50%)';
    (gzc.style as any).webkitClipPath = gzc.style.clipPath;
    if (dock) dock.style.width = size + 'px';
  };

  const axisDir = (a: AxisDef) => {
    const v = new THREE.Vector3(a.dir[0], a.dir[1], a.dir[2]);
    if (gzRef.current.mode !== 'look') v.applyQuaternion(dispRef.current.quat);
    return v.normalize();
  };

  const project = useCallback((v: THREE.Vector3, m: ReturnType<typeof metrics>) => {
    const cam = camRef.current;
    const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
    const st = Math.sin(cam.theta), ct = Math.cos(cam.theta);
    const sx = v.x * ct + v.z * -st;
    const sy = v.x * (-cp * st) + v.y * sp + v.z * (-cp * ct);
    const depth = v.x * (sp * st) + v.y * cp + v.z * (sp * ct);
    const len = Math.hypot(sx, sy);
    const draw = Math.max(len, MIN_RAD);
    const k = len < 1e-6 ? 0 : draw / len;
    const rad = m.arm * draw;
    return { x: m.c + sx * m.arm * k, y: m.c - sy * m.arm * k, depth, len, rad };
  }, []);

  const handles = useCallback((m: ReturnType<typeof metrics>) => {
    const out: any[] = [];
    const axes = axesRef.current || PLAY_AXES;
    axes.forEach((a, i) => {
      const d = axisDir(a);
      out.push({ a, i, sign: 1, dir: d, p: project(d, m) });
      const n = d.clone().negate();
      out.push({ a, i, sign: -1, dir: n, p: project(n, m) });
    });
    return out;
  }, [project]);

  const labelFont = (ctx: CanvasRenderingContext2D, text: string, r: number) => {
    let size = r * 0.66;
    const fam = getComputedStyle(document.body).fontFamily || 'sans-serif';
    for (let i = 0; i < 6; i++) {
      ctx.font = '600 ' + size.toFixed(1) + 'px ' + fam;
      if (ctx.measureText(text).width <= r * 1.62) break;
      size *= 0.9;
    }
  };

  const hubIcon = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
    const T = themeRef.current;
    ctx.save();
    ctx.strokeStyle = T.ink; ctx.fillStyle = T.ink; ctx.lineWidth = 1.5;
    if (gzRef.current.mode === 'move') {
      for (let k = 0; k < 4; k++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.86, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r * 0.6, -r * 0.32); ctx.lineTo(r * 0.6, r * 0.32);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    } else if (gzRef.current.mode === 'rotate') {
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, -2.5, 1.7); ctx.stroke();
      const ax = cx + Math.cos(1.7) * r * 0.82, ay = cy + Math.sin(1.7) * r * 0.82;
      ctx.beginPath();
      ctx.moveTo(ax + 3.6, ay - 0.4); ctx.lineTo(ax - 1.5, ay + 3.6); ctx.lineTo(ax - 2.8, ay - 2.6);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  };

  const pulse = (ctx: CanvasRenderingContext2D, m: ReturnType<typeof metrics>, now?: number) => {
    const gz = gzRef.current;
    const t = ((now || performance.now()) % 1100) / 1100;
    let x = m.c, y = m.c, r0 = m.hub * 1.4;
    if (gz.ring.type === 'axis') {
      const h = handles(m).filter((k: any) => k.i === gz.ring.i && k.sign === 1)[0];
      if (h) { x = h.p.x; y = h.p.y; r0 = m.hand * 1.4; }
    }
    ctx.save();
    ctx.strokeStyle = themeRef.current.ink;
    ctx.globalAlpha = 0.5 * (1 - t);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(x, y, r0 + t * m.hand * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  const paint = useCallback((ctx: CanvasRenderingContext2D, m: ReturnType<typeof metrics>, live: boolean, now?: number) => {
    const gz = gzRef.current;
    const T = themeRef.current;
    ctx.clearRect(-2, -2, m.S + 4, m.S + 4);
    const hs = handles(m).sort((p: any, q: any) => p.p.depth - q.p.depth);

    ctx.save();
    ctx.shadowColor = T.shadow;
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 1.5;

    hs.forEach((h: any) => {
      const front = h.p.depth >= -0.04;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(m.c, m.c);
      ctx.lineTo(h.p.x, h.p.y);
      if (h.sign > 0 && front) { ctx.strokeStyle = h.a.tone; ctx.lineWidth = 3; }
      else { ctx.strokeStyle = T.ghost; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); }
      ctx.stroke();
      ctx.restore();
    });

    // ghosts and back-facing dots first
    hs.forEach((h: any) => {
      const front = h.p.depth >= -0.04;
      if (h.sign > 0 && front) return;
      const on = live && gz.active && gz.active.type === 'axis' && gz.active.i === h.i && gz.active.sign === h.sign;
      const hov = live && gz.hover && gz.hover.i === h.i && gz.hover.sign === h.sign;
      ctx.beginPath();
      ctx.arc(h.p.x, h.p.y, m.hand * (h.sign < 0 ? 0.58 : 0.72), 0, Math.PI * 2);
      ctx.fillStyle = (on || hov) ? T.ink : T.ghost;
      ctx.fill();
    });

    // the hub goes UNDER the live handles, so it can never hide one
    ctx.beginPath();
    ctx.arc(m.c, m.c, m.hub, 0, Math.PI * 2);
    ctx.fillStyle = T.hub;
    ctx.fill();
    ctx.strokeStyle = live && gz.active && gz.active.type === 'hub' ? T.ink : T.ghost;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();

    hubIcon(ctx, m.c, m.c, m.hub * 0.72);

    ctx.save();
    ctx.shadowColor = T.shadow;
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 1.5;

    hs.forEach((h: any) => {
      const front = h.p.depth >= -0.04;
      if (!(h.sign > 0 && front)) return;
      const on = live && gz.active && gz.active.type === 'axis' && gz.active.i === h.i && gz.active.sign === h.sign;
      const hov = live && gz.hover && gz.hover.i === h.i && gz.hover.sign === h.sign;

      if (h.p.len > (gz.mode === 'rotate' ? 0.34 : 0.22)) {
        const ux = (h.p.x - m.c) / h.p.rad, uy = (h.p.y - m.c) / h.p.rad;
        ctx.save();
        ctx.translate(h.p.x, h.p.y);
        ctx.rotate(Math.atan2(uy, ux));
        ctx.fillStyle = h.a.tone; ctx.strokeStyle = h.a.tone;
        if (gz.mode === 'rotate') {
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(0, 0, m.hand * 1.4, -0.92, 0.92);
          ctx.stroke();
          const ax = Math.cos(0.92) * m.hand * 1.4, ay = Math.sin(0.92) * m.hand * 1.4;
          ctx.beginPath();
          ctx.moveTo(ax + 3.6, ay + 1.2); ctx.lineTo(ax - 3, ay + 3.8); ctx.lineTo(ax - 1.2, ay - 2.9);
          ctx.closePath(); ctx.fill();
        } else {
          const base = m.hand * 1.02, wide = m.hand * 0.56;
          ctx.beginPath();
          ctx.moveTo(base + m.hand * 0.98, 0);
          ctx.lineTo(base, -wide);
          ctx.lineTo(base, wide);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(h.p.x, h.p.y, m.hand * (on || hov ? 1.08 : 1), 0, Math.PI * 2);
      ctx.fillStyle = h.a.tone;
      ctx.fill();
      if (on || hov) {
        ctx.strokeStyle = T.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.p.x, h.p.y, m.hand * 1.36, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      labelFont(ctx, h.a.lbl, m.hand);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.a.lbl, h.p.x, h.p.y + 0.5);
    });
    ctx.restore();

    if (live && gz.ring) pulse(ctx, m, now);
  }, [handles]);

  const drawGizmo = useCallback((now?: number) => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) paint(ctx, metrics(gzRef.current.size), true, now);
    }
  }, [paint]);

  const applyObject = useCallback(() => {
    if (reduceMotionRef.current || !(gzRef.current.rotStep || gzRef.current.moveStep)) jumpDisplay();
    const e = new THREE.Euler().setFromQuaternion(objRef.current.quat, 'YXZ');
    if (numRef.current) {
      numRef.current.innerHTML =
        '<i>pos</i><b>' + objRef.current.pos.x.toFixed(2) + '</b><b>' + objRef.current.pos.y.toFixed(2) + '</b><b>' + objRef.current.pos.z.toFixed(2) + '</b>' +
        '<i>rot</i><b>' + Math.round(e.x / DEG) + '°</b><b>' + Math.round(e.y / DEG) + '°</b><b>' + Math.round(e.z / DEG) + '°</b>';
    }
    drawGizmo();
  }, [jumpDisplay, drawGizmo]);

  const applyCamera = useCallback(() => {
    const cam = camRef.current;
    if (engine) {
      engine.setCameraView(cam.theta, cam.phi, cam.radius, true);
      engine.cameraTarget.copy(cam.target);
      engine.markDirty();
    }
    drawGizmo();
  }, [engine, drawGizmo]);

  // Labels and hints
  const idleHint = useCallback(() => {
    if (tourRef.current) return;
    const el = labelRef.current;
    if (!el) return;
    el.classList.remove('nv-live');
    const targets = targetsRef.current;
    const current = currentRef.current;
    const what = targets[current] ? targets[current].name : '—';
    if (gzRef.current.mode === 'look') {
      el.innerHTML = '';
      return;
    }
    if (isPro) {
      el.innerHTML = '<b>' + what + '</b> · ' + (gzRef.current.mode === 'move' ? 'move' : 'rotate');
    } else {
      el.innerHTML = (gzRef.current.mode === 'move' ? 'moving' : 'turning') + ' <b>' + what + '</b>';
    }
  }, [isPro]);

  const say = useCallback((text: string, live?: boolean) => {
    if (gzRef.current.mode === 'look' && !tourRef.current) return;
    const el = labelRef.current;
    if (!el) return;
    el.innerHTML = text;
    el.classList.toggle('nv-live', !!live);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    if (live) hintTimerRef.current = setTimeout(idleHint, 1600);
  }, [idleHint]);

  const snap = (v: number, step: number) => Math.round(v / step) * step;

  const clampPos = () => {
    objRef.current.pos.x = Math.max(-12, Math.min(12, objRef.current.pos.x));
    objRef.current.pos.y = Math.max(-3, Math.min(9, objRef.current.pos.y));
    objRef.current.pos.z = Math.max(-12, Math.min(12, objRef.current.pos.z));
  };

  const tick = (step: any) => {
    if (lastStepRef.current === step) return;
    lastStepRef.current = step;
    if (navigator.vibrate) { try { navigator.vibrate(4); } catch (_) {} }
  };

  const camBasis = () => {
    const camera = engine?.getCamera();
    if (camera) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      return { right, up };
    }
    const cam = camRef.current;
    const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
    const st = Math.sin(cam.theta), ct = Math.cos(cam.theta);
    return { right: new THREE.Vector3(ct, 0, -st), up: new THREE.Vector3(-cp * st, sp, -cp * ct) };
  };

  const unitsPerPixel = () => {
    const camera = engine?.getCamera();
    const H = window.innerHeight || 900;
    if (camera && camera instanceof THREE.PerspectiveCamera) {
      const targetPos = new THREE.Vector3();
      if (targetObjRef.current) targetObjRef.current.getWorldPosition(targetPos);
      else targetPos.copy(camRef.current.target);
      const distanceToTarget = camera.position.distanceTo(targetPos) || camRef.current.radius || 10;
      return (2 * distanceToTarget * Math.tan((camera.fov * DEG) / 2)) / H;
    }
    return (2 * camRef.current.radius * Math.tan((46 * DEG) / 2)) / H;
  };

  const pushHistory = () => {
    const targetObj = targetObjRef.current;
    if (!targetObj) return;
    historyRef.current.push({ o: targetObj, p: objRef.current.pos.clone(), q: objRef.current.quat.clone() });
    if (historyRef.current.length > 40) historyRef.current.shift();
    setHistoryLen(historyRef.current.length);
  };

  const undo = () => {
    const s = historyRef.current.pop();
    if (!s) return;
    if (s.o !== targetObjRef.current) {
      const idx = targetsRef.current.findIndex(t => t.object === s.o);
      if (idx >= 0) selectTarget(idx, true);
    }
    objRef.current.pos.copy(s.p);
    objRef.current.quat.copy(s.q);
    applyObject();
    setHistoryLen(historyRef.current.length);
    say(isPro ? 'undo' : 'Undone', true);
  };

  const flyTo = (phi: number, theta: number, ms?: number) => {
    const cam = camRef.current;
    let t = theta;
    while (t - cam.theta > Math.PI) t -= Math.PI * 2;
    while (t - cam.theta < -Math.PI) t += Math.PI * 2;
    const p1 = Math.max(0.06, Math.min(Math.PI - 0.06, phi));
    if (reduceMotionRef.current) {
      cam.phi = p1; cam.theta = t;
      applyCamera();
      return;
    }
    flightRef.current = { p0: cam.phi, t0: cam.theta, p1, t1: t, start: performance.now(), ms: ms || 500 };
  };

  const stepFlight = (now: number) => {
    const flight = flightRef.current;
    if (!flight) return;
    const k = Math.min(1, (now - flight.start) / flight.ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camRef.current.phi = flight.p0 + (flight.p1 - flight.p0) * e;
    camRef.current.theta = flight.t0 + (flight.t1 - flight.t0) * e;
    applyCamera();
    if (k >= 1) flightRef.current = null;
  };

  const faceDirection = (dir: THREE.Vector3, label?: string) => {
    const d = dir.clone().normalize();
    flyTo(Math.acos(Math.max(-1, Math.min(1, d.y))), Math.atan2(d.x, d.z));
    if (label) say(isPro ? ('view · ' + label) : ('Looking from the ' + label.toLowerCase() + ' side'), true);
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
  };

  const gzPoint = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
    const gzc = canvasRef.current;
    if (!gzc) return { x: 0, y: 0 };
    const r = gzc.getBoundingClientRect();
    const k = gzRef.current.size / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k + gzRef.current.size * CROP };
  };

  const pickHandle = (pt: { x: number; y: number }) => {
    const m = metrics(gzRef.current.size);
    const near: any[] = [];
    handles(m).forEach((h: any) => {
      const d = Math.hypot(pt.x - h.p.x, pt.y - h.p.y);
      if (d < m.hand * (h.sign > 0 ? 1.8 : 1.45)) near.push({ h, d, front: h.p.depth >= -0.04 });
    });
    if (!near.length) return null;
    near.sort((a: any, b: any) => a.d - b.d);
    const tie = near.find((c: any) => c.front && c.d <= near[0].d + m.hand * 0.4);
    return (tie || near[0]).h;
  };

  const setMode = (m: 'move' | 'rotate' | 'look') => {
    gzRef.current.mode = m;
    setModeState(m);
    if (nvRef.current) nvRef.current.dataset.mode = m;
    idleHint();
    drawGizmo();
    saveLayout();
  };

  const setOrient = (pitch: number, roll: number, label: string) => {
    stopTour(); pushHistory();
    const e = new THREE.Euler().setFromQuaternion(objRef.current.quat, 'YXZ');
    objRef.current.quat.setFromEuler(new THREE.Euler(pitch * DEG, e.y, roll * DEG, 'YXZ'));
    applyObject(); say(label, true);
  };

  const lookAtIt = () => {
    stopTour();
    camRef.current.target.copy(objRef.current.pos);
    faceDirection(new THREE.Vector3(0, 1, 0).applyQuaternion(objRef.current.quat), '');
    say(isPro ? 'framed' : 'Looking straight at it', true);
  };

  const resetTarget = () => {
    stopTour(); pushHistory();
    const targets = targetsRef.current;
    const current = currentRef.current;
    const targetObj = targetObjRef.current;
    const home = targets[current] && targets[current].home;
    if (home && targetObj) {
      targetObj.position.copy(home.p);
      targetObj.quaternion.copy(home.q);
    }
    syncFromTarget();
    camRef.current.target.copy(objRef.current.pos);
    applyObject(); applyCamera();
    say(isPro ? 'reset' : ((targets[current] ? targets[current].name : 'It') + ' back to the start'), true);
  };

  const TOUR_PLAY = [
    { t: 0, dur: 4200, ring: { type: 'axis', i: 0 }, cap: 'Drag the orange arrow to lift it up.' },
    { t: 4200, dur: 4200, ring: { type: 'axis', i: 1 }, cap: 'Tap a dot to look from that side. Tapping never moves it.' },
    { t: 8400, dur: 4600, ring: { type: 'hub' }, cap: 'Tap the middle circle to switch to Turn.' },
    { t: 13000, dur: 2200, ring: null, cap: 'Your turn. Undo fixes anything.' }
  ];

  const TOUR_PRO = [
    { t: 0, dur: 3600, ring: { type: 'axis', i: 0 }, cap: 'Drag an axis to constrain the transform to it.' },
    { t: 3600, dur: 3600, ring: { type: 'axis', i: 1 }, cap: 'Tap an axis to snap the view down it — tapping never transforms.' },
    { t: 7200, dur: 4000, ring: { type: 'hub' }, cap: 'Tap the hub to cycle Orbit · Move · Rotate.' },
    { t: 11200, dur: 1800, ring: null, cap: 'Hold Shift, or set snap to Free, for unconstrained drags.' }
  ];

  const stopTour = () => {
    const tour = tourRef.current;
    if (!tour) return;
    const s = tour.save;
    objRef.current.pos.copy(s.pos);
    objRef.current.quat.copy(s.quat);
    camRef.current.phi = s.phi;
    camRef.current.theta = s.theta;
    flightRef.current = null;
    gzRef.current.ring = null;
    tourRef.current = null;
    setIsTourRunning(false);
    setMode(s.mode);
    applyObject(); applyCamera(); idleHint();
  };

  const startTour = () => {
    stopTour();
    tourRef.current = {
      start: performance.now(),
      step: -1,
      save: {
        pos: objRef.current.pos.clone(),
        quat: objRef.current.quat.clone(),
        phi: camRef.current.phi,
        theta: camRef.current.theta,
        mode: gzRef.current.mode
      }
    };
    setMode('move');
    setMenu(false);
    setIsTourRunning(true);
  };

  const stepTour = (now: number) => {
    const tour = tourRef.current;
    if (!tour) return;
    const activeTour = isPro ? TOUR_PRO : TOUR_PLAY;
    const el = Math.max(0, now - tour.start);
    let idx = 0;
    for (let i = 0; i < activeTour.length; i++) if (el >= activeTour[i].t) idx = i;
    const last = activeTour[activeTour.length - 1];
    if (el > last.t + last.dur) { stopTour(); return; }

    if (idx !== tour.step) {
      tour.step = idx;
      const s = activeTour[idx];
      gzRef.current.ring = s.ring;
      const label = labelRef.current;
      if (label) {
        label.textContent = s.cap;
        label.classList.add('nv-live');
      }
      if (idx === 1) {
        const h = handles(metrics(gzRef.current.size)).filter((k: any) => k.i === 1 && k.sign === 1)[0];
        if (h) faceDirection(h.dir, '');
      }
      if (idx === 2) setMode('rotate');
      if (idx === 3) { setMode('move'); flyTo(tour.save.phi, tour.save.theta, 600); }
    }
    const s = activeTour[idx];
    const wave = Math.sin(Math.min(1, (el - s.t) / s.dur * 1.25) * Math.PI);
    if (idx === 0) {
      objRef.current.pos.copy(tour.save.pos);
      objRef.current.pos.y = tour.save.pos.y + wave * 1.6;
      applyObject();
    } else if (idx === 2) {
      objRef.current.quat.copy(tour.save.quat).premultiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wave * 50 * DEG)
      );
      applyObject();
    }
    drawGizmo(now);
  };

  const selectTarget = useCallback((i: number, quiet?: boolean) => {
    const targets = targetsRef.current;
    if (i < 0 || !targets[i]) return;
    currentRef.current = i;
    setCurrentIdx(i);
    targetObjRef.current = targets[i].object;
    syncFromTarget();
    jumpDisplay();
    markSelection();
    applyObject();
    setMenu(false);
    if (!quiet) {
      if (isPro) say('target · <b>' + targets[i].name + '</b>', true);
      else say('now moving <b>' + targets[i].name + '</b>', true);
    }
    if (targets[i].id) {
      onSelectLayer?.(targets[i].id);
      onSelectModel?.(targets[i].id);
    }
  }, [syncFromTarget, jumpDisplay, markSelection, applyObject, say, onSelectLayer, onSelectModel, setMenu, isPro]);

  const setTargets = useCallback((list: TargetItem[]) => {
    const formatted = list.map(t => {
      t.object.updateWorldMatrix(true, false);
      return Object.assign({}, t, {
        home: { p: t.object.position.clone(), q: t.object.quaternion.clone() }
      });
    });
    targetsRef.current = formatted;
    setTargetsList(formatted);
    selectTarget(Math.min(currentRef.current, formatted.length - 1), true);
  }, [selectTarget]);

  // Populate targets from engine
  useEffect(() => {
    if (!engine) return;
    const list: TargetItem[] = [];
    const drawingPlane = engine.getDrawingPlane();
    const sceneRoot = engine.getModelRoot();
    const loadedModel = sceneRoot?.children?.find(
      c => c !== drawingPlane && (c as any).name !== 'DrawingPlaneCanvas' && !(c as any).isLine && !(c as any).isPoints
    );

    if (sceneRoot) {
      list.push({
        id: 'scene',
        name: isPro ? 'Scene root' : 'Everything',
        note: isPro ? 'all objects' : 'model + canvas',
        object: sceneRoot
      });
    }
    if (loadedModel) {
      list.push({
        id: 'model',
        name: 'Model',
        note: isPro ? 'mesh' : 'the 3D shape',
        object: loadedModel
      });
    }
    if (drawingPlane) {
      list.push({
        id: 'canvas',
        name: 'Canvas',
        note: isPro ? 'paint surface' : 'what you draw on',
        object: drawingPlane
      });
    }

    if (layers && layers.length > 0) {
      layers.forEach(l => {
        const layerObj = (drawingPlane?.getObjectByName?.(l.id) || (drawingPlane?.children?.find((c: any) => c.userData?.layerId === l.id))) as THREE.Object3D;
        if (layerObj) {
          list.push({
            id: l.id,
            name: l.name || 'Layer',
            note: isPro ? 'child of canvas' : (l.type || 'layer'),
            object: layerObj
          });
        }
      });
    }

    if (list.length === 0) {
      const dummy = new THREE.Group();
      list.push({
        id: 'canvas',
        name: 'Canvas',
        note: isPro ? 'paint surface' : 'what you draw on',
        object: dummy
      });
    }

    setTargets(list);
    const canvasIdx = list.findIndex(t => t.id === 'canvas');
    selectTarget(canvasIdx >= 0 ? canvasIdx : 0, true);
  }, [engine, layers, setTargets, selectTarget, isPro]);

  useEffect(() => {
    if (activeLayerId) {
      const idx = targetsRef.current.findIndex(t => t.id === activeLayerId);
      if (idx >= 0 && idx !== currentRef.current) {
        selectTarget(idx, true);
      }
    }
  }, [activeLayerId, selectTarget]);

  const sizeToBox = useCallback(() => {
    gzRef.current.size = window.innerWidth < 420 ? 190 : 210;
    fitGizmo(gzRef.current.size);
    drawGizmo();
  }, [drawGizmo]);

  // Tab dragging & click handling
  useEffect(() => {
    const tab = tabRef.current;
    const dock = dockRef.current;
    if (!tab || !dock) return;

    let d: any = null;
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const r = dock.getBoundingClientRect();
      d = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
      try { tab.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const onMove = (e: PointerEvent) => {
      if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
      if (!d.moved) setMenu(false);
      d.moved = true;
      place(d.left + e.clientX - d.x, d.top + e.clientY - d.y, true);
    };
    const onUp = (e: PointerEvent) => {
      if (!d) return;
      const moved = d.moved;
      d = null;
      try { tab.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!moved) {
        setMenu(nvRef.current?.dataset.menu !== 'open');
      }
    };

    tab.addEventListener('pointerdown', onDown);
    tab.addEventListener('pointermove', onMove);
    tab.addEventListener('pointerup', onUp);

    return () => {
      tab.removeEventListener('pointerdown', onDown);
      tab.removeEventListener('pointermove', onMove);
      tab.removeEventListener('pointerup', onUp);
    };
  }, [place, setMenu]);

  // Gizmo pointer events
  useEffect(() => {
    const gzc = canvasRef.current;
    if (!gzc) return;

    const onDown = (e: PointerEvent) => {
      e.preventDefault(); e.stopPropagation();
      stopTour();
      const pt = gzPoint(e);
      const m = metrics(gzRef.current.size);
      const r = Math.hypot(pt.x - m.c, pt.y - m.c);
      const hit = pickHandle(pt);
      if (hit) gzRef.current.active = { type: 'axis', i: hit.i, sign: hit.sign };
      else if (r <= m.hub * 1.7) gzRef.current.active = { type: 'hub' };
      else gzRef.current.active = { type: 'orbit' };

      dragRef.current = {
        startX: e.clientX, startY: e.clientY, moved: false, hit,
        pos: objRef.current.pos.clone(), quat: objRef.current.quat.clone(),
        theta: camRef.current.theta, phi: camRef.current.phi,
        startAngle: Math.atan2(pt.y - m.c, pt.x - m.c), committed: false
      };
      lastStepRef.current = null;
      nvRef.current?.classList.add('nv-grabbing', 'nv-focus');
      gzc.setPointerCapture(e.pointerId);
      drawGizmo();
    };

    const onMove = (e: PointerEvent) => {
      const m = metrics(gzRef.current.size);
      const drag = dragRef.current;
      if (!drag) {
        const hit = pickHandle(gzPoint(e));
        const changed = (hit ? hit.i + ':' + hit.sign : '') !== (gzRef.current.hover ? gzRef.current.hover.i + ':' + gzRef.current.hover.sign : '');
        gzRef.current.hover = hit ? { i: hit.i, sign: hit.sign } : null;
        gzc.style.cursor = hit ? 'pointer' : 'grab';
        if (changed) drawGizmo();
        return;
      }
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      const act = gzRef.current.active;

      if (act.type === 'orbit' || gzRef.current.mode === 'look') {
        camRef.current.theta = drag.theta - dx * 0.0062;
        camRef.current.phi = Math.max(0.06, Math.min(Math.PI - 0.06, drag.phi - dy * 0.0062));
        applyCamera();
        say(isPro ? 'orbit' : 'Walking around it', true);
        return;
      }
      if (!drag.committed) { pushHistory(); drag.committed = true; }

      if (act.type === 'hub') {
        if (gzRef.current.mode === 'move') {
          const b = camBasis(), k = unitsPerPixel();
          objRef.current.pos.copy(drag.pos).addScaledVector(b.right, dx * k).addScaledVector(b.up, -dy * k);
          if (gzRef.current.moveStep) {
            objRef.current.pos.x = snap(objRef.current.pos.x, gzRef.current.moveStep);
            objRef.current.pos.y = snap(objRef.current.pos.y, gzRef.current.moveStep);
            objRef.current.pos.z = snap(objRef.current.pos.z, gzRef.current.moveStep);
          }
          clampPos(); applyObject();
          tick(objRef.current.pos.x + ':' + objRef.current.pos.y + ':' + objRef.current.pos.z);
          say(isPro ? 'screen move' : 'Sliding it around', true);
        } else {
          const b = camBasis();
          let ay = -dx * 0.5, ax = -dy * 0.5;
          if (gzRef.current.rotStep) { ay = snap(ay, gzRef.current.rotStep); ax = snap(ax, gzRef.current.rotStep); }
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ay * DEG)
            .multiply(new THREE.Quaternion().setFromAxisAngle(b.right, ax * DEG));
          objRef.current.quat.copy(drag.quat).premultiply(q);
          applyObject();
          tick(ay + ':' + ax);
          say(isPro ? 'trackball' : 'Tumbling it', true);
        }
        return;
      }

      const h = drag.hit, a = (axesRef.current || PLAY_AXES)[h.i], worldDir = h.dir, p = project(worldDir, m);
      if (gzRef.current.mode === 'move') {
        const len = Math.max(0.001, p.len);
        const nx = (p.x - m.c) / p.rad, ny = (p.y - m.c) / p.rad;
        let amount = (dx * nx + dy * ny) * unitsPerPixel() / Math.max(0.30, len);
        if (gzRef.current.moveStep) amount = snap(amount, gzRef.current.moveStep);
        objRef.current.pos.copy(drag.pos).addScaledVector(worldDir, amount);
        clampPos(); applyObject();
        tick(amount);
        if (isPro) {
          say(a.lbl + '  ' + (amount >= 0 ? '+' : '−') + Math.abs(amount).toFixed(2), true);
        } else {
          say((h.sign > 0 ? a.lbl : a.back) + '  ' + Math.abs(amount).toFixed(gzRef.current.moveStep && gzRef.current.moveStep >= 0.5 ? 1 : 2), true);
        }
      } else {
        const pt = gzPoint(e);
        let d = Math.atan2(pt.y - m.c, pt.x - m.c) - drag.startAngle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        let deg = -(d / DEG) * (p.depth >= 0 ? 1 : -1);
        if (gzRef.current.rotStep) deg = snap(deg, gzRef.current.rotStep);
        objRef.current.quat.copy(drag.quat).premultiply(new THREE.Quaternion().setFromAxisAngle(worldDir, deg * DEG));
        applyObject();
        tick(deg);
        if (isPro) {
          say(a.lbl + '  ' + (deg >= 0 ? '+' : '−') + Math.abs(Math.round(deg)) + '°', true);
        } else {
          say('Turned ' + Math.round(Math.abs(deg)) + '°', true);
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved && drag.hit) {
        faceDirection(drag.hit.dir, drag.hit.sign > 0 ? drag.hit.a.lbl : drag.hit.a.back);
      } else if (!drag.moved && gzRef.current.active && gzRef.current.active.type === 'hub') {
        setMode(gzRef.current.mode === 'look' ? 'move' : gzRef.current.mode === 'move' ? 'rotate' : 'look');
      }
      gzRef.current.active = null; dragRef.current = null;
      nvRef.current?.classList.remove('nv-grabbing', 'nv-focus');
      try { gzc.releasePointerCapture(e.pointerId); } catch (_) {}
      drawGizmo(); idleHint();
      setHistoryLen(historyRef.current.length);
    };

    gzc.addEventListener('pointerdown', onDown);
    gzc.addEventListener('pointermove', onMove);
    gzc.addEventListener('pointerup', onUp);
    gzc.addEventListener('pointercancel', onUp);

    return () => {
      gzc.removeEventListener('pointerdown', onDown);
      gzc.removeEventListener('pointermove', onMove);
      gzc.removeEventListener('pointerup', onUp);
      gzc.removeEventListener('pointercancel', onUp);
    };
  }, [drawGizmo, applyCamera, applyObject, idleHint, say]);

  // Stepping aside while drawing on main canvas
  useEffect(() => {
    const onDocDown = (e: PointerEvent) => {
      if (nvRef.current && !nvRef.current.contains(e.target as Node)) {
        nvRef.current.classList.add('nv-dim');
        setMenu(false);
      } else if (e.target === canvasRef.current) {
        setMenu(false);
      }
    };
    const onDocUp = () => {
      nvRef.current?.classList.remove('nv-dim');
    };
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('pointerup', onDocUp, true);
    document.addEventListener('pointercancel', onDocUp, true);

    return () => {
      document.removeEventListener('pointerdown', onDocDown, true);
      document.removeEventListener('pointerup', onDocUp, true);
      document.removeEventListener('pointercancel', onDocUp, true);
    };
  }, [setMenu]);

  // 3D Scene Outline
  useEffect(() => {
    if (!engine) return;
    const scene = engine.getScene();
    const dark = isDark();
    const outline = new THREE.Box3Helper(selBoxRef.current, dark ? 0xf2ede6 : 0x332e28);
    const mat = outline.material as THREE.LineBasicMaterial;
    if (mat) {
      mat.transparent = true;
      mat.opacity = 0.55;
    }
    outline.visible = false;
    scene.add(outline);
    outlineRef.current = outline;

    return () => {
      scene.remove(outline);
      outline.dispose?.();
    };
  }, [engine, isDark]);

  // Boot & main animation loop
  useEffect(() => {
    let animId: number;
    let lastFrame = 0;

    // Load persisted layout if available
    try {
      const v = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (v) {
        if (typeof v.ax === 'number') anchorRef.current = { ax: Math.min(1, Math.max(0, v.ax)), ay: Math.min(1, Math.max(0, v.ay)) };
        if (v.mode) { gzRef.current.mode = v.mode; setModeState(v.mode); }
        if (typeof v.rotStep === 'number') { gzRef.current.rotStep = v.rotStep; setRotStep(v.rotStep); }
        if (typeof v.moveStep === 'number') { gzRef.current.moveStep = v.moveStep; setMoveStep(v.moveStep); }
      }
    } catch (_) {}

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = lastFrame ? Math.min(0.06, (now - lastFrame) / 1000) : 0.016;
      lastFrame = now;

      stepFlight(now);
      stepTour(now);

      if (!dragRef.current && !flightRef.current && !tourRef.current && engine) {
        const engCam = engine.cameraSpherical;
        if (
          Math.abs(camRef.current.theta - engCam.theta) > 1e-4 ||
          Math.abs(camRef.current.phi - engCam.phi) > 1e-4
        ) {
          camRef.current.theta = engCam.theta;
          camRef.current.phi = engCam.phi;
          camRef.current.radius = engCam.radius;
          camRef.current.target.copy(engine.cameraTarget);
          drawGizmo(now);
        }
      }

      if (easeDisplay(dt)) drawGizmo(now);
    };

    sizeToBox();
    document.documentElement.dataset.nvTheme = theme;
    readTheme();
    applyObject();

    if (engine?.cameraSpherical) {
      camRef.current.theta = engine.cameraSpherical.theta;
      camRef.current.phi = engine.cameraSpherical.phi;
      camRef.current.radius = engine.cameraSpherical.radius;
      if (engine.cameraTarget) camRef.current.target.copy(engine.cameraTarget);
    }
    idleHint();
    placeFromAnchor();
    drawGizmo();

    animId = requestAnimationFrame(loop);

    const onResize = () => {
      sizeToBox();
      placeFromAnchor();
      drawGizmo();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, [sizeToBox, readTheme, applyObject, applyCamera, idleHint, placeFromAnchor, drawGizmo, easeDisplay, engine]);

  // Theme change
  useEffect(() => {
    document.documentElement.dataset.nvTheme = theme;
    readTheme();
    drawGizmo();
  }, [theme, readTheme, drawGizmo]);

  // UI Mode (Play vs Pro) switch
  useEffect(() => {
    axesRef.current = (isPro ? PRO_AXES : PLAY_AXES).map(a => ({ ...a }));
    readTheme();
    applyObject();
    applyCamera();
    idleHint();
    drawGizmo();
  }, [isPro, readTheme, applyObject, applyCamera, idleHint, drawGizmo]);

  const currentTarget = targetsList[currentIdx];

  return (
    <div
      id="nv"
      ref={nvRef}
      data-menu={isMenuOpen ? 'open' : 'closed'}
      data-corner="br"
      data-mode={mode}
      data-ui-mode={effectiveUiMode}
    >
      <div className="nv-dock" id="nv-dock" ref={dockRef}>
        <canvas className="nv-canvas" id="nv-canvas" ref={canvasRef}></canvas>
        <button
          className="nv-tab"
          id="nv-tab"
          ref={tabRef}
          aria-expanded={isMenuOpen}
          title="Menu · drag to move"
        >
          ⋯
        </button>
        <div className="nv-label" id="nv-label" ref={labelRef}></div>
      </div>

      <div className="nv-menu" id="nv-menu" ref={menuRef}>
        {isPro && (
          <>
            <div className="nv-sec">Transform</div>
            <div className="nv-num" id="nv-num" ref={numRef}></div>
          </>
        )}

        <div className="nv-sec">{isPro ? 'Tool' : 'Mode'}</div>
        <div className="nv-modes">
          <button
            className="nv-mode"
            id="nv-look"
            aria-pressed={mode === 'look'}
            onClick={() => { stopTour(); setMode('look'); }}
          >
            {isPro ? 'Orbit' : 'Look'}
          </button>
          <button
            className="nv-mode"
            id="nv-move"
            aria-pressed={mode === 'move'}
            onClick={() => { stopTour(); setMode('move'); }}
          >
            Move
          </button>
          <button
            className="nv-mode"
            id="nv-turn"
            aria-pressed={mode === 'rotate'}
            onClick={() => { stopTour(); setMode('rotate'); }}
          >
            {isPro ? 'Rotate' : 'Turn'}
          </button>
        </div>

        <div className="nv-sec">{isPro ? 'Rotate snap' : 'Turning steps'}</div>
        <div className="nv-chips" id="nv-rot-steps">
          {ROT_STEPS.map(o => (
            <button
              key={o.v}
              className="nv-chip"
              aria-pressed={rotStep === o.v}
              onClick={() => {
                gzRef.current.rotStep = o.v;
                setRotStep(o.v);
                saveLayout();
                say(isPro ? (o.lbl === 'Free' ? 'snap off' : 'snap ' + o.lbl) : (o.lbl === 'Free' ? 'free movement' : 'steps of ' + o.lbl), true);
              }}
            >
              {o.lbl}
            </button>
          ))}
        </div>

        <div className="nv-sec">{isPro ? 'Move snap' : 'Sliding steps'}</div>
        <div className="nv-chips" id="nv-move-steps">
          {MOVE_STEPS.map(o => (
            <button
              key={o.v}
              className="nv-chip"
              aria-pressed={moveStep === o.v}
              onClick={() => {
                gzRef.current.moveStep = o.v;
                setMoveStep(o.v);
                saveLayout();
                say(isPro ? (o.lbl === 'Free' ? 'snap off' : 'snap ' + o.lbl) : (o.lbl === 'Free' ? 'free movement' : 'steps of ' + o.lbl), true);
              }}
            >
              {o.lbl}
            </button>
          ))}
        </div>

        <div className="nv-sec">{isPro ? 'Align' : 'Set it'}</div>
        <div className="nv-acts">
          <button className="nv-act" id="nv-flat" onClick={() => setOrient(0, 0, isPro ? 'aligned flat' : 'Flat like a table')}>
            {isPro ? 'Flat' : 'Lay flat'}
          </button>
          <button className="nv-act" id="nv-wall" onClick={() => setOrient(90, 0, isPro ? 'upright' : 'Stand up')}>
            {isPro ? 'Upright' : 'Stand up'}
          </button>
          <button className="nv-act" id="nv-lean" onClick={() => setOrient(45, 0, isPro ? '45°' : 'Leaning like a ramp')}>
            {isPro ? '45°' : 'Lean'}
          </button>
          <button className="nv-act" id="nv-face" onClick={lookAtIt}>
            {isPro ? 'Frame' : 'Look at it'}
          </button>
          <button className="nv-act" id="nv-undo" disabled={historyLen === 0} onClick={() => { stopTour(); undo(); }}>
            Undo
          </button>
          <button className="nv-act" id="nv-reset" onClick={resetTarget}>
            {isPro ? 'Reset' : 'Start over'}
          </button>
        </div>

        <button
          className="nv-act nv-wide"
          id="nv-tour"
          onClick={() => { isTourRunning ? stopTour() : startTour(); }}
        >
          {isTourRunning ? (isPro ? 'Stop walkthrough' : 'Stop the demo') : (isPro ? 'Walkthrough' : 'Show me how')}
        </button>

        <div className="nv-sec">{isPro ? 'Target' : 'Moving'}</div>
        <button
          className="nv-pick"
          id="nv-pick"
          aria-expanded={isListOpen}
          onClick={() => {
            setIsListOpen(prev => !prev);
            requestAnimationFrame(() => positionMenu());
          }}
        >
          <b id="nv-pick-name">{currentTarget?.name || 'Canvas'}</b><span>▾</span>
        </button>

        <div id="nv-list" className={isListOpen ? 'nv-on' : ''} role="listbox">
          {targetsList.map((t, idx) => (
            <button
              key={t.id + '_' + idx}
              className="nv-opt"
              role="option"
              aria-selected={currentIdx === idx}
              onClick={() => {
                selectTarget(idx);
                setIsListOpen(false);
              }}
            >
              <span className="nv-swatch"></span>
              <span>{t.name}{t.note ? <em> {t.note}</em> : null}</span>
            </button>
          ))}
        </div>

        <div className="nv-sec" style={{ textAlign: 'center', margin: '8px 0 0' }}>
          {isPro ? 'navigator · pro' : 'build 9'}
        </div>
      </div>
    </div>
  );
};
