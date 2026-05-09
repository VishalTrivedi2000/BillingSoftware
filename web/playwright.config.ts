import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** BillingApp.Api http profile — must match `vite.config.ts` dev proxy target. */
const apiOrigin = process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:5151';

export default defineConfig({
  testDir: path.join(rootDir, 'e2e'),
  timeout: 120_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  globalSetup: path.join(rootDir, 'e2e', 'global-setup.ts'),
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    cwd: rootDir,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_API_ORIGIN: apiOrigin,
    },
  },
});
