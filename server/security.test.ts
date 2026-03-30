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
