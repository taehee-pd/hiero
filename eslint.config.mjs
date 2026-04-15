import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'node_modules/',
      '.next/',
      'out/',
      'dist/',
      'packages/*/dist/',
      'ci-artifacts/',
      '.codex/',
      'desktop/node_modules/',
      'desktop/.electrobun/',
      'desktop/.generated/',
      'desktop/build/',
      'public/',
      'scripts/',
      'tests/',
      'storybook-static/',
    ],
  },

  // Base JS recommended rules
  eslint.configs.recommended,

  // TypeScript recommended (no type-checked rules — add later once all TS errors are resolved)
  ...tseslint.configs.recommended,

  // React hooks — classic rules only (project does not use React Compiler)
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // Project-specific overrides
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      // Allow require() in config files
      '@typescript-eslint/no-require-imports': 'off',
      // Allow empty object types in generic constraints
      '@typescript-eslint/no-empty-object-type': 'off',
      // process/require/__dirname are available in Node and Next.js
      'no-undef': 'off',
    },
  },

  // Design-system layer boundaries — see specs/design-system-storybook.plan.md §3.
  //
  // Flat config rules do NOT merge across matching blocks — the last matching
  // block wins per rule. So order matters here:
  //   1. Repo-wide kibo-ui ban (weakest — applies to every file)
  //   2. components/ui primitives-only (stricter override for ui/)
  //   3. components/ds layer ban (stricter override for ds/)
  // The two scoped blocks come LAST so they win for their respective files
  // and their wider pattern set (not just kibo-ui) is the one applied.

  // Repo-wide: nobody imports from the deleted kibo-ui folder.
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/kibo-ui', '@/components/kibo-ui/*'],
              message:
                'components/kibo-ui was removed in Phase 2 Commit A. Import directly from @/components/ui/<primitive> or @/components/ds.',
            },
          ],
        },
      ],
    },
  },
  // components/ui is primitives-only: may not import from DS or feature folders.
  {
    files: ['components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/ds',
                '@/components/ds/*',
                '@/components/editor/*',
                '@/components/studio/*',
                '@/components/explorer/*',
                '@/components/export/*',
                '@/components/kibo-ui',
                '@/components/kibo-ui/*',
              ],
              message:
                'components/ui is primitives-only. No DS, feature, or kibo-ui imports.',
            },
          ],
        },
      ],
    },
  },
  // components/ds is the shared layer: may not import from feature folders.
  {
    files: ['components/ds/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/editor/*',
                '@/components/studio/*',
                '@/components/explorer/*',
                '@/components/export/*',
                '@/components/kibo-ui',
                '@/components/kibo-ui/*',
              ],
              message:
                'components/ds cannot import from feature folders or the removed kibo-ui.',
            },
          ],
        },
      ],
    },
  },

  // Dynamic-import + require() bypass guard — codex adversarial review
  // finding #5. ESLint's no-restricted-imports only covers static
  // `import ... from '...'` syntax. Dynamic `import('@/components/kibo-ui/x')`
  // and `require('@/components/kibo-ui/x')` pass the static rule
  // unchallenged. no-restricted-syntax runs on the AST, so it catches
  // both shapes. Repo-wide because the removed kibo-ui folder should
  // never be reachable from any layer.
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportExpression[source.type='Literal'][source.value=/^@\\/components\\/kibo-ui(\\/|$)/]",
          message:
            'components/kibo-ui was removed in Phase 2. Dynamic import() of the deleted folder is forbidden.',
        },
        {
          selector:
            "CallExpression[callee.name='require'][arguments.0.type='Literal'][arguments.0.value=/^@\\/components\\/kibo-ui(\\/|$)/]",
          message:
            'components/kibo-ui was removed in Phase 2. require() of the deleted folder is forbidden.',
        },
      ],
    },
  },
  // Dynamic-import guard for the components/ui primitives-only layer.
  // Static rule above catches `import from '@/components/ds'`; this
  // catches `import('@/components/ds')` / `require('@/components/ds')`.
  {
    files: ['components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportExpression[source.type='Literal'][source.value=/^@\\/components\\/(ds|editor|studio|explorer|export)(\\/|$)/]",
          message:
            'components/ui is primitives-only. Dynamic import() of DS or feature folders is forbidden.',
        },
        {
          selector:
            "CallExpression[callee.name='require'][arguments.0.type='Literal'][arguments.0.value=/^@\\/components\\/(ds|editor|studio|explorer|export)(\\/|$)/]",
          message:
            'components/ui is primitives-only. require() of DS or feature folders is forbidden.',
        },
      ],
    },
  },
  // Dynamic-import guard for the components/ds layer.
  {
    files: ['components/ds/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportExpression[source.type='Literal'][source.value=/^@\\/components\\/(editor|studio|explorer|export)(\\/|$)/]",
          message:
            'components/ds cannot dynamically import from feature folders.',
        },
        {
          selector:
            "CallExpression[callee.name='require'][arguments.0.type='Literal'][arguments.0.value=/^@\\/components\\/(editor|studio|explorer|export)(\\/|$)/]",
          message:
            'components/ds cannot require() feature folders.',
        },
      ],
    },
  },
);
