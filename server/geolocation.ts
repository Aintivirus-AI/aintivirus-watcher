/**
 * IP Geolocation service using local MaxMind GeoLite2 database
 * No API rate limits - unlimited lookups with accurate data!
 * 
 * Setup: Download GeoLite2-City.mmdb from MaxMind and place in server/data/
 * https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
 */

import net from 'net';
import { Reader, type ReaderModel } from '@maxmind/geoip2-node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Path to GeoLite2 database — overridable via GEOIP_DB_PATH env var */
const DB_PATH = process.env.GEOIP_DB_PATH ?? join(__dirname, 'data', 'GeoLite2-City.mmdb');

/** Geolocation result interface */
export interface GeoLocation {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
  isp: string;
  org?: string;
  as?: string;
}

/** MaxMind reader instance */
let reader: ReaderModel | null = null;
let initAttempted = false;

/** Simple IP-to-result cache to avoid redundant external API calls */
const geoCache = new Map<string, { result: GeoLocation | null; cachedAt: number }>();
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const GEO_CACHE_MAX = 5000;

/** Initialize the database reader */
async function initReader(): Promise<ReaderModel | null> {
  if (reader) return reader;
  if (initAttempted) return null;
  
  initAttempted = true;

  try {
    reader = await Reader.open(DB_PATH);
    console.log('GeoLite2 database loaded successfully');
    return reader;
  } catch (error) {
    console.warn('GeoLite2 database not found at', DB_PATH);
    console.warn('Falling back to external API. For better accuracy, download GeoLite2-City.mmdb from MaxMind.');
    return null;
  }
}

// Initialize on startup
initReader().catch((err: unknown) => {
  console.error('[Geolocation] Fatal: failed to initialize reader:', err);
  process.exit(1);
});

/**
 * Check if an IP is private/localhost
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (
    ip === '127.0.0.1' ||
    ip === 'localhost' ||
    ip === 'unknown' ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.')
  ) {
    return true;
  }

  // IPv6 localhost
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return true;
  }

  return false;
}

/**
 * Look up geolocation using local MaxMind database
 */
async function getGeolocationFromDatabase(ip: string): Promise<GeoLocation | null> {
  try {
    const db = await initReader();
    if (!db) {
      return null;
    }

    const result = db.city(ip);

    if (!result) {
      return null;
    }

    // Note: GeoLite2-City doesn't include ISP/ASN data (only paid GeoIP2 does)
    // We use traits if available, otherwise 'Unknown'
    const traits = result.traits as { isp?: string; organization?: string; autonomousSystemOrganization?: string } | undefined;

    return {
      ip,
      lat: result.location?.latitude || 0,
      lng: result.location?.longitude || 0,
      city: result.city?.names?.en || 'Unknown',
      region: result.subdivisions?.[0]?.names?.en || 'Unknown',
      country: result.country?.names?.en || 'Unknown',
      countryCode: result.country?.isoCode || 'XX',
      timezone: result.location?.timeZone || 'UTC',
      isp: traits?.isp || traits?.organization || 'Unknown',
      org: traits?.organization || 'Unknown',
      as: traits?.autonomousSystemOrganization || 'Unknown',
    };
  } catch (error) {
    // Silently handle lookup errors (invalid IPs, etc.)
    return null;
  }
}

/**
 * Fallback to external API when database is not available
 */
async function getGeolocationFromAPI(ip: string): Promise<GeoLocation | null> {
  if (!net.isIP(ip)) return null;

  try {
    // Try ipapi.co first (HTTPS, good accuracy, no key)
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 5000);
    const response = await fetch(`https://ipapi.co/${ip}/json/`, { signal: ctrl1.signal }).finally(() => clearTimeout(t1));
    if (response.ok) {
      const data = await response.json();
      if (!data.error) {
        return {
          ip: data.ip,
          city: data.city || 'Unknown',
          region: data.region || 'Unknown',
          country: data.country_name || 'Unknown',
          countryCode: data.country_code || 'XX',
          lat: data.latitude,
          lng: data.longitude,
          timezone: data.timezone || 'UTC',
          isp: data.org || 'Unknown',
        };
      }
    }
  } catch (error) {
    // Continue to fallback
  }

  try {
    // Fallback to ipinfo.io
    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 5000);
    const response = await fetch(`https://ipinfo.io/${ip}/json`, { signal: ctrl2.signal }).finally(() => clearTimeout(t2));
    if (response.ok) {
      const data = await response.json();
      const [lat, lon] = (data.loc || '0,0').split(',').map(Number);
      return {
        ip: data.ip || ip,
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        country: data.country || 'Unknown',
        countryCode: data.country || 'XX',
        lat,
        lng: lon,
        timezone: data.timezone || 'UTC',
        isp: data.org || 'Unknown',
      };
    }
  } catch (error) {
    // All APIs failed
  }

  return null;
}

/**
 * Get geolocation for an IP address
 * Uses local MaxMind database if available, falls back to external APIs
 */
export async function getGeolocation(ip: string): Promise<GeoLocation | null> {
  // Reject malformed addresses that aren't special private strings
  if (!isPrivateIP(ip) && net.isIP(ip) === 0) {
    return null;
  }

  // Skip localhost/private IPs - return demo data for development (don't cache)
  if (isPrivateIP(ip)) {
    return {
      ip,
      city: 'Local Development',
      region: 'Dev',
      country: 'Localhost',
      countryCode: 'LC',
      lat: 37.7749,
      lng: -122.4194,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isp: 'Local Network',
    };
  }

  // Return cached result if still fresh
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL) {
    return cached.result;
  }

  // Try local database first (more accurate)
  const dbResult = await getGeolocationFromDatabase(ip);
  const result = dbResult ?? await getGeolocationFromAPI(ip);

  // Cache result (evict oldest entry when at capacity)
  if (geoCache.size >= GEO_CACHE_MAX) {
    geoCache.delete(geoCache.keys().next().value!);
  }
  geoCache.set(ip, { result, cachedAt: Date.now() });

  return result;
}
