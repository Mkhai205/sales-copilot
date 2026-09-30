import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '**/dist/**',
      'out/**',
      '**/out/**',
      '.next/**',
      '**/.next/**',
      'node_modules/**',
      '**/node_modules/**',
      '.nx/**',
      '**/.nx/**',
      'coverage/**',
      '**/coverage/**',
      'docs/**',
      '**/docs/**',
      '.agents/**',
      '**/.agents/**',
      'public/**',
      '**/public/**',
      'tmp/**',
      '**/tmp/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }],
    },
  },

  // ============================================================================
  // Phase 4 decision D8 — UI guardrails (2026-09-28, docs/audit/phase-4-decisions-2026-09-28.md)
  // Raw <button> and direct radix-ui/@shadcn imports are restricted outside components/ui.
  // Files listed in `ignores` are GRANDFATHERED pre-existing debt: remove an entry only
  // when that file has been refactored to the shadcn components.
  // ============================================================================
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: [
      'apps/web/src/components/ui/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXElement[openingElement.name.name='button']",
          message:
            'Use the shadcn Button component (@/components/ui/button) instead of a raw <button> element.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['radix-ui', 'radix-ui/*'],
              message: 'Import from the shadcn wrapper (@/components/ui/*) instead of radix-ui directly.',
            },
            {
              group: ['@radix-ui/*'],
              message: 'Import from the shadcn wrapper (@/components/ui/*) instead of @radix-ui packages directly.',
            },
            {
              group: ['@shadcn/react', '@shadcn/react/*'],
              message: '@shadcn/react may only be imported inside components/ui.',
            },
          ],
        },
      ],
    },
  },
);
