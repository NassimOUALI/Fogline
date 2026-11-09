import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  sharedTestConfig,
  defineProject({
    test: {
      name: 'pack-tools',
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      // Image work with sharp is slower than the pure-TypeScript packages.
      testTimeout: 60_000,
      hookTimeout: 120_000,
    },
  }),
);
