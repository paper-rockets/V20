import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Compass } from 'lucide-react';
import { StudioEngine } from '../core/studioEngine';
import { haptics } from '../utils/haptics';

interface CameraRecoveryPillProps {
  engine: StudioEngine | null;
  theme?: 'light' | 'dark';
}

export const CameraRecoveryPill: React.FC<CameraRecoveryPillProps> = ({ engine, theme = 'dark' }) => {
  const [isLost, setIsLost] = useState<boolean>(false);
  const frustumRef = useRef(new THREE.Frustum());
  const projMatrixRef = useRef(new THREE.Matrix4());
  const sphereRef = useRef(new THREE.Sphere());
  const boxRef = useRef(new THREE.Box3());

  // Check whether artwork meshes intersect the camera view frustum
  const checkFrustum = useCallback(() => {
    if (!engine) return;

    const camera = engine.getCamera();
    if (!camera) return;

    // Calculate bounding box of artwork (models + strokes, ignoring sky, grid, helpers, gizmos)
    const scene = engine.getScene();
    const box = boxRef.current;
    box.makeEmpty();
    let hasArtwork = false;

    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.visible) {
        const name = mesh.name || '';
        // Skip background sky, grid, helpers, cursor decal, transform gizmos
        if (
          name.includes('Sky') ||
          name.includes('Grid') ||
          name.includes('Helper') ||
          name.includes('Cursor') ||
          name.includes('Decal') ||
          name.includes('Gizmo') ||
          mesh.parent?.name?.includes('Helper') ||
          mesh.parent?.name?.includes('Gizmo')
        ) {
          return;
        }
        box.expandByObject(mesh);
        hasArtwork = true;
      }
    });

    if (!hasArtwork || box.isEmpty()) {
      setIsLost(false);
      return;
    }

    // Update frustum from current camera matrix
    camera.updateMatrixWorld();
    projMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustumRef.current.setFromProjectionMatrix(projMatrixRef.current);

    // Test sphere intersection
    box.getBoundingSphere(sphereRef.current);
    if (sphereRef.current.radius < 0.001) {
      setIsLost(false);
      return;
    }

    const isVisible = frustumRef.current.intersectsSphere(sphereRef.current);
    setIsLost(!isVisible);
  }, [engine]);

  // Throttled interval checking every 200ms
  useEffect(() => {
    if (!engine) {
      setIsLost(false);
      return;
    }

    const intervalId = window.setInterval(checkFrustum, 200);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [engine, checkFrustum]);

  const handleReturn = useCallback(() => {
    if (!engine) return;
    haptics.trigger('medium');
    engine.resetCamera();
    setIsLost(false);
  }, [engine]);

  if (!isLost) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-in fade-in slide-in-from-top-3 duration-200">
      <button
        type="button"
        onClick={handleReturn}
        className={`pointer-events-auto h-11 px-5 rounded-full border shadow-2xl flex items-center gap-2.5 font-semibold text-xs tracking-wide transition-all active:scale-95 ${
          theme === 'light'
            ? 'bg-neutral-900 text-white border-neutral-700 hover:bg-neutral-800'
            : 'bg-white text-neutral-950 border-neutral-200 hover:bg-neutral-100'
        }`}
        title="Return camera to artwork"
      >
        <Compass className="w-4 h-4 text-current animate-spin-slow opacity-80" />
        <span>Lost? Tap to return to artwork</span>
      </button>
    </div>
  );
};
