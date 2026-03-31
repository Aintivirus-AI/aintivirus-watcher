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
