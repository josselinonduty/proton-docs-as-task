import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig(
  {
    // Generated / build output — never lint these.
    ignores: ['.wxt/**', '.output/**', 'node_modules/**', 'stats*.html', 'stats-*.json'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // react-hooks v7's full set: the rules of hooks plus the compiler-backed
      // checks (refs read in render, impure render, setState in effects, …).
      // We don't run the React Compiler; the rules still catch real bugs.
      ...reactHooks.configs.flat['recommended-latest'].rules,
      // `t` is the translation function almost everywhere; don't let a local hide it.
      '@typescript-eslint/no-shadow': 'error',
      // Reach outside the current folder through the `@/` alias (`@/lib/model`),
      // never `../`; same-folder imports stay relative (`./BoardCard`).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Import from outside this folder with the `@/` alias (`@/` is `src/`).',
            },
          ],
        },
      ],
    },
  },
  {
    // Test files run under Node/Vitest globals.
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Turn off stylistic rules that Prettier owns. Keep this last.
  prettier,
);
