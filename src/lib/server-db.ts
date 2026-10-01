import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { formatUserId } from './utils';
import { triggerAutomations } from './automations';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const DB_PATH              = path.join(process.cwd(), 'local-events.json');
const SITEMAP_DB_PATH      = path.join(process.cwd(), 'local-sitemaps.json');
const COLLECTIONS_PATH     = path.join(process.cwd(), 'local-collections.json');
const COLL_DATA_PATH       = path.join(process.cwd(), 'local-collection-data.json');
const SESSIONS_PATH        = path.join(process.cwd(), 'local-sessions.json');
const PROFILES_PATH        = path.join(process.cwd(), 'local-profiles.json');
const DELETED_PRODUCTS_PATH = path.join(process.cwd(), 'local-deleted-products.json');

// ---------------------------------------------------------------------------
// Existing types (unchanged)
// ---------------------------------------------------------------------------
export interface UnifiedProfile {
  subscriberKey: string;          // Master root key: known customer ID or anon_<15-char-id>
  profileId?: string;             // Legacy / alias identifier
  anonymousIds: string[];         // All connected anonymous device IDs (15-char format)
  attributes?: Record<string, any>;
  firstSeen: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

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
  userId?: string;
  subscriberKey?: string;
  profileId?: string;
  projectId?: string;
  ip?: string;
  country?: string;
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

const ALPHANUMERIC_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function generateEventId(existingIds?: Set<string>): string {
  if (!existingIds) {
    const events = getRawEvents();
    existingIds = new Set(events.map(e => e.id).filter(Boolean));
  }

  let len = 4;
  let attempts = 0;

  while (true) {
    let id = '';
    for (let i = 0; i < len; i++) {
      id += ALPHANUMERIC_CHARS.charAt(Math.floor(Math.random() * ALPHANUMERIC_CHARS.length));
    }

    if (!existingIds.has(id)) {
      existingIds.add(id);
      return id;
    }

    attempts++;
    if (attempts >= 20 || existingIds.size >= Math.pow(36, len) * 0.75) {
      len++;
      attempts = 0;
    }
  }
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
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  writeSessions([...sessions, session]);
  return session;
}

export function deleteSession(token: string): void {
  const sessions = readSessions().filter(s => s.token !== token);
  writeSessions(sessions);
}

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
// Deleted product block list — scoped by "collectionId:productId"
// so a delete in one catalog never blocks products in other catalogs/accounts.
// ---------------------------------------------------------------------------
function scopedKey(collectionId: string, pId: string): string {
  return `${collectionId}:${pId}`;
}

function readDeletedSet(): Set<string> {
  try {
    if (fs.existsSync(DELETED_PRODUCTS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DELETED_PRODUCTS_PATH, 'utf-8'));
      // Support old flat-array format (bare productIds) — treated as global; migrate on next write
      if (Array.isArray(raw)) return new Set(raw);
    }
  } catch {}
  return new Set();
}

export function markProductIdDeleted(itemData: Record<string, unknown>, collectionId: string): void {
  // User requested to remove the blocklist behavior entirely so products automatically populate again.
  // We keep the function signature and calls intact to satisfy existing rules, but it no longer adds to the blocklist.
}

function isProductDeleted(collectionId: string, pId: string): boolean {
  const deleted = readDeletedSet();
  // Check scoped key first, then fall back to bare pId for backwards compat
  return deleted.has(scopedKey(collectionId, pId)) || deleted.has(pId);
}

// ---------------------------------------------------------------------------
// Entity-aware catalog routing.
// Product-related events go to the "products" catalog; category-related events
// go to the "categories" catalog. Catalogs are matched loosely by name and never
// filtered strictly by projectId — events arrive with a different projectId than
// the catalogs, so strict filtering would break auto-add.
// ---------------------------------------------------------------------------
type CatalogEntity = 'product' | 'category';

function detectEntityType(
  eventName: string,
  props: Record<string, unknown>,
  eventUrl?: string
): CatalogEntity | null {
  const ev = (eventName || '').toLowerCase();
  const url = (eventUrl || String(props.url || '')).toLowerCase();
  if (ev.includes('category') || props.categoryId || url.includes('/category/')) return 'category';
  if (
    ev.includes('product') ||
    ev.includes('cart') ||
    ev.includes('item') ||
    props.productId ||
    props.id ||
    url.includes('/product/')
  ) {
    return 'product';
  }
  return null;
}

function resolveCatalogForEntity(cols: Collection[], entity: CatalogEntity): Collection | undefined {
  const hint = entity === 'category' ? 'categor' : 'product';
  return cols.find(c => c.name.toLowerCase().includes(hint));
}

function entityIdField(entity: CatalogEntity): 'productId' | 'categoryId' {
  return entity === 'category' ? 'categoryId' : 'productId';
}

function resolveEntityId(
  entity: CatalogEntity,
  props: Record<string, unknown>,
  eventUrl?: string
): string {
  const field = entityIdField(entity);
  let id = String(props[field] || props.id || '').toLowerCase().trim();
  if (!id && eventUrl && eventUrl.includes(`/${entity}/`)) {
    const match = eventUrl.match(new RegExp(`\\/${entity}\\/([^\\/\\?]+)`, 'i'));
    if (match) id = match[1].toLowerCase().trim();
  }
  return id;
}

function buildItemData(
  entity: CatalogEntity,
  eId: string,
  props: Record<string, unknown>
): Record<string, unknown> {
  const name =
    String(props.name || props.productName || props.categoryName || '').trim() ||
    (entity === 'category' ? `Category ${eId}` : `Product ${eId}`);
  // Image: strictly use what the client sent — never fabricate
  const imageUrl = String(props.imageUrl || props.image || props.productImage || props.img || '').trim();
  const data: Record<string, unknown> = {
    [entityIdField(entity)]: eId,
    name,
    ...(imageUrl ? { imageUrl } : {}),
  };
  if (entity === 'product') {
    data.price = Number(props.price) > 0 ? Number(props.price) : 0;
    data.category = String(props.category || 'General').trim();
  } else {
    const description = String(props.description || '').trim();
    if (description) data.description = description;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Real-time catalog upsert (called on product/category view event ingest).
// Routes the item into the catalog matching its entity type, creates it
// immediately so it appears without a refresh, and back-fills missing fields.
// ---------------------------------------------------------------------------
export function upsertProductIntoCatalog(
  props: Record<string, unknown>,
  eventUrl?: string,
  eventName?: string
): void {
  try {
    const entity = detectEntityType(eventName || String(props.eventName || props.event || ''), props, eventUrl);
    if (!entity) return;

    const cols = readCollections();
    // Route to the catalog matching this entity type; never drop an item into the wrong catalog
    const col = resolveCatalogForEntity(cols, entity);
    if (!col) return;

    const eId = resolveEntityId(entity, props, eventUrl);
    if (!eId) return;

    // Never re-create an item the user explicitly deleted from this catalog
    if (isProductDeleted(col.id, eId)) return;

    const idField = entityIdField(entity);
    const allItems = readCollectionData();
    const existingIdx = allItems.findIndex(i => {
      const d = i.data || {};
      return (
        i.collectionId === col.id &&
        String(d[idField] || d.id || '').toLowerCase().trim() === eId
      );
    });

    const data = buildItemData(entity, eId, props);
    const rawUrl = String(props.url || eventUrl || `/${entity}/${eId}`).trim();
    const fullUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `http://localhost:3000${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    data.url = fullUrl;

    if (existingIdx === -1) {
      // Item not in catalog yet — create it
      const newItem: CollectionItem = {
        id: `item_auto_${eId}`,
        collectionId: col.id,
        projectId: col.projectId || 'proj_default',
        batchId: null,
        status: 'published',
        validationStatus: 'valid',
        validationErrors: [],
        data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      allItems.push(newItem);
      writeCollectionData(allItems);
    } else {
      // Item already exists — only patch fields that are missing/empty
      // so we never overwrite data a user may have manually corrected
      const d = allItems[existingIdx].data as Record<string, unknown>;
      let changed = false;

      if (!d.imageUrl && data.imageUrl) { d.imageUrl = data.imageUrl; changed = true; }
      if (!d.name || String(d.name) === `Product ${eId}` || String(d.name) === `Category ${eId}`) {
        d.name = data.name;
        changed = true;
      }
      if (entity === 'product') {
        if ((!d.price || Number(d.price) === 0) && Number(data.price) > 0) { d.price = data.price; changed = true; }
        if (!d.category || d.category === 'General') { d.category = data.category; changed = true; }
      } else if (data.description && !d.description) {
        d.description = data.description;
        changed = true;
      }

      if (changed) {
        allItems[existingIdx].data = d;
        allItems[existingIdx].updatedAt = new Date().toISOString();
        writeCollectionData(allItems);
      }
    }
  } catch (err) {
    console.error('Error upserting product into catalog:', err);
  }
}

export function syncProductsCatalogFromEvents(collectionId: string): void {
  // User requested to disable historical auto-sync so products only populate in real-time
  // when a user actually views the specific product page (via upsertProductIntoCatalog).
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

export function getProfiles(): UnifiedProfile[] {
  try {
    if (!fs.existsSync(PROFILES_PATH)) {
      ensureInitialProfiles();
    }
    if (fs.existsSync(PROFILES_PATH)) {
      const data = fs.readFileSync(PROFILES_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading profiles db", e);
  }
  return [];
}

export function writeProfiles(profiles: UnifiedProfile[]): void {
  try {
    fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing profiles db", e);
  }
}

export function cleanIdentifier(id?: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  const trimmed = id.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower === 'unknown' || lower === 'undefined' || lower === 'null' || lower === '[object object]') {
    return undefined;
  }
  return trimmed;
}

export function cleanAnonId(id?: unknown): string | undefined {
  const cleaned = cleanIdentifier(id);
  if (!cleaned) return undefined;
  const stripped = cleaned.startsWith('anon_') ? cleaned.replace('anon_', '') : cleaned;
  return formatUserId(stripped);
}

export function emailToSalesforceContactId(email: string): string {
  const hash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  return `003${hash.substring(0, 12)}AA0`;
}

export function generateSalesforceContactId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let body = '';
  for (let i = 0; i < 12; i++) {
    body += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `003${body}AA0`;
}

export function ensureInitialProfiles(): void {
  try {
    if (fs.existsSync(PROFILES_PATH)) {
      const raw = fs.readFileSync(PROFILES_PATH, 'utf-8');
      const profiles: any[] = JSON.parse(raw);
      let changed = false;
      for (const p of profiles) {
        if (Array.isArray(p.anonymousIds)) {
          const formattedAids = p.anonymousIds.map((aid: string) => cleanAnonId(aid) || aid);
          if (JSON.stringify(formattedAids) !== JSON.stringify(p.anonymousIds)) {
            p.anonymousIds = formattedAids;
            changed = true;
          }
        }
        if (!p.subscriberKey || p.subscriberKey.startsWith('anon_') || p.subscriberKey.startsWith('prof_')) {
          const firstAnon = p.anonymousIds && p.anonymousIds[0];
          if (firstAnon) {
            const newKey = `anon_${cleanAnonId(firstAnon)}`;
            if (p.subscriberKey !== newKey) {
              p.subscriberKey = newKey;
              p.profileId = newKey;
              changed = true;
            }
          } else if (!p.subscriberKey) {
            p.subscriberKey = p.profileId || `anon_${formatUserId(generateId('anon_'))}`;
            p.profileId = p.subscriberKey;
            changed = true;
          }
        }
        if (!p.profileId) {
          p.profileId = p.subscriberKey;
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
      }
      return;
    }

    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const events: ServerEvent[] = JSON.parse(raw);
      const profileMap = new Map<string, UnifiedProfile>();

      const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      for (const e of sorted) {
        let rawSub = cleanIdentifier(e.subscriberKey) || cleanIdentifier(e.userId);
        const eventEmail = cleanIdentifier(e.properties?.email) || (rawSub && rawSub.includes('@') ? rawSub : undefined);
        let subKey = rawSub;
        if (subKey && subKey.includes('@')) {
          subKey = emailToSalesforceContactId(subKey);
        }
        const anonId = cleanAnonId(e.anonId);
        const time = e.timestamp || new Date().toISOString();

        let targetKey = subKey || (anonId ? `anon_${anonId}` : undefined);
        if (!targetKey) continue;

        const anonKey = anonId ? `anon_${anonId}` : undefined;
        if (subKey && anonKey && profileMap.has(anonKey) && !profileMap.has(subKey)) {
          const existing = profileMap.get(anonKey)!;
          existing.subscriberKey = subKey;
          existing.profileId = subKey;
          if (eventEmail) {
            existing.attributes = existing.attributes || {};
            existing.attributes.email = eventEmail;
          }
          profileMap.delete(anonKey);
          profileMap.set(subKey, existing);
          targetKey = subKey;
        }

        if (!profileMap.has(targetKey)) {
          profileMap.set(targetKey, {
            subscriberKey: targetKey,
            profileId: targetKey,
            anonymousIds: anonId ? [anonId] : [],
            attributes: {
              ...(e.properties || {}),
              ...(eventEmail ? { email: eventEmail } : {})
            },
            firstSeen: time,
            lastSeen: time,
            createdAt: time,
            updatedAt: time
          });
        } else {
          const p = profileMap.get(targetKey)!;
          if (anonId && !p.anonymousIds.some(aid => aid.toLowerCase() === anonId.toLowerCase())) {
            p.anonymousIds.push(anonId);
          }
          if (subKey && (p.subscriberKey.startsWith('anon_') || !p.subscriberKey)) {
            p.subscriberKey = subKey;
            p.profileId = subKey;
          }
          if (eventEmail) {
            p.attributes = p.attributes || {};
            p.attributes.email = eventEmail;
          }
          p.lastSeen = time;
          p.updatedAt = time;
        }
      }

      const initialProfiles = Array.from(profileMap.values());
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(initialProfiles, null, 2), 'utf-8');
    }
  } catch (e) {
    console.error("Error seeding initial profiles", e);
  }
}

export function resolveProfile(params: {
  anonymousId?: string;
  subscriberKey?: string;
  userId?: string;
  timestamp?: string;
  properties?: any;
}): UnifiedProfile {
  const profiles = getProfiles();
  const now = params.timestamp || new Date().toISOString();
  let rawSubKey = cleanIdentifier(params.subscriberKey) || cleanIdentifier(params.userId);
  let email = cleanIdentifier(params.properties?.email) || (rawSubKey && rawSubKey.includes('@') ? rawSubKey : undefined);
  const anonId = cleanAnonId(params.anonymousId);

  let subKey = rawSubKey;
  if (subKey && subKey.includes('@')) {
    const existingByEmail = profiles.find(p => p.attributes?.email && p.attributes.email.toLowerCase() === email?.toLowerCase());
    if (existingByEmail && existingByEmail.subscriberKey && !existingByEmail.subscriberKey.includes('@') && !existingByEmail.subscriberKey.startsWith('anon_')) {
      subKey = existingByEmail.subscriberKey;
    } else {
      subKey = emailToSalesforceContactId(subKey);
    }
  }

  const props = { ...(params.properties || {}) };
  if (email && !props.email) {
    props.email = email;
  }

  let profile: UnifiedProfile | undefined;

  if (subKey) {
    const knownIdx = profiles.findIndex(p => p.subscriberKey && p.subscriberKey.toLowerCase() === subKey.toLowerCase());
    const anonIdx = anonId ? profiles.findIndex(p => 
      (p.subscriberKey && p.subscriberKey.toLowerCase() === `anon_${anonId.toLowerCase()}`) ||
      p.anonymousIds.some(aid => aid.toLowerCase() === anonId.toLowerCase() || cleanAnonId(aid)?.toLowerCase() === anonId.toLowerCase())
    ) : -1;

    const isAnonClaimedByOther = anonIdx >= 0 && Boolean(
      profiles[anonIdx].subscriberKey && 
      !profiles[anonIdx].subscriberKey.startsWith('anon_') && 
      profiles[anonIdx].subscriberKey.toLowerCase() !== subKey.toLowerCase()
    );

    if (knownIdx >= 0 && anonIdx >= 0 && knownIdx !== anonIdx) {
      const knownProfile = profiles[knownIdx];
      const anonProfile = profiles[anonIdx];

      const isAnonPure = !anonProfile.subscriberKey || anonProfile.subscriberKey.startsWith('anon_') || anonProfile.subscriberKey.toLowerCase() === subKey.toLowerCase();

      if (isAnonPure) {
        for (const id of anonProfile.anonymousIds) {
          const normId = cleanAnonId(id) || id;
          if (!knownProfile.anonymousIds.some(existing => existing.toLowerCase() === normId.toLowerCase())) {
            knownProfile.anonymousIds.push(normId);
          }
        }
        knownProfile.attributes = { ...anonProfile.attributes, ...knownProfile.attributes, ...props };
        if (new Date(anonProfile.firstSeen).getTime() < new Date(knownProfile.firstSeen).getTime()) {
          knownProfile.firstSeen = anonProfile.firstSeen;
        }
        if (new Date(now).getTime() > new Date(knownProfile.lastSeen).getTime()) {
          knownProfile.lastSeen = now;
        }
        knownProfile.updatedAt = now;

        profiles.splice(anonIdx, 1);
        profile = knownProfile;
      } else {
        knownProfile.attributes = { ...knownProfile.attributes, ...props };
        knownProfile.updatedAt = now;
        profile = knownProfile;
      }
    } else if (knownIdx >= 0) {
      profile = profiles[knownIdx];
      if (anonId && !isAnonClaimedByOther && !profile.anonymousIds.some(existing => existing.toLowerCase() === anonId.toLowerCase())) {
        profile.anonymousIds.push(anonId);
      }
      if (new Date(now).getTime() > new Date(profile.lastSeen).getTime()) {
        profile.lastSeen = now;
      }
      profile.updatedAt = now;
      profile.attributes = { ...profile.attributes, ...props };
    } else if (anonIdx >= 0) {
      const existingAnon = profiles[anonIdx];
      if (!existingAnon.subscriberKey || existingAnon.subscriberKey.startsWith('anon_') || existingAnon.subscriberKey.toLowerCase() === subKey.toLowerCase()) {
        existingAnon.subscriberKey = subKey;
        existingAnon.profileId = subKey;
        if (anonId && !existingAnon.anonymousIds.some(existing => existing.toLowerCase() === anonId.toLowerCase())) {
          existingAnon.anonymousIds.push(anonId);
        }
        if (new Date(now).getTime() > new Date(existingAnon.lastSeen).getTime()) {
          existingAnon.lastSeen = now;
        }
        existingAnon.updatedAt = now;
        existingAnon.attributes = { ...existingAnon.attributes, ...props };
        profile = existingAnon;
      } else {
        profile = {
          subscriberKey: subKey,
          profileId: subKey,
          anonymousIds: [],
          attributes: props,
          firstSeen: now,
          lastSeen: now,
          createdAt: now,
          updatedAt: now
        };
        profiles.unshift(profile);
      }
    } else {
      const isClaimedAcrossAll = anonId ? profiles.some(p => 
        p.subscriberKey && 
        !p.subscriberKey.startsWith('anon_') && 
        p.subscriberKey.toLowerCase() !== subKey.toLowerCase() &&
        p.anonymousIds.some(aid => aid.toLowerCase() === anonId.toLowerCase() || cleanAnonId(aid)?.toLowerCase() === anonId.toLowerCase())
      ) : false;

      profile = {
        subscriberKey: subKey,
        profileId: subKey,
        anonymousIds: (anonId && !isClaimedAcrossAll) ? [anonId] : [],
        attributes: props,
        firstSeen: now,
        lastSeen: now,
        createdAt: now,
        updatedAt: now
      };
      profiles.unshift(profile);
    }
  } else if (anonId) {
    const anonSubKey = `anon_${anonId}`;
    const anonIdx = profiles.findIndex(p => 
      (p.subscriberKey && (p.subscriberKey.toLowerCase() === anonSubKey.toLowerCase() || p.subscriberKey.toLowerCase() === anonId.toLowerCase())) ||
      p.anonymousIds.some(aid => aid.toLowerCase() === anonId.toLowerCase() || cleanAnonId(aid)?.toLowerCase() === anonId.toLowerCase())
    );

    if (anonIdx >= 0) {
      profile = profiles[anonIdx];
      if (!profile.subscriberKey || profile.subscriberKey.startsWith('anon_')) {
        profile.subscriberKey = anonSubKey;
        profile.profileId = anonSubKey;
      }
      if (!profile.anonymousIds.some(aid => aid.toLowerCase() === anonId.toLowerCase())) {
        profile.anonymousIds.push(anonId);
      }
      if (new Date(now).getTime() > new Date(profile.lastSeen).getTime()) {
        profile.lastSeen = now;
      }
      profile.updatedAt = now;
    } else {
      profile = {
        subscriberKey: anonSubKey,
        profileId: anonSubKey,
        anonymousIds: [anonId],
        attributes: props,
        firstSeen: now,
        lastSeen: now,
        createdAt: now,
        updatedAt: now
      };
      profiles.unshift(profile);
    }
  } else {
    const fallbackAnon = `anon_${formatUserId(generateId('anon_'))}`;
    profile = {
      subscriberKey: fallbackAnon,
      profileId: fallbackAnon,
      anonymousIds: [],
      attributes: props,
      firstSeen: now,
      lastSeen: now,
      createdAt: now,
      updatedAt: now
    };
    profiles.unshift(profile);
  }

  writeProfiles(profiles);
  return profile;
}

export function getProfileByIdentifier(identifier: string): UnifiedProfile | null {
  const cleaned = cleanIdentifier(identifier);
  if (!cleaned) return null;
  const profiles = getProfiles();
  const idLower = cleaned.toLowerCase();
  const formattedAnon = cleanAnonId(cleaned)?.toLowerCase();

  const computedContactId = cleaned.includes('@') ? emailToSalesforceContactId(cleaned).toLowerCase() : null;

  return profiles.find(p => 
    (p.subscriberKey && p.subscriberKey.toLowerCase() === idLower) ||
    (p.profileId && p.profileId.toLowerCase() === idLower) ||
    (formattedAnon && p.subscriberKey && p.subscriberKey.toLowerCase() === `anon_${formattedAnon}`) ||
    (computedContactId && p.subscriberKey && p.subscriberKey.toLowerCase() === computedContactId) ||
    (p.attributes?.email && typeof p.attributes.email === 'string' && p.attributes.email.toLowerCase() === idLower) ||
    p.anonymousIds.some(aid => {
      const aidLower = aid.toLowerCase();
      return aidLower === idLower || (formattedAnon && aidLower === formattedAnon);
    })
  ) || null;
}

export function getProfileEvents(identifier: string): ServerEvent[] {
  const profile = getProfileByIdentifier(identifier);
  const events = getEvents();

  if (!profile) {
    const cleaned = cleanIdentifier(identifier);
    if (!cleaned) return [];
    const idLower = cleaned.toLowerCase();
    const formattedAnon = cleanAnonId(cleaned)?.toLowerCase();
    return events.filter(e => 
      (e.subscriberKey && e.subscriberKey.toLowerCase() === idLower) ||
      (e.profileId && e.profileId.toLowerCase() === idLower) ||
      (e.userId && e.userId.toLowerCase() === idLower) ||
      (e.anonId && (e.anonId.toLowerCase() === idLower || (formattedAnon && e.anonId.toLowerCase() === formattedAnon)))
    );
  }

  const anonSet = new Set(profile.anonymousIds.map(a => a.toLowerCase()));
  const subKeyLower = profile.subscriberKey?.toLowerCase();
  const profIdLower = profile.profileId?.toLowerCase();
  const emailLower = profile.attributes?.email ? String(profile.attributes.email).toLowerCase() : null;

  return events.filter(e => {
    if (subKeyLower && (
      (e.subscriberKey && e.subscriberKey.toLowerCase() === subKeyLower) ||
      (e.userId && e.userId.toLowerCase() === subKeyLower) ||
      (e.profileId && e.profileId.toLowerCase() === subKeyLower)
    )) return true;
    if (profIdLower && e.profileId && e.profileId.toLowerCase() === profIdLower) return true;
    if (emailLower && (
      (e.properties?.email && String(e.properties.email).toLowerCase() === emailLower) ||
      (e.subscriberKey && e.subscriberKey.toLowerCase() === emailLower) ||
      (e.userId && e.userId.toLowerCase() === emailLower)
    )) return true;
    if (e.anonId && (anonSet.has(e.anonId.toLowerCase()) || (subKeyLower && subKeyLower === `anon_${e.anonId.toLowerCase()}`))) return true;
    return false;
  });
}

export function getRawEvents(): ServerEvent[] {
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

export function getEvents(): ServerEvent[] {
  const events = getRawEvents();
  const profiles = getProfiles();

  const anonToProfile = new Map<string, UnifiedProfile>();
  const subToProfile = new Map<string, UnifiedProfile>();
  const emailToProfile = new Map<string, UnifiedProfile>();

  const sortedProfiles = [...profiles].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const p of sortedProfiles) {
    if (p.subscriberKey) subToProfile.set(p.subscriberKey.toLowerCase(), p);
    if (p.profileId) subToProfile.set(p.profileId.toLowerCase(), p);
    if (p.attributes?.email && typeof p.attributes.email === 'string') {
      const email = p.attributes.email.toLowerCase();
      emailToProfile.set(email, p);
      const sfId = emailToSalesforceContactId(email).toLowerCase();
      emailToProfile.set(sfId, p);
    }
    for (const aid of p.anonymousIds) {
      anonToProfile.set(aid.toLowerCase(), p);
      const cleanAid = cleanAnonId(aid);
      if (cleanAid) anonToProfile.set(cleanAid.toLowerCase(), p);
    }
  }

  for (const e of events) {
    let resolvedProfile: UnifiedProfile | undefined;
    const rawSub = cleanIdentifier(e.subscriberKey) || cleanIdentifier(e.userId);
    const subKey = rawSub ? rawSub.toLowerCase() : undefined;
    const anonId = cleanAnonId(e.anonId)?.toLowerCase();
    const eventEmail = cleanIdentifier(e.properties?.email)?.toLowerCase();

    if (subKey) {
      resolvedProfile = subToProfile.get(subKey) || (eventEmail ? emailToProfile.get(eventEmail) : undefined);
    }
    if (!resolvedProfile && eventEmail) {
      resolvedProfile = emailToProfile.get(eventEmail);
    }
    if (!resolvedProfile && anonId) {
      resolvedProfile = anonToProfile.get(anonId);
    }

    if (resolvedProfile) {
      e.subscriberKey = resolvedProfile.subscriberKey;
      e.profileId = resolvedProfile.profileId || resolvedProfile.subscriberKey;
    } else if (anonId && (!e.subscriberKey || e.subscriberKey.startsWith('anon_'))) {
      e.subscriberKey = `anon_${anonId}`;
      e.profileId = `anon_${anonId}`;
    }
  }

  return events;
}

export function addEvent(event: Omit<ServerEvent, 'id' | 'timestamp'> & { timestamp?: string }): ServerEvent {
  const events = getRawEvents();
  const existingIds = new Set(events.map(e => e.id).filter(Boolean));

  const profile = resolveProfile({
    anonymousId: event.anonId,
    subscriberKey: event.subscriberKey,
    userId: event.userId,
    timestamp: event.timestamp,
    properties: event.properties
  });

  const fullEvent: ServerEvent = {
    ...event,
    id: generateEventId(existingIds),
    timestamp: event.timestamp || new Date().toISOString(),
    subscriberKey: profile.subscriberKey,
    profileId: profile.profileId || profile.subscriberKey,
  };

  events.unshift(fullEvent);
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(events, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error saving event to db", e);
  }

  triggerAutomations(fullEvent).catch(err => {
    console.error("[Automations] Execution error:", err);
  });

  return fullEvent;
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

export function addSitemap(entry: SitemapEntry): void {
  const sitemaps = getSitemaps();
  const index = sitemaps.findIndex(s => s.projectId === entry.projectId && s.domain === entry.domain);
  if (index >= 0) {
    sitemaps[index] = entry;
  } else {
    sitemaps.push(entry);
  }
  try {
    fs.writeFileSync(SITEMAP_DB_PATH, JSON.stringify(sitemaps, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing sitemaps db", e);
  }
}
