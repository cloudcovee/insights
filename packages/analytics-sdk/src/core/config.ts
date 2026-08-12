import { AnalyticsConfig } from '../types';

export class ConfigManager {
  private config: AnalyticsConfig | null = null;

  setConfig(config: AnalyticsConfig) {
    this.config = config;
  }

  getConfig(): AnalyticsConfig | null {
    return this.config;
  }
}

export const configManager = new ConfigManager();
