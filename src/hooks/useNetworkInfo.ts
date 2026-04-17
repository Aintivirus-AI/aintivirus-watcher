import { useEffect } from 'react';
import { useProfileStore } from '../store/useProfileStore';

// Response types for different APIs
interface IpApiCoResponse {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  country_code: string;
  org: string;
  latitude: number;
  longitude: number;
  timezone: string;
  error?: boolean;
  reason?: string;
}

interface IpInfoResponse {
  ip: string;
  city: string;
  region: string;
  country: string;
  loc: string; // "lat,lon" format
  org: string;
  timezone: string;
}

interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

// Normalize response from different APIs
interface NormalizedLocation {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  isp: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

// Country code to full name mapping for APIs that don't provide it
const countryNames: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  CN: 'China',
  IN: 'India',
  BR: 'Brazil',
  // Add more as needed
};

const GEO_FETCH_TIMEOUT_MS = 5_000;

async function fetchWithTimeout(url: string, timeoutMs: number, signal: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  signal.addEventListener('abort', onParentAbort);

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onParentAbort);
  }
}

export function useNetworkInfo() {
  const { setNetwork, addConsoleEntry } = useProfileStore();

  useEffect(() => {
    const abortController = new AbortController();

    // Get Network Information API data
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let onConnectionChange: (() => void) | null = null;

    if (connection) {
      const snapshot = () => ({
        connectionType: connection.effectiveType || null,
        downlink: connection.downlink ?? null,
        rtt: connection.rtt ?? null,
        dataSaver: connection.saveData || false,
      });

      setNetwork(snapshot());

      addConsoleEntry('DATA', `Connection: ${connection.effectiveType || 'unknown'}`);
      if (connection.downlink) {
        addConsoleEntry('DATA', `Downlink: ${connection.downlink} Mbps`);
      }
      if (connection.rtt != null) {
        addConsoleEntry('DATA', `RTT: ${connection.rtt} ms`);
      }

      onConnectionChange = () => setNetwork(snapshot());
      connection.addEventListener('change', onConnectionChange);
    }

    const fetchFromIpApiCo = async (): Promise<NormalizedLocation> => {
      const response = await fetchWithTimeout('https://ipapi.co/json/', GEO_FETCH_TIMEOUT_MS, abortController.signal);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: IpApiCoResponse = await response.json();
      if (data.error) throw new Error(data.reason || 'API error');

      return {
        ip: data.ip,
        city: data.city,
        region: data.region,
        country: data.country_name,
        countryCode: data.country_code,
        isp: data.org || 'Unknown',
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
      };
    };

    const fetchFromIpInfo = async (): Promise<NormalizedLocation> => {
      const response = await fetchWithTimeout('https://ipinfo.io/json', GEO_FETCH_TIMEOUT_MS, abortController.signal);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: IpInfoResponse = await response.json();
      const [lat, lon] = (data.loc || '').split(',').map(Number);

      return {
        ip: data.ip,
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        country: countryNames[data.country] || data.country,
        countryCode: data.country,
        isp: data.org || 'Unknown',
        latitude: Number.isFinite(lat) ? lat : NaN,
        longitude: Number.isFinite(lon) ? lon : NaN,
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    };

    const fetchNetworkInfo = async () => {
      addConsoleEntry('SCAN', 'Tracing network origin...');
      setNetwork({ loading: true, error: null });

      const apiFetchers = [
        { name: 'ipapi.co', fetch: fetchFromIpApiCo },
        { name: 'ipinfo.io', fetch: fetchFromIpInfo },
      ];

      let lastError: Error | null = null;

      for (const api of apiFetchers) {
        if (abortController.signal.aborted) return;
        try {
          addConsoleEntry('SCAN', `Trying ${api.name}...`);
          const data = await api.fetch();
          if (abortController.signal.aborted) return;

          // Reject only when both coordinates are missing/invalid.
          // (0, 0) is a valid point (Null Island) but it's rarely a real visitor;
          // treat it as valid unless IP is obviously internal.
          if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
            throw new Error('Invalid coordinates');
          }

          setNetwork({
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country,
            countryCode: data.countryCode,
            isp: data.isp,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone,
            loading: false,
            error: null,
          });

          addConsoleEntry('DATA', `IP Traced: ${data.ip}`);
          addConsoleEntry('DATA', `Location: ${data.city}, ${data.region}, ${data.country}`);
          addConsoleEntry('DATA', `ISP: ${data.isp}`);
          addConsoleEntry('DATA', `Coordinates: ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`);
          addConsoleEntry('SYSTEM', `Network trace complete (via ${api.name})`);

          return;
        } catch (error) {
          if (abortController.signal.aborted) return;
          lastError = error instanceof Error ? error : new Error('Unknown error');
          addConsoleEntry('ALERT', `${api.name} failed: ${lastError.message}`);
        }
      }

      if (abortController.signal.aborted) return;
      const errorMessage = lastError?.message || 'All geolocation APIs failed';
      setNetwork({ loading: false, error: errorMessage });
      addConsoleEntry('ALERT', `Network trace failed: ${errorMessage}`);
    };

    fetchNetworkInfo();

    return () => {
      abortController.abort();
      if (connection && onConnectionChange) {
        connection.removeEventListener('change', onConnectionChange);
      }
    };
  }, [setNetwork, addConsoleEntry]);
}
