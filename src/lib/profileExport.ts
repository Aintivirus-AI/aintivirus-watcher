/**
 * "Everything this page worked out about you", as a file.
 *
 * The whole point of the profiler is to show how much a website can infer
 * without asking. Letting a visitor take the dossier with them makes that
 * concrete — and doubles as a subject-access-request style export.
 *
 * Built as pure functions so the shape can be tested without a DOM.
 */

export interface ProfileExportInput {
  hardware?: Record<string, unknown>;
  network?: Record<string, unknown>;
  browser?: Record<string, unknown>;
  behavioral?: Record<string, unknown>;
  detection?: Record<string, unknown>;
  fingerprints?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
  threat?: Record<string, unknown>;
}

export interface ProfileExport {
  meta: {
    generatedAt: string;
    source: string;
    schemaVersion: number;
    notice: string;
  };
  sections: Record<string, unknown>;
}

export const EXPORT_SCHEMA_VERSION = 2;

const NOTICE =
  'Collected in your browser by watcher.aintivirus.ai. Everything here was ' +
  'derived from what your browser volunteered — no account, no login, no ' +
  'permission prompt.';

/** Keys that would re-identify the visitor if the file were shared. */
const SENSITIVE_KEYS = new Set(['ip', 'publicIp', 'localIp', 'ipAddress']);

/**
 * Partially mask an IP so the export stays useful (country/ISP context) without
 * carrying a precise identifier into a file people paste into chats.
 */
export function maskIp(value: unknown): unknown {
  if (typeof value !== 'string' || !value) return value;

  if (value.includes(':')) {
    const groups = value.split(':');
    return groups.slice(0, 3).join(':') + '::' + 'x'.repeat(4);
  }

  const octets = value.split('.');
  if (octets.length === 4) return `${octets[0]}.${octets[1]}.x.x`;

  return value;
}

/** Recursively mask sensitive fields. Cycles are collapsed rather than thrown on. */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'function') continue;
    out[key] = SENSITIVE_KEYS.has(key) ? maskIp(v) : redact(v, seen);
  }
  return out;
}

export function buildProfileExport(
  input: ProfileExportInput,
  now: Date = new Date(),
): ProfileExport {
  const sections: Record<string, unknown> = {};

  for (const [name, section] of Object.entries(input)) {
    if (section === undefined || section === null) continue;
    sections[name] = redact(section);
  }

  return {
    meta: {
      generatedAt: now.toISOString(),
      source: 'watcher.aintivirus.ai',
      schemaVersion: EXPORT_SCHEMA_VERSION,
      notice: NOTICE,
    },
    sections,
  };
}

/** `digital-shadow-2026-08-01T09-20-00.json` — filesystem-safe on every OS. */
export function exportFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
  return `digital-shadow-${stamp}.json`;
}

export function serializeExport(data: ProfileExport): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Trigger a download in the browser. Separated from the builders so the data
 * shape stays testable without stubbing the DOM.
 */
export function downloadProfileExport(
  input: ProfileExportInput,
  now: Date = new Date(),
): void {
  const payload = serializeExport(buildProfileExport(input, now));
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = exportFilename(now);
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
