/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { playHapticSound } from '../utils/audio';

interface ThreeTrackballProps {
  yaw: number;
  pitch: number;
  onRotate: (deltaYaw: number, deltaPitch: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  onVelocityChange?: (velocity: number) => void;
  soundEnabled: boolean;
  size?: number;
}

export const ThreeTrackball: React.FC<ThreeTrackballProps> = ({
  yaw,
  pitch,
  onRotate,
  onDragStateChange,
  onVelocityChange,
  soundEnabled,
  size = 144,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0, time: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sphereRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const frictionAnimRef = useRef<number | null>(null);
  const [gpuBackend, setGpuBackend] = useState<'WebGPU' | 'WebGL2' | 'WebGL'>('WebGL2');

  // Keep latest props in refs for event handlers without recreating loop
  const onRotateRef = useRef(onRotate);
  onRotateRef.current = onRotate;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;
  const onVelocityChangeRef = useRef(onVelocityChange);
  onVelocityChangeRef.current = onVelocityChange;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isCancelled = false;

    // Synchronous scene setup for instantaneous mounting
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Detect WebGPU availability asynchronously
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      const navGpu = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
      navGpu?.requestAdapter?.().then((adapter) => {
        if (adapter && !isCancelled) {
          setGpuBackend('WebGPU');
        }
      }).catch(() => {});
    }

      // Lighting setup for realistic tactile 3D ceramic/marble look
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.9);
      dirLight1.position.set(3, 4, 4);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x60a5fa, 1.1);
      dirLight2.position.set(-3, -2, -2);
      scene.add(dirLight2);

      const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
      rimLight.position.set(0, -3, 2);
      scene.add(rimLight);

      // Group for the 3D Sphere and its tactile dots
      const sphereGroup = new THREE.Group();
      scene.add(sphereGroup);
      sphereRef.current = sphereGroup;

      // Main Sphere Mesh (Ceramic / polished marble)
      const sphereRadius = 1.35;
      const sphereGeom = new THREE.SphereGeometry(sphereRadius, 64, 64);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0xfafafa,
        roughness: 0.2,
        metalness: 0.09,
      });
      const mainSphere = new THREE.Mesh(sphereGeom, sphereMat);
      sphereGroup.add(mainSphere);

      // Tactile grip dots around the sphere surface at distinct 3D positions
      const dotGeom = new THREE.SphereGeometry(0.16, 24, 24);
      const dotMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.35,
        metalness: 0.12,
      });

      // Ring of 3 large grip dots + satellite dots across coordinates
      const dotCoords: [number, number, number][] = [
        // Primary face dots
        [0, 0, 1],
        [0.6, 0.4, 0.7],
        [-0.6, 0.4, 0.7],
        [0, -0.7, 0.7],
        // Side dots
        [0.85, -0.3, 0.4],
        [-0.85, -0.3, 0.4],
        [0.7, 0.7, 0],
        [-0.7, 0.7, 0],
        // Back/Equator dots
        [0, 0.9, -0.4],
        [0, -0.9, -0.4],
        [0.7, -0.4, -0.6],
        [-0.7, -0.4, -0.6],
        [0, 0, -1],
      ];

      dotCoords.forEach(([x, y, z]) => {
        const v = new THREE.Vector3(x, y, z).normalize().multiplyScalar(sphereRadius * 0.98);
        const dotMesh = new THREE.Mesh(dotGeom, dotMat);
        dotMesh.position.copy(v);
        sphereGroup.add(dotMesh);
      });

      // Dark inset socket ring
      const socketGeom = new THREE.TorusGeometry(1.42, 0.12, 24, 48);
      const socketMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
      const socketMesh = new THREE.Mesh(socketGeom, socketMat);
      scene.add(socketMesh);

      // Initial rotation
      sphereGroup.rotation.x = THREE.MathUtils.degToRad(pitch);
      sphereGroup.rotation.y = THREE.MathUtils.degToRad(yaw);

      // Render loop
      const animate = () => {
        if (isCancelled) return;
        renderer.render(scene, camera);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      return () => {
        isCancelled = true;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (frictionAnimRef.current) cancelAnimationFrame(frictionAnimRef.current);
        if (rendererRef.current) {
          rendererRef.current.dispose();
        }
        if (container) {
          container.innerHTML = '';
        }
      };
    }, [size]);

  // Sync orientation when pitch/yaw change externally while not dragging or decelerating
  useEffect(() => {
    if (sphereRef.current && !isDragging.current && !frictionAnimRef.current) {
      sphereRef.current.rotation.x = THREE.MathUtils.degToRad(pitch);
      sphereRef.current.rotation.y = THREE.MathUtils.degToRad(yaw);
    }
  }, [yaw, pitch]);

  // Interactive 3D Pointer handlers with normalized, pixel-independent coordinate math
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (frictionAnimRef.current) {
      cancelAnimationFrame(frictionAnimRef.current);
      frictionAnimRef.current = null;
    }

    isDragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    velocityRef.current = { x: 0, y: 0 };
    onDragStateChangeRef.current?.(true);
    playHapticSound('click', soundEnabledRef.current);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !sphereRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const now = performance.now();
    const dt = Math.max(1, now - lastPointer.current.time);
    const rawDx = e.clientX - lastPointer.current.x;
    const rawDy = e.clientY - lastPointer.current.y;

    // Normalize deltas relative to trackball radius (pixel-independent coordinate space)
    const baseRadius = Math.max(1, size * 0.5);
    const normDx = (rawDx / baseRadius) * 60;
    const normDy = (rawDy / baseRadius) * 60;

    // Exponential moving average for normalized velocity calculation
    const currentVx = (normDx / dt) * 16.67;
    const currentVy = (normDy / dt) * 16.67;
    velocityRef.current = {
      x: velocityRef.current.x * 0.4 + currentVx * 0.6,
      y: velocityRef.current.y * 0.4 + currentVy * 0.6,
    };

    lastPointer.current = { x: e.clientX, y: e.clientY, time: now };

    // Report instant drag velocity for CSS vibration resistance effect
    const speed = Math.min(2.0, Math.hypot(currentVx, currentVy) * 0.15);
    onVelocityChangeRef.current?.(speed);

    // Rotate the 3D group directly with normalized tactile feel
    const rotSpeed = 0.024;
    sphereRef.current.rotation.y += normDx * rotSpeed;
    sphereRef.current.rotation.x += normDy * rotSpeed;

    // Convert deltas to degrees for global spatial update
    const deltaYaw = normDx * 1.5;
    const deltaPitch = -normDy * 1.2;
    onRotateRef.current(deltaYaw, deltaPitch);

    if (Math.hypot(rawDx, rawDy) > 8) {
      playHapticSound('tick', soundEnabledRef.current);
    }
  };

  // Friction-based momentum deceleration animation on release
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = false;
    onDragStateChangeRef.current?.(false);
    onVelocityChangeRef.current?.(0);
    playHapticSound('pop', soundEnabledRef.current);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Friction physics loop: coast to a smooth stop with normalized momentum
    let vx = velocityRef.current.x * 1.1;
    let vy = velocityRef.current.y * 1.1;
    const friction = 0.93; // Energy decay factor per frame

    const stepFriction = () => {
      const currentSpeed = Math.hypot(vx, vy);
      if (currentSpeed < 0.08 || !sphereRef.current) {
        frictionAnimRef.current = null;
        onVelocityChangeRef.current?.(0);
        return;
      }

      vx *= friction;
      vy *= friction;

      onVelocityChangeRef.current?.(Math.min(2.0, currentSpeed * 0.12));

      // Rotate Three.js 3D sphere
      const rotSpeed = 0.022;
      sphereRef.current.rotation.y += vx * rotSpeed;
      sphereRef.current.rotation.x += vy * rotSpeed;

      // Impart delta to spatial orientation
      const deltaYaw = vx * 1.35;
      const deltaPitch = -vy * 1.05;
      onRotateRef.current(deltaYaw, deltaPitch);

      frictionAnimRef.current = requestAnimationFrame(stepFriction);
    };

    if (Math.hypot(vx, vy) > 0.4) {
      frictionAnimRef.current = requestAnimationFrame(stepFriction);
    }
  };

  return (
    <div
      ref={mountRef}
      id="three-trackball-3d-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex items-center justify-center cursor-grab active:cursor-grabbing rounded-full touch-none select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
      style={{ width: size, height: size }}
      title={`3D Trackball (${gpuBackend} Accelerated)`}
    />
  );
};
