import react from '@vitejs/plugin-react';
import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  sharedTestConfig,
  defineProject({
    plugins: [react()],
    test: {
      name: 'desktop',
      include: ['src/**/*.test.{ts,tsx}'],
      // Adapter tests use Node; UI tests opt into jsdom with a file-level comment.
      environment: 'node',
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
);
