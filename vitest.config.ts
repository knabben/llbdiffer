import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Cast: @vitejs/plugin-react's Plugin type resolves against a different
  // (duplicated) copy of `vite` than the one vitest/config re-exports,
  // which TypeScript sees as structurally incompatible even though it
  // works correctly at runtime. Well-known Vite/Vitest ecosystem issue.
  plugins: [react() as any],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
  },
});
