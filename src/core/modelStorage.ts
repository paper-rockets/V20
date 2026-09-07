import { Saved3DModel } from '../types';

const DB_NAME = 'Remix3DStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'converted_models';

class ModelStorageManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB is not supported in this browser environment.'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('savedDate', 'savedDate', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('originalFormat', 'originalFormat', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB.'));
      };
    });

    return this.dbPromise;
  }

  /**
   * Save or overwrite a converted 3D model in in-app local storage
   */
  public async saveModel(model: Saved3DModel): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(model);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all saved models sorted by newest first
   */
  public async getAllModels(): Promise<Saved3DModel[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as Saved3DModel[]) || [];
        // Sort descending by savedDate
        results.sort((a, b) => b.savedDate - a.savedDate);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Fetch a single saved model by ID
   */
  public async getModel(id: string): Promise<Saved3DModel | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a saved model by ID
   */
  public async deleteModel(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Rename a saved model
   */
  public async renameModel(id: string, newName: string): Promise<void> {
    const model = await this.getModel(id);
    if (!model) throw new Error('Model not found');
    model.name = newName;
    await this.saveModel(model);
  }

  /**
   * Get total storage size and item count
   */
  public async getStorageUsage(): Promise<{
    usedBytes: number;
    quotaBytes: number;
    modelCount: number;
  }> {
    try {
      const models = await this.getAllModels();
      let usedBytes = 0;
      for (const m of models) {
        usedBytes += m.blob ? m.blob.byteLength : (m.compressedSize || 0);
      }

      let quotaBytes = 500 * 1024 * 1024; // 500 MB fallback
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) {
          quotaBytes = estimate.quota;
        }
      }

      return {
        usedBytes,
        quotaBytes,
        modelCount: models.length,
      };
    } catch {
      return { usedBytes: 0, quotaBytes: 500 * 1024 * 1024, modelCount: 0 };
    }
  }

  /**
   * Clear all saved models from in-app storage
   */
  public async clearAllModels(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const ModelStorage = new ModelStorageManager();
