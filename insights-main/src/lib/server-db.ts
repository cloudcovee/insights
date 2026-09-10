import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const DB_PATH           = path.join(process.cwd(), 'local-events.json');
const SITEMAP_DB_PATH   = path.join(process.cwd(), 'local-sitemaps.json');
const COLLECTIONS_PATH  = path.join(process.cwd(), 'local-collections.json');
const COLL_DATA_PATH    = path.join(process.cwd(), 'local-collection-data.json');
const SESSIONS_PATH     = path.join(process.cwd(), 'local-sessions.json');

// ---------------------------------------------------------------------------
// Existing types (unchanged)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Collections types
// ---------------------------------------------------------------------------
export type AttributeType = 'string' | 'number' | 'boolean' | 'date';

export interface CollectionAttribute {
  name: string;
  type: AttributeType;
  required: boolean;
}

export interface Collection {
  id: string;           // e.g. col_xxxxx
  name: string;
  projectId: string;    // always set from session at creation
  attributes: CollectionAttribute[];
  createdAt: string;
}

export type ItemStatus = 'staging' | 'published';
export type ValidationStatus = 'pending' | 'valid' | 'invalid';

export interface ValidationError {
  field: string;
  message: string;
}

export interface CollectionItem {
  id: string;                       // e.g. item_xxxxx
  collectionId: string;
  projectId: string;                // copied from collection at write time
  batchId: string | null;          // CSV import batch; null for manual entries
  status: ItemStatus;
  validationStatus: ValidationStatus;
  validationErrors: ValidationError[];
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------
export interface Session {
  token: string;
  userId: string;
  projectId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface SessionContext {
  userId: string;
  projectId: string;
  email: string;
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------
export function generateId(prefix: string): string {
  return `${prefix}${crypto.randomBytes(6).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
function readSessions(): Session[] {
  try {
    if (fs.existsSync(SESSIONS_PATH)) {
      return JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf-8'));
    }
  } catch (e) { console.error('Error reading sessions', e); }
  return [];
}

function writeSessions(sessions: Session[]): void {
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2), 'utf-8');
}

export function createSession(userId: string, email: string, projectId: string): Session {
  const sessions = readSessions().filter(s => new Date(s.expiresAt) > new Date());
  const session: Session = {
    token: generateId('sess_'),
    userId,
    email,
    projectId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  };
  writeSessions([...sessions, session]);
  return session;
}

export function deleteSession(token: string): void {
  const sessions = readSessions().filter(s => s.token !== token);
  writeSessions(sessions);
}

/**
 * Resolves the lumen_session cookie from the request to a SessionContext.
 * Throws a Response(401) if the session is missing or expired.
 * This is the ONLY source of projectId for authorization.
 */
export function getSessionContext(request: Request): SessionContext {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)lumen_session=([^;]+)/);
  if (!match) throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  const token = match[1];
  const sessions = readSessions();
  const session = sessions.find(s => s.token === token);

  if (!session) throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  if (new Date(session.expiresAt) <= new Date()) {
    deleteSession(token);
    throw new Response(JSON.stringify({ error: 'Session expired' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  return { userId: session.userId, projectId: session.projectId, email: session.email };
}

/**
 * Throws a Response(403) if the collection does not belong to the session's project.
 */
export function assertCollectionOwnership(collection: Collection, ctx: SessionContext): void {
  if (collection.projectId !== ctx.projectId) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
}

// ---------------------------------------------------------------------------
// Collections persistence
// ---------------------------------------------------------------------------
export function readCollections(): Collection[] {
  try {
    if (fs.existsSync(COLLECTIONS_PATH)) {
      return JSON.parse(fs.readFileSync(COLLECTIONS_PATH, 'utf-8'));
    }
  } catch (e) { console.error('Error reading collections', e); }
  return [];
}

export function writeCollections(collections: Collection[]): void {
  fs.writeFileSync(COLLECTIONS_PATH, JSON.stringify(collections, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Collection item persistence
// ---------------------------------------------------------------------------
export function readCollectionData(): CollectionItem[] {
  try {
    if (fs.existsSync(COLL_DATA_PATH)) {
      return JSON.parse(fs.readFileSync(COLL_DATA_PATH, 'utf-8'));
    }
  } catch (e) { console.error('Error reading collection data', e); }
  return [];
}

export function writeCollectionData(items: CollectionItem[]): void {
  fs.writeFileSync(COLL_DATA_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Schema-driven backend validation
// ---------------------------------------------------------------------------
export function validateItemData(
  data: Record<string, unknown>,
  attributes: CollectionAttribute[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const attr of attributes) {
    const val = data[attr.name];
    const missing = val === undefined || val === null || val === '';
    if (attr.required && missing) {
      errors.push({ field: attr.name, message: `"${attr.name}" is required` });
      continue;
    }
    if (missing) continue;
    if (attr.type === 'number' && (typeof val !== 'number' || isNaN(val as number))) {
      errors.push({ field: attr.name, message: `"${attr.name}" must be a number` });
    } else if (attr.type === 'boolean' && typeof val !== 'boolean') {
      errors.push({ field: attr.name, message: `"${attr.name}" must be true or false` });
    } else if (attr.type === 'date' && isNaN(Date.parse(String(val)))) {
      errors.push({ field: attr.name, message: `"${attr.name}" must be a valid date` });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Existing event/sitemap functions (unchanged)
// ---------------------------------------------------------------------------
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
