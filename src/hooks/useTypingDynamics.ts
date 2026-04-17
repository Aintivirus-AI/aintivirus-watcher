import { useEffect, useRef } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { computeSteadyStateWpm } from '../utils/typingMath';

interface PendingKey {
  /** Physical key identifier (stable across caps lock, modifiers) */
  code: string;
  downTime: number;
}

const MIN_INTERVAL_MS = 1;          // reject obviously-bad timestamps
const MAX_INTERVAL_MS = 2_000;      // pauses > 2s don't count as "typing"
const MIN_HOLD_MS = 1;
const MAX_HOLD_MS = 1_000;

export function useTypingDynamics() {
  const { updateTyping, addConsoleEntry } = useProfileStore();
  // Pending keydown events indexed by `e.code` (physical key), so repeated keys pair correctly
  const pendingRef = useRef<Map<string, PendingKey>>(new Map());
  const holdTimesRef = useRef<number[]>([]);
  const interKeysRef = useRef<number[]>([]);
  const lastKeyDownRef = useRef<number | null>(null);
  const keystrokeCountRef = useRef(0);
  const hasLoggedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier combos and special/function keys — focus on literal typing.
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return;

      const now = Date.now();
      keystrokeCountRef.current++;

      // Inter-key interval between consecutive keydowns (active typing rhythm)
      if (lastKeyDownRef.current !== null) {
        const interval = now - lastKeyDownRef.current;
        if (interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS) {
          interKeysRef.current.push(interval);
        }
      }
      lastKeyDownRef.current = now;

      // Store pending keydown — keyed by physical key so fast-repeated keys pair correctly.
      // If the browser sends repeat keydowns without intervening keyup (key auto-repeat),
      // we overwrite; we intentionally drop auto-repeat hold times since they'd be meaningless.
      pendingRef.current.set(e.code, { code: e.code, downTime: now });

      updateTyping({
        totalKeystrokes: keystrokeCountRef.current,
        lastKeystrokeTime: now,
      });

      if (!hasLoggedRef.current) {
        addConsoleEntry('SCAN', 'Keystroke pattern analysis initiated');
        hasLoggedRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.length > 1) return;

      const now = Date.now();
      const pending = pendingRef.current.get(e.code);
      if (pending) {
        const holdTime = now - pending.downTime;
        if (holdTime >= MIN_HOLD_MS && holdTime <= MAX_HOLD_MS) {
          holdTimesRef.current.push(holdTime);
        }
        pendingRef.current.delete(e.code);
      }

      const avgHoldTime =
        holdTimesRef.current.length > 0
          ? holdTimesRef.current.reduce((a, b) => a + b, 0) / holdTimesRef.current.length
          : 0;

      const avgInterval =
        interKeysRef.current.length > 0
          ? interKeysRef.current.reduce((a, b) => a + b, 0) / interKeysRef.current.length
          : 0;

      const wpm = computeSteadyStateWpm(avgInterval);

      updateTyping({
        averageWPM: wpm,
        averageHoldTime: Math.round(avgHoldTime),
        keyInterval: avgInterval > 0 ? Math.round(avgInterval) : null,
      });

      // Trim histories
      if (holdTimesRef.current.length > 100) {
        holdTimesRef.current = holdTimesRef.current.slice(-50);
      }
      if (interKeysRef.current.length > 100) {
        interKeysRef.current = interKeysRef.current.slice(-50);
      }
      // Pending map naturally stays small, but clear stale (>10s) entries occasionally
      if (pendingRef.current.size > 20) {
        const cutoff = now - 10_000;
        for (const [code, key] of pendingRef.current) {
          if (key.downTime < cutoff) pendingRef.current.delete(code);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [updateTyping, addConsoleEntry]);
}
