import { AnalyticsConfig } from '../types';
import { logger } from '../utils';

export function initSitemapScanner(config: AnalyticsConfig) {
  if (typeof window === 'undefined') return;

  // We only run this on browser environments
  const endpoint = config.endpoint || 'http://localhost:8080/api/track';
  const sitemapEndpoint = endpoint.replace('/api/track', '/api/sitemap');
  const projectId = config.apiKey || 'Unknown';

  // Attempt to fetch sitemap.xml
  const sitemapUrl = '/sitemap.xml';

  fetch(sitemapUrl)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Sitemap fetch returned ${res.status}`);
      }
      return res.text();
    })
    .then((xmlText) => {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const locNodes = xmlDoc.getElementsByTagName("loc");
        const urls: string[] = [];

        for (let i = 0; i < locNodes.length; i++) {
          if (locNodes[i].textContent) {
            urls.push(locNodes[i].textContent as string);
          }
        }

        if (urls.length > 0) {
          logger.log(`Discovered ${urls.length} pages via sitemap.xml`);
          
          // Send to Insight Flow backend
          fetch(sitemapEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: projectId,
              domain: window.location.hostname,
              urls: urls,
              timestamp: new Date().toISOString()
            })
          }).catch(err => {
            logger.warn('Failed to send sitemap data to backend', err);
          });
        }
      } catch (e) {
        logger.warn('Failed to parse sitemap XML', e);
      }
    })
    .catch((err) => {
      logger.log('Sitemap not found or unreadable, skipping.', err.message);
    });
}
