import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4173/visualization-lab/', trace: 'retain-on-failure' },
  projects: [
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1440, height: 1000 } } },
    { name: 'phone', use: { browserName: 'chromium', channel: 'msedge', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'ipad-portrait', use: { ...devices['iPad (gen 7)'], browserName: 'webkit' } },
    { name: 'ipad-landscape', use: { ...devices['iPad (gen 7) landscape'], browserName: 'webkit' } },
  ],
  webServer: { command: 'node tools/serve.js', url: 'http://127.0.0.1:4173/visualization-lab/', reuseExistingServer: !process.env.CI },
});
