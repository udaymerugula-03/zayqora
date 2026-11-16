import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

type Credentials = Record<string, { password: string; role: string }>;
function credentials(): Credentials {
  return JSON.parse(
    readFileSync(process.env.E2E_CREDENTIALS_FILE ?? ".demo-credentials.json", "utf8"),
  );
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(credentials()[email].password);
  try {
    await page.getByRole("button", { name: "Sign in →" }).click();
  } finally {
    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>('input[type="password"]');
      if (field) field.value = "";
    });
  }
  await expect(page).toHaveURL(
    email === "admin@zayqora.demo" ? /\/platform\/overview$/ : /\/app\/dashboard$/,
  );
}

test("guest cash order reaches paid completion through the owner workspace", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true });
  await page.goto("/r/saffron-table/menu");
  await expect(page.getByRole("button", { name: "Customise +" }).first()).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("menu.png"), fullPage: true });
  await page.getByRole("button", { name: "Customise +" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const variants = dialog.getByRole("radio");
  if (await variants.count()) await variants.first().check();
  await dialog.getByRole("button", { name: "Add to bag +" }).click();
  await page.goto("/r/saffron-table/checkout");
  await page.getByLabel("Full name").fill("Demonstration Guest");
  await page.getByLabel("Email address").fill("demo-guest@example.com");
  await page.getByLabel("Phone number").fill("+923001234567");
  await page.getByRole("checkbox", { name: /I agree to the terms/ }).check();
  await page.getByRole("checkbox", { name: /I confirm this current total/ }).check();
  await page.getByRole("button", { name: "Place cash order →" }).click();
  await expect(page).toHaveURL(/\/track\/[^/]+$/);
  const trackingUrl = page.url();
  await expect(page.getByText("unpaid", { exact: true })).toBeVisible();
  const reference = await page.locator("main .panel h2").first().innerText();
  await page.screenshot({ path: testInfo.outputPath("tracking.png"), fullPage: true });

  await signIn(page, "owner@saffrontable.demo");
  await page.screenshot({ path: testInfo.outputPath("owner-dashboard.png"), fullPage: true });
  await page.goto("/app/orders");
  const row = page.getByRole("row").filter({ hasText: reference });
  await row.getByRole("button", { name: "Open order" }).click();
  const order = page.getByRole("dialog");
  for (const status of ["CONFIRMED", "PREPARING", "READY"]) {
    await order.getByRole("button", { name: status, exact: true }).click();
    await order.getByRole("button", { name: "Confirm status change" }).click();
    await expect(order.getByRole("button", { name: "Confirm status change" })).toHaveCount(0, { timeout: 30_000 });
    await expect(row).toContainText(status);
  }
  await expect(order.getByRole("button", { name: "COMPLETED", exact: true })).toHaveCount(0);
  await expect(order.getByText("Completion is disabled until cash receipt is recorded.")).toBeVisible();
  await order.getByRole("button", { name: "Record cash received" }).click();
  await order.getByRole("checkbox", { name: /I have physically received/ }).check();
  await order.getByRole("button", { name: "Confirm cash receipt" }).click();
  await expect(row).toContainText("paid");
  await order.getByRole("button", { name: "COMPLETED", exact: true }).click();
  await order.getByRole("button", { name: "Confirm status change" }).click();
  await expect(row).toContainText("COMPLETED");
  await order.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/app/reports");
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("reports.png"), fullPage: true });
  await page.goto(trackingUrl);
  await expect(page.getByText("COMPLETED", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("paid", { exact: true })).toBeVisible();
});

test("live workspace pages retain branding and load their actual API data", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await signIn(page, "owner@saffrontable.demo");
  for (const path of ["menu", "orders", "reservations", "settings", "notifications"]) {
    await page.goto(`/app/${path}`);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ZAYQORA home" }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`${path}.png`), fullPage: true });
  }
  await page.goto("/platform/overview");
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, "admin@zayqora.demo");
  for (const path of ["overview", "tenants", "plans"]) {
    await page.goto(`/platform/${path}`);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`platform-${path}.png`), fullPage: true });
  }
});

test("a guest reservation request appears in the owner queue and can be resolved", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const tomorrow = new Date(Date.now() + 86_400_000);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(tomorrow);
  await page.goto("/r/saffron-table/reservations");
  await page.getByLabel("Date · Asia/Karachi").fill(date);
  await page.getByRole("group", { name: "Available reservation slots" })
    .getByRole("button").first().click();
  await page.getByLabel("Full name").fill("Demonstration Reservation");
  await page.getByLabel("Email", { exact: true }).fill("demo-reservation@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("+923001234567");
  await page.getByRole("checkbox", { name: /I agree to the terms/ }).check();
  await page.getByRole("button", { name: "Request this table →" }).click();
  await expect(page.getByText("Request received", { exact: true })).toBeVisible();
  const reference = await page.locator("main .panel h2").innerText();
  await expect(page.getByText("REQUESTED", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("reservation-received.png"), fullPage: true });

  await signIn(page, "owner@saffrontable.demo");
  await page.goto("/app/reservations");
  const row = page.getByRole("row").filter({ hasText: reference });
  await row.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Next status").selectOption("CONFIRMED");
  await dialog.getByRole("button", { name: "Save reservation status" }).click();
  await expect(row).toContainText("CONFIRMED");
  await row.getByRole("button", { name: "Review", exact: true }).click();
  await dialog.getByLabel("Next status").selectOption("CANCELLED");
  await dialog.getByLabel(/Reason \(required/).fill("Demonstration complete; release this test capacity.");
  await dialog.getByRole("button", { name: "Save reservation status" }).click();
  await expect(row).toContainText("CANCELLED");
});
