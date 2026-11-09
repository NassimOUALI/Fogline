/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-no-apps',
      severity: 'error',
      comment: 'core is the innermost layer; it never imports from apps.',
      from: { path: '^packages/core/src' },
      to: { path: '^apps/' },
    },
    {
      name: 'core-no-node-builtins',
      severity: 'error',
      comment: 'core has no I/O; everything external goes through a port.',
      from: { path: '^packages/core/src' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'core-no-ui-or-shell',
      severity: 'error',
      comment: 'core must not depend on React, Tauri or the map engine.',
      from: { path: '^packages/core/src' },
      to: { path: ['(^|/)react(-dom)?(/|$)', '(^|/)@tauri-apps/', '(^|/)leaflet(/|$)'] },
    },
    {
      name: 'core-uses-pack-format-types-only',
      severity: 'error',
      comment: 'docs/01: core -> pack-format (types only). Runtime validation lives in adapters.',
      from: { path: '^packages/core/src' },
      to: { path: '^packages/pack-format', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'pack-format-no-core',
      severity: 'error',
      comment: 'pack-format is shared by app and CLI and sits below core.',
      from: { path: '^packages/pack-format/src' },
      to: { path: ['^packages/core', '^apps/'] },
    },
    {
      name: 'pack-tools-no-core-or-apps',
      severity: 'error',
      comment: 'pack-tools depends only on pack-format.',
      from: { path: '^packages/pack-tools/src' },
      to: { path: ['^packages/core', '^apps/'] },
    },
    {
      name: 'desktop-ui-no-tauri-or-adapters',
      severity: 'error',
      comment: 'The UI uses services from the composition root, never Tauri or adapters directly.',
      from: { path: '^apps/desktop/src/ui', pathNot: '\\.test\\.tsx?$' },
      to: { path: ['^apps/desktop/src/adapters', '(^|/)@tauri-apps/'] },
    },
    {
      name: 'no-test-helpers-in-production',
      severity: 'error',
      comment: 'Testing kits import Vitest; production code must not ship them.',
      from: {
        path: '^(apps|packages)/[^/]+/src',
        pathNot: ['\\.test\\.tsx?$', '/src/test/', '^packages/core/src/testing/'],
      },
      to: {
        path: [
          '^packages/core/src/testing/',
          '^packages/pack-format/test/',
          '^apps/desktop/src/test/',
        ],
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-test-imports-from-src',
      severity: 'error',
      comment: 'production code never imports test files.',
      from: { path: '\\.ts$', pathNot: '\\.test\\.ts$' },
      to: { path: '\\.test\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json'],
    },
    // npm packages stay in the graph as leaves (doNotFollow) so rules can match them;
    // excluding node_modules would hide every resolved third-party import from the rules.
    exclude: { path: ['\\.d\\.ts$'] },
  },
};
