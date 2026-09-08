/**
 * @license
 * Project Serialization Engine
 * 
 * Handles bidirectional serialization between StudioEngine state and ProjectSaveData (.remix3d files).
 */

import * as THREE from 'three';
import { Layer, ProjectSaveData, StrokeDescriptor } from '../types';
import { UVPaintingEngine } from './uvPaintingEngine';
import type { UnifiedHistoryEntry } from './studioEngine';

export interface ProjectSerializationState {
  strokes: Map<string, { descriptor: StrokeDescriptor; meshes: THREE.Mesh[] }>;
  undoStack: Array<{ type: 'create' | 'erase'; strokes: StrokeDescriptor[] }>;
  redoStack: Array<{ type: 'create' | 'erase'; strokes: StrokeDescriptor[] }>;
  historyUndoStack: UnifiedHistoryEntry[];
  historyRedoStack: UnifiedHistoryEntry[];
  camera: THREE.PerspectiveCamera;
  cameraTarget: THREE.Vector3;
  cameraSpherical: THREE.Spherical;
  targetSpherical: THREE.Spherical;
  activeModelName: string;
  activeModelId: string | null;
  gridHelper: THREE.GridHelper | null;
  modelWireframeOpacity: number;
  uvEngine: UVPaintingEngine | null;
  getLayersSnapshot: () => Layer[];
  selectStroke: (id: string | null) => any;
  recreateStrokeFromDescriptor: (desc: StrokeDescriptor) => void;
  markDirty: () => void;
  notifyHistory: () => void;
  onAutoSaveTrigger?: ((reason: string) => void) | undefined;
}

export class ProjectSerializer {
  private static instance: ProjectSerializer | null = null;

  public static getInstance(): ProjectSerializer {
    if (!ProjectSerializer.instance) {
      ProjectSerializer.instance = new ProjectSerializer();
    }
    return ProjectSerializer.instance;
  }

  /**
   * Export all strokes, layers, scene environment and camera data as ProjectSaveData
   */
  public exportProjectData(
    state: ProjectSerializationState,
    projectName: string = 'Remix 3D Project',
    explicitLayers?: Layer[]
  ): ProjectSaveData {
    const serializeStroke = (desc: StrokeDescriptor): StrokeDescriptor => ({
      ...desc,
      points: desc.points.map((p) => ({
        ...p,
        position: { x: p.position.x, y: p.position.y, z: p.position.z } as any,
        normal: { x: p.normal.x, y: p.normal.y, z: p.normal.z } as any,
        tangent: p.tangent ? ({ x: p.tangent.x, y: p.tangent.y, z: p.tangent.z } as any) : undefined,
      })),
    });

    const allStrokes: StrokeDescriptor[] = [];
    state.strokes.forEach(({ descriptor }) => {
      allStrokes.push(serializeStroke(descriptor));
    });

    // Serialize undo stacks non-destructively
    const serializedUndoStack = state.undoStack.map((action) => ({
      type: action.type,
      strokes: action.strokes.map(serializeStroke),
    }));

    const serializedHistoryUndoStack = state.historyUndoStack.map((entry) => {
      if (entry.kind === 'stroke') {
        return {
          kind: 'stroke' as const,
          action: {
            type: entry.action.type,
            strokes: entry.action.strokes.map(serializeStroke),
          },
          timestamp: entry.timestamp,
        };
      } else if (entry.kind === 'transform') {
        return {
          kind: 'transform' as const,
          scope: entry.scope,
          inverseMatrix: entry.inverseMatrix.toArray(),
          forwardMatrix: entry.forwardMatrix.toArray(),
          layerId: entry.layerId,
          timestamp: entry.timestamp,
        };
      }
      return entry;
    });

    const serializedHistoryRedoStack = state.historyRedoStack.map((entry) => {
      if (entry.kind === 'stroke') {
        return {
          kind: 'stroke' as const,
          action: {
            type: entry.action.type,
            strokes: entry.action.strokes.map(serializeStroke),
          },
          timestamp: entry.timestamp,
        };
      } else if (entry.kind === 'transform') {
        return {
          kind: 'transform' as const,
          scope: entry.scope,
          inverseMatrix: entry.inverseMatrix.toArray(),
          forwardMatrix: entry.forwardMatrix.toArray(),
          layerId: entry.layerId,
          timestamp: entry.timestamp,
        };
      }
      return entry;
    });

    const uvCanvases = state.uvEngine ? state.uvEngine.exportAllCanvases() : undefined;

    const project: ProjectSaveData = {
      version: '15.0.0',
      name: projectName,
      timestamp: Date.now(),
      camera: {
        position: [state.camera.position.x, state.camera.position.y, state.camera.position.z],
        target: [state.cameraTarget.x, state.cameraTarget.y, state.cameraTarget.z],
        fov: state.camera.fov,
        spherical: {
          radius: state.cameraSpherical.radius,
          theta: state.cameraSpherical.theta,
          phi: state.cameraSpherical.phi,
        },
      },
      layers: explicitLayers && explicitLayers.length > 0 ? explicitLayers : state.getLayersSnapshot(),
      strokes: allStrokes,
      activeModelName: state.activeModelName,
      activeModelId: state.activeModelId ?? undefined,
      showGrid: state.gridHelper?.visible ?? true,
      showWireframe: state.modelWireframeOpacity > 0,
      undoStack: serializedUndoStack,
      historyUndoStack: serializedHistoryUndoStack,
      historyRedoStack: serializedHistoryRedoStack,
      uvCanvases,
    };
    return project;
  }

  /**
   * Export project to downloadable .remix3d JSON file
   */
  public exportProjectFile(state: ProjectSerializationState, filename: string = 'project.remix3d'): void {
    const data = this.exportProjectData(state, filename.replace('.remix3d', ''));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.remix3d') ? filename : `${filename}.remix3d`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import project from ProjectSaveData and recreate all strokes & layers
   */
  public async importProjectData(state: ProjectSerializationState, project: ProjectSaveData): Promise<void> {
    if (!project) return;

    // 1. Clear existing strokes
    state.strokes.forEach(({ meshes }) => {
      meshes.forEach((m) => {
        if (m.parent) m.parent.remove(m);
        m.geometry.dispose();
      });
    });
    state.strokes.clear();
    state.undoStack.length = 0;
    state.redoStack.length = 0;
    state.historyUndoStack.length = 0;
    state.historyRedoStack.length = 0;
    state.selectStroke(null);

    // 2. Restore camera if available
    if (project.camera) {
      if (project.camera.target) {
        state.cameraTarget.set(project.camera.target[0], project.camera.target[1], project.camera.target[2]);
      }
      if (project.camera.position) {
        state.camera.position.set(project.camera.position[0], project.camera.position[1], project.camera.position[2]);
        state.camera.lookAt(state.cameraTarget);
      }
      if (project.camera.fov) {
        state.camera.fov = project.camera.fov;
        state.camera.updateProjectionMatrix();
      }
      if (project.camera.spherical) {
        state.cameraSpherical.set(
          project.camera.spherical.radius,
          project.camera.spherical.phi,
          project.camera.spherical.theta
        );
        state.targetSpherical.copy(state.cameraSpherical);
      }
    }

    // 3. Rebuild strokes
    if (Array.isArray(project.strokes)) {
      for (const desc of project.strokes) {
        state.recreateStrokeFromDescriptor(desc);
      }
    }

    // 4. Restore UV canvases if available
    if (project.uvCanvases && state.uvEngine) {
      await state.uvEngine.importCanvases(project.uvCanvases);
    }

    // 5. Restore full undo/redo history
    if (Array.isArray(project.historyUndoStack) && project.historyUndoStack.length > 0) {
      const restoredUndo: UnifiedHistoryEntry[] = project.historyUndoStack.map((entry: any) => {
        if (entry.kind === 'transform') {
          return {
            ...entry,
            inverseMatrix: Array.isArray(entry.inverseMatrix)
              ? new THREE.Matrix4().fromArray(entry.inverseMatrix)
              : entry.inverseMatrix,
            forwardMatrix: Array.isArray(entry.forwardMatrix)
              ? new THREE.Matrix4().fromArray(entry.forwardMatrix)
              : entry.forwardMatrix,
          };
        }
        return entry;
      });
      state.historyUndoStack.push(...restoredUndo);

      if (Array.isArray(project.undoStack)) {
        state.undoStack.push(...project.undoStack);
      }
      if (Array.isArray(project.historyRedoStack)) {
        const restoredRedo: UnifiedHistoryEntry[] = project.historyRedoStack.map((entry: any) => {
          if (entry.kind === 'transform') {
            return {
              ...entry,
              inverseMatrix: Array.isArray(entry.inverseMatrix)
                ? new THREE.Matrix4().fromArray(entry.inverseMatrix)
                : entry.inverseMatrix,
              forwardMatrix: Array.isArray(entry.forwardMatrix)
                ? new THREE.Matrix4().fromArray(entry.forwardMatrix)
                : entry.forwardMatrix,
            };
          }
          return entry;
        });
        state.historyRedoStack.push(...restoredRedo);
      }
    } else if (Array.isArray(project.strokes) && project.strokes.length > 0) {
      // Synthesize undo stack for older projects so every loaded stroke can still be undone!
      for (const strokeDesc of project.strokes) {
        const action = {
          type: 'create' as const,
          strokes: [strokeDesc],
        };
        state.undoStack.push(action);
        state.historyUndoStack.push({
          kind: 'stroke',
          action,
          timestamp: (strokeDesc as any).timestamp || Date.now(),
        });
      }
    }

    state.markDirty();
    state.notifyHistory();
    state.onAutoSaveTrigger?.('project_loaded');
  }
}

export const projectSerializer = ProjectSerializer.getInstance();
