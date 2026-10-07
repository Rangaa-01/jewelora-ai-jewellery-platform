import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const backendPort = process.env.BACKEND_PORT ?? "8001";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./specs",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["github"], ["html", { outputFolder: "./playwright-report", open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `cd ../../backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${backendPort}`,
      url: `http://127.0.0.1:${backendPort}/api/v1/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: { BACKEND_PORT: backendPort },
    },
    {
      command: isCI ? "cd ../../frontend && npm run start" : "cd ../../frontend && npm run dev",
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: { BACKEND_INTERNAL_URL: `http://127.0.0.1:${backendPort}` },
    },
  ],
});
