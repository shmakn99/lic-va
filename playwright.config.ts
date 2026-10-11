import { defineConfig } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_NO_SERVER === "1" ? undefined : {
    command: process.env.PLAYWRIGHT_SERVER_COMMAND || "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
