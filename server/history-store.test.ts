import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HistoryStore } from './history-store.js';
import type { HistoricalVisitor } from './stats.js';

const DAY = 24 * 60 * 60 * 1000;

let dir: string;
let file: string;

const visit = (over: Partial<HistoricalVisitor> = {}): HistoricalVisitor => ({
  lat: 1,
  lng: 2,
  city: 'Testville',
  country: 'Testland',
  connectedAt: Date.now(),
  ...over,
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-history-'));
  file = path.join(dir, 'visitors-history.json');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('HistoryStore', () => {
  describe('load', () => {
    it('starts empty when the file does not exist', () => {
      const store = new HistoryStore({ file });
      expect(store.load()).toBe(0);
      expect(store.size).toBe(0);
    });

    it('reads a previously written file', () => {
      fs.writeFileSync(file, JSON.stringify([visit(), visit()]));
      const store = new HistoryStore({ file });
      expect(store.load()).toBe(2);
    });

    // A crash mid-write used to be able to leave a truncated file; loading must
    // degrade to empty rather than throwing on boot.
    it('survives a corrupt file', () => {
      fs.writeFileSync(file, '[{"lat":1,"lng":2,"conn');
      const store = new HistoryStore({ file });
      expect(store.load()).toBe(0);
      expect(store.size).toBe(0);
    });

    it('survives a file that is valid JSON but the wrong shape', () => {
      fs.writeFileSync(file, JSON.stringify({ not: 'an array' }));
      expect(new HistoryStore({ file }).load()).toBe(0);
    });

    it('discards entries missing required numeric fields', () => {
      fs.writeFileSync(file, JSON.stringify([
        visit(),
        { city: 'no coords' },
        { lat: 'x', lng: 2, connectedAt: 1 },
        visit(),
      ]));
      expect(new HistoryStore({ file }).load()).toBe(2);
    });

    it('ignores a file larger than the size guard', () => {
      fs.writeFileSync(file, JSON.stringify([visit()]));
      const store = new HistoryStore({ file, maxFileBytes: 4 });
      expect(store.load()).toBe(0);
    });

    it('applies retention on load, not just on append', () => {
      fs.writeFileSync(file, JSON.stringify([
        visit({ connectedAt: Date.now() - 60 * DAY }),
        visit({ connectedAt: Date.now() }),
      ]));
      const store = new HistoryStore({ file, retentionMs: 30 * DAY });
      expect(store.load()).toBe(1);
    });
  });

  describe('append', () => {
    it('accumulates entries in order', () => {
      const store = new HistoryStore({ file });
      store.append(visit({ city: 'first' }));
      store.append(visit({ city: 'second' }));
      expect(store.all().map((v) => v.city)).toEqual(['first', 'second']);
    });

    it('evicts the oldest entries past the cap', () => {
      const store = new HistoryStore({ file, maxEntries: 3 });
      for (let i = 0; i < 6; i++) store.append(visit({ city: `c${i}` }));

      expect(store.size).toBe(3);
      expect(store.all().map((v) => v.city)).toEqual(['c3', 'c4', 'c5']);
    });

    it('drops entries older than the retention window', () => {
      const store = new HistoryStore({ file, retentionMs: 30 * DAY });
      const now = Date.now();
      store.append(visit({ city: 'ancient', connectedAt: now - 40 * DAY }), now);
      store.append(visit({ city: 'recent', connectedAt: now }), now);

      expect(store.all().map((v) => v.city)).toEqual(['recent']);
    });
  });

  describe('persistence', () => {
    it('writes to disk after the debounce window', async () => {
      const store = new HistoryStore({ file, flushDelayMs: 5 });
      store.append(visit({ city: 'persisted' }));

      expect(fs.existsSync(file)).toBe(false); // debounced, not yet written

      await new Promise((r) => setTimeout(r, 25));
      await store.flush();

      const onDisk = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(onDisk).toHaveLength(1);
      expect(onDisk[0].city).toBe('persisted');
      store.dispose();
    });

    // The original wrote the whole array synchronously on every connect. The
    // debounce means a burst costs one write, not one per visitor.
    it('coalesces a burst of appends into a single file write', async () => {
      const store = new HistoryStore({ file, flushDelayMs: 5 });
      for (let i = 0; i < 200; i++) store.append(visit({ city: `c${i}` }));

      await new Promise((r) => setTimeout(r, 25));
      await store.flush();

      expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toHaveLength(200);
      store.dispose();
    });

    it('writes atomically, leaving no temp file behind', async () => {
      const store = new HistoryStore({ file, flushDelayMs: 1 });
      store.append(visit());
      await new Promise((r) => setTimeout(r, 10));
      await store.flush();

      expect(fs.existsSync(`${file}.tmp`)).toBe(false);
      expect(fs.existsSync(file)).toBe(true);
      store.dispose();
    });

    it('restricts the file to owner-only permissions (it holds locations)', async () => {
      const store = new HistoryStore({ file, flushDelayMs: 1 });
      store.append(visit());
      await new Promise((r) => setTimeout(r, 10));
      await store.flush();

      const mode = fs.statSync(file).mode & 0o777;
      expect(mode).toBe(0o600);
      store.dispose();
    });

    it('flushSync writes immediately for shutdown', () => {
      const store = new HistoryStore({ file, flushDelayMs: 10_000 });
      store.append(visit({ city: 'shutdown' }));

      store.flushSync();

      expect(JSON.parse(fs.readFileSync(file, 'utf-8'))[0].city).toBe('shutdown');
      store.dispose();
    });

    it('keeps serving from memory when the directory is not writable', async () => {
      const store = new HistoryStore({
        file: path.join('/proc/definitely-not-writable', 'history.json'),
        flushDelayMs: 1,
      });
      store.append(visit({ city: 'memory-only' }));

      await new Promise((r) => setTimeout(r, 10));
      await store.flush();

      expect(store.isWritable).toBe(false);
      expect(store.all()).toHaveLength(1); // still served from memory
      store.dispose();
    });

    it('round-trips through a reload', async () => {
      const first = new HistoryStore({ file, flushDelayMs: 1 });
      first.append(visit({ city: 'alpha' }));
      first.append(visit({ city: 'beta' }));
      await new Promise((r) => setTimeout(r, 10));
      await first.flush();
      first.dispose();

      const second = new HistoryStore({ file });
      expect(second.load()).toBe(2);
      expect(second.all().map((v) => v.city)).toEqual(['alpha', 'beta']);
    });
  });
});
