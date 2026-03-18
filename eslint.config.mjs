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
      'ci-artifacts/',
      'desktop/node_modules/',
      'desktop/.electrobun/',
      'desktop/.generated/',
      'desktop/build/',
      'public/',
      'scripts/',
      'tests/',
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
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Project-specific overrides
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow explicit any during hardening phase — tighten later
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow require() in config files
      '@typescript-eslint/no-require-imports': 'off',
      // Allow empty object types in generic constraints
      '@typescript-eslint/no-empty-object-type': 'off',
      // process/require/__dirname are available in Node and Next.js
      'no-undef': 'off',
    },
  },
);
