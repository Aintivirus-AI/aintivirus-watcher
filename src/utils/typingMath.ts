/**
 * Standardized WPM calculation.
 *
 * "Words Per Minute" for display typing uses the convention of 5 characters per word.
 * Given the *average inter-key interval* (in ms) during active typing, the implied
 * characters-per-minute is 60000/interval and the words-per-minute is that divided by 5.
 *
 *   avgInterval = 200ms → CPM = 300  → WPM = 60
 *   avgInterval = 100ms → CPM = 600  → WPM = 120
 *
 * The display is capped at 200 WPM — anything higher is almost certainly a timing
 * artifact (e.g. a held-down key auto-repeating at < 50ms intervals).
 */
export function computeSteadyStateWpm(avgIntervalMs: number): number {
  if (!Number.isFinite(avgIntervalMs) || avgIntervalMs <= 0) return 0;
  const wpm = 60_000 / (avgIntervalMs * 5);
  if (!Number.isFinite(wpm)) return 0;
  return Math.min(Math.round(wpm), 200);
}

/**
 * Scroll depth as a percentage (0–100) of how far through the document the user
 * has seen — accounts for the viewport sitting "on top of" the rest of the content.
 *
 * At top of page:       scrollY = 0, innerHeight = H, depth = H / total * 100
 * Scrolled fully:       scrollY = total - H, depth = total / total * 100 = 100%
 *
 * If total <= viewport (nothing to scroll), depth is 100% — the user has seen everything.
 */
export function computeScrollDepthPercent(
  scrollY: number,
  innerHeight: number,
  scrollHeight: number,
): number {
  if (!Number.isFinite(scrollY) || !Number.isFinite(innerHeight) || !Number.isFinite(scrollHeight)) {
    return 0;
  }
  if (scrollHeight <= innerHeight || scrollHeight <= 0) return 100;
  const seen = Math.max(0, Math.min(scrollY + innerHeight, scrollHeight));
  return Math.round((seen / scrollHeight) * 100);
}
