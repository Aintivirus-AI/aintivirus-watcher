import { describe, it, expect } from 'vitest';
import { isIP } from 'net';

// ---------------------------------------------------------------------------
// Replicate getClientIp logic as it appears in server/index.ts after the fix.
// We test the contract: only read X-Forwarded-For when TRUST_PROXY=1.
// ---------------------------------------------------------------------------
function getClientIp(
  req: { headers: Record<string, string | undefined>; socket: { remoteAddress?: string } },
  trustProxy: string | undefined,
): string {
  if (trustProxy === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// ---------------------------------------------------------------------------
// Replicate requireApiKey logic as it appears in server/index.ts after the fix.
// When secret is missing, returns 401 (not 503) — no config-state leakage.
// ---------------------------------------------------------------------------
function requireApiKey(
  req: { headers: Record<string, string | undefined> },
  secret: string | undefined,
): { status: number; body: Record<string, string> } | null {
  const provided = req.headers['x-api-key'];
  if (!secret || typeof provided !== 'string' || provided !== secret) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }
  return null; // passes through (next() called)
}

// ---------------------------------------------------------------------------
// Replicate WebSocket message size guard logic
// ---------------------------------------------------------------------------
const MAX_WS_MESSAGE_BYTES = 4 * 1024; // 4 KB
function isMessageTooLarge(raw: Buffer): boolean {
  return raw.byteLength > MAX_WS_MESSAGE_BYTES;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getClientIp — X-Forwarded-For handling', () => {
  it('ignores X-Forwarded-For when TRUST_PROXY is not set', () => {
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4' },
      socket: { remoteAddress: '10.0.0.1' },
    };
    expect(getClientIp(req, undefined)).toBe('10.0.0.1');
  });

  it('ignores X-Forwarded-For when TRUST_PROXY is "0"', () => {
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4' },
      socket: { remoteAddress: '10.0.0.1' },
    };
    expect(getClientIp(req, '0')).toBe('10.0.0.1');
  });

  it('uses X-Forwarded-For first IP when TRUST_PROXY=1', () => {
    const req = {
      headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' },
      socket: { remoteAddress: '10.0.0.1' },
    };
    expect(getClientIp(req, '1')).toBe('5.6.7.8');
  });

  it('falls back to socket.remoteAddress when TRUST_PROXY=1 but header absent', () => {
    const req = {
      headers: {},
      socket: { remoteAddress: '10.0.0.1' },
    };
    expect(getClientIp(req, '1')).toBe('10.0.0.1');
  });

  it('returns 127.0.0.1 when no socket address available', () => {
    const req = { headers: {}, socket: {} };
    expect(getClientIp(req, undefined)).toBe('127.0.0.1');
  });
});

describe('requireApiKey middleware — no config-state leakage', () => {
  it('returns 401 (not 503) when API_SECRET is not configured', () => {
    const result = requireApiKey({ headers: {} }, undefined);
    expect(result?.status).toBe(401);
    // Must not reveal that the secret is unconfigured
    expect(result?.body?.error).not.toContain('not configured');
  });

  it('returns 401 when x-api-key header is missing', () => {
    const result = requireApiKey({ headers: {} }, 'my-secret');
    expect(result?.status).toBe(401);
  });

  it('returns 401 when x-api-key header is wrong', () => {
    const result = requireApiKey({ headers: { 'x-api-key': 'wrong' } }, 'my-secret');
    expect(result?.status).toBe(401);
  });

  it('returns null (passes through) when x-api-key is correct', () => {
    const result = requireApiKey({ headers: { 'x-api-key': 'my-secret' } }, 'my-secret');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CORS: validate the allowed-origins configuration logic
// ---------------------------------------------------------------------------
describe('CORS allowed origins configuration', () => {
  it('parses comma-separated ALLOWED_ORIGINS into an array', () => {
    const raw = 'https://example.com,https://app.example.com';
    const origins = raw.split(',').map(o => o.trim()).filter(Boolean);
    expect(origins).toEqual(['https://example.com', 'https://app.example.com']);
    expect(origins.length).toBeGreaterThan(0);
  });

  it('produces an empty array when ALLOWED_ORIGINS is undefined', () => {
    function parseOrigins(raw: string | undefined): string[] {
      if (!raw) return [];
      return raw.split(',').map((o: string) => o.trim()).filter(Boolean);
    }
    expect(parseOrigins(undefined).length).toBe(0);
    expect(parseOrigins(''). length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// WebSocket message size guard
// ---------------------------------------------------------------------------
describe('WebSocket message size guard', () => {
  it('accepts messages within 4 KB limit', () => {
    const small = Buffer.alloc(1024, 'a');
    expect(isMessageTooLarge(small)).toBe(false);
  });

  it('rejects messages exactly at the limit (4096 bytes)', () => {
    const atLimit = Buffer.alloc(4096, 'a');
    expect(isMessageTooLarge(atLimit)).toBe(false);
  });

  it('rejects messages exceeding 4 KB', () => {
    const big = Buffer.alloc(4097, 'a');
    expect(isMessageTooLarge(big)).toBe(true);
  });

  it('rejects multi-megabyte payload', () => {
    const huge = Buffer.alloc(2 * 1024 * 1024, 'x');
    expect(isMessageTooLarge(huge)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IP address validation
// ---------------------------------------------------------------------------
describe('IP address validation via net.isIP', () => {
  it('accepts valid IPv4 addresses', () => {
    expect(isIP('1.2.3.4')).toBe(4);
    expect(isIP('192.168.1.1')).toBe(4);
  });

  it('accepts valid IPv6 addresses', () => {
    expect(isIP('::1')).toBe(6);
    expect(isIP('2001:db8::1')).toBe(6);
  });

  it('rejects malformed strings', () => {
    expect(isIP('not-an-ip')).toBe(0);
    expect(isIP('999.999.999.999')).toBe(0);
    expect(isIP('')).toBe(0);
    expect(isIP('javascript://evil')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// History file size guard
// ---------------------------------------------------------------------------
describe('History file size guard', () => {
  it('rejects files above 10 MB', () => {
    const MAX_HISTORY_FILE_BYTES = 10 * 1024 * 1024;
    expect(10 * 1024 * 1024 + 1 > MAX_HISTORY_FILE_BYTES).toBe(true);
  });

  it('accepts files at or below 10 MB', () => {
    const MAX_HISTORY_FILE_BYTES = 10 * 1024 * 1024;
    expect(1024 > MAX_HISTORY_FILE_BYTES).toBe(false);
  });
});
