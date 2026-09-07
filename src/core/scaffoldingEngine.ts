import * as THREE from 'three';
import {
  CollisionGuideMeshConfig,
  ScaffoldProxyType,
  ScaffoldRenderMode,
} from '../types';
import { PrimitiveGenerator } from './primitiveGenerator';

export class ScaffoldingEngine {
  private scaffoldRoot: THREE.Group;
  private collisionGuides: Map<string, CollisionGuideMeshConfig> = new Map();
  private colliderMeshes: Map<string, THREE.Mesh[]> = new Map();

  constructor() {
    this.scaffoldRoot = new THREE.Group();
    this.scaffoldRoot.name = 'ScaffoldingCollisionRoot';
    this.scaffoldRoot.renderOrder = 3;
  }

  public getScaffoldRoot(): THREE.Group {
    return this.scaffoldRoot;
  }

  public getScaffolds(): CollisionGuideMeshConfig[] {
    return Array.from(this.collisionGuides.values());
  }

  public getActiveColliderMeshes(): THREE.Mesh[] {
    const activeMeshes: THREE.Mesh[] = [];
    this.collisionGuides.forEach((guide, id) => {
      // Mesh is active for raycasting if not locked or if flagged as collision guide
      if (guide.visible || guide.isCollisionOnly || guide.renderMode === 'invisible') {
        const meshes = this.colliderMeshes.get(id);
        if (meshes) {
          activeMeshes.push(...meshes);
        }
      }
    });
    return activeMeshes;
  }

  /**
   * Spawns a procedural scaffolding proxy (Mannequin, Head, Car, Limb, Dome, Capsule)
   */
  public createProxyScaffold(type: ScaffoldProxyType, name?: string): CollisionGuideMeshConfig {
    const id = `scaffold_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const scaffoldName = name || this.getDefaultProxyName(type);

    const group = this.buildProxyGeometry(type);
    group.name = `ScaffoldGroup_${id}`;

    const config: CollisionGuideMeshConfig = {
      id,
      name: scaffoldName,
      mesh: group,
      visible: true,
      renderMode: 'ghost',
      opacity: 0.65,
      colorHex: '#38bdf8',
      locked: false,
      isCollisionOnly: false,
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      source: 'primitive_proxy',
      proxyType: type,
    };

    this.registerScaffold(config, group);
    return config;
  }

  /**
   * Registers an imported 3D mesh (OBJ / GLTF / FBX) as a non-editable collision scaffold
   */
  public loadCollisionMeshFromObject(
    object: THREE.Object3D,
    name: string = 'Imported Collision Mesh'
  ): CollisionGuideMeshConfig {
    const id = `scaffold_imported_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Clone and normalize object
    const cloned = object.clone();
    cloned.name = `ScaffoldImport_${id}`;

    // Auto-normalize bounding size if oversized
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    if (maxDim > 5.0 || maxDim < 0.2) {
      const scale = 2.0 / maxDim;
      cloned.scale.setScalar(scale);
    }

    let vertexCount = 0;
    let triangleCount = 0;

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.geometry.computeVertexNormals();
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
        const pos = child.geometry.attributes.position;
        vertexCount += pos ? pos.count : 0;
        triangleCount += child.geometry.index
          ? child.geometry.index.count / 3
          : (pos ? pos.count / 3 : 0);
      }
    });

    const config: CollisionGuideMeshConfig = {
      id,
      name,
      mesh: cloned,
      visible: true,
      renderMode: 'ghost',
      opacity: 0.6,
      colorHex: '#38bdf8',
      locked: false,
      isCollisionOnly: false,
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      source: 'imported',
      vertexCount: Math.round(vertexCount),
      triangleCount: Math.round(triangleCount),
    };

    this.registerScaffold(config, cloned);
    return config;
  }

  private registerScaffold(config: CollisionGuideMeshConfig, object: THREE.Object3D): void {
    this.scaffoldRoot.add(object);

    const meshes: THREE.Mesh[] = [];
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Tag as collision guide so it is never treated as a standard editable model
        child.userData.isCollisionGuide = true;
        child.userData.scaffoldId = config.id;
        meshes.push(child);
      }
    });

    this.colliderMeshes.set(config.id, meshes);
    this.collisionGuides.set(config.id, config);
    this.applyRenderMode(config.id, config.renderMode, config.opacity, config.colorHex);
  }

  public removeScaffold(id: string): void {
    const config = this.collisionGuides.get(id);
    if (config && config.mesh) {
      this.scaffoldRoot.remove(config.mesh);
      config.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }
    this.collisionGuides.delete(id);
    this.colliderMeshes.delete(id);
  }

  public updateScaffold(
    id: string,
    updates: Partial<CollisionGuideMeshConfig>
  ): CollisionGuideMeshConfig | null {
    const config = this.collisionGuides.get(id);
    if (!config) return null;

    Object.assign(config, updates);

    if (config.mesh) {
      if (updates.transform) {
        const { position, rotation, scale } = updates.transform;
        config.mesh.position.set(position[0], position[1], position[2]);
        config.mesh.rotation.set(
          (rotation[0] * Math.PI) / 180,
          (rotation[1] * Math.PI) / 180,
          (rotation[2] * Math.PI) / 180
        );
        config.mesh.scale.set(scale[0], scale[1], scale[2]);
        config.mesh.updateMatrixWorld(true);
      }

      if (
        updates.renderMode !== undefined ||
        updates.opacity !== undefined ||
        updates.colorHex !== undefined ||
        updates.visible !== undefined
      ) {
        this.applyRenderMode(id, config.renderMode, config.opacity, config.colorHex, config.visible);
      }
    }

    return config;
  }

  public applyRenderMode(
    id: string,
    mode: ScaffoldRenderMode,
    opacity: number,
    colorHex: string,
    visible: boolean = true
  ): void {
    const meshes = this.colliderMeshes.get(id);
    const config = this.collisionGuides.get(id);
    if (!meshes || !config || !config.mesh) return;

    config.mesh.visible = visible && mode !== 'invisible';

    const color = new THREE.Color(colorHex);

    meshes.forEach((mesh) => {
      // In invisible / collision-only mode, mesh is hidden visually but raycasts can still query it
      if (mode === 'invisible') {
        mesh.visible = false;
        return;
      }

      mesh.visible = visible;

      if (mode === 'ghost') {
        // Semi-transparent X-ray cyber hologram with glowing edges
        mesh.material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.35,
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: Math.max(0.08, opacity),
          side: THREE.DoubleSide,
          depthWrite: false,
          wireframe: false,
        });
      } else if (mode === 'wireframe') {
        // Pure neon wireframe cage
        mesh.material = new THREE.MeshBasicMaterial({
          color: color,
          wireframe: true,
          transparent: true,
          opacity: Math.max(0.2, opacity),
        });
      } else if (mode === 'solid') {
        // Clean matte solid clay proxy
        mesh.material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.6,
          metalness: 0.05,
          transparent: opacity < 0.99,
          opacity: opacity,
          side: THREE.DoubleSide,
          depthWrite: true,
        });
      }
    });
  }

  private getDefaultProxyName(type: ScaffoldProxyType): string {
    switch (type) {
      case 'mannequin_torso':
        return 'Anatomical Torso Proxy';
      case 'head_sphere':
        return 'Loomis Head & Brow Cage';
      case 'car_chassis':
        return 'Vehicle Chassis Scaffolding';
      case 'cylinder_limb':
        return 'Biped Armature Limb Proxy';
      case 'dome_column':
        return 'Dome & Column Architecture';
      case 'capsule':
        return 'Organic Capsule Armature';
    }
  }

  /**
   * Generates rich procedural 3D proxy scaffolding meshes
   */
  private buildProxyGeometry(type: ScaffoldProxyType): THREE.Group {
    const root = new THREE.Group();

    switch (type) {
      case 'mannequin_torso': {
        // Ribcage (Egg/Ellipsoid)
        const ribcageGeo = new THREE.SphereGeometry(0.45, 24, 16);
        ribcageGeo.scale(0.85, 1.1, 0.65);
        const ribcage = new THREE.Mesh(ribcageGeo);
        ribcage.position.set(0, 0.35, 0);
        root.add(ribcage);

        // Pelvis (Wedge Box)
        const pelvisGeo = new THREE.CylinderGeometry(0.38, 0.32, 0.4, 16);
        pelvisGeo.scale(0.9, 1.0, 0.7);
        const pelvis = new THREE.Mesh(pelvisGeo);
        pelvis.position.set(0, -0.35, 0);
        root.add(pelvis);

        // Spine Connector
        const spineGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.4, 12);
        const spine = new THREE.Mesh(spineGeo);
        spine.position.set(0, 0.0, -0.05);
        root.add(spine);

        // Neck & Head
        const neckGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.25, 12);
        const neck = new THREE.Mesh(neckGeo);
        neck.position.set(0, 0.95, 0.02);
        root.add(neck);

        const headGeo = new THREE.SphereGeometry(0.28, 20, 16);
        headGeo.scale(0.85, 1.1, 0.95);
        const head = new THREE.Mesh(headGeo);
        head.position.set(0, 1.3, 0.05);
        root.add(head);

        // Shoulder joints
        const shoulderGeo = new THREE.SphereGeometry(0.14, 12, 12);
        const leftShoulder = new THREE.Mesh(shoulderGeo);
        leftShoulder.position.set(-0.55, 0.75, 0);
        const rightShoulder = new THREE.Mesh(shoulderGeo);
        rightShoulder.position.set(0.55, 0.75, 0);
        root.add(leftShoulder, rightShoulder);
        break;
      }

      case 'head_sphere': {
        // Main cranial sphere
        const skullGeo = new THREE.SphereGeometry(0.55, 24, 20);
        const skull = new THREE.Mesh(skullGeo);
        skull.position.set(0, 0.2, 0);
        root.add(skull);

        // Jaw & Chin Box
        const jawGeo = new THREE.BoxGeometry(0.48, 0.5, 0.55);
        const jaw = new THREE.Mesh(jawGeo);
        jaw.position.set(0, -0.25, 0.12);
        root.add(jaw);

        // Eye line ring
        const ringGeo = new THREE.TorusGeometry(0.56, 0.02, 8, 32);
        const eyeRing = new THREE.Mesh(ringGeo);
        eyeRing.position.set(0, 0.2, 0);
        eyeRing.rotation.x = Math.PI / 2;
        root.add(eyeRing);

        // Brow center nose bridge
        const noseGeo = new THREE.ConeGeometry(0.1, 0.35, 4);
        const nose = new THREE.Mesh(noseGeo);
        nose.position.set(0, 0.05, 0.55);
        nose.rotation.x = -Math.PI / 6;
        root.add(nose);
        break;
      }

      case 'car_chassis': {
        // Low-poly aerodynamic cabin and chassis body
        const cabinGeo = new THREE.BoxGeometry(0.9, 0.45, 1.4);
        const cabin = new THREE.Mesh(cabinGeo);
        cabin.position.set(0, 0.35, -0.1);
        root.add(cabin);

        const hoodGeo = new THREE.BoxGeometry(0.95, 0.3, 1.1);
        const hood = new THREE.Mesh(hoodGeo);
        hood.position.set(0, 0.05, 0.95);
        root.add(hood);

        const trunkGeo = new THREE.BoxGeometry(0.95, 0.35, 0.7);
        const trunk = new THREE.Mesh(trunkGeo);
        trunk.position.set(0, 0.1, -1.05);
        root.add(trunk);

        // 4 Wheel Arches
        const archGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.15, 16);
        const fl = new THREE.Mesh(archGeo);
        fl.rotation.z = Math.PI / 2;
        fl.position.set(-0.5, -0.05, 0.85);
        const fr = new THREE.Mesh(archGeo);
        fr.rotation.z = Math.PI / 2;
        fr.position.set(0.5, -0.05, 0.85);
        const rl = new THREE.Mesh(archGeo);
        rl.rotation.z = Math.PI / 2;
        rl.position.set(-0.5, -0.05, -0.85);
        const rr = new THREE.Mesh(archGeo);
        rr.rotation.z = Math.PI / 2;
        rr.position.set(0.5, -0.05, -0.85);
        root.add(fl, fr, rl, rr);
        break;
      }

      case 'cylinder_limb': {
        // Shoulder ball
        const ballGeo = new THREE.SphereGeometry(0.2, 16, 16);
        const shoulder = new THREE.Mesh(ballGeo);
        shoulder.position.set(0, 0.8, 0);
        root.add(shoulder);

        // Upper arm
        const upperArmGeo = new THREE.CylinderGeometry(0.14, 0.11, 0.7, 16);
        const upperArm = new THREE.Mesh(upperArmGeo);
        upperArm.position.set(0, 0.35, 0);
        root.add(upperArm);

        // Elbow ball
        const elbow = new THREE.Mesh(ballGeo);
        elbow.position.set(0, -0.05, 0);
        elbow.scale.setScalar(0.75);
        root.add(elbow);

        // Forearm
        const forearmGeo = new THREE.CylinderGeometry(0.11, 0.08, 0.7, 16);
        const forearm = new THREE.Mesh(forearmGeo);
        forearm.position.set(0, -0.45, 0);
        root.add(forearm);

        // Wrist & Hand paddle
        const handGeo = new THREE.BoxGeometry(0.18, 0.28, 0.08);
        const hand = new THREE.Mesh(handGeo);
        hand.position.set(0, -0.9, 0);
        root.add(hand);
        break;
      }

      case 'dome_column': {
        // Base pedestal
        const baseGeo = new THREE.BoxGeometry(1.0, 0.15, 1.0);
        const base = new THREE.Mesh(baseGeo);
        base.position.set(0, -0.9, 0);
        root.add(base);

        // Column shaft
        const shaftGeo = new THREE.CylinderGeometry(0.25, 0.28, 1.2, 20);
        const shaft = new THREE.Mesh(shaftGeo);
        shaft.position.set(0, -0.2, 0);
        root.add(shaft);

        // Capital
        const capGeo = new THREE.BoxGeometry(0.85, 0.15, 0.85);
        const cap = new THREE.Mesh(capGeo);
        cap.position.set(0, 0.45, 0);
        root.add(cap);

        // Hemispherical dome
        const domeGeo = new THREE.SphereGeometry(0.65, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const dome = new THREE.Mesh(domeGeo);
        dome.position.set(0, 0.55, 0);
        root.add(dome);
        break;
      }

      case 'capsule':
      default: {
        const capGeo = new THREE.CapsuleGeometry(0.4, 1.2, 12, 24);
        const cap = new THREE.Mesh(capGeo);
        root.add(cap);
        break;
      }
    }

    // Compute bounding and normals on all submeshes
    root.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.geometry.computeVertexNormals();
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
      }
    });

    return root;
  }

  public dispose(): void {
    this.collisionGuides.forEach((g) => {
      this.removeScaffold(g.id);
    });
    this.collisionGuides.clear();
    this.colliderMeshes.clear();
  }
}
