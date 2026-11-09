import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

/** Shared Vitest settings: resolve workspace packages to their TypeScript sources. */
export const sharedTestConfig: UserConfig = {
  resolve: {
    alias: {
      '@fogline/core': `${root}packages/core/src/index.ts`,
      '@fogline/pack-format': `${root}packages/pack-format/src/index.ts`,
      '@fogline/pack-tools': `${root}packages/pack-tools/src/index.ts`,
    },
  },
};
