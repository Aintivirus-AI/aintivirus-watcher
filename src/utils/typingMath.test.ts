import { describe, it, expect } from 'vitest';
import { computeSteadyStateWpm, computeScrollDepthPercent } from './typingMath';

describe('computeSteadyStateWpm', () => {
  it('returns 0 when no interval data', () => {
    expect(computeSteadyStateWpm(0)).toBe(0);
    expect(computeSteadyStateWpm(-10)).toBe(0);
    expect(computeSteadyStateWpm(NaN)).toBe(0);
    expect(computeSteadyStateWpm(Infinity)).toBe(0);
  });

  it('computes 60 WPM at 200ms per character (steady state)', () => {
    expect(computeSteadyStateWpm(200)).toBe(60);
  });

  it('computes 120 WPM at 100ms per character (fast typist)', () => {
    expect(computeSteadyStateWpm(100)).toBe(120);
  });

  it('computes 24 WPM at 500ms per character (slow typist)', () => {
    expect(computeSteadyStateWpm(500)).toBe(24);
  });

  it('caps at 200 WPM to filter auto-repeat / timing artifacts', () => {
    // 20ms per char would imply 600 WPM — unrealistic
    expect(computeSteadyStateWpm(20)).toBe(200);
    expect(computeSteadyStateWpm(1)).toBe(200);
  });

  it('rounds to nearest integer', () => {
    // 60000 / (150 * 5) = 80 exactly
    expect(computeSteadyStateWpm(150)).toBe(80);
    // 60000 / (175 * 5) = 68.571...
    expect(computeSteadyStateWpm(175)).toBe(69);
  });
});

describe('computeScrollDepthPercent', () => {
  it('returns 0 at top of page with content below', () => {
    // scrollY=0, viewport=800, total=2000 → seen=800/2000 = 40%
    expect(computeScrollDepthPercent(0, 800, 2000)).toBe(40);
  });

  it('returns 100 when fully scrolled', () => {
    // scrollY = total - viewport = 1200; seen = 1200+800 = 2000 = 100%
    expect(computeScrollDepthPercent(1200, 800, 2000)).toBe(100);
  });

  it('returns 100 when content fits in viewport (no scrolling possible)', () => {
    expect(computeScrollDepthPercent(0, 800, 800)).toBe(100);
    expect(computeScrollDepthPercent(0, 800, 500)).toBe(100);
  });

  it('returns 0 on invalid inputs', () => {
    expect(computeScrollDepthPercent(NaN, 800, 2000)).toBe(0);
    expect(computeScrollDepthPercent(0, NaN, 2000)).toBe(0);
    expect(computeScrollDepthPercent(0, 800, NaN)).toBe(0);
  });

  it('clamps over-scroll (rubber-band) to 100', () => {
    // Some browsers let scrollY exceed total - viewport briefly
    expect(computeScrollDepthPercent(5000, 800, 2000)).toBe(100);
  });

  it('midway scroll is roughly 50% with viewport accounted for', () => {
    // scrollY = 600, viewport = 800, total = 2000
    // seen = 600 + 800 = 1400; 1400/2000 = 70%
    expect(computeScrollDepthPercent(600, 800, 2000)).toBe(70);
  });
});
