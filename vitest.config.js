import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Tests unitaires : logique sans navigateur (Node). Les tests dans un vrai navigateur
// sont dans test/e2e (Playwright).
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  define: {
    __DEV__: 'true',
    __VERSION__: '"test"',
  },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
  },
});
