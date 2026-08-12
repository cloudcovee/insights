import { AnalyticsConfig } from '../types';
import { configManager } from './config';
import { logger } from '../utils';
import { transport } from '../transport';
import { sessionManager } from './session';
import { eventBus } from './bus';
import { initAutoTrackers } from '../tracking/auto-trackers';
import { initSitemapScanner } from '../tracking/sitemap-scanner';
import { initMediaTracker } from '../tracking/media';

export function init(config: AnalyticsConfig) {
  if (configManager.getConfig()) {
    logger.warn('Analytics already initialized');
    return;
  }

  if (!config.apiKey || !config.endpoint) {
    console.error('[Analytics SDK] Initialization failed: apiKey and endpoint are required');
    return;
  }

  if (config.debug) {
    logger.setDebug(true);
  }

  logger.log('Initializing Analytics SDK', config);

  configManager.setConfig(config);
  transport.setEndpoint(config.endpoint);
  sessionManager.getSessionId();

  // Wire event bus to transport (all events go to transport queue)
  eventBus.use((payload, next) => {
    transport.enqueue(payload);
    next(payload);
  });

  // Setup auto trackers (Page views, Clicks, Scroll, Forms, etc.)
  initAutoTrackers(config);
  
  // Setup sitemap scanner
  initSitemapScanner(config);

  // Setup media tracker
  initMediaTracker(config);

  logger.log('Analytics SDK initialized successfully');
}
