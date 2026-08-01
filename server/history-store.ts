/**
 * Visitor history persistence.
 *
 * The previous implementation called `fs.writeFileSync(JSON.stringify(all))`
 * inside the WebSocket connection handler. That is O(n) work on the event loop
 * for every single connect: at the 10,000-entry cap it re-serialised roughly a
 * megabyte and blocked the process — including every other client's traffic —
 * on a synchronous disk write, on the hot path.
 *
 * This version keeps the same on-disk format (a JSON array) but:
 *   - writes asynchronously,
 *   - coalesces bursts behind a debounce so a hundred connects cost one write,
 *   - never overlaps two writes,
 *   - writes to a temp file and renames, so a crash mid-write cannot leave a
 *     truncated file that fails to parse on the next boot.
 */

import fs from 'fs';
import path from 'path';
import type { HistoricalVisitor } from './stats.js';

export interface HistoryStoreOptions {
  file: string;
  maxEntries?: number;
  retentionMs?: number;
  /** Debounce window for coalescing writes. */
  flushDelayMs?: number;
  maxFileBytes?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class HistoryStore {
  private entries: HistoricalVisitor[] = [];
  private readonly file: string;
  private readonly maxEntries: number;
  private readonly retentionMs: number;
  private readonly flushDelayMs: number;
  private readonly maxFileBytes: number;

  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private writing = false;
  private dirty = false;
  private writable = true;

  constructor(opts: HistoryStoreOptions) {
    this.file = opts.file;
    this.maxEntries = opts.maxEntries ?? 10_000;
    this.retentionMs = opts.retentionMs ?? 30 * DAY_MS;
    this.flushDelayMs = opts.flushDelayMs ?? 2_000;
    this.maxFileBytes = opts.maxFileBytes ?? 10 * 1024 * 1024;
  }

  /** Load persisted entries. Never throws — a bad file just starts empty. */
  load(): number {
    try {
      if (!fs.existsSync(this.file)) return 0;
      const stat = fs.statSync(this.file);
      if (stat.size > this.maxFileBytes) return 0;
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      if (Array.isArray(parsed)) {
        this.entries = parsed.filter(isHistoricalVisitor);
        this.prune(Date.now());
      }
    } catch {
      this.entries = [];
    }
    return this.entries.length;
  }

  append(entry: HistoricalVisitor, now: number = Date.now()): void {
    this.entries.push(entry);
    this.prune(now);
    this.scheduleFlush();
  }

  /** Drop expired and over-cap entries. Entries are in connection order. */
  private prune(now: number): void {
    const cutoff = now - this.retentionMs;
    let stale = 0;
    while (stale < this.entries.length && this.entries[stale].connectedAt < cutoff) stale++;
    if (stale > 0) this.entries.splice(0, stale);

    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  private scheduleFlush(): void {
    if (!this.writable) return;
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.flushDelayMs);
    // Don't hold the process open purely for a pending history write.
    if (typeof this.flushTimer === 'object' && this.flushTimer && 'unref' in this.flushTimer) {
      (this.flushTimer as unknown as { unref: () => void }).unref();
    }
  }

  /** Write current entries to disk. Safe to call concurrently. */
  async flush(): Promise<void> {
    if (!this.writable || this.writing || !this.dirty) return;
    this.writing = true;
    this.dirty = false;

    const snapshot = JSON.stringify(this.entries);
    const tmp = `${this.file}.tmp`;

    try {
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
      await fs.promises.writeFile(tmp, snapshot, { mode: 0o600 });
      await fs.promises.rename(tmp, this.file);
      await fs.promises.chmod(this.file, 0o600).catch(() => {});
    } catch {
      this.writable = false;
      this.dirty = false;
      await fs.promises.unlink(tmp).catch(() => {});
    } finally {
      this.writing = false;
      // A write that landed while we were flushing needs another pass.
      if (this.dirty) this.scheduleFlush();
    }
  }

  /** Flush synchronously — used on shutdown so nothing in flight is lost. */
  flushSync(): void {
    if (!this.writable || !this.dirty) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.entries), { mode: 0o600 });
      fs.renameSync(tmp, this.file);
      this.dirty = false;
    } catch {
      this.writable = false;
    }
  }

  all(): readonly HistoricalVisitor[] {
    return this.entries;
  }

  get size(): number {
    return this.entries.length;
  }

  get isWritable(): boolean {
    return this.writable;
  }

  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

function isHistoricalVisitor(v: unknown): v is HistoricalVisitor {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.lat === 'number' && Number.isFinite(e.lat) &&
    typeof e.lng === 'number' && Number.isFinite(e.lng) &&
    typeof e.connectedAt === 'number' && Number.isFinite(e.connectedAt)
  );
}
