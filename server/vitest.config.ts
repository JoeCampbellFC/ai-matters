import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The default threads/forks pools are unreliable on some Windows setups
    // (intermittent "failed to find the runner" / worker-state errors across
    // multiple test files); vmForks has been reliable where those weren't.
    pool: 'vmForks',
  },
})
