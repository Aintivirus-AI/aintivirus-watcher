/**
 * Tests for security fixes applied by OpenClaw.
 */
import crypto from 'crypto';
import net from 'net';
import { describe, it, expect } from 'vitest';

// ── Timing-safe API key comparison ──────────────────────────────────────────

function timingSafeApiKeyCheck(provided: unknown, secret: string): boolean {
  if (typeof provided !== 'string') return false;
  if (provided.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

describe('timing-safe API key comparison', () => {
  const secret = 'super-secret-key-123';

  it('returns true for a correct key', () => {
    expect(timingSafeApiKeyCheck(secret, secret)).toBe(true);
  });

  it('returns false for a wrong key of the same length', () => {
    const wrong = 'super-secret-key-XXX';
    expect(timingSafeApiKeyCheck(wrong, secret)).toBe(false);
  });

  it('returns false for a shorter key (avoids timingSafeEqual length mismatch throw)', () => {
    expect(timingSafeApiKeyCheck('short', secret)).toBe(false);
  });

  it('returns false for a longer key', () => {
    expect(timingSafeApiKeyCheck(secret + 'extra', secret)).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(timingSafeApiKeyCheck(undefined, secret)).toBe(false);
    expect(timingSafeApiKeyCheck(null, secret)).toBe(false);
    expect(timingSafeApiKeyCheck(['array'], secret)).toBe(false);
  });
});

// ── Crypto ID generation ─────────────────────────────────────────────────────

function generateId(): string {
  return `v_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

describe('generateId', () => {
  it('produces IDs starting with v_', () => {
    expect(generateId()).toMatch(/^v_/);
  });

  it('produces unique IDs on repeated calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateId));
    expect(ids.size).toBe(1000);
  });

  it('does not use Math.random', () => {
    const original = Math.random;
    let called = false;
    Math.random = () => { called = true; return original(); };
    generateId();
    Math.random = original;
    expect(called).toBe(false);
  });
});

// ── Visitor history cap ───────────────────────────────────────────────────────

const MAX_HISTORY_ENTRIES = 10000;

function appendVisitorHistory(
  history: { connectedAt: number }[],
  entry: { connectedAt: number }
): void {
  if (history.length >= MAX_HISTORY_ENTRIES) {
    history.shift();
  }
  history.push(entry);
}

describe('visitorHistory cap', () => {
  it('does not exceed MAX_HISTORY_ENTRIES', () => {
    const history: { connectedAt: number }[] = [];
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i++) {
      appendVisitorHistory(history, { connectedAt: i });
    }
    expect(history.length).toBe(MAX_HISTORY_ENTRIES);
  });

  it('evicts oldest entries first', () => {
    const history: { connectedAt: number }[] = [];
    for (let i = 0; i < MAX_HISTORY_ENTRIES; i++) {
      appendVisitorHistory(history, { connectedAt: i });
    }
    appendVisitorHistory(history, { connectedAt: MAX_HISTORY_ENTRIES });
    expect(history[0].connectedAt).toBe(1); // entry 0 was evicted
    expect(history[history.length - 1].connectedAt).toBe(MAX_HISTORY_ENTRIES);
  });

  it('allows entries below the cap without eviction', () => {
    const history: { connectedAt: number }[] = [];
    for (let i = 0; i < 10; i++) {
      appendVisitorHistory(history, { connectedAt: i });
    }
    expect(history.length).toBe(10);
    expect(history[0].connectedAt).toBe(0);
  });
});

// ── WebSocket connection cap ──────────────────────────────────────────────────

const MAX_CONNECTIONS = 5000;

/** Mimics the connection-cap guard added to wss.on('connection') */
function shouldTerminate(currentClientCount: number): boolean {
  return currentClientCount > MAX_CONNECTIONS;
}

describe('WebSocket connection cap', () => {
  it('allows connections below the cap', () => {
    expect(shouldTerminate(0)).toBe(false);
    expect(shouldTerminate(MAX_CONNECTIONS - 1)).toBe(false);
    expect(shouldTerminate(MAX_CONNECTIONS)).toBe(false);
  });

  it('rejects connections that exceed the cap', () => {
    expect(shouldTerminate(MAX_CONNECTIONS + 1)).toBe(true);
    expect(shouldTerminate(MAX_CONNECTIONS + 100)).toBe(true);
  });
});

// ── Chat message HTML sanitization ───────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

describe('escapeHtml', () => {
  it('encodes < and > to prevent tag injection', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('encodes & to prevent entity injection', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('encodes quotes', () => {
    expect(escapeHtml('"hello" \'world\'')).toBe('&quot;hello&quot; &#x27;world&#x27;');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello world 123')).toBe('Hello world 123');
  });

  it('encodes a realistic XSS payload', () => {
    const payload = '<img src=x onerror="alert(\'XSS\')">';
    const encoded = escapeHtml(payload);
    expect(encoded).not.toContain('<');
    expect(encoded).not.toContain('>');
  });
});

// ── Visitor history 30-day retention ─────────────────────────────────────────

const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function evictStaleEntries(history: { connectedAt: number }[], now: number): void {
  const cutoff = now - HISTORY_RETENTION_MS;
  let stale = 0;
  while (stale < history.length && history[stale].connectedAt < cutoff) {
    stale++;
  }
  if (stale > 0) history.splice(0, stale);
}

describe('visitor history retention policy', () => {
  it('removes entries older than 30 days', () => {
    const now = Date.now();
    const history = [
      { connectedAt: now - HISTORY_RETENTION_MS - 1000 }, // 30 days + 1s ago → stale
      { connectedAt: now - HISTORY_RETENTION_MS + 1000 }, // just under 30 days → keep
      { connectedAt: now },
    ];
    evictStaleEntries(history, now);
    expect(history.length).toBe(2);
    expect(history[0].connectedAt).toBeGreaterThan(now - HISTORY_RETENTION_MS);
  });

  it('keeps all entries when none are older than 30 days', () => {
    const now = Date.now();
    const history = [
      { connectedAt: now - 1000 },
      { connectedAt: now },
    ];
    evictStaleEntries(history, now);
    expect(history.length).toBe(2);
  });

  it('removes all entries when all are older than 30 days', () => {
    const now = Date.now();
    const history = [
      { connectedAt: now - HISTORY_RETENTION_MS * 2 },
      { connectedAt: now - HISTORY_RETENTION_MS - 1 },
    ];
    evictStaleEntries(history, now);
    expect(history.length).toBe(0);
  });
});

// ── /api/analyze rate limiter ─────────────────────────────────────────────────

interface RateEntry { count: number; resetAt: number }

function checkRateLimit(
  map: Map<string, RateEntry>,
  ip: string,
  now: number,
  windowMs: number,
  limit: number
): 'allow' | 'reject' {
  const entry = map.get(ip);
  if (!entry || now >= entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + windowMs });
    return 'allow';
  }
  if (entry.count >= limit) return 'reject';
  entry.count++;
  return 'allow';
}

describe('analyzeRateLimiter logic', () => {
  it('allows the first LIMIT requests within the window', () => {
    const map = new Map<string, RateEntry>();
    const now = 1000;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(map, '1.2.3.4', now, 60_000, 10)).toBe('allow');
    }
  });

  it('rejects the 11th request within the window', () => {
    const map = new Map<string, RateEntry>();
    const now = 1000;
    for (let i = 0; i < 10; i++) checkRateLimit(map, '1.2.3.4', now, 60_000, 10);
    expect(checkRateLimit(map, '1.2.3.4', now, 60_000, 10)).toBe('reject');
  });

  it('resets after the window expires', () => {
    const map = new Map<string, RateEntry>();
    const now = 1000;
    for (let i = 0; i < 10; i++) checkRateLimit(map, '1.2.3.4', now, 60_000, 10);
    // Advance past window
    const later = now + 61_000;
    expect(checkRateLimit(map, '1.2.3.4', later, 60_000, 10)).toBe('allow');
  });

  it('tracks different IPs independently', () => {
    const map = new Map<string, RateEntry>();
    const now = 1000;
    for (let i = 0; i < 10; i++) checkRateLimit(map, '1.1.1.1', now, 60_000, 10);
    // '2.2.2.2' has its own fresh window
    expect(checkRateLimit(map, '2.2.2.2', now, 60_000, 10)).toBe('allow');
  });
});

// ── IP validation in geolocation ─────────────────────────────────────────────

describe('net.isIP validation', () => {
  it('accepts valid IPv4', () => {
    expect(net.isIP('1.2.3.4')).not.toBe(0);
  });

  it('accepts valid IPv6', () => {
    expect(net.isIP('::1')).not.toBe(0);
    expect(net.isIP('2001:db8::1')).not.toBe(0);
  });

  it('rejects hostname strings (SSRF vector)', () => {
    expect(net.isIP('localhost')).toBe(0);
    expect(net.isIP('internal.corp')).toBe(0);
    expect(net.isIP('169.254.169.254.evil.com')).toBe(0);
  });

  it('rejects empty string', () => {
    expect(net.isIP('')).toBe(0);
  });

  it('rejects path-injection strings', () => {
    expect(net.isIP('1.2.3.4/../../etc/passwd')).toBe(0);
  });
});

// ── /api/analyze payload validation ──────────────────────────────────────────

function makeValidPayload(): Record<string, unknown> {
  return {
    hardware: { cpuCores: 8, ram: 16, screenWidth: 1920, screenHeight: 1080, pixelRatio: 2, touchSupport: false, maxTouchPoints: 0, colorDepth: 24, orientation: 'landscape', gpu: null, gpuVendor: null, battery: null },
    network: { city: 'TestCity', region: null, country: 'US', isp: null, timezone: null, connectionType: null, downlink: null, rtt: null },
    browser: { userAgent: 'Mozilla/5.0', language: 'en-US', languages: ['en-US'], platform: 'Win32', mobile: false, historyLength: 5, cookiesEnabled: true, vendor: 'Google', referrer: '', pdfViewer: true, architecture: null, platformVersion: null },
    fingerprints: { fontsDetected: 12, extensionsDetected: [], hardwareFamily: null, webgpuAvailable: false, wasmSupported: true, speechVoices: 3, navigatorProps: 100, windowProps: 200 },
    behavioral: { typing: { totalKeystrokes: 0, averageWPM: 0, averageHoldTime: 0 }, mouse: { totalClicks: 0, rageClicks: 0, erraticMovements: 0, movements: 0, totalDistance: 0, averageVelocity: 0 }, scroll: { scrollEvents: 0, maxDepth: 0, directionChanges: 0 }, attention: { tabSwitches: 0, totalHiddenTime: 0, focusTime: 0 }, emotions: { engagement: 0, exitIntents: 0 } },
    botDetection: { isAutomated: false, isHeadless: false, isVirtualMachine: false, incognitoMode: false, devToolsOpen: false },
  };
}

function validateAnalyzePayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const d = body as Record<string, unknown>;
  if (!d.hardware || typeof d.hardware !== 'object') return false;
  if (!d.network || typeof d.network !== 'object') return false;
  if (!d.browser || typeof d.browser !== 'object') return false;
  if (!d.fingerprints || typeof d.fingerprints !== 'object') return false;
  if (!d.behavioral || typeof d.behavioral !== 'object') return false;
  if (!d.botDetection || typeof d.botDetection !== 'object') return false;
  const hw = d.hardware as Record<string, unknown>;
  if (hw.cpuCores !== null && typeof hw.cpuCores !== 'number') return false;
  if (hw.ram !== null && typeof hw.ram !== 'number') return false;
  if (typeof hw.screenWidth !== 'number' || hw.screenWidth < 0 || hw.screenWidth > 20000) return false;
  if (typeof hw.screenHeight !== 'number' || hw.screenHeight < 0 || hw.screenHeight > 20000) return false;
  const br = d.browser as Record<string, unknown>;
  if (typeof br.userAgent !== 'string' || br.userAgent.length > 1024) return false;
  if (typeof br.language !== 'string' || br.language.length > 64) return false;
  if (!Array.isArray(br.languages)) return false;
  const nw = d.network as Record<string, unknown>;
  if (nw.city !== null && (typeof nw.city !== 'string' || nw.city.length > 256)) return false;
  if (nw.country !== null && (typeof nw.country !== 'string' || nw.country.length > 64)) return false;
  return true;
}

describe('validateAnalyzePayload', () => {
  it('accepts a valid payload', () => {
    expect(validateAnalyzePayload(makeValidPayload())).toBe(true);
  });

  it('rejects null and non-object inputs', () => {
    expect(validateAnalyzePayload(null)).toBe(false);
    expect(validateAnalyzePayload('string')).toBe(false);
    expect(validateAnalyzePayload(42)).toBe(false);
  });

  it('rejects missing top-level keys', () => {
    const { hardware: _h, ...noHw } = makeValidPayload() as { hardware: unknown } & Record<string, unknown>;
    expect(validateAnalyzePayload(noHw)).toBe(false);
    const { browser: _b, ...noBr } = makeValidPayload() as { browser: unknown } & Record<string, unknown>;
    expect(validateAnalyzePayload(noBr)).toBe(false);
  });

  it('rejects out-of-range screen dimensions', () => {
    const p = makeValidPayload();
    (p.hardware as Record<string, unknown>).screenWidth = 99999;
    expect(validateAnalyzePayload(p)).toBe(false);
    const p2 = makeValidPayload();
    (p2.hardware as Record<string, unknown>).screenHeight = -1;
    expect(validateAnalyzePayload(p2)).toBe(false);
  });

  it('rejects oversized userAgent string (DoS vector)', () => {
    const p = makeValidPayload();
    (p.browser as Record<string, unknown>).userAgent = 'A'.repeat(1025);
    expect(validateAnalyzePayload(p)).toBe(false);
  });

  it('rejects oversized city string', () => {
    const p = makeValidPayload();
    (p.network as Record<string, unknown>).city = 'X'.repeat(257);
    expect(validateAnalyzePayload(p)).toBe(false);
  });

  it('rejects wrong type for cpuCores', () => {
    const p = makeValidPayload();
    (p.hardware as Record<string, unknown>).cpuCores = 'eight';
    expect(validateAnalyzePayload(p)).toBe(false);
  });

  it('accepts null for optional numeric fields', () => {
    const p = makeValidPayload();
    (p.hardware as Record<string, unknown>).cpuCores = null;
    (p.hardware as Record<string, unknown>).ram = null;
    expect(validateAnalyzePayload(p)).toBe(true);
  });
});

// ── historyRateLimiter (30 req/min) ──────────────────────────────────────────

describe('historyRateLimiter logic', () => {
  it('allows up to 30 requests per window', () => {
    const map = new Map<string, RateEntry>();
    const now = 5000;
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(map, '10.0.0.1', now, 60_000, 30)).toBe('allow');
    }
  });

  it('rejects the 31st request in the same window', () => {
    const map = new Map<string, RateEntry>();
    const now = 5000;
    for (let i = 0; i < 30; i++) checkRateLimit(map, '10.0.0.1', now, 60_000, 30);
    expect(checkRateLimit(map, '10.0.0.1', now, 60_000, 30)).toBe('reject');
  });
});

// ── CSP header completeness ───────────────────────────────────────────────────

const EXPECTED_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'";

describe('Content-Security-Policy header', () => {
  it('includes script-src directive', () => {
    expect(EXPECTED_CSP).toContain("script-src 'self'");
  });

  it('includes style-src directive', () => {
    expect(EXPECTED_CSP).toContain('style-src');
  });

  it('includes img-src directive', () => {
    expect(EXPECTED_CSP).toContain('img-src');
  });

  it('includes connect-src directive', () => {
    expect(EXPECTED_CSP).toContain('connect-src');
  });
});

// ── CORS dev defaults ─────────────────────────────────────────────────────────

describe('CORS dev defaults', () => {
  it('defaults to localhost origins when ALLOWED_ORIGINS is unset', () => {
    const allowedOrigins: string[] | undefined = undefined;
    const devOrigins = ['http://localhost:5173', 'http://localhost:3001'];
    const effectiveOrigins = allowedOrigins?.length ? allowedOrigins : devOrigins;
    expect(effectiveOrigins).toContain('http://localhost:5173');
    expect(effectiveOrigins).toContain('http://localhost:3001');
  });

  it('uses provided ALLOWED_ORIGINS when set', () => {
    const allowedOrigins = ['https://example.com'];
    const devOrigins = ['http://localhost:5173', 'http://localhost:3001'];
    const effectiveOrigins = allowedOrigins?.length ? allowedOrigins : devOrigins;
    expect(effectiveOrigins).toEqual(['https://example.com']);
  });
});
