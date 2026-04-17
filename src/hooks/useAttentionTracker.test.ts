/**
 * Tests for useAttentionTracker.
 *
 * These tests exercise the hook's visibility-change state machine end-to-end via
 * document.visibilitychange events, then inspect what the hook pushes into the
 * profile store. The core accuracy invariants:
 *
 *   - tabSwitches increments every time the tab becomes hidden.
 *   - timesWentAFK only increments when the hidden duration ≥ 30s.
 *   - focusTime accumulates while visible and pauses while hidden.
 *   - totalHiddenTime aggregates every hidden interval.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

type AttentionUpdate = {
  tabSwitches?: number;
  totalHiddenTime?: number;
  timesWentAFK?: number;
  focusTime?: number;
  isVisible?: boolean;
};

const attentionUpdates: AttentionUpdate[] = [];

function latestCall(): AttentionUpdate | undefined {
  return attentionUpdates[attentionUpdates.length - 1];
}

vi.mock('../store/useProfileStore', () => {
  const updateAttention = vi.fn((data: AttentionUpdate) => {
    attentionUpdates.push(data);
  });
  const addConsoleEntry = vi.fn();
  const hook = () => ({ updateAttention, addConsoleEntry });
  (hook as typeof hook & { getState: () => unknown }).getState = () => ({});
  return { useProfileStore: hook };
});

// Simulate document.visibilityState changes.
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useAttentionTracker', () => {
  beforeEach(() => {
    attentionUpdates.length = 0;
    vi.useFakeTimers();
    // Start visible
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('counts a tab switch but no AFK for a sub-30s absence', async () => {
    const { useAttentionTracker } = await import('./useAttentionTracker');
    renderHook(() => useAttentionTracker());

    // Hide tab
    vi.setSystemTime(new Date('2026-04-17T00:00:00Z'));
    setHidden(true);

    // Only 5 seconds away (< 30s AFK threshold)
    vi.setSystemTime(new Date('2026-04-17T00:00:05Z'));
    setHidden(false);

    const updates = attentionUpdates.filter((u) => u.tabSwitches != null);
    const afkUpdates = attentionUpdates.filter((u) => u.timesWentAFK != null);
    expect(updates[updates.length - 1]?.tabSwitches).toBe(1);
    expect(afkUpdates[afkUpdates.length - 1]?.timesWentAFK).toBe(0);
  });

  it('counts an AFK for a 30+ second absence', async () => {
    const { useAttentionTracker } = await import('./useAttentionTracker');
    renderHook(() => useAttentionTracker());

    vi.setSystemTime(new Date('2026-04-17T00:00:00Z'));
    setHidden(true);

    // 45 seconds away
    vi.setSystemTime(new Date('2026-04-17T00:00:45Z'));
    setHidden(false);

    const last = latestCall();
    expect(last?.tabSwitches).toBe(1);
    expect(last?.timesWentAFK).toBe(1);
  });

  it('accumulates totalHiddenTime across multiple absences', async () => {
    const { useAttentionTracker } = await import('./useAttentionTracker');
    renderHook(() => useAttentionTracker());

    vi.setSystemTime(new Date('2026-04-17T00:00:00Z'));
    setHidden(true);
    vi.setSystemTime(new Date('2026-04-17T00:00:10Z'));
    setHidden(false);

    vi.setSystemTime(new Date('2026-04-17T00:00:20Z'));
    setHidden(true);
    vi.setSystemTime(new Date('2026-04-17T00:00:25Z'));
    setHidden(false);

    const hiddenUpdates = attentionUpdates.filter((u) => u.totalHiddenTime != null);
    const last = hiddenUpdates[hiddenUpdates.length - 1];
    expect(last?.totalHiddenTime).toBe(15_000); // 10s + 5s
    // Two tab switches, zero AFKs (both < 30s)
    const tabSwitchUpdates = attentionUpdates.filter((u) => u.tabSwitches != null);
    expect(tabSwitchUpdates[tabSwitchUpdates.length - 1]?.tabSwitches).toBe(2);
  });

  it('does not double-count timesWentAFK on a single hidden→visible transition', async () => {
    const { useAttentionTracker } = await import('./useAttentionTracker');
    renderHook(() => useAttentionTracker());

    vi.setSystemTime(new Date('2026-04-17T00:00:00Z'));
    setHidden(true);
    vi.setSystemTime(new Date('2026-04-17T00:01:00Z'));
    setHidden(false);

    const afkUpdates = attentionUpdates.filter((u) => u.timesWentAFK != null);
    expect(afkUpdates[afkUpdates.length - 1]?.timesWentAFK).toBe(1);
  });
});
