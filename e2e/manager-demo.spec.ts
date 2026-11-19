import {expect, test, type Page} from "@playwright/test";
import type {Category, MenuItem, Order, Restaurant} from "../frontend/src/lib/types";
import {signIn} from "./auth";

async function addItem(page: Page, slug: string, item: MenuItem) {
  await page.goto(`/r/${slug}/menu`);
  const card = page.locator(".menu-card").filter({
    has: page.getByRole("heading", {name: item.name, exact: true}),
  });
  await card.getByRole("button", {name: "Customise +"}).click();
  const dialog = page.getByRole("dialog");
  if (item.variant_required) await dialog.getByRole("radio").first().check();
  await dialog.getByRole("button", {name: "Add to bag +"}).click();
  await expect(dialog).toHaveCount(0);
}

test("manager demo: a second customer checks out food and drinks and the owner receives only the placed order", async ({
  browser, request,
}, testInfo) => {
  test.setTimeout(180_000);
  const slug = process.env.E2E_PUBLIC_RESTAURANT_SLUG;
  const ownerEmail = process.env.E2E_PUBLIC_OWNER_EMAIL;
  test.skip(process.env.E2E_MANAGER_DEMO !== "1" || !slug || !ownerEmail,
    "Explicit opt-in and a sample restaurant owner are required. This creates one unpaid demonstration order.");
  test.skip(testInfo.project.name !== "desktop", "Create one demonstration order, not one per viewport.");
  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL || !slug || !ownerEmail) throw new Error("The demonstration environment is incomplete.");
  const restaurantResponse = await request.get(`/api/v1/public/restaurants/${slug}`);
  expect(restaurantResponse.ok()).toBeTruthy();
  const restaurant: Restaurant = await restaurantResponse.json();
  expect(restaurant.is_demo, "Never create a manager demonstration order for a real restaurant").toBe(true);
  expect(restaurant.allow_pickup).toBe(true);
  const menuResponse = await request.get(`/api/v1/public/restaurants/${slug}/menu`);
  expect(menuResponse.ok()).toBeTruthy();
  const {categories}: {categories: Category[]} = await menuResponse.json();
  const orderable = (item: MenuItem) => item.published && item.available && (!item.variant_required || item.variants.length > 0);
  const drink = categories.filter(category => category.published && /^drinks$/i.test(category.name))
    .flatMap(category => category.items).find(orderable);
  const food = categories.filter(category => category.published && !/^drinks$/i.test(category.name))
    .flatMap(category => category.items).find(orderable);
  if (!food || !drink) throw new Error("The sample restaurant needs published food and drinks before the demonstration.");

  const firstCustomer = await browser.newContext({baseURL, viewport: {width: 390, height: 844}});
  const secondCustomer = await browser.newContext({baseURL, viewport: {width: 390, height: 844}});
  const ownerContext = await browser.newContext({baseURL, viewport: {width: 1440, height: 1000}});
  try {
    const owner = await ownerContext.newPage();
    await signIn(owner, ownerEmail);
    const ownedRestaurant = await owner.evaluate(async () => {
      const response = await fetch("/api/v1/restaurant", {
        headers: {Authorization: `Bearer ${sessionStorage.getItem("zayqora-token")}`},
      });
      if (!response.ok) throw new Error("Cannot verify the demonstration owner.");
      const {id, is_demo}: Restaurant = await response.json();
      return {id, is_demo};
    });
    expect(ownedRestaurant).toMatchObject({id: restaurant.id, is_demo: true});
    const ordersBefore = await owner.evaluate(async () => {
      const response = await fetch("/api/v1/orders", {
        headers: {Authorization: `Bearer ${sessionStorage.getItem("zayqora-token")}`},
      });
      if (!response.ok) throw new Error("Cannot read the owner's order count.");
      return (await response.json()).total as number;
    });
    const first = await firstCustomer.newPage();
    await addItem(first, slug, food);
    const customer = await secondCustomer.newPage();
    await customer.goto(`/r/${slug}/cart`);
    await expect(customer.getByText("Your bag is empty.", {exact: false})).toBeVisible();
    await owner.goto("/app/orders");
    await expect(owner.locator(".orders-table-heading")).toContainText(`${ordersBefore} matching record(s)`);
    await addItem(customer, slug, food);
    await addItem(customer, slug, drink);
    await customer.goto(`/r/${slug}/cart`);
    await expect(customer.getByRole("heading", {name: food.name, exact: true})).toBeVisible();
    await expect(customer.getByRole("heading", {name: drink.name, exact: true})).toBeVisible();
    await customer.screenshot({path: testInfo.outputPath("customer-food-drinks-cart.png"), fullPage: true});
    await customer.getByRole("link", {name: "Continue to checkout →"}).click();
    await customer.getByLabel("Full name").fill("Manager Demo Customer");
    await customer.getByLabel("Email address").fill("manager-demo@example.com");
    await customer.getByLabel("Phone number").fill("+923000000000");
    await customer.getByLabel("Order notes (optional)").fill("Manager demonstration only. Sample order: no real food, delivery or cash payment.");
    await customer.getByRole("checkbox", {name: /I agree to the terms/}).check();
    await customer.getByRole("checkbox", {name: /I confirm this current total/}).check();
    const createdResponse = customer.waitForResponse(response =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/v1/public/restaurants/${slug}/orders`,
    );
    await customer.getByRole("button", {name: "Place cash order →"}).click();
    const response = await createdResponse;
    expect(response.status()).toBe(201);
    const created: Order = await response.json();
    expect(created).toMatchObject({is_demo: true, status: "PENDING", payment_status: "unpaid"});
    await expect(customer).toHaveURL(/\/track\/[^/]+$/);
    await customer.screenshot({path: testInfo.outputPath("customer-order-confirmation.png"), fullPage: true});
    await owner.getByRole("button", {name: "Refresh orders", exact: true}).click();
    const row = owner.getByRole("row").filter({hasText: created.reference});
    await expect(row).toContainText("Manager Demo Customer");
    await row.getByRole("button", {name: "Open order", exact: true}).click();
    const order = owner.getByRole("dialog");
    await expect(order).toContainText(food.name);
    await expect(order).toContainText(drink.name);
    await expect(order).toContainText("Manager demonstration only.");
    await expect(order.getByRole("button", {name: "CONFIRMED", exact: true})).toBeEnabled();
    await owner.screenshot({path: testInfo.outputPath("owner-received-food-drinks-order.png"), fullPage: true});
    await first.goto(`/r/${slug}/cart`);
    await expect(first.getByRole("heading", {name: food.name, exact: true})).toBeVisible();
    await expect(first.getByRole("heading", {name: drink.name, exact: true})).toHaveCount(0);
    await customer.goto(`/r/${slug}/cart`);
    await expect(customer.getByText("Your bag is empty.", {exact: false})).toBeVisible();
  } finally {
    await firstCustomer.close();
    await secondCustomer.close();
    await ownerContext.close();
  }
});
