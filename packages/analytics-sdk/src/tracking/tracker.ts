import { EventPayload, AnalyticsConfig } from '../types';
import { getBrowserContext, getDeviceContext, getMarketingContext, getPageContext } from '../collectors';
import { sessionManager } from '../core/session';
import { eventBus } from '../core/bus';
import { transport } from '../transport';
import { storage } from '../storage';
import { logger, generateUUID } from '../utils';
import { configManager } from '../core/config';

const ANONYMOUS_ID_KEY = 'insight_anonymous_id';
const USER_ID_KEY = 'insight_user_id';
const TRAITS_KEY = 'insight_user_traits';
const SDK_VERSION = '1.0.0';

export class Tracker {
  
  getAnonymousId(): string {
    let anonId = storage.getItem(ANONYMOUS_ID_KEY);
    if (!anonId) {
      anonId = generateUUID();
      storage.setItem(ANONYMOUS_ID_KEY, anonId);
    }
    return anonId;
  }

  getUserId(): string | undefined {
    return storage.getItem(USER_ID_KEY) || undefined;
  }

  track(eventName: string, properties: Record<string, any> = {}) {
    const config = configManager.getConfig();
    if (!config) {
      logger.warn('Analytics not initialized. Call Analytics.init() first.');
      return;
    }

    const payload: EventPayload = {
      apiKey: config.apiKey,
      sdkVersion: SDK_VERSION,
      anonymousId: this.getAnonymousId(),
      userId: this.getUserId(),
      sessionId: sessionManager.getSessionId(),
      eventName,
      properties,
      context: {
        page: getPageContext(),
        device: getDeviceContext(),
        browser: getBrowserContext(),
        marketing: getMarketingContext()
      },
      timestamp: new Date().toISOString()
    };

    logger.log(`Tracking event: ${eventName}`, payload);
    eventBus.dispatch(payload);
  }

  page(properties?: Record<string, any>) {
    const pageContext = getPageContext();
    this.track('page_view', {
      title: pageContext.title,
      url: pageContext.url,
      path: pageContext.pathname,
      ...properties
    });
  }

  identify(userId: string, traits: Record<string, any> = {}) {
    storage.setItem(USER_ID_KEY, userId);
    storage.setItem(TRAITS_KEY, JSON.stringify(traits));
    this.track('user_identified', traits);
  }

  reset() {
    storage.removeItem(USER_ID_KEY);
    storage.removeItem(TRAITS_KEY);
    sessionManager.reset();
    logger.log('User and session reset');
  }

  group(groupId: string, traits: Record<string, any> = {}) {
    this.track('group', { groupId, ...traits });
  }
}

export const tracker = new Tracker();
