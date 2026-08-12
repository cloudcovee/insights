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

import { getEvents, addEvent, getSitemaps, addSitemap } from "./lib/server-db";
import { triggerAutomations } from "./lib/automations";

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
          
          for (const item of payloads) {
            const event = {
              id: crypto.randomUUID(),
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
              properties: item.properties || {}
            };
            addEvent(event);
            triggerAutomations(event);
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
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
