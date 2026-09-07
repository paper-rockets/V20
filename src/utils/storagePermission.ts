// src/utils/storagePermission.ts
import { ProjectSaveData, SavedProjectSession } from '../types';

export interface StorageEstimateInfo {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  formattedUsage: string;
  formattedQuota: string;
}

export interface AutoSaveMetaInfo {
  exists: boolean;
  timestamp?: number;
  strokeCount?: number;
  layerCount?: number;
  modelName?: string;
  formattedDate?: string;
}

/**
 * Checks if the browser supports the Persistent Storage API
 */
export function isPersistenceSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.persist === 'function' &&
    typeof navigator.storage.persisted === 'function'
  );
}

/**
 * Check if the current origin has already been granted persistent storage
 */
export async function checkStoragePersistence(): Promise<boolean> {
  if (!isPersistenceSupported()) return false;
  try {
    return await navigator.storage.persisted();
  } catch (err) {
    console.warn('[Storage] Query persistence status failed:', err);
    return false;
  }
}

/**
 * Request persistent storage permission from the browser.
 * When granted, browser eviction heuristics will never purge this origin's
 * IndexedDB and Cache storage during low-disk scenarios.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (!isPersistenceSupported()) return false;
  try {
    const isGranted = await navigator.storage.persist();
    console.info(`[Storage] Storage persistence requested: ${isGranted ? 'GRANTED' : 'DENIED/UNSUPPORTED'}`);
    return isGranted;
  } catch (err) {
    console.warn('[Storage] Request persistence failed:', err);
    return false;
  }
}

/**
 * Format bytes into human-readable representation (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Query origin storage quota and actual disk usage
 */
export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  let usageBytes = 0;
  let quotaBytes = 500 * 1024 * 1024; // 500MB default fallback

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number') usageBytes = est.usage;
      if (typeof est.quota === 'number') quotaBytes = est.quota;
    } catch (err) {
      console.warn('[Storage] Storage estimate error:', err);
    }
  }

  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.round((usageBytes / quotaBytes) * 100)) : 0;

  return {
    usageBytes,
    quotaBytes,
    percentUsed,
    formattedUsage: formatBytes(usageBytes),
    formattedQuota: formatBytes(quotaBytes),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   INDEXED-DB AUTOSAVE REPOSITORY (BULLETPROOF RECOVERY)
   ────────────────────────────────────────────────────────────────────────── */

const DB_NAME = 'Remix3DAutosaveDB';
const DB_VERSION = 2;
const STORE_NAME = 'project_autosave';
const SESSIONS_STORE_NAME = 'saved_sessions';
const AUTOSAVE_RECORD_KEY = 'latest_session';

interface AutoSaveRecord {
  id: string;
  projectData: ProjectSaveData;
  timestamp: number;
  strokeCount: number;
  layerCount: number;
  modelName: string;
}

let dbInstancePromise: Promise<IDBDatabase> | null = null;

function getAutosaveDB(): Promise<IDBDatabase> {
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
        db.createObjectStore(SESSIONS_STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open Autosave IndexedDB'));
  });

  return dbInstancePromise;
}

/**
 * Commits the entire 3D project state (strokes, layers, camera, scene) to IndexedDB
 */
export async function saveAutoSaveProject(projectData: ProjectSaveData): Promise<void> {
  try {
    const db = await getAutosaveDB();
    const record: AutoSaveRecord = {
      id: AUTOSAVE_RECORD_KEY,
      projectData,
      timestamp: Date.now(),
      strokeCount: Array.isArray(projectData.strokes) ? projectData.strokes.length : 0,
      layerCount: Array.isArray(projectData.layers) ? projectData.layers.length : 0,
      modelName: projectData.activeModelName || 'Canvas',
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[Storage] Failed to commit autosave to IndexedDB:', err);
    throw err;
  }
}

/**
 * Loads the latest autosaved project from IndexedDB
 */
export async function loadAutoSaveProject(): Promise<ProjectSaveData | null> {
  try {
    const db = await getAutosaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AUTOSAVE_RECORD_KEY);

      req.onsuccess = () => {
        const record = req.result as AutoSaveRecord | undefined;
        resolve(record ? record.projectData : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Storage] Failed to read autosave from IndexedDB:', err);
    return null;
  }
}

/**
 * Checks if a valid autosave session exists in IndexedDB
 */
export async function hasAutoSaveProject(): Promise<AutoSaveMetaInfo> {
  try {
    const db = await getAutosaveDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AUTOSAVE_RECORD_KEY);

      req.onsuccess = () => {
        const record = req.result as AutoSaveRecord | undefined;
        if (record && record.projectData) {
          resolve({
            exists: true,
            timestamp: record.timestamp,
            strokeCount: record.strokeCount,
            layerCount: record.layerCount,
            modelName: record.modelName,
            formattedDate: new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        } else {
          resolve({ exists: false });
        }
      };
      req.onerror = () => resolve({ exists: false });
    });
  } catch {
    return { exists: false };
  }
}

/**
 * Clears the autosaved project from IndexedDB
 */
export async function clearAutoSaveProject(): Promise<void> {
  try {
    const db = await getAutosaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(AUTOSAVE_RECORD_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Storage] Clear autosave failed:', err);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   USER PROJECT SESSIONS REPOSITORY (NAMED SESSIONS)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Saves a named project session into IndexedDB
 */
export async function saveProjectSession(session: SavedProjectSession): Promise<void> {
  try {
    const db = await getAutosaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const req = store.put(session);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[Storage] Failed to save project session:', err);
    throw err;
  }
}

/**
 * Loads all saved project sessions sorted by most recent
 */
export async function getAllProjectSessions(): Promise<SavedProjectSession[]> {
  try {
    const db = await getAutosaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE_NAME], 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const sessions = (req.result as SavedProjectSession[]) || [];
        sessions.sort((a, b) => b.timestamp - a.timestamp);
        resolve(sessions);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Storage] Failed to get project sessions:', err);
    return [];
  }
}

/**
 * Loads a single project session by ID
 */
export async function loadProjectSession(id: string): Promise<SavedProjectSession | null> {
  try {
    const db = await getAutosaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE_NAME], 'readonly');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        resolve((req.result as SavedProjectSession) || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Storage] Failed to load project session:', err);
    return null;
  }
}

/**
 * Deletes a project session by ID
 */
export async function deleteProjectSession(id: string): Promise<void> {
  try {
    const db = await getAutosaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE_NAME], 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Storage] Failed to delete project session:', err);
  }
}

