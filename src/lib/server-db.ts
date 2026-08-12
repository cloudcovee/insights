import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'local-events.json');
const SITEMAP_DB_PATH = path.join(process.cwd(), 'local-sitemaps.json');

export interface ServerEvent {
  id: string;
  timestamp: string;
  event: string;
  url: string;
  path: string;
  title: string;
  referrer: string;
  browser: string;
  os: string;
  device: string;
  screenSize: string;
  anonId?: string;
  projectId?: string;
  properties?: any;
}

export interface SitemapEntry {
  projectId: string;
  domain: string;
  urls: string[];
  timestamp: string;
}

export function getEvents(): ServerEvent[] {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading db", e);
  }
  return [];
}

export function addEvent(event: ServerEvent) {
  const events = getEvents();
  events.unshift(event);
  if (events.length > 1000) events.length = 1000;
  fs.writeFileSync(DB_PATH, JSON.stringify(events, null, 2), 'utf-8');
}

export function getSitemaps(): SitemapEntry[] {
  try {
    if (fs.existsSync(SITEMAP_DB_PATH)) {
      const data = fs.readFileSync(SITEMAP_DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading sitemaps db", e);
  }
  return [];
}

export function addSitemap(sitemap: SitemapEntry) {
  const sitemaps = getSitemaps();
  // Overwrite if project already exists, or append if new
  const existingIdx = sitemaps.findIndex(s => s.projectId === sitemap.projectId);
  if (existingIdx >= 0) {
    sitemaps[existingIdx] = sitemap;
  } else {
    sitemaps.push(sitemap);
  }
  fs.writeFileSync(SITEMAP_DB_PATH, JSON.stringify(sitemaps, null, 2), 'utf-8');
}
