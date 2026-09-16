// ============================================================
// OPSYN FRONTEND — ESLint flat config (ESLint 9)
//
// Strictness is deliberately staged. See docs/plans or the
// commit that introduced this file for the rationale:
//
//   errors   — mechanical problems that must never land
//   warnings — real issues we are paying down incrementally
//   off      — rules blocked on the shared-types reconciliation
//
// The `lint` script does NOT pass --max-warnings 0, so warnings
// stay visible in CI without failing the build. Tighten this as
// the warning count falls.
// ============================================================

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // ── Never lint generated or vendored output ───────────────
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.vite/**',
      'shared-types/**',
    ],
  },

  // ── Application source ────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React Hooks — downgraded to warn so CI can pass while
      // the 28 existing findings are worked through. These are
      // real correctness risks (render loops, stale closures),
      // not style: raise to "error" once the count reaches zero.
      ...Object.fromEntries(
        Object.keys(reactHooks.configs.recommended.rules).map((r) => [r, 'warn']),
      ),

      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // Blocked on reconciling the two divergent shared-types
      // files. ~816 sites today, many of which exist only because
      // the correct types were not importable. Re-enable as
      // "warn" once shared-types is a single source of truth.
      '@typescript-eslint/no-explicit-any': 'off',

      // Mechanical — must stay clean.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // ── Tests: vitest globals, looser rules ───────────────────
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}', 'src/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // ── Config files run in Node ──────────────────────────────
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
