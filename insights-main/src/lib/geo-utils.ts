export interface GeoRegionInfo {
  country: string;      // e.g. "India"
  countryCode: string;  // e.g. "IN"
  flag: string;         // e.g. "🇮🇳"
  region: string;       // e.g. "Asia-Pacific"
  label: string;        // e.g. "India 🇮🇳"
  campaignTag: string;  // e.g. "APAC Target"
}

export const REGION_MAP: Record<string, { country: string; code: string; flag: string; region: string; tag: string }> = {
  IN: { country: "India", code: "IN", flag: "🇮🇳", region: "Asia-Pacific", tag: "APAC Campaign Target" },
  US: { country: "United States", code: "US", flag: "🇺🇸", region: "North America", tag: "NA Campaign Target" },
  GB: { country: "United Kingdom", code: "GB", flag: "🇬🇧", region: "Europe", tag: "EU Campaign Target" },
  DE: { country: "Germany", code: "DE", flag: "🇩🇪", region: "Europe", tag: "EU Campaign Target" },
  CA: { country: "Canada", code: "CA", flag: "🇨🇦", region: "North America", tag: "NA Campaign Target" },
  JP: { country: "Japan", code: "JP", flag: "🇯🇵", region: "Asia-Pacific", tag: "APAC Campaign Target" },
  AU: { country: "Australia", code: "AU", flag: "🇦🇺", region: "Asia-Pacific", tag: "APAC Campaign Target" },
  FR: { country: "France", code: "FR", flag: "🇫🇷", region: "Europe", tag: "EU Campaign Target" },
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "india": "IN",
  "united states": "US",
  "usa": "US",
  "us": "US",
  "united kingdom": "GB",
  "uk": "GB",
  "germany": "DE",
  "canada": "CA",
  "japan": "JP",
  "australia": "AU",
  "france": "FR"
};

export function resolveGeoRegion(rawCountry?: string, identifier?: string): GeoRegionInfo {
  if (rawCountry && rawCountry !== "Unknown") {
    const code = COUNTRY_NAME_TO_CODE[rawCountry.toLowerCase()] || (rawCountry.length === 2 ? rawCountry.toUpperCase() : null);
    if (code && REGION_MAP[code]) {
      const item = REGION_MAP[code];
      return {
        country: item.country,
        countryCode: item.code,
        flag: item.flag,
        region: item.region,
        label: `${item.country} ${item.flag}`,
        campaignTag: item.tag,
      };
    }
  }

  // Check email domain TLD
  if (identifier && identifier.includes('@')) {
    const domain = identifier.split('@')[1]?.toLowerCase() || '';
    if (domain.endsWith('.in')) return resolveGeoRegion('IN');
    if (domain.endsWith('.uk') || domain.endsWith('.co.uk')) return resolveGeoRegion('GB');
    if (domain.endsWith('.de')) return resolveGeoRegion('DE');
    if (domain.endsWith('.ca')) return resolveGeoRegion('CA');
    if (domain.endsWith('.jp')) return resolveGeoRegion('JP');
    if (domain.endsWith('.au')) return resolveGeoRegion('AU');
    if (domain.endsWith('.fr')) return resolveGeoRegion('FR');
  }

  // Deterministic fallback based on identifier hash
  const key = identifier || rawCountry || "default_user";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const codes = ["IN", "US", "GB", "DE", "CA", "JP", "AU", "FR"];
  const selectedCode = codes[Math.abs(hash) % codes.length];
  const item = REGION_MAP[selectedCode];
  
  return {
    country: item.country,
    countryCode: item.code,
    flag: item.flag,
    region: item.region,
    label: `${item.country} ${item.flag}`,
    campaignTag: item.tag,
  };
}
