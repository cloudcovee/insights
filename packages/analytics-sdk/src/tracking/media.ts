import { AnalyticsConfig } from '../types';
import { tracker } from './tracker';
import { configManager } from '../core/config';
import { logger } from '../utils';

class MediaTracker {
  private isInitialized = false;

  init(config: AnalyticsConfig) {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Track file inputs
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target && target.tagName === 'INPUT' && target.type === 'file') {
        if (target.files && target.files.length > 0) {
          this.trackFiles(Array.from(target.files));
        }
      }
    });

    // Track drag and drop
    document.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.trackFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  async trackFiles(files: File[]) {
    for (const file of files) {
      await this.trackSingleFile(file);
    }
  }

  async trackSingleFile(file: File) {
    const config = configManager.getConfig();
    let fileUrl = undefined;

    if (config?.storeFiles) {
      try {
        fileUrl = await this.uploadFileToBackend(file);
      } catch (err) {
        logger.warn('Failed to upload file to backend', err);
      }
    }

    const properties: any = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
    
    if (fileUrl) {
      properties.fileUrl = fileUrl;
    }

    tracker.track('file_upload', properties);
  }

  private async uploadFileToBackend(file: File): Promise<string | undefined> {
    const config = configManager.getConfig();
    if (!config?.endpoint) return undefined;
    
    const uploadEndpoint = config.endpoint.replace(/\/api\/track\b/, '/api/upload');
    const finalEndpoint = uploadEndpoint === config.endpoint ? '/api/upload' : uploadEndpoint;

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(finalEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.url;
  }
}

export const mediaTracker = new MediaTracker();

export function initMediaTracker(config: AnalyticsConfig) {
  if (config.autoTrack?.uploads) {
    mediaTracker.init(config);
  }
}
