export interface AnalyticsConfig {
  apiKey: string;
  endpoint?: string;
  debug?: boolean;
  sessionTimeout?: number; // in minutes, default 30
  storeFiles?: boolean; // If true, upload tracked files to endpoint
  autoTrack?: {
    pageViews?: boolean;
    clicks?: boolean;
    scroll?: boolean;
    errors?: boolean;
    performance?: boolean;
    outboundLinks?: boolean;
    downloads?: boolean;
    forms?: boolean;
    spa?: boolean;
    uploads?: boolean; // Automatically track file inputs and drag-drop
  };
}

export interface PageContext {
  url: string;
  hostname: string;
  pathname: string;
  title: string;
  referrer: string;
  search: string;
}

export interface DeviceContext {
  type: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface BrowserContext {
  userAgent: string;
  language: string;
  timezone: string;
  name: string;
  version: string;
  os: string;
}

export interface MarketingContext {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export interface PerformanceContext {
  loadTime?: number;
  domReadyTime?: number;
  timeToFirstByte?: number;
}

export interface EventContext {
  page: PageContext;
  device: DeviceContext;
  browser: BrowserContext;
  marketing: MarketingContext;
  performance?: PerformanceContext;
}

export interface EventPayload {
  apiKey: string;
  sdkVersion: string;
  anonymousId: string;
  userId?: string;
  sessionId: string;
  eventName: string;
  properties: Record<string, any>;
  context: EventContext;
  timestamp: string; // ISO 8601 string
}
