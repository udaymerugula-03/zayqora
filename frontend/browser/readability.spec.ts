import {test, expect, type Locator, type Page} from "@playwright/test";

async function readable(locator: Locator, minimum: number) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(minimum);
}

async function touchTarget(locator: Locator) {
  await readable(locator, 14);
  const bounds = await locator.boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
}

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test.beforeEach(async ({request}) => {
  await request.post("http://127.0.0.1:18117/__test/reset");
});

for (const width of [320, 390, 768, 1440]) {
  test(`readable text and usable controls across customer and owner screens at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    await page.goto("/");
    await readable(page.locator(".editorial-copy > p"), 16);
    await readable(page.getByRole("searchbox", {name: "Search restaurants or cuisine"}), 16);
    if (width <= 960) await touchTarget(page.getByRole("button", {name: "Menu", exact: true}));
    await fits(page);
    await page.goto("/login");
    await readable(page.getByLabel("Email address"), 16);
    await readable(page.getByLabel("Password", {exact: true}), 16);
    await touchTarget(page.getByRole("button", {name: "Sign in →"}));
    await fits(page);
    await page.goto("/r/saffron-table/menu");
    await readable(page.locator(".menu-card .card-body p").first(), 16);
    await touchTarget(page.getByRole("button", {name: "Customise +"}).first());
    await page.getByRole("button", {name: "Customise +"}).first().click();
    const dialog = page.getByRole("dialog");
    await touchTarget(dialog.getByRole("button", {name: "Close dialog"}));
    await dialog.getByRole("radio").first().check();
    await touchTarget(dialog.getByRole("button", {name: "Add to bag +"}));
    await dialog.getByRole("button", {name: "Add to bag +"}).click();
    await page.goto("/r/saffron-table/checkout");
    await readable(page.getByLabel("Full name"), 16);
    await readable(page.getByLabel("Email address"), 16);
    await readable(page.getByText("A few details to help the restaurant look after your order.", {exact: true}), 16);
    await fits(page);
    await page.evaluate(() => sessionStorage.setItem("zayqora-token", "test-owner"));
    await page.goto("/app/orders");
    await readable(page.locator(".page-description p"), 16);
    await readable(page.locator(".page-title .eyebrow"), 13);
    await readable(page.getByLabel("Search reference or customer"), 16);
    await touchTarget(page.getByRole("button", {name: "Refresh orders", exact: true}));
    if (width <= 960) await touchTarget(page.getByRole("button", {name: "Workspace menu", exact: true}));
    await fits(page);
    await page.goto("/app/settings");
    await readable(page.getByLabel("Restaurant name", {exact: true}), 16);
    await readable(page.getByLabel("mon opens"), 16);
    await fits(page);
    await page.goto("/app/menu");
    await fits(page);
  });
}
