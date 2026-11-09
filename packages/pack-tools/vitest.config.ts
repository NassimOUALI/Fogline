import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  sharedTestConfig,
  defineProject({ test: { name: 'pack-tools', include: ['src/**/*.test.ts'] } }),
);
