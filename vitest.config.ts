import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Unmounts rendered components between tests — see src/setupTests.ts.
    setupFiles: ['./src/setupTests.ts'],
  },
});
