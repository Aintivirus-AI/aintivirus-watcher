import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildProfileExport,
  exportFilename,
  serializeExport,
  maskIp,
  redact,
  downloadProfileExport,
  EXPORT_SCHEMA_VERSION,
} from './profileExport';

const NOW = new Date('2026-08-01T09:20:00.000Z');

describe('maskIp', () => {
  it('keeps the network half of an IPv4 address and drops the host half', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.x.x');
  });

  it('truncates IPv6 to its first three groups', () => {
    expect(maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3::xxxx');
  });

  it('leaves non-address values alone', () => {
    expect(maskIp('not-an-ip')).toBe('not-an-ip');
    expect(maskIp(null)).toBe(null);
    expect(maskIp(42)).toBe(42);
    expect(maskIp('')).toBe('');
  });
});

describe('redact', () => {
  it('masks IP-bearing keys at any depth', () => {
    const out = redact({ network: { ip: '198.51.100.7', city: 'Berlin' } }) as Record<string, Record<string, unknown>>;
    expect(out.network.ip).toBe('198.51.x.x');
    expect(out.network.city).toBe('Berlin');
  });

  it('masks every known IP alias', () => {
    const out = redact({ publicIp: '1.2.3.4', localIp: '10.0.0.5', ipAddress: '8.8.8.8' }) as Record<string, string>;
    expect(out.publicIp).toBe('1.2.x.x');
    expect(out.localIp).toBe('10.0.x.x');
    expect(out.ipAddress).toBe('8.8.x.x');
  });

  it('walks arrays', () => {
    const out = redact([{ ip: '203.0.113.1' }, { ip: '203.0.113.2' }]) as Array<{ ip: string }>;
    expect(out.map((o) => o.ip)).toEqual(['203.0.x.x', '203.0.x.x']);
  });

  it('drops functions, which cannot be serialised anyway', () => {
    const out = redact({ keep: 1, fn: () => 'nope' }) as Record<string, unknown>;
    expect(out).toEqual({ keep: 1 });
  });

  it('collapses circular references instead of throwing', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;
    expect(() => redact(cyclic)).not.toThrow();
    expect((redact(cyclic) as Record<string, unknown>).self).toBe('[circular]');
  });

  it('preserves primitives and nulls', () => {
    expect(redact({ a: 1, b: 'two', c: true, d: null })).toEqual({ a: 1, b: 'two', c: true, d: null });
  });
});

describe('buildProfileExport', () => {
  it('stamps metadata', () => {
    const out = buildProfileExport({ hardware: { cpuCores: 8 } }, NOW);

    expect(out.meta.generatedAt).toBe('2026-08-01T09:20:00.000Z');
    expect(out.meta.source).toBe('watcher.aintivirus.ai');
    expect(out.meta.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(out.meta.notice).toMatch(/no account, no login/i);
  });

  it('includes each provided section', () => {
    const out = buildProfileExport({
      hardware: { cpuCores: 8 },
      network: { city: 'Oslo' },
      behavioral: { typing: { wpm: 70 } },
    }, NOW);

    expect(Object.keys(out.sections).sort()).toEqual(['behavioral', 'hardware', 'network']);
    expect(out.sections.hardware).toEqual({ cpuCores: 8 });
  });

  it('omits sections that were never collected', () => {
    const out = buildProfileExport({ hardware: { cpuCores: 4 }, network: undefined }, NOW);
    expect(out.sections).not.toHaveProperty('network');
  });

  it('redacts through the whole tree', () => {
    const out = buildProfileExport({ network: { ip: '192.0.2.55', isp: 'Example ISP' } }, NOW);
    const network = out.sections.network as Record<string, unknown>;

    expect(network.ip).toBe('192.0.x.x');
    expect(network.isp).toBe('Example ISP');
  });

  it('produces an empty-but-valid export when nothing was collected', () => {
    const out = buildProfileExport({}, NOW);
    expect(out.sections).toEqual({});
    expect(out.meta.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
  });
});

describe('serializeExport', () => {
  it('emits indented, re-parseable JSON', () => {
    const json = serializeExport(buildProfileExport({ hardware: { ram: 16 } }, NOW));

    expect(json).toContain('\n  ');
    expect(JSON.parse(json).sections.hardware.ram).toBe(16);
  });

  it('handles a deeply nested profile', () => {
    const deep = { a: { b: { c: { d: { e: 'bottom' } } } } };
    const json = serializeExport(buildProfileExport({ analysis: deep }, NOW));
    expect(JSON.parse(json).sections.analysis.a.b.c.d.e).toBe('bottom');
  });
});

describe('exportFilename', () => {
  it('is filesystem-safe on every OS', () => {
    const name = exportFilename(NOW);
    expect(name).toBe('digital-shadow-2026-08-01T09-20-00-000.json');
    expect(name).not.toMatch(/[:*?"<>|]/);
  });

  it('changes with the timestamp so exports do not overwrite each other', () => {
    expect(exportFilename(new Date('2026-08-01T09:20:00Z')))
      .not.toBe(exportFilename(new Date('2026-08-01T09:21:00Z')));
  });
});

describe('downloadProfileExport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('creates a blob URL, clicks a link, and cleans up', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') (el as HTMLAnchorElement).click = click;
      return el;
    });

    downloadProfileExport({ hardware: { cpuCores: 8 } }, NOW);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull(); // link removed

    // Revocation is deferred; revoking immediately cancels the download in
    // some browsers.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1100);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');

    vi.unstubAllGlobals();
  });
});
