import { defineConfig } from 'vitest/config';

// Coverage is configured per package (see packages/core/vitest.config.ts) because Vitest only
// resolves coverage paths reliably when the package directory is the root.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
