import { defineConfig, devices } from '@playwright/test';

/**
 * Safai Connect — Playwright E2E Configuration
 * Runs against http://localhost:5173 (Vite dev server, auto-started)
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Run tests sequentially — prevents Firebase Auth rate-limiting
  fullyParallel: false,
  workers: 1,

  // Retry on CI only
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Desktop viewport for sidebar to be visible
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Auto-start Vite dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
