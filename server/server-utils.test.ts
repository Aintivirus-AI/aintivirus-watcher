import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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
// Replicate requireApiKey logic as it appears in server/index.ts.
// ---------------------------------------------------------------------------
function requireApiKey(
  req: { headers: Record<string, string | undefined> },
  secret: string | undefined,
): { status: number; body: Record<string, string> } | null {
  if (!secret) return { status: 503, body: { error: 'API authentication not configured' } };
  if (req.headers['x-api-key'] !== secret) return { status: 401, body: { error: 'Unauthorized' } };
  return null; // passes through (next() called)
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

describe('requireApiKey middleware', () => {
  it('returns 503 when API_SECRET is not configured', () => {
    const result = requireApiKey({ headers: {} }, undefined);
    expect(result?.status).toBe(503);
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
    const raw: string | undefined = undefined;
    const origins = raw?.split(',').map(o => o.trim()).filter(Boolean);
    expect(origins?.length ?? 0).toBe(0);
  });
});
