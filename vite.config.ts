/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { offlineServiceWorker } from './build/sw-plugin.ts'

export default defineConfig({
  base: './',
  plugins: [react(), offlineServiceWorker()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'build/**/*.test.ts'],
  },
})
