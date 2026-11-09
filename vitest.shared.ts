import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Shared Vitest settings: resolve workspace packages to their TypeScript sources.
 * Exact-match regexes so `@fogline/core` does not swallow `@fogline/core/testing`.
 */
export const sharedTestConfig: UserConfig = {
  resolve: {
    alias: [
      {
        find: /^@fogline\/core\/testing$/,
        replacement: `${root}packages/core/src/testing/index.ts`,
      },
      { find: /^@fogline\/core$/, replacement: `${root}packages/core/src/index.ts` },
      {
        find: /^@fogline\/pack-format\/testing$/,
        replacement: `${root}packages/pack-format/test/index.ts`,
      },
      { find: /^@fogline\/pack-format$/, replacement: `${root}packages/pack-format/src/index.ts` },
      { find: /^@fogline\/pack-tools$/, replacement: `${root}packages/pack-tools/src/index.ts` },
    ],
  },
};
