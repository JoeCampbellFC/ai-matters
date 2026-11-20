import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The default threads/forks pools are unreliable on some Windows setups
    // (intermittent "failed to find the runner"/worker-state errors across
    // multiple test files); vmForks has been reliable where those weren't.
    pool: 'vmForks',
  },
})
