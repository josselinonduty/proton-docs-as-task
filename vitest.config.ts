import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Pure-logic tests run in Node; component/interaction tests opt into jsdom
    // per file via a `// @vitest-environment jsdom` pragma.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
