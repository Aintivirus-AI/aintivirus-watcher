import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('allows requests up to the limit', () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.check('a', 0).allowed).toBe(true);
    expect(rl.check('a', 1).allowed).toBe(true);
    expect(rl.check('a', 2).allowed).toBe(true);
  });

  it('blocks the request that exceeds the limit', () => {
    const rl = new RateLimiter(3, 1000);
    for (let i = 0; i < 3; i++) rl.check('a', i);
    expect(rl.check('a', 4).allowed).toBe(false);
  });

  it('reports remaining budget', () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.check('a', 0).remaining).toBe(2);
    expect(rl.check('a', 0).remaining).toBe(1);
    expect(rl.check('a', 0).remaining).toBe(0);
  });

  it('reports how long until the window resets', () => {
    const rl = new RateLimiter(1, 1000);
    rl.check('a', 0);
    const denied = rl.check('a', 250);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBe(750);
  });

  it('opens a fresh window once the old one expires', () => {
    const rl = new RateLimiter(2, 1000);
    rl.check('a', 0);
    rl.check('a', 0);
    expect(rl.check('a', 999).allowed).toBe(false);
    expect(rl.check('a', 1000).allowed).toBe(true);
  });

  // The whole point of keying: one abusive client must not mute everyone else.
  it('tracks keys independently', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.check('flooder', 0).allowed).toBe(true);
    expect(rl.check('flooder', 0).allowed).toBe(false);
    expect(rl.check('bystander', 0).allowed).toBe(true);
  });

  it('forgets a key on demand, e.g. when a socket closes', () => {
    const rl = new RateLimiter(1, 1000);
    rl.check('a', 0);
    expect(rl.check('a', 0).allowed).toBe(false);
    rl.forget('a');
    expect(rl.check('a', 0).allowed).toBe(true);
  });

  describe('sweep', () => {
    it('drops only expired buckets', () => {
      const rl = new RateLimiter(5, 1000);
      rl.check('old', 0);
      rl.check('fresh', 900);
      expect(rl.size).toBe(2);

      const removed = rl.sweep(1500);

      expect(removed).toBe(1);
      expect(rl.size).toBe(1);
    });

    // Without sweeping, the map grows once per unique IP for the life of the
    // process — a slow leak on a long-running server.
    it('keeps memory bounded across many one-off keys', () => {
      const rl = new RateLimiter(5, 1000);
      for (let i = 0; i < 5000; i++) rl.check(`ip-${i}`, 0);
      expect(rl.size).toBe(5000);

      rl.sweep(2000);

      expect(rl.size).toBe(0);
    });

    it('is a no-op when nothing has expired', () => {
      const rl = new RateLimiter(5, 1000);
      rl.check('a', 0);
      expect(rl.sweep(500)).toBe(0);
      expect(rl.size).toBe(1);
    });
  });

  describe('chat configuration (5 per 10s)', () => {
    const burst = (rl: RateLimiter, n: number, at: number) =>
      Array.from({ length: n }, () => rl.check('conn', at).allowed);

    it('permits a normal burst of five', () => {
      const rl = new RateLimiter(5, 10_000);
      expect(burst(rl, 5, 0).every(Boolean)).toBe(true);
    });

    it('throttles a flood', () => {
      const rl = new RateLimiter(5, 10_000);
      const results = burst(rl, 100, 0);
      expect(results.filter(Boolean)).toHaveLength(5);
      expect(results.filter((r) => !r)).toHaveLength(95);
    });
  });
});
