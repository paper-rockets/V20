export interface DeviceHardwareReport {
  platform: string;
  arch: string;
  os_version: string;
  is_mobile: boolean;
  hardware_concurrency: number;
  has_s_pen_support: boolean;
}

export interface FileFilterOption {
  name: string;
  extensions: string[];
}

export interface SaveFolderResult {
  success: boolean;
  filename: string;
  folderName?: string;
  mode: 'file_picker' | 'directory_picker' | 'share' | 'download';
}

/**
 * Standard Web Platform Bridge
 * Uses native browser APIs (Blob downloads, HTML5 file inputs, Vibration API)
 * with zero native-desktop/Tauri dependencies.
 */
export class PlatformBridge {

  /**
   * Retrieves device hardware & platform telemetry via browser APIs
   */
  public static async getHardwareReport(): Promise<DeviceHardwareReport> {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Android|iPhone|iPad|iPod|Tablet/i.test(ua);
    return {
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'web' : 'web',
      arch: 'web',
      os_version: ua,
      is_mobile: isMobile,
      hardware_concurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
      has_s_pen_support: isMobile && /Samsung|SM-/i.test(ua),
    };
  }

  /**
   * Saves a file directly into a folder of the user's choice using native File System Access APIs,
   * mobile native share sheets (Save to Files), or standard download fallback.
   */
  public static async saveFileToChosenFolder(
    filename: string,
    data: Uint8Array | ArrayBuffer | Blob | string,
    filters: FileFilterOption[] = [
      { name: 'Remix 3D Project', extensions: ['remix3d', 'json'] },
      { name: 'All Files', extensions: ['*'] },
    ]
  ): Promise<SaveFolderResult | null> {
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (typeof data === 'string') {
      blob = new Blob([data], { type: 'application/json' });
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      blob = new Blob([data as any], { type: 'application/octet-stream' });
    } else {
      blob = new Blob([data as any], { type: 'application/octet-stream' });
    }

    // 1. Desktop / Modern Browser File System Access API (Opens native Save As file/folder dialog)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const types = filters
          .filter((f) => f.extensions.length > 0 && !f.extensions.includes('*'))
          .map((f) => ({
            description: f.name,
            accept: {
              'application/json': f.extensions.map((ext) => `.${ext}`),
            },
          }));

        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: types.length > 0 ? types : undefined,
        });

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        return {
          success: true,
          filename: handle.name || filename,
          mode: 'file_picker',
        };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return null;
        }
        console.warn('[PlatformBridge] showSaveFilePicker unpermitted or failed, trying fallback:', err);
      }
    }

    // 2. Mobile device (Android Chrome, S25 Ultra, Tab S6 Lite) Web Share API:
    // Allows user to pick "Save to Files / device storage" or Google Drive folder
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const shareFile = new File([blob], filename, { type: blob.type || 'application/json' });
        if (navigator.canShare({ files: [shareFile] })) {
          await navigator.share({
            title: 'Save Session',
            text: `Save 3D Session: ${filename}`,
            files: [shareFile],
          });
          return {
            success: true,
            filename,
            mode: 'share',
          };
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return null;
        }
        console.warn('[PlatformBridge] navigator.share failed, falling back to download:', err);
      }
    }

    // 3. Fallback: Browser download
    const savedName = await PlatformBridge.saveModelFile(filename, blob, filters);
    return savedName
      ? { success: true, filename: savedName, mode: 'download' }
      : null;
  }

  /**
   * Directly prompts user to choose a directory/folder and saves the session file inside it.
   */
  public static async saveFileToPickedDirectory(
    filename: string,
    data: Uint8Array | ArrayBuffer | Blob | string
  ): Promise<SaveFolderResult | null> {
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (typeof data === 'string') {
      blob = new Blob([data], { type: 'application/json' });
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      blob = new Blob([data as any], { type: 'application/octet-stream' });
    } else {
      blob = new Blob([data as any], { type: 'application/octet-stream' });
    }

    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return {
          success: true,
          filename,
          folderName: dirHandle.name,
          mode: 'directory_picker',
        };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return null;
        }
        console.warn('[PlatformBridge] showDirectoryPicker failed:', err);
      }
    }

    return PlatformBridge.saveFileToChosenFolder(filename, blob);
  }

  /**
   * Standard browser file download
   */
  public static async saveModelFile(
    filename: string,
    data: Uint8Array | ArrayBuffer | Blob | string,
    _filters: FileFilterOption[] = [
      { name: '3D Models', extensions: ['glb', 'gltf', 'obj', 'stl', '3mf'] },
      { name: 'All Files', extensions: ['*'] },
    ]
  ): Promise<string | null> {
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (typeof data === 'string') {
      blob = new Blob([data], { type: 'application/json' });
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      blob = new Blob([data as any], { type: 'application/octet-stream' });
    } else {
      blob = new Blob([data as any], { type: 'application/octet-stream' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return filename;
  }

  /**
   * Standard browser file picker
   */
  public static async openModelFile(
    filters: FileFilterOption[] = [
      { name: '3D Models', extensions: ['glb', 'gltf', 'obj', 'fbx', 'stl', '3mf', 'ply', 'dae'] },
      { name: 'All Files', extensions: ['*'] },
    ]
  ): Promise<{ name: string; path: string; data: ArrayBuffer } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = filters
        .flatMap((f) => f.extensions.map((ext) => (ext === '*' ? '*/*' : `.${ext}`)))
        .join(',');

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const data = await file.arrayBuffer();
        resolve({
          name: file.name,
          path: file.name,
          data,
        });
      };
      input.click();
    });
  }

  /**
   * Web Vibration API for tactile feedback
   */
  public static triggerHaptic(pattern: 'light' | 'medium' | 'heavy' | 'selection' | 'success'): void {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        switch (pattern) {
          case 'light':
          case 'selection':
            navigator.vibrate(8);
            break;
          case 'medium':
            navigator.vibrate(18);
            break;
          case 'heavy':
            navigator.vibrate(35);
            break;
          case 'success':
            navigator.vibrate([15, 30, 25]);
            break;
        }
      }
    } catch (_) {}
  }
}
