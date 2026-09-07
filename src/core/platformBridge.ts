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
