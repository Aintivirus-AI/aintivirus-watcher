/**
 * Global test setup.
 *
 * @testing-library/react only auto-registers its `cleanup` when Vitest's
 * `globals` are enabled. This project had neither, so mounted components were
 * never unmounted between tests: the jsdom document accumulated every render
 * in a file, which makes `getByText` throw "found multiple elements" and lets
 * one test's DOM satisfy another's assertions.
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
