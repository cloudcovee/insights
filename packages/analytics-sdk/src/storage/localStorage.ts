import { logger } from '../utils/logger';

export class SafeStorage {
  private memoryCache: Record<string, string> = {};

  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        if (item) return item;
      }
    } catch (e) {
      logger.warn('localStorage not accessible, using memory cache');
    }
    return this.memoryCache[key] || null;
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      logger.warn('localStorage not accessible, using memory cache');
    }
    this.memoryCache[key] = value;
  }

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      logger.warn('localStorage not accessible, using memory cache');
    }
    delete this.memoryCache[key];
  }
}

export const storage = new SafeStorage();
