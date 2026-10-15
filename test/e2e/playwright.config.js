/**
 * E2E-Test gegen den Wegwerf-Stack aus test/e2e/compose.yaml (npm run test:e2e). Nutzt das
 * installierte Chrome statt eines eigenen Browser-Downloads. Nicht Teil von npm test und vom
 * pre-commit-Hook: Build und Docker brauchen rund eine Minute.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  globalSetup: './setup.js',
  globalTeardown: './teardown.js',
  outputDir: '../.cache/e2e',
  reporter: 'list',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:3100/',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
});
