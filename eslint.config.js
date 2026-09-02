import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
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
      // The two long-stable, high-signal hook rules. (react-hooks v7's full
      // `recommended` set adds opinionated compiler-style rules we don't opt in to.)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
