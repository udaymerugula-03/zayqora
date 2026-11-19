import {test, expect} from "@playwright/test";

type Cat = {id: string; name: string; position: number; published: boolean; items: unknown[]};

test.beforeEach(async ({request}) => {
  await request.post("http://127.0.0.1:18117/__test/reset");
});

test("owner can quickly add Food and Drinks categories and customers see them", async ({page}) => {
  const categories: Cat[] = [];
  const posted: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => sessionStorage.setItem("zayqora-token", "test-owner"));
  await page.route("**/api/v1/menu/categories", async route => {
    if (route.request().method() === "POST") {
      const body: Pick<Cat, "name" | "position" | "published"> = route.request().postDataJSON();
      posted.push(body);
      const created: Cat = {id: `cat-${categories.length + 1}`, items: [], ...body};
      categories.push(created);
      return route.fulfill({status: 201, json: created});
    }
    return route.fulfill({json: {items: categories}});
  });
  await page.goto("/app/menu");
  await expect(page.getByText("Your menu is empty. Add a Food or Drinks category first, then add items to it.")).toBeVisible();
  await page.getByRole("button", {name: "+ Add Food category"}).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/Category name/)).toHaveValue("Food");
  await dialog.getByRole("button", {name: "Save category"}).click();
  await expect(page.getByRole("heading", {name: "Food", exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "+ Add Food category"})).toHaveCount(0);
  await page.getByRole("button", {name: "+ Add Drinks category"}).click();
  await expect(page.getByRole("dialog").getByLabel(/Category name/)).toHaveValue("Drinks");
  await page.getByRole("dialog").getByRole("button", {name: "Save category"}).click();
  await expect(page.getByRole("heading", {name: "Drinks", exact: true})).toBeVisible();
  expect(posted.map(p => [p.name, p.position, p.published])).toEqual([["Food", 0, true], ["Drinks", 1, true]]);
  await page.getByRole("button", {name: "+ Add category"}).click();
  await page.getByRole("dialog").getByLabel(/Category name/).fill("Desserts");
  await page.getByRole("dialog").getByRole("button", {name: "Save category"}).click();
  await expect(page.getByRole("heading", {name: "Desserts", exact: true})).toBeVisible();
});

test("customers get clear Food and Drinks category navigation", async ({page}) => {
  const item = (id: string, name: string, category_id: string) => ({id, category_id, name, description: `${name} sample`, image_url: "", price: "300.00", available: true, published: true, featured: false, variant_required: false, variants: [], modifiers: []});
  await page.route("**/api/v1/public/restaurants/saffron-table/menu", route => route.fulfill({json: {categories: [
    {id: "food", name: "Food", position: 0, published: true, items: [item("i1", "Sample Karahi", "food")]},
    {id: "drinks", name: "Drinks", position: 1, published: true, items: [item("i2", "Sample Lassi", "drinks")]}
  ]}}));
  await page.goto("/r/saffron-table/menu");
  const nav = page.getByRole("group", {name: "Menu category"});
  await expect(nav.getByRole("button", {name: "All food & drinks"})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", {name: "Food", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Drinks", exact: true})).toBeVisible();
  await nav.getByRole("button", {name: /^Drinks/}).click();
  await expect(page.getByText("Sample Lassi", {exact: true})).toBeVisible();
  await expect(page.getByText("Sample Karahi", {exact: true})).toHaveCount(0);
  await expect(page.getByText("1 item", {exact: true})).toBeVisible();
});
