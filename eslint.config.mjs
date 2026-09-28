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
      "apps/web/src/components/ui/flow-button.tsx",
      "apps/web/src/components/ui/sidebar.tsx",
      "apps/web/src/components/ui/ghost-404-page-1.tsx",
      "apps/web/src/features/auth/components/login-form.tsx",
      "apps/web/src/features/auth/components/change-password-dialog.tsx",
      "apps/web/src/features/commerce/inventory/inventory-view.tsx",
      "apps/web/src/features/commerce/inventory/components/stock-adjustment-dialog.tsx",
      "apps/web/src/features/commerce/orders/orders-view.tsx",
      "apps/web/src/features/commerce/orders/components/order-financial-summary.tsx",
      "apps/web/src/features/commerce/products/products-view.tsx",
      "apps/web/src/features/commerce/products/components/products-table.tsx",
      "apps/web/src/features/commerce/products/components/product-dialog.tsx",
      "apps/web/src/features/commerce/reconciliation/components/transaction-detail-sheet.tsx",
      "apps/web/src/features/commerce/reconciliation/components/reconciliation-filter-toolbar.tsx",
      "apps/web/src/features/commerce/reconciliation/components/reconciliation-ledger-table.tsx",
      "apps/web/src/features/contacts/components/contacts-table.tsx",
      "apps/web/src/features/contacts/contacts-view.tsx",
      "apps/web/src/features/conversations/composer/chat-composer.tsx",
      "apps/web/src/features/conversations/detail/label-manager.tsx",
      "apps/web/src/features/conversations/list/conversation-filter-popover.tsx",
      "apps/web/src/features/conversations/list/conversation-list-filters.tsx",
      "apps/web/src/features/conversations/list/conversation-list.tsx",
      "apps/web/src/features/conversations/thread/message-actions-toolbar.tsx",
      "apps/web/src/features/conversations/thread/image-lightbox-dialog.tsx",
      "apps/web/src/features/conversations/thread/message-thread.tsx",
      "apps/web/src/features/platform-admin/audit-logs/components/audit-logs-table.tsx",
      "apps/web/src/features/platform-admin/workspaces/components/workspaces-table.tsx",
      "apps/web/src/features/settings/bank/components/bank-settings-form.tsx",
      "apps/web/src/features/settings/inboxes/detail/tab-general-settings.tsx",
      "apps/web/src/features/settings/inboxes/detail/channels/facebook/facebook-config.tsx",
      "apps/web/src/features/settings/inboxes/detail/channels/web-chat/web-chat-config.tsx",
      "apps/web/src/features/settings/inboxes/detail/channels/web-chat/web-chat-preview.tsx",
      "apps/web/src/features/settings/knowledge/components/knowledge-test-search-dialog.tsx",
      "apps/web/src/features/settings/knowledge/components/knowledge-article-table.tsx",
      "apps/web/src/features/settings/labels/components/label-form-dialog.tsx",
      "apps/web/src/features/settings/teams/components/team-form-dialog.tsx",
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
