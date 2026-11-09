import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Architectural boundaries, enforced at the import-statement level.
 * dependency-cruiser enforces the same rules on the resolved module graph
 * (see .dependency-cruiser.cjs), so dynamic imports are covered too.
 */
const nodeBuiltins = [
  'node:*',
  'fs',
  'fs/*',
  'path',
  'os',
  'child_process',
  'crypto',
  'http',
  'https',
  'net',
  'stream',
  'url',
  'util',
  'zlib',
  'worker_threads',
  'readline',
  'process',
  'buffer',
  'events',
];

const patterns = {
  nodeIo: {
    group: nodeBuiltins,
    message: 'core must not use Node built-ins; depend on a port instead.',
  },
  tauri: { group: ['@tauri-apps/*'], message: 'core must not depend on Tauri.' },
  ui: {
    group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'leaflet', 'leaflet/*'],
    message: 'core must not depend on React or the map engine.',
  },
  apps: {
    group: ['**/apps/**', '@fogline/desktop'],
    message: 'packages must not import from apps.',
  },
  core: {
    group: ['@fogline/core', '**/packages/core/**'],
    message: 'this package must not depend on core.',
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'examples/**',
      '**/src-tauri/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // Adapters implement port methods whose arguments they may not need.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch'].map(
          (name) => ({ name, message: `core must not use the browser global ${name}.` }),
        ),
      ],
      // The typescript-eslint variant understands `import type`, which core may use for
      // pack-format (docs/01: "core -> pack-format (types only)").
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@fogline/pack-format',
              allowTypeImports: true,
              message:
                'core may only import types from pack-format; validation runs in adapters behind PackReader.',
            },
          ],
          patterns: [patterns.nodeIo, patterns.tauri, patterns.ui, patterns.apps],
        },
      ],
    },
  },
  {
    files: ['packages/pack-format/src/**/*.ts', 'packages/pack-tools/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [patterns.core, patterns.apps] }],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.config.ts', 'vitest.shared.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly' },
    },
  },
  prettier,
);
