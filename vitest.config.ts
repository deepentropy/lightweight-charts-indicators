import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The agent guide's examples (skills/) import the package by name, as a user does: test them on the sources
    alias: [{ find: /^lightweight-charts-indicators$/, replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) }],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/regression/**', 'tests/reference-regression/**'],
    testTimeout: 30000,
  },
});
