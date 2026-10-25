import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The `@/` alias WXT generates for the extension build (`@/` → `src/`).
    // Root-relative: Vite resolves `/src/…` against the project root.
    alias: { '@': '/src' },
  },
  test: {
    // Runtime globals only, so Testing Library unmounts after each test on its
    // own. They aren't typed (tsconfig.json has no `vitest/globals`): tests
    // import what they use from `vitest`.
    globals: true,
    // Pure-logic tests run in Node; component/interaction tests opt into jsdom
    // per file via a `// @vitest-environment jsdom` pragma.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
