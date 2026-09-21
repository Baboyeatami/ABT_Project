import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui',
  use: { baseURL: 'http://127.0.0.1:5175', browserName: 'chromium', headless: true },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    env: { VITE_DEMO_MODE: '1' },
    reuseExistingServer: false,
  },
})
