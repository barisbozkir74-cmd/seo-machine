import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Next.js path alias — tests can import @/lib/...
      '@': path.resolve(__dirname, './src'),
      // Mock server-only package in test environment
      'server-only': path.resolve(__dirname, './src/__mocks__/server-only.ts'),
    },
  },
  test: { environment: 'node' },
})
