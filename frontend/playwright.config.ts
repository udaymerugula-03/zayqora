import {defineConfig} from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:3117",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
    screenshot: "only-on-failure"
  },
  webServer: [
    {command:"node browser/fixture-server.mjs",url:"http://127.0.0.1:18117/health",reuseExistingServer:false},
    {command:"npm.cmd run start -- -p 3117",url:"http://127.0.0.1:3117",reuseExistingServer:false,env:{API_ORIGIN:"http://127.0.0.1:18117",PUBLIC_ORIGIN:"http://127.0.0.1:3117",NEXT_TELEMETRY_DISABLED:"1"}}
  ]
});
