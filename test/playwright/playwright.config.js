// Contract tests under the Playwright binding, in real Chrome against the
// published grid. The fixture server is the package's own test/server.js.
import { defineConfig } from '@playwright/test';

const PORT = 4791;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    headless: true,
    viewport: { width: 1100, height: 900 },
  },
  webServer: {
    command: 'node test/server.js',
    cwd: '../..',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/test/fixtures/grid.html`,
    reuseExistingServer: false,
  },
});
