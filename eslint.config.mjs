import expoConfig from 'eslint-config-expo/flat.js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'apps/mobile/ios/**',
      'apps/api/drizzle/**',
      'docs/v0.2/openapi.json',
    ],
  },
  ...expoConfig,
  {
    rules: {
      '@typescript-eslint/array-type': 'off',
      'import/order': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
