import { EventPayload, AnalyticsConfig } from '../types';
import { getBrowserContext, getDeviceContext, getMarketingContext, getPageContext } from '../collectors';
import { sessionManager } from '../core/session';
import { eventBus } from '../core/bus';
import { transport } from '../transport';
import { storage } from '../storage';
import { logger, generateUUID } from '../utils';
import { configManager } from '../core/config';

const ANONYMOUS_ID_KEY = 'insight_anonymous_id';
const SUBSCRIBER_KEY = 'insight_subscriber_key';
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
    return this.getSubscriberKey();
  }

  getSubscriberKey(): string | undefined {
    return storage.getItem(SUBSCRIBER_KEY) || storage.getItem(USER_ID_KEY) || undefined;
  }

  track(eventName: string, properties: Record<string, any> = {}) {
    const config = configManager.getConfig();
    if (!config) {
      logger.warn('Analytics not initialized. Call Analytics.init() first.');
      return;
    }

    // SFMC Personalization auto-detection of product image URL if in browser
    if (typeof document !== 'undefined' && !properties.imageUrl) {
      const isProductContext = 
        eventName.toLowerCase().includes('product') ||
        eventName.toLowerCase().includes('cart') ||
        eventName.toLowerCase().includes('item') ||
        Boolean(properties.productId || properties.id) ||
        (typeof window !== 'undefined' && window.location.pathname.includes('/product'));

      if (isProductContext) {
        const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                      document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        if (ogImg) {
          properties.imageUrl = ogImg;
        } else {
          const prodImgEl = document.querySelector('img[data-product-image], .product-image img, .product-gallery img, #product-image') as HTMLImageElement;
          if (prodImgEl && prodImgEl.src) {
            properties.imageUrl = prodImgEl.src;
          }
        }
      }
    }

    const subscriberKey = this.getSubscriberKey();

    const payload: EventPayload = {
      apiKey: config.apiKey,
      sdkVersion: SDK_VERSION,
      anonymousId: this.getAnonymousId(),
      userId: subscriberKey,
      subscriberKey: subscriberKey,
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

  identify(subscriberKey: string, traits: Record<string, any> = {}) {
    storage.setItem(SUBSCRIBER_KEY, subscriberKey);
    storage.setItem(USER_ID_KEY, subscriberKey);
    storage.setItem(TRAITS_KEY, JSON.stringify(traits));
    this.track('user_identified', { subscriberKey, ...traits });
  }

  reset() {
    storage.removeItem(SUBSCRIBER_KEY);
    storage.removeItem(USER_ID_KEY);
    storage.removeItem(TRAITS_KEY);
    // Clear the anonId so post-logout events get a fresh anonymous identity.
    // This matches Salesforce MCP behaviour: logout clears the device cookie,
    // locking the old anonId permanently to the previous user's profile.
    storage.removeItem(ANONYMOUS_ID_KEY);
    sessionManager.reset();
    logger.log('User and session reset — new anonymous ID will be generated on next event');
  }

  group(groupId: string, traits: Record<string, any> = {}) {
    this.track('group', { groupId, ...traits });
  }
}

export const tracker = new Tracker();
