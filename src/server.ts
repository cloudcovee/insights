import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import * as fs from 'fs/promises';
import * as path from 'path';

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

import {
  getEvents, addEvent, updateEvent, getSitemaps, addSitemap,
  getSessionContext, createSession, deleteSession, assertCollectionOwnership,
  readCollections, writeCollections, readCollectionData, writeCollectionData,
  validateItemData, generateId,
  type Collection, type CollectionItem,
} from "./lib/server-db";
import { triggerAutomations } from "./lib/automations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function coerce(val: string, type: string): unknown {
  if (type === 'number') { const n = Number(val); return isNaN(n) ? val : n; }
  if (type === 'boolean') { return val.toLowerCase() === 'true' ? true : val.toLowerCase() === 'false' ? false : val; }
  return val;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      
      // API Routes interception
      if (url.pathname === '/api/events' && request.method === 'GET') {
        return new Response(JSON.stringify(getEvents()), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (url.pathname === '/api/upload') {
        if (request.method === 'OPTIONS') {
          return new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          });
        }
        if (request.method === 'POST') {
          try {
            const formData = await request.formData();
            const file = formData.get('file');
            
            if (!file || typeof file === 'string') {
              return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
            }

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            
            const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
            await fs.mkdir(uploadsDir, { recursive: true });
            
            // Basic sanitization and unique filename
            const originalName = file.name || 'upload.bin';
            const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '');
            const uniqueFilename = `${Date.now()}-${safeName}`;
            
            const filePath = path.join(uploadsDir, uniqueFilename);
            await fs.writeFile(filePath, buffer);

            const fileUrl = `/uploads/${uniqueFilename}`;

            return new Response(JSON.stringify({ success: true, url: fileUrl }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (err) {
            console.error('Upload error', err);
            return new Response(JSON.stringify({ error: 'Upload failed' }), { status: 500 });
          }
        }
      }

      if (url.pathname === '/api/crm/sync') {
        if (request.method === 'OPTIONS') {
          return new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          });
        }
        if (request.method === 'POST') {
          try {
            const data = await request.json();
            const { crmUrl, crmKey, users } = data;
            
            if (!crmUrl || !users || !Array.isArray(users)) {
              return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
            }

            const unifiedData: Record<string, any> = {};

            // We simulate hitting the CRM for each user
            for (const email of users) {
              try {
                // In a real scenario, this would be a real API call to the CRM
                // const res = await fetch(`${crmUrl}/users?email=${encodeURIComponent(email)}`, {
                //   headers: { 'Authorization': `Bearer ${crmKey}` }
                // });
                // const crmUser = await res.json();
                
                // For demonstration, we'll generate mock CRM enrichment data
                unifiedData[email] = {
                  leadScore: Math.floor(Math.random() * 100) + 1,
                  company: ["Acme Corp", "Globex", "Initech", "Soylent Corp"][Math.floor(Math.random() * 4)],
                  phone: `+1-555-${Math.floor(1000 + Math.random() * 9000)}`,
                  crmId: `crm-${Math.random().toString(36).substring(7)}`,
                  status: ["Lead", "Customer", "Churned"][Math.floor(Math.random() * 3)]
                };
              } catch (err) {
                // Ignore failures for individual users
              }
            }

            return new Response(JSON.stringify({ success: true, data: unifiedData }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (err) {
            console.error('CRM sync error', err);
            return new Response(JSON.stringify({ error: 'CRM sync failed' }), { status: 500 });
          }
        }
      }
      
      if (url.pathname === '/api/sitemap' && request.method === 'GET') {
        return new Response(JSON.stringify(getSitemaps()), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (url.pathname === '/api/sitemap') {
        if (request.method === 'OPTIONS') {
          return new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          });
        }
        if (request.method === 'POST') {
          const data = await request.json();
          if (data && data.projectId && Array.isArray(data.urls)) {
            addSitemap({
              projectId: data.projectId,
              domain: data.domain || 'Unknown',
              urls: data.urls,
              timestamp: data.timestamp || new Date().toISOString()
            });
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      }
      
      if (url.pathname === '/api/track') {
        if (request.method === 'OPTIONS') {
          return new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          });
        }
        if (request.method === 'POST') {
          const data = await request.json();
          const payloads = Array.isArray(data) ? data : [data];
          
          // Extract the IP address from common reverse proxy headers, or fallback to localhost
          const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() 
                  || request.headers.get('cf-connecting-ip') 
                  || '127.0.0.1';
          
          for (const item of payloads) {
            const eventId = crypto.randomUUID();
            const event = {
              id: eventId,
              timestamp: item.timestamp || new Date().toISOString(),
              event: item.eventName || item.event || 'page_view',
              url: item.properties?.url || '',
              path: item.properties?.path || '',
              title: item.properties?.title || '',
              referrer: item.properties?.referrer || '',
              browser: item.context?.browser?.name || item.context?.browser || 'Unknown',
              os: item.context?.browser?.os || item.context?.os || 'Unknown',
              device: item.context?.device?.type || item.context?.device || 'Desktop',
              screenSize: item.context?.device?.screenWidth ? `${item.context.device.screenWidth}x${item.context.device.screenHeight}` : item.context?.screenSize || '',
              anonId: item.anonymousId || 'unknown',
              userId: item.userId || null,
              projectId: item.projectId || item.project || item.apiKey || 'Unknown',
              ip: ip !== '127.0.0.1' && ip !== '::1' ? ip : (item.properties?.ip || '127.0.0.1'),
              country: 'Unknown',
              properties: item.properties || {}
            };
            
            // Background async IP Lookup using ipinfo.io
            setTimeout(async () => {
              try {
                // If it's a local testing IP, we use a default. Otherwise, look up the IP.
                const lookupIp = (ip === '127.0.0.1' || ip === '::1') ? '' : `${ip}/`;
                const token = process.env.IPINFO_TOKEN ? `?token=${process.env.IPINFO_TOKEN}` : '';
                const res = await fetch(`https://ipinfo.io/${lookupIp}json${token}`);
                if (res.ok) {
                  const geo = await res.json();
                  const countryCode = geo.country || (ip === '127.0.0.1' ? 'US' : 'Unknown');
                  updateEvent(eventId, { 
                    ip: geo.ip || ip,
                    country: countryCode,
                    properties: { ...event.properties, ip: geo.ip || ip, city: geo.city || '', region: geo.region || '', org: geo.org || '' }
                  });
                }
              } catch (err) {
                // Silently ignore network failures for background enrichment
                console.error('IPInfo lookup failed:', err);
              }
            }, 0);

            addEvent(event);
            triggerAutomations(event);
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      }

      // -----------------------------------------------------------------------
      // Auth endpoints
      // -----------------------------------------------------------------------
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = await request.json() as { email?: string; password?: string; projectId?: string };
        const email = body.email?.trim() ?? '';
        const projectId = body.projectId?.trim() ?? 'proj_default';
        if (!email) return json({ error: 'Email is required' }, 400);
        const userId = `user_${email.replace(/[^a-z0-9]/gi, '_')}`;
        const session = createSession(userId, email, projectId);
        const cookie = `lumen_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 3600}`;
        return new Response(JSON.stringify({ userId, projectId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
        });
      }

      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        try {
          const ctx = getSessionContext(request);
          return json({ userId: ctx.userId, projectId: ctx.projectId, email: ctx.email });
        } catch (r) { return r as Response; }
      }

      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        try {
          const cookieHeader = request.headers.get('cookie') ?? '';
          const match = cookieHeader.match(/(?:^|;\s*)lumen_session=([^;]+)/);
          if (match) deleteSession(match[1]);
        } catch {}
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'lumen_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
          },
        });
      }

      // -----------------------------------------------------------------------
      // Collections: /api/collections
      // -----------------------------------------------------------------------
      if (url.pathname === '/api/collections') {
        try {
          const ctx = getSessionContext(request);
          if (request.method === 'GET') {
            const all = readCollections().filter(c => c.projectId === ctx.projectId);
            return json(all);
          }
          if (request.method === 'POST') {
            const body = await request.json() as Omit<Collection, 'id' | 'projectId' | 'createdAt'>;
            if (!body.name?.trim()) return json({ error: 'name is required' }, 400);
            const col: Collection = {
              id: generateId('col_'),
              name: body.name.trim(),
              projectId: ctx.projectId, // ALWAYS from session — never from body
              attributes: Array.isArray(body.attributes) ? body.attributes : [],
              createdAt: new Date().toISOString(),
            };
            const cols = readCollections();
            writeCollections([...cols, col]);
            return json(col, 201);
          }
        } catch (r) { return r as Response; }
      }

      // /api/collections/:id
      const collMatch = url.pathname.match(/^\/api\/collections\/([^/]+)$/);
      if (collMatch) {
        try {
          const ctx = getSessionContext(request);
          const collId = collMatch[1];
          const cols = readCollections();
          const idx = cols.findIndex(c => c.id === collId);
          if (idx === -1) return json({ error: 'Collection not found' }, 404);
          assertCollectionOwnership(cols[idx], ctx);

          if (request.method === 'GET') return json(cols[idx]);

          if (request.method === 'PUT') {
            const body = await request.json() as Partial<Pick<Collection, 'name' | 'attributes'>>;
            if (body.name !== undefined) cols[idx].name = body.name.trim();
            if (body.attributes !== undefined) cols[idx].attributes = body.attributes;
            writeCollections(cols);
            return json(cols[idx]);
          }

          if (request.method === 'DELETE') {
            cols.splice(idx, 1);
            writeCollections(cols);
            // Also delete all items for this collection
            const items = readCollectionData().filter(i => i.collectionId !== collId);
            writeCollectionData(items);
            return json({ success: true });
          }
        } catch (r) { return r as Response; }
      }

      // /api/collections/:id/items
      const itemsMatch = url.pathname.match(/^\/api\/collections\/([^/]+)\/items$/);
      if (itemsMatch) {
        try {
          const ctx = getSessionContext(request);
          const collId = itemsMatch[1];
          const cols = readCollections();
          const col = cols.find(c => c.id === collId);
          if (!col) return json({ error: 'Collection not found' }, 404);
          assertCollectionOwnership(col, ctx);

          if (request.method === 'GET') {
            let items = readCollectionData().filter(i => i.collectionId === collId && i.projectId === ctx.projectId);
            const status = url.searchParams.get('status');
            const batchId = url.searchParams.get('batchId');
            if (status) items = items.filter(i => i.status === status);
            if (batchId) items = items.filter(i => i.batchId === batchId);
            return json(items);
          }
        } catch (r) { return r as Response; }
      }

      // /api/collections/:id/items/:itemId
      const itemMatch = url.pathname.match(/^\/api\/collections\/([^/]+)\/items\/([^/]+)$/);
      if (itemMatch) {
        try {
          const ctx = getSessionContext(request);
          const [, collId, itemId] = itemMatch;
          const cols = readCollections();
          const col = cols.find(c => c.id === collId);
          if (!col) return json({ error: 'Collection not found' }, 404);
          assertCollectionOwnership(col, ctx);

          const allItems = readCollectionData();
          const idx = allItems.findIndex(i => i.id === itemId && i.collectionId === collId && i.projectId === ctx.projectId);
          if (idx === -1) return json({ error: 'Item not found' }, 404);

          if (request.method === 'PATCH') {
            const body = await request.json() as { data?: Record<string, unknown> };
            if (body.data) allItems[idx].data = body.data;
            allItems[idx].validationStatus = 'pending';
            allItems[idx].validationErrors = [];
            allItems[idx].updatedAt = new Date().toISOString();
            writeCollectionData(allItems);
            return json(allItems[idx]);
          }

          if (request.method === 'DELETE') {
            allItems.splice(idx, 1);
            writeCollectionData(allItems);
            return json({ success: true });
          }
        } catch (r) { return r as Response; }
      }

      // /api/collections/:id/import
      const importMatch = url.pathname.match(/^\/api\/collections\/([^/]+)\/import$/);
      if (importMatch && request.method === 'POST') {
        try {
          const ctx = getSessionContext(request);
          const collId = importMatch[1];
          const cols = readCollections();
          const col = cols.find(c => c.id === collId);
          if (!col) return json({ error: 'Collection not found' }, 404);
          assertCollectionOwnership(col, ctx);

          const contentType = request.headers.get('content-type') ?? '';
          const batchId = generateId('batch_');
          const now = new Date().toISOString();
          const newItems: CollectionItem[] = [];

          if (contentType.includes('multipart/form-data')) {
            // CSV import
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            if (!file) return json({ error: 'No file provided' }, 400);
            const text = await file.text();
            const lines = text.split('\n').map(l => l.trimEnd()).filter(Boolean);
            if (lines.length < 2) return json({ error: 'CSV must have a header row and at least one data row' }, 400);
            const headers = parseCsvRow(lines[0]);
            for (let i = 1; i < lines.length; i++) {
              const values = parseCsvRow(lines[i]);
              const raw: Record<string, unknown> = {};
              headers.forEach((h, idx) => {
                const attr = col.attributes.find(a => a.name === h);
                raw[h] = attr ? coerce(values[idx] ?? '', attr.type) : (values[idx] ?? '');
              });
              const errs = validateItemData(raw, col.attributes);
              newItems.push({
                id: generateId('item_'),
                collectionId: collId,
                projectId: ctx.projectId, // ALWAYS from session
                batchId,
                status: 'staging',
                validationStatus: errs.length === 0 ? 'valid' : 'invalid',
                validationErrors: errs,
                data: raw,
                createdAt: now,
                updatedAt: now,
              });
            }
          } else {
            // Manual item import
            const body = await request.json() as { data?: Record<string, unknown> };
            if (!body.data) return json({ error: 'data is required' }, 400);
            const errs = validateItemData(body.data, col.attributes);
            newItems.push({
              id: generateId('item_'),
              collectionId: collId,
              projectId: ctx.projectId,
              batchId: null,
              status: 'staging',
              validationStatus: errs.length === 0 ? 'valid' : 'invalid',
              validationErrors: errs,
              data: body.data,
              createdAt: now,
              updatedAt: now,
            });
          }

          const existing = readCollectionData();
          writeCollectionData([...existing, ...newItems]);
          const valid = newItems.filter(i => i.validationStatus === 'valid').length;
          return json({ batchId, total: newItems.length, valid, invalid: newItems.length - valid }, 201);
        } catch (r) { return r as Response; }
      }

      // /api/collections/:id/validate
      const validateMatch = url.pathname.match(/^\/api\/collections\/([^/]+)\/validate$/);
      if (validateMatch && request.method === 'POST') {
        try {
          const ctx = getSessionContext(request);
          const collId = validateMatch[1];
          const cols = readCollections();
          const col = cols.find(c => c.id === collId);
          if (!col) return json({ error: 'Collection not found' }, 404);
          assertCollectionOwnership(col, ctx);

          const body = await request.json() as { itemIds: string[] };
          if (!Array.isArray(body.itemIds)) return json({ error: 'itemIds array is required' }, 400);

          const allItems = readCollectionData();
          const now = new Date().toISOString();
          const results: Array<{ id: string; validationStatus: string; validationErrors: unknown[] }> = [];

          for (const itemId of body.itemIds) {
            const idx = allItems.findIndex(i => i.id === itemId && i.collectionId === collId && i.projectId === ctx.projectId);
            if (idx === -1) continue;
            const errs = validateItemData(allItems[idx].data, col.attributes);
            allItems[idx].validationStatus = errs.length === 0 ? 'valid' : 'invalid';
            allItems[idx].validationErrors = errs;
            allItems[idx].updatedAt = now;
            results.push({ id: itemId, validationStatus: allItems[idx].validationStatus, validationErrors: errs });
          }
          writeCollectionData(allItems);
          return json({ results });
        } catch (r) { return r as Response; }
      }

      // /api/collections/:id/publish
      const publishMatch = url.pathname.match(/^\/api\/collections\/([^/]+)\/publish$/);
      if (publishMatch && request.method === 'POST') {
        try {
          const ctx = getSessionContext(request);
          const collId = publishMatch[1];
          const cols = readCollections();
          const col = cols.find(c => c.id === collId);
          if (!col) return json({ error: 'Collection not found' }, 404);
          assertCollectionOwnership(col, ctx);

          const body = await request.json() as { itemIds: string[] };
          if (!Array.isArray(body.itemIds)) return json({ error: 'itemIds array is required' }, 400);

          const allItems = readCollectionData();
          const now = new Date().toISOString();
          const published: string[] = [];
          const rejected: Array<{ id: string; reason: string; validationErrors: unknown[] }> = [];

          for (const itemId of body.itemIds) {
            const idx = allItems.findIndex(
              i => i.id === itemId && i.collectionId === collId && i.projectId === ctx.projectId // double ownership check
            );
            if (idx === -1) { rejected.push({ id: itemId, reason: 'Not found', validationErrors: [] }); continue; }
            const item = allItems[idx];
            if (item.validationStatus !== 'valid') {
              rejected.push({ id: itemId, reason: 'Validation failed', validationErrors: item.validationErrors });
              continue;
            }
            if (item.status !== 'staging') {
              rejected.push({ id: itemId, reason: 'Item is not in staging', validationErrors: [] });
              continue;
            }
            allItems[idx].status = 'published';
            allItems[idx].updatedAt = now;
            published.push(itemId);
          }

          writeCollectionData(allItems);
          return json({ published: published.length, rejected });
        } catch (r) { return r as Response; }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
