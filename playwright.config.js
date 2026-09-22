import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30000,
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:8085", timezoneId: "Europe/Stockholm", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  webServer: {
    command: "node tests/server.js",
    url: "http://127.0.0.1:8085",
    reuseExistingServer: !process.env.CI,
  },
});
