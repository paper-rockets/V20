import * as THREE from 'three';
import { PrimitiveTopologyConfig } from '../types';

export class PrimitiveGenerator {
  public static createPrimitiveGeometry(config: PrimitiveTopologyConfig): THREE.BufferGeometry {
    let geom: THREE.BufferGeometry;

    switch (config.type) {
      case 'sphere':
        geom = new THREE.SphereGeometry(
          config.radius,
          Math.max(3, config.radialSegments),
          Math.max(2, config.heightSegments)
        );
        break;

      case 'cylinder':
        geom = new THREE.CylinderGeometry(
          config.radius,
          config.radius,
          config.height,
          Math.max(3, config.radialSegments),
          Math.max(1, config.heightSegments)
        );
        break;

      case 'torus':
        geom = new THREE.TorusGeometry(
          config.radius,
          config.tubeRadius ?? config.radius * 0.3,
          Math.max(3, config.radialSegments),
          Math.max(3, config.tubularSegments ?? config.heightSegments)
        );
        break;

      case 'cone':
        geom = new THREE.ConeGeometry(
          config.radius,
          config.height,
          Math.max(3, config.radialSegments),
          Math.max(1, config.heightSegments)
        );
        break;

      case 'capsule':
        // Three.js CapsuleGeometry
        geom = new THREE.CapsuleGeometry(
          config.radius,
          config.height,
          Math.max(1, Math.floor(config.heightSegments / 2)),
          Math.max(3, config.radialSegments)
        );
        break;

      case 'box':
        geom = new THREE.BoxGeometry(
          config.width ?? config.radius * 2,
          config.height,
          config.depth ?? config.radius * 2,
          Math.max(1, config.radialSegments),
          Math.max(1, config.heightSegments),
          Math.max(1, config.radialSegments)
        );
        break;

      case 'plane':
        geom = new THREE.PlaneGeometry(
          config.width ?? config.radius * 2,
          config.height,
          Math.max(1, config.radialSegments),
          Math.max(1, config.heightSegments)
        );
        break;

      default:
        geom = new THREE.SphereGeometry(config.radius, 16, 16);
        break;
    }

    geom.computeVertexNormals();
    return geom;
  }

  public static calculateStats(geometry: THREE.BufferGeometry): { vertices: number; triangles: number } {
    const pos = geometry.attributes.position;
    const vertexCount = pos ? pos.count : 0;
    const triangleCount = geometry.index
      ? geometry.index.count / 3
      : Math.floor(vertexCount / 3);

    return {
      vertices: vertexCount,
      triangles: Math.round(triangleCount),
    };
  }

  public static createPrimitiveMesh(
    config: PrimitiveTopologyConfig,
    materialColor: number = 0x64748b,
    isScaffold: boolean = false
  ): THREE.Group {
    const root = new THREE.Group();
    root.name = `Primitive_${config.type}_${Date.now()}`;

    const geom = this.createPrimitiveGeometry(config);

    const mat = new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: isScaffold,
      opacity: isScaffold ? 0.65 : 1.0,
      depthWrite: !isScaffold,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `Mesh_${config.type}`;
    root.add(mesh);

    if (config.wireframeOverlay || isScaffold) {
      const wireMat = new THREE.MeshBasicMaterial({
        color: isScaffold ? 0x38bdf8 : 0x0f172a,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      });
      const wireMesh = new THREE.Mesh(geom, wireMat);
      wireMesh.name = 'WireframeOverlay';
      root.add(wireMesh);
    }

    return root;
  }
}
