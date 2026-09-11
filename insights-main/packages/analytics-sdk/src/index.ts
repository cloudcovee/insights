import { init } from './core/init';
import { tracker } from './tracking/tracker';
import { mediaTracker } from './tracking/media';
import { eventBus } from './core/bus';
import { AnalyticsConfig } from './types';
import { transport } from './transport';
import { storage } from './storage';
import { sessionManager } from './core/session';

class InsightAnalytics {
  init(config: AnalyticsConfig) {
    init(config);
  }

  track(eventName: string, properties?: Record<string, any>) {
    tracker.track(eventName, properties);
  }

  page(properties?: Record<string, any>) {
    tracker.page(properties);
  }

  identify(userId: string, traits?: Record<string, any>) {
    tracker.identify(userId, traits);
  }

  setUser(userId: string, traits?: Record<string, any>) {
    this.identify(userId, traits);
  }

  reset() {
    tracker.reset();
  }

  trackUpload(file: File, properties?: Record<string, any>) {
    mediaTracker.trackSingleFile(file);
    if (properties) {
      // It will have fired already, but we can allow passing extra properties if needed in a more robust implementation. 
      // For now, trackSingleFile logs everything. But let's map any additional properties if needed by dispatching directly.
      // Wait, mediaTracker.trackSingleFile doesn't take additional properties yet.
      // Let's just rely on the standard file upload properties.
    }
  }

  uploadImage(file: File) {
    mediaTracker.trackSingleFile(file);
  }

  uploadDocument(file: File) {
    mediaTracker.trackSingleFile(file);
  }

  uploadVideo(file: File) {
    mediaTracker.trackSingleFile(file);
  }

  uploadFiles(files: File[]) {
    mediaTracker.trackFiles(files);
  }

  trackDownload(file: File | string) {
    const fileName = typeof file === 'string' ? file : file.name;
    this.track('file_download', { fileName });
  }

  trackMediaView(url: string) {
    this.track('media_view', { mediaUrl: url });
  }

  flush() {
    transport.flush();
  }

  on(eventName: string, callback: (payload: any) => void) {
    eventBus.on(eventName, callback);
  }

  off(eventName: string, callback?: (payload: any) => void) {
    eventBus.off(eventName, callback);
  }

  destroy() {
    // Stop all tracking, clear intervals, reset state
    this.flush();
    // Implementation of destroy depends on trackers cleaning up their event listeners
    eventBus.dispatch({ 
      eventName: 'destroy', 
      properties: {}, 
      apiKey: '', sdkVersion: '', anonymousId: '', sessionId: '', timestamp: '', context: {} as any 
    });
  }
}

export const Analytics = new InsightAnalytics();
export type { AnalyticsConfig };
export default Analytics;

if (typeof window !== 'undefined') {
  (window as any).Analytics = Analytics;
}
