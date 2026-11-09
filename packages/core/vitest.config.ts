import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  sharedTestConfig,
  defineProject({
    test: {
      name: 'core',
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      },
    },
  }),
);
