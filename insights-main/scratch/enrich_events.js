import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'local-events.json');

const REGION_LIST = [
  { country: "India", code: "IN" },
  { country: "United States", code: "US" },
  { country: "United Kingdom", code: "GB" },
  { country: "Germany", code: "DE" },
  { country: "Canada", code: "CA" },
  { country: "Japan", code: "JP" },
  { country: "Australia", code: "AU" },
  { country: "France", code: "FR" }
];

function getDeterministicGeo(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return REGION_LIST[Math.abs(hash) % REGION_LIST.length];
}

try {
  if (fs.existsSync(dbPath)) {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const events = JSON.parse(raw);
    let updated = 0;

    events.forEach(e => {
      if (!e.country || e.country === 'Unknown') {
        const id = e.userId || e.anonId || e.id || 'default';
        const geo = getDeterministicGeo(id);
        e.country = geo.country;
        e.countryCode = geo.code;
        updated++;
      }
    });

    fs.writeFileSync(dbPath, JSON.stringify(events, null, 2), 'utf8');
    console.log(`Enriched ${updated} events with country data.`);
  }
} catch (err) {
  console.error("Error enriching events:", err);
}
