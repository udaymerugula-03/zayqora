import { expect, test } from "@playwright/test";
import {signIn} from "./auth";

const publicRestaurantSlug = process.env.E2E_PUBLIC_RESTAURANT_SLUG;
const publicOwnerEmail = process.env.E2E_PUBLIC_OWNER_EMAIL;

test("guest cash order reaches paid completion through the owner workspace", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  test.skip(!publicRestaurantSlug || !publicOwnerEmail, "Mutating public flows need an explicitly configured isolated test restaurant and owner.");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true });
  await page.goto(`/r/${publicRestaurantSlug}/menu`);
  await expect(page.getByRole("button", { name: "Customise +" }).first()).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("menu.png"), fullPage: true });
  await page.getByRole("button", { name: "Customise +" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const variants = dialog.getByRole("radio");
  if (await variants.count()) await variants.first().check();
  await dialog.getByRole("button", { name: "Add to bag +" }).click();
  await page.goto(`/r/${publicRestaurantSlug}/checkout`);
  await page.getByLabel("Full name").fill("Demonstration Guest");
  await page.getByLabel("Email address").fill("demo-guest@example.com");
  await page.getByLabel("Phone number").fill("+923001234567");
  await page.getByRole("checkbox", { name: /I agree to the terms/ }).check();
  await page.getByRole("checkbox", { name: /I confirm this current total/ }).check();
  const creation = page.waitForResponse(response =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === `/api/v1/public/restaurants/${publicRestaurantSlug}/orders`,
  );
  await page.getByRole("button", { name: "Place cash order →" }).click();
  const created = await creation;
  expect(created.status()).toBe(201);
  const { reference }: { reference: string } = await created.json();
  await expect(page).toHaveURL(/\/track\/[^/]+$/);
  const trackingUrl = page.url();
  await expect(page.getByText("unpaid", { exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText(reference);
  await page.screenshot({ path: testInfo.outputPath("tracking.png"), fullPage: true });

  await signIn(page, publicOwnerEmail!);
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
  await signIn(page, "owner@zayqora.demo");
  for (const path of ["setup", "menu", "orders", "kitchen", "reservations", "inquiries", "website", "settings", "notifications"]) {
    await page.goto(`/app/${path}`);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ZAYQORA home" }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`${path}.png`), fullPage: true });
  }
  await page.goto("/platform/overview");
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  const workspaceMenu = page.getByRole("button", { name: "Workspace menu" });
  if (await workspaceMenu.isVisible()) await workspaceMenu.click();
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

test("published sample restaurants are available with clear demonstration labels", async ({page,request}) => {
  const response = await request.get("/api/v1/public/restaurants");
  expect(response.status()).toBe(200);
  const listing = await response.json();
  for (const slug of ["saffron-table","garden-cafe"]) {
    expect(listing.items).toEqual(expect.arrayContaining([expect.objectContaining({slug,is_demo:true})]));
    const detail = await request.get(`/api/v1/public/restaurants/${slug}`);
    expect(detail.status()).toBe(200);
    await page.goto(`/r/${slug}`);
    await expect(page.getByRole("note")).toContainText("Sample restaurant.");
    await expect(page.getByRole("note")).toContainText("no real food, delivery or table booking is provided");
    await page.goto(`/r/${slug}/menu`);
    await expect(page.getByRole("button",{name:"Customise +"}).first()).toBeEnabled();
    await page.goto(`/r/${slug}/reservations`);
    await expect(page.getByRole("note")).toContainText("Sample restaurant.");
  }
});

test("a guest reservation request appears in the owner queue and can be resolved", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!publicRestaurantSlug || !publicOwnerEmail, "Mutating public flows need an explicitly configured isolated test restaurant and owner.");
  const tomorrow = new Date(Date.now() + 86_400_000);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(tomorrow);
  await page.goto(`/r/${publicRestaurantSlug}/reservations`);
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

  await signIn(page, publicOwnerEmail!);
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
