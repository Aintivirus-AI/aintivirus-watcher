/**
 * Sliding-window rate limiting.
 *
 * The HTTP `/api/analyze` route had an inline limiter; the WebSocket chat had
 * none at all, which mattered more: every accepted chat message is broadcast
 * to every connected client, so one client sending in a loop is an
 * amplification attack against the whole room, not just the server.
 *
 * Keys are caller-defined (an IP for HTTP, a connection id for sockets).
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still available in the current window. */
  remaining: number;
  /** Milliseconds until the window resets. 0 when not limited. */
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.limit - 1, retryAfterMs: 0 };
    }

    if (bucket.count >= this.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
    }

    bucket.count++;
    return { allowed: true, remaining: this.limit - bucket.count, retryAfterMs: 0 };
  }

  /** Drop a key immediately (e.g. when a socket disconnects). */
  forget(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Drop expired buckets. Without this the map grows once per unique IP
   * forever, which is a slow memory leak on a long-lived process.
   */
  sweep(now: number = Date.now()): number {
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.buckets.size;
  }
}
